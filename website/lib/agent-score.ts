/**
 * Hosted agent-readiness scoring for the public website.
 *
 * The public score starts with AFDocs' Agent-Friendly Documentation
 * Spec scorecard, then adds opt-in framework checks when a site exposes
 * the @farming-labs/docs agent discovery spec. This keeps generic docs
 * sites scored by the public standard while dogfooding the extra agent
 * surfaces that `docs doctor --agent --url` verifies for our framework.
 */
import { CATEGORIES, computeScore, runChecks } from "afdocs";
import type { CheckResult, ReportResult, ScoreResult } from "afdocs";
import {
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE,
  DEFAULT_MCP_PUBLIC_ROUTE,
  DEFAULT_MCP_WELL_KNOWN_ROUTE,
  DEFAULT_ROBOTS_TXT_ROUTE,
  DEFAULT_SITEMAP_MD_ROUTE,
  DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE,
  DEFAULT_SITEMAP_XML_ROUTE,
  DEFAULT_SKILL_MD_ROUTE,
  DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
  analyzeDocsRobotsTxt,
} from "@farming-labs/docs";

// Kept in sync with @modelcontextprotocol/sdk; the deployed MCP server
// negotiates any version it advertises so bumps are safe.
const MCP_PROTOCOL_VERSION = "2025-11-25";
const PROBE_TIMEOUT_MS = 9000;
const AF_DOCS_MAX_LINKS_TO_TEST = 10;
const AF_DOCS_REQUEST_DELAY_MS = 50;
const AF_DOCS_MAX_CONCURRENCY = 6;

export type ScoreStatus = "pass" | "warn" | "fail";

export type AgentScoreGrade = "Agent-optimized" | "Agent-ready" | "Promising" | "Needs work";

export type AgentScoreCheckId = string;

export interface AgentScoreCheck {
  id: AgentScoreCheckId;
  title: string;
  detail: string;
  status: ScoreStatus;
  score: number;
  maxScore: number;
  recommendation?: string;
}

export interface AgentScoreCategory {
  id: string;
  title: string;
  score: number | null;
  grade: string | null;
}

export interface AgentScoreDiagnostic {
  id: string;
  severity: string;
  message: string;
  resolution: string;
}

export interface AgentScoreStandardSummary {
  score: number;
  grade: string;
  pass: number;
  warn: number;
  fail: number;
  skip: number;
  testedPages?: number;
  samplingStrategy?: string;
  categories: AgentScoreCategory[];
  diagnostics: AgentScoreDiagnostic[];
}

export interface AgentScoreReport {
  url: string;
  baseUrl: string;
  name: string;
  framework?: string;
  score: number;
  maxScore: 100;
  rawScore: number;
  rawMaxScore: number;
  grade: AgentScoreGrade;
  standard: AgentScoreStandardSummary;
  checks: AgentScoreCheck[];
  recommendations: string[];
  generatedAt: string;
}

export function normalizeAgentScoreBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

export function deriveAgentScoreSiteName(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.replace(/^www\./i, "");
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    return path ? `${host}/${path}` : host;
  } catch {
    return baseUrl;
  }
}

function joinUrl(baseUrl: string, route: string): string {
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  const routePath = route.startsWith("/") ? route : `/${route}`;
  return new URL(`${basePath}${routePath}`, base.origin).toString();
}

function originBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  return url.origin;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "@farming-labs/docs agent-score probe",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

interface TextProbe {
  ok: boolean;
  status?: number;
  detail: string;
  body?: string;
}

async function probeTextRoute(
  baseUrl: string,
  route: string,
  accept = "text/plain, text/markdown, */*",
): Promise<TextProbe> {
  const url = joinUrl(baseUrl, route);
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: accept } });
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned HTTP ${response.status}.`,
      };
    }
    if (body.trim().length === 0) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned an empty body.`,
      };
    }
    return {
      ok: true,
      status: response.status,
      detail: `${route} returned HTTP ${response.status} with ${body.length} characters.`,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${route} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

interface JsonProbe {
  ok: boolean;
  status?: number;
  detail: string;
  body?: unknown;
}

async function probeJsonRoute(baseUrl: string, route: string): Promise<JsonProbe> {
  const url = joinUrl(baseUrl, route);
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned HTTP ${response.status}.`,
      };
    }
    try {
      const body = JSON.parse(text) as unknown;
      return { ok: true, status: response.status, detail: `${route} returned valid JSON.`, body };
    } catch {
      return {
        ok: false,
        status: response.status,
        detail: `${route} did not return valid JSON.`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      detail: `${route} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

async function postMcpJson(
  baseUrl: string,
  route: string,
  body: unknown,
  sessionId?: string,
): Promise<Response> {
  return fetchWithTimeout(joinUrl(baseUrl, route), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
}

interface McpResponseEnvelope {
  jsonrpc?: string;
  id?: unknown;
  result?: unknown;
  error?: { code?: unknown; message?: unknown; data?: unknown };
}

async function parseMcpResponse(response: Response): Promise<McpResponseEnvelope> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("application/json")) {
    return JSON.parse(body) as McpResponseEnvelope;
  }

  const lastData = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .filter(Boolean)
    .at(-1);

  if (!lastData) {
    throw new Error(`Expected MCP JSON-RPC payload, got ${body.slice(0, 120) || "empty body"}.`);
  }

  return JSON.parse(lastData) as McpResponseEnvelope;
}

interface McpProbe {
  ok: boolean;
  detail: string;
  tools?: string[];
}

function shouldRetryMcpProbe(probe: McpProbe): boolean {
  return /session not found|session not initialized/i.test(probe.detail);
}

async function probeMcpRoute(baseUrl: string, route: string): Promise<McpProbe> {
  let lastProbe: McpProbe | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const probe = await probeMcpRouteOnce(baseUrl, route);
    if (probe.ok) return probe;
    lastProbe = probe;
    if (!shouldRetryMcpProbe(probe)) break;
  }

  return lastProbe ?? { ok: false, detail: "MCP endpoint failed before returning a result." };
}

async function probeMcpRouteOnce(baseUrl: string, route: string): Promise<McpProbe> {
  try {
    const initializeResponse = await postMcpJson(baseUrl, route, {
      jsonrpc: "2.0",
      id: "agent-score-initialize",
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "@farming-labs/docs agent-score", version: "0.1.0" },
      },
    });
    const initializePayload = await parseMcpResponse(initializeResponse);

    if (!initializeResponse.ok || initializePayload.error) {
      return {
        ok: false,
        detail: `${route} initialize returned HTTP ${initializeResponse.status}${
          initializePayload.error?.message ? `: ${String(initializePayload.error.message)}` : ""
        }.`,
      };
    }

    const sessionId = initializeResponse.headers.get("mcp-session-id") ?? undefined;

    if (sessionId) {
      await postMcpJson(
        baseUrl,
        route,
        { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
        sessionId,
      ).catch(() => undefined);
    }

    const toolsResponse = await postMcpJson(
      baseUrl,
      route,
      { jsonrpc: "2.0", id: "agent-score-tools", method: "tools/list", params: {} },
      sessionId,
    );
    const toolsPayload = await parseMcpResponse(toolsResponse);

    if (sessionId) {
      void fetchWithTimeout(joinUrl(baseUrl, route), {
        method: "DELETE",
        headers: {
          "mcp-protocol-version": MCP_PROTOCOL_VERSION,
          "mcp-session-id": sessionId,
        },
      }).catch(() => undefined);
    }

    if (!toolsResponse.ok || toolsPayload.error) {
      return {
        ok: false,
        detail: `${route} tools/list returned HTTP ${toolsResponse.status}${
          toolsPayload.error?.message ? `: ${String(toolsPayload.error.message)}` : ""
        }.`,
      };
    }

    const tools =
      (toolsPayload.result as { tools?: Array<{ name?: unknown }> } | undefined)?.tools ?? [];
    const names = Array.isArray(tools)
      ? tools.map((tool) => tool.name).filter((name): name is string => typeof name === "string")
      : [];
    const expectedTools = ["list_pages", "get_navigation", "search_docs", "read_page"];
    const missingTools = expectedTools.filter((tool) => !names.includes(tool));

    if (missingTools.length > 0) {
      return {
        ok: false,
        detail: `${route} connected but is missing tools: ${missingTools.join(", ")}.`,
        tools: names,
      };
    }

    return {
      ok: true,
      detail: `MCP endpoint initialized ${sessionId ? "with a session" : "statelessly"} and exposed ${names.length} tool${names.length === 1 ? "" : "s"}.`,
      tools: names,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${route} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readDiscoveryRoute(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") ? value : undefined;
}

interface DiscoveryView {
  available: boolean;
  capabilities: Record<string, boolean | undefined>;
  framework?: string;
  rootDocsRoute: string;
  llmsFullRoutes: string[];
  sitemapEnabled: boolean;
  sitemapRoutes: string[];
  robotsEnabled: boolean;
  robotsRoute: string;
  mcpRoutes: string[];
  markdownRoute?: string;
  searchEndpoint?: string;
  feedbackSchemaRoute?: string;
}

function readDiscoveryFramework(body: unknown): string | undefined {
  const root = asRecord(body);
  if (!root) return undefined;
  const candidate =
    root.framework ?? asRecord(root.site)?.framework ?? asRecord(root.app)?.framework;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim().toLowerCase();
  }
  return undefined;
}

function readCapability(
  root: Record<string, unknown> | undefined,
  capabilities: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const capValue = readBool(capabilities?.[key]);
  if (typeof capValue === "boolean") return capValue;
  const block = asRecord(root?.[key]);
  return readBool(block?.enabled);
}

function buildDiscoveryView(body: unknown): DiscoveryView {
  const root = asRecord(body);
  if (!root) {
    return {
      available: false,
      capabilities: {},
      rootDocsRoute: "/docs",
      llmsFullRoutes: [DEFAULT_LLMS_FULL_TXT_ROUTE, DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE],
      sitemapEnabled: true,
      sitemapRoutes: [DEFAULT_SITEMAP_XML_ROUTE, DEFAULT_SITEMAP_MD_ROUTE],
      robotsEnabled: true,
      robotsRoute: DEFAULT_ROBOTS_TXT_ROUTE,
      mcpRoutes: [DEFAULT_MCP_PUBLIC_ROUTE, DEFAULT_MCP_WELL_KNOWN_ROUTE],
    };
  }

  const capabilities = asRecord(root.capabilities) ?? {};
  const cap: Record<string, boolean | undefined> = {
    llms: readCapability(root, capabilities, "llms"),
    sitemap: readCapability(root, capabilities, "sitemap"),
    robots: readCapability(root, capabilities, "robots"),
    skills: readCapability(root, capabilities, "skills"),
    markdownRoutes: readCapability(root, capabilities, "markdownRoutes"),
    mcp: readCapability(root, capabilities, "mcp"),
    search: readCapability(root, capabilities, "search"),
    agentFeedback: readCapability(root, capabilities, "agentFeedback"),
    structuredData: readBool(capabilities.structuredData),
    agentBlocks: readBool(capabilities.agentBlocks),
    agentMdOverrides: readBool(capabilities.agentMdOverrides),
  };

  const site = asRecord(root.site);
  const entry = typeof site?.entry === "string" && site.entry.trim() ? site.entry.trim() : "docs";
  const rootDocsRoute = `/${entry.replace(/^\/+|\/+$/g, "") || "docs"}`;

  const llmsRoot = asRecord(root.llms);
  const llmsFullRoutes = Array.from(
    new Set(
      [
        readDiscoveryRoute(llmsRoot?.publicFull) ?? DEFAULT_LLMS_FULL_TXT_ROUTE,
        readDiscoveryRoute(llmsRoot?.wellKnownFull) ?? DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE,
      ].filter((value): value is string => typeof value === "string"),
    ),
  );

  const sitemapRoot = asRecord(root.sitemap);
  const sitemapXml = asRecord(sitemapRoot?.xml);
  const sitemapMd = asRecord(sitemapRoot?.markdown);
  const sitemapEnabled = sitemapRoot?.enabled === false ? false : (cap.sitemap ?? true);
  const sitemapRoutes = sitemapEnabled
    ? Array.from(
        new Set(
          [
            sitemapXml?.enabled === false
              ? undefined
              : (readDiscoveryRoute(sitemapXml?.route) ?? DEFAULT_SITEMAP_XML_ROUTE),
            sitemapMd?.enabled === false
              ? undefined
              : (readDiscoveryRoute(sitemapMd?.route) ?? DEFAULT_SITEMAP_MD_ROUTE),
            sitemapMd?.enabled === false
              ? undefined
              : (readDiscoveryRoute(sitemapMd?.wellKnownRoute) ??
                DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE),
          ].filter((value): value is string => typeof value === "string"),
        ),
      )
    : [];

  const robotsRoot = asRecord(root.robots);
  const robotsEnabled = robotsRoot?.enabled === false ? false : (cap.robots ?? true);
  const robotsRoute = readDiscoveryRoute(robotsRoot?.route) ?? DEFAULT_ROBOTS_TXT_ROUTE;

  const mcpRoot = asRecord(root.mcp);
  const advertisedMcpEndpoints = (mcpRoot?.publicEndpoints ?? mcpRoot?.endpoints) as unknown;
  const declaredMcpRoutes = Array.isArray(advertisedMcpEndpoints)
    ? advertisedMcpEndpoints.filter(
        (value): value is string => typeof value === "string" && value.startsWith("/"),
      )
    : [];
  const mcpRoutes =
    declaredMcpRoutes.length > 0
      ? Array.from(new Set(declaredMcpRoutes))
      : [
          readDiscoveryRoute(mcpRoot?.publicEndpoint) ?? DEFAULT_MCP_PUBLIC_ROUTE,
          readDiscoveryRoute(mcpRoot?.wellKnownEndpoint) ?? DEFAULT_MCP_WELL_KNOWN_ROUTE,
        ];

  const markdownRoot = asRecord(root.markdown);
  const markdownRoute = readDiscoveryRoute(markdownRoot?.rootPage);
  const searchRoot = asRecord(root.search);
  const feedbackRoot = asRecord(root.feedback);

  return {
    available: true,
    capabilities: cap,
    framework: readDiscoveryFramework(body),
    rootDocsRoute,
    llmsFullRoutes,
    sitemapEnabled,
    sitemapRoutes,
    robotsEnabled,
    robotsRoute,
    mcpRoutes,
    markdownRoute,
    searchEndpoint: readDiscoveryRoute(searchRoot?.endpoint),
    feedbackSchemaRoute: readDiscoveryRoute(feedbackRoot?.schema),
  };
}

function makeCheck(
  id: AgentScoreCheckId,
  title: string,
  status: ScoreStatus,
  score: number,
  maxScore: number,
  detail: string,
  recommendation?: string,
): AgentScoreCheck {
  return { id, title, status, score, maxScore, detail, recommendation };
}

function gradeForAgentScore(score: number): AgentScoreGrade {
  if (score >= 90) return "Agent-optimized";
  if (score >= 75) return "Agent-ready";
  if (score >= 60) return "Promising";
  return "Needs work";
}

function scoreRecoveryRecommendations(score: number): string[] {
  if (score >= 90) return [];

  return [
    "Upgrade to the latest @farming-labs/docs packages with `npx @farming-labs/docs upgrade --latest`, then redeploy before rescoring.",
    "Use the agent-friendly docs guide, MCP guide, configuration reference, and `docs doctor --agent --url` output to close the failing checks.",
  ];
}

const AF_DOCS_CHECK_TITLES: Record<string, string> = {
  "llms-txt-exists": "llms.txt exists",
  "llms-txt-valid": "llms.txt structure",
  "llms-txt-size": "llms.txt size",
  "llms-txt-links-resolve": "llms.txt links resolve",
  "llms-txt-links-markdown": "llms.txt markdown links",
  "llms-txt-directive-html": "HTML llms.txt directive",
  "llms-txt-directive-md": "Markdown llms.txt directive",
  "markdown-url-support": ".md URL support",
  "content-negotiation": "Markdown negotiation",
  "rendering-strategy": "Server-rendered content",
  "page-size-markdown": "Markdown page size",
  "page-size-html": "HTML page size",
  "content-start-position": "Content start position",
  "tabbed-content-serialization": "Tabbed content size",
  "section-header-quality": "Section header quality",
  "markdown-code-fence-validity": "Code fence validity",
  "http-status-codes": "HTTP status codes",
  "redirect-behavior": "Redirect behavior",
  "llms-txt-coverage": "llms.txt coverage",
  "markdown-content-parity": "Markdown parity",
  "cache-header-hygiene": "Cache headers",
  "auth-gate-detection": "Public access",
  "auth-alternative-access": "Alternative access",
};

const AF_DOCS_CATEGORY_TITLES = new Map<string, string>(
  CATEGORIES.map((category) => [category.id, category.name]),
);

function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function afDocsStatusToScoreStatus(status: CheckResult["status"]): ScoreStatus {
  if (status === "pass") return "pass";
  if (status === "warn" || status === "skip") return "warn";
  return "fail";
}

function titleFromAfDocsCheck(id: string): string {
  return (
    AF_DOCS_CHECK_TITLES[id] ??
    id
      .split("-")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ")
  );
}

function buildAfDocsCategories(score: ScoreResult): AgentScoreCategory[] {
  return CATEGORIES.map((category) => {
    const categoryScore = score.categoryScores[category.id];
    return {
      id: category.id,
      title: category.name,
      score: categoryScore?.score ?? null,
      grade: categoryScore?.grade ?? null,
    };
  });
}

function buildAfDocsChecks(report: ReportResult, score: ScoreResult): AgentScoreCheck[] {
  const numericResults = report.results
    .map((result) => ({ result, score: score.checkScores[result.id] }))
    .filter(
      (
        item,
      ): item is { result: CheckResult; score: NonNullable<ScoreResult["checkScores"][string]> } =>
        Boolean(item.score) && item.score.scoreDisplayMode === "numeric" && item.score.maxScore > 0,
    );

  const rawEarned = numericResults.reduce((total, item) => total + item.score.earnedScore, 0);
  const rawMax = numericResults.reduce((total, item) => total + item.score.maxScore, 0);
  const earnedScale = rawEarned > 0 ? score.overall / rawEarned : 0;
  const maxScale = rawMax > 0 ? 100 / rawMax : 0;

  return numericResults.map(({ result, score: checkScore }) => {
    const category = AF_DOCS_CATEGORY_TITLES.get(result.category) ?? result.category;
    return makeCheck(
      `afdocs:${result.id}`,
      titleFromAfDocsCheck(result.id),
      afDocsStatusToScoreStatus(result.status),
      roundScore(checkScore.earnedScore * earnedScale),
      roundScore(checkScore.maxScore * maxScale),
      `${category}: ${result.message}`,
      score.resolutions[result.id],
    );
  });
}

function buildAfDocsSummary(report: ReportResult, score: ScoreResult): AgentScoreStandardSummary {
  return {
    score: score.overall,
    grade: score.grade,
    pass: report.summary.pass,
    warn: report.summary.warn,
    fail: report.summary.fail + report.summary.error,
    skip: report.summary.skip,
    testedPages: report.testedPages,
    samplingStrategy: report.samplingStrategy,
    categories: buildAfDocsCategories(score),
    diagnostics: score.diagnostics.map((diagnostic) => ({
      id: diagnostic.id,
      severity: diagnostic.severity,
      message: diagnostic.message,
      resolution: diagnostic.resolution,
    })),
  };
}

function fillSearchEndpoint(route: string, query: string): string {
  const encoded = encodeURIComponent(query);
  if (route.includes("{query}")) return route.replaceAll("{query}", encoded);
  return `${route}${route.includes("?") ? "&" : "?"}query=${encoded}`;
}

async function probeFrameworkDiscovery(
  baseUrl: string,
): Promise<{ baseUrl: string; discovery: JsonProbe } | undefined> {
  const discovery = await probeJsonRoute(baseUrl, DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE);
  if (discovery.ok) return { baseUrl, discovery };

  const origin = originBaseUrl(baseUrl);
  if (origin !== baseUrl) {
    const originDiscovery = await probeJsonRoute(origin, DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE);
    if (originDiscovery.ok) return { baseUrl: origin, discovery: originDiscovery };
  }

  return undefined;
}

function scoreRouteProbes(
  probes: TextProbe[],
  maxScore: number,
): { status: ScoreStatus; score: number; passed: number } {
  const passed = probes.filter((probe) => probe.ok).length;
  if (passed === probes.length) return { status: "pass", score: maxScore, passed };
  if (passed > 0) return { status: "warn", score: Math.round(maxScore / 2), passed };
  return { status: "fail", score: 0, passed };
}

async function buildFrameworkChecks(
  baseUrl: string,
): Promise<{ framework?: string; checks: AgentScoreCheck[] }> {
  const frameworkDiscovery = await probeFrameworkDiscovery(baseUrl);
  if (!frameworkDiscovery) return { checks: [] };

  const frameworkBaseUrl = frameworkDiscovery.baseUrl;
  const view = buildDiscoveryView(frameworkDiscovery.discovery.body);
  const checks: AgentScoreCheck[] = [
    makeCheck(
      "framework:agent-discovery",
      "Framework discovery",
      "pass",
      5,
      5,
      "The site exposes the @farming-labs/docs agent discovery spec.",
    ),
  ];

  const [
    fullContextProbes,
    sitemapProbes,
    robotsProbe,
    skillProbes,
    mcpProbes,
    searchProbe,
    feedbackSchemaProbe,
    structuredDataProbe,
  ] = await Promise.all([
    Promise.all(view.llmsFullRoutes.map((route) => probeTextRoute(frameworkBaseUrl, route))),
    view.sitemapEnabled
      ? Promise.all(view.sitemapRoutes.map((route) => probeTextRoute(frameworkBaseUrl, route)))
      : Promise.resolve([]),
    view.robotsEnabled
      ? probeTextRoute(frameworkBaseUrl, view.robotsRoute, "text/plain, */*")
      : Promise.resolve(undefined),
    Promise.all(
      [DEFAULT_SKILL_MD_ROUTE, DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE].map((route) =>
        probeTextRoute(frameworkBaseUrl, route),
      ),
    ),
    view.capabilities.mcp === false
      ? Promise.resolve([])
      : Promise.all(view.mcpRoutes.map((route) => probeMcpRoute(frameworkBaseUrl, route))),
    view.capabilities.search === false || !view.searchEndpoint
      ? Promise.resolve(undefined)
      : probeJsonRoute(frameworkBaseUrl, fillSearchEndpoint(view.searchEndpoint, "installation")),
    view.capabilities.agentFeedback === false || !view.feedbackSchemaRoute
      ? Promise.resolve(undefined)
      : probeJsonRoute(frameworkBaseUrl, view.feedbackSchemaRoute),
    view.capabilities.structuredData === false
      ? Promise.resolve(undefined)
      : probeTextRoute(frameworkBaseUrl, view.rootDocsRoute, "text/html, */*"),
  ]);

  if (view.capabilities.llms === false) {
    checks.push(
      makeCheck(
        "framework:full-context",
        "Full context index",
        "warn",
        0,
        4,
        "Discovery spec reports llms.txt as disabled.",
        "Enable llmsTxt so the framework can serve both /llms.txt and /llms-full.txt.",
      ),
    );
  } else {
    const fullScore = scoreRouteProbes(fullContextProbes, 4);
    checks.push(
      makeCheck(
        "framework:full-context",
        "Full context index",
        fullScore.status,
        fullScore.score,
        4,
        fullContextProbes.map((probe) => probe.detail).join(" "),
        fullScore.status === "pass"
          ? undefined
          : `Verify full-context routes respond: ${view.llmsFullRoutes.join(", ")}.`,
      ),
    );
  }

  if (!view.sitemapEnabled) {
    checks.push(
      makeCheck(
        "framework:sitemap",
        "Semantic sitemap",
        "warn",
        0,
        4,
        "Discovery spec reports sitemap routes as disabled.",
        "Enable sitemap generation so agents can discover sitemap.xml and sitemap.md.",
      ),
    );
  } else {
    const sitemapScore = scoreRouteProbes(sitemapProbes, 4);
    checks.push(
      makeCheck(
        "framework:sitemap",
        "Semantic sitemap",
        sitemapScore.status,
        sitemapScore.score,
        4,
        sitemapProbes.map((probe) => probe.detail).join(" "),
        sitemapScore.status === "pass"
          ? undefined
          : `Verify deployed sitemap routes return content: ${view.sitemapRoutes.join(", ")}.`,
      ),
    );
  }

  if (!view.robotsEnabled || !robotsProbe) {
    checks.push(
      makeCheck(
        "framework:robots",
        "Robots agent policy",
        "warn",
        0,
        4,
        "Discovery spec reports robots.txt as disabled or did not expose a route.",
        "Publish an agent-friendly robots.txt with `docs robots generate`.",
      ),
    );
  } else {
    const analysis = robotsProbe.body ? analyzeDocsRobotsTxt(robotsProbe.body) : undefined;
    const blocks = analysis?.blocksAgentRoutes || analysis?.blocksAiAgents;
    const complete = analysis?.hasAgentRoutes && analysis?.hasAiPolicy;
    const passing = robotsProbe.ok && !blocks && complete;
    checks.push(
      makeCheck(
        "framework:robots",
        "Robots agent policy",
        passing ? "pass" : robotsProbe.ok && !blocks ? "warn" : "fail",
        passing ? 4 : robotsProbe.ok && !blocks ? 2 : 0,
        4,
        robotsProbe.ok
          ? blocks
            ? `${view.robotsRoute} is reachable but blocks ${
                analysis?.blocksAiAgents ? "common AI crawlers" : "agent-readable docs routes"
              }.`
            : complete
              ? `${robotsProbe.detail} It advertises agent-readable routes and common AI crawler policy.`
              : `${robotsProbe.detail} It is missing ${
                  analysis?.missingRoutes?.length
                    ? `agent routes (${analysis.missingRoutes.join(", ")})`
                    : "common AI crawler policy"
                }.`
          : robotsProbe.detail,
        passing
          ? undefined
          : "Publish an agent-friendly robots.txt with `docs robots generate --append`.",
      ),
    );
  }

  if (view.capabilities.skills === false) {
    checks.push(
      makeCheck(
        "framework:skill",
        "Skill document",
        "warn",
        0,
        4,
        "Discovery spec reports skills as disabled.",
        "Enable skill.md routes so coding agents can bootstrap from one markdown file.",
      ),
    );
  } else {
    const skillScore = scoreRouteProbes(skillProbes, 4);
    checks.push(
      makeCheck(
        "framework:skill",
        "Skill document",
        skillScore.status,
        skillScore.score,
        4,
        skillProbes.map((probe) => probe.detail).join(" "),
        skillScore.status === "pass"
          ? undefined
          : `Verify ${DEFAULT_SKILL_MD_ROUTE} and ${DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE} return skill markdown.`,
      ),
    );
  }

  if (view.capabilities.mcp === false) {
    checks.push(
      makeCheck(
        "framework:mcp",
        "MCP handshake",
        "warn",
        0,
        6,
        "Discovery spec reports MCP as disabled.",
        "Enable mcp so agents can list, search, and read docs through tools instead of scraping.",
      ),
    );
  } else if (mcpProbes.length === 0) {
    checks.push(
      makeCheck(
        "framework:mcp",
        "MCP handshake",
        "warn",
        0,
        6,
        "Discovery spec did not advertise MCP routes.",
        `Expose ${DEFAULT_MCP_PUBLIC_ROUTE} and ${DEFAULT_MCP_WELL_KNOWN_ROUTE}.`,
      ),
    );
  } else {
    const passed = mcpProbes.filter((probe) => probe.ok).length;
    checks.push(
      makeCheck(
        "framework:mcp",
        "MCP handshake",
        passed === mcpProbes.length ? "pass" : passed > 0 ? "warn" : "fail",
        passed === mcpProbes.length ? 6 : passed > 0 ? 3 : 0,
        6,
        mcpProbes.map((probe) => probe.detail).join(" "),
        passed === mcpProbes.length
          ? undefined
          : `Verify ${view.mcpRoutes.join(" and ")} support MCP initialize and tools/list.`,
      ),
    );
  }

  checks.push(
    makeCheck(
      "framework:search",
      "Search endpoint",
      searchProbe?.ok ? "pass" : view.capabilities.search === false ? "warn" : "fail",
      searchProbe?.ok ? 2 : 0,
      2,
      searchProbe?.ok
        ? "Search endpoint returned valid JSON for a sample docs query."
        : view.capabilities.search === false
          ? "Discovery spec reports search as disabled."
          : "Search endpoint did not return valid JSON for a sample docs query.",
      searchProbe?.ok
        ? undefined
        : "Expose the search endpoint through agent discovery so agents can narrow retrieval.",
    ),
  );

  checks.push(
    makeCheck(
      "framework:feedback",
      "Feedback endpoint",
      feedbackSchemaProbe?.ok
        ? "pass"
        : view.capabilities.agentFeedback === false
          ? "warn"
          : "fail",
      feedbackSchemaProbe?.ok ? 2 : 0,
      2,
      feedbackSchemaProbe?.ok
        ? "Feedback endpoint returned a valid JSON schema for agent reports."
        : view.capabilities.agentFeedback === false
          ? "Discovery spec reports agent feedback as disabled."
          : "Feedback endpoint did not return a readable schema JSON.",
      feedbackSchemaProbe?.ok
        ? undefined
        : "Expose the feedback endpoint through agent discovery so agents can report page-level issues.",
    ),
  );

  const structuredBody = structuredDataProbe?.body ?? "";
  const hasStructuredData = /type=["']application\/ld\+json["']/i.test(structuredBody);
  checks.push(
    makeCheck(
      "framework:structured-data",
      "Structured data",
      hasStructuredData ? "pass" : view.capabilities.structuredData === false ? "warn" : "fail",
      hasStructuredData ? 3 : 0,
      3,
      hasStructuredData
        ? `${view.rootDocsRoute} includes application/ld+json structured data.`
        : view.capabilities.structuredData === false
          ? "Discovery spec reports structured data as disabled."
          : `${view.rootDocsRoute} did not include application/ld+json structured data in the HTML response.`,
      hasStructuredData
        ? undefined
        : "Keep JSON-LD enabled so agents can read canonical title, description, URL, and breadcrumbs.",
    ),
  );

  return { framework: view.framework, checks };
}

/**
 * Probe a public docs site and return a readiness report.
 *
 * Throws only when the input URL is malformed, so the API route can
 * return a clean 400. Per-check failures surface as `fail` entries.
 */
export async function inspectHostedAgentReadiness(rawUrl: string): Promise<AgentScoreReport> {
  const baseUrl = normalizeAgentScoreBaseUrl(rawUrl);
  const afdocsReport = await runChecks(baseUrl, {
    samplingStrategy: "deterministic",
    maxLinksToTest: AF_DOCS_MAX_LINKS_TO_TEST,
    maxConcurrency: AF_DOCS_MAX_CONCURRENCY,
    requestDelay: AF_DOCS_REQUEST_DELAY_MS,
    requestTimeout: PROBE_TIMEOUT_MS,
  });
  const afdocsScore = computeScore(afdocsReport);
  const framework = await buildFrameworkChecks(baseUrl);

  const checks = [...buildAfDocsChecks(afdocsReport, afdocsScore), ...framework.checks];
  const frameworkRawScore = framework.checks.reduce((total, check) => total + check.score, 0);
  const frameworkRawMaxScore = framework.checks.reduce((total, check) => total + check.maxScore, 0);
  const rawScore = roundScore(afdocsScore.overall + frameworkRawScore);
  const rawMaxScore = roundScore(100 + frameworkRawMaxScore);
  const score = rawMaxScore <= 0 ? 0 : Math.round((rawScore / rawMaxScore) * 100);
  const name = deriveAgentScoreSiteName(baseUrl);
  const recommendations = Array.from(
    new Set(
      [
        ...afdocsScore.diagnostics.map((diagnostic) => diagnostic.resolution),
        ...checks
          .map((check) => check.recommendation)
          .filter((value): value is string => Boolean(value)),
        ...scoreRecoveryRecommendations(score),
      ].filter(Boolean),
    ),
  ).slice(0, 6);

  return {
    url: baseUrl,
    baseUrl,
    name,
    framework: framework.framework,
    rawScore,
    rawMaxScore,
    score,
    maxScore: 100,
    grade: gradeForAgentScore(score),
    standard: buildAfDocsSummary(afdocsReport, afdocsScore),
    checks,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Hosted agent-readiness scoring for the public website.
 *
 * Mirrors the `docs doctor --agent --url <url>` flow from
 * `@farming-labs/docs` as closely as a pure URL probe can. The CLI
 * inspects the local config to infer framework wiring; the website
 * cannot see local files, so we use the hosted `/.well-known/agent.json`
 * discovery spec — specifically its `capabilities` map — to credit the
 * same checks the CLI runs locally. The result: a fully-configured docs
 * site that reports 100% from the CLI also reports 100% on the website.
 *
 * Each check has a max-score weight chosen so that an all-pass run
 * totals 100 with no normalization rounding.
 */
import {
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_TXT_ROUTE,
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

export type ScoreStatus = "pass" | "warn" | "fail";

export type AgentScoreGrade = "Agent-optimized" | "Agent-ready" | "Promising" | "Needs work";

export type AgentScoreCheckId =
  | "agent-discovery"
  | "framework-wiring"
  | "llms"
  | "sitemap"
  | "robots"
  | "skill"
  | "markdown"
  | "mcp"
  | "search"
  | "feedback";

export interface AgentScoreCheck {
  id: AgentScoreCheckId;
  title: string;
  detail: string;
  status: ScoreStatus;
  score: number;
  maxScore: number;
  recommendation?: string;
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

async function probeMcpRoute(baseUrl: string, route: string): Promise<McpProbe> {
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

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    if (!sessionId) {
      return { ok: false, detail: `${route} initialize did not return mcp-session-id.` };
    }

    // The reference docs server doesn't actually require
    // `notifications/initialized` before `tools/list`, and some hosted
    // deploys swallow the notification with a delay that races our next
    // request. Skipping the notification keeps the probe fast and reliable.
    const toolsResponse = await postMcpJson(
      baseUrl,
      route,
      { jsonrpc: "2.0", id: "agent-score-tools", method: "tools/list", params: {} },
      sessionId,
    );
    const toolsPayload = await parseMcpResponse(toolsResponse);

    fetchWithTimeout(joinUrl(baseUrl, route), {
      method: "DELETE",
      headers: {
        "mcp-protocol-version": MCP_PROTOCOL_VERSION,
        "mcp-session-id": sessionId,
      },
    }).catch(() => undefined);

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

    return {
      ok: true,
      detail: `${route} exposed ${names.length} MCP tool${names.length === 1 ? "" : "s"}.`,
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
  sitemapEnabled: boolean;
  sitemapRoutes: string[];
  robotsEnabled: boolean;
  robotsRoute: string;
  mcpRoutes: string[];
  markdownRoute?: string;
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

  return {
    available: true,
    capabilities: cap,
    framework: readDiscoveryFramework(body),
    sitemapEnabled,
    sitemapRoutes,
    robotsEnabled,
    robotsRoute,
    mcpRoutes,
    markdownRoute,
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

/**
 * Probe a public docs site and return a readiness report.
 *
 * Throws only when the input URL is malformed, so the API route can
 * return a clean 400. Per-check failures surface as `fail` entries.
 */
export async function inspectHostedAgentReadiness(rawUrl: string): Promise<AgentScoreReport> {
  const baseUrl = normalizeAgentScoreBaseUrl(rawUrl);
  const checks: AgentScoreCheck[] = [];

  const discovery = await probeJsonRoute(baseUrl, DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE);
  const view = buildDiscoveryView(discovery.body);

  // 1. Agent discovery spec (10).
  checks.push(
    makeCheck(
      "agent-discovery",
      "Agent discovery spec",
      discovery.ok ? "pass" : "fail",
      discovery.ok ? 10 : 0,
      10,
      discovery.ok
        ? `${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE} returned a valid agent discovery spec.`
        : `${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}: ${discovery.detail}`,
      discovery.ok
        ? undefined
        : `Wire the docs API so ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE} and ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE} return the shared agent discovery spec.`,
    ),
  );

  // Run the rest of the probes in parallel so the total wall-clock
  // stays under the API route's maxDuration budget.
  const [llmsTxt, llmsFull] = await Promise.all([
    probeTextRoute(baseUrl, DEFAULT_LLMS_TXT_ROUTE),
    probeTextRoute(baseUrl, DEFAULT_LLMS_FULL_TXT_ROUTE),
  ]);

  const sitemapProbes = view.sitemapRoutes.length
    ? await Promise.all(view.sitemapRoutes.map((route) => probeTextRoute(baseUrl, route)))
    : [];

  const robotsProbe = view.robotsEnabled
    ? await probeTextRoute(baseUrl, view.robotsRoute, "text/plain, */*")
    : undefined;

  const [skill, wellKnownSkill] = await Promise.all([
    probeTextRoute(baseUrl, DEFAULT_SKILL_MD_ROUTE),
    probeTextRoute(baseUrl, DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE),
  ]);

  const markdownRoute = view.markdownRoute ?? "/docs.md";
  const markdownProbe = await probeTextRoute(baseUrl, markdownRoute);

  const mcpProbes = view.mcpRoutes.length
    ? await Promise.all(view.mcpRoutes.map((route) => probeMcpRoute(baseUrl, route)))
    : [];

  // 2. Framework wiring (20) — config + content + api-route + public-routes
  //    from the CLI rolled into one. We can only see hosted state, so this
  //    passes when discovery is reachable AND the public docs forwarder is
  //    serving at least one machine-readable surface.
  const publicSurfaceHits = [llmsTxt.ok, llmsFull.ok, skill.ok, wellKnownSkill.ok].filter(
    Boolean,
  ).length;
  if (!discovery.ok) {
    checks.push(
      makeCheck(
        "framework-wiring",
        "Docs framework wiring",
        "fail",
        0,
        20,
        "Discovery spec is missing, so we cannot verify the docs API or public route forwarder.",
        "Mount the docs API and public docs forwarder for your framework so /.well-known/agent.json, /api/docs, and the public agent routes resolve.",
      ),
    );
  } else {
    const wiringScore = publicSurfaceHits >= 2 ? 20 : publicSurfaceHits === 1 ? 14 : 10;
    const wiringStatus: ScoreStatus =
      publicSurfaceHits >= 2 ? "pass" : publicSurfaceHits === 1 ? "warn" : "warn";
    checks.push(
      makeCheck(
        "framework-wiring",
        "Docs framework wiring",
        wiringStatus,
        wiringScore,
        20,
        publicSurfaceHits >= 2
          ? "Discovery is reachable and the public docs forwarder is serving the standard agent surfaces."
          : publicSurfaceHits === 1
            ? "Discovery is reachable but only one public agent surface is responding; the public forwarder might be partly mounted."
            : "Discovery is reachable but none of the public agent routes responded. The docs API might be live without the public forwarder.",
        publicSurfaceHits >= 2
          ? undefined
          : "Mount the public docs forwarder so /llms.txt, /skill.md, /sitemap.xml, /mcp, and .md routes all resolve from the shared docs API.",
      ),
    );
  }

  // 3. llms.txt (10).
  const llmsEnabled = view.capabilities.llms;
  const llmsBothOk = llmsTxt.ok && llmsFull.ok;
  if (llmsEnabled === false) {
    checks.push(
      makeCheck(
        "llms",
        "llms.txt discovery",
        "warn",
        0,
        10,
        "Discovery spec reports llms.txt as disabled.",
        "Enable llmsTxt in docs.config so agents and GEO crawlers can discover the docs index and full context surfaces.",
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "llms",
        "llms.txt discovery",
        llmsBothOk ? "pass" : llmsTxt.ok || llmsFull.ok ? "warn" : "fail",
        llmsBothOk ? 10 : llmsTxt.ok || llmsFull.ok ? 6 : 0,
        10,
        `${DEFAULT_LLMS_TXT_ROUTE}: ${llmsTxt.detail} ${DEFAULT_LLMS_FULL_TXT_ROUTE}: ${llmsFull.detail}`,
        llmsBothOk
          ? undefined
          : `Serve non-empty ${DEFAULT_LLMS_TXT_ROUTE} and ${DEFAULT_LLMS_FULL_TXT_ROUTE} so agents can discover the docs index and full context surface.`,
      ),
    );
  }

  // 4. Sitemap (10).
  if (!view.sitemapEnabled) {
    checks.push(
      makeCheck(
        "sitemap",
        "Sitemap discovery",
        "warn",
        0,
        10,
        "Discovery spec reports sitemap routes as disabled.",
        "Enable sitemap in docs.config so agents and crawlers can discover canonical URLs and freshness metadata.",
      ),
    );
  } else if (sitemapProbes.length === 0) {
    const fallback = await probeTextRoute(baseUrl, DEFAULT_SITEMAP_XML_ROUTE);
    checks.push(
      makeCheck(
        "sitemap",
        "Sitemap discovery",
        fallback.ok ? "warn" : "fail",
        fallback.ok ? 6 : 0,
        10,
        fallback.detail,
        fallback.ok
          ? "Enable sitemap.markdown so agents can discover canonical URLs in markdown form too."
          : "Serve a sitemap at /sitemap.xml and /sitemap.md so crawlers and agents can discover canonical URLs.",
      ),
    );
  } else {
    const ok = sitemapProbes.filter((probe) => probe.ok).length;
    checks.push(
      makeCheck(
        "sitemap",
        "Sitemap discovery",
        ok === sitemapProbes.length ? "pass" : ok > 0 ? "warn" : "fail",
        ok === sitemapProbes.length ? 10 : ok > 0 ? 6 : 0,
        10,
        sitemapProbes.map((probe) => probe.detail).join(" "),
        ok === sitemapProbes.length
          ? undefined
          : `Verify deployed sitemap routes return non-empty text: ${view.sitemapRoutes.join(", ")}.`,
      ),
    );
  }

  // 5. Robots (10).
  if (!view.robotsEnabled) {
    checks.push(
      makeCheck(
        "robots",
        "Robots agent policy",
        "warn",
        0,
        10,
        "Discovery spec reports robots.txt as disabled.",
        "Enable robots and publish an agent-friendly robots.txt with `docs robots generate`.",
      ),
    );
  } else if (!robotsProbe) {
    checks.push(
      makeCheck(
        "robots",
        "Robots agent policy",
        "warn",
        0,
        10,
        "Could not probe robots.txt.",
        "Run `docs robots generate` to publish an agent-friendly crawl policy.",
      ),
    );
  } else {
    const analysis = robotsProbe.body ? analyzeDocsRobotsTxt(robotsProbe.body) : undefined;
    const blocks = analysis?.blocksAgentRoutes || analysis?.blocksAiAgents;
    const complete = analysis?.hasAgentRoutes && analysis?.hasAiPolicy;
    const ok = robotsProbe.ok;
    const passing = ok && !blocks && complete;
    checks.push(
      makeCheck(
        "robots",
        "Robots agent policy",
        passing ? "pass" : ok && !blocks ? "warn" : "fail",
        passing ? 10 : ok && !blocks ? 6 : 0,
        10,
        ok
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
          : "Publish an agent-friendly robots.txt with `docs robots generate`, or append the generated block to the existing file.",
      ),
    );
  }

  // 6. Skill (10).
  const skillBoth = skill.ok && wellKnownSkill.ok;
  if (view.capabilities.skills === false) {
    checks.push(
      makeCheck(
        "skill",
        "Skill document",
        "warn",
        0,
        10,
        "Discovery spec reports skills as disabled.",
        "Enable skills so coding agents can bootstrap from a single skill.md file.",
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "skill",
        "Skill document",
        skillBoth ? "pass" : skill.ok || wellKnownSkill.ok ? "warn" : "fail",
        skillBoth ? 10 : skill.ok || wellKnownSkill.ok ? 6 : 0,
        10,
        `${DEFAULT_SKILL_MD_ROUTE}: ${skill.detail} ${DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE}: ${wellKnownSkill.detail}`,
        skillBoth
          ? undefined
          : `Serve ${DEFAULT_SKILL_MD_ROUTE} and ${DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE} so coding agents can bootstrap from a single skill file.`,
      ),
    );
  }

  // 7. Markdown route (10).
  if (view.capabilities.markdownRoutes === false) {
    checks.push(
      makeCheck(
        "markdown",
        "Markdown route",
        "warn",
        0,
        10,
        "Discovery spec reports markdown routes as disabled.",
        "Enable markdown route forwarding so every docs page also responds to its .md sibling.",
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "markdown",
        "Markdown route",
        markdownProbe.ok ? "pass" : "fail",
        markdownProbe.ok ? 10 : 0,
        10,
        `${markdownRoute}: ${markdownProbe.detail}`,
        markdownProbe.ok
          ? undefined
          : `Mount the public docs forwarder so ${markdownRoute} responds for agents that prefer markdown over HTML.`,
      ),
    );
  }

  // 8. MCP (10).
  if (view.capabilities.mcp === false) {
    checks.push(
      makeCheck(
        "mcp",
        "MCP handshake",
        "warn",
        0,
        10,
        "Discovery spec reports MCP as disabled.",
        "Enable mcp in docs.config so agents can use list/search/read tools directly instead of scraping markdown.",
      ),
    );
  } else if (mcpProbes.length === 0) {
    checks.push(
      makeCheck(
        "mcp",
        "MCP handshake",
        "warn",
        0,
        10,
        "Discovery did not advertise MCP routes.",
        `Mount ${DEFAULT_MCP_PUBLIC_ROUTE} and ${DEFAULT_MCP_WELL_KNOWN_ROUTE} so agents can use MCP tools directly.`,
      ),
    );
  } else {
    const passing = mcpProbes.filter((probe) => probe.ok).length;
    checks.push(
      makeCheck(
        "mcp",
        "MCP handshake",
        passing === mcpProbes.length ? "pass" : passing > 0 ? "warn" : "fail",
        passing === mcpProbes.length ? 10 : passing > 0 ? 6 : 0,
        10,
        mcpProbes.map((probe) => probe.detail).join(" "),
        passing === mcpProbes.length
          ? undefined
          : `Mount ${view.mcpRoutes.join(" and ")} so agents can use MCP tools directly instead of scraping HTML.`,
      ),
    );
  }

  // 9. Search (5).
  if (!view.available) {
    checks.push(
      makeCheck(
        "search",
        "Search surface",
        "fail",
        0,
        5,
        "No discovery spec, so we cannot verify a search endpoint.",
        "Enable search and advertise it in the agent discovery spec so agents can narrow retrieval before reading whole markdown pages.",
      ),
    );
  } else if (view.capabilities.search === false) {
    checks.push(
      makeCheck(
        "search",
        "Search surface",
        "warn",
        0,
        5,
        "Discovery spec reports search as disabled.",
        "Enable search so agents can narrow retrieval before reading whole markdown pages.",
      ),
    );
  } else if (view.capabilities.search === true) {
    checks.push(
      makeCheck(
        "search",
        "Search surface",
        "pass",
        5,
        5,
        "Discovery spec advertises a search endpoint.",
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "search",
        "Search surface",
        "warn",
        2,
        5,
        "Could not determine search status from discovery spec.",
        "Surface search in the discovery spec so agents can find it programmatically.",
      ),
    );
  }

  // 10. Agent feedback (5).
  if (!view.available) {
    checks.push(
      makeCheck(
        "feedback",
        "Agent feedback",
        "fail",
        0,
        5,
        "No discovery spec, so we cannot verify an agent feedback endpoint.",
        "Enable feedback.agent and advertise it in the discovery spec so agents can post structured feedback through the shared docs API.",
      ),
    );
  } else if (view.capabilities.agentFeedback === false) {
    checks.push(
      makeCheck(
        "feedback",
        "Agent feedback",
        "warn",
        0,
        5,
        "Discovery spec reports agent feedback as disabled.",
        "Enable feedback.agent so agents can discover and post structured feedback through the shared docs API.",
      ),
    );
  } else if (view.capabilities.agentFeedback === true) {
    checks.push(
      makeCheck(
        "feedback",
        "Agent feedback",
        "pass",
        5,
        5,
        "Discovery spec advertises a structured agent feedback endpoint.",
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "feedback",
        "Agent feedback",
        "warn",
        2,
        5,
        "Could not determine agent feedback status from discovery spec.",
        "Surface feedback.agent in the discovery spec so agents can find the submission schema programmatically.",
      ),
    );
  }

  const rawScore = checks.reduce((total, check) => total + check.score, 0);
  const rawMaxScore = checks.reduce((total, check) => total + check.maxScore, 0);
  const score = rawMaxScore <= 0 ? 0 : Math.round((rawScore / rawMaxScore) * 100);
  const name = deriveAgentScoreSiteName(baseUrl);

  return {
    url: baseUrl,
    baseUrl,
    name,
    framework: view.framework,
    rawScore,
    rawMaxScore,
    score,
    maxScore: 100,
    grade: gradeForAgentScore(score),
    checks,
    recommendations: checks
      .map((check) => check.recommendation)
      .filter((value): value is string => Boolean(value))
      .slice(0, 4),
    generatedAt: new Date().toISOString(),
  };
}

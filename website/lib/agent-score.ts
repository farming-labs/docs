/**
 * Hosted agent-readiness scoring for the public website.
 *
 * The public score starts with AFDocs' Agent-Friendly Documentation
 * Spec scorecard, then adds opt-in framework checks when a site exposes
 * the @farming-labs/docs agent discovery spec. This keeps generic docs
 * sites scored by the public standard while dogfooding the extra agent
 * surfaces that `docs doctor --agent --url` verifies for our framework.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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
  buildDocsMcpEndpointCandidates,
} from "@farming-labs/docs";

// Kept in sync with @modelcontextprotocol/sdk; the deployed MCP server
// negotiates any version it advertises so bumps are safe.
const MCP_PROTOCOL_VERSION = "2025-11-25";
const PROBE_TIMEOUT_MS = 9000;
const AF_DOCS_MAX_LINKS_TO_TEST = 10;
const AF_DOCS_REQUEST_DELAY_MS = 50;
const AF_DOCS_MAX_CONCURRENCY = 6;
const ADJACENT_MARKDOWN_MAX_SCORE = 3;
const MAX_SAFE_REDIRECTS = 5;
const FARMING_LABS_DOCS_UPGRADE_RECOMMENDATION =
  "Because this site uses @farming-labs/docs, upgrade to the latest version with `npx @farming-labs/docs upgrade --latest`, redeploy, then rescore before working through the remaining checks.";

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
  const trimmed = value.trim();
  if (!trimmed) throw new Error("URL is required.");

  const url = new URL(/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

function parseIpv4(address: string): [number, number, number, number] | undefined {
  const parts = address.split(".");
  if (parts.length !== 4) return undefined;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
  return octets as [number, number, number, number];
}

function isBlockedIpv4Address(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function ipv6ToHextets(address: string): number[] | undefined {
  const withoutZone = address.split("%", 1)[0]?.toLowerCase();
  if (!withoutZone) return undefined;
  const ipv4Match = withoutZone.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  let normalized = withoutZone;

  if (ipv4Match) {
    const octets = parseIpv4(ipv4Match[2] ?? "");
    if (!octets) return undefined;
    normalized = `${ipv4Match[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${(
      (octets[2] << 8) |
      octets[3]
    ).toString(16)}`;
  }

  const pieces = normalized.split("::");
  if (pieces.length > 2) return undefined;

  const head = pieces[0] ? pieces[0].split(":").filter(Boolean) : [];
  const tail = pieces.length === 2 && pieces[1] ? pieces[1].split(":").filter(Boolean) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (pieces.length === 1 && missing !== 0)) return undefined;

  const hextets = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];
  if (hextets.length !== 8) return undefined;

  const parsed = hextets.map((hextet) =>
    /^[\da-f]{1,4}$/i.test(hextet) ? Number.parseInt(hextet, 16) : -1,
  );
  return parsed.every((value) => value >= 0 && value <= 0xffff) ? parsed : undefined;
}

function ipv6InCidr(value: number[], base: string, bits: number): boolean {
  const baseValue = ipv6ToHextets(base);
  if (!baseValue) return false;

  let remaining = bits;
  for (let index = 0; index < 8; index++) {
    if (remaining <= 0) return true;
    if (remaining >= 16) {
      if (value[index] !== baseValue[index]) return false;
      remaining -= 16;
      continue;
    }

    const mask = (0xffff << (16 - remaining)) & 0xffff;
    return (value[index]! & mask) === (baseValue[index]! & mask);
  }

  return true;
}

function isBlockedIpv6Address(address: string): boolean {
  const mappedIpv4 = address.toLowerCase().match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4) return isBlockedIpv4Address(mappedIpv4[1] ?? "");

  const value = ipv6ToHextets(address);
  if (!value) return true;

  return (
    ipv6InCidr(value, "::", 128) ||
    ipv6InCidr(value, "::1", 128) ||
    ipv6InCidr(value, "fc00::", 7) ||
    ipv6InCidr(value, "fe80::", 10) ||
    ipv6InCidr(value, "2001:db8::", 32) ||
    ipv6InCidr(value, "ff00::", 8)
  );
}

function isBlockedHostName(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    !hostname.includes(".")
  );
}

async function assertPublicAgentScoreHostname(hostname: string): Promise<void> {
  const normalizedHost = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!normalizedHost) throw new Error("URL must include a hostname.");

  const ipVersion = isIP(normalizedHost);
  if (ipVersion === 4) {
    if (isBlockedIpv4Address(normalizedHost)) {
      throw new Error("Only public internet URLs can be scored.");
    }
    return;
  }
  if (ipVersion === 6) {
    if (isBlockedIpv6Address(normalizedHost)) {
      throw new Error("Only public internet URLs can be scored.");
    }
    return;
  }

  if (isBlockedHostName(normalizedHost)) {
    throw new Error("Only public internet URLs can be scored.");
  }

  let records;
  try {
    records = await lookup(normalizedHost, { all: true, verbatim: true });
  } catch {
    throw new Error("URL hostname could not be resolved.");
  }

  if (records.length === 0) throw new Error("URL hostname could not be resolved.");

  for (const record of records) {
    if (
      (record.family === 4 && isBlockedIpv4Address(record.address)) ||
      (record.family === 6 && isBlockedIpv6Address(record.address))
    ) {
      throw new Error("Only public internet URLs can be scored.");
    }
  }
}

async function assertPublicAgentScoreUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL must be a valid http(s) URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL credentials are not allowed.");
  }

  await assertPublicAgentScoreHostname(parsed.hostname);
}

function fetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function fetchPublicAgentScoreUrl(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  let currentUrl = fetchInputUrl(input);
  let currentInit = init;
  const request = input instanceof Request ? input : undefined;
  const redirectMode = currentInit.redirect ?? request?.redirect ?? "follow";

  await assertPublicAgentScoreUrl(currentUrl);

  if (redirectMode === "manual") {
    return fetcher(input, currentInit);
  }
  if (redirectMode === "error") {
    return fetcher(input, { ...currentInit, redirect: "error" });
  }

  for (let redirectCount = 0; redirectCount <= MAX_SAFE_REDIRECTS; redirectCount++) {
    await assertPublicAgentScoreUrl(currentUrl);
    const response = await fetcher(currentUrl, { ...currentInit, redirect: "manual" });
    const location = response.headers.get("location");

    if (!location || response.status < 300 || response.status >= 400) return response;

    if (redirectCount === MAX_SAFE_REDIRECTS) {
      throw new Error("Too many redirects while scoring URL.");
    }

    const method = (currentInit.method ?? request?.method ?? "GET").toUpperCase();
    currentUrl = new URL(location, currentUrl).toString();
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === "POST")
    ) {
      currentInit = { ...currentInit, method: "GET", body: undefined };
    }
  }

  throw new Error("Too many redirects while scoring URL.");
}

let fetchGuardDepth = 0;
let fetchBeforeGuard: typeof fetch | undefined;

async function withPublicAgentScoreFetch<T>(callback: () => Promise<T>): Promise<T> {
  if (fetchGuardDepth === 0) {
    fetchBeforeGuard = globalThis.fetch.bind(globalThis);
    const guardedFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetchPublicAgentScoreUrl(
        fetchBeforeGuard ?? globalThis.fetch.bind(globalThis),
        input,
        init,
      )) as typeof fetch;
    globalThis.fetch = guardedFetch;
  }

  fetchGuardDepth++;
  try {
    return await callback();
  } finally {
    fetchGuardDepth--;
    if (fetchGuardDepth === 0 && fetchBeforeGuard) {
      globalThis.fetch = fetchBeforeGuard;
      fetchBeforeGuard = undefined;
    }
  }
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
        ...init.headers,
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
    throw new Error(
      `Expected MCP JSON-RPC payload, got ${
        contentType.trim() || (body.trim() ? "non-JSON response" : "empty body")
      }.`,
    );
  }

  return JSON.parse(lastData) as McpResponseEnvelope;
}

interface McpProbe {
  ok: boolean;
  detail: string;
  tools?: string[];
}

interface McpProbeResult {
  labels: string[];
  probes: McpProbe[];
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

async function probeMcpRouteCandidates(
  baseUrl: string,
  routes: string[],
  options: { includeOriginFallback?: boolean } = {},
): Promise<McpProbeResult> {
  const candidates = buildDocsMcpEndpointCandidates(baseUrl, routes, {
    includeOriginFallback: options.includeOriginFallback,
  });

  const probes = await Promise.all(
    candidates.map(async (candidate) => {
      const probe = await probeMcpRoute(candidate.baseUrl, candidate.route);
      return {
        ...probe,
        detail: `${candidate.label}: ${probe.detail}`,
      };
    }),
  );

  return {
    labels: candidates.map((candidate) => candidate.label),
    probes,
  };
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
  openapiRoute?: string;
}

function readDiscoveryFramework(body: unknown): string | undefined {
  const root = asRecord(body);
  if (!root) return undefined;
  const candidate =
    root.framework ?? asRecord(root.site)?.framework ?? asRecord(root.app)?.framework;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim().toLowerCase();
  }
  if (typeof root.name === "string" && /@farming-labs\/docs/i.test(root.name)) {
    return "@farming-labs/docs";
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
    apiReference: readCapability(root, capabilities, "apiReference"),
    openapi: readCapability(root, capabilities, "openapi"),
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
  const openapiRoot = asRecord(root.openapi);
  const apiRoot = asRecord(root.api);

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
    openapiRoute: readDiscoveryRoute(openapiRoot?.url) ?? readDiscoveryRoute(apiRoot?.openapi),
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

function isFarmingLabsDocsFramework(framework: string | undefined): boolean {
  return /(^|[/@\s-])farming-labs[/\s-]docs\b|@farming-labs\/docs/i.test(framework ?? "");
}

function scoreRecoveryRecommendations(
  score: number,
  options: { usesFarmingLabsDocs?: boolean } = {},
): string[] {
  if (score >= 90) return [];

  const recommendations = [
    "Use the agent-friendly docs guide, MCP guide, configuration reference, and `docs doctor --agent --url` output to close the failing checks.",
  ];

  if (options.usesFarmingLabsDocs) {
    recommendations.unshift(FARMING_LABS_DOCS_UPGRADE_RECOMMENDATION);
  }

  return recommendations;
}

const AF_DOCS_CHECK_TITLES: Record<string, string> = {
  "llms-txt-exists": "llms.txt exists",
  "llms-txt-valid": "llms.txt structure",
  "llms-txt-size": "llms.txt size",
  "llms-txt-links-resolve": "llms.txt links resolve",
  "llms-txt-links-markdown": "llms.txt markdown links",
  "llms-txt-directive-html": "HTML llms.txt directive",
  "llms-txt-directive-md": "Markdown llms.txt directive",
  "markdown-url-support": "Markdown URL availability",
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

interface HtmlPageSurfaceProbe {
  url: string;
  ok: boolean;
  status?: number;
  detail: string;
  hasJsonLd: boolean;
  hasMarkdownAlternate: boolean;
  markdownAlternateHref?: string;
}

interface MarkdownCanonicalProbe {
  pageUrl: string;
  markdownUrl: string;
  ok: boolean;
  status?: number;
  detail: string;
  hasCanonicalLink: boolean;
}

interface AdjacentMarkdownRouteProbe {
  pageUrl: string;
  markdownUrl: string;
  ok: boolean;
  status?: number;
  detail: string;
}

function decodeHtmlEntity(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, raw: string) => {
    const lower = raw.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return named[lower] ?? entity;
  });
}

function htmlAttribute(tag: string, name: string): string | undefined {
  const pattern = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    if (match[1]?.toLowerCase() !== name.toLowerCase()) continue;
    return decodeHtmlEntity(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return undefined;
}

function hasJsonLdScript(html: string): boolean {
  return /<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>/i.test(html);
}

function markdownAlternateHref(html: string): string | undefined {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = htmlAttribute(tag, "rel") ?? "";
    const type = htmlAttribute(tag, "type") ?? "";
    const href = htmlAttribute(tag, "href");
    const relTokens = rel.toLowerCase().split(/\s+/).filter(Boolean);

    if (href && relTokens.includes("alternate") && /^text\/markdown(?:\s*;|$)/i.test(type.trim())) {
      return href;
    }
  }

  return undefined;
}

function resolveMarkdownAlternateUrl(href: string | undefined, pageUrl: string): URL | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, pageUrl);
    const page = new URL(pageUrl);
    return url.origin === page.origin && url.pathname.endsWith(".md") ? url : undefined;
  } catch {
    return undefined;
  }
}

function markdownUrlForHtmlPage(pageUrl: string, alternateHref?: string): string {
  const alternateUrl = resolveMarkdownAlternateUrl(alternateHref, pageUrl);
  if (alternateUrl) return alternateUrl.toString();

  const url = new URL(pageUrl);
  const pathname = url.pathname.replace(/\/+$/, "") || url.pathname;
  url.pathname = pathname.endsWith(".md") ? pathname : `${pathname}.md`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function adjacentMarkdownUrlForHtmlPage(pageUrl: string): string {
  const url = new URL(pageUrl);
  const pathname = url.pathname.replace(/\/+$/, "") || url.pathname;
  url.pathname = `${pathname.replace(/\.html?$/i, "")}.md`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function looksLikeHtmlContent(body: string): boolean {
  const sample = body
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, "")
    .replace(/`[^`\n]+`/g, "``")
    .slice(0, 2000);
  return /<!doctype\s/i.test(sample) || /<html[\s>]/i.test(sample) || /<body[\s>]/i.test(sample);
}

function looksLikeMarkdownContent(body: string): boolean {
  if (!body.trim() || looksLikeHtmlContent(body)) return false;
  const sample = body.slice(0, 5000);
  let signals = 0;
  if (/^#{1,6}\s+\S/m.test(sample)) signals++;
  if (/\[[^\]]+\]\([^)]+\)/.test(sample)) signals++;
  if (/^```/m.test(sample)) signals++;
  return signals > 0;
}

function isMarkdownResponse(response: Response, body: string): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return (
    response.ok &&
    body.trim().length > 0 &&
    (contentType.includes("text/markdown") || looksLikeMarkdownContent(body))
  );
}

function canonicalLinkFromHeader(header: string | null): string | undefined {
  if (!header) return undefined;

  for (const match of header.matchAll(/<([^>]+)>\s*((?:;\s*[^,]+)*)/g)) {
    const params = match[2] ?? "";
    const rel = params.match(/(?:^|;)\s*rel\s*=\s*(?:"([^"]*)"|([^;\s,]+))/i);
    const relValue = rel?.[1] ?? rel?.[2] ?? "";
    if (relValue.toLowerCase().split(/\s+/).includes("canonical")) return match[1];
  }

  return undefined;
}

function normalizeCanonicalUrl(value: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function hasCanonicalLinkHeader(
  header: string | null,
  pageUrl: string,
  responseUrl: string,
): boolean {
  const canonical = canonicalLinkFromHeader(header);
  if (!canonical) return false;
  return normalizeCanonicalUrl(canonical, responseUrl) === normalizeCanonicalUrl(pageUrl, pageUrl);
}

function isDocsHtmlPagePath(pathname: string, rootDocsRoute: string): boolean {
  const root = `/${rootDocsRoute.replace(/^\/+|\/+$/g, "") || "docs"}`;
  if (pathname.endsWith(".md")) return false;
  return pathname === root || pathname.startsWith(`${root}/`);
}

function normalizeDiscoveredPageUrl(
  rawUrl: string,
  baseUrl: string,
  rootDocsRoute: string,
): string | undefined {
  const trimmed = decodeHtmlEntity(rawUrl).trim();
  if (!trimmed || trimmed.startsWith("#") || /^(mailto|tel|javascript):/i.test(trimmed)) {
    return undefined;
  }

  try {
    const base = new URL(baseUrl);
    const url = new URL(trimmed, trimmed.startsWith("/") ? base.origin : baseUrl);
    url.hash = "";
    url.search = "";
    if (url.origin !== base.origin) return undefined;
    if (!isDocsHtmlPagePath(url.pathname, rootDocsRoute)) return undefined;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function sitemapPageUrlsFromProbe(
  probe: TextProbe,
  baseUrl: string,
  rootDocsRoute: string,
): string[] {
  if (!probe.ok || !probe.body) return [];

  const urls: string[] = [];
  for (const match of probe.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const normalized = normalizeDiscoveredPageUrl(match[1] ?? "", baseUrl, rootDocsRoute);
    if (normalized) urls.push(normalized);
  }

  for (const match of probe.body.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const normalized = normalizeDiscoveredPageUrl(match[1] ?? "", baseUrl, rootDocsRoute);
    if (normalized) urls.push(normalized);
  }

  return urls;
}

function samplePageUrls(urls: string[], limit: number): string[] {
  const unique = Array.from(new Set(urls));
  if (unique.length <= limit) return unique;

  unique.sort();
  const stride = unique.length / limit;
  return Array.from({ length: limit }, (_, index) => unique[Math.floor(index * stride)]!).filter(
    Boolean,
  );
}

function isNonHtmlPagePath(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  return /\.[a-z0-9]+$/i.test(lastSegment) && !/\.html?$/i.test(lastSegment);
}

function normalizeAdjacentMarkdownPageUrl(rawUrl: string, baseUrl: string): string | undefined {
  try {
    const base = new URL(baseUrl);
    const url = new URL(rawUrl, baseUrl);
    if (url.origin !== base.origin) return undefined;

    url.hash = "";
    url.search = "";

    let pathname = url.pathname;
    if (pathname.startsWith("/llms.txt/")) {
      pathname = pathname.slice("/llms.txt".length) || "/";
    }
    if (pathname.endsWith("/index.md") || pathname.endsWith("/index.mdx")) {
      pathname = pathname.replace(/\/index\.mdx?$/i, "");
    } else {
      pathname = pathname.replace(/\.mdx?$/i, "");
    }
    pathname = pathname.replace(/\/+$/, "") || "/";

    if (pathname === "/" || pathname === "/llms.txt") return undefined;
    if (pathname.startsWith("/.well-known/")) return undefined;
    if (isNonHtmlPagePath(pathname)) return undefined;

    url.pathname = pathname;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function adjacentMarkdownPageUrlsFromAfDocsReport(baseUrl: string, report: ReportResult): string[] {
  const urls: string[] = [];
  const base = new URL(baseUrl);
  if (base.pathname !== "/") {
    const normalized = normalizeAdjacentMarkdownPageUrl(baseUrl, baseUrl);
    if (normalized) urls.push(normalized);
  }

  const markdownUrlResult = report.results.find((result) => result.id === "markdown-url-support");
  const pageResults = Array.isArray(markdownUrlResult?.details?.pageResults)
    ? markdownUrlResult.details.pageResults
    : [];

  for (const pageResult of pageResults) {
    const record = asRecord(pageResult);
    const pageUrl = readString(record?.url);
    const markdownUrl = readString(record?.mdUrl);
    for (const candidate of [pageUrl, markdownUrl]) {
      if (!candidate) continue;
      const normalized = normalizeAdjacentMarkdownPageUrl(candidate, baseUrl);
      if (normalized) urls.push(normalized);
    }
  }

  return samplePageUrls(urls, AF_DOCS_MAX_LINKS_TO_TEST);
}

async function probeAdjacentMarkdownRoute(pageUrl: string): Promise<AdjacentMarkdownRouteProbe> {
  const markdownUrl = adjacentMarkdownUrlForHtmlPage(pageUrl);

  try {
    const response = await fetchWithTimeout(markdownUrl, {
      headers: { Accept: "text/markdown, */*" },
    });
    const body = await response.text().catch(() => "");
    const ok = isMarkdownResponse(response, body);
    const pathname = new URL(markdownUrl).pathname;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();

    return {
      pageUrl,
      markdownUrl,
      ok,
      status: response.status,
      detail: ok
        ? `${pathname} returned markdown${contentType ? ` (${contentType})` : ""}.`
        : response.ok
          ? `${pathname} returned HTTP ${response.status} but did not look like markdown.`
          : `${pathname} returned HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      pageUrl,
      markdownUrl,
      ok: false,
      detail: `${markdownUrl} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

async function probeAdjacentMarkdownRoutes(
  baseUrl: string,
  report: ReportResult,
): Promise<AdjacentMarkdownRouteProbe[]> {
  const urls = adjacentMarkdownPageUrlsFromAfDocsReport(baseUrl, report);
  return Promise.all(urls.map((url) => probeAdjacentMarkdownRoute(url)));
}

function discoverHtmlSurfacePageUrls(
  baseUrl: string,
  view: DiscoveryView,
  sitemapProbes: TextProbe[],
): string[] {
  const sitemapUrls = sitemapProbes.flatMap((probe) =>
    sitemapPageUrlsFromProbe(probe, baseUrl, view.rootDocsRoute),
  );
  const fallback = normalizeDiscoveredPageUrl(view.rootDocsRoute, baseUrl, view.rootDocsRoute);
  return samplePageUrls(sitemapUrls.length > 0 ? sitemapUrls : fallback ? [fallback] : [], 10);
}

async function probeHtmlPageSurface(url: string): Promise<HtmlPageSurfaceProbe> {
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: "text/html, */*" } });
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        url,
        ok: false,
        status: response.status,
        detail: `${new URL(url).pathname} returned HTTP ${response.status}.`,
        hasJsonLd: false,
        hasMarkdownAlternate: false,
      };
    }

    const alternateHref = markdownAlternateHref(body);
    const alternateUrl = resolveMarkdownAlternateUrl(alternateHref, url);
    const hasMarkdownAlternate = Boolean(alternateUrl);

    return {
      url,
      ok: true,
      status: response.status,
      detail: `${new URL(url).pathname} returned HTML with ${body.length} characters.`,
      hasJsonLd: hasJsonLdScript(body),
      hasMarkdownAlternate,
      ...(alternateUrl ? { markdownAlternateHref: alternateUrl.toString() } : {}),
    };
  } catch (error) {
    return {
      url,
      ok: false,
      detail: `${url} failed: ${error instanceof Error ? error.message : String(error)}.`,
      hasJsonLd: false,
      hasMarkdownAlternate: false,
    };
  }
}

async function probeHtmlPageSurfaces(
  baseUrl: string,
  view: DiscoveryView,
  sitemapProbes: TextProbe[],
): Promise<HtmlPageSurfaceProbe[]> {
  const urls = discoverHtmlSurfacePageUrls(baseUrl, view, sitemapProbes);
  return Promise.all(urls.map((url) => probeHtmlPageSurface(url)));
}

async function probeMarkdownCanonicalHeader(
  probe: HtmlPageSurfaceProbe,
): Promise<MarkdownCanonicalProbe> {
  const markdownUrl = markdownUrlForHtmlPage(probe.url, probe.markdownAlternateHref);

  if (!probe.ok) {
    return {
      pageUrl: probe.url,
      markdownUrl,
      ok: false,
      detail: `${new URL(probe.url).pathname} was not available for markdown canonical probing.`,
      hasCanonicalLink: false,
    };
  }

  try {
    const response = await fetchWithTimeout(markdownUrl, {
      headers: { Accept: "text/markdown, */*" },
    });
    const body = await response.text().catch(() => "");
    const hasCanonicalLink = hasCanonicalLinkHeader(
      response.headers.get("link"),
      probe.url,
      markdownUrl,
    );

    return {
      pageUrl: probe.url,
      markdownUrl,
      ok: response.ok,
      status: response.status,
      detail: response.ok
        ? `${new URL(markdownUrl).pathname} returned markdown with ${body.length} characters${
            hasCanonicalLink ? " and a canonical Link header" : " but no canonical Link header"
          }.`
        : `${new URL(markdownUrl).pathname} returned HTTP ${response.status}.`,
      hasCanonicalLink,
    };
  } catch (error) {
    return {
      pageUrl: probe.url,
      markdownUrl,
      ok: false,
      detail: `${markdownUrl} failed: ${error instanceof Error ? error.message : String(error)}.`,
      hasCanonicalLink: false,
    };
  }
}

async function probeMarkdownCanonicalHeaders(
  probes: HtmlPageSurfaceProbe[],
): Promise<MarkdownCanonicalProbe[]> {
  return Promise.all(probes.map((probe) => probeMarkdownCanonicalHeader(probe)));
}

function scoreSurfaceCoverage(
  probes: HtmlPageSurfaceProbe[],
  predicate: (probe: HtmlPageSurfaceProbe) => boolean,
  maxScore: number,
): { status: ScoreStatus; score: number; passed: number; total: number } {
  const total = probes.length;
  const passed = probes.filter((probe) => probe.ok && predicate(probe)).length;
  if (total === 0) return { status: "fail", score: 0, passed: 0, total };
  if (passed === total) return { status: "pass", score: maxScore, passed, total };
  if (passed > 0) {
    return { status: "warn", score: roundScore((passed / total) * maxScore), passed, total };
  }
  return { status: "fail", score: 0, passed, total };
}

function scoreMarkdownCanonicalCoverage(
  probes: MarkdownCanonicalProbe[],
  maxScore: number,
): { status: ScoreStatus; score: number; passed: number; total: number } {
  const total = probes.length;
  const passed = probes.filter((probe) => probe.ok && probe.hasCanonicalLink).length;
  if (total === 0) return { status: "fail", score: 0, passed: 0, total };
  if (passed === total) return { status: "pass", score: maxScore, passed, total };
  if (passed > 0) {
    return { status: "warn", score: roundScore((passed / total) * maxScore), passed, total };
  }
  return { status: "fail", score: 0, passed, total };
}

function scoreAdjacentMarkdownRoutes(
  probes: AdjacentMarkdownRouteProbe[],
  maxScore: number,
): { status: ScoreStatus; score: number; passed: number; total: number } {
  const total = probes.length;
  const passed = probes.filter((probe) => probe.ok).length;
  if (total === 0) return { status: "fail", score: 0, passed: 0, total };
  if (passed === total) return { status: "pass", score: maxScore, passed, total };
  if (passed > 0) {
    return { status: "warn", score: roundScore((passed / total) * maxScore), passed, total };
  }
  return { status: "fail", score: 0, passed, total };
}

function buildAdjacentMarkdownRouteCheck(probes: AdjacentMarkdownRouteProbe[]): AgentScoreCheck {
  const score = scoreAdjacentMarkdownRoutes(probes, ADJACENT_MARKDOWN_MAX_SCORE);
  const failures = probes
    .filter((probe) => !probe.ok)
    .slice(0, 3)
    .map((probe) => probe.detail)
    .join(" ");

  return makeCheck(
    "agent:adjacent-markdown-routes",
    ".md routes",
    score.status,
    score.score,
    ADJACENT_MARKDOWN_MAX_SCORE,
    score.total > 0
      ? `${score.passed}/${score.total} sampled docs page routes returned markdown when .md was appended.${failures ? ` ${failures}` : ""}`
      : "No docs page routes were available to verify .md route support.",
    score.status === "pass"
      ? undefined
      : "Serve each docs page at the same route with .md appended, for example /docs/installation -> /docs/installation.md.",
  );
}

function buildMcpReadinessCheck(result: McpProbeResult): AgentScoreCheck {
  if (result.probes.length === 0) {
    return makeCheck(
      "framework:mcp",
      "MCP handshake",
      "fail",
      0,
      6,
      "No MCP routes were available to probe.",
      `Expose ${DEFAULT_MCP_PUBLIC_ROUTE} or ${DEFAULT_MCP_WELL_KNOWN_ROUTE} so agents can use docs tools instead of scraping.`,
    );
  }

  const passed = result.probes.filter((probe) => probe.ok).length;
  const detailProbes = passed > 0 ? result.probes.filter((probe) => probe.ok) : result.probes;
  return makeCheck(
    "framework:mcp",
    "MCP handshake",
    passed > 0 ? "pass" : "fail",
    passed > 0 ? 6 : 0,
    6,
    detailProbes.map((probe) => probe.detail).join(" "),
    passed > 0
      ? undefined
      : `Verify ${result.labels.join(" and ")} support MCP initialize and tools/list.`,
  );
}

async function buildFrameworkChecks(
  baseUrl: string,
): Promise<{ framework?: string; usesFarmingLabsDocs: boolean; checks: AgentScoreCheck[] }> {
  const frameworkDiscovery = await probeFrameworkDiscovery(baseUrl);
  if (!frameworkDiscovery) {
    const mcpResult = await probeMcpRouteCandidates(baseUrl, [
      DEFAULT_MCP_PUBLIC_ROUTE,
      DEFAULT_MCP_WELL_KNOWN_ROUTE,
    ]);
    return { usesFarmingLabsDocs: false, checks: [buildMcpReadinessCheck(mcpResult)] };
  }

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
    openapiProbe,
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
      ? Promise.resolve({ labels: [], probes: [] })
      : probeMcpRouteCandidates(frameworkBaseUrl, view.mcpRoutes, {
          includeOriginFallback: false,
        }),
    view.capabilities.search === false || !view.searchEndpoint
      ? Promise.resolve(undefined)
      : probeJsonRoute(frameworkBaseUrl, fillSearchEndpoint(view.searchEndpoint, "installation")),
    view.capabilities.agentFeedback === false || !view.feedbackSchemaRoute
      ? Promise.resolve(undefined)
      : probeJsonRoute(frameworkBaseUrl, view.feedbackSchemaRoute),
    view.openapiRoute
      ? probeJsonRoute(frameworkBaseUrl, view.openapiRoute)
      : Promise.resolve(undefined),
  ]);
  const htmlSurfaceProbes = await probeHtmlPageSurfaces(frameworkBaseUrl, view, sitemapProbes);
  const markdownCanonicalProbes =
    view.capabilities.markdownRoutes === false
      ? []
      : await probeMarkdownCanonicalHeaders(htmlSurfaceProbes);

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
  } else if (mcpProbes.probes.length === 0) {
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
    checks.push(buildMcpReadinessCheck(mcpProbes));
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

  if (
    view.capabilities.openapi === true ||
    view.capabilities.apiReference === true ||
    view.openapiRoute
  ) {
    const openapiBody = asRecord(openapiProbe?.body);
    const openapiLooksValid =
      openapiProbe?.ok &&
      (typeof openapiBody?.openapi === "string" || typeof openapiBody?.swagger === "string");
    checks.push(
      makeCheck(
        "framework:openapi",
        "OpenAPI schema",
        openapiLooksValid ? "pass" : "warn",
        openapiLooksValid ? 2 : 0,
        2,
        openapiLooksValid
          ? "OpenAPI schema route returned a machine-readable OpenAPI document."
          : openapiProbe
            ? openapiProbe.detail
            : "Discovery spec did not advertise an OpenAPI schema route.",
        openapiLooksValid
          ? undefined
          : "When apiReference is enabled, expose /api/docs?format=openapi through agent discovery so agents can use schemas before scraping API docs.",
      ),
    );
  }

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

  const structuredScore = scoreSurfaceCoverage(htmlSurfaceProbes, (probe) => probe.hasJsonLd, 3);
  checks.push(
    makeCheck(
      "framework:structured-data",
      "Structured data",
      view.capabilities.structuredData === false ? "warn" : structuredScore.status,
      view.capabilities.structuredData === false ? 0 : structuredScore.score,
      3,
      view.capabilities.structuredData === false
        ? "Discovery spec reports structured data as disabled."
        : structuredScore.total > 0
          ? `${structuredScore.passed}/${structuredScore.total} sampled pages include application/ld+json structured data.`
          : "No docs pages were available to verify application/ld+json structured data.",
      view.capabilities.structuredData === false || structuredScore.status === "pass"
        ? undefined
        : "Keep JSON-LD enabled on every docs page so agents can read canonical title, description, URL, breadcrumbs, and freshness hints.",
    ),
  );

  const markdownAlternateScore = scoreSurfaceCoverage(
    htmlSurfaceProbes,
    (probe) => probe.hasMarkdownAlternate,
    3,
  );
  checks.push(
    makeCheck(
      "framework:markdown-alternate",
      "Markdown alternate links",
      view.capabilities.markdownRoutes === false ? "warn" : markdownAlternateScore.status,
      view.capabilities.markdownRoutes === false ? 0 : markdownAlternateScore.score,
      3,
      view.capabilities.markdownRoutes === false
        ? "Discovery spec reports markdown routes as disabled."
        : markdownAlternateScore.total > 0
          ? `${markdownAlternateScore.passed}/${markdownAlternateScore.total} sampled pages include <link rel="alternate" type="text/markdown"> pointing to .md routes.`
          : "No docs pages were available to verify markdown alternate links.",
      view.capabilities.markdownRoutes === false || markdownAlternateScore.status === "pass"
        ? undefined
        : "Add a text/markdown alternate link in each docs page head, usually through `alternates.types['text/markdown']`, so agents can discover the page markdown URL from HTML.",
    ),
  );

  const markdownCanonicalScore = scoreMarkdownCanonicalCoverage(markdownCanonicalProbes, 1);
  checks.push(
    makeCheck(
      "framework:markdown-canonical",
      "Markdown canonical headers",
      view.capabilities.markdownRoutes === false
        ? "warn"
        : markdownCanonicalScore.status === "pass"
          ? "pass"
          : "warn",
      view.capabilities.markdownRoutes === false ? 0 : markdownCanonicalScore.score,
      1,
      view.capabilities.markdownRoutes === false
        ? "Discovery spec reports markdown routes as disabled."
        : markdownCanonicalScore.total > 0
          ? `${markdownCanonicalScore.passed}/${markdownCanonicalScore.total} sampled markdown routes include a canonical Link response header.`
          : "No docs pages were available to verify markdown canonical headers.",
      view.capabilities.markdownRoutes === false || markdownCanonicalScore.status === "pass"
        ? undefined
        : 'Return `Link: <canonical-page-url>; rel="canonical"` on successful markdown page responses so agents can cite the normal docs URL.',
    ),
  );

  return {
    framework: view.framework,
    usesFarmingLabsDocs: true,
    checks,
  };
}

/**
 * Probe a public docs site and return a readiness report.
 *
 * Throws only when the input URL is malformed, so the API route can
 * return a clean 400. Per-check failures surface as `fail` entries.
 */
export async function inspectHostedAgentReadiness(rawUrl: string): Promise<AgentScoreReport> {
  const baseUrl = normalizeAgentScoreBaseUrl(rawUrl);
  await assertPublicAgentScoreUrl(baseUrl);

  const { afdocsReport, adjacentMarkdownChecks, framework } = await withPublicAgentScoreFetch(
    async () => {
      const report = await runChecks(baseUrl, {
        samplingStrategy: "deterministic",
        maxLinksToTest: AF_DOCS_MAX_LINKS_TO_TEST,
        maxConcurrency: AF_DOCS_MAX_CONCURRENCY,
        requestDelay: AF_DOCS_REQUEST_DELAY_MS,
        requestTimeout: PROBE_TIMEOUT_MS,
      });
      const adjacentMarkdownProbes = await probeAdjacentMarkdownRoutes(baseUrl, report);
      return {
        afdocsReport: report,
        adjacentMarkdownChecks: [buildAdjacentMarkdownRouteCheck(adjacentMarkdownProbes)],
        framework: await buildFrameworkChecks(baseUrl),
      };
    },
  );
  const afdocsScore = computeScore(afdocsReport);

  const checks = [
    ...buildAfDocsChecks(afdocsReport, afdocsScore),
    ...adjacentMarkdownChecks,
    ...framework.checks,
  ];
  const genericRawScore = adjacentMarkdownChecks.reduce((total, check) => total + check.score, 0);
  const genericRawMaxScore = adjacentMarkdownChecks.reduce(
    (total, check) => total + check.maxScore,
    0,
  );
  const frameworkRawScore = framework.checks.reduce((total, check) => total + check.score, 0);
  const frameworkRawMaxScore = framework.checks.reduce((total, check) => total + check.maxScore, 0);
  const rawScore = roundScore(afdocsScore.overall + genericRawScore + frameworkRawScore);
  const rawMaxScore = roundScore(100 + genericRawMaxScore + frameworkRawMaxScore);
  const score = rawMaxScore <= 0 ? 0 : Math.round((rawScore / rawMaxScore) * 100);
  const name = deriveAgentScoreSiteName(baseUrl);
  const recoveryRecommendations = scoreRecoveryRecommendations(score, {
    usesFarmingLabsDocs:
      framework.usesFarmingLabsDocs || isFarmingLabsDocsFramework(framework.framework),
  });
  const recommendations = Array.from(
    new Set(
      [
        ...recoveryRecommendations,
        ...afdocsScore.diagnostics.map((diagnostic) => diagnostic.resolution),
        ...checks
          .map((check) => check.recommendation)
          .filter((value): value is string => Boolean(value)),
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

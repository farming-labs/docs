import {
  isDocsAgentDiscoveryRequest,
  isDocsAgentsRequest,
  isDocsSkillRequest,
  resolveDocsAgentFeedbackConfig,
  resolveDocsAgentFeedbackRequest,
  resolveDocsAgentsFormat,
  resolveDocsLlmsTxtRequest,
  resolveDocsMarkdownRequest,
  resolveDocsSkillFormat,
} from "./agent.js";
import type {
  DocsConfig,
  DocsTelemetryAgentSurface,
  DocsTelemetryConfig,
  DocsTelemetryEvent,
  DocsTelemetryEventInput,
  DocsTelemetryFeatures,
  DocsTelemetryFramework,
} from "./types.js";

const DOCS_PACKAGE_NAME = "@farming-labs/docs";
const DOCS_PACKAGE_VERSION = "0.2.25";
const DEFAULT_DOCS_TELEMETRY_ENDPOINT = "https://docs.farming-labs.dev/api/telemetry/events";
const PROJECT_TELEMETRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROJECT_TELEMETRY_CACHE_MAX_KEYS = 256;

export interface ResolvedDocsTelemetryConfig {
  enabled: boolean;
  endpoint?: string;
}

export interface DocsTelemetryContext {
  framework?: DocsTelemetryFramework;
  request?: Request;
  siteOrigin?: string;
  properties?: Record<string, unknown>;
}

export interface DocsTelemetryAgentSurfaceContext extends DocsTelemetryContext {
  surface: DocsTelemetryAgentSurface;
}

export interface DocsTelemetryAgentSurfaceRequestOptions {
  entry: string;
  llmsTxt?: DocsConfig["llmsTxt"];
  feedback?: DocsConfig["feedback"];
}

type RuntimeEnv = Record<string, string | undefined>;

function getRuntimeEnv(): RuntimeEnv | undefined {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }

  return process.env;
}

function readRuntimeEnv(name: string): string | undefined {
  const value = getRuntimeEnv()?.[name]?.trim();
  return value ? value : undefined;
}

function isTruthyEnv(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value ?? "");
}

function isFalsyEnv(value: string | undefined): boolean {
  return /^(0|false|no|off)$/i.test(value ?? "");
}

function isBrowserRuntime(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isProductionTelemetryRuntime(): boolean {
  if (isBrowserRuntime()) return false;

  const env = getRuntimeEnv();
  if (!env) {
    return true;
  }

  if (env.NODE_ENV === "test") return false;
  if (env.VERCEL_ENV === "production") return true;
  if (env.CONTEXT === "production" && isTruthyEnv(env.NETLIFY)) return true;
  if (isTruthyEnv(env.CF_PAGES)) return true;
  if (env.RENDER_SERVICE_ID || env.FLY_APP_NAME || env.RAILWAY_ENVIRONMENT) return true;

  return env.NODE_ENV === "production";
}

export function resolveDocsTelemetryConfig(
  telemetry?: boolean | DocsTelemetryConfig,
): ResolvedDocsTelemetryConfig {
  const envToggle = readRuntimeEnv("DOCS_TELEMETRY");
  const envDisabled = readRuntimeEnv("DOCS_TELEMETRY_DISABLED");

  if (isFalsyEnv(envToggle) || isTruthyEnv(envDisabled) || telemetry === false) {
    return { enabled: false };
  }

  const objectConfig =
    telemetry && typeof telemetry === "object" ? (telemetry as DocsTelemetryConfig) : undefined;

  if (objectConfig?.enabled === false) {
    return { enabled: false };
  }

  const explicitEnabled =
    telemetry === true || objectConfig?.enabled === true || isTruthyEnv(envToggle);
  const enabled = explicitEnabled || isProductionTelemetryRuntime();

  return {
    enabled,
    endpoint:
      objectConfig?.endpoint?.trim() ||
      readRuntimeEnv("DOCS_TELEMETRY_ENDPOINT") ||
      DEFAULT_DOCS_TELEMETRY_ENDPOINT,
  };
}

function readRequestOrigin(request: Request | undefined): string | undefined {
  if (!request?.url) return undefined;

  try {
    return new URL(request.url).origin;
  } catch {
    return undefined;
  }
}

/** Normalize an HTTP(S) telemetry site value to its origin. */
export function normalizeDocsTelemetryOrigin(candidate: string | undefined): string | undefined {
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  if (!trimmed) return undefined;

  try {
    // Treat values with a URI scheme as URLs so malformed HTTP separators and non-HTTP schemes
    // cannot be reinterpreted as a public hostname (for example, `ftp://localhost` -> `ftp`).
    // A numeric suffix remains a bare host plus port, as in `localhost:3200`.
    const hasScheme = /^[a-z][a-z\d+.-]*:(?!\d)/i.test(trimmed);
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

    return url.origin;
  } catch {
    return undefined;
  }
}

/** Return whether a telemetry origin points at a local development server. */
export function isLocalDocsTelemetryOrigin(candidate: string | undefined): boolean {
  const origin = normalizeDocsTelemetryOrigin(candidate);
  if (!origin) return false;

  const hostname = new URL(origin).hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");

  if (
    [
      "localhost",
      "localhost.localdomain",
      "localhost6",
      "localhost6.localdomain6",
      "ip6-localhost",
      "ip6-loopback",
    ].includes(hostname) ||
    hostname.endsWith(".localhost")
  ) {
    return true;
  }
  if (hostname === "::" || hostname === "::1") return true;

  // URL normalizes IPv4 shorthand such as 127.1 before this check.
  const ipv4 = hostname.split(".").map((part) => Number(part));
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    return ipv4[0] === 127 || ipv4.every((part) => part === 0);
  }

  // URL serializes IPv4-mapped IPv6 addresses in hexadecimal form.
  return /^::ffff:7f[0-9a-f]{2}:/.test(hostname) || hostname === "::ffff:0:0";
}

function isBlockedDocsTelemetryOrigin(candidate: string | undefined): boolean {
  if (candidate === undefined) return false;

  return !normalizeDocsTelemetryOrigin(candidate) || isLocalDocsTelemetryOrigin(candidate);
}

function readDeploymentOrigin(): string | undefined {
  const candidates = [
    readRuntimeEnv("DOCS_SITE_URL"),
    readRuntimeEnv("NEXT_PUBLIC_BASE_URL"),
    readRuntimeEnv("NEXT_PUBLIC_SITE_URL"),
    readRuntimeEnv("SITE_URL"),
    readRuntimeEnv("URL"),
    readRuntimeEnv("CF_PAGES_URL"),
    readRuntimeEnv("VERCEL_PROJECT_PRODUCTION_URL"),
    readRuntimeEnv("VERCEL_URL"),
    readRuntimeEnv("DEPLOY_PRIME_URL"),
  ];

  for (const candidate of candidates) {
    const origin = normalizeDocsTelemetryOrigin(candidate);
    if (origin) return origin;
  }

  return undefined;
}

function detectDeployment(): DocsTelemetryEvent["deployment"] | undefined {
  const env = getRuntimeEnv();
  if (!env) return undefined;

  if (env.VERCEL || env.VERCEL_ENV) {
    return {
      provider: "vercel",
      environment: env.VERCEL_ENV,
      id: env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_GIT_COMMIT_SHA,
      region: env.VERCEL_REGION,
    };
  }

  if (env.NETLIFY) {
    return {
      provider: "netlify",
      environment: env.CONTEXT,
      id: env.DEPLOY_ID ?? env.COMMIT_REF,
    };
  }

  if (env.CF_PAGES) {
    return {
      provider: "cloudflare-pages",
      environment: env.CF_PAGES_BRANCH,
      id: env.CF_PAGES_COMMIT_SHA,
    };
  }

  if (env.RENDER_SERVICE_ID) {
    return {
      provider: "render",
      environment: env.RENDER_ENV,
      id: env.RENDER_SERVICE_ID,
    };
  }

  if (env.FLY_APP_NAME) {
    return {
      provider: "fly",
      environment: env.FLY_APP_NAME,
      id: env.FLY_ALLOC_ID,
      region: env.FLY_REGION,
    };
  }

  if (env.RAILWAY_ENVIRONMENT) {
    return {
      provider: "railway",
      environment: env.RAILWAY_ENVIRONMENT,
      id: env.RAILWAY_DEPLOYMENT_ID,
    };
  }

  return env.NODE_ENV === "production" ? { environment: "production" } : undefined;
}

function detectRuntime(): DocsTelemetryEvent["runtime"] | undefined {
  if (typeof process !== "undefined" && process.versions?.node) {
    return {
      name: "node",
      version: process.versions.node,
    };
  }

  if (typeof navigator !== "undefined" && navigator.userAgent) {
    return {
      name: "web-standard",
    };
  }

  return undefined;
}

function isObjectConfigEnabled(value: unknown, defaultEnabled: boolean): boolean {
  if (value === false) return false;
  if (value === true) return true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const enabled = (value as { enabled?: unknown }).enabled;
    return enabled === false ? false : defaultEnabled || enabled === true;
  }

  return defaultEnabled;
}

function hasObjectConfig(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getDocsTelemetryFeatures(config: Partial<DocsConfig>): DocsTelemetryFeatures {
  const pageActions = config.pageActions;
  const feedback = config.feedback;

  return {
    search: isObjectConfigEnabled(config.search, true),
    ai: isObjectConfigEnabled(config.ai, false),
    mcp: isObjectConfigEnabled(config.mcp, true),
    llmsTxt: isObjectConfigEnabled(config.llmsTxt, true),
    pageActions: hasObjectConfig(pageActions),
    feedback:
      feedback === true || (hasObjectConfig(feedback) && (feedback as any).enabled !== false),
    agentFeedback:
      feedback !== false &&
      !(hasObjectConfig(feedback) && (feedback as any).agent === false) &&
      !(
        hasObjectConfig(feedback) &&
        hasObjectConfig((feedback as any).agent) &&
        (feedback as any).agent.enabled === false
      ),
    sitemap: isObjectConfigEnabled(config.sitemap, true),
    robots: isObjectConfigEnabled(config.robots, true),
    apiReference: isObjectConfigEnabled(config.apiReference, false),
    staticExport: config.staticExport === true,
    changelog: isObjectConfigEnabled(config.changelog, false),
    cloud: typeof config.cloud !== "undefined" && isObjectConfigEnabled(config.cloud, true),
    review: isObjectConfigEnabled(config.review, true),
    codeBlocksValidate:
      hasObjectConfig(config.codeBlocks) && Boolean((config.codeBlocks as any).validate),
  };
}

function createDocsTelemetryEvent(
  config: Partial<DocsConfig>,
  input: DocsTelemetryEventInput,
  context: DocsTelemetryContext = {},
): DocsTelemetryEvent | undefined {
  const telemetryConfig =
    config.telemetry && typeof config.telemetry === "object" ? config.telemetry : undefined;
  const siteOriginCandidates = [
    context.siteOrigin,
    input.site?.origin,
    telemetryConfig?.siteOrigin,
    readRequestOrigin(context.request),
    readDeploymentOrigin(),
  ];

  // A public grouping override must never mask that the request itself came from a local runtime.
  if (siteOriginCandidates.some(isBlockedDocsTelemetryOrigin)) return undefined;

  const siteOrigin = siteOriginCandidates
    .map(normalizeDocsTelemetryOrigin)
    .find((origin): origin is string => Boolean(origin));
  const deployment = input.deployment ?? detectDeployment();
  const properties =
    context.properties || input.properties
      ? {
          ...input.properties,
          ...context.properties,
        }
      : undefined;

  return {
    ...input,
    timestamp: input.timestamp ?? new Date().toISOString(),
    package: {
      name: DOCS_PACKAGE_NAME,
      version: DOCS_PACKAGE_VERSION,
      ...input.package,
    },
    framework: input.framework ?? context.framework,
    runtime: input.runtime ?? detectRuntime(),
    site: siteOrigin ? { origin: siteOrigin } : input.site,
    deployment,
    features: input.features ?? getDocsTelemetryFeatures(config),
    properties,
  };
}

function projectEventKey(event: DocsTelemetryEvent): string {
  return [
    event.package.name,
    event.package.version,
    event.framework ?? "",
    event.site?.origin ?? "",
    event.deployment?.provider ?? "",
    event.deployment?.environment ?? "",
    event.deployment?.id ?? "",
  ].join("|");
}

function getSentProjectKeys(): Map<string, number> {
  const globalValue = globalThis as typeof globalThis & {
    __farmingLabsDocsTelemetryProjectKeys__?: Map<string, number>;
  };

  globalValue.__farmingLabsDocsTelemetryProjectKeys__ ??= new Map();
  return globalValue.__farmingLabsDocsTelemetryProjectKeys__;
}

function pruneSentProjectKeys(sent: Map<string, number>, now: number): void {
  for (const [key, expiresAt] of sent) {
    if (expiresAt <= now) {
      sent.delete(key);
    }
  }

  while (sent.size >= PROJECT_TELEMETRY_CACHE_MAX_KEYS) {
    const oldestKey = sent.keys().next().value;
    if (!oldestKey) return;
    sent.delete(oldestKey);
  }
}

export async function emitDocsTelemetryEvent(
  telemetry: boolean | DocsTelemetryConfig | undefined,
  event: DocsTelemetryEvent,
): Promise<void> {
  const resolved = resolveDocsTelemetryConfig(telemetry);
  const eventSiteOrigin = event.site?.origin;
  const normalizedSiteOrigin = normalizeDocsTelemetryOrigin(eventSiteOrigin);
  if (
    !resolved.enabled ||
    !resolved.endpoint ||
    typeof fetch !== "function" ||
    (eventSiteOrigin !== undefined &&
      (!normalizedSiteOrigin || isLocalDocsTelemetryOrigin(eventSiteOrigin)))
  ) {
    return;
  }

  const eventToSend = normalizedSiteOrigin
    ? { ...event, site: { origin: normalizedSiteOrigin } }
    : event;

  try {
    const ingestKey = readRuntimeEnv("DOCS_TELEMETRY_INGEST_KEY");
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (ingestKey) {
      headers["x-docs-telemetry-key"] = ingestKey;
    }

    await fetch(resolved.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ event: eventToSend }),
      keepalive: true,
    });
  } catch {
    // Telemetry should never affect docs runtime behavior.
  }
}

export function emitDocsTelemetryProjectEvent(
  config: Partial<DocsConfig>,
  context: DocsTelemetryContext = {},
): void {
  const event = createDocsTelemetryEvent(
    config,
    {
      type: "project_detected",
    },
    context,
  );
  if (!event) return;

  const key = projectEventKey(event);
  const sent = getSentProjectKeys();
  const now = Date.now();
  const expiresAt = sent.get(key);

  if (expiresAt && expiresAt > now) return;
  if (typeof expiresAt === "number") {
    sent.delete(key);
  }

  pruneSentProjectKeys(sent, now);
  sent.set(key, now + PROJECT_TELEMETRY_CACHE_TTL_MS);

  void emitDocsTelemetryEvent(config.telemetry, event);
}

export function emitDocsTelemetryAgentSurfaceEvent(
  config: Partial<DocsConfig>,
  context: DocsTelemetryAgentSurfaceContext,
): void {
  const event = createDocsTelemetryEvent(
    config,
    {
      type: context.surface === "mcp" ? "mcp_request" : "agent_surface_used",
      properties: {
        surface: context.surface,
      },
    },
    context,
  );
  if (!event) return;

  void emitDocsTelemetryEvent(config.telemetry, event);
}

export function emitDocsTelemetryMcpToolEvent(
  config: Partial<DocsConfig>,
  context: DocsTelemetryContext & { tool: string; locale?: string; resultCount?: number },
): void {
  const event = createDocsTelemetryEvent(
    config,
    {
      type: "mcp_tool_used",
      properties: {
        tool: context.tool,
        locale: context.locale,
        resultCount: context.resultCount,
      },
    },
    context,
  );
  if (!event) return;

  void emitDocsTelemetryEvent(config.telemetry, event);
}

export function inferDocsTelemetryAgentSurface(
  request: Request,
  options: DocsTelemetryAgentSurfaceRequestOptions,
): DocsTelemetryAgentSurface | undefined {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const feedbackConfig = resolveDocsAgentFeedbackConfig(options.feedback);
  const feedbackRequest = resolveDocsAgentFeedbackRequest(url, feedbackConfig);

  if ((method === "GET" || method === "HEAD") && isDocsAgentDiscoveryRequest(url)) {
    return "agent_spec";
  }

  if ((method === "GET" || method === "HEAD") && feedbackRequest?.kind === "schema") {
    return "agent_feedback_schema";
  }

  if (method === "POST" && feedbackRequest?.kind === "submit") {
    return "agent_feedback_submit";
  }

  if (method === "GET" || method === "HEAD") {
    if (isDocsAgentsRequest(url) || resolveDocsAgentsFormat(url) === "agents") {
      return "agents";
    }

    if (isDocsSkillRequest(url) || resolveDocsSkillFormat(url) === "skill") {
      return "skill";
    }

    if (resolveDocsMarkdownRequest(options.entry, url, request)) {
      return "markdown";
    }

    if (resolveDocsLlmsTxtRequest(url, options.llmsTxt, options.entry)) {
      return "llms";
    }
  }

  if (method === "POST") {
    return "ask_ai";
  }

  return undefined;
}

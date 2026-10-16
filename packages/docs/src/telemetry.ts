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
import { isDocsContentChangesRequest, resolveDocsContentChangesConfig } from "./content-changes.js";
import type {
  DocsConfig,
  DocsTelemetryAgentSurface,
  DocsTelemetryFeatures,
  DocsTelemetryEvent,
} from "./types.js";
import {
  createDocsTelemetryEvent,
  emitDocsTelemetryEvent,
  type DocsTelemetryContext,
  type DocsTelemetryAgentSurfaceContext,
  type DocsTelemetryAgentSurfaceRequestOptions,
} from "./telemetry-runtime.js";
export * from "./telemetry-runtime.js";
const PROJECT_TELEMETRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROJECT_TELEMETRY_CACHE_MAX_KEYS = 256;

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
    contentChanges: resolveDocsContentChangesConfig(config.agent?.contentChanges, {
      staticExport: config.staticExport === true,
    }).enabled,
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
    () => getDocsTelemetryFeatures(config),
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
    () => getDocsTelemetryFeatures(config),
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
    () => getDocsTelemetryFeatures(config),
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
    if (isDocsContentChangesRequest(url)) {
      return "content_changes";
    }

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

import type { DocsAnalyticsConfig, DocsAnalyticsEvent } from "./types.js";

interface DocsCloudAnalyticsOptions {
  endpoint?: string;
  projectId?: string;
  apiKey?: string;
}

const DEFAULT_DOCS_CLOUD_ANALYTICS_ENDPOINT =
  "https://docs-app.farming-labs.dev/api/analytics/events";

function normalizeRuntimeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readRuntimeEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }

  switch (name) {
    case "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID":
      return normalizeRuntimeEnvValue(process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID);
    case "DOCS_CLOUD_PROJECT_ID":
      return normalizeRuntimeEnvValue(process.env.DOCS_CLOUD_PROJECT_ID);
    case "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY":
      return normalizeRuntimeEnvValue(process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY);
    case "DOCS_CLOUD_ANALYTICS_KEY":
      return normalizeRuntimeEnvValue(process.env.DOCS_CLOUD_ANALYTICS_KEY);
    case "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED":
      return normalizeRuntimeEnvValue(process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED);
    case "DOCS_CLOUD_ANALYTICS_ENABLED":
      return normalizeRuntimeEnvValue(process.env.DOCS_CLOUD_ANALYTICS_ENABLED);
    case "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT":
      return normalizeRuntimeEnvValue(process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT);
    case "DOCS_CLOUD_ANALYTICS_ENDPOINT":
      return normalizeRuntimeEnvValue(process.env.DOCS_CLOUD_ANALYTICS_ENDPOINT);
    default:
      return undefined;
  }
}

function isFalsyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^(0|false|no|off)$/i.test(value);
}

export function resolveDocsCloudAnalyticsOptions(
  analytics?: boolean | DocsAnalyticsConfig,
): DocsCloudAnalyticsOptions | null {
  if (
    analytics === false ||
    (analytics && typeof analytics === "object" && analytics.enabled === false)
  ) {
    return null;
  }

  const projectId =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID") ?? readRuntimeEnv("DOCS_CLOUD_PROJECT_ID");
  const apiKey =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY") ??
    readRuntimeEnv("DOCS_CLOUD_ANALYTICS_KEY");
  const enabled =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED") ??
    readRuntimeEnv("DOCS_CLOUD_ANALYTICS_ENABLED");
  const endpoint =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT") ??
    readRuntimeEnv("DOCS_CLOUD_ANALYTICS_ENDPOINT") ??
    DEFAULT_DOCS_CLOUD_ANALYTICS_ENDPOINT;

  if (isFalsyEnv(enabled)) {
    return null;
  }

  if (!projectId) {
    return null;
  }

  return {
    endpoint,
    projectId,
    apiKey,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeAnalyticsLabel(value: string | undefined) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_") ?? ""
  );
}

function isProtocolAgentEvent(event: DocsAnalyticsEvent) {
  const type = normalizeAnalyticsLabel(event.type);
  const source = normalizeAnalyticsLabel(event.source);

  return source === "mcp" || type.startsWith("mcp_");
}

function inferAgentProvider(event: DocsAnalyticsEvent) {
  const type = normalizeAnalyticsLabel(event.type);
  const source = normalizeAnalyticsLabel(event.source);

  if (source === "mcp" || type.startsWith("mcp_")) {
    return "MCP client";
  }

  if (type.startsWith("agent_") || type === "agents_request") {
    return "Docs agent";
  }

  if (["llms_request", "markdown_request", "skill_request"].includes(type)) {
    return "Docs reader";
  }

  return undefined;
}

function detectAgentProviderFromUserAgent(userAgent: string | undefined) {
  const value = userAgent?.toLowerCase() ?? "";

  if (!value) {
    return undefined;
  }

  const providers: Array<[RegExp, string]> = [
    [/cursor/i, "Cursor"],
    [/codex/i, "Codex"],
    [/chatgpt-user|chatgpt/i, "ChatGPT"],
    [/gptbot/i, "GPTBot"],
    [/oai-searchbot|openai-search/i, "ChatGPT Search"],
    [/openai/i, "ChatGPT"],
    [/github-copilot|githubcopilot|copilot/i, "GitHub Copilot"],
    [/claudebot|claude-user|anthropic/i, "Claude"],
    [/perplexitybot|perplexity-user/i, "Perplexity"],
    [/google-extended|googlebot|apis-google/i, "Google"],
    [/bingbot|msnbot/i, "Bing"],
    [/duckduckbot/i, "DuckDuckGo"],
    [/applebot/i, "Apple"],
    [/bytespider|bytedance/i, "ByteDance"],
    [/ccbot|common crawl/i, "Common Crawl"],
    [/ahrefsbot/i, "Ahrefs"],
    [/semrushbot/i, "Semrush"],
  ];

  for (const [pattern, provider] of providers) {
    if (pattern.test(value)) {
      return provider;
    }
  }

  if (/bot|crawler|spider|slurp|facebookexternalhit|ia_archiver/.test(value)) {
    return "Other bot";
  }

  return undefined;
}

function withDocsCloudAnalyticsHints(event: DocsAnalyticsEvent): DocsAnalyticsEvent {
  const properties = asRecord(event.properties);
  const userAgent = asString(properties.userAgent) ?? asString(properties.user_agent);
  const detectedAgent = detectAgentProviderFromUserAgent(userAgent);
  const protocolAgent = isProtocolAgentEvent(event);
  const incomingTrafficType = asString(properties.trafficType)?.toLowerCase();
  const explicitAgent = incomingTrafficType === "agent" || incomingTrafficType === "bot";
  // Agent-readable routes can still be opened by humans, so event type alone is not identity.
  const agentProvider =
    asString(properties.agentName) ??
    asString(properties.agent) ??
    asString(properties.botProvider) ??
    asString(properties.provider) ??
    asString(properties.crawler) ??
    asString(asRecord(properties.bot).provider) ??
    detectedAgent ??
    (protocolAgent || explicitAgent ? inferAgentProvider(event) : undefined);

  if (!explicitAgent && !protocolAgent && !detectedAgent && !agentProvider) {
    return event;
  }

  return {
    ...event,
    properties: {
      ...properties,
      trafficType: "agent",
      ...(agentProvider && !asString(properties.agentName) ? { agentName: agentProvider } : {}),
      ...(agentProvider && !asString(properties.botProvider) ? { botProvider: agentProvider } : {}),
    },
  };
}

export async function sendDocsCloudAnalyticsEvent(
  options: DocsCloudAnalyticsOptions,
  event: DocsAnalyticsEvent,
) {
  if (typeof fetch !== "function") {
    return;
  }

  const endpoint = options.endpoint?.trim() || DEFAULT_DOCS_CLOUD_ANALYTICS_ENDPOINT;
  const projectId = options.projectId?.trim();
  if (!endpoint || !projectId) {
    return;
  }

  try {
    const normalizedEvent = withDocsCloudAnalyticsHints(event);
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey
          ? {
              authorization: `Bearer ${options.apiKey}`,
            }
          : {}),
      },
      body: JSON.stringify({
        projectId,
        event: normalizedEvent,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics should never break the docs runtime.
  }
}

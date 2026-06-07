import type { DocsConfig } from "@farming-labs/docs";

const DEFAULT_DOCS_API_ROUTE = "/api/docs";
const DEFAULT_DOCS_CLOUD_API_BASE_URL = "https://docs-app.farming-labs.dev";
const DEFAULT_PUBLIC_DOCS_CLOUD_API_KEY_ENV = "NEXT_PUBLIC_DOCS_CLOUD_API_KEY";

export interface DocsCloudAIClientRequest {
  api: string;
  requestMode?: "openai-chat" | "docs-cloud";
  requestHeaders?: Record<string, string>;
  requestStream?: boolean;
}

function readRuntimeEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function resolveDocsCloudApiBaseUrl(): string {
  return (
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_URL") ??
    readRuntimeEnv("DOCS_CLOUD_API_URL") ??
    DEFAULT_DOCS_CLOUD_API_BASE_URL
  ).replace(/\/+$/, "");
}

function resolveDocsCloudProjectId(): string | undefined {
  return (
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID") ?? readRuntimeEnv("DOCS_CLOUD_PROJECT_ID")
  );
}

function resolvePublicDocsCloudApiKey(config: DocsConfig): string | undefined {
  const configuredEnv = config.cloud?.apiKey?.env?.trim();

  if (!configuredEnv) return readRuntimeEnv(DEFAULT_PUBLIC_DOCS_CLOUD_API_KEY_ENV);
  if (!configuredEnv.startsWith("NEXT_PUBLIC_")) return undefined;

  return readRuntimeEnv(configuredEnv);
}

function resolveDocsCloudAIStream(config: DocsConfig): boolean {
  const aiConfig = config.ai as { stream?: unknown; streaming?: unknown } | undefined;
  const stream = aiConfig?.stream ?? aiConfig?.streaming;
  return typeof stream === "boolean" ? stream : true;
}

export function resolveDocsCloudAIClientRequest(
  config: DocsConfig,
  fallbackApi: string = DEFAULT_DOCS_API_ROUTE,
): DocsCloudAIClientRequest {
  const aiProvider = (config.ai as { provider?: string } | undefined)?.provider;
  if (aiProvider !== "docs-cloud") {
    return { api: fallbackApi };
  }

  const projectId = resolveDocsCloudProjectId();
  const apiKey = resolvePublicDocsCloudApiKey(config);
  const requestStream = resolveDocsCloudAIStream(config);
  if (!projectId || !apiKey) {
    return { api: fallbackApi, requestStream };
  }

  const apiBaseUrl = resolveDocsCloudApiBaseUrl();
  return {
    api: `${apiBaseUrl}/v1/projects/${encodeURIComponent(projectId)}/knowledge/ask`,
    requestMode: "docs-cloud",
    requestStream,
    requestHeaders: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
}

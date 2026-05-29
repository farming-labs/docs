import type { DocsAnalyticsConfig, DocsAnalyticsEvent } from "./types.js";

export interface DocsCloudAnalyticsOptions {
  enabled?: boolean;
  console?: DocsAnalyticsConfig["console"];
  includeInputs?: boolean;
  projectId?: string;
  apiKey?: string;
}

const DOCS_CLOUD_ANALYTICS_OPTIONS = Symbol.for("@farming-labs/docs/cloud-analytics");
const DOCS_CLOUD_ANALYTICS_ENDPOINT = "https://docs-app.farming-labs.dev/api/analytics/events";

type DocsAnalyticsConfigWithCloud = DocsAnalyticsConfig & {
  [DOCS_CLOUD_ANALYTICS_OPTIONS]?: DocsCloudAnalyticsOptions;
};

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
  if (analytics && typeof analytics === "object") {
    const explicit = (analytics as DocsAnalyticsConfigWithCloud)[DOCS_CLOUD_ANALYTICS_OPTIONS];
    if (explicit) {
      return explicit;
    }
  }

  const projectId =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID") ?? readRuntimeEnv("DOCS_CLOUD_PROJECT_ID");
  const apiKey =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY") ??
    readRuntimeEnv("DOCS_CLOUD_ANALYTICS_KEY");
  const enabled =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED") ??
    readRuntimeEnv("DOCS_CLOUD_ANALYTICS_ENABLED");

  if (!projectId || isFalsyEnv(enabled)) {
    return null;
  }

  return {
    projectId,
    apiKey,
  };
}

export async function sendDocsCloudAnalyticsEvent(
  options: DocsCloudAnalyticsOptions,
  event: DocsAnalyticsEvent,
) {
  if (typeof fetch !== "function") {
    return;
  }

  const endpoint = DOCS_CLOUD_ANALYTICS_ENDPOINT;
  const projectId = options.projectId?.trim();
  if (!endpoint || !projectId) {
    return;
  }

  try {
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
        event,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics should never break the docs runtime.
  }
}

export function createDocsCloudAnalytics(
  options: DocsCloudAnalyticsOptions = {},
): DocsAnalyticsConfig {
  const analytics: DocsAnalyticsConfigWithCloud = {
    enabled: options.enabled,
    console: options.console,
    includeInputs: options.includeInputs,
  };

  analytics[DOCS_CLOUD_ANALYTICS_OPTIONS] = options;
  return analytics;
}

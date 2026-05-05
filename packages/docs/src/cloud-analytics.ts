import type { DocsAnalyticsConfig, DocsAnalyticsEvent } from "./types.js";

export interface DocsCloudAnalyticsOptions {
  enabled?: boolean;
  console?: DocsAnalyticsConfig["console"];
  includeInputs?: boolean;
  projectId?: string;
  apiKey?: string;
}

const DOCS_CLOUD_ANALYTICS_OPTIONS = Symbol.for("@farming-labs/docs/cloud-analytics");
const DOCS_CLOUD_ANALYTICS_ENDPOINT = "https://docs.farming-labs.dev/api/analytics/events";

type DocsAnalyticsConfigWithCloud = DocsAnalyticsConfig & {
  [DOCS_CLOUD_ANALYTICS_OPTIONS]?: DocsCloudAnalyticsOptions;
};

function readRuntimeEnv(name: string): string | undefined {
  if (
    typeof process !== "undefined" &&
    process.env &&
    typeof process.env[name] === "string" &&
    process.env[name]!.trim().length > 0
  ) {
    return process.env[name]!.trim();
  }

  return undefined;
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^(1|true|yes|on)$/i.test(value);
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

  const enabled = isTruthyEnv(
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED") ??
      readRuntimeEnv("DOCS_CLOUD_ANALYTICS_ENABLED"),
  );

  if (!enabled) {
    return null;
  }

  const projectId =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID") ?? readRuntimeEnv("DOCS_CLOUD_PROJECT_ID");
  const apiKey =
    readRuntimeEnv("NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY") ??
    readRuntimeEnv("DOCS_CLOUD_ANALYTICS_KEY");

  if (!projectId) {
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

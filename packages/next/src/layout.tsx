import { createDocsLayout, createDocsMetadata } from "@farming-labs/theme";
import { emitDocsTelemetryProjectEvent } from "@farming-labs/docs";
import type { DocsConfig } from "@farming-labs/docs";
import { DocsCloudAnalytics } from "@farming-labs/docs/client/react";
import type { DocsCloudAnalyticsOptions } from "@farming-labs/docs/client/react";
import { withNextApiReferenceBanner } from "./api-reference.js";
import DocsClientCallbacks from "./client-callbacks.js";

const DOCS_CLOUD_PROJECT_ID_ENVS = [
  "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "DOCS_CLOUD_PROJECT_ID",
] as const;
const DOCS_CLOUD_ANALYTICS_ENDPOINT_ENVS = [
  "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT",
  "PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT",
  "DOCS_CLOUD_ANALYTICS_ENDPOINT",
] as const;
const DOCS_CLOUD_ANALYTICS_ENABLED_ENVS = [
  "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED",
  "PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED",
  "DOCS_CLOUD_ANALYTICS_ENABLED",
] as const;
const DEFAULT_DOCS_CLOUD_ANALYTICS_ROUTE = "/api/docs?action=analytics";

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readFirstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = normalizeEnvValue(process.env[name]);
    if (value) return value;
  }
}

function isFalsyEnv(value: string | undefined): boolean {
  return /^(0|false|no|off)$/i.test(value ?? "");
}

function resolveNextDocsCloudClientOptions(
  config: DocsConfig,
): DocsCloudAnalyticsOptions | false | undefined {
  const analytics = config.analytics;
  if (
    analytics === false ||
    (analytics &&
      typeof analytics === "object" &&
      (analytics.enabled === false || analytics.cloud === false))
  ) {
    return false;
  }

  const enabled = readFirstEnv(DOCS_CLOUD_ANALYTICS_ENABLED_ENVS);
  if (isFalsyEnv(enabled)) return false;

  const projectId = readFirstEnv(DOCS_CLOUD_PROJECT_ID_ENVS);
  if (!projectId) return undefined;

  const endpoint = readFirstEnv(DOCS_CLOUD_ANALYTICS_ENDPOINT_ENVS);

  return {
    projectId,
    analytics,
    endpoint: endpoint ?? DEFAULT_DOCS_CLOUD_ANALYTICS_ROUTE,
    metadata: {
      framework: "next",
    },
  };
}

export function createNextDocsMetadata(config: DocsConfig) {
  return createDocsMetadata(config);
}

export function createNextDocsLayout(config: DocsConfig) {
  emitDocsTelemetryProjectEvent(config, {
    framework: "next",
  });

  const DocsLayout = createDocsLayout(withNextApiReferenceBanner(config));

  return function NextDocsLayout({ children }: { children: React.ReactNode }) {
    const docsCloud = resolveNextDocsCloudClientOptions(config);

    return (
      <>
        {docsCloud ? <DocsCloudAnalytics {...docsCloud} /> : null}
        <DocsClientCallbacks docsCloudEnabled={Boolean(docsCloud)} />
        <DocsLayout>{children}</DocsLayout>
      </>
    );
  };
}

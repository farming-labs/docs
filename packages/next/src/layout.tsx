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
const DOCS_CLOUD_ANALYTICS_ROUTE_ENVS = [
  "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ROUTE",
  "PUBLIC_DOCS_CLOUD_ANALYTICS_ROUTE",
  "DOCS_CLOUD_ANALYTICS_ROUTE",
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

function withAnalyticsAction(route: string): string {
  try {
    const url = new URL(route, "https://docs.local");
    if (!url.searchParams.has("action")) {
      url.searchParams.set("action", "analytics");
    }

    return route.startsWith("http://") || route.startsWith("https://")
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const [pathAndQuery, hash = ""] = route.split("#", 2);
    const separator = pathAndQuery.includes("?") ? "&" : "?";
    return `${pathAndQuery}${separator}action=analytics${hash ? `#${hash}` : ""}`;
  }
}

function normalizeRoute(value: string | undefined): string | undefined {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return undefined;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return withAnalyticsAction(normalized);
  }

  return withAnalyticsAction(`/${normalized}`.replace(/\/+/g, "/"));
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
  const route =
    normalizeRoute(readFirstEnv(DOCS_CLOUD_ANALYTICS_ROUTE_ENVS)) ??
    normalizeRoute(config.cloud?.apiRoute);
  const includeInputs = typeof analytics === "object" && analytics.includeInputs === true;

  return {
    projectId,
    endpoint: endpoint ?? route ?? DEFAULT_DOCS_CLOUD_ANALYTICS_ROUTE,
    includeInputs,
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

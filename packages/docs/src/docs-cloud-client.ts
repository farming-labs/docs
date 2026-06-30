"use client";

import { sendDocsCloudAnalyticsEvent } from "./cloud-analytics.js";
import type { DocsAnalyticsEvent, DocsAnalyticsEventInput } from "./types.js";

const DEFAULT_DOCS_CLOUD_API_BASE_URL = "https://api.farming-labs.dev";
const DOCS_CLOUD_PROJECT_ID_ENVS = [
  "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "DOCS_CLOUD_PROJECT_ID",
] as const;
const DOCS_CLOUD_API_BASE_URL_ENVS = [
  "NEXT_PUBLIC_DOCS_CLOUD_URL",
  "PUBLIC_DOCS_CLOUD_URL",
  "DOCS_CLOUD_API_BASE_URL",
  "DOCS_CLOUD_API_URL",
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
const DOCS_CLOUD_ANALYTICS_KEY_ENVS = [
  "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY",
  "PUBLIC_DOCS_CLOUD_ANALYTICS_KEY",
  "DOCS_CLOUD_ANALYTICS_KEY",
] as const;

export type DocsCloudClientRuntimeValue<T = string> =
  | T
  | undefined
  | null
  | (() => T | undefined | null);
export type DocsCloudClientRuntimeEnv =
  | Record<string, string | undefined>
  | (() => Record<string, string | undefined>);

export interface DocsCloudClientOptions {
  projectId?: DocsCloudClientRuntimeValue;
  endpoint?: DocsCloudClientRuntimeValue;
  analyticsEndpoint?: DocsCloudClientRuntimeValue;
  apiBaseUrl?: DocsCloudClientRuntimeValue;
  analyticsKey?: DocsCloudClientRuntimeValue;
  enabled?: DocsCloudClientRuntimeValue<boolean | string>;
  env?: DocsCloudClientRuntimeEnv;
  fetch?: typeof fetch;
  metadata?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

export interface DocsCloudClientTrackOptions {
  metadata?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  locale?: string;
}

export interface DocsCloudClientResolvedConfig {
  enabled: boolean;
  configured: boolean;
  projectId?: string;
  endpoint: string;
}

export interface DocsCloudClient {
  analytics: {
    track(event: DocsAnalyticsEventInput, options?: DocsCloudClientTrackOptions): Promise<boolean>;
  };
  trackEvent(
    event: DocsAnalyticsEventInput,
    options?: DocsCloudClientTrackOptions,
  ): Promise<boolean>;
  getConfig(): DocsCloudClientResolvedConfig;
  isConfigured(): boolean;
}

function normalizeRuntimeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveRuntimeValue<T>(value: DocsCloudClientRuntimeValue<T>): T | undefined {
  const resolved = typeof value === "function" ? (value as () => T | undefined | null)() : value;
  return resolved ?? undefined;
}

function resolveRuntimeString(value: DocsCloudClientRuntimeValue): string | undefined {
  return normalizeRuntimeString(resolveRuntimeValue(value));
}

function resolveRuntimeEnv(
  env: DocsCloudClientRuntimeEnv | undefined,
): Record<string, string | undefined> {
  return typeof env === "function" ? env() : (env ?? {});
}

function readProcessEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return normalizeRuntimeString(process.env?.[name]);
}

function readEnv(name: string, env: Record<string, string | undefined>): string | undefined {
  return normalizeRuntimeString(env[name]) ?? readProcessEnv(name);
}

function readFirstEnv(
  names: readonly string[],
  env: Record<string, string | undefined>,
): string | undefined {
  for (const name of names) {
    const value = readEnv(name, env);
    if (value) return value;
  }
}

function isFalsy(value: unknown): boolean {
  if (value === false) return true;
  if (typeof value !== "string") return false;
  return /^(0|false|no|off)$/i.test(value.trim());
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function mergeRecords(
  ...records: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const merged: Record<string, unknown> = {};

  for (const record of records) {
    if (!record) continue;
    Object.assign(merged, record);
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function getBrowserLocation() {
  return typeof window !== "undefined" ? window.location : undefined;
}

function getBrowserReferrer() {
  if (typeof document === "undefined") return undefined;
  return document.referrer || undefined;
}

export function createDocsCloudClient(options: DocsCloudClientOptions = {}): DocsCloudClient {
  function env(): Record<string, string | undefined> {
    return resolveRuntimeEnv(options.env);
  }

  function projectId(): string | undefined {
    const runtimeEnv = env();
    return (
      resolveRuntimeString(options.projectId) ??
      readFirstEnv(DOCS_CLOUD_PROJECT_ID_ENVS, runtimeEnv)
    );
  }

  function apiBaseUrl(): string {
    const runtimeEnv = env();
    return stripTrailingSlash(
      resolveRuntimeString(options.apiBaseUrl) ??
        readFirstEnv(DOCS_CLOUD_API_BASE_URL_ENVS, runtimeEnv) ??
        DEFAULT_DOCS_CLOUD_API_BASE_URL,
    );
  }

  function endpoint(): string {
    const runtimeEnv = env();
    return (
      resolveRuntimeString(options.endpoint) ??
      resolveRuntimeString(options.analyticsEndpoint) ??
      readFirstEnv(DOCS_CLOUD_ANALYTICS_ENDPOINT_ENVS, runtimeEnv) ??
      `${apiBaseUrl()}/v1/analytics/events`
    );
  }

  function analyticsKey(): string | undefined {
    const runtimeEnv = env();
    return (
      resolveRuntimeString(options.analyticsKey) ??
      readFirstEnv(DOCS_CLOUD_ANALYTICS_KEY_ENVS, runtimeEnv)
    );
  }

  function enabled(): boolean {
    const runtimeEnv = env();
    const value =
      resolveRuntimeValue(options.enabled) ??
      readFirstEnv(DOCS_CLOUD_ANALYTICS_ENABLED_ENVS, runtimeEnv);

    return !isFalsy(value);
  }

  function getConfig(): DocsCloudClientResolvedConfig {
    const id = projectId();

    return {
      enabled: enabled(),
      configured: Boolean(id),
      ...(id ? { projectId: id } : {}),
      endpoint: endpoint(),
    };
  }

  async function trackEvent(
    event: DocsAnalyticsEventInput,
    trackOptions: DocsCloudClientTrackOptions = {},
  ): Promise<boolean> {
    const config = getConfig();
    if (!config.enabled || !config.projectId) return false;

    const location = getBrowserLocation();
    const normalized: DocsAnalyticsEvent = {
      ...event,
      source: event.source ?? "client",
      timestamp: event.timestamp ?? new Date().toISOString(),
      url: event.url ?? location?.href,
      path: event.path ?? location?.pathname,
      referrer: event.referrer ?? getBrowserReferrer(),
      locale: event.locale ?? trackOptions.locale,
      metadata: mergeRecords(options.metadata, trackOptions.metadata, event.metadata),
      properties: mergeRecords(options.properties, trackOptions.properties, event.properties),
    };

    await sendDocsCloudAnalyticsEvent(
      {
        endpoint: config.endpoint,
        projectId: config.projectId,
        apiKey: analyticsKey(),
        fetch: options.fetch,
      },
      normalized,
    );

    return true;
  }

  return {
    analytics: {
      track: trackEvent,
    },
    trackEvent,
    getConfig,
    isConfigured() {
      const config = getConfig();
      return config.enabled && config.configured;
    },
  };
}

export async function trackDocsCloudEvent(
  event: DocsAnalyticsEventInput,
  options: DocsCloudClientOptions & DocsCloudClientTrackOptions = {},
): Promise<boolean> {
  const { metadata, properties, locale, ...clientOptions } = options;
  return createDocsCloudClient(clientOptions).trackEvent(event, {
    metadata,
    properties,
    locale,
  });
}

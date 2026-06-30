import { sendDocsCloudAnalyticsEvent } from "./cloud-analytics.js";
import { createDocsCloudAskAIResponse } from "./cloud-ask-ai.js";
import type { DocsAnalyticsConfig, DocsAnalyticsEvent, DocsAnalyticsEventInput } from "./types.js";
import type { DocsCloudAskAIConfig, DocsCloudAskAIResponseOptions } from "./cloud-ask-ai.js";

const DEFAULT_DOCS_CLOUD_API_BASE_URL = "https://api.farming-labs.dev";
const DEFAULT_DOCS_CLOUD_API_KEY_ENV = "DOCS_CLOUD_API_KEY";
const DOCS_CLOUD_PROJECT_ID_ENVS = [
  "DOCS_CLOUD_PROJECT_ID",
  "PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
] as const;
const DOCS_CLOUD_API_BASE_URL_ENVS = [
  "DOCS_CLOUD_API_BASE_URL",
  "DOCS_CLOUD_API_URL",
  "PUBLIC_DOCS_CLOUD_URL",
  "NEXT_PUBLIC_DOCS_CLOUD_URL",
] as const;
const DOCS_CLOUD_ANALYTICS_KEY_ENVS = [
  "DOCS_CLOUD_ANALYTICS_KEY",
  "PUBLIC_DOCS_CLOUD_ANALYTICS_KEY",
  "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY",
] as const;
const DOCS_CLOUD_ANALYTICS_ENDPOINT_ENVS = [
  "DOCS_CLOUD_ANALYTICS_ENDPOINT",
  "PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT",
  "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT",
] as const;

export type DocsCloudRuntimeValue<T = string> = T | undefined | null | (() => T | undefined | null);
export type DocsCloudRuntimeEnv =
  | Record<string, string | undefined>
  | (() => Record<string, string | undefined>);

export interface DocsCloudServerOptions {
  projectId?: DocsCloudRuntimeValue;
  apiKey?: DocsCloudRuntimeValue;
  apiKeyEnv?: DocsCloudRuntimeValue;
  analyticsKey?: DocsCloudRuntimeValue;
  apiBaseUrl?: DocsCloudRuntimeValue;
  analyticsEndpoint?: DocsCloudRuntimeValue;
  publicBaseUrl?: DocsCloudRuntimeValue;
  env?: DocsCloudRuntimeEnv;
  fetch?: typeof fetch;
  config?: DocsCloudAskAIConfig;
  analytics?: boolean | DocsAnalyticsConfig;
  metadata?: Record<string, unknown>;
}

export interface DocsCloudTrackEventOptions {
  request?: Request;
  locale?: string;
  source?: DocsAnalyticsEvent["source"];
  input?: DocsAnalyticsEventInput["input"];
  metadata?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

export interface DocsCloudAskAIOptions extends Omit<
  DocsCloudAskAIResponseOptions,
  "config" | "env" | "fetch" | "publicBaseUrl"
> {
  config?: DocsCloudAskAIConfig;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  publicBaseUrl?: string;
}

export interface DocsCloudRouteHandlerOptions {
  locale?: string | ((request: Request) => string | undefined | Promise<string | undefined>);
  publicBaseUrl?: string | ((request: Request) => string | undefined | Promise<string | undefined>);
}

export interface DocsCloudPublicConfig {
  ok: true;
  configured: {
    projectId: boolean;
    apiKey: boolean;
  };
  projectId?: string;
  apiBaseUrl: string;
  features: {
    analytics: boolean;
    askAI: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface DocsCloudAnalyticsServer {
  track(event: DocsAnalyticsEventInput, options?: DocsCloudTrackEventOptions): Promise<boolean>;
}

export interface DocsCloudServer {
  analytics: DocsCloudAnalyticsServer;
  trackEvent(
    event: DocsAnalyticsEventInput,
    options?: DocsCloudTrackEventOptions,
  ): Promise<boolean>;
  askAI(request: Request, options?: DocsCloudAskAIOptions): Promise<Response>;
  handleRequest(request: Request, options?: DocsCloudRouteHandlerOptions): Promise<Response>;
  getPublicConfig(): DocsCloudPublicConfig;
}

export interface DocsCloudRouteHandlers {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
}

type JsonRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeRuntimeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveRuntimeValue<T>(value: DocsCloudRuntimeValue<T>): T | undefined {
  const resolved = typeof value === "function" ? (value as () => T | undefined | null)() : value;
  return resolved ?? undefined;
}

function resolveRuntimeString(value: DocsCloudRuntimeValue): string | undefined {
  return normalizeRuntimeString(resolveRuntimeValue(value));
}

function readProcessEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return normalizeRuntimeString(process.env?.[name]);
}

function resolveRuntimeEnv(
  env: DocsCloudRuntimeEnv | undefined,
): Record<string, string | undefined> {
  return typeof env === "function" ? env() : (env ?? {});
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

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json");
  return Response.json(data, { ...init, headers });
}

function requestProperties(request: Request | undefined): Record<string, unknown> {
  const userAgent = request?.headers.get("user-agent")?.trim();
  return userAgent ? { userAgent } : {};
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

function omitAction(record: JsonRecord): JsonRecord {
  const { action: _action, ...rest } = record;
  return rest;
}

function isAskAIBody(body: unknown): boolean {
  if (!isPlainObject(body)) return false;
  return Array.isArray(body.messages) || typeof body.question === "string";
}

function resolveRouteAction(request: Request, body: unknown): "ask-ai" | "analytics" {
  const url = new URL(request.url);
  const queryAction = asString(url.searchParams.get("action"));
  const bodyAction = isPlainObject(body) ? asString(body.action) : undefined;
  const action = (queryAction ?? bodyAction)?.toLowerCase().replace(/_/g, "-");

  if (action === "ask-ai" || action === "ai" || action === "chat") {
    return "ask-ai";
  }

  if (isAskAIBody(body)) {
    return "ask-ai";
  }

  return "analytics";
}

function resolveAnalyticsEvent(body: unknown): DocsAnalyticsEventInput | undefined {
  if (!isPlainObject(body)) return undefined;

  const eventCandidate = isPlainObject(body.event)
    ? body.event
    : isPlainObject(body.payload)
      ? body.payload
      : body;
  const eventRecord =
    eventCandidate === body && typeof body.action === "string" ? omitAction(body) : eventCandidate;

  return typeof eventRecord.type === "string"
    ? (eventRecord as DocsAnalyticsEventInput)
    : undefined;
}

function askAIPayload(body: unknown): unknown {
  if (!isPlainObject(body)) return body;
  return isPlainObject(body.payload) ? body.payload : omitAction(body);
}

function createJsonRequest(request: Request, body: unknown): Request {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");

  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(body),
    signal: request.signal,
  });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
}

async function resolveRouteValue(
  value:
    | string
    | undefined
    | ((request: Request) => string | undefined | Promise<string | undefined>),
  request: Request,
): Promise<string | undefined> {
  if (typeof value === "function") {
    return normalizeRuntimeString(await value(request));
  }

  return normalizeRuntimeString(value);
}

export function createDocsCloudServer(options: DocsCloudServerOptions = {}): DocsCloudServer {
  function env(): Record<string, string | undefined> {
    return resolveRuntimeEnv(options.env);
  }

  function apiKeyEnv(): string {
    return (
      resolveRuntimeString(options.apiKeyEnv) ??
      options.config?.cloud?.apiKey?.env?.trim() ??
      DEFAULT_DOCS_CLOUD_API_KEY_ENV
    );
  }

  function projectId(): string | undefined {
    const runtimeEnv = env();
    return (
      resolveRuntimeString(options.projectId) ??
      readFirstEnv(DOCS_CLOUD_PROJECT_ID_ENVS, runtimeEnv)
    );
  }

  function apiKey(): string | undefined {
    const runtimeEnv = env();
    const keyEnv = apiKeyEnv();
    return resolveRuntimeString(options.apiKey) ?? readEnv(keyEnv, runtimeEnv);
  }

  function analyticsKey(): string | undefined {
    const runtimeEnv = env();
    return (
      resolveRuntimeString(options.analyticsKey) ??
      apiKey() ??
      readFirstEnv(DOCS_CLOUD_ANALYTICS_KEY_ENVS, runtimeEnv)
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

  function analyticsEndpoint(): string {
    const runtimeEnv = env();
    return (
      resolveRuntimeString(options.analyticsEndpoint) ??
      readFirstEnv(DOCS_CLOUD_ANALYTICS_ENDPOINT_ENVS, runtimeEnv) ??
      `${apiBaseUrl()}/v1/analytics/events`
    );
  }

  function publicBaseUrl(): string | undefined {
    return resolveRuntimeString(options.publicBaseUrl);
  }

  function askAIEnv(
    overrides?: Record<string, string | undefined>,
  ): Record<string, string | undefined> {
    const key = apiKey();
    const keyEnv = apiKeyEnv();
    const id = projectId();

    return {
      ...env(),
      ...overrides,
      DOCS_CLOUD_API_BASE_URL: apiBaseUrl(),
      ...(id ? { DOCS_CLOUD_PROJECT_ID: id, PUBLIC_DOCS_CLOUD_PROJECT_ID: id } : {}),
      ...(key ? { [keyEnv]: key, DOCS_CLOUD_API_KEY: key } : {}),
    };
  }

  async function trackEvent(
    event: DocsAnalyticsEventInput,
    trackOptions: DocsCloudTrackEventOptions = {},
  ): Promise<boolean> {
    const id = projectId();
    if (!id) return false;

    const requestUrl = trackOptions.request ? new URL(trackOptions.request.url) : undefined;
    const normalized: DocsAnalyticsEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
      source: event.source ?? trackOptions.source ?? "server",
      url: event.url ?? trackOptions.request?.url,
      path: event.path ?? requestUrl?.pathname,
      locale: event.locale ?? trackOptions.locale,
      input: event.input ?? trackOptions.input,
      metadata: mergeRecords(options.metadata, trackOptions.metadata, event.metadata),
      properties: mergeRecords(
        requestProperties(trackOptions.request),
        trackOptions.properties,
        event.properties,
      ),
    };

    await sendDocsCloudAnalyticsEvent(
      {
        endpoint: analyticsEndpoint(),
        projectId: id,
        apiKey: analyticsKey(),
        fetch: options.fetch,
      },
      normalized,
    );

    return true;
  }

  function analyticsConfig(
    analytics?: boolean | DocsAnalyticsConfig,
  ): boolean | DocsAnalyticsConfig {
    const selectedAnalytics = analytics ?? options.analytics;
    if (selectedAnalytics === false) return false;

    const userConfig = typeof selectedAnalytics === "object" ? selectedAnalytics : {};
    const userOnEvent = userConfig.onEvent;

    return {
      ...userConfig,
      cloud: false,
      console: userConfig.console ?? false,
      onEvent: async (event) => {
        if (userOnEvent) {
          await userOnEvent(event);
        }

        await trackEvent(event);
      },
    };
  }

  async function askAI(
    request: Request,
    askOptions: DocsCloudAskAIOptions = {},
  ): Promise<Response> {
    const config: DocsCloudAskAIConfig = {
      ...options.config,
      ...askOptions.config,
      ai: {
        enabled: true,
        provider: "docs-cloud",
        ...options.config?.ai,
        ...askOptions.config?.ai,
      },
      cloud: {
        ...options.config?.cloud,
        ...askOptions.config?.cloud,
        apiKey: {
          ...options.config?.cloud?.apiKey,
          ...askOptions.config?.cloud?.apiKey,
          env: apiKeyEnv(),
        },
      },
      analytics: analyticsConfig(askOptions.config?.analytics ?? options.config?.analytics),
    };

    return createDocsCloudAskAIResponse(request, {
      ...askOptions,
      config,
      env: askAIEnv(askOptions.env),
      fetch: askOptions.fetch ?? options.fetch,
      publicBaseUrl: askOptions.publicBaseUrl ?? publicBaseUrl(),
    });
  }

  function getPublicConfig(): DocsCloudPublicConfig {
    const id = projectId();
    const key = apiKey();

    return {
      ok: true,
      configured: {
        projectId: Boolean(id),
        apiKey: Boolean(key),
      },
      ...(id ? { projectId: id } : {}),
      apiBaseUrl: apiBaseUrl(),
      features: {
        analytics: options.analytics !== false,
        askAI: options.config?.ai?.enabled !== false,
      },
      ...(options.metadata ? { metadata: options.metadata } : {}),
    };
  }

  async function handleRequest(
    request: Request,
    routeOptions: DocsCloudRouteHandlerOptions = {},
  ): Promise<Response> {
    if (request.method === "GET") {
      return jsonResponse(getPublicConfig());
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, { status: 405 });
    }

    const body = await readJson(request);
    const action = resolveRouteAction(request, body);

    if (action === "ask-ai") {
      const locale = await resolveRouteValue(routeOptions.locale, request);
      const routePublicBaseUrl = await resolveRouteValue(routeOptions.publicBaseUrl, request);
      const aiRequest =
        isPlainObject(body) && typeof body.action === "string"
          ? createJsonRequest(request, askAIPayload(body))
          : request;

      return askAI(aiRequest, {
        locale,
        publicBaseUrl: routePublicBaseUrl,
      });
    }

    const event = resolveAnalyticsEvent(body);
    if (!event) {
      return jsonResponse(
        { error: "Invalid analytics event. Expected an object with a string type." },
        { status: 400 },
      );
    }

    const tracked = await trackEvent(event, { request });
    if (!tracked) {
      return jsonResponse({ error: "Docs Cloud project id is not configured." }, { status: 500 });
    }

    return jsonResponse({ ok: true, type: "analytics" });
  }

  return {
    analytics: {
      track: trackEvent,
    },
    trackEvent,
    askAI,
    handleRequest,
    getPublicConfig,
  };
}

export function createDocsCloudRouteHandler(
  docsCloud: DocsCloudServer,
  options: DocsCloudRouteHandlerOptions = {},
): DocsCloudRouteHandlers {
  return {
    GET(request) {
      return docsCloud.handleRequest(request, options);
    },
    POST(request) {
      return docsCloud.handleRequest(request, options);
    },
  };
}

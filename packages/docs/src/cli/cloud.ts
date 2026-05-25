import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import type { DocsCloudConfig, DocsConfig } from "../types.js";
import {
  extractNestedObjectLiteral,
  loadDocsConfigModule,
  loadProjectEnv,
  readNavTitle,
  readStringProperty,
  readTopLevelBooleanProperty,
  readTopLevelStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";
import { detectFramework, type Framework } from "./utils.js";

const DOCS_JSON_FILE = "docs.json";
const DOCS_CLOUD_SCHEMA_URL = "https://docs.farming-labs.dev/schema/docs.json";
const DOCS_CLOUD_DEFAULT_API_KEY_ENV = "DOCS_CLOUD_API_KEY";
const DEFAULT_DOCS_CLOUD_API_BASE_URL = "https://docs-app.farming-labs.dev";
const DEFAULT_PREVIEW_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_PREVIEW_POLL_INTERVAL_MS = 2000;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };
type JsonRecord = Record<string, JsonValue | undefined>;

type CloudAnalyticsConfig =
  | boolean
  | {
      enabled?: boolean;
      console?: boolean | "log" | "info" | "debug";
      includeInputs?: boolean;
    };

type ManagedDocsJson = {
  [key: string]: unknown;
  $schema?: string;
  version?: 1;
  docs?: {
    mode: "framework" | "frameworkless";
    runtime: Framework;
    root: string;
  };
  content?: {
    [key: string]: unknown;
    docsRoot?: string;
    apiReferenceRoot?: string;
  };
  site?: {
    [key: string]: unknown;
    name?: string;
    description?: string;
  };
  cloud?: DocsCloudConfig;
};

export interface CloudCommandOptions {
  configPath?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  json?: boolean;
  rootDir?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface MaterializeCloudConfigResult {
  configPath: string;
  docsJsonPath: string;
  config: ManagedDocsJson;
  apiKeyEnv: string;
  created: boolean;
  updated: boolean;
}

interface DocsConfigSnapshot {
  path?: string;
  content?: string;
  config?: DocsConfig;
}

interface Spinner {
  update(message: string): void;
  succeed(message: string): void;
  fail(message: string): void;
  stop(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return isRecord(value);
}

function toJsonRecord(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function readPackageName(rootDir: string): string | undefined {
  const packagePath = path.join(rootDir, "package.json");
  if (!fs.existsSync(packagePath)) return undefined;

  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : undefined;
  } catch {
    return undefined;
  }
}

function titleFromPackageName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const normalized = name.replace(/^@[^/]+\//, "").replace(/[-_]+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

function tryResolveDocsConfigPath(rootDir: string, explicitPath?: string): string | undefined {
  if (explicitPath) return resolveDocsConfigPath(rootDir, explicitPath);

  try {
    return resolveDocsConfigPath(rootDir);
  } catch {
    return undefined;
  }
}

async function loadDocsConfigSnapshot(
  rootDir: string,
  explicitPath?: string,
): Promise<DocsConfigSnapshot> {
  const configPath = tryResolveDocsConfigPath(rootDir, explicitPath);
  if (!configPath) return {};

  const content = fs.readFileSync(configPath, "utf-8");
  const loaded = await loadDocsConfigModule(rootDir, configPath, { silent: true });

  return {
    path: configPath,
    content,
    config: loaded?.config,
  };
}

function readExistingDocsJson(docsJsonPath: string): ManagedDocsJson | undefined {
  if (!fs.existsSync(docsJsonPath)) return undefined;

  try {
    const parsed = JSON.parse(fs.readFileSync(docsJsonPath, "utf-8")) as unknown;
    if (!isJsonRecord(parsed)) {
      throw new Error(`${DOCS_JSON_FILE} must contain a JSON object.`);
    }
    return parsed as ManagedDocsJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${DOCS_JSON_FILE}: ${message}`);
  }
}

function normalizeApiKeyConfig(apiKey: DocsCloudConfig["apiKey"] | undefined): {
  env: string;
} {
  const env = apiKey?.env?.trim() || DOCS_CLOUD_DEFAULT_API_KEY_ENV;
  return { env };
}

function normalizePreviewConfig(preview: DocsCloudConfig["preview"] | undefined): {
  enabled: boolean;
} {
  return { enabled: preview?.enabled ?? true };
}

function normalizePublishConfig(publish: DocsCloudConfig["publish"] | undefined): {
  mode: "draft-pr" | "direct-commit";
  baseBranch: string;
} {
  return {
    mode: publish?.mode === "direct-commit" ? "direct-commit" : "draft-pr",
    baseBranch: publish?.baseBranch?.trim() || "main",
  };
}

function normalizeFeatureConfig(
  feature: DocsCloudConfig["ai"] | DocsCloudConfig["deploy"] | undefined,
): { enabled: boolean } | undefined {
  if (!feature) return undefined;
  return { enabled: feature.enabled ?? true };
}

function normalizeAnalyticsConfig(
  analytics: DocsCloudConfig["analytics"] | undefined,
): CloudAnalyticsConfig | undefined {
  if (typeof analytics === "undefined") return undefined;
  if (typeof analytics === "boolean") return analytics;

  return {
    enabled: analytics.enabled ?? true,
    ...(typeof analytics.console !== "undefined" ? { console: analytics.console } : {}),
    includeInputs: analytics.includeInputs ?? false,
  };
}

function normalizeCloudConfig(cloud: DocsCloudConfig | undefined): DocsCloudConfig {
  const normalized: DocsCloudConfig = {
    apiKey: normalizeApiKeyConfig(cloud?.apiKey),
    preview: normalizePreviewConfig(cloud?.preview),
    publish: normalizePublishConfig(cloud?.publish),
  };

  if (cloud?.enabled === false) {
    normalized.enabled = false;
  }

  const analytics = normalizeAnalyticsConfig(cloud?.analytics);
  if (typeof analytics !== "undefined") {
    normalized.analytics = analytics;
  }

  const ai = normalizeFeatureConfig(cloud?.ai);
  if (ai) normalized.ai = ai;

  const deploy = normalizeFeatureConfig(cloud?.deploy);
  if (deploy) normalized.deploy = deploy;

  return normalized;
}

function readStaticCloudConfig(content: string | undefined): DocsCloudConfig | undefined {
  if (!content || !extractNestedObjectLiteral(content, ["cloud"])) return undefined;

  const cloudBlock = extractNestedObjectLiteral(content, ["cloud"]);
  const apiKeyBlock = extractNestedObjectLiteral(content, ["cloud", "apiKey"]);
  const previewBlock = extractNestedObjectLiteral(content, ["cloud", "preview"]);
  const publishBlock = extractNestedObjectLiteral(content, ["cloud", "publish"]);
  const analyticsBlock = extractNestedObjectLiteral(content, ["cloud", "analytics"]);
  const aiBlock = extractNestedObjectLiteral(content, ["cloud", "ai"]);
  const deployBlock = extractNestedObjectLiteral(content, ["cloud", "deploy"]);

  const cloud: DocsCloudConfig = {};
  const enabled = cloudBlock ? readTopLevelBooleanProperty(cloudBlock, "enabled") : undefined;
  if (typeof enabled === "boolean") {
    cloud.enabled = enabled;
  }

  const apiKeyEnv = apiKeyBlock ? readStringProperty(apiKeyBlock, "env") : undefined;
  if (apiKeyEnv) {
    cloud.apiKey = { env: apiKeyEnv };
  }

  const previewEnabled = previewBlock
    ? readTopLevelBooleanProperty(previewBlock, "enabled")
    : undefined;
  if (typeof previewEnabled === "boolean") {
    cloud.preview = { enabled: previewEnabled };
  }

  const publishMode = publishBlock ? readStringProperty(publishBlock, "mode") : undefined;
  const baseBranch = publishBlock ? readStringProperty(publishBlock, "baseBranch") : undefined;
  if (publishMode || baseBranch) {
    cloud.publish = {
      ...(publishMode === "direct-commit" || publishMode === "draft-pr"
        ? { mode: publishMode }
        : {}),
      ...(baseBranch ? { baseBranch } : {}),
    };
  }

  const analyticsEnabled = cloudBlock
    ? readTopLevelBooleanProperty(cloudBlock, "analytics")
    : undefined;
  if (typeof analyticsEnabled === "boolean") {
    cloud.analytics = analyticsEnabled;
  } else if (analyticsBlock) {
    const analytics: Exclude<CloudAnalyticsConfig, boolean> = {};
    const enabledValue = readTopLevelBooleanProperty(analyticsBlock, "enabled");
    const consoleMode = readStringProperty(analyticsBlock, "console");
    const includeInputs = readTopLevelBooleanProperty(analyticsBlock, "includeInputs");
    if (typeof enabledValue === "boolean") analytics.enabled = enabledValue;
    if (consoleMode === "log" || consoleMode === "info" || consoleMode === "debug") {
      analytics.console = consoleMode;
    }
    if (typeof includeInputs === "boolean") analytics.includeInputs = includeInputs;
    cloud.analytics = analytics;
  }

  const aiEnabled = aiBlock ? readTopLevelBooleanProperty(aiBlock, "enabled") : undefined;
  if (typeof aiEnabled === "boolean") {
    cloud.ai = { enabled: aiEnabled };
  }

  const deployEnabled = deployBlock ? readTopLevelBooleanProperty(deployBlock, "enabled") : undefined;
  if (typeof deployEnabled === "boolean") {
    cloud.deploy = { enabled: deployEnabled };
  }

  return cloud;
}

function resolveCloudConfig(snapshot: DocsConfigSnapshot, existing?: ManagedDocsJson): DocsCloudConfig {
  const moduleCloud = snapshot.config?.cloud;
  const staticCloud = readStaticCloudConfig(snapshot.content);
  const existingCloud = existing?.cloud;
  return normalizeCloudConfig(moduleCloud ?? staticCloud ?? existingCloud);
}

function resolveApiReferenceRoot(snapshot: DocsConfigSnapshot): string | undefined {
  const apiReference = snapshot.config?.apiReference;
  if (isRecord(apiReference) && typeof apiReference.path === "string" && apiReference.path.trim()) {
    return apiReference.path.trim();
  }

  const apiReferenceBlock = extractNestedObjectLiteral(snapshot.content ?? "", ["apiReference"]);
  if (!apiReferenceBlock) return undefined;
  return readStringProperty(apiReferenceBlock, "path");
}

function resolveSiteConfig(
  rootDir: string,
  snapshot: DocsConfigSnapshot,
  existing?: ManagedDocsJson,
): ManagedDocsJson["site"] | undefined {
  const existingSite = toJsonRecord(existing?.site);
  const navTitle =
    isRecord(snapshot.config?.nav) && typeof snapshot.config.nav.title === "string"
      ? snapshot.config.nav.title
      : readNavTitle(snapshot.content ?? "");
  const metadata = isRecord(snapshot.config?.metadata) ? snapshot.config.metadata : undefined;
  const metadataDescription =
    typeof metadata?.description === "string" && metadata.description.trim()
      ? metadata.description.trim()
      : undefined;
  const packageTitle = titleFromPackageName(readPackageName(rootDir));
  const name = navTitle?.trim() || existingSite?.name || packageTitle;
  const description = metadataDescription || existingSite?.description;

  if (!name && !description && !existingSite) return undefined;

  return {
    ...(existingSite ?? {}),
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof description === "string" ? { description } : {}),
  };
}

function resolveDocsRoot(
  rootDir: string,
  snapshot: DocsConfigSnapshot,
  existing?: ManagedDocsJson,
): string {
  const entry = snapshot.config?.entry ?? readTopLevelStringProperty(snapshot.content ?? "", "entry") ?? "docs";
  if (snapshot.config?.contentDir) return snapshot.config.contentDir;
  if (snapshot.content) return resolveDocsContentDir(rootDir, snapshot.content, entry);
  if (typeof existing?.content?.docsRoot === "string") return existing.content.docsRoot;
  return fs.existsSync(path.join(rootDir, "app", entry)) ? path.join("app", entry) : entry;
}

function resolveDocsBlock(
  rootDir: string,
  snapshot: DocsConfigSnapshot,
  existing?: ManagedDocsJson,
): ManagedDocsJson["docs"] {
  const detectedFramework = detectFramework(rootDir);
  const existingDocs = existing?.docs;
  const runtime = detectedFramework ?? existingDocs?.runtime ?? "nextjs";
  const hasFrameworkConfig = Boolean(snapshot.path || detectedFramework);

  if (!hasFrameworkConfig && existingDocs) {
    return existingDocs;
  }

  return {
    mode: "framework",
    runtime,
    root: existingDocs?.root || ".",
  };
}

function materializeDocsJsonObject(params: {
  rootDir: string;
  snapshot: DocsConfigSnapshot;
  existing?: ManagedDocsJson;
}): ManagedDocsJson {
  const cloud = resolveCloudConfig(params.snapshot, params.existing);
  const docsRoot = resolveDocsRoot(params.rootDir, params.snapshot, params.existing);
  const apiReferenceRoot = resolveApiReferenceRoot(params.snapshot);
  const existingContent = toJsonRecord(params.existing?.content);
  const site = resolveSiteConfig(params.rootDir, params.snapshot, params.existing);

  const content: ManagedDocsJson["content"] = {
    ...(existingContent ?? {}),
    docsRoot,
    ...(apiReferenceRoot ? { apiReferenceRoot } : {}),
  };

  return {
    ...(params.existing ?? {}),
    $schema: params.existing?.$schema ?? DOCS_CLOUD_SCHEMA_URL,
    version: 1,
    docs: resolveDocsBlock(params.rootDir, params.snapshot, params.existing),
    content,
    ...(site ? { site } : {}),
    cloud,
  };
}

export function serializeMaterializedDocsJson(config: ManagedDocsJson): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export async function materializeCloudConfig(
  options: CloudCommandOptions = {},
): Promise<MaterializeCloudConfigResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const docsJsonPath = path.join(rootDir, DOCS_JSON_FILE);
  const existing = readExistingDocsJson(docsJsonPath);
  const snapshot = await loadDocsConfigSnapshot(rootDir, options.configPath);
  const config = materializeDocsJsonObject({ rootDir, snapshot, existing });
  const serialized = serializeMaterializedDocsJson(config);
  const previous = existing ? fs.readFileSync(docsJsonPath, "utf-8") : undefined;
  const updated = previous !== serialized;

  if (updated) {
    fs.writeFileSync(docsJsonPath, serialized, "utf-8");
  }

  return {
    configPath: snapshot.path ?? docsJsonPath,
    docsJsonPath,
    config,
    apiKeyEnv: config.cloud?.apiKey?.env ?? DOCS_CLOUD_DEFAULT_API_KEY_ENV,
    created: !existing,
    updated,
  };
}

function resolveApiBaseUrl(options: CloudCommandOptions): string {
  const value =
    options.apiBaseUrl ??
    process.env.DOCS_CLOUD_API_URL ??
    process.env.NEXT_PUBLIC_DOCS_CLOUD_URL ??
    DEFAULT_DOCS_CLOUD_API_BASE_URL;
  return value.replace(/\/+$/, "");
}

function resolveApiKey(options: CloudCommandOptions, rootDir: string, envName: string): string {
  if (options.apiKey?.trim()) return options.apiKey.trim();

  const projectEnv = loadProjectEnv(rootDir);
  const env = {
    ...projectEnv,
    ...process.env,
  };
  const token = env[envName]?.trim();
  if (token) return token;

  throw new Error(
    `Missing Docs Cloud API key. Set ${envName} in your shell or .env.local, or configure cloud.apiKey.env in docs.config.ts.`,
  );
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function readResponseMessage(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    for (const key of ["error", "message", "detail"]) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return fallback;
}

async function fetchCloudJson(params: {
  url: string;
  apiKey: string;
  init?: RequestInit;
}): Promise<unknown> {
  const headers = new Headers(params.init?.headers);
  headers.set("authorization", `Bearer ${params.apiKey}`);
  headers.set("accept", "application/json");

  if (params.init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(params.url, {
    ...params.init,
    headers,
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    const requestPath = new URL(params.url).pathname;
    if (response.status === 404 && requestPath === "/api/cloud/preview") {
      throw new Error(
        "Docs Cloud preview API is not available on this cloud host yet. The API key was validated, but the host did not expose /api/cloud/preview.",
      );
    }

    const message = readResponseMessage(
      body,
      `Docs Cloud request failed with HTTP ${response.status}.`,
    );
    throw new Error(message);
  }

  return body;
}

function readPreviewUrl(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;

  const direct = body.url ?? body.previewUrl;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const preview = body.preview;
  if (isRecord(preview) && typeof preview.url === "string" && preview.url.trim()) {
    return preview.url.trim();
  }

  return undefined;
}

function readStatusUrl(body: unknown, apiBaseUrl: string): string | undefined {
  if (!isRecord(body)) return undefined;
  const statusUrl = body.statusUrl ?? body.pollUrl;
  if (typeof statusUrl !== "string" || !statusUrl.trim()) return undefined;
  return new URL(statusUrl, apiBaseUrl).toString();
}

function readPreviewStatus(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const status = body.status;
  return typeof status === "string" ? status : undefined;
}

async function requestPreview(params: {
  apiBaseUrl: string;
  apiKey: string;
  config: ManagedDocsJson;
  configPath: string;
  rootDir: string;
  spinner: Spinner;
  timeoutMs: number;
  pollIntervalMs: number;
}): Promise<{ url: string; response: unknown }> {
  const initial = await fetchCloudJson({
    url: `${params.apiBaseUrl}/api/cloud/preview`,
    apiKey: params.apiKey,
    init: {
      method: "POST",
      body: JSON.stringify({
        config: params.config,
        configPath: path.relative(params.rootDir, params.configPath) || DOCS_JSON_FILE,
      }),
    },
  });

  const initialUrl = readPreviewUrl(initial);
  if (initialUrl) return { url: initialUrl, response: initial };

  const statusUrl = readStatusUrl(initial, params.apiBaseUrl);
  if (!statusUrl) {
    throw new Error(
      "Docs Cloud accepted the preview request but did not return a preview URL or status URL.",
    );
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < params.timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, params.pollIntervalMs));
    params.spinner.update("Waiting for Docs Cloud preview deployment");

    const statusBody = await fetchCloudJson({
      url: statusUrl,
      apiKey: params.apiKey,
    });
    const url = readPreviewUrl(statusBody);
    if (url) return { url, response: statusBody };

    const status = readPreviewStatus(statusBody);
    if (status === "failed" || status === "error") {
      throw new Error(readResponseMessage(statusBody, "Docs Cloud preview failed."));
    }
  }

  throw new Error("Docs Cloud preview timed out before a URL was ready.");
}

function createSpinner(initialMessage: string, options: { json?: boolean } = {}): Spinner {
  const interactive = Boolean(process.stdout.isTTY && !options.json && process.env.NODE_ENV !== "test");
  const frames = ["-", "\\", "|", "/"];
  let frame = 0;
  let message = initialMessage;
  let timer: ReturnType<typeof setInterval> | undefined;

  const render = () => {
    process.stdout.write(`\r${pc.cyan(frames[frame % frames.length])} ${message}`);
    frame += 1;
  };

  if (interactive) {
    render();
    timer = setInterval(render, 90);
  } else if (!options.json) {
    console.log(`${pc.dim("-")} ${initialMessage}`);
  }

  const clear = () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    if (interactive) {
      process.stdout.write("\r\x1b[K");
    }
  };

  return {
    update(nextMessage: string) {
      message = nextMessage;
      if (!interactive && !options.json) {
        console.log(`${pc.dim("-")} ${nextMessage}`);
      }
    },
    succeed(doneMessage: string) {
      clear();
      if (!options.json) console.log(`${pc.green("ok")} ${doneMessage}`);
    },
    fail(doneMessage: string) {
      clear();
      if (!options.json) console.log(`${pc.red("error")} ${doneMessage}`);
    },
    stop() {
      clear();
    },
  };
}

export async function syncCloudConfig(options: CloudCommandOptions = {}) {
  const result = await materializeCloudConfig(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const action = result.created ? "Created" : result.updated ? "Synced" : "Checked";
  console.log(`${pc.green("ok")} ${action} ${pc.cyan(path.relative(process.cwd(), result.docsJsonPath) || DOCS_JSON_FILE)}`);
  console.log(`${pc.dim("api key env")} ${result.apiKeyEnv}`);
  return result;
}

export async function runCloudPreview(options: CloudCommandOptions = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const spinner = createSpinner("Preparing Docs Cloud preview", options);

  try {
    const materialized = await materializeCloudConfig({ ...options, rootDir });
    spinner.update(`${materialized.created ? "Created" : "Synced"} ${DOCS_JSON_FILE}`);

    if (materialized.config.cloud?.enabled === false) {
      throw new Error(
        "Docs Cloud is disabled in cloud.enabled. Remove that override or set cloud.enabled: true before requesting a preview.",
      );
    }

    if (materialized.config.cloud?.preview?.enabled === false) {
      throw new Error(
        "Docs Cloud preview is disabled in cloud.preview.enabled. Set it to true before requesting a preview.",
      );
    }

    const apiKey = resolveApiKey(options, rootDir, materialized.apiKeyEnv);
    const apiBaseUrl = resolveApiBaseUrl(options);

    spinner.update("Validating Docs Cloud API key");
    const identity = await fetchCloudJson({
      url: `${apiBaseUrl}/api/cloud/me`,
      apiKey,
    });

    spinner.update("Requesting Docs Cloud preview deployment");
    const preview = await requestPreview({
      apiBaseUrl,
      apiKey,
      config: materialized.config,
      configPath: materialized.docsJsonPath,
      rootDir,
      spinner,
      timeoutMs: options.timeoutMs ?? DEFAULT_PREVIEW_TIMEOUT_MS,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_PREVIEW_POLL_INTERVAL_MS,
    });

    spinner.succeed("Docs Cloud preview is ready");

    const result = {
      url: preview.url,
      docsJsonPath: materialized.docsJsonPath,
      apiBaseUrl,
      identity,
      response: preview.response,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${pc.bold("Preview")} ${pc.cyan(preview.url)}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(message);
    throw error;
  } finally {
    spinner.stop();
  }
}

export function printCloudHelp() {
  console.log(`
${pc.bold("@farming-labs/docs cloud")}

${pc.dim("Usage:")}
  ${pc.cyan("docs preview")}              Sync ${pc.dim("docs.config.ts")} to ${pc.dim("docs.json")} and request a cloud preview
  ${pc.cyan("docs cloud preview")}        Same as ${pc.cyan("docs preview")}
  ${pc.cyan("docs cloud sync")}           Only materialize cloud settings into ${pc.dim("docs.json")}

${pc.dim("Options:")}
  ${pc.cyan("--config <path>")}           Use a custom docs config path
  ${pc.cyan("--api-base-url <url>")}      Override Docs Cloud API base URL
  ${pc.cyan("--api-key <key>")}           Use an API key directly; prefer ${pc.dim("cloud.apiKey.env")}
  ${pc.cyan("--json")}                    Print machine-readable output

${pc.dim("Config example:")}
  cloud: {
    apiKey: { env: "DOCS_CLOUD_API_KEY" },
    preview: { enabled: true },
    publish: { mode: "draft-pr", baseBranch: "main" },
  }
`);
}

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
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
import { markCliErrorReported } from "./errors.js";
import { detectFramework, detectPackageManagerFromProject, type Framework } from "./utils.js";

const DOCS_JSON_FILE = "docs.json";
const DOCS_CLOUD_SCHEMA_URL = "https://docs.farming-labs.dev/schema/docs.json";
const DOCS_CLOUD_DEFAULT_API_KEY_ENV = "DOCS_CLOUD_API_KEY";
const DOCS_CLOUD_DEFAULT_ANALYTICS_PROJECT_ID_ENV = "PUBLIC_DOCS_CLOUD_PROJECT_ID";
const DOCS_CLOUD_MISSING_API_KEY_DOCS_URL =
  "https://docs.farming-labs.dev/docs/cloud/deploy#missing-api-key";
const DEFAULT_DOCS_CLOUD_API_BASE_URL = "https://api.farming-labs.dev";
const DEFAULT_PREVIEW_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_PREVIEW_POLL_INTERVAL_MS = 2000;
const REQUIRED_PREVIEW_API_KEY_SCOPES = ["project:read", "preview:write", "jobs:read"] as const;
const DOCS_CLOUD_PROJECT_ID_ENVS = [
  "PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "DOCS_CLOUD_PROJECT_ID",
] as const;
const DEFAULT_PUBLIC_DOCS_CLOUD_API_KEY_ENV = "PUBLIC_DOCS_CLOUD_API_KEY";
const CLOUD_CHECK_TARGETS = ["deploy", "analytics", "ask-ai"] as const;
const FUMADOCS_CONNECT_MARKER = "@farming-labs/docs cloud connect: fumadocs";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };
type JsonRecord = Record<string, JsonValue | undefined>;
type ApiBaseUrlResolution = {
  url: string;
  source: "flag" | "env" | "default";
  env?: string;
};

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
  extensions?: JsonRecord;
};

type GitRepositoryMetadata = {
  owner: string;
  name: string;
  branch?: string;
  rootDirectory: string;
  remoteUrl?: string;
};

export type ConnectedDocsProfile = {
  engine: "fumadocs";
  runtime: Framework;
  appRoot: string;
  contentRoots: string[];
  configFiles: string[];
  packageManager?: string;
  confidence: "high" | "medium";
  reason: string;
};

export interface CloudCommandOptions {
  configPath?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  json?: boolean;
  network?: boolean;
  checkTargets?: CloudCheckTarget[];
  rootDir?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  docsInfraProfile?: ConnectedDocsProfile;
}

export interface CloudInitResult {
  configPath: string;
  docsJsonPath: string;
  apiKeyEnv: string;
  analyticsProjectIdEnv: string;
  configCreated: boolean;
  configUpdated: boolean;
  docsJsonCreated: boolean;
  docsJsonUpdated: boolean;
  docsInfraProfile?: ConnectedDocsProfile;
}

export interface MaterializeCloudConfigResult {
  configPath: string;
  docsJsonPath: string;
  config: ManagedDocsJson;
  apiKeyEnv: string;
  created: boolean;
  updated: boolean;
}

export type CloudCheckStatus = "pass" | "warn" | "fail";
export type CloudCheckTarget = "deploy" | "analytics" | "ask-ai";

export interface CloudCheckItem {
  name: string;
  status: CloudCheckStatus;
  message: string;
  details?: JsonRecord;
}

export interface CloudCheckResult {
  ok: boolean;
  apiBaseUrl: string;
  configPath: string;
  docsJsonPath: string;
  apiKeyEnv: string;
  analyticsProjectIdEnv?: string;
  network: boolean;
  targets: CloudCheckTarget[];
  checks: CloudCheckItem[];
  identity?: JsonRecord;
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

function readPackageJsonRecord(rootDir: string): Record<string, unknown> | undefined {
  const packagePath = path.join(rootDir, "package.json");
  if (!fs.existsSync(packagePath)) return undefined;

  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readPackageDependencies(rootDir: string): Set<string> {
  const packageJson = readPackageJsonRecord(rootDir);
  const names = new Set<string>();

  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const dependencies = packageJson?.[key];
    if (!isRecord(dependencies)) continue;

    for (const name of Object.keys(dependencies)) {
      names.add(name);
    }
  }

  return names;
}

function hasFumadocsDependency(dependencies: Set<string>): boolean {
  return [...dependencies].some(
    (name) =>
      name === "fumadocs-core" ||
      name === "fumadocs-ui" ||
      name === "fumadocs-mdx" ||
      name === "fumadocs-openapi" ||
      name === "fumadocs-docgen",
  );
}

function firstExistingFile(rootDir: string, candidates: string[]): string | undefined {
  return candidates.find((candidate) => fs.existsSync(path.join(rootDir, candidate)));
}

function hasMarkdownDescendant(rootDir: string, relativeDir: string): boolean {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) return false;

  const queue = [absoluteDir];
  while (queue.length > 0) {
    const current = queue.shift()!;
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && /\.(?:md|mdx)$/i.test(entry.name)) {
        return true;
      }
    }
  }

  return false;
}

function detectFumadocsContentRoots(rootDir: string): string[] {
  const candidates = ["content/docs", "src/content/docs", "docs", "content"];
  const roots = candidates.filter((candidate) => hasMarkdownDescendant(rootDir, candidate));
  return roots.filter(
    (root) => !roots.some((other) => other !== root && other.startsWith(`${root}/`)),
  );
}

function detectConnectedFumadocsProfile(rootDir: string): ConnectedDocsProfile | undefined {
  const dependencies = readPackageDependencies(rootDir);
  const sourceConfig = firstExistingFile(rootDir, [
    "source.config.ts",
    "source.config.tsx",
    "source.config.js",
    "source.config.mjs",
    "source.config.cjs",
  ]);
  const sourceFile = firstExistingFile(rootDir, [
    "lib/source.ts",
    "lib/source.tsx",
    "src/lib/source.ts",
    "src/lib/source.tsx",
  ]);
  const contentRoots = detectFumadocsContentRoots(rootDir);
  const hasFumadocsSignal =
    hasFumadocsDependency(dependencies) || Boolean(sourceConfig) || Boolean(sourceFile);

  if (!hasFumadocsSignal || contentRoots.length === 0) {
    return undefined;
  }

  const framework = detectFramework(rootDir) ?? "nextjs";
  const configFiles = [sourceConfig, sourceFile].filter((file): file is string => Boolean(file));
  const packageManager = detectPackageManagerFromProject(rootDir)?.packageManager;

  return {
    engine: "fumadocs",
    runtime: framework,
    appRoot: ".",
    contentRoots,
    configFiles,
    ...(packageManager ? { packageManager } : {}),
    confidence: sourceConfig || sourceFile ? "high" : "medium",
    reason: sourceConfig
      ? `Detected Fumadocs source config at ${sourceConfig}.`
      : "Detected Fumadocs dependencies and markdown content.",
  };
}

function runGit(rootDir: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", ["-C", rootDir, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function parseGitHubRemote(remoteUrl: string): { owner: string; name: string } | null {
  const trimmed = remoteUrl.trim();
  const match =
    trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/) ??
    trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?(?:\/)?$/);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    owner: match[1],
    name: match[2].replace(/\.git$/i, ""),
  };
}

function resolveGitRepositoryMetadata(rootDir: string): GitRepositoryMetadata | undefined {
  const gitRoot = runGit(rootDir, ["rev-parse", "--show-toplevel"]);
  const remoteUrl = runGit(rootDir, ["remote", "get-url", "origin"]);
  if (!gitRoot || !remoteUrl) {
    return undefined;
  }

  const parsedRemote = parseGitHubRemote(remoteUrl);
  if (!parsedRemote) {
    return undefined;
  }

  const branch =
    runGit(rootDir, ["branch", "--show-current"]) ??
    runGit(rootDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const resolvedGitRoot = fs.realpathSync(gitRoot);
  const resolvedRootDir = fs.realpathSync(rootDir);
  const rootDirectory = path
    .relative(resolvedGitRoot, resolvedRootDir)
    .split(path.sep)
    .filter(Boolean)
    .join("/");

  return {
    ...parsedRemote,
    branch: branch && branch !== "HEAD" ? branch : undefined,
    rootDirectory: rootDirectory || ".",
    remoteUrl,
  };
}

function titleFromPackageName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const normalized = name
    .replace(/^@[^/]+\//, "")
    .replace(/[-_]+/g, " ")
    .trim();
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBalancedBraceEnd(content: string, braceStart: number): number {
  let depth = 0;
  let stringQuote: '"' | "'" | "`" | null = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = braceStart; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (stringQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") continue;

    depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

interface ObjectRange {
  braceStart: number;
  braceEnd: number;
  bodyStart: number;
  bodyEnd: number;
}

interface PropertyRange {
  start: number;
  end: number;
}

function findConfigObjectRange(content: string): ObjectRange | undefined {
  for (const marker of ["defineDocs(", "export default"]) {
    const markerIndex = content.indexOf(marker);
    if (markerIndex === -1) continue;

    const braceStart = content.indexOf("{", markerIndex);
    if (braceStart === -1) continue;

    const braceEnd = findBalancedBraceEnd(content, braceStart);
    if (braceEnd === -1) continue;

    return {
      braceStart,
      braceEnd,
      bodyStart: braceStart + 1,
      bodyEnd: braceEnd,
    };
  }

  return undefined;
}

function stripLeadingPropertyTrivia(content: string): string {
  let current = content;

  while (true) {
    const trimmed = current.replace(/^\s+/, "");

    if (trimmed.startsWith("//")) {
      const lineEnd = trimmed.indexOf("\n");
      current = lineEnd === -1 ? "" : trimmed.slice(lineEnd + 1);
      continue;
    }

    if (trimmed.startsWith("/*")) {
      const blockEnd = trimmed.indexOf("*/");
      current = blockEnd === -1 ? "" : trimmed.slice(blockEnd + 2);
      continue;
    }

    return trimmed;
  }
}

function propertyStartsWithKey(property: string, key: string): boolean {
  return new RegExp(`^${escapeRegExp(key)}\\s*:`).test(stripLeadingPropertyTrivia(property));
}

function findTopLevelPropertyRange(
  content: string,
  bodyStart: number,
  bodyEnd: number,
  key: string,
): PropertyRange | undefined {
  let start = bodyStart;
  let stringQuote: '"' | "'" | "`" | null = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  const maybeMatch = (end: number): PropertyRange | undefined => {
    const property = content.slice(start, end);
    if (!propertyStartsWithKey(property, key)) return undefined;
    return { start, end };
  };

  for (let index = bodyStart; index <= bodyEnd; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (index === bodyEnd) {
      return maybeMatch(index);
    }

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (stringQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }

    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (char !== "," || braceDepth !== 0 || bracketDepth !== 0 || parenDepth !== 0) {
      continue;
    }

    const match = maybeMatch(index);
    if (match) return match;
    start = index + 1;
  }

  return undefined;
}

function findObjectPropertyRange(
  content: string,
  object: ObjectRange,
  key: string,
): ObjectRange | undefined {
  const property = findTopLevelPropertyRange(content, object.bodyStart, object.bodyEnd, key);
  if (!property) return undefined;

  const colon = content.indexOf(":", property.start);
  const braceStart = content.indexOf("{", colon);
  if (colon === -1 || braceStart === -1 || braceStart > property.end) return undefined;

  const braceEnd = findBalancedBraceEnd(content, braceStart);
  if (braceEnd === -1 || braceEnd > property.end) return undefined;

  return {
    braceStart,
    braceEnd,
    bodyStart: braceStart + 1,
    bodyEnd: braceEnd,
  };
}

function lineIndentAt(content: string, index: number): string {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  return content.slice(lineStart, index).match(/^\s*/)?.[0] ?? "";
}

function insertObjectProperties(
  content: string,
  object: ObjectRange,
  properties: string[],
): string {
  if (properties.length === 0) return content;

  const body = content.slice(object.bodyStart, object.bodyEnd);
  const closingIndent = lineIndentAt(content, object.braceEnd);
  const beforeObjectClose = content.slice(0, object.bodyEnd).replace(/\s*$/, "");
  const suffix = content.slice(object.bodyEnd);
  const needsComma = body.trim().length > 0 && !beforeObjectClose.endsWith(",");

  return `${beforeObjectClose}${needsComma ? "," : ""}\n${properties.join("\n")}\n${closingIndent}${suffix}`;
}

function renderAnalyticsConfigProperty(indent: string): string {
  return `${indent}analytics: {
${indent}  enabled: true,
${indent}  console: false,
${indent}  includeInputs: false,
${indent}},`;
}

function renderCloudConfigProperty(indent: string, apiKeyEnv: string): string {
  return `${indent}cloud: {
${indent}  apiKey: { env: ${JSON.stringify(apiKeyEnv)} },
${indent}  deploy: { enabled: true },
${indent}  analytics: {
${indent}    enabled: true,
${indent}    console: false,
${indent}    includeInputs: false,
${indent}  },
${indent}  publish: { mode: "draft-pr", baseBranch: "main" },
${indent}},`;
}

function renderCloudInitDocsConfig(apiKeyEnv: string): string {
  return `import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
${renderAnalyticsConfigProperty("  ")}
${renderCloudConfigProperty("  ", apiKeyEnv)}
});
`;
}

function renderFumadocsConnectDocsConfig(apiKeyEnv: string, profile: ConnectedDocsProfile): string {
  const contentDir = profile.contentRoots[0] ?? "content/docs";

  return `// ${FUMADOCS_CONNECT_MARKER}
import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
  contentDir: ${JSON.stringify(contentDir)},
${renderAnalyticsConfigProperty("  ")}
${renderCloudConfigProperty("  ", apiKeyEnv)}
});
`;
}

function normalizeEnvName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) return fallback;

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error(`Invalid environment variable name: ${normalized}`);
  }

  return normalized;
}

function ensureDocsConfigCloudInit(options: {
  rootDir: string;
  configPath?: string;
  apiKeyEnv: string;
  docsInfraProfile?: ConnectedDocsProfile;
}): { configPath: string; created: boolean; updated: boolean } {
  const resolvedConfigPath = tryResolveDocsConfigPath(options.rootDir, options.configPath);
  const configPath = resolvedConfigPath ?? path.join(options.rootDir, "docs.config.ts");

  if (!resolvedConfigPath) {
    fs.writeFileSync(
      configPath,
      options.docsInfraProfile
        ? renderFumadocsConnectDocsConfig(options.apiKeyEnv, options.docsInfraProfile)
        : renderCloudInitDocsConfig(options.apiKeyEnv),
      "utf-8",
    );
    return { configPath, created: true, updated: true };
  }

  const original = fs.readFileSync(configPath, "utf-8");
  let content = original;
  let configObject = findConfigObjectRange(content);
  if (!configObject) {
    throw new Error(
      `Could not find an object export in ${path.relative(options.rootDir, configPath)}. Use defineDocs({ ... }) or export default { ... } before running cloud init.`,
    );
  }

  const topLevelIndent = `${lineIndentAt(content, configObject.braceEnd)}  `;
  const cloudProperty = findTopLevelPropertyRange(
    content,
    configObject.bodyStart,
    configObject.bodyEnd,
    "cloud",
  );
  let cloudObject = findObjectPropertyRange(content, configObject, "cloud");

  if (!cloudProperty) {
    content = insertObjectProperties(content, configObject, [
      renderCloudConfigProperty(topLevelIndent, options.apiKeyEnv),
    ]);
  } else if (!cloudObject) {
    throw new Error(
      `Could not update cloud config in ${path.relative(options.rootDir, configPath)} because cloud is not an object literal.`,
    );
  }

  configObject = findConfigObjectRange(content);
  if (!configObject) {
    throw new Error(`Could not re-read ${path.relative(options.rootDir, configPath)}.`);
  }

  cloudObject = findObjectPropertyRange(content, configObject, "cloud");
  if (cloudObject) {
    const cloudIndent = `${lineIndentAt(content, cloudObject.braceEnd)}  `;
    const missingCloudProperties: string[] = [];

    if (!findTopLevelPropertyRange(content, cloudObject.bodyStart, cloudObject.bodyEnd, "apiKey")) {
      missingCloudProperties.push(
        `${cloudIndent}apiKey: { env: ${JSON.stringify(options.apiKeyEnv)} },`,
      );
    } else {
      const apiKeyObject = findObjectPropertyRange(content, cloudObject, "apiKey");
      if (
        apiKeyObject &&
        !findTopLevelPropertyRange(content, apiKeyObject.bodyStart, apiKeyObject.bodyEnd, "env")
      ) {
        content = insertObjectProperties(content, apiKeyObject, [
          `${lineIndentAt(content, apiKeyObject.braceEnd)}  env: ${JSON.stringify(options.apiKeyEnv)},`,
        ]);
        configObject = findConfigObjectRange(content)!;
        cloudObject = findObjectPropertyRange(content, configObject, "cloud")!;
      }
    }

    if (!findTopLevelPropertyRange(content, cloudObject.bodyStart, cloudObject.bodyEnd, "deploy")) {
      missingCloudProperties.push(`${cloudIndent}deploy: { enabled: true },`);
    }

    if (
      !findTopLevelPropertyRange(content, cloudObject.bodyStart, cloudObject.bodyEnd, "analytics")
    ) {
      missingCloudProperties.push(renderAnalyticsConfigProperty(cloudIndent));
    }

    if (
      !findTopLevelPropertyRange(content, cloudObject.bodyStart, cloudObject.bodyEnd, "publish")
    ) {
      missingCloudProperties.push(
        `${cloudIndent}publish: { mode: "draft-pr", baseBranch: "main" },`,
      );
    }

    content = insertObjectProperties(content, cloudObject, missingCloudProperties);
  }

  configObject = findConfigObjectRange(content);
  if (!configObject) {
    throw new Error(`Could not re-read ${path.relative(options.rootDir, configPath)}.`);
  }

  if (
    !findTopLevelPropertyRange(content, configObject.bodyStart, configObject.bodyEnd, "analytics")
  ) {
    content = insertObjectProperties(content, configObject, [
      renderAnalyticsConfigProperty(`${lineIndentAt(content, configObject.braceEnd)}  `),
    ]);
  }

  if (content !== original) {
    fs.writeFileSync(configPath, content, "utf-8");
  }

  return { configPath, created: false, updated: content !== original };
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

  if (cloud?.preview) {
    normalized.preview = normalizePreviewConfig(cloud.preview);
  }

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
    const consoleBoolean = readTopLevelBooleanProperty(analyticsBlock, "console");
    const consoleMode = readStringProperty(analyticsBlock, "console");
    const includeInputs = readTopLevelBooleanProperty(analyticsBlock, "includeInputs");
    if (typeof enabledValue === "boolean") analytics.enabled = enabledValue;
    if (typeof consoleBoolean === "boolean") {
      analytics.console = consoleBoolean;
    } else if (consoleMode === "log" || consoleMode === "info" || consoleMode === "debug") {
      analytics.console = consoleMode;
    }
    if (typeof includeInputs === "boolean") analytics.includeInputs = includeInputs;
    cloud.analytics = analytics;
  }

  const aiEnabled = aiBlock ? readTopLevelBooleanProperty(aiBlock, "enabled") : undefined;
  if (typeof aiEnabled === "boolean") {
    cloud.ai = { enabled: aiEnabled };
  }

  const deployEnabled = deployBlock
    ? readTopLevelBooleanProperty(deployBlock, "enabled")
    : undefined;
  if (typeof deployEnabled === "boolean") {
    cloud.deploy = { enabled: deployEnabled };
  }

  return cloud;
}

function resolveCloudConfig(
  snapshot: DocsConfigSnapshot,
  existing?: ManagedDocsJson,
): DocsCloudConfig {
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

function resolveConnectedDocsProfile(params: {
  rootDir: string;
  snapshot: DocsConfigSnapshot;
  existing?: ManagedDocsJson;
  explicit?: ConnectedDocsProfile;
}): ConnectedDocsProfile | undefined {
  if (params.explicit) return params.explicit;

  const shouldResolveConnectProfile =
    params.snapshot.content?.includes(FUMADOCS_CONNECT_MARKER) || !params.snapshot.path;
  if (!shouldResolveConnectProfile) return undefined;

  const detectedProfile = detectConnectedFumadocsProfile(params.rootDir);
  if (detectedProfile) return detectedProfile;

  const existingProfile = params.existing?.extensions?.docsInfraProfile;
  if (
    isRecord(existingProfile) &&
    existingProfile.engine === "fumadocs" &&
    Array.isArray(existingProfile.contentRoots)
  ) {
    return existingProfile as ConnectedDocsProfile;
  }

  return undefined;
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
    ...existingSite,
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof description === "string" ? { description } : {}),
  };
}

function resolveDocsRoot(
  rootDir: string,
  snapshot: DocsConfigSnapshot,
  existing?: ManagedDocsJson,
  docsInfraProfile?: ConnectedDocsProfile,
): string {
  if (docsInfraProfile?.contentRoots[0]) return docsInfraProfile.contentRoots[0];

  const entry =
    snapshot.config?.entry ?? readTopLevelStringProperty(snapshot.content ?? "", "entry") ?? "docs";
  if (snapshot.config?.contentDir) return snapshot.config.contentDir;
  if (snapshot.content) return resolveDocsContentDir(rootDir, snapshot.content, entry);
  if (typeof existing?.content?.docsRoot === "string") return existing.content.docsRoot;
  return fs.existsSync(path.join(rootDir, "app", entry)) ? path.join("app", entry) : entry;
}

function resolveDocsBlock(
  rootDir: string,
  snapshot: DocsConfigSnapshot,
  existing?: ManagedDocsJson,
  docsInfraProfile?: ConnectedDocsProfile,
): ManagedDocsJson["docs"] {
  const existingDocs = existing?.docs;
  if (!snapshot.path && existingDocs) {
    return existingDocs;
  }

  const detectedFramework = detectFramework(rootDir);
  const runtime =
    detectedFramework ?? docsInfraProfile?.runtime ?? existingDocs?.runtime ?? "nextjs";
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

function resolveExtensions(
  existing: ManagedDocsJson | undefined,
  docsInfraProfile: ConnectedDocsProfile | undefined,
): JsonRecord | undefined {
  const existingExtensions = toJsonRecord(existing?.extensions);
  if (!docsInfraProfile) {
    if (!existingExtensions?.docsInfraProfile) return existingExtensions;

    const { docsInfraProfile: _staleDocsInfraProfile, ...rest } = existingExtensions;
    return Object.keys(rest).length > 0 ? rest : undefined;
  }

  return {
    ...existingExtensions,
    docsInfraProfile: toJsonRecord(docsInfraProfile),
  };
}

function materializeDocsJsonObject(params: {
  rootDir: string;
  snapshot: DocsConfigSnapshot;
  existing?: ManagedDocsJson;
  docsInfraProfile?: ConnectedDocsProfile;
}): ManagedDocsJson {
  const cloud = resolveCloudConfig(params.snapshot, params.existing);
  const docsInfraProfile = resolveConnectedDocsProfile({
    rootDir: params.rootDir,
    snapshot: params.snapshot,
    existing: params.existing,
    explicit: params.docsInfraProfile,
  });
  const docsRoot = resolveDocsRoot(
    params.rootDir,
    params.snapshot,
    params.existing,
    docsInfraProfile,
  );
  const apiReferenceRoot = resolveApiReferenceRoot(params.snapshot);
  const existingContent = toJsonRecord(params.existing?.content);
  const site = resolveSiteConfig(params.rootDir, params.snapshot, params.existing);
  const extensions = resolveExtensions(params.existing, docsInfraProfile);

  const content: ManagedDocsJson["content"] = {
    ...existingContent,
    docsRoot,
    ...(apiReferenceRoot ? { apiReferenceRoot } : {}),
  };

  return {
    ...params.existing,
    $schema: params.existing?.$schema ?? DOCS_CLOUD_SCHEMA_URL,
    version: 1,
    docs: resolveDocsBlock(params.rootDir, params.snapshot, params.existing, docsInfraProfile),
    content,
    ...(site ? { site } : {}),
    cloud,
    ...(extensions ? { extensions } : {}),
  };
}

export function serializeMaterializedDocsJson(config: ManagedDocsJson): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function withCloudInitDefaults(
  cloud: DocsCloudConfig | undefined,
  existingCloud: DocsCloudConfig | undefined,
  apiKeyEnv: string,
): DocsCloudConfig {
  const normalized = normalizeCloudConfig(cloud);

  if (!existingCloud?.apiKey?.env) {
    normalized.apiKey = { env: apiKeyEnv };
  }

  if (!normalized.deploy) {
    normalized.deploy = { enabled: true };
  }

  if (typeof normalized.analytics === "undefined") {
    normalized.analytics = {
      enabled: true,
      console: false,
      includeInputs: false,
    };
  }

  return normalizeCloudConfig(normalized);
}

function writeMaterializedCloudConfig(params: {
  rootDir: string;
  docsJsonPath: string;
  existing?: ManagedDocsJson;
  snapshot: DocsConfigSnapshot;
  docsInfraProfile?: ConnectedDocsProfile;
  cloudInitApiKeyEnv?: string;
}): MaterializeCloudConfigResult {
  const config = materializeDocsJsonObject({
    rootDir: params.rootDir,
    snapshot: params.snapshot,
    existing: params.existing,
    docsInfraProfile: params.docsInfraProfile,
  });

  if (params.cloudInitApiKeyEnv) {
    config.cloud = withCloudInitDefaults(
      config.cloud,
      params.existing?.cloud,
      params.cloudInitApiKeyEnv,
    );
  }

  const serialized = serializeMaterializedDocsJson(config);
  const previous = params.existing ? fs.readFileSync(params.docsJsonPath, "utf-8") : undefined;
  const updated = previous !== serialized;

  if (updated) {
    fs.writeFileSync(params.docsJsonPath, serialized, "utf-8");
  }

  return {
    configPath: params.snapshot.path ?? params.docsJsonPath,
    docsJsonPath: params.docsJsonPath,
    config,
    apiKeyEnv: config.cloud?.apiKey?.env ?? DOCS_CLOUD_DEFAULT_API_KEY_ENV,
    created: !params.existing,
    updated,
  };
}

export async function materializeCloudConfig(
  options: CloudCommandOptions = {},
): Promise<MaterializeCloudConfigResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const docsJsonPath = path.join(rootDir, DOCS_JSON_FILE);
  const existing = readExistingDocsJson(docsJsonPath);
  const snapshot = await loadDocsConfigSnapshot(rootDir, options.configPath);
  return writeMaterializedCloudConfig({
    rootDir,
    docsJsonPath,
    existing,
    snapshot,
    docsInfraProfile: options.docsInfraProfile,
  });
}

function readCombinedEnv(rootDir: string): Record<string, string> {
  const env: Record<string, string> = {
    ...loadProjectEnv(rootDir),
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }

  return env;
}

function readEnvValue(env: Record<string, string>, name: string | undefined): string | undefined {
  if (!name) return undefined;
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function readFirstEnv(
  env: Record<string, string>,
  names: readonly string[],
): { name: string; value: string } | undefined {
  for (const name of names) {
    const value = readEnvValue(env, name);
    if (value) return { name, value };
  }
  return undefined;
}

function readConfiguredCloudApiKeyEnv(snapshot: DocsConfigSnapshot): string | undefined {
  const moduleEnv = snapshot.config?.cloud?.apiKey?.env?.trim();
  if (moduleEnv) return moduleEnv;

  const apiKeyBlock = extractNestedObjectLiteral(snapshot.content ?? "", ["cloud", "apiKey"]);
  const staticEnv = apiKeyBlock ? readStringProperty(apiKeyBlock, "env") : undefined;
  return staticEnv?.trim() || undefined;
}

function readAiProvider(snapshot: DocsConfigSnapshot): string | undefined {
  const moduleProvider = (snapshot.config?.ai as { provider?: unknown } | undefined)?.provider;
  if (typeof moduleProvider === "string" && moduleProvider.trim()) return moduleProvider.trim();

  const aiBlock = extractNestedObjectLiteral(snapshot.content ?? "", ["ai"]);
  const staticProvider = aiBlock ? readStringProperty(aiBlock, "provider") : undefined;
  return staticProvider?.trim() || undefined;
}

function readRuntimeAnalyticsDisabled(snapshot: DocsConfigSnapshot): boolean {
  const moduleAnalytics = snapshot.config?.analytics;
  if (moduleAnalytics === false) return true;
  if (isRecord(moduleAnalytics) && moduleAnalytics.enabled === false) return true;

  const staticBoolean = readTopLevelBooleanProperty(snapshot.content ?? "", "analytics");
  if (staticBoolean === false) return true;

  const analyticsBlock = extractNestedObjectLiteral(snapshot.content ?? "", ["analytics"]);
  const staticEnabled = analyticsBlock
    ? readTopLevelBooleanProperty(analyticsBlock, "enabled")
    : undefined;
  return staticEnabled === false;
}

function isCloudAnalyticsEnabled(analytics: DocsCloudConfig["analytics"] | undefined): boolean {
  if (analytics === false) return false;
  if (isRecord(analytics) && analytics.enabled === false) return false;
  return typeof analytics !== "undefined";
}

function createCheck(
  name: string,
  status: CloudCheckStatus,
  message: string,
  details?: JsonRecord,
): CloudCheckItem {
  return {
    name,
    status,
    message,
    ...(details ? { details } : {}),
  };
}

function isBrowserSafeEnvName(name: string): boolean {
  return name.startsWith("PUBLIC_") || name.startsWith("NEXT_PUBLIC_");
}

function summarizeIdentity(identity: unknown): JsonRecord | undefined {
  if (!isRecord(identity)) return undefined;

  const workspace = isRecord(identity.workspace) ? identity.workspace : undefined;
  const apiKey = isRecord(identity.apiKey) ? identity.apiKey : undefined;
  const scopes = readApiKeyScopes(identity);

  return {
    ...(workspace
      ? {
          workspace: {
            ...(typeof workspace.id === "string" ? { id: workspace.id } : {}),
            ...(typeof workspace.name === "string" ? { name: workspace.name } : {}),
          },
        }
      : {}),
    ...(apiKey
      ? {
          apiKey: {
            ...(typeof apiKey.id === "string" ? { id: apiKey.id } : {}),
            ...(scopes.length > 0 ? { scopes } : {}),
          },
        }
      : {}),
  };
}

function formatCheckStatus(status: CloudCheckStatus): string {
  if (status === "pass") return pc.green("ok");
  if (status === "warn") return pc.yellow("warn");
  return pc.red("fail");
}

function countChecks(checks: CloudCheckItem[], status: CloudCheckStatus): number {
  return checks.filter((check) => check.status === status).length;
}

function resolveCloudCheckTargets(options: CloudCommandOptions): Set<CloudCheckTarget> {
  const targets = new Set(options.checkTargets);
  if (targets.size > 0) return targets;
  return new Set(CLOUD_CHECK_TARGETS);
}

function formatCloudCheckTargets(targets: readonly CloudCheckTarget[]): string {
  return targets.join(", ");
}

function resolveApiBaseUrl(
  options: CloudCommandOptions,
  rootDir: string = process.cwd(),
): ApiBaseUrlResolution {
  if (options.apiBaseUrl?.trim()) {
    return {
      url: options.apiBaseUrl.trim().replace(/\/+$/, ""),
      source: "flag",
    };
  }

  const projectEnv = loadProjectEnv(rootDir);
  for (const envName of [
    "DOCS_CLOUD_API_URL",
    "PUBLIC_DOCS_CLOUD_URL",
    "NEXT_PUBLIC_DOCS_CLOUD_URL",
  ] as const) {
    const value = process.env[envName]?.trim() ?? projectEnv[envName]?.trim();
    if (value) {
      return {
        url: value.replace(/\/+$/, ""),
        source: "env",
        env: envName,
      };
    }
  }

  return {
    url: DEFAULT_DOCS_CLOUD_API_BASE_URL,
    source: "default",
  };
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
    `Missing Docs Cloud API key. Set ${envName} in your shell or .env.local, or configure cloud.apiKey.env in docs.config.ts. See ${DOCS_CLOUD_MISSING_API_KEY_DOCS_URL}.`,
  );
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function readNestedString(value: unknown, pathSegments: readonly string[]): string | undefined {
  let current: unknown = value;
  for (const segment of pathSegments) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }

  return typeof current === "string" && current.trim() ? current.trim() : undefined;
}

function readDocsSiteOrigin(
  snapshot: DocsConfigSnapshot,
  env: Record<string, string>,
): { origin: string; source: string } | undefined {
  const envSite = readFirstEnv(env, [
    "PUBLIC_BASE_URL",
    "PUBLIC_SITE_URL",
    "NEXT_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_SITE_URL",
    "SITE_URL",
  ]);
  const sitemapBlock = extractNestedObjectLiteral(snapshot.content ?? "", ["sitemap"]);
  const llmsTxtBlock = extractNestedObjectLiteral(snapshot.content ?? "", ["llmsTxt"]);
  const robotsBlock = extractNestedObjectLiteral(snapshot.content ?? "", ["robots"]);
  const candidates: Array<{ value?: string; source: string }> = [
    { value: envSite?.value, source: envSite ? envSite.name : "env" },
    { value: readNestedString(snapshot.config, ["site", "url"]), source: "site.url" },
    { value: readNestedString(snapshot.config, ["sitemap", "baseUrl"]), source: "sitemap.baseUrl" },
    { value: readNestedString(snapshot.config, ["llmsTxt", "baseUrl"]), source: "llmsTxt.baseUrl" },
    { value: readNestedString(snapshot.config, ["robots", "baseUrl"]), source: "robots.baseUrl" },
    {
      value: sitemapBlock ? readStringProperty(sitemapBlock, "baseUrl") : undefined,
      source: "sitemap.baseUrl",
    },
    {
      value: llmsTxtBlock ? readStringProperty(llmsTxtBlock, "baseUrl") : undefined,
      source: "llmsTxt.baseUrl",
    },
    {
      value: robotsBlock ? readStringProperty(robotsBlock, "baseUrl") : undefined,
      source: "robots.baseUrl",
    },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;

    try {
      return {
        origin: new URL(candidate.value).origin,
        source: candidate.source,
      };
    } catch {
      // Keep looking for a valid absolute URL.
    }
  }

  return undefined;
}

async function checkCorsPreflight(params: {
  url: string;
  origin: string;
  requestHeaders: string;
}): Promise<{
  ok: boolean;
  status: number;
  allowOrigin: string | null;
  allowMethods: string | null;
  allowHeaders: string | null;
}> {
  const response = await fetch(params.url, {
    method: "OPTIONS",
    headers: {
      Origin: params.origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": params.requestHeaders,
    },
  });
  const allowOrigin = response.headers.get("access-control-allow-origin");
  const allowMethods = response.headers.get("access-control-allow-methods");
  const allowHeaders = response.headers.get("access-control-allow-headers");
  const normalizedAllowOrigin = allowOrigin?.toLowerCase();
  const normalizedOrigin = params.origin.toLowerCase();

  return {
    ok:
      response.ok &&
      (normalizedAllowOrigin === "*" || normalizedAllowOrigin === normalizedOrigin) &&
      Boolean(allowMethods?.toUpperCase().includes("POST")) &&
      areCorsRequestHeadersAllowed(params.requestHeaders, allowHeaders),
    status: response.status,
    allowOrigin,
    allowMethods,
    allowHeaders,
  };
}

function areCorsRequestHeadersAllowed(
  requestHeaders: string,
  allowHeaders: string | null,
): boolean {
  const requested = parseCorsHeaderList(requestHeaders);
  if (requested.length === 0) return true;
  if (!allowHeaders) return false;

  const allowed = parseCorsHeaderList(allowHeaders);
  if (allowed.includes("*")) return true;

  return requested.every((header) => allowed.includes(header));
}

function parseCorsHeaderList(value: string): string[] {
  return value
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
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

const FAILURE_DETAIL_OBJECT_KEYS = ["job", "run", "preview", "deployment", "build"] as const;
const FAILURE_DETAIL_ARRAY_KEYS = ["jobs", "runs", "steps", "tasks", "stages", "checks"] as const;
const FAILURE_DETAIL_MESSAGE_KEYS = ["error", "message", "detail", "reason", "summary"] as const;
const FAILURE_DETAIL_LABEL_KEYS = [
  "name",
  "title",
  "label",
  "step",
  "phase",
  "stage",
  "id",
] as const;
const FAILURE_DETAIL_STATUS_KEYS = ["status", "state", "conclusion", "result", "outcome"] as const;

type PreviewFailureDetail = {
  message?: string;
  path: string[];
  status?: string;
};

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readFirstString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = readTrimmedString(record[key]);
    if (value) return value;
  }
  return undefined;
}

function singularizeKey(key: string): string {
  return key.endsWith("s") ? key.slice(0, -1) : key;
}

function findPreviewFailureDetail(
  value: unknown,
  parentPath: string[] = [],
  fallbackLabel?: string,
): PreviewFailureDetail | undefined {
  if (!isRecord(value)) return undefined;

  const label = readFirstString(value, FAILURE_DETAIL_LABEL_KEYS) ?? fallbackLabel;
  const path = label ? [...parentPath, label] : parentPath;

  for (const key of FAILURE_DETAIL_OBJECT_KEYS) {
    const detail = findPreviewFailureDetail(value[key], path, key);
    if (detail) return detail;
  }

  for (const key of FAILURE_DETAIL_ARRAY_KEYS) {
    const children = value[key];
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      const detail = findPreviewFailureDetail(child, path, singularizeKey(key));
      if (detail) return detail;
    }
  }

  const status = readFirstString(value, FAILURE_DETAIL_STATUS_KEYS);
  if (!isTerminalFailureStatus(status)) return undefined;

  return {
    message: readFirstString(value, FAILURE_DETAIL_MESSAGE_KEYS),
    path,
    status,
  };
}

function readPreviewFailureMessage(body: unknown, fallback: string): string {
  const detail = findPreviewFailureDetail(body);
  if (!detail) return readResponseMessage(body, fallback);

  const prefix = fallback.replace(/\.+$/g, "");
  const location = detail.path.length > 0 ? ` at ${detail.path.join(" > ")}` : "";
  const status = detail.status ? ` (${detail.status})` : "";
  const message = detail.message ?? readResponseMessage(body, "");

  return message ? `${prefix}${location}${status}: ${message}` : `${prefix}${location}${status}.`;
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
    if (response.status === 404 && requestPath === "/v1/cloud/preview") {
      throw new Error(
        "Docs Cloud preview API is not available on this cloud host yet. The API key was validated, but the host did not expose /v1/cloud/preview.",
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
  const job = body.job;
  if (isRecord(job) && typeof job.status === "string") return job.status;

  const preview = body.preview;
  if (isRecord(preview) && typeof preview.status === "string") return preview.status;

  const status = body.status;
  if (typeof status === "string") return status;

  return undefined;
}

function readApiKeyScopes(body: unknown): string[] {
  if (!isRecord(body)) return [];
  const apiKey = body.apiKey;
  if (!isRecord(apiKey) || !Array.isArray(apiKey.scopes)) return [];

  return apiKey.scopes.filter((scope): scope is string => typeof scope === "string");
}

function assertPreviewApiKeyScopes(identity: unknown) {
  const scopes = readApiKeyScopes(identity);
  const missing = REQUIRED_PREVIEW_API_KEY_SCOPES.filter((scope) => !scopes.includes(scope));
  if (missing.length > 0) {
    throw new Error(
      `Docs Cloud API key is missing required preview scope${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
    );
  }

  return scopes;
}

function isTerminalFailureStatus(status: string | undefined): boolean {
  const normalized = status?.toLowerCase();
  return (
    normalized === "failed" ||
    normalized === "failure" ||
    normalized === "error" ||
    normalized === "canceled" ||
    normalized === "cancelled" ||
    normalized === "timed_out" ||
    normalized === "timeout"
  );
}

function readStatusLabel(body: unknown): string | undefined {
  const status = readPreviewStatus(body);
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
    url: `${params.apiBaseUrl}/v1/cloud/preview`,
    apiKey: params.apiKey,
    init: {
      method: "POST",
      body: JSON.stringify({
        config: params.config,
        configPath: path.relative(params.rootDir, params.configPath) || DOCS_JSON_FILE,
        repository: resolveGitRepositoryMetadata(params.rootDir),
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

    const status = readStatusLabel(statusBody);
    if (isTerminalFailureStatus(status)) {
      throw new Error(readPreviewFailureMessage(statusBody, "Docs Cloud preview failed."));
    }
  }

  throw new Error("Docs Cloud preview timed out before a URL was ready.");
}

function createSpinner(initialMessage: string, options: { json?: boolean } = {}): Spinner {
  const interactive = Boolean(
    process.stdout.isTTY && !options.json && process.env.NODE_ENV !== "test",
  );
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

export async function checkCloudConfig(
  options: CloudCommandOptions = {},
): Promise<CloudCheckResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const docsJsonPath = path.join(rootDir, DOCS_JSON_FILE);
  const existing = readExistingDocsJson(docsJsonPath);
  const snapshot = await loadDocsConfigSnapshot(rootDir, options.configPath);
  const config = materializeDocsJsonObject({ rootDir, snapshot, existing });
  const serialized = serializeMaterializedDocsJson(config);
  const previous = existing ? fs.readFileSync(docsJsonPath, "utf-8") : undefined;
  const apiBaseUrlResolution = resolveApiBaseUrl(options, rootDir);
  const apiBaseUrl = apiBaseUrlResolution.url;
  const apiKeyEnv = config.cloud?.apiKey?.env ?? DOCS_CLOUD_DEFAULT_API_KEY_ENV;
  const env = readCombinedEnv(rootDir);
  const siteOrigin = readDocsSiteOrigin(snapshot, env);
  const checks: CloudCheckItem[] = [];
  const configPath = snapshot.path ?? docsJsonPath;
  const network = options.network !== false;
  const explicitApiKey = options.apiKey?.trim();
  const targetSet = resolveCloudCheckTargets(options);
  const targets = CLOUD_CHECK_TARGETS.filter((target) => targetSet.has(target));
  const checkDeploy = targetSet.has("deploy");
  const checkAnalytics = targetSet.has("analytics");
  const checkAskAi = targetSet.has("ask-ai");
  const checkProjectEnv = checkAnalytics || checkAskAi;
  let identity: JsonRecord | undefined;

  checks.push(
    createCheck(
      "config",
      snapshot.path ? "pass" : "warn",
      snapshot.path
        ? `Loaded ${path.relative(rootDir, snapshot.path) || "docs.config.ts"}`
        : `No docs.config.* found; checking ${DOCS_JSON_FILE} defaults instead.`,
    ),
  );

  checks.push(
    createCheck(
      "docs.json",
      !existing ? "warn" : previous === serialized ? "pass" : "warn",
      !existing
        ? `${DOCS_JSON_FILE} is missing. Run docs cloud sync to materialize cloud config.`
        : previous === serialized
          ? `${DOCS_JSON_FILE} is in sync with docs.config.`
          : `${DOCS_JSON_FILE} is stale. Run docs cloud sync before deploying.`,
    ),
  );

  checks.push(
    createCheck(
      "cloud.apiBaseUrl",
      isLocalhostUrl(apiBaseUrl) ? "warn" : "pass",
      apiBaseUrlResolution.source === "default"
        ? `Using the hosted Docs Cloud API at ${apiBaseUrl}.`
        : isLocalhostUrl(apiBaseUrl)
          ? `Docs Cloud API base URL is ${apiBaseUrl}; production docs should use the hosted API base URL.`
          : `Docs Cloud API base URL is ${apiBaseUrl}.`,
      {
        source: apiBaseUrlResolution.source,
        ...(apiBaseUrlResolution.env ? { env: apiBaseUrlResolution.env } : {}),
      },
    ),
  );

  if (checkAnalytics || checkAskAi) {
    checks.push(
      createCheck(
        "docs.siteOrigin",
        siteOrigin ? "pass" : "warn",
        siteOrigin
          ? `Public docs origin is ${siteOrigin.origin}.`
          : "Could not infer the public docs origin for CORS checks. Set PUBLIC_BASE_URL, PUBLIC_SITE_URL, NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_SITE_URL, SITE_URL, or a docs config baseUrl.",
        siteOrigin
          ? {
              origin: siteOrigin.origin,
              source: siteOrigin.source,
            }
          : undefined,
      ),
    );
  }

  const apiKey = explicitApiKey || readEnvValue(env, apiKeyEnv);

  if (checkDeploy) {
    try {
      normalizeEnvName(apiKeyEnv, DOCS_CLOUD_DEFAULT_API_KEY_ENV);
      checks.push(createCheck("apiKey.config", "pass", `Using cloud.apiKey.env ${apiKeyEnv}.`));
    } catch (error) {
      checks.push(
        createCheck(
          "apiKey.config",
          "fail",
          error instanceof Error ? error.message : `Invalid API key env ${apiKeyEnv}.`,
        ),
      );
    }

    checks.push(
      createCheck(
        "apiKey.value",
        apiKey ? "pass" : "fail",
        apiKey
          ? explicitApiKey
            ? "Docs Cloud API key was provided with --api-key."
            : `Docs Cloud API key is present in ${apiKeyEnv}.`
          : `Missing Docs Cloud API key. Set ${apiKeyEnv} or pass --api-key.`,
        {
          env: apiKeyEnv,
          source: explicitApiKey ? "flag" : apiKey ? "env" : "missing",
        },
      ),
    );
  }

  checks.push(
    createCheck(
      "cloud.enabled",
      config.cloud?.enabled === false ? "fail" : "pass",
      config.cloud?.enabled === false
        ? "Docs Cloud is disabled by cloud.enabled: false."
        : "Docs Cloud is enabled.",
    ),
  );

  if (checkDeploy) {
    if (config.cloud?.deploy?.enabled === false) {
      checks.push(
        createCheck(
          "deploy.enabled",
          "fail",
          "Docs Cloud deployment is disabled by cloud.deploy.enabled: false.",
        ),
      );
    } else {
      checks.push(createCheck("deploy.enabled", "pass", "Docs Cloud deployment is enabled."));
    }

    if (config.cloud?.preview?.enabled === false) {
      checks.push(
        createCheck(
          "preview.enabled",
          "fail",
          "Docs Cloud preview deployment is disabled by cloud.preview.enabled: false.",
        ),
      );
    }
  }

  const runtimeAnalyticsDisabled = readRuntimeAnalyticsDisabled(snapshot);
  const cloudAnalyticsEnabled = isCloudAnalyticsEnabled(config.cloud?.analytics);
  if (checkAnalytics) {
    if (runtimeAnalyticsDisabled) {
      checks.push(
        createCheck(
          "analytics.runtime",
          "fail",
          "Runtime analytics is disabled by analytics: false or analytics.enabled: false.",
        ),
      );
    } else {
      checks.push(createCheck("analytics.runtime", "pass", "Runtime analytics is not disabled."));
    }

    checks.push(
      createCheck(
        "analytics.cloud",
        cloudAnalyticsEnabled ? "pass" : "warn",
        cloudAnalyticsEnabled
          ? "Docs Cloud analytics is enabled in cloud.analytics."
          : "cloud.analytics is not enabled; run docs cloud init to add the recommended analytics config.",
      ),
    );
  }

  const projectEnv = readFirstEnv(env, DOCS_CLOUD_PROJECT_ID_ENVS);
  const analyticsNeedsProjectId = cloudAnalyticsEnabled && !runtimeAnalyticsDisabled;
  if (checkProjectEnv) {
    checks.push(
      createCheck(
        "project.env",
        projectEnv ? "pass" : analyticsNeedsProjectId || checkAskAi ? "fail" : "warn",
        projectEnv
          ? `Docs Cloud project id is present in ${projectEnv.name}.`
          : `Missing Docs Cloud project id. Set ${DOCS_CLOUD_PROJECT_ID_ENVS.join(" or ")} for analytics and docs-cloud Ask AI.`,
        projectEnv ? { env: projectEnv.name } : undefined,
      ),
    );
  }

  const aiProvider = readAiProvider(snapshot);
  let askAiCorsMode: "none" | "direct" | "proxy" = "none";
  if (checkAskAi) {
    if (aiProvider === "docs-cloud") {
      checks.push(
        createCheck("askAi.provider", "pass", 'Ask AI is configured with provider: "docs-cloud".'),
      );

      const configuredApiKeyEnv = readConfiguredCloudApiKeyEnv(snapshot);
      const publicApiKeyEnv =
        configuredApiKeyEnv && isBrowserSafeEnvName(configuredApiKeyEnv)
          ? configuredApiKeyEnv
          : (readFirstEnv(env, [DEFAULT_PUBLIC_DOCS_CLOUD_API_KEY_ENV])?.name ??
            DEFAULT_PUBLIC_DOCS_CLOUD_API_KEY_ENV);
      const publicApiKey = readEnvValue(env, publicApiKeyEnv);
      const publicProjectEnv = readFirstEnv(env, [DOCS_CLOUD_DEFAULT_ANALYTICS_PROJECT_ID_ENV]);
      const serverApiKeyEnv = configuredApiKeyEnv ?? DOCS_CLOUD_DEFAULT_API_KEY_ENV;
      const serverApiKey = readEnvValue(env, serverApiKeyEnv);

      if (publicApiKey && publicProjectEnv) {
        checks.push(
          createCheck(
            "askAi.direct",
            "pass",
            `Ask AI can call the Docs Cloud knowledge endpoint directly with ${publicApiKeyEnv}.`,
            { apiKeyEnv: publicApiKeyEnv, projectIdEnv: publicProjectEnv.name },
          ),
        );
        askAiCorsMode = "direct";
      } else if (serverApiKey && projectEnv) {
        checks.push(
          createCheck(
            "askAi.direct",
            "warn",
            `Direct browser Ask AI needs ${DEFAULT_PUBLIC_DOCS_CLOUD_API_KEY_ENV} and ${DOCS_CLOUD_DEFAULT_ANALYTICS_PROJECT_ID_ENV}; this app can use the local docs API route with ${serverApiKeyEnv}.`,
            { apiKeyEnv: serverApiKeyEnv, projectIdEnv: projectEnv.name, proxy: true },
          ),
        );
        askAiCorsMode = "proxy";
      } else {
        checks.push(
          createCheck(
            "askAi.direct",
            "fail",
            `Ask AI docs-cloud direct mode needs ${DEFAULT_PUBLIC_DOCS_CLOUD_API_KEY_ENV} and ${DOCS_CLOUD_DEFAULT_ANALYTICS_PROJECT_ID_ENV}.`,
            { apiKeyEnv: publicApiKeyEnv },
          ),
        );
      }
    } else if (aiProvider) {
      checks.push(createCheck("askAi.provider", "pass", `Ask AI provider is ${aiProvider}.`));
    } else {
      checks.push(
        createCheck(
          "askAi.provider",
          "warn",
          'Ask AI is not configured with provider: "docs-cloud".',
        ),
      );
    }
  }

  if (checkAnalytics || checkAskAi) {
    if (!network) {
      checks.push(
        createCheck(
          "cloud.cors",
          "warn",
          "Skipped Docs Cloud CORS validation because --no-network was passed.",
        ),
      );
    } else if (!siteOrigin) {
      checks.push(
        createCheck(
          "cloud.cors",
          "warn",
          "Could not infer the docs site origin for CORS checks. Set PUBLIC_BASE_URL, NEXT_PUBLIC_BASE_URL, or a docs config baseUrl.",
        ),
      );
    } else {
      if (checkAnalytics) {
        try {
          const cors = await checkCorsPreflight({
            url: `${apiBaseUrl}/v1/analytics/events`,
            origin: siteOrigin.origin,
            requestHeaders: "content-type",
          });
          checks.push(
            createCheck(
              "cors.analytics",
              cors.ok ? "pass" : "fail",
              cors.ok
                ? `Analytics CORS allows ${siteOrigin.origin}.`
                : `Analytics CORS blocked ${siteOrigin.origin}.`,
              {
                origin: siteOrigin.origin,
                originSource: siteOrigin.source,
                status: cors.status,
                allowOrigin: cors.allowOrigin,
                allowMethods: cors.allowMethods,
                allowHeaders: cors.allowHeaders,
              },
            ),
          );
        } catch (error) {
          checks.push(
            createCheck(
              "cors.analytics",
              "fail",
              error instanceof Error
                ? `Analytics CORS check failed: ${error.message}`
                : "Analytics CORS check failed.",
            ),
          );
        }
      }

      if (checkAskAi && projectEnv && askAiCorsMode === "direct") {
        try {
          const cors = await checkCorsPreflight({
            url: `${apiBaseUrl}/v1/projects/${encodeURIComponent(projectEnv.value)}/knowledge/ask`,
            origin: siteOrigin.origin,
            requestHeaders: "authorization, content-type",
          });
          checks.push(
            createCheck(
              "cors.askAi",
              cors.ok ? "pass" : "fail",
              cors.ok
                ? `Ask AI CORS allows ${siteOrigin.origin}.`
                : `Ask AI CORS blocked ${siteOrigin.origin}.`,
              {
                origin: siteOrigin.origin,
                originSource: siteOrigin.source,
                status: cors.status,
                allowOrigin: cors.allowOrigin,
                allowMethods: cors.allowMethods,
                allowHeaders: cors.allowHeaders,
              },
            ),
          );
        } catch (error) {
          checks.push(
            createCheck(
              "cors.askAi",
              "fail",
              error instanceof Error
                ? `Ask AI CORS check failed: ${error.message}`
                : "Ask AI CORS check failed.",
            ),
          );
        }
      } else if (checkAskAi && askAiCorsMode === "proxy") {
        checks.push(
          createCheck(
            "cors.askAi",
            "pass",
            "Ask AI uses the local docs API route, so Docs Cloud browser CORS is not required.",
            { proxy: true },
          ),
        );
      }
    }
  }

  if (checkDeploy) {
    if (!network) {
      checks.push(
        createCheck(
          "apiKey.network",
          "warn",
          "Skipped Docs Cloud API validation because --no-network was passed.",
        ),
      );
    } else if (!apiKey) {
      checks.push(
        createCheck(
          "apiKey.network",
          "warn",
          "Skipped Docs Cloud API validation because no API key value was available.",
        ),
      );
    } else {
      try {
        const response = await fetchCloudJson({
          url: `${apiBaseUrl}/v1/cloud/me`,
          apiKey,
        });
        identity = summarizeIdentity(response);
        checks.push(
          createCheck("apiKey.network", "pass", `Validated API key with ${apiBaseUrl}.`, identity),
        );

        const scopes = readApiKeyScopes(response);
        if (scopes.length === 0) {
          checks.push(
            createCheck(
              "apiKey.scopes",
              "warn",
              "Docs Cloud validated the API key but did not return scope metadata.",
            ),
          );
        } else {
          const missing = REQUIRED_PREVIEW_API_KEY_SCOPES.filter(
            (scope) => !scopes.includes(scope),
          );
          checks.push(
            createCheck(
              "apiKey.scopes",
              missing.length === 0 ? "pass" : "fail",
              missing.length === 0
                ? `API key has required deploy scopes: ${REQUIRED_PREVIEW_API_KEY_SCOPES.join(", ")}.`
                : `API key is missing required deploy scope${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
              { scopes },
            ),
          );
        }
      } catch (error) {
        checks.push(
          createCheck(
            "apiKey.network",
            "fail",
            error instanceof Error ? error.message : "Could not validate Docs Cloud API key.",
          ),
        );
      }
    }
  }

  return {
    ok: countChecks(checks, "fail") === 0,
    apiBaseUrl,
    configPath,
    docsJsonPath,
    apiKeyEnv,
    analyticsProjectIdEnv: projectEnv?.name,
    network,
    targets,
    checks,
    ...(identity ? { identity } : {}),
  };
}

export async function runCloudCheck(options: CloudCommandOptions = {}) {
  const result = await checkCloudConfig(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(pc.bold("Docs Cloud check"));
    console.log(`${pc.dim("api")} ${result.apiBaseUrl}`);
    console.log(`${pc.dim("scope")} ${formatCloudCheckTargets(result.targets)}`);
    console.log();

    for (const check of result.checks) {
      console.log(`${formatCheckStatus(check.status)} ${pc.bold(check.name)} ${check.message}`);
    }

    console.log();
    if (result.ok) {
      const warnings = countChecks(result.checks, "warn");
      const suffix = warnings > 0 ? ` with ${warnings} warning${warnings === 1 ? "" : "s"}` : "";
      console.log(`${pc.green("ok")} Docs Cloud check passed${suffix}.`);
    } else {
      const failures = countChecks(result.checks, "fail");
      console.log(
        `${pc.red("fail")} Docs Cloud check failed with ${failures} failed check${failures === 1 ? "" : "s"}.`,
      );
    }
  }

  if (!result.ok) {
    const error = new Error("Docs Cloud check failed.");
    markCliErrorReported(error);
    throw error;
  }

  return result;
}

export async function syncCloudConfig(options: CloudCommandOptions = {}) {
  const result = await materializeCloudConfig(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const action = result.created ? "Created" : result.updated ? "Synced" : "Checked";
  console.log(
    `${pc.green("ok")} ${action} ${pc.cyan(path.relative(process.cwd(), result.docsJsonPath) || DOCS_JSON_FILE)}`,
  );
  console.log(`${pc.dim("api key env")} ${result.apiKeyEnv}`);
  return result;
}

export async function initCloudConfig(options: CloudCommandOptions = {}): Promise<CloudInitResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const docsJsonPath = path.join(rootDir, DOCS_JSON_FILE);
  const existingDocsJson = readExistingDocsJson(docsJsonPath);
  const apiKeyEnv = normalizeEnvName(options.apiKeyEnv, DOCS_CLOUD_DEFAULT_API_KEY_ENV);
  const existingConfigPath = tryResolveDocsConfigPath(rootDir, options.configPath);
  const useDocsJsonAsSource = Boolean(existingDocsJson && !existingConfigPath);
  const docsInfraProfile =
    options.docsInfraProfile ??
    (existingConfigPath || existingDocsJson ? undefined : detectConnectedFumadocsProfile(rootDir));

  if (useDocsJsonAsSource) {
    const materialized = writeMaterializedCloudConfig({
      rootDir,
      docsJsonPath,
      existing: existingDocsJson,
      snapshot: {},
      docsInfraProfile,
      cloudInitApiKeyEnv: apiKeyEnv,
    });

    return {
      configPath: materialized.configPath,
      docsJsonPath: materialized.docsJsonPath,
      apiKeyEnv: materialized.apiKeyEnv,
      analyticsProjectIdEnv: DOCS_CLOUD_DEFAULT_ANALYTICS_PROJECT_ID_ENV,
      configCreated: false,
      configUpdated: false,
      docsJsonCreated: false,
      docsJsonUpdated: materialized.updated,
      ...(docsInfraProfile ? { docsInfraProfile } : {}),
    };
  }

  const configUpdate = ensureDocsConfigCloudInit({
    rootDir,
    configPath: options.configPath,
    apiKeyEnv,
    docsInfraProfile,
  });
  const materialized = await materializeCloudConfig({
    ...options,
    rootDir,
    configPath: path.relative(rootDir, configUpdate.configPath),
    docsInfraProfile,
  });

  return {
    configPath: configUpdate.configPath,
    docsJsonPath: materialized.docsJsonPath,
    apiKeyEnv: materialized.apiKeyEnv,
    analyticsProjectIdEnv: DOCS_CLOUD_DEFAULT_ANALYTICS_PROJECT_ID_ENV,
    configCreated: configUpdate.created,
    configUpdated: configUpdate.updated,
    docsJsonCreated: materialized.created,
    docsJsonUpdated: materialized.updated,
    ...(docsInfraProfile ? { docsInfraProfile } : {}),
  };
}

export async function runCloudInit(options: CloudCommandOptions = {}) {
  const result = await initCloudConfig(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const relativeConfigPath = path.relative(process.cwd(), result.configPath) || "docs.config.ts";
  const relativeDocsJsonPath = path.relative(process.cwd(), result.docsJsonPath) || DOCS_JSON_FILE;
  const configAction = result.configCreated
    ? "Created"
    : result.configUpdated
      ? "Updated"
      : "Checked";
  const docsJsonAction = result.docsJsonCreated
    ? "created"
    : result.docsJsonUpdated
      ? "updated"
      : "checked";

  console.log(`${pc.green("ok")} ${configAction} ${pc.cyan(relativeConfigPath)}`);
  console.log(`${pc.green("ok")} ${docsJsonAction} ${pc.cyan(relativeDocsJsonPath)}`);
  if (result.docsInfraProfile?.engine === "fumadocs") {
    console.log(
      `${pc.green("ok")} Connected existing ${pc.cyan("Fumadocs")} content at ${pc.cyan(result.docsInfraProfile.contentRoots.join(", "))}`,
    );
  }
  console.log();
  console.log(pc.bold("Add these env vars"));
  console.log(`${pc.cyan(result.apiKeyEnv)}=${pc.dim("paste_your_docs_cloud_api_key")}`);
  console.log(
    `${pc.cyan(result.analyticsProjectIdEnv)}=${pc.dim("paste_your_docs_cloud_project_id")}`,
  );
  console.log();
  console.log(
    pc.dim("Use the same env vars in production. The API key value is never written to config."),
  );
  console.log(pc.dim(`Then run ${pc.cyan("pnpm dlx @farming-labs/docs deploy")}.`));

  return result;
}

async function runCloudDeployment(options: CloudCommandOptions = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const spinner = createSpinner("Preparing Docs Cloud deployment", options);

  try {
    const materialized = await materializeCloudConfig({ ...options, rootDir });
    spinner.update(`${materialized.created ? "Created" : "Synced"} ${DOCS_JSON_FILE}`);

    if (materialized.config.cloud?.enabled === false) {
      throw new Error(
        "Docs Cloud is disabled in cloud.enabled. Remove that override or set cloud.enabled: true before deploying hosted preview docs.",
      );
    }

    if (materialized.config.cloud?.preview?.enabled === false) {
      throw new Error(
        "Docs Cloud preview deployments are disabled in cloud.preview.enabled. Remove that legacy override before deploying hosted preview docs.",
      );
    }

    if (materialized.config.cloud?.deploy?.enabled === false) {
      throw new Error(
        "Docs Cloud deployment is disabled in cloud.deploy.enabled. Set it to true before deploying hosted preview docs.",
      );
    }

    const apiKey = resolveApiKey(options, rootDir, materialized.apiKeyEnv);
    const apiBaseUrl = resolveApiBaseUrl(options, rootDir).url;

    spinner.update("Validating Docs Cloud API key");
    const identity = await fetchCloudJson({
      url: `${apiBaseUrl}/v1/cloud/me`,
      apiKey,
    });
    assertPreviewApiKeyScopes(identity);

    spinner.update("Requesting Docs Cloud deployment");
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

    spinner.succeed("Docs Cloud deployment is ready");

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
      console.log(`${pc.bold("Deployment")} ${pc.cyan(preview.url)}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!options.json) {
      spinner.fail(message);
      markCliErrorReported(error);
    }
    throw error;
  } finally {
    spinner.stop();
  }
}

export async function runCloudDeploy(options: CloudCommandOptions = {}) {
  return runCloudDeployment(options);
}

export async function runCloudPreview(options: CloudCommandOptions = {}) {
  return runCloudDeployment(options);
}

export function printCloudHelp() {
  console.log(`
${pc.bold("@farming-labs/docs cloud")}

${pc.dim("Usage:")}
  ${pc.cyan("docs cloud init")}           Add Docs Cloud config to ${pc.dim("docs.config.ts")} and ${pc.dim("docs.json")}
  ${pc.cyan("docs cloud check")}          Validate Docs Cloud config, analytics envs, API key, and Ask AI wiring
  ${pc.cyan("docs deploy")}               Sync ${pc.dim("docs.config.ts")} to ${pc.dim("docs.json")} and deploy hosted preview docs
  ${pc.cyan("docs cloud deploy")}         Same as ${pc.cyan("docs deploy")}
  ${pc.cyan("docs preview")}              Compatibility alias for ${pc.cyan("docs deploy")}
  ${pc.cyan("docs cloud preview")}        Compatibility alias for ${pc.cyan("docs cloud deploy")}
  ${pc.cyan("docs cloud sync")}           Only materialize cloud settings into ${pc.dim("docs.json")}

${pc.dim("Options:")}
  ${pc.cyan("--config <path>")}           Use a custom docs config path
  ${pc.cyan("--api-key-env <name>")}      Env var that stores the Docs Cloud API key
  ${pc.cyan("--api-base-url <url>")}      Override Docs Cloud API base URL
  ${pc.cyan("--api-key <key>")}           Use an API key directly; prefer ${pc.dim("cloud.apiKey.env")}
  ${pc.cyan("--analytics")}               Only check Docs Cloud analytics integration
  ${pc.cyan("--ask-ai")}                  Only check Docs Cloud Ask AI integration
  ${pc.cyan("--deploy")}                  Only check Docs Cloud deploy integration
  ${pc.cyan("--no-network")}              Skip live Docs Cloud API validation for ${pc.cyan("cloud check")}
  ${pc.cyan("--json")}                    Print machine-readable output

${pc.dim("API key scopes:")}
  ${REQUIRED_PREVIEW_API_KEY_SCOPES.join(", ")}

${pc.dim("Config example:")}
  cloud: {
    apiKey: { env: "DOCS_CLOUD_API_KEY" },
    deploy: { enabled: true },
    analytics: { enabled: true, console: false, includeInputs: false },
    publish: { mode: "draft-pr", baseBranch: "main" },
  }
`);
}

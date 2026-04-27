import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import pc from "picocolors";
import { findDocsMarkdownPage, renderDocsMarkdownDocument } from "../index.js";
import { createFilesystemDocsMcpSource } from "../server.js";
import type { DocsMcpPage } from "../server.js";
import {
  extractNestedObjectLiteral,
  loadProjectEnv,
  loadDocsConfigModule,
  readEnvReferenceProperty,
  readNavTitle,
  readBooleanProperty,
  readNumberProperty,
  readTopLevelStringProperty,
  readStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";
import type { DocsConfig, PageFrontmatter } from "../types.js";

const DEFAULT_TTC_BASE_URL = "https://api.thetokencompany.com";
const DEFAULT_TTC_MODEL = "bear-1.2";
const DEFAULT_TTC_AGGRESSIVENESS = 0.3;
const INDEX_PAGE_BASENAMES = new Set(["index", "page", "+page"]);

export interface AgentCompactOptions {
  configPath?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  baseUrl?: string;
  model?: string;
  aggressiveness?: number;
  maxOutputTokens?: number;
  minOutputTokens?: number;
  protectJson?: boolean;
  all?: boolean;
  pages?: string[];
  dryRun?: boolean;
}

export interface ParsedAgentCompactArgs extends AgentCompactOptions {
  help?: boolean;
}

interface DocsPageTarget {
  slug: string;
  url: string;
  pagePath: string;
  pageDir: string;
  agentPath: string;
  hasAgentFile: boolean;
}

interface CompressResponse {
  output: string;
  output_tokens?: number;
  original_input_tokens?: number;
}

function parseBooleanFlag(raw: string): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Invalid boolean value: ${raw}. Use true or false.`);
}

function parseIntegerFlag(raw: string, name: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: ${raw}.`);
  }
  return parsed;
}

function parseFloatFlag(raw: string, name: string): number {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: ${raw}.`);
  }
  return parsed;
}

export function parseAgentCompactArgs(argv: string[]): ParsedAgentCompactArgs {
  const parsed: ParsedAgentCompactArgs = {
    pages: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--all") {
      parsed.all = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--protect-json") {
      const nextValue = argv[index + 1];
      if (nextValue && !nextValue.startsWith("--")) {
        parsed.protectJson = parseBooleanFlag(nextValue);
        index += 1;
      } else {
        parsed.protectJson = true;
      }
      continue;
    }

    if (!arg.startsWith("--")) {
      parsed.pages!.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.trim();
    const hasInlineValue = inlineValue !== undefined;
    const nextValue = !hasInlineValue ? argv[index + 1] : undefined;
    const consumeNextValue = () => {
      if (!nextValue || nextValue.startsWith("--")) {
        throw new Error(`Missing value for --${key}.`);
      }
      index += 1;
      return nextValue;
    };
    const value = hasInlineValue ? inlineValue : consumeNextValue();

    switch (key) {
      case "page":
        parsed.pages!.push(value);
        break;
      case "config":
        parsed.configPath = value;
        break;
      case "api-key":
        parsed.apiKey = value;
        break;
      case "base-url":
        parsed.baseUrl = value;
        break;
      case "api-key-env":
        parsed.apiKeyEnv = value;
        break;
      case "model":
        parsed.model = value;
        break;
      case "aggressiveness":
        parsed.aggressiveness = parseFloatFlag(value, "aggressiveness");
        break;
      case "max-output-tokens":
        parsed.maxOutputTokens = parseIntegerFlag(value, "max-output-tokens");
        break;
      case "min-output-tokens":
        parsed.minOutputTokens = parseIntegerFlag(value, "min-output-tokens");
        break;
      case "protect-json":
        parsed.protectJson = parseBooleanFlag(value);
        break;
      default:
        throw new Error(`Unknown agent compact flag: --${key}.`);
    }
  }

  return parsed;
}

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeUrlPath(value: string): string {
  const normalized = value.replace(/\/+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

function normalizeRequestedPage(entry: string, rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === ".") {
    return `/${normalizePathSegment(entry) || "docs"}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return normalizeUrlPath(new URL(trimmed).pathname.replace(/\.md$/i, ""));
    } catch {
      return trimmed;
    }
  }

  const withoutMarkdownSuffix = trimmed.replace(/\.md$/i, "");
  const normalizedEntry = `/${normalizePathSegment(entry) || "docs"}`;
  const normalized = normalizeUrlPath(
    withoutMarkdownSuffix.startsWith("/") ? withoutMarkdownSuffix : `/${withoutMarkdownSuffix}`,
  );

  if (normalized === normalizedEntry || normalized.startsWith(`${normalizedEntry}/`)) {
    return normalized;
  }

  const slug = normalizePathSegment(withoutMarkdownSuffix);
  return slug ? normalizeUrlPath(`${normalizedEntry}/${slug}`) : normalizedEntry;
}

function scanDocsPageTargets(rootDir: string, contentDir: string, entry: string): DocsPageTarget[] {
  const contentDirAbs = path.resolve(rootDir, contentDir);
  const targets: DocsPageTarget[] = [];

  const visit = (dir: string, slugParts: string[]) => {
    if (!existsSync(dir)) return;

    for (const name of readdirSync(dir).sort()) {
      const fullPath = path.join(dir, name);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        visit(fullPath, [...slugParts, name]);
        continue;
      }

      if (name === "agent.md") continue;
      if (!name.endsWith(".md") && !name.endsWith(".mdx") && !name.endsWith(".svx")) continue;

      const baseName = name.replace(/\.(md|mdx|svx)$/i, "");
      if (!INDEX_PAGE_BASENAMES.has(baseName)) continue;

      const slug = slugParts.join("/");
      const url = slug
        ? `/${normalizePathSegment(entry)}/${slug}`
        : `/${normalizePathSegment(entry)}`;
      const agentPath = path.join(dir, "agent.md");

      targets.push({
        slug,
        url,
        pagePath: fullPath,
        pageDir: dir,
        agentPath,
        hasAgentFile: existsSync(agentPath),
      });
    }
  };

  visit(contentDirAbs, []);
  return targets;
}

function resolveCompressionEndpoint(rawBaseUrl?: string): string {
  const baseUrl =
    rawBaseUrl ??
    process.env.TOKEN_COMPANY_BASE_URL ??
    process.env.THE_TOKEN_COMPANY_BASE_URL ??
    DEFAULT_TTC_BASE_URL;

  if (/\/v1\/compress\/?$/i.test(baseUrl)) {
    return baseUrl.replace(/\/+$/, "");
  }

  return `${baseUrl.replace(/\/+$/, "")}/v1/compress`;
}

function resolveCompressionApiKey(explicitApiKey?: string, explicitApiKeyEnv?: string): string {
  const candidateKeys = [
    explicitApiKeyEnv,
    "TOKEN_COMPANY_API_KEY",
    "THE_TOKEN_COMPANY_API_KEY",
    "TTC_API_KEY",
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  const apiKey = explicitApiKey ?? candidateKeys.map((key) => process.env[key]).find(Boolean);

  if (!apiKey) {
    throw new Error(
      "Missing Token Company API key. Pass --api-key, set agent.compact.apiKey/apiKeyEnv, or set TOKEN_COMPANY_API_KEY.",
    );
  }

  return apiKey;
}

function readAgentCompactConfig(content: string): AgentCompactOptions {
  const compactBlock = extractNestedObjectLiteral(content, ["agent", "compact"]);
  if (!compactBlock) return {};

  const configuredApiKey = readStringProperty(compactBlock, "apiKey");
  const configuredApiKeyEnv =
    readStringProperty(compactBlock, "apiKeyEnv") ??
    (!configuredApiKey ? readEnvReferenceProperty(compactBlock, "apiKey") : undefined);

  return {
    apiKey: configuredApiKey,
    apiKeyEnv: configuredApiKeyEnv,
    baseUrl: readStringProperty(compactBlock, "baseUrl"),
    model: readStringProperty(compactBlock, "model"),
    aggressiveness: readNumberProperty(compactBlock, "aggressiveness"),
    maxOutputTokens: readNumberProperty(compactBlock, "maxOutputTokens"),
    minOutputTokens: readNumberProperty(compactBlock, "minOutputTokens"),
    protectJson: readBooleanProperty(compactBlock, "protectJson"),
  };
}

function readAgentCompactConfigFromModule(config: DocsConfig): AgentCompactOptions {
  const compact = config.agent?.compact;
  if (!compact) return {};

  return {
    apiKey: compact.apiKey,
    apiKeyEnv: compact.apiKeyEnv,
    baseUrl: compact.baseUrl,
    model: compact.model,
    aggressiveness: compact.aggressiveness,
    maxOutputTokens: compact.maxOutputTokens,
    minOutputTokens: compact.minOutputTokens,
    protectJson: compact.protectJson,
  };
}

function mergeAgentCompactOptions(
  defaults: AgentCompactOptions,
  overrides: AgentCompactOptions,
): AgentCompactOptions {
  return {
    ...defaults,
    ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
  };
}

function normalizeTokenBudget(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.ceil(value));
}

function readPageTokenBudget(pagePath: string): number | undefined {
  const source = readFileSync(pagePath, "utf-8");
  const { data } = matter(source);
  return normalizeTokenBudget((data as PageFrontmatter).agent?.tokenBudget);
}

function protectForCompression(input: string): string {
  const segments: string[] = [];
  const stash = (value: string) => {
    const token = `__TTC_SAFE_${segments.length}__`;
    segments.push(value);
    return token;
  };

  let result = input;
  result = result.replace(/```[\s\S]*?```/g, stash);
  result = result.replace(/\[[^\]]+\]\([^)]+\)/g, stash);
  result = result.replace(/`[^`\n]+`/g, stash);
  result = result.replace(/^(URL|Description|Related):[^\n]*$/gm, stash);
  result = result.replace(/https?:\/\/[^\s)]+/g, stash);

  for (let index = 0; index < segments.length; index += 1) {
    result = result.replace(`__TTC_SAFE_${index}__`, `<ttc_safe>${segments[index]}</ttc_safe>`);
  }

  return result;
}

function sanitizeCompressedOutput(output: string): string {
  return output.replace(/<\/?ttc_safe>/g, "");
}

async function compressDocument(
  input: string,
  options: AgentCompactOptions,
): Promise<CompressResponse> {
  const apiKey = resolveCompressionApiKey(options.apiKey, options.apiKeyEnv);
  const endpoint = resolveCompressionEndpoint(options.baseUrl);
  const aggressiveness = options.aggressiveness ?? DEFAULT_TTC_AGGRESSIVENESS;

  if (aggressiveness < 0 || aggressiveness > 1) {
    throw new Error("Aggressiveness must be between 0.0 and 1.0.");
  }

  const payload = {
    model: options.model ?? DEFAULT_TTC_MODEL,
    input: protectForCompression(input),
    compression_settings: {
      aggressiveness,
      ...(options.maxOutputTokens !== undefined
        ? { max_output_tokens: options.maxOutputTokens }
        : {}),
      ...(options.minOutputTokens !== undefined
        ? { min_output_tokens: options.minOutputTokens }
        : {}),
      ...(options.protectJson !== undefined ? { protect_json: options.protectJson } : {}),
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Token Company request failed (${response.status}): ${body || response.statusText}`,
    );
  }

  const result = (await response.json()) as CompressResponse;
  const sanitizedOutput =
    typeof result.output === "string" ? sanitizeCompressedOutput(result.output) : result.output;

  if (typeof sanitizedOutput !== "string" || sanitizedOutput.trim().length === 0) {
    throw new Error("Token Company response did not include a compressed output.");
  }

  return {
    ...result,
    output: sanitizedOutput,
  };
}

function resolveSelectedPages(
  pages: DocsMcpPage[],
  targets: DocsPageTarget[],
  entry: string,
  requested: string[],
  includeAll: boolean,
): Array<{ page: DocsMcpPage; target: DocsPageTarget }> {
  const compactableBySlug = new Map(targets.map((target) => [target.slug, target] as const));

  if (includeAll) {
    return targets
      .map((target) => {
        const page = pages.find((candidate) => candidate.slug === target.slug);
        return page ? { page, target } : null;
      })
      .filter((value): value is { page: DocsMcpPage; target: DocsPageTarget } => value !== null);
  }

  const resolved: Array<{ page: DocsMcpPage; target: DocsPageTarget }> = [];
  const seen = new Set<string>();

  for (const rawRequest of requested) {
    const normalized = normalizeRequestedPage(entry, rawRequest);
    const page = findDocsMarkdownPage(entry, pages, normalized);

    if (!page) {
      throw new Error(`Could not find a docs page for "${rawRequest}".`);
    }

    const target = compactableBySlug.get(page.slug);
    if (!target) {
      throw new Error(
        `Page "${rawRequest}" does not use a folder-based page file, so it cannot be written to a sibling agent.md automatically.`,
      );
    }

    if (seen.has(target.slug)) continue;
    seen.add(target.slug);
    resolved.push({ page, target });
  }

  return resolved;
}

export async function compactAgentDocs(options: AgentCompactOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const loadedEnv = loadProjectEnv(rootDir);

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  const loadedConfigModule = await loadDocsConfigModule(rootDir, options.configPath);
  const configPath = loadedConfigModule?.path ?? resolveDocsConfigPath(rootDir, options.configPath);
  const configContent = readFileSync(configPath, "utf-8");
  const configDefaults = mergeAgentCompactOptions(
    readAgentCompactConfig(configContent),
    loadedConfigModule?.config ? readAgentCompactConfigFromModule(loadedConfigModule.config) : {},
  );
  const resolvedOptions = mergeAgentCompactOptions(configDefaults, options);
  const entry =
    normalizePathSegment(
      loadedConfigModule?.config.entry ??
        readTopLevelStringProperty(configContent, "entry") ??
        "docs",
    ) || "docs";
  const contentDir =
    typeof loadedConfigModule?.config.contentDir === "string"
      ? loadedConfigModule.config.contentDir
      : resolveDocsContentDir(rootDir, configContent, entry);
  const siteTitle =
    typeof loadedConfigModule?.config.nav?.title === "string"
      ? loadedConfigModule.config.nav.title
      : (readNavTitle(configContent) ?? "Documentation");

  if (resolvedOptions.all && resolvedOptions.pages && resolvedOptions.pages.length > 0) {
    throw new Error("Use either --all or specific page arguments, not both.");
  }

  const requestedPages = resolvedOptions.pages?.filter((value) => value.trim().length > 0) ?? [];
  if (!resolvedOptions.all && requestedPages.length === 0) {
    throw new Error("Pass --all or at least one docs page slug/path to compact.");
  }

  const source = createFilesystemDocsMcpSource({
    rootDir,
    entry,
    contentDir,
    siteTitle,
  });
  const pages = await source.getPages();

  if (pages.length === 0) {
    throw new Error(`No docs content was found under ${contentDir}.`);
  }

  const targets = scanDocsPageTargets(rootDir, contentDir, entry);
  const selectedPages = resolveSelectedPages(
    pages,
    targets,
    entry,
    requestedPages,
    resolvedOptions.all === true,
  );

  if (selectedPages.length === 0) {
    throw new Error("No compactable docs pages matched the request.");
  }

  let created = 0;
  let overwritten = 0;

  for (const { page, target } of selectedPages) {
    const sourceDocument = renderDocsMarkdownDocument(page);
    const pageOptions = mergeAgentCompactOptions(resolvedOptions, {
      maxOutputTokens: readPageTokenBudget(target.pagePath),
    });
    if (
      pageOptions.minOutputTokens !== undefined &&
      pageOptions.maxOutputTokens !== undefined &&
      pageOptions.minOutputTokens > pageOptions.maxOutputTokens
    ) {
      pageOptions.minOutputTokens = pageOptions.maxOutputTokens;
    }
    const compressed = await compressDocument(sourceDocument, pageOptions);
    const nextContent = compressed.output.trimEnd();

    console.log(
      pc.dim(
        `Compacting ${page.url} (${compressed.original_input_tokens ?? "?"} -> ${compressed.output_tokens ?? "?"} tokens)...`,
      ),
    );

    if (resolvedOptions.dryRun) continue;

    mkdirSync(target.pageDir, { recursive: true });
    writeFileSync(target.agentPath, `${nextContent}\n`, "utf-8");

    if (target.hasAgentFile) overwritten += 1;
    else created += 1;
  }

  const summaryPrefix = resolvedOptions.dryRun ? "Dry run complete" : "Compaction complete";
  console.log(
    pc.green(
      `${summaryPrefix}: ${selectedPages.length} page${selectedPages.length === 1 ? "" : "s"} processed` +
        (resolvedOptions.dryRun ? "." : ` (${created} created, ${overwritten} overwritten).`),
    ),
  );
}

export function printAgentCompactHelp(): void {
  console.log(`
${pc.bold("docs agent compact")} — Generate sibling ${pc.cyan("agent.md")} files by compacting resolved docs pages.

${pc.dim("Usage:")}
  npx @farming-labs/docs@latest ${pc.cyan("agent compact")} ${pc.dim("[page ...]")}

${pc.dim("Examples:")}
  ${pc.cyan("npx @farming-labs/docs@latest agent compact installation configuration")}
  ${pc.cyan("npx @farming-labs/docs@latest agent compact /docs/installation")}
  ${pc.cyan("npx @farming-labs/docs@latest agent compact --page installation --page configuration")}
  ${pc.cyan("npx @farming-labs/docs@latest agent compact --all")}

${pc.dim("Per-page override:")}
  Add ${pc.cyan("agent.tokenBudget")} to a page frontmatter block to override the compact output target for that page.

${pc.dim("Options:")}
  ${pc.cyan("--all")}                    Compact every folder-based docs page under the configured contentDir
  ${pc.cyan("--page <slug|path>")}       Add a page explicitly (repeatable); positional page args work too
  ${pc.cyan("--config <path>")}          Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}
  ${pc.cyan("--api-key <key>")}          Token Company API key (or set ${pc.dim("TOKEN_COMPANY_API_KEY")})
  ${pc.cyan("--api-key-env <name>")}     Custom env var name for the Token Company API key
  ${pc.cyan("--base-url <url>")}         Override the Token Company API base URL (useful for tests)
  ${pc.cyan("--model <name>")}           Compression model (${pc.dim("bear-1.2")} by default)
  ${pc.cyan("--aggressiveness <0-1>")}   Compression intensity (${pc.dim("0.3")} by default)
  ${pc.cyan("--max-output-tokens <n>")}  Pass through to Token Company compression settings
  ${pc.cyan("--min-output-tokens <n>")}  Pass through to Token Company compression settings
  ${pc.cyan("--protect-json <bool>")}    Preserve JSON objects during compression
  ${pc.cyan("--dry-run")}                Resolve pages and call the compressor without writing files
`);
}

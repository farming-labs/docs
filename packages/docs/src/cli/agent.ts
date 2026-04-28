import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import matter from "gray-matter";
import pc from "picocolors";
import {
  GENERATED_AGENT_PROVENANCE_VERSION,
  hashGeneratedAgentContent,
  parseGeneratedAgentDocument,
  serializeGeneratedAgentDocument,
  type GeneratedAgentProvenance,
  type GeneratedAgentSourceKind,
} from "../agent-provenance.js";
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
  changed?: boolean;
  stale?: boolean;
  includeMissing?: boolean;
  dryRun?: boolean;
}

export interface ParsedAgentCompactArgs extends AgentCompactOptions {
  help?: boolean;
}

export interface DocsPageTarget {
  slug: string;
  url: string;
  pagePath: string;
  pageDir: string;
  agentPath: string;
  hasAgentFile: boolean;
}

export type AgentCompactionStateKind =
  | "fresh"
  | "stale"
  | "modified"
  | "stale-modified"
  | "missing"
  | "unknown";

export interface AgentCompactionState {
  status: AgentCompactionStateKind;
  sourceKind: GeneratedAgentSourceKind;
  pageOptions: AgentCompactOptions;
  sourceDocument: string;
  provenance?: GeneratedAgentProvenance;
  tokenBudget?: number;
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

    if (arg === "--changed") {
      parsed.changed = true;
      continue;
    }

    if (arg === "--stale") {
      parsed.stale = true;
      continue;
    }

    if (arg === "--include-missing") {
      parsed.includeMissing = true;
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

export function scanDocsPageTargets(
  rootDir: string,
  contentDir: string,
  entry: string,
): DocsPageTarget[] {
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

function runGitCommand(rootDir: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf-8",
  }).trim();
}

function normalizeGitRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}

function listGitChangedFiles(rootDir: string, contentDir: string): Set<string> {
  let gitRoot: string;
  try {
    gitRoot = runGitCommand(rootDir, ["rev-parse", "--show-toplevel"]);
  } catch {
    throw new Error("Use --changed inside a git repository.");
  }

  const contentDirAbs = path.resolve(rootDir, contentDir);
  const relativeContentDir = normalizeGitRelativePath(path.relative(gitRoot, contentDirAbs));

  if (!relativeContentDir || relativeContentDir.startsWith("../")) {
    throw new Error("Configured contentDir must live inside the current git repository for --changed.");
  }

  const changedFiles = new Set<string>();
  const commands = [
    ["diff", "--name-only", "--", relativeContentDir],
    ["diff", "--name-only", "--cached", "--", relativeContentDir],
    ["ls-files", "--others", "--exclude-standard", "--", relativeContentDir],
  ];

  for (const args of commands) {
    const output = runGitCommand(gitRoot, args);
    if (!output) continue;

    for (const line of output.split("\n")) {
      const normalized = normalizeGitRelativePath(line.trim());
      if (!normalized) continue;

      const absolutePath = path.resolve(gitRoot, normalized);
      const relativeToRoot = normalizeGitRelativePath(path.relative(rootDir, absolutePath));
      if (relativeToRoot && !relativeToRoot.startsWith("../")) {
        changedFiles.add(relativeToRoot);
      }
    }
  }

  return changedFiles;
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

export function readPageTokenBudget(pagePath: string): number | undefined {
  const source = readFileSync(pagePath, "utf-8");
  const { data } = matter(source);
  return normalizeTokenBudget((data as PageFrontmatter).agent?.tokenBudget);
}

function buildCompactionSettingsHash(options: AgentCompactOptions): string {
  return hashGeneratedAgentContent(
    JSON.stringify({
      model: options.model ?? DEFAULT_TTC_MODEL,
      aggressiveness: options.aggressiveness ?? DEFAULT_TTC_AGGRESSIVENESS,
      maxOutputTokens: options.maxOutputTokens ?? null,
      minOutputTokens: options.minOutputTokens ?? null,
      protectJson: options.protectJson ?? null,
    }),
  );
}

function buildPageOptions(
  defaults: AgentCompactOptions,
  pagePath: string,
): { pageOptions: AgentCompactOptions; tokenBudget?: number } {
  const tokenBudget = readPageTokenBudget(pagePath);
  const pageOptions = mergeAgentCompactOptions(defaults, {
    maxOutputTokens: tokenBudget,
  });

  if (
    pageOptions.minOutputTokens !== undefined &&
    pageOptions.maxOutputTokens !== undefined &&
    pageOptions.minOutputTokens > pageOptions.maxOutputTokens
  ) {
    pageOptions.minOutputTokens = pageOptions.maxOutputTokens;
  }

  return {
    pageOptions,
    tokenBudget,
  };
}

function buildResolvedPageSourceDocument(page: DocsMcpPage): string {
  return renderDocsMarkdownDocument({
    ...page,
    agentRawContent: undefined,
  });
}

function buildAgentSourceDocument(page: DocsMcpPage): string {
  if (typeof page.agentRawContent === "string") return page.agentRawContent;
  return renderDocsMarkdownDocument(page);
}

function readCurrentAgentDocument(target: DocsPageTarget) {
  if (!target.hasAgentFile || !existsSync(target.agentPath)) return undefined;
  const raw = readFileSync(target.agentPath, "utf-8");
  return parseGeneratedAgentDocument(raw);
}

function shouldCompactChangedAgentFile(target: DocsPageTarget): boolean {
  const currentDocument = readCurrentAgentDocument(target);
  if (!currentDocument) return false;
  if (!currentDocument.provenance) return true;
  if (currentDocument.provenance.sourceKind !== "agent-md") return false;
  return hashGeneratedAgentContent(currentDocument.content) !== currentDocument.provenance.outputHash;
}

function resolveSourceKindForCompaction(
  target: DocsPageTarget,
  currentDocument: ReturnType<typeof readCurrentAgentDocument>,
): GeneratedAgentSourceKind {
  if (!target.hasAgentFile) return "resolved-page";
  if (currentDocument?.provenance?.sourceKind === "resolved-page") return "resolved-page";
  return "agent-md";
}

function buildSourceDocumentForCompaction(
  page: DocsMcpPage,
  sourceKind: GeneratedAgentSourceKind,
): string {
  return sourceKind === "resolved-page"
    ? buildResolvedPageSourceDocument(page)
    : buildAgentSourceDocument(page);
}

function buildGeneratedAgentProvenance(
  sourceKind: GeneratedAgentSourceKind,
  sourceDocument: string,
  output: string,
  pageOptions: AgentCompactOptions,
): GeneratedAgentProvenance {
  return {
    version: GENERATED_AGENT_PROVENANCE_VERSION,
    sourceKind,
    sourceHash: hashGeneratedAgentContent(sourceDocument),
    settingsHash: buildCompactionSettingsHash(pageOptions),
    outputHash: hashGeneratedAgentContent(output),
    generatedAt: new Date().toISOString(),
  };
}

export function inspectAgentCompactionState(
  page: DocsMcpPage,
  target: DocsPageTarget,
  defaults: AgentCompactOptions,
): AgentCompactionState {
  const { pageOptions, tokenBudget } = buildPageOptions(defaults, target.pagePath);
  const currentDocument = readCurrentAgentDocument(target);

  if (!currentDocument) {
    return {
      status: "missing",
      sourceKind: "resolved-page",
      pageOptions,
      sourceDocument: buildResolvedPageSourceDocument(page),
      tokenBudget,
    };
  }

  const sourceKind = resolveSourceKindForCompaction(target, currentDocument);
  const sourceDocument = buildSourceDocumentForCompaction(page, sourceKind);

  if (!currentDocument.provenance) {
    return {
      status: "unknown",
      sourceKind,
      pageOptions,
      sourceDocument,
      tokenBudget,
    };
  }

  const outputModified =
    hashGeneratedAgentContent(currentDocument.content) !== currentDocument.provenance.outputHash;

  if (currentDocument.provenance.sourceKind === "agent-md") {
    // Once a handwritten sibling agent.md has been compacted in place, the original source text is
    // gone. We can still detect manual edits to the generated output, but we intentionally do not
    // guess at "fresh" vs "stale" from the page markdown because that would conflate two different
    // authoring sources. These files stay "unknown" unless the generated output itself changed.
    return {
      status: outputModified ? "modified" : "unknown",
      sourceKind,
      pageOptions,
      sourceDocument,
      provenance: currentDocument.provenance,
      tokenBudget,
    };
  }

  const sourceChanged =
    hashGeneratedAgentContent(sourceDocument) !== currentDocument.provenance.sourceHash;
  const settingsChanged =
    buildCompactionSettingsHash(pageOptions) !== currentDocument.provenance.settingsHash;

  return {
    status:
      outputModified && (sourceChanged || settingsChanged)
        ? "stale-modified"
        : outputModified
          ? "modified"
          : sourceChanged || settingsChanged
            ? "stale"
            : "fresh",
    sourceKind,
    pageOptions,
    sourceDocument,
    provenance: currentDocument.provenance,
    tokenBudget,
  };
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

function filterChangedPages(
  rootDir: string,
  contentDir: string,
  selectedPages: Array<{ page: DocsMcpPage; target: DocsPageTarget }>,
): Array<{ page: DocsMcpPage; target: DocsPageTarget }> {
  const changedFiles = listGitChangedFiles(rootDir, contentDir);

  return selectedPages.filter(({ target }) => {
    const relativePagePath = normalizeGitRelativePath(path.relative(rootDir, target.pagePath));
    if (changedFiles.has(relativePagePath)) return true;

    const relativeAgentPath = normalizeGitRelativePath(path.relative(rootDir, target.agentPath));
    return changedFiles.has(relativeAgentPath) && shouldCompactChangedAgentFile(target);
  });
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
  if (resolvedOptions.includeMissing && !resolvedOptions.stale) {
    throw new Error("Use --include-missing together with --stale.");
  }

  const requestedPages = resolvedOptions.pages?.filter((value) => value.trim().length > 0) ?? [];
  if (!resolvedOptions.all && requestedPages.length === 0 && !resolvedOptions.stale && !resolvedOptions.changed) {
    throw new Error("Pass --all, --changed, --stale, or at least one docs page slug/path to compact.");
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
  const selectAll =
    resolvedOptions.all === true ||
    (resolvedOptions.stale === true && requestedPages.length === 0) ||
    (resolvedOptions.changed === true && requestedPages.length === 0);
  const selectedPages = resolveSelectedPages(pages, targets, entry, requestedPages, selectAll);
  const filteredPages = resolvedOptions.changed
    ? filterChangedPages(rootDir, contentDir, selectedPages)
    : selectedPages;

  if (filteredPages.length === 0) {
    if (resolvedOptions.changed) {
      console.log(pc.green("No changed docs pages needed compaction."));
      return;
    }
    throw new Error("No compactable docs pages matched the request.");
  }

  let created = 0;
  let overwritten = 0;
  let processed = 0;
  let skippedFresh = 0;
  let skippedModified = 0;
  let skippedUnknown = 0;
  let skippedMissing = 0;
  const requestedExplicitPages = requestedPages.length > 0;

  for (const { page, target } of filteredPages) {
    const state = inspectAgentCompactionState(page, target, resolvedOptions);

    if (resolvedOptions.stale) {
      if (state.status === "fresh") {
        skippedFresh += 1;
        continue;
      }

      if (state.status === "modified" || state.status === "stale-modified") {
        skippedModified += 1;
        continue;
      }

      if (state.status === "unknown") {
        skippedUnknown += 1;
        continue;
      }

      if (state.status === "missing") {
      const shouldCreateMissing =
          resolvedOptions.includeMissing === true &&
          (requestedExplicitPages || state.tokenBudget !== undefined);

        if (!shouldCreateMissing) {
          skippedMissing += 1;
          continue;
        }
      }
    }

    const compressed = await compressDocument(state.sourceDocument, state.pageOptions);
    const nextContent = compressed.output.trimEnd();
    const generatedDocument = serializeGeneratedAgentDocument(
      nextContent,
      buildGeneratedAgentProvenance(
        state.sourceKind,
        state.sourceDocument,
        nextContent,
        state.pageOptions,
      ),
    );

    console.log(
      pc.dim(
        `Compacting ${page.url} (${compressed.original_input_tokens ?? "?"} -> ${compressed.output_tokens ?? "?"} tokens)...`,
      ),
    );

    if (resolvedOptions.dryRun) continue;

    mkdirSync(target.pageDir, { recursive: true });
    writeFileSync(target.agentPath, generatedDocument, "utf-8");

    if (target.hasAgentFile) overwritten += 1;
    else created += 1;
    processed += 1;
  }

  if (resolvedOptions.dryRun) {
    processed =
      filteredPages.length - skippedFresh - skippedModified - skippedUnknown - skippedMissing;
  }

  if (resolvedOptions.stale && processed === 0) {
    console.log(pc.green("No stale generated agent.md files needed updates."));
    if (skippedFresh + skippedModified + skippedUnknown + skippedMissing > 0) {
      console.log(
        pc.dim(
          `Skipped ${skippedFresh} fresh, ${skippedModified} modified, ${skippedUnknown} unknown, and ${skippedMissing} missing page${skippedFresh + skippedModified + skippedUnknown + skippedMissing === 1 ? "" : "s"}.`,
        ),
      );
    }
    return;
  }

  const summaryPrefix = resolvedOptions.dryRun ? "Dry run complete" : "Compaction complete";
  console.log(
    pc.green(
      `${summaryPrefix}: ${processed} page${processed === 1 ? "" : "s"} processed` +
        (resolvedOptions.dryRun ? "." : ` (${created} created, ${overwritten} overwritten).`),
    ),
  );

  if (resolvedOptions.stale) {
    console.log(
      pc.dim(
        `Skipped ${skippedFresh} fresh, ${skippedModified} modified, ${skippedUnknown} unknown, and ${skippedMissing} missing page${skippedFresh + skippedModified + skippedUnknown + skippedMissing === 1 ? "" : "s"}.`,
      ),
    );
  }
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
  ${pc.cyan("npx @farming-labs/docs@latest agent compact --changed")}
  ${pc.cyan("npx @farming-labs/docs@latest agent compact --stale")}
  ${pc.cyan("npx @farming-labs/docs@latest agent compact --stale --include-missing")}

${pc.dim("Per-page override:")}
  Add ${pc.cyan("agent.tokenBudget")} to a page frontmatter block to override the compact output target for that page.

${pc.dim("Options:")}
  ${pc.cyan("--all")}                    Compact every folder-based docs page under the configured contentDir
  ${pc.cyan("--page <slug|path>")}       Add a page explicitly (repeatable); positional page args work too
  ${pc.cyan("--changed")}                Compact only docs pages changed in the current git working tree
  ${pc.cyan("--stale")}                  Re-compact only stale generated agent.md files
  ${pc.cyan("--include-missing")}        With ${pc.cyan("--stale")}, also create missing agent.md files for explicit pages or pages that define ${pc.cyan("agent.tokenBudget")}
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

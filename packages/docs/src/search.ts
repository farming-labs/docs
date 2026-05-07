import type {
  AlgoliaDocsSearchConfig,
  CustomDocsSearchConfig,
  DocsSearchAdapter,
  DocsSearchAdapterFactory,
  DocsSearchAdapterContext,
  DocsSearchConfig,
  DocsSearchDocument,
  DocsSearchQuery,
  DocsSearchResult,
  DocsSearchSourcePage,
  DocsSearchChunkingConfig,
  McpDocsSearchConfig,
  TypesenseDocsSearchConfig,
} from "./types.js";

const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_MCP_PROTOCOL_VERSION = "2025-11-25";
const syncedIndexes = new Set<string>();
const ALGOLIA_MAX_RECORD_BYTES = 9_500;
const DEFAULT_ASK_AI_CONTEXT_CHARS = 24_000;
const DEFAULT_ASK_AI_RESULT_CHARS = 6_000;
const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "use",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

interface ResolvedDocsSearchConfig {
  enabled: boolean;
  provider: "simple" | "algolia" | "typesense" | "mcp" | "custom";
  maxResults: number;
  chunking: DocsSearchChunkingConfig;
  raw?: DocsSearchConfig;
}

export interface DocsAskAIContextResult extends DocsSearchResult {
  title: string;
  contextContent: string;
}

export interface DocsAskAIContext {
  context: string;
  results: DocsAskAIContextResult[];
  searchResults: DocsSearchResult[];
  packageHints: DocsAskAIPackageHints;
}

export interface DocsAskAIPackageHints {
  packages: string[];
  imports: string[];
  installCommands: string[];
}

function stripMarkdownText(content: string): string {
  return removeMdxModuleLinesOutsideFences(content)
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/~~~[^\n]*\n([\s\S]*?)~~~/g, "$1")
    .replace(/~~~([\s\S]*?)~~~/g, "$1")
    .replace(/<[^>]+\/>/g, "")
    .replace(/<\/?[A-Z][^>]*>/g, "")
    .replace(/<\/?[a-z][^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/`{3,}[^\n]*$/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/`+/g, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function normalizeMcpSsePayload(body: string) {
  const dataLines = body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length).trim())
    .filter(Boolean);

  const payload = dataLines.at(-1);
  return payload ? JSON.parse(payload) : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tokenizeSearchQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}@/_:.-]+/gu, " ")
        .split(/\s+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{N}]+$/gu, ""))
        .filter((word) => word.length > 1 && !SEARCH_STOP_WORDS.has(word)),
    ),
  );
}

function normalizeUrlPathname(value: string): string {
  try {
    return new URL(value, "https://docs.local").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value.split(/[?#]/)[0]?.replace(/\/+$/, "") || "/";
  }
}

function resolveAskAIContextUrl(value: string, baseUrl?: string): string {
  if (!baseUrl) return value;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function getAskAIPageContent(page: DocsSearchSourcePage): string {
  return page.agentRawContent ?? page.agentFallbackRawContent ?? page.rawContent ?? page.content;
}

function removeMdxModuleLinesOutsideFences(content: string): string {
  let inFence = false;

  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inFence = !inFence;
        return true;
      }

      return inFence || !/^(import|export)\s/.test(trimmed);
    })
    .join("\n");
}

function cleanAskAIContextMarkdown(content: string): string {
  return removeMdxModuleLinesOutsideFences(content)
    .replace(/<[^>]+\/>/g, "")
    .replace(/<\/?[A-Z][^>]*>/g, "")
    .replace(/<\/?[a-z][^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function packageRootFromSpecifier(specifier: string): string | null {
  if (
    !specifier ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("~/") ||
    specifier.startsWith("#")
  ) {
    return null;
  }

  const parts = specifier.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0]?.startsWith("@")) {
    return parts.length > 1 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0];
}

function cleanPackageToken(token: string): string | null {
  const trimmed = token
    .trim()
    .replace(/^["'`]+|["'`,;]+$/g, "")
    .replace(/\\$/g, "");

  if (!trimmed || trimmed.startsWith("-") || /^[A-Z_][A-Z0-9_]*=/.test(trimmed)) return null;
  if (/^(npm|pnpm|yarn|bun|install|add|i|x|dlx|run|exec)$/.test(trimmed)) return null;

  const withoutVersion = trimmed.startsWith("@")
    ? trimmed.replace(/^(@[^/]+\/[^@]+)@.+$/, "$1")
    : trimmed.replace(/^([^@]+)@.+$/, "$1");

  return packageRootFromSpecifier(withoutVersion);
}

export function inferDocsAskAIPackageHints(content: string): DocsAskAIPackageHints {
  const packages = new Set<string>();
  const imports = new Set<string>();
  const installCommands = new Set<string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const importSpecifier = trimmed.match(
      /^(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/,
    )?.[1];
    const bareImportSpecifier = trimmed.match(/^import\s+["']([^"']+)["']/)?.[1];
    const requireSpecifier = trimmed.match(/require\(["']([^"']+)["']\)/)?.[1];
    const specifier = importSpecifier ?? bareImportSpecifier ?? requireSpecifier;
    const packageName = specifier ? packageRootFromSpecifier(specifier) : null;

    if (packageName) {
      packages.add(packageName);
      if (/^(?:import|export)\s/.test(trimmed)) {
        imports.add(trimmed);
      }
    }

    const installMatch = trimmed.match(
      /^(?:npm\s+(?:install|i)|pnpm\s+add|yarn\s+add|bun\s+add)\s+(.+)$/,
    );
    if (!installMatch) continue;

    const commandPackages = installMatch[1]
      .split(/\s+/)
      .map(cleanPackageToken)
      .filter((value): value is string => Boolean(value));

    if (commandPackages.length > 0) {
      installCommands.add(trimmed);
      for (const name of commandPackages) packages.add(name);
    }
  }

  return {
    packages: Array.from(packages).slice(0, 8),
    imports: Array.from(imports).slice(0, 12),
    installCommands: Array.from(installCommands).slice(0, 8),
  };
}

export function formatDocsAskAIPackageHints(
  hints: DocsAskAIPackageHints,
  packageName?: string,
): string | undefined {
  const packages = packageName
    ? Array.from(new Set([packageName, ...hints.packages]))
    : hints.packages;

  if (packages.length === 0 && hints.imports.length === 0 && hints.installCommands.length === 0) {
    return undefined;
  }

  const lines = ["Package and import hints inferred from the retrieved documentation context:"];

  if (packages.length > 0) {
    lines.push(`- Package names found in install/import examples: ${packages.join(", ")}`);
  }

  if (hints.imports.length > 0) {
    lines.push(
      `- Exact import lines found in context: ${hints.imports.map((line) => `\`${line}\``).join("; ")}`,
    );
  }

  if (hints.installCommands.length > 0) {
    lines.push(
      `- Exact install commands found in context: ${hints.installCommands
        .map((line) => `\`${line}\``)
        .join("; ")}`,
    );
  }

  lines.push(
    "Use these exact package names, install commands, and import lines when relevant. Do not replace them with placeholders.",
  );

  return lines.join("\n");
}

function clampText(value: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}...`;
}

function extractHeadingText(line: string): { level: number; text: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: normalizeWhitespace(match[2].replace(/[`*_~]/g, "")),
  };
}

function extractSectionMarkdown(content: string, section?: string): string {
  if (!section) return content;

  const target = normalizeWhitespace(section).toLowerCase();
  const lines = content.split("\n");
  let start = -1;
  let level = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const heading = extractHeadingText(lines[i]);
    if (!heading) continue;

    if (heading.text.toLowerCase() === target) {
      start = i;
      level = heading.level;
      break;
    }
  }

  if (start === -1) return content;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const heading = extractHeadingText(lines[i]);
    if (heading && heading.level <= level) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join("\n");
}

function findPageForSearchResult(
  pages: DocsSearchSourcePage[],
  result: DocsSearchResult,
): DocsSearchSourcePage | undefined {
  const resultPath = normalizeUrlPathname(result.url);
  return pages.find((page) => normalizeUrlPathname(page.url) === resultPath);
}

function inferResultTitle(result: DocsSearchResult, page?: DocsSearchSourcePage): string {
  if (page) return page.title;

  const content = stripHtml(result.content).trim();
  const title = content.split("—")[0]?.trim();
  return title || result.url;
}

function formatAskAIContextResult(options: {
  result: DocsSearchResult;
  page?: DocsSearchSourcePage;
  maxChars: number;
  baseUrl?: string;
}): DocsAskAIContextResult {
  const { result, page, maxChars, baseUrl } = options;
  const title = inferResultTitle(result, page);
  const section = result.section;
  const rawContent = page
    ? extractSectionMarkdown(getAskAIPageContent(page), section)
    : [result.content, result.description].filter(Boolean).join("\n\n");
  const contextContent = clampText(cleanAskAIContextMarkdown(rawContent), maxChars);

  return {
    ...result,
    url: resolveAskAIContextUrl(result.url, baseUrl),
    title,
    contextContent,
  };
}

function getSearchResultKey(result: DocsSearchResult): string {
  let hash = "";

  try {
    hash = new URL(result.url, "https://docs.local").hash.replace(/^#/, "");
  } catch {
    hash = result.url.split("#")[1]?.split(/[?&]/)[0] ?? "";
  }

  return `${normalizeUrlPathname(result.url)}#${normalizeWhitespace(
    hash || result.section || "",
  ).toLowerCase()}`;
}

function mergeSearchResults(...groups: DocsSearchResult[][]): DocsSearchResult[] {
  const seen = new Set<string>();
  const results: DocsSearchResult[] = [];

  for (const group of groups) {
    for (const result of group) {
      const key = getSearchResultKey(result);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(result);
    }
  }

  return results;
}

function shouldSupplementAskAIWithSimpleSearch(search: ResolvedDocsSearchConfig): boolean {
  return search.enabled && search.provider !== "simple";
}

function rankAskAIContextResult(query: string, result: DocsAskAIContextResult): number {
  return scoreDocument(query, {
    id: result.id,
    url: result.url,
    title: result.title,
    content: result.contextContent,
    description: result.description,
    type: result.type,
    section: result.section,
  });
}

function buildAskAIContextBlock(result: DocsAskAIContextResult): string {
  const lines = [`## ${result.title}`, `URL: ${result.url}`];
  if (result.section) lines.push(`Section: ${result.section}`);
  if (result.description) lines.push(`Search snippet: ${result.description}`);
  lines.push("", result.contextContent);
  return lines.join("\n").trim();
}

function makeDocumentId(url: string, suffix: string): string {
  return `${url}#${suffix}`;
}

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`'"‘’“”]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitPageIntoSections(page: DocsSearchSourcePage): DocsSearchDocument[] {
  const raw = page.rawContent ?? page.content;
  const lines = raw.split("\n");
  const sections: DocsSearchDocument[] = [];
  const headingCounts = new Map<string, number>();

  let currentHeading = "";
  let currentLines: string[] = [];
  let index = 0;

  function flush() {
    const rawSection = currentLines.join("\n").trim();
    const content = normalizeWhitespace(stripMarkdownText(rawSection));
    if (!content) return;

    let url = page.url;
    if (currentHeading) {
      const baseSlug = slugifyHeading(currentHeading) || `section-${index}`;
      const seen = headingCounts.get(baseSlug) ?? 0;
      headingCounts.set(baseSlug, seen + 1);
      const slug = seen === 0 ? baseSlug : `${baseSlug}-${seen}`;
      url = `${page.url}#${slug}`;
    }

    sections.push({
      id: makeDocumentId(page.url, currentHeading ? `section-${index}` : "page"),
      url,
      title: page.title,
      section: currentHeading || undefined,
      content,
      description: page.description,
      type: currentHeading ? "heading" : "page",
      locale: page.locale,
      framework: page.framework,
      version: page.version,
      tags: page.tags,
    });
    index += 1;
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = normalizeWhitespace(headingMatch[1].replace(/#+$/g, ""));
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return sections;
}

export function buildDocsSearchDocuments(
  pages: DocsSearchSourcePage[],
  chunking: DocsSearchChunkingConfig = {},
): DocsSearchDocument[] {
  const strategy = chunking.strategy ?? "section";

  return pages.flatMap((page) => {
    const base: DocsSearchDocument = {
      id: makeDocumentId(page.url, "page"),
      url: page.url,
      title: page.title,
      content: normalizeWhitespace(page.content),
      description: page.description,
      type: "page",
      locale: page.locale,
      framework: page.framework,
      version: page.version,
      tags: page.tags,
    };

    if (strategy === "page") return [base];

    const sections = splitPageIntoSections(page);
    if (sections.length === 0) return [base];

    const pageSummary = base.content ? [base] : [];
    return [...pageSummary, ...sections];
  });
}

function scoreDocument(query: string, document: DocsSearchDocument): number {
  const q = normalizeWhitespace(query.toLowerCase().replace(/[?!.,;:]+$/g, ""));
  if (!q) return 0;

  const words = tokenizeSearchQuery(q);
  const title = document.title.toLowerCase();
  const section = document.section?.toLowerCase() ?? "";
  const description = document.description?.toLowerCase() ?? "";
  const content = document.content.toLowerCase();
  const url = document.url.toLowerCase();
  const titleTokens = tokenizeSearchQuery(title);
  const sectionTokens = tokenizeSearchQuery(section);

  let score = 0;

  if (title === q) score += 120;
  else if (title.startsWith(q)) score += 70;
  else if (title.includes(q)) score += 45;

  if (section === q) score += 80;
  else if (section.startsWith(q)) score += 55;
  else if (section.includes(q)) score += 30;

  if (url.includes(q)) score += 12;
  if (description.includes(q)) score += 18;
  if (content.includes(q)) score += 12;

  let matchedWords = 0;

  for (const word of words) {
    let matched = false;

    if (title === word) {
      score += 28;
      matched = true;
    } else if (title.startsWith(word)) {
      score += 20;
      matched = true;
    } else if (title.includes(word)) {
      score += 12;
      matched = true;
    }

    if (section === word) {
      score += 22;
      matched = true;
    } else if (section.startsWith(word)) {
      score += 16;
      matched = true;
    } else if (section.includes(word)) {
      score += 10;
      matched = true;
    }

    if (description.includes(word)) {
      score += 6;
      matched = true;
    }

    if (content.includes(word)) {
      score += 4;
      matched = true;
    }

    if (matched) matchedWords += 1;
  }

  if (words.length > 1) {
    if (sectionTokens.length > 0 && words.every((word) => sectionTokens.includes(word))) {
      score += 30;
    }
    if (
      document.type === "page" &&
      titleTokens.length > 0 &&
      words.every((word) => titleTokens.includes(word))
    ) {
      score += 24;
    }
  }

  if (matchedWords === words.length && words.length > 1) score += 20;
  if (document.type === "heading") score += 6;

  return score;
}

function buildSnippet(document: DocsSearchDocument, query: string): string | undefined {
  const q = query.trim().toLowerCase();
  const sources = [
    normalizeWhitespace(stripMarkdownText(document.content)),
    normalizeWhitespace(stripMarkdownText(document.description ?? "")),
  ].filter(Boolean);

  for (const source of sources) {
    if (!q) return source.slice(0, 160);

    const idx = source.toLowerCase().indexOf(q);
    if (idx === -1) continue;

    const start = Math.max(0, idx - 48);
    const end = Math.min(source.length, idx + q.length + 96);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < source.length ? "..." : "";
    return `${prefix}${source.slice(start, end).trim()}${suffix}`;
  }

  return sources[0]?.slice(0, 160);
}

function cleanSearchResultText(value?: string): string | undefined {
  if (!value) return undefined;

  const cleaned = normalizeWhitespace(stripHtml(stripMarkdownText(value)));
  return cleaned || undefined;
}

function trimTextToBytes(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";

  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= maxBytes) return value;

  let low = 0;
  let high = value.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const next = `${value.slice(0, mid).trimEnd()}...`;
    if (encoder.encode(next).length <= maxBytes) {
      best = next;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function buildAlgoliaRecord(document: DocsSearchDocument) {
  const record: Record<string, unknown> = {
    objectID: document.id,
    id: document.id,
    url: document.url,
    title: document.title,
    section: document.section,
    content: document.content,
    description: document.description,
    type: document.type,
  };

  const encoder = new TextEncoder();
  const sizeOf = (value: Record<string, unknown>) => encoder.encode(JSON.stringify(value)).length;
  if (sizeOf(record) <= ALGOLIA_MAX_RECORD_BYTES) return record;

  delete record.description;
  if (sizeOf(record) <= ALGOLIA_MAX_RECORD_BYTES) return record;

  const baseRecord = { ...record, content: "" };
  const fixedBytes = sizeOf(baseRecord);
  const remainingBytes = Math.max(ALGOLIA_MAX_RECORD_BYTES - fixedBytes - 32, 0);
  record.content = trimTextToBytes(document.content, remainingBytes);

  return record;
}

export function createSimpleSearchAdapter(): DocsSearchAdapter {
  return {
    name: "simple",
    async search(query, context) {
      const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;

      return context.documents
        .map((document) => ({
          document,
          score: scoreDocument(query.query, document),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.document.url.localeCompare(b.document.url);
        })
        .slice(0, limit)
        .map(({ document, score }) => ({
          id: document.id,
          url: document.url,
          content:
            cleanSearchResultText(
              document.section ? `${document.title} — ${document.section}` : document.title,
            ) ?? (document.section ? `${document.title} — ${document.section}` : document.title),
          description: cleanSearchResultText(
            buildSnippet(document, query.query) ?? document.description,
          ),
          type: document.type,
          score,
          section: document.section,
        }));
    },
  };
}

function normalizeDocsSearchConfig(search?: boolean | DocsSearchConfig): ResolvedDocsSearchConfig {
  if (search === false) {
    return {
      enabled: false,
      provider: "simple",
      maxResults: DEFAULT_SEARCH_LIMIT,
      chunking: { strategy: "section" },
    };
  }

  if (!search || search === true) {
    return {
      enabled: true,
      provider: "simple",
      maxResults: DEFAULT_SEARCH_LIMIT,
      chunking: { strategy: "section" },
      raw: typeof search === "object" ? search : undefined,
    };
  }

  const provider = search.provider ?? "simple";
  const maxResults = search.maxResults ?? DEFAULT_SEARCH_LIMIT;
  const chunking = search.chunking ?? { strategy: "section" };

  return {
    enabled: search.enabled ?? true,
    provider,
    maxResults,
    chunking,
    raw: search,
  };
}

async function readResponseJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readMcpResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  return normalizeMcpSsePayload(text);
}

function ensureOk(response: Response, message: string) {
  if (response.ok) return;
  throw new Error(`${message} (${response.status} ${response.statusText})`);
}

function ensureJsonRpcOk(payload: unknown, message: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error
  ) {
    throw new Error(`${message}: ${String(payload.error.message)}`);
  }
}

function resolveMcpEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  throw new Error(
    "Relative MCP search endpoints must be resolved before creating the MCP adapter.",
  );
}

function isDocsSearchResultType(value: unknown): value is DocsSearchResult["type"] {
  return value === "page" || value === "heading" || value === "text";
}

function mapMcpSearchResult(value: unknown): DocsSearchResult | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  const section = typeof item.section === "string" ? item.section : undefined;
  const title = typeof item.title === "string" ? item.title : undefined;
  const content =
    typeof item.content === "string"
      ? item.content
      : title
        ? section
          ? `${title} — ${section}`
          : title
        : undefined;
  const url = typeof item.url === "string" ? item.url : undefined;

  if (!content || !url) return null;

  return {
    id: typeof item.id === "string" ? item.id : typeof item.slug === "string" ? item.slug : url,
    url,
    content: cleanSearchResultText(content) ?? content,
    description:
      cleanSearchResultText(
        typeof item.description === "string"
          ? item.description
          : typeof item.excerpt === "string"
            ? item.excerpt
            : undefined,
      ) ?? undefined,
    type: isDocsSearchResultType(item.type) ? item.type : section ? "heading" : "page",
    score: typeof item.score === "number" ? item.score : undefined,
    section,
  };
}

async function createOllamaEmbedding(
  text: string,
  config: NonNullable<TypesenseDocsSearchConfig["embeddings"]>,
): Promise<number[]> {
  const response = await fetch(
    `${(config.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "")}/api/embed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        input: text,
      }),
    },
  );
  ensureOk(response, "Failed to create Ollama embedding");

  const payload = (await readResponseJson(response)) as
    | { embeddings?: number[][] }
    | { embedding?: number[] };

  if (Array.isArray((payload as { embeddings?: number[][] }).embeddings?.[0])) {
    return (payload as { embeddings: number[][] }).embeddings[0];
  }

  if (Array.isArray((payload as { embedding?: number[] }).embedding)) {
    return (payload as { embedding: number[] }).embedding;
  }

  throw new Error("Ollama embedding response did not include an embedding vector.");
}

function getTypesenseSearchBase(config: TypesenseDocsSearchConfig): string {
  return config.baseUrl.replace(/\/$/, "");
}

async function ensureTypesenseCollection(config: TypesenseDocsSearchConfig, dimensions?: number) {
  const baseUrl = getTypesenseSearchBase(config);
  const headers = {
    "X-TYPESENSE-API-KEY": config.adminApiKey ?? config.apiKey,
    "Content-Type": "application/json",
  };

  const existing = await fetch(`${baseUrl}/collections/${encodeURIComponent(config.collection)}`, {
    headers,
  });

  if (existing.ok) return;
  if (existing.status !== 404) {
    ensureOk(existing, "Failed to inspect Typesense collection");
  }

  const fields: Array<Record<string, unknown>> = [
    { name: "id", type: "string" },
    { name: "url", type: "string" },
    { name: "title", type: "string" },
    { name: "section", type: "string", optional: true },
    { name: "content", type: "string" },
    { name: "description", type: "string", optional: true },
    { name: "type", type: "string" },
    { name: "locale", type: "string", optional: true },
    { name: "framework", type: "string", optional: true },
    { name: "version", type: "string", optional: true },
    { name: "tags", type: "string[]", optional: true },
  ];

  if (config.embeddings && dimensions) {
    fields.push({
      name: "embedding",
      type: "float[]",
      num_dim: dimensions,
      optional: true,
    });
  }

  const response = await fetch(`${baseUrl}/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: config.collection,
      fields,
    }),
  });

  ensureOk(response, "Failed to create Typesense collection");
}

export function createTypesenseSearchAdapter(config: TypesenseDocsSearchConfig): DocsSearchAdapter {
  return {
    name: "typesense",
    async index(context) {
      const adminApiKey = config.adminApiKey ?? config.apiKey;
      const docsForImport = await Promise.all(
        context.documents.map(async (document) => {
          const next: Record<string, unknown> = {
            id: document.id,
            url: document.url,
            title: document.title,
            section: document.section,
            content: document.content,
            description: document.description,
            type: document.type,
            locale: document.locale,
            framework: document.framework,
            version: document.version,
            tags: document.tags,
          };

          if (config.mode === "hybrid" && config.embeddings) {
            next.embedding = await createOllamaEmbedding(
              `${document.title}\n${document.section ?? ""}\n${document.content}`.trim(),
              config.embeddings,
            );
          }

          return next;
        }),
      );

      if (docsForImport.length === 0) return;

      const embeddingDimensions = Array.isArray(docsForImport[0]?.embedding)
        ? (docsForImport[0].embedding as number[]).length
        : undefined;

      await ensureTypesenseCollection(config, embeddingDimensions);

      const response = await fetch(
        `${getTypesenseSearchBase(config)}/collections/${encodeURIComponent(config.collection)}/documents/import?action=upsert`,
        {
          method: "POST",
          headers: {
            "X-TYPESENSE-API-KEY": adminApiKey,
            "Content-Type": "text/plain",
          },
          body: docsForImport.map((document) => JSON.stringify(document)).join("\n"),
        },
      );

      ensureOk(response, "Failed to sync documents to Typesense");
    },
    async search(query, _context) {
      const params = new URLSearchParams({
        q: query.query,
        query_by: (config.queryBy ?? ["title", "section", "content", "description"]).join(","),
        per_page: String(query.limit ?? config.maxResults ?? DEFAULT_SEARCH_LIMIT),
        prioritize_exact_match: "true",
        num_typos: "2",
        highlight_fields: "content,title,section,description",
      });

      if (config.mode === "hybrid" && config.embeddings) {
        const vector = await createOllamaEmbedding(query.query, config.embeddings);
        params.set(
          "vector_query",
          `embedding:([${vector.join(",")}],k:${Math.max((query.limit ?? 10) * 4, 20)})`,
        );
      }

      const response = await fetch(
        `${getTypesenseSearchBase(config)}/collections/${encodeURIComponent(config.collection)}/documents/search?${params.toString()}`,
        {
          headers: {
            "X-TYPESENSE-API-KEY": config.apiKey,
          },
        },
      );

      ensureOk(response, "Typesense search failed");
      const payload = (await readResponseJson(response)) as {
        hits?: Array<{
          document?: Record<string, unknown>;
          text_match?: number;
          highlights?: Array<{ field?: string; snippet?: string }>;
        }>;
      };

      return (payload.hits ?? []).map((hit) => {
        const document = hit.document ?? {};
        const section = typeof document.section === "string" ? document.section : undefined;
        const content =
          typeof document.title === "string"
            ? section
              ? `${document.title} — ${section}`
              : document.title
            : typeof document.content === "string"
              ? document.content
              : "Untitled result";
        const description =
          hit.highlights?.find((item) => item.field === "content")?.snippet ??
          hit.highlights?.find((item) => item.field === "description")?.snippet ??
          (typeof document.description === "string" ? document.description : undefined);

        return {
          id: typeof document.id === "string" ? document.id : String(document.url ?? content),
          url: typeof document.url === "string" ? document.url : "/docs",
          content: cleanSearchResultText(content) ?? content,
          description: cleanSearchResultText(description),
          type:
            typeof document.type === "string" && ["page", "heading", "text"].includes(document.type)
              ? (document.type as DocsSearchResult["type"])
              : section
                ? "heading"
                : "page",
          score: hit.text_match,
          section,
        } satisfies DocsSearchResult;
      });
    },
  };
}

export function resolveSearchRequestConfig(
  search: boolean | DocsSearchConfig | undefined,
  requestUrl?: string,
): boolean | DocsSearchConfig | undefined {
  if (!search || search === true || typeof search !== "object" || search.provider !== "mcp") {
    return search;
  }

  if (/^https?:\/\//i.test(search.endpoint) || !requestUrl) return search;

  return {
    ...search,
    endpoint: new URL(search.endpoint, requestUrl).toString(),
  };
}

export function createMcpSearchAdapter(config: McpDocsSearchConfig): DocsSearchAdapter {
  return {
    name: "mcp",
    async search(query) {
      const endpoint = resolveMcpEndpoint(config.endpoint);
      const protocolVersion = config.protocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION;
      const toolName = config.toolName ?? "search_docs";
      const baseHeaders = config.headers ?? {};

      const initializeResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "Content-Type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": protocolVersion,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion,
            capabilities: {},
            clientInfo: {
              name: "@farming-labs/docs-search",
              version: "0.1.2",
            },
          },
        }),
      });

      const initializePayload = await readMcpResponsePayload(initializeResponse);
      ensureOk(initializeResponse, "MCP search initialization failed");
      ensureJsonRpcOk(initializePayload, "MCP search initialization failed");

      const sessionId = initializeResponse.headers.get("mcp-session-id");
      if (!sessionId) {
        throw new Error("MCP search endpoint did not return an mcp-session-id header.");
      }

      try {
        const searchResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            ...baseHeaders,
            "Content-Type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": protocolVersion,
            "mcp-session-id": sessionId,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: toolName,
              arguments: {
                query: query.query,
                limit: query.limit ?? config.maxResults ?? DEFAULT_SEARCH_LIMIT,
                locale: query.locale,
              },
            },
          }),
        });

        const payload = await readMcpResponsePayload(searchResponse);
        ensureOk(searchResponse, "MCP search request failed");
        ensureJsonRpcOk(payload, "MCP search request failed");

        const resultText =
          payload &&
          typeof payload === "object" &&
          "result" in payload &&
          payload.result &&
          typeof payload.result === "object" &&
          "content" in payload.result &&
          Array.isArray(payload.result.content) &&
          typeof payload.result.content[0]?.text === "string"
            ? payload.result.content[0].text
            : null;

        if (!resultText) return [];

        const parsed = JSON.parse(resultText) as
          | { results?: unknown[]; pages?: unknown[] }
          | unknown[];

        const rawResults = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.results)
            ? parsed.results
            : Array.isArray(parsed.pages)
              ? parsed.pages
              : [];

        return rawResults
          .map(mapMcpSearchResult)
          .filter((result): result is DocsSearchResult => Boolean(result));
      } finally {
        await fetch(endpoint, {
          method: "DELETE",
          headers: {
            ...baseHeaders,
            "mcp-protocol-version": protocolVersion,
            "mcp-session-id": sessionId,
          },
        }).catch(() => undefined);
      }
    },
  };
}

function getAlgoliaBase(config: AlgoliaDocsSearchConfig): string {
  return `https://${config.appId}-dsn.algolia.net`;
}

export function createAlgoliaSearchAdapter(config: AlgoliaDocsSearchConfig): DocsSearchAdapter {
  return {
    name: "algolia",
    async index(context) {
      if (!config.adminApiKey) return;

      const response = await fetch(
        `${getAlgoliaBase(config)}/1/indexes/${encodeURIComponent(config.indexName)}/batch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Algolia-Application-Id": config.appId,
            "X-Algolia-API-Key": config.adminApiKey,
          },
          body: JSON.stringify({
            requests: context.documents.map((document) => ({
              action: "addObject",
              body: buildAlgoliaRecord(document),
            })),
          }),
        },
      );

      ensureOk(response, "Failed to sync documents to Algolia");
    },
    async search(query) {
      const response = await fetch(
        `${getAlgoliaBase(config)}/1/indexes/${encodeURIComponent(config.indexName)}/query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Algolia-Application-Id": config.appId,
            "X-Algolia-API-Key": config.searchApiKey,
          },
          body: JSON.stringify({
            query: query.query,
            hitsPerPage: query.limit ?? config.maxResults ?? DEFAULT_SEARCH_LIMIT,
            attributesToSnippet: ["content:20"],
          }),
        },
      );

      ensureOk(response, "Algolia search failed");
      const payload = (await readResponseJson(response)) as {
        hits?: Array<
          Record<string, unknown> & {
            objectID?: string;
            _rankingInfo?: { nbTypos?: number };
            _snippetResult?: {
              content?: { value?: string };
              description?: { value?: string };
            };
          }
        >;
      };

      return (payload.hits ?? []).map((hit) => {
        const title = typeof hit.title === "string" ? hit.title : "Untitled result";
        const section = typeof hit.section === "string" ? hit.section : undefined;
        return {
          id: hit.objectID ?? String(hit.url ?? title),
          url: typeof hit.url === "string" ? hit.url : "/docs",
          content: cleanSearchResultText(section ? `${title} — ${section}` : title) ?? title,
          description: cleanSearchResultText(
            hit._snippetResult?.content?.value ??
              hit._snippetResult?.description?.value ??
              (typeof hit.description === "string" ? hit.description : undefined),
          ),
          type:
            typeof hit.type === "string" && ["page", "heading", "text"].includes(hit.type)
              ? (hit.type as DocsSearchResult["type"])
              : section
                ? "heading"
                : "page",
          score: hit._rankingInfo?.nbTypos != null ? 100 - hit._rankingInfo.nbTypos : undefined,
          section,
        } satisfies DocsSearchResult;
      });
    },
  };
}

async function resolveSearchAdapter(
  search: ResolvedDocsSearchConfig,
  context: DocsSearchAdapterContext,
): Promise<DocsSearchAdapter> {
  const raw = search.raw;

  if (search.provider === "custom" && raw?.provider === "custom") {
    const adapter =
      typeof raw.adapter === "function"
        ? await raw.adapter(context)
        : (raw.adapter as DocsSearchAdapter);
    return adapter;
  }

  if (search.provider === "typesense" && raw?.provider === "typesense") {
    return createTypesenseSearchAdapter(raw);
  }

  if (search.provider === "mcp" && raw?.provider === "mcp") {
    return createMcpSearchAdapter(raw);
  }

  if (search.provider === "algolia" && raw?.provider === "algolia") {
    return createAlgoliaSearchAdapter(raw);
  }

  return createSimpleSearchAdapter();
}

function shouldSyncOnSearch(search: ResolvedDocsSearchConfig): boolean {
  const raw = search.raw;
  if (search.provider === "algolia" && raw?.provider === "algolia") {
    return (raw.syncOnSearch ?? Boolean(raw.adminApiKey)) && Boolean(raw.adminApiKey);
  }

  if (search.provider === "typesense" && raw?.provider === "typesense") {
    return (raw.syncOnSearch ?? Boolean(raw.adminApiKey)) && Boolean(raw.adminApiKey);
  }

  return false;
}

function getSyncKey(search: ResolvedDocsSearchConfig, context: DocsSearchAdapterContext): string {
  const raw = search.raw;

  if (search.provider === "algolia" && raw?.provider === "algolia") {
    return `algolia:${raw.appId}:${raw.indexName}:${context.locale ?? "__default__"}`;
  }

  if (search.provider === "typesense" && raw?.provider === "typesense") {
    return `typesense:${raw.baseUrl}:${raw.collection}:${context.locale ?? "__default__"}`;
  }

  if (search.provider === "mcp" && raw?.provider === "mcp") {
    return `mcp:${raw.endpoint}:${context.locale ?? "__default__"}`;
  }

  return `${search.provider}:${context.locale ?? "__default__"}`;
}

async function maybeSyncSearchIndex(
  adapter: DocsSearchAdapter,
  search: ResolvedDocsSearchConfig,
  context: DocsSearchAdapterContext,
) {
  if (!shouldSyncOnSearch(search) || typeof adapter.index !== "function") return;

  const syncKey = getSyncKey(search, context);
  if (syncedIndexes.has(syncKey)) return;

  await adapter.index(context);
  syncedIndexes.add(syncKey);
}

export async function performDocsSearch(options: {
  pages: DocsSearchSourcePage[];
  query: string;
  search?: boolean | DocsSearchConfig;
  locale?: string;
  pathname?: string;
  siteTitle?: string;
  limit?: number;
}): Promise<DocsSearchResult[]> {
  const search = normalizeDocsSearchConfig(options.search);
  if (!search.enabled) return [];

  const documents = buildDocsSearchDocuments(options.pages, search.chunking);
  const context: DocsSearchAdapterContext = {
    pages: options.pages,
    documents,
    locale: options.locale,
    pathname: options.pathname,
    siteTitle: options.siteTitle,
  };

  const query: DocsSearchQuery = {
    query: options.query,
    limit: options.limit ?? search.maxResults,
    locale: options.locale,
    pathname: options.pathname,
  };

  try {
    const adapter = await resolveSearchAdapter(search, context);
    await maybeSyncSearchIndex(adapter, search, context);
    return await adapter.search(query, context);
  } catch {
    return createSimpleSearchAdapter().search(query, context);
  }
}

export async function buildDocsAskAIContext(options: {
  pages: DocsSearchSourcePage[];
  query: string;
  search?: boolean | DocsSearchConfig;
  locale?: string;
  pathname?: string;
  siteTitle?: string;
  baseUrl?: string;
  limit?: number;
  maxContextChars?: number;
  maxResultChars?: number;
}): Promise<DocsAskAIContext> {
  const limit = options.limit ?? 5;
  const searchLimit = Math.max(limit * 2, limit);
  const initialSearch = options.search === false ? true : options.search;
  const initialSearchConfig = normalizeDocsSearchConfig(initialSearch);
  const primarySearch = initialSearchConfig.enabled ? initialSearch : true;
  const primarySearchConfig = normalizeDocsSearchConfig(primarySearch);
  const primarySearchResults = await performDocsSearch({
    pages: options.pages,
    query: options.query,
    search: primarySearch,
    locale: options.locale,
    pathname: options.pathname,
    siteTitle: options.siteTitle,
    limit: searchLimit,
  });
  const localSearchResults = shouldSupplementAskAIWithSimpleSearch(primarySearchConfig)
    ? await performDocsSearch({
        pages: options.pages,
        query: options.query,
        search: {
          provider: "simple",
          enabled: true,
          chunking: primarySearchConfig.chunking,
          maxResults: searchLimit,
        },
        locale: options.locale,
        pathname: options.pathname,
        siteTitle: options.siteTitle,
        limit: searchLimit,
      })
    : [];
  const searchResults = mergeSearchResults(primarySearchResults, localSearchResults);

  const seen = new Set<string>();
  const maxResultChars = options.maxResultChars ?? DEFAULT_ASK_AI_RESULT_CHARS;
  const rankedResults = searchResults
    .map((result, index) => {
      const page = findPageForSearchResult(options.pages, result);
      const formatted = formatAskAIContextResult({
        result,
        page,
        maxChars: maxResultChars,
        baseUrl: options.baseUrl,
      });

      return {
        result,
        formatted,
        index,
        rank: rankAskAIContextResult(options.query, formatted),
      };
    })
    .sort((a, b) => b.rank - a.rank || a.index - b.index);
  const formattedResults = rankedResults.map((item) => item.formatted);
  const sectionResultPaths = new Set(
    formattedResults
      .filter((result) => result.section)
      .map((result) => normalizeUrlPathname(result.url)),
  );
  const results = formattedResults
    .filter((result) => result.section || !sectionResultPaths.has(normalizeUrlPathname(result.url)))
    .filter((result) => {
      const key = getSearchResultKey(result);
      if (seen.has(key)) return false;
      seen.add(key);
      return result.contextContent.length > 0;
    })
    .slice(0, limit);

  const maxContextChars = options.maxContextChars ?? DEFAULT_ASK_AI_CONTEXT_CHARS;
  const blocks: string[] = [];
  let usedChars = 0;

  for (const result of results) {
    const block = buildAskAIContextBlock(result);
    const separatorChars = blocks.length === 0 ? 0 : "\n\n---\n\n".length;
    if (usedChars + separatorChars + block.length > maxContextChars) {
      const remaining = maxContextChars - usedChars - separatorChars;
      if (remaining > 400) {
        blocks.push(clampText(block, remaining));
      }
      break;
    }

    blocks.push(block);
    usedChars += separatorChars + block.length;
  }

  const context = blocks.join("\n\n---\n\n");

  return {
    context,
    results: results.slice(0, blocks.length),
    searchResults: rankedResults.map((item) => item.result),
    packageHints: inferDocsAskAIPackageHints(context),
  };
}

export function createCustomSearchAdapter(
  adapter: DocsSearchAdapter | DocsSearchAdapterFactory,
): CustomDocsSearchConfig {
  return {
    provider: "custom",
    adapter,
  };
}

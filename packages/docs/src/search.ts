import type {
  AlgoliaDocsSearchConfig,
  CustomDocsSearchConfig,
  DocsAskAIMcpConfig,
  DocsPaginatedSearchResponse,
  DocsSearchAdapter,
  DocsSearchAdapterFactory,
  DocsSearchAdapterContext,
  DocsSearchAdapterPage,
  DocsSearchConfig,
  DocsSearchDocument,
  DocsSearchFacet,
  DocsSearchFilterField,
  DocsSearchFilterInput,
  DocsSearchFilters,
  DocsSearchFacetsResponse,
  DocsSearchQuery,
  DocsSearchRequest,
  DocsSearchResult,
  DocsSearchSourcePage,
  DocsSearchWarning,
  DocsSearchChunkingConfig,
  DocsContentSnapshot,
  DocsRetrievalSourceProvenance,
  DocsRetrievalSourceScope,
  McpDocsSearchConfig,
  TypesenseDocsSearchConfig,
} from "./types.js";
import { digestDocsRetrievalContent, isDocsRetrievalCanonicalUrl } from "./retrieval-digest.js";
import {
  createDocsPaginationCursor,
  DocsPaginationCursorError,
  paginateDocsItems,
  resolveDocsPaginationCursor,
} from "./pagination.js";
import {
  PAGE_AGENT_CONTRACT_END_MARKER,
  PAGE_AGENT_CONTRACT_START_MARKER,
  renderPageAgentContractMarkdown,
  upsertPageAgentContractMarkdown,
} from "./agent-contract.js";
import {
  agentVersionConstraintGroupsOverlap,
  agentVersionConstraintsOverlap,
  normalizeAgentFramework,
  normalizeAgentLocale,
  normalizeAgentScopeValues,
  normalizeAgentVersion,
} from "./agent-scope.js";
import { resolveDocsAudienceMdxContent, type DocsContentAudience } from "./audience.js";
import {
  findDocsGeneratedAgentContractRanges,
  findDocsMarkdownSection,
  parseDocsMarkdownSections,
  stripDocsGeneratedAgentContractMarkers,
} from "./markdown-sections.js";
import { isDocsMcpResourcePath } from "./mcp-auth.js";

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_STRUCTURED_SEARCH_LIMIT = 25;
const MAX_SEARCH_SNIPPET_CHARS = 160;
const DEFAULT_MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_SESSION_CLEANUP_TIMEOUT_MS = 1_000;
const syncedIndexes = new Map<string, string>();
const syncingIndexes = new Map<string, { fingerprint: string; promise: Promise<void> }>();
const ALGOLIA_MAX_RECORD_BYTES = 9_500;
const DEFAULT_ASK_AI_CONTEXT_CHARS = 24_000;
const DEFAULT_ASK_AI_RESULT_CHARS = 6_000;
const MAX_SEARCH_FILTER_VALUES = 16;
const MAX_SEARCH_FILTER_VALUE_CHARS = 128;
const MAX_SEARCH_FILTER_RAW_CHARS = 4_096;
const MAX_SEARCH_FILTER_SEGMENTS = 64;
const MAX_SEARCH_PROVIDER_CURSOR_STATE_CHARS = 1_024;
const MAX_PROVIDER_SCOPE_FILTER_IDS = 1_000;
const MAX_PROVIDER_SCOPE_FILTER_CHARS = 16_000;
const MAX_HOSTED_PROVIDER_CURSOR_RESULTS = 1_000;
const MAX_MCP_SEARCH_CURSOR_REPLAY_PAGES = 64;
const MAX_MCP_SEARCH_CURSOR_RESULTS = MAX_MCP_SEARCH_CURSOR_REPLAY_PAGES;
const DOCS_UNPAGINATED_PROVIDER_QUERY = Symbol("docs-unpaginated-provider-query");
type InternalDocsSearchQuery = DocsSearchQuery & {
  [DOCS_UNPAGINATED_PROVIDER_QUERY]?: true;
};
const DOCS_PROVIDER_SCOPE_FILTER_OVERFLOW = Symbol("docs-provider-scope-filter-overflow");
const ALGOLIA_BATCH_OPERATIONS = 1_000;
const MAX_SEARCH_WARNINGS = 16;
const MAX_SEARCH_WARNING_VALUES = 16;
const MAX_SEARCH_WARNING_PAGE_URLS = 8;
const MAX_SEARCH_FACET_VALUES = 100;
const RETRIEVAL_INDEX_FORMAT = "docs-retrieval-index.v1";
const MAX_RETRIEVAL_SOURCE_URL_CHARS = 4_096;
const MAX_RETRIEVAL_SOURCE_VALUE_CHARS = 256;
const SEARCH_FILTER_FIELDS = ["framework", "version", "package", "tags"] as const;
const SEARCH_AMBIGUITY_FIELDS = ["framework", "version", "package"] as const;
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
  /** Structured production context blocks; avoids reparsing markdown horizontal rules. */
  blocks: Array<{ text: string; result: DocsAskAIContextResult }>;
  results: DocsAskAIContextResult[];
  searchResults: DocsSearchResult[];
  packageHints: DocsAskAIPackageHints;
}

export interface DocsAskAIPackageHints {
  packages: string[];
  imports: string[];
  installCommands: string[];
}

interface ResolvedDocsSearchPageScope {
  framework: string[];
  version: string[];
  package: string[];
  tags: string[];
  declarations: Record<DocsSearchFilterField, string[][]>;
  conflicts: DocsSearchFilterField[];
}

function normalizeDocsSearchFilterValue(field: DocsSearchFilterField, value: string): string {
  const bounded = value.trim().slice(0, MAX_SEARCH_FILTER_VALUE_CHARS).trim();
  if (!bounded) return "";
  if (field === "framework") return normalizeAgentFramework(bounded);
  if (field === "version") return normalizeAgentVersion(bounded);
  return bounded.toLowerCase();
}

function normalizeDocsSearchFilterValues(
  field: DocsSearchFilterField,
  input: string | readonly string[] | undefined,
): string[] {
  const values = typeof input === "string" ? [input] : (input ?? []);
  const normalized: string[] = [];
  const seen = new Set<string>();
  let remainingChars = MAX_SEARCH_FILTER_RAW_CHARS;
  let remainingSegments = MAX_SEARCH_FILTER_SEGMENTS;

  for (const item of values) {
    if (remainingChars <= 0 || remainingSegments <= 0) break;
    const boundedItem = item.slice(0, remainingChars);
    remainingChars -= boundedItem.length;
    for (const part of boundedItem.split(",")) {
      if (remainingSegments <= 0) break;
      remainingSegments -= 1;
      const value = normalizeDocsSearchFilterValue(field, part);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      normalized.push(value);
      if (normalized.length >= MAX_SEARCH_FILTER_VALUES) return normalized;
    }
  }

  return normalized;
}

/** Normalize scalar or array-valued scope filters for programmatic, HTTP, and MCP callers. */
export function normalizeDocsSearchFilters(
  input: DocsSearchFilterInput | DocsSearchFilters = {},
): DocsSearchFilters {
  const filters: DocsSearchFilters = {};

  for (const field of SEARCH_FILTER_FIELDS) {
    const values = normalizeDocsSearchFilterValues(field, input[field]);
    if (values.length > 0) filters[field] = values;
  }

  return filters;
}

/** Parse the public search scope parameters from a URL query string. */
export function resolveDocsSearchFilters(searchParams: URLSearchParams): DocsSearchFilters {
  return normalizeDocsSearchFilters({
    framework: searchParams.getAll("framework"),
    version: searchParams.getAll("version"),
    package: searchParams.getAll("package"),
    tags: searchParams.getAll("tags"),
  });
}

export class DocsSearchRequestError extends Error {
  readonly code = "invalid_search_request";

  constructor(message: string) {
    super(message);
    this.name = "DocsSearchRequestError";
  }
}

export function resolveDocsSearchError(
  error: unknown,
): { code: "invalid_cursor" | "invalid_search_request"; message: string } | undefined {
  if (error instanceof DocsPaginationCursorError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof DocsSearchRequestError) {
    return { code: error.code, message: error.message };
  }
  return undefined;
}

/** Resolve search filters and the backwards-compatible structured response opt-in. */
export function resolveDocsSearchRequest(searchParams: URLSearchParams): DocsSearchRequest {
  const response = searchParams.get("response");
  const structured = response === "structured";
  const facets = response === "facets";
  const rawFacet = searchParams.get("facet");
  let facet: DocsSearchFilterField | undefined;
  if (rawFacet !== null) {
    if (!facets || !SEARCH_FILTER_FIELDS.includes(rawFacet as DocsSearchFilterField)) {
      throw new DocsSearchRequestError(
        "Search facet must be one of framework, version, package, or tags and requires `response=facets`.",
      );
    }
    facet = rawFacet as DocsSearchFilterField;
  }
  const cursor = searchParams.get("cursor") ?? undefined;
  if (cursor !== undefined && !structured && !facets) {
    throw new DocsSearchRequestError(
      "Search cursors require `response=structured` or `response=facets`.",
    );
  }
  if (cursor !== undefined && facets && facet === undefined) {
    throw new DocsSearchRequestError("Facet continuation cursors require a `facet` field.");
  }
  if (
    cursor !== undefined &&
    (cursor.length === 0 || cursor.length > 4_096 || !/^[A-Za-z\d_-]+$/u.test(cursor))
  ) {
    throw new DocsPaginationCursorError();
  }

  const rawLimit = searchParams.get("limit");
  let limit: number | undefined;
  if (rawLimit !== null && (structured || facets)) {
    const maximum = facets ? MAX_SEARCH_FACET_VALUES : MAX_STRUCTURED_SEARCH_LIMIT;
    if (!/^\d+$/u.test(rawLimit)) {
      throw new DocsSearchRequestError(`Search limit must be an integer between 1 and ${maximum}.`);
    }
    limit = Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
      throw new DocsSearchRequestError(`Search limit must be an integer between 1 and ${maximum}.`);
    }
  }

  return {
    filters: resolveDocsSearchFilters(searchParams),
    structured,
    ...(facets ? { facets: true } : {}),
    ...(facet !== undefined ? { facet } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function hasDocsSearchFilters(filters: DocsSearchFilters): boolean {
  return SEARCH_FILTER_FIELDS.some((field) => (filters[field]?.length ?? 0) > 0);
}

function resolveProviderScopeDocumentIds(
  query: DocsSearchQuery,
  context: DocsSearchAdapterContext,
  corpusId?: string,
): string[] | typeof DOCS_PROVIDER_SCOPE_FILTER_OVERFLOW | undefined {
  if (!hasDocsSearchFilters(query.filters ?? {})) return undefined;

  const documents = corpusId
    ? buildDocsSearchDocuments(context.pages, context.chunking ?? { strategy: "section" }, "human")
    : context.documents;
  const ids = Array.from(
    new Set(
      documents.map((document) =>
        corpusId ? makeHostedProviderDocumentId(corpusId, document.id) : document.id,
      ),
    ),
  );
  return ids.length <= MAX_PROVIDER_SCOPE_FILTER_IDS ? ids : DOCS_PROVIDER_SCOPE_FILTER_OVERFLOW;
}

function docsSearchFiltersMatch(expected: DocsSearchFilters, actual: DocsSearchFilters): boolean {
  return SEARCH_FILTER_FIELDS.every((field) => {
    const expectedValues = expected[field] ?? [];
    const actualValues = actual[field] ?? [];
    return (
      expectedValues.length === actualValues.length &&
      expectedValues.every((value) => actualValues.includes(value))
    );
  });
}

function parseVerifiedMcpSearchFilters(value: unknown): DocsSearchFilters | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const filterFields: readonly string[] = SEARCH_FILTER_FIELDS;
  if (Object.keys(record).some((field) => !filterFields.includes(field))) {
    return undefined;
  }

  const input: DocsSearchFilterInput = {};
  for (const field of SEARCH_FILTER_FIELDS) {
    const values = record[field];
    if (values === undefined) continue;
    if (
      !Array.isArray(values) ||
      values.length > MAX_SEARCH_FILTER_VALUES ||
      values.some((item) => typeof item !== "string" || item.length > MAX_SEARCH_FILTER_VALUE_CHARS)
    ) {
      return undefined;
    }
    input[field] = values as string[];
  }

  const normalized = normalizeDocsSearchFilters(input);
  for (const field of SEARCH_FILTER_FIELDS) {
    const values = record[field];
    if (values === undefined) continue;
    if (
      !Array.isArray(values) ||
      values.length !== (normalized[field]?.length ?? 0) ||
      values.some((value, index) => value !== normalized[field]?.[index])
    ) {
      return undefined;
    }
  }
  return normalized;
}

function normalizeDocsSearchMetadataValues(
  field: DocsSearchFilterField,
  value: string | string[] | undefined,
): string[] {
  const values = normalizeAgentScopeValues(value);
  return Array.from(
    new Set(
      values
        .map((item) => normalizeDocsSearchFilterValue(field, item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function valuesOverlap(
  left: readonly string[],
  right: readonly string[],
  matches: (leftValue: string, rightValue: string) => boolean,
): boolean {
  return left.some((leftValue) => right.some((rightValue) => matches(leftValue, rightValue)));
}

function resolveDocsSearchPageScope(page: DocsSearchSourcePage): ResolvedDocsSearchPageScope {
  const topFramework = normalizeDocsSearchMetadataValues("framework", page.framework);
  const contractFramework = normalizeDocsSearchMetadataValues(
    "framework",
    page.agent?.appliesTo?.framework,
  );
  const topVersion = normalizeDocsSearchMetadataValues("version", page.version);
  const contractVersion = normalizeDocsSearchMetadataValues(
    "version",
    page.agent?.appliesTo?.version,
  );
  const packageValues = normalizeDocsSearchMetadataValues(
    "package",
    page.agent?.appliesTo?.package,
  );
  const tags = normalizeDocsSearchMetadataValues("tags", page.tags);
  const conflicts: DocsSearchFilterField[] = [];

  if (
    topFramework.length > 0 &&
    contractFramework.length > 0 &&
    !valuesOverlap(topFramework, contractFramework, (left, right) => left === right)
  ) {
    conflicts.push("framework");
  }
  if (
    topVersion.length > 0 &&
    contractVersion.length > 0 &&
    !valuesOverlap(topVersion, contractVersion, agentVersionConstraintsOverlap)
  ) {
    conflicts.push("version");
  }
  const framework =
    topFramework.length > 0 && contractFramework.length > 0
      ? topFramework.filter((value) => contractFramework.includes(value))
      : Array.from(new Set([...topFramework, ...contractFramework]));

  return {
    framework,
    version: Array.from(new Set([...topVersion, ...contractVersion])),
    package: packageValues,
    tags,
    declarations: {
      framework: [topFramework, contractFramework].filter((values) => values.length > 0),
      version: [topVersion, contractVersion].filter((values) => values.length > 0),
      package: packageValues.length > 0 ? [packageValues] : [],
      tags: tags.length > 0 ? [tags] : [],
    },
    conflicts,
  };
}

function docsSearchScopeValueMatches(
  field: DocsSearchFilterField,
  requested: string,
  candidate: string,
): boolean {
  return field === "version"
    ? agentVersionConstraintsOverlap(requested, candidate)
    : requested === candidate;
}

function docsSearchPageMatchesFilters(
  scope: ResolvedDocsSearchPageScope,
  filters: DocsSearchFilters,
): boolean {
  if (scope.conflicts.length > 0) return false;

  return SEARCH_FILTER_FIELDS.every((field) => {
    const requested = filters[field];
    if (!requested || requested.length === 0) return true;
    return docsSearchScopeFieldMatches(scope, field, requested);
  });
}

function docsSearchScopeFieldMatches(
  scope: ResolvedDocsSearchPageScope,
  field: DocsSearchFilterField,
  requested: readonly string[],
): boolean {
  const declarations = scope.declarations[field];
  if (declarations.length === 0) return false;
  if (field === "version") {
    return agentVersionConstraintGroupsOverlap([requested, ...declarations]);
  }

  return requested.some((value) =>
    declarations.every((candidates) =>
      candidates.some((candidate) => docsSearchScopeValueMatches(field, value, candidate)),
    ),
  );
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

function normalizeSearchPhrase(value: string): string {
  return normalizeWhitespace(value.toLowerCase().replace(/[?!.,;:]+$/g, ""));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function literalMatchPriority(query: string, value?: string): number {
  const q = normalizeSearchPhrase(query);
  const text = normalizeSearchPhrase(value ?? "");
  if (!q || !text) return 0;
  if (text === q) return 2;

  const boundary = "[^\\p{L}\\p{N}]";
  return new RegExp(`(^|${boundary})${escapeRegExp(q)}(?=$|${boundary})`, "u").test(text) ? 1 : 0;
}

function isLiteralLookupQuery(query: string): boolean {
  const q = normalizeSearchPhrase(query);
  const words = tokenizeSearchQuery(q);
  return words.length > 0 && words.length <= 3 && words.join(" ") === q;
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

function normalizeUrlRouteKey(value: string): string {
  try {
    const url = new URL(value, "https://docs.local");
    return `${url.pathname || "/"}${url.search}`;
  } catch {
    return value.split("#", 1)[0] || "/";
  }
}

function normalizeAuthoredUrlIdentity(value: string): string {
  const trimmed = value.trim();
  const explicitScheme = trimmed.match(/^([a-z][a-z\d+.-]*):/iu)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") {
    return normalizeUrlRouteKey("/");
  }

  try {
    const url = new URL(trimmed, "https://docs.local");
    const route = `${url.pathname || "/"}${url.search}`;
    if (explicitScheme) return `${url.origin}${route}`;
    if (trimmed.startsWith("//")) return `//${url.host}${route}`;
    return route;
  } catch {
    return normalizeUrlRouteKey(trimmed);
  }
}

function appendDocsLocaleQuery(value: string, locale: string): string {
  const hashIndex = value.indexOf("#");
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
  const queryIndex = withoutHash.indexOf("?");
  const rawQuery = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  if (new URLSearchParams(rawQuery).has("lang")) return value;
  return `${withoutHash}${queryIndex >= 0 ? "&" : "?"}lang=${encodeURIComponent(locale)}${hash}`;
}

function localizeDocsSearchPage(
  page: DocsSearchSourcePage,
  localeFallback?: string,
): DocsSearchSourcePage {
  const rawLocale = (page.locale ?? localeFallback)?.trim();
  if (!rawLocale) return page;
  const locale = rawLocale;
  const url = appendDocsLocaleQuery(page.url, locale);
  if (url === page.url && page.locale === locale) {
    return page;
  }
  return {
    ...page,
    url,
    locale,
  };
}

function safeDecodeUrlSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getUrlSearchSegments(value: string): string[] {
  let pathname = "";

  try {
    pathname = new URL(value, "https://docs.local").pathname;
  } catch {
    pathname = value.split(/[?#]/)[0] ?? "";
  }

  return Array.from(
    new Set(
      pathname
        .split("/")
        .flatMap((segment) => {
          const decoded = safeDecodeUrlSegment(segment);
          return [decoded, decoded.replace(/[-_]+/g, " ")];
        })
        .map(normalizeSearchPhrase)
        .filter(Boolean),
    ),
  );
}

function resolveAskAIContextUrl(value: string, baseUrl?: string): string {
  if (!baseUrl) return value;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function cleanGeneratedAgentContractMarkers(content: string): string {
  return stripDocsGeneratedAgentContractMarkers(content);
}

function getAskAIPageSectionContent(page: DocsSearchSourcePage): string {
  return getPageAudienceSectionContent(page, "agent");
}

function getAskAIPageContent(page: DocsSearchSourcePage): string {
  return cleanGeneratedAgentContractMarkers(getAskAIPageSectionContent(page));
}

function getPageAgentContractSearchText(page: DocsSearchSourcePage): string {
  return stripMarkdownText(
    renderPageAgentContractMarkdown(page.agent)
      .replace(PAGE_AGENT_CONTRACT_START_MARKER, "")
      .replace(PAGE_AGENT_CONTRACT_END_MARKER, ""),
  );
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

function findPageForSearchResult(
  pages: readonly DocsSearchSourcePage[],
  result: DocsSearchResult,
  baseUrl?: string,
  pagesByRoute?: ReadonlyMap<string, DocsSearchSourcePage>,
): DocsSearchSourcePage | undefined {
  const rawUrl = result.url.trim();
  const explicitlySchemed = /^[a-z][a-z\d+.-]*:/iu.test(rawUrl);
  const explicitlyHosted = explicitlySchemed || /^[\\/]{2}/u.test(rawUrl);
  if (explicitlySchemed && !/^https?:/iu.test(rawUrl)) return undefined;
  // Without a trusted origin, a hosted result cannot safely inherit local provenance
  // merely because its pathname matches a local page.
  if (explicitlyHosted && !baseUrl) return undefined;
  if (explicitlyHosted && baseUrl) {
    try {
      if (new URL(result.url, baseUrl).origin !== new URL(baseUrl).origin) return undefined;
    } catch {
      return undefined;
    }
  }
  const resultPath = normalizeUrlRouteKey(result.url);
  return (
    pagesByRoute?.get(resultPath) ??
    pages.find((page) => normalizeUrlRouteKey(page.url) === resultPath)
  );
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
  const anchor = getSearchResultAnchor(result.url);
  const sectionSelector = anchor ?? section;
  const rawContent = page
    ? sectionSelector
      ? cleanGeneratedAgentContractMarkers(
          findDocsMarkdownSection(getAskAIPageSectionContent(page), sectionSelector)?.content ?? "",
        )
      : getAskAIPageContent(page)
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
  const anchor = getSearchResultAnchor(result.url);
  const sectionFallback = normalizeWhitespace(result.section ?? "").toLowerCase();
  return `${normalizeUrlRouteKey(result.url)}#${anchor ?? sectionFallback}`;
}

function getSearchResultAnchor(value: string): string | undefined {
  let hash = "";

  try {
    hash = new URL(value, "https://docs.local").hash.replace(/^#/, "");
  } catch {
    const hashIndex = value.indexOf("#");
    hash = hashIndex >= 0 ? value.slice(hashIndex + 1) : "";
  }

  if (!hash) return undefined;
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function getAskAIResultPageKey(
  value: string,
  baseUrl?: string,
  strictExternalOrigins = false,
): string {
  const path = normalizeUrlRouteKey(value);
  const rawValue = value.trim();
  const explicitlyHosted = /^[a-z][a-z\d+.-]*:/iu.test(rawValue) || /^[\\/]{2}/u.test(rawValue);
  if (!explicitlyHosted || (!baseUrl && !strictExternalOrigins)) return path;
  try {
    const fallbackBase = baseUrl ?? "https://docs.local";
    const parsed = new URL(value, fallbackBase);
    const configuredBase = baseUrl ? new URL(baseUrl) : undefined;
    if (configuredBase && parsed.origin === configuredBase.origin) return path;
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    return `${value.split("#", 1)[0]}::${path}`;
  }
}

function getAskAIResultKey(
  result: DocsSearchResult,
  baseUrl?: string,
  strictExternalOrigins = false,
): string {
  const anchor = getSearchResultAnchor(result.url);
  const sectionFallback = normalizeWhitespace(result.section ?? "").toLowerCase();
  return `${getAskAIResultPageKey(
    result.url,
    baseUrl,
    strictExternalOrigins,
  )}#${anchor ?? sectionFallback}`;
}

function mergeSearchResults(
  groups: DocsSearchResult[][],
  getResultKey: (result: DocsSearchResult) => string = getSearchResultKey,
): DocsSearchResult[] {
  const seen = new Set<string>();
  const results: DocsSearchResult[] = [];

  for (const group of groups) {
    for (const result of group) {
      const key = getResultKey(result);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(result);
    }
  }

  return results;
}

function buildAudienceProjectionSearchResults(
  documents: readonly DocsSearchDocument[],
  query: string,
): DocsSearchResult[] {
  return documents.map((document) => {
    const score = scoreDocument(query, document);
    return {
      id: document.id,
      url: document.url,
      content: document.section ? `${document.title} — ${document.section}` : document.title,
      description: cleanSearchResultText(buildSnippet(document, query) ?? document.description),
      type: document.type,
      score,
      section: document.section,
    };
  });
}

function sanitizeExternalAudienceSearchResults(
  results: DocsSearchResult[],
  localAudienceResults: DocsSearchResult[],
  baseUrl?: string,
  preserveUnmatched?: (result: DocsSearchResult) => boolean,
  fallbackSectionToLocalPage = false,
): DocsSearchResult[] {
  const localByKey = new Map(
    localAudienceResults.map((result) => [getSearchResultKey(result), result] as const),
  );
  const localPageResults = new Map<string, DocsSearchResult>();

  for (const result of localAudienceResults) {
    const pageUrl = normalizeUrlRouteKey(result.url);
    const existing = localPageResults.get(pageUrl);
    if (!existing || result.type === "page") localPageResults.set(pageUrl, result);
  }

  return results.flatMap((result) => {
    const rawUrl = result.url.trim();
    const explicitlySchemed = /^[a-z][a-z\d+.-]*:/iu.test(rawUrl);
    const externallyHosted =
      (explicitlySchemed && /^https?:/iu.test(rawUrl)) || /^[\\/]{2}/u.test(rawUrl);
    const unsupportedScheme = explicitlySchemed && !/^https?:/iu.test(rawUrl);
    let sameOriginOrUnknown = !externallyHosted;
    if (unsupportedScheme) sameOriginOrUnknown = false;
    if (externallyHosted && baseUrl) {
      try {
        sameOriginOrUnknown = new URL(result.url, baseUrl).origin === new URL(baseUrl).origin;
      } catch {
        sameOriginOrUnknown = false;
      }
    }
    const hasSection = Boolean(getSearchResultAnchor(result.url) || result.section);
    const local = sameOriginOrUnknown
      ? (localByKey.get(getSearchResultKey(result)) ??
        (hasSection && !fallbackSectionToLocalPage
          ? undefined
          : localPageResults.get(normalizeUrlRouteKey(result.url))))
      : undefined;
    if (!local) return preserveUnmatched?.(result) ? [result] : [];

    return [
      {
        ...local,
        id: result.id,
        score: result.score ?? local.score,
      },
    ];
  });
}

function shouldPreserveUnmatchedExternalResult(options: {
  result: DocsSearchResult;
  localPagePaths: ReadonlySet<string>;
  baseUrl?: string;
}): boolean {
  const { result, localPagePaths, baseUrl } = options;
  const path = normalizeUrlRouteKey(result.url);
  const rawUrl = result.url.trim();
  const explicitScheme = rawUrl.match(/^([a-z][a-z\d+.-]*):/iu)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") return false;
  const explicitlyHosted = /^[a-z][a-z\d+.-]*:/iu.test(rawUrl) || /^[\\/]{2}/u.test(rawUrl);
  const knownLocalPath = localPagePaths.has(path);
  if (!explicitlyHosted) return !knownLocalPath;
  if (!baseUrl) return true;
  try {
    if (new URL(result.url, baseUrl).origin !== new URL(baseUrl).origin) return true;
  } catch {
    return false;
  }
  return !knownLocalPath;
}

function getPageAudienceSource(page: DocsSearchSourcePage, audience: DocsContentAudience): string {
  return audience === "agent"
    ? (page.agentRawContent ??
        page.agentFallbackRawContent ??
        page.agentContent ??
        page.agentFallbackContent ??
        page.rawContent ??
        page.content)
    : (page.rawContent ?? page.content);
}

function getPageAudienceRawContent(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
): string {
  return resolveDocsAudienceMdxContent(getPageAudienceSource(page, audience), audience);
}

function getPageAudienceSectionContent(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
): string {
  const content = getPageAudienceRawContent(page, audience);
  return audience === "agent" ? upsertPageAgentContractMarkdown(content, page.agent) : content;
}

/**
 * Build the exact normalized-input projection represented by a retrieval source digest.
 * This is public so consumers can independently reproduce `source.digest`.
 */
export function buildDocsRetrievalDigestProjection(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience = "human",
): string {
  const audienceContent = getPageAudienceRawContent(page, audience);
  return audience === "agent"
    ? upsertPageAgentContractMarkdown(audienceContent, page.agent)
    : [audienceContent, renderPageAgentContractMarkdown(page.agent)].filter(Boolean).join("\n\n");
}

function getPageAudienceSearchText(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
): string {
  return stripMarkdownText(getPageAudienceRawContent(page, audience));
}

function getPageAudienceIndexContent(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
): string {
  return normalizeWhitespace(
    [getPageAudienceSearchText(page, audience), getPageAgentContractSearchText(page)].join(" "),
  );
}

function sortRetrievalSourceValues(values: readonly string[]): string[] | undefined {
  const sorted = Array.from(new Set(values))
    .sort(compareSearchMetadataValues)
    .slice(0, MAX_SEARCH_FILTER_VALUES);
  return sorted.length > 0 ? sorted : undefined;
}

function buildDocsRetrievalSourceScope(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
  localeFallback?: string,
): DocsRetrievalSourceScope {
  const resolved = resolveDocsSearchPageScope(page);
  const rawLocale = (page.locale ?? localeFallback)?.trim();
  const locale = rawLocale
    ? normalizeAgentLocale(rawLocale).slice(0, MAX_SEARCH_FILTER_VALUE_CHARS)
    : undefined;
  const framework = sortRetrievalSourceValues(resolved.framework);
  const version = sortRetrievalSourceValues(resolved.version);
  const versionGroups = resolved.declarations.version
    .map((group) => sortRetrievalSourceValues(group))
    .filter((group): group is string[] => Boolean(group))
    .slice(0, MAX_SEARCH_FILTER_VALUES);
  const packageNames = sortRetrievalSourceValues(resolved.package);
  const tags = sortRetrievalSourceValues(resolved.tags);
  const truncated = SEARCH_FILTER_FIELDS.filter((field) => {
    if (field === "version") {
      return (
        resolved.version.length > MAX_SEARCH_FILTER_VALUES ||
        resolved.declarations.version.length > MAX_SEARCH_FILTER_VALUES ||
        resolved.declarations.version.some((group) => group.length > MAX_SEARCH_FILTER_VALUES)
      );
    }
    return resolved[field].length > MAX_SEARCH_FILTER_VALUES;
  });

  return {
    audience,
    ...(locale ? { locale: [locale] } : {}),
    ...(framework ? { framework } : {}),
    ...(version ? { version } : {}),
    ...(versionGroups.length > 1 ? { versionGroups } : {}),
    ...(packageNames ? { package: packageNames } : {}),
    ...(tags ? { tags } : {}),
    ...(truncated.length > 0 ? { truncated } : {}),
    ...(resolved.conflicts.length > 0
      ? {
          conflicts: [...resolved.conflicts].sort(
            (left, right) =>
              SEARCH_FILTER_FIELDS.indexOf(left) - SEARCH_FILTER_FIELDS.indexOf(right),
          ),
        }
      : {}),
  };
}

function buildDocsRetrievalScopeIdentity(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
  localeFallback?: string,
): string {
  const resolved = resolveDocsSearchPageScope(page);
  const sortValues = (values: readonly string[]) =>
    Array.from(new Set(values)).sort(compareSearchMetadataValues);
  const declarations = Object.fromEntries(
    SEARCH_FILTER_FIELDS.map((field) => [
      field,
      resolved.declarations[field]
        .map(sortValues)
        .sort((left, right) =>
          compareSearchMetadataValues(JSON.stringify(left), JSON.stringify(right)),
        ),
    ]),
  );
  return hashDocsRetrievalValue(
    JSON.stringify({
      audience,
      locale: (page.locale ?? localeFallback)?.trim(),
      declarations,
      conflicts: [...resolved.conflicts].sort(
        (left, right) => SEARCH_FILTER_FIELDS.indexOf(left) - SEARCH_FILTER_FIELDS.indexOf(right),
      ),
    }),
  );
}

function getUrlHash(value: string): string {
  const hashIndex = value.indexOf("#");
  return hashIndex >= 0 ? value.slice(hashIndex) : "";
}

function resolveDocsRetrievalCanonicalUrl(
  page: DocsSearchSourcePage,
  resultUrl: string,
  baseUrl?: string,
): string {
  const requestedCanonical = page.canonicalUrl?.trim();
  const requested =
    requestedCanonical && requestedCanonical.length <= MAX_RETRIEVAL_SOURCE_URL_CHARS
      ? requestedCanonical
      : page.url;
  const explicitScheme = requested.match(/^([a-z][a-z\d+.-]*):/iu)?.[1]?.toLowerCase();
  const pageScheme = page.url.match(/^([a-z][a-z\d+.-]*):/iu)?.[1]?.toLowerCase();
  const safePageUrl =
    pageScheme && pageScheme !== "http" && pageScheme !== "https" ? "/" : page.url;
  const configured =
    explicitScheme && explicitScheme !== "http" && explicitScheme !== "https"
      ? safePageUrl
      : requested;
  let canonical = configured;

  if (baseUrl) {
    try {
      canonical = new URL(configured, baseUrl).toString();
    } catch {
      canonical = configured;
    }
  } else if (configured.startsWith("//")) {
    canonical = `https:${configured}`;
  }

  const withSection = `${canonical.split("#", 1)[0]}${getUrlHash(resultUrl)}`;
  if (
    withSection.length <= MAX_RETRIEVAL_SOURCE_URL_CHARS &&
    isDocsRetrievalCanonicalUrl(withSection)
  ) {
    return withSection;
  }

  const fallback = (
    baseUrl
      ? (() => {
          try {
            return new URL(safePageUrl, baseUrl).toString();
          } catch {
            return safePageUrl;
          }
        })()
      : safePageUrl
  ).split("#", 1)[0];
  if (fallback.length <= MAX_RETRIEVAL_SOURCE_URL_CHARS && isDocsRetrievalCanonicalUrl(fallback)) {
    return fallback;
  }

  if (baseUrl) {
    try {
      const root = new URL("/", baseUrl).toString();
      if (root.length <= MAX_RETRIEVAL_SOURCE_URL_CHARS && isDocsRetrievalCanonicalUrl(root)) {
        return root;
      }
    } catch {
      // Fall through to a bounded relative canonical URL.
    }
  }
  return "/";
}

function hashDocsRetrievalValue(value: string): string {
  return digestDocsRetrievalContent(value);
}

type DocsRetrievalDigestCache = Map<DocsSearchSourcePage, string>;
interface DocsRetrievalDigestMemo {
  source: string;
  agentContractKey: string;
  digest: string;
}
const docsRetrievalDigestMemo = new WeakMap<
  DocsSearchSourcePage,
  Partial<Record<DocsContentAudience, DocsRetrievalDigestMemo>>
>();

function getDocsRetrievalSourceDigest(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
  cache?: DocsRetrievalDigestCache,
): string {
  const cached = cache?.get(page);
  if (cached) return cached;
  const source = getPageAudienceSource(page, audience);
  let agentContractKey = "";
  let cacheable = true;
  try {
    agentContractKey = JSON.stringify(page.agent ?? null);
  } catch {
    // Cyclic custom metadata remains supported; it simply bypasses cross-request memoization.
    cacheable = false;
  }
  const memo = docsRetrievalDigestMemo.get(page)?.[audience];
  if (cacheable && memo && memo.source === source && memo.agentContractKey === agentContractKey) {
    cache?.set(page, memo.digest);
    return memo.digest;
  }

  const digest = hashDocsRetrievalValue(buildDocsRetrievalDigestProjection(page, audience));
  if (cacheable) {
    const pageMemo = docsRetrievalDigestMemo.get(page) ?? {};
    pageMemo[audience] = { source, agentContractKey, digest };
    docsRetrievalDigestMemo.set(page, pageMemo);
  }
  cache?.set(page, digest);
  return digest;
}

export function resolveDocsRetrievalLastModified(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience,
): string | undefined {
  const parseCandidate = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized) return undefined;
    const timestamp = Date.parse(normalized);
    return Number.isFinite(timestamp) ? { value: normalized, timestamp } : undefined;
  };
  // Authored lastmod is the explicit public freshness value; filesystem mtime is
  // only a fallback when the page does not declare one.
  const pageModified = parseCandidate(page.lastmod) ?? parseCandidate(page.lastModified);
  const explicitAgentSource =
    audience === "agent" && (page.agentRawContent !== undefined || page.agentContent !== undefined);
  if (!explicitAgentSource) return pageModified?.value;

  // An explicit agent source is the selected retrieval document, so report its
  // freshness when available. Page freshness remains the fallback for generated
  // agent projections and sources without an independently tracked timestamp.
  const agentModified = parseCandidate(page.agentLastModified);
  if (!renderPageAgentContractMarkdown(page.agent)) {
    return agentModified?.value ?? pageModified?.value;
  }
  // Structured page metadata is inserted into an explicit agent source. When it
  // contributes to the selected projection, freshness must cover both inputs.
  if (!agentModified) return pageModified?.value;
  if (!pageModified) return agentModified.value;
  return agentModified.timestamp >= pageModified.timestamp
    ? agentModified.value
    : pageModified.value;
}

interface DocsSearchProvenanceOptions {
  audience: DocsContentAudience;
  chunking: DocsSearchChunkingConfig;
  locale?: string;
  baseUrl?: string;
  indexGeneration: string;
  digestCache?: DocsRetrievalDigestCache;
}

async function buildDocsSearchIndexGeneration(
  pages: readonly DocsSearchSourcePage[],
  options: Omit<DocsSearchProvenanceOptions, "indexGeneration">,
): Promise<string> {
  const sources = (
    await Promise.all(
      pages.map(async (rawPage) => {
        const page = localizeDocsSearchPage(rawPage, options.locale);
        const authoredLastModified = page.lastmod?.trim();
        return {
          canonicalIdentity: normalizeAuthoredUrlIdentity(page.canonicalUrl?.trim() || page.url),
          url: normalizeAuthoredUrlIdentity(page.url),
          indexedUrl: page.url,
          title: page.title,
          description: page.description,
          type: page.type,
          scope: buildDocsRetrievalSourceScope(page, options.audience, options.locale),
          scopeIdentity: buildDocsRetrievalScopeIdentity(page, options.audience, options.locale),
          // Filesystem mtimes differ between checkout/build/deployment for identical
          // content. Only an authored timestamp participates in generation identity;
          // the effective runtime modified time is still returned on each source.
          lastModified:
            authoredLastModified && Number.isFinite(Date.parse(authoredLastModified))
              ? authoredLastModified
              : undefined,
          digest: getDocsRetrievalSourceDigest(rawPage, options.audience, options.digestCache),
          agentContract: getPageAgentContractSearchText(rawPage),
        };
      }),
    )
  ).sort((left, right) => {
    const canonical = compareSearchMetadataValues(left.canonicalIdentity, right.canonicalIdentity);
    if (canonical !== 0) return canonical;
    const url = compareSearchMetadataValues(left.url, right.url);
    if (url !== 0) return url;
    const digest = compareSearchMetadataValues(left.digest, right.digest);
    if (digest !== 0) return digest;
    const title = compareSearchMetadataValues(left.title, right.title);
    return title !== 0
      ? title
      : compareSearchMetadataValues(JSON.stringify(left), JSON.stringify(right));
  });

  return hashDocsRetrievalValue(
    JSON.stringify({
      format: RETRIEVAL_INDEX_FORMAT,
      audience: options.audience,
      chunking: options.chunking.strategy ?? "section",
      sources,
    }),
  );
}

export interface BuildDocsContentSnapshotOptions {
  pages: readonly DocsSearchSourcePage[];
  search?: boolean | DocsSearchConfig;
  audience?: DocsContentAudience;
  locale?: string;
  baseUrl?: string;
  /** @internal Precomputed complete-corpus generation for composed callers. */
  indexGeneration?: string;
}

/**
 * Build a deterministic, body-free inventory for content-change synchronization.
 *
 * Its generation is identical to structured search for the same pages, audience,
 * locale, base URL, and chunking policy.
 */
export async function buildDocsContentSnapshot(
  options: BuildDocsContentSnapshotOptions,
): Promise<DocsContentSnapshot> {
  const audience = resolveDocsSearchAudience(options.audience);
  const search = normalizeDocsSearchConfig(options.search);
  const digestCache = new Map<DocsSearchSourcePage, string>();
  const indexGeneration =
    options.indexGeneration ??
    (await buildDocsSearchIndexGeneration(options.pages, {
      audience,
      chunking: search.chunking,
      locale: options.locale,
      baseUrl: options.baseUrl,
      digestCache,
    }));
  const documents = await Promise.all(
    options.pages.map(async (page) => {
      const localizedPage = localizeDocsSearchPage(page, options.locale);
      const source = await buildDocsRetrievalSource(page, localizedPage.url, {
        audience,
        chunking: search.chunking,
        locale: options.locale,
        baseUrl: options.baseUrl,
        indexGeneration,
        digestCache,
      });
      const canonicalUrl = source.canonicalUrl.split("#", 1)[0]!;
      return {
        url: localizedPage.url,
        canonicalUrl,
        // Cover every page-level input that can change a fetched document.
        // source.digest remains the independently verifiable body projection.
        digest: hashDocsRetrievalValue(
          JSON.stringify({
            format: "docs-content-document.v1",
            url: localizedPage.url,
            canonicalUrl,
            title: localizedPage.title,
            description: localizedPage.description,
            type: localizedPage.type,
            scope: source.scope,
            lastModified: source.lastModified,
            sourceDigest: source.digest,
          }),
        ),
        ...(source.lastModified ? { lastModified: source.lastModified } : {}),
      };
    }),
  );
  documents.sort((left, right) => {
    const canonical = compareSearchMetadataValues(left.canonicalUrl, right.canonicalUrl);
    return canonical !== 0 ? canonical : compareSearchMetadataValues(left.url, right.url);
  });
  for (let index = 1; index < documents.length; index += 1) {
    if (documents[index - 1]?.canonicalUrl === documents[index]?.canonicalUrl) {
      throw new DocsSearchRequestError(
        `Content-change snapshots require unique canonical URLs; duplicate: ${documents[index]!.canonicalUrl}`,
      );
    }
  }

  return {
    format: "docs-content-snapshot.v1",
    audience,
    ...(options.locale ? { locale: normalizeAgentLocale(options.locale) } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    indexGeneration,
    documents,
  };
}

async function buildDocsRetrievalSource(
  rawPage: DocsSearchSourcePage,
  resultUrl: string,
  options: DocsSearchProvenanceOptions,
): Promise<DocsRetrievalSourceProvenance> {
  const page = localizeDocsSearchPage(rawPage, options.locale);
  const lastModified = resolveDocsRetrievalLastModified(rawPage, options.audience);
  return {
    canonicalUrl: resolveDocsRetrievalCanonicalUrl(page, resultUrl, options.baseUrl),
    scope: buildDocsRetrievalSourceScope(page, options.audience, options.locale),
    ...(lastModified ? { lastModified } : {}),
    digest: getDocsRetrievalSourceDigest(rawPage, options.audience, options.digestCache),
    indexGeneration: options.indexGeneration,
  };
}

function parseRetrievalSourceString(
  value: unknown,
  maxChars = MAX_RETRIEVAL_SOURCE_VALUE_CHARS,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxChars) return undefined;
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (hasControlCharacter) return undefined;
  return normalized;
}

function parseRetrievalSourceValues(
  field: DocsSearchFilterField | "locale",
  value: unknown,
): { valid: boolean; values?: string[] } {
  if (!Array.isArray(value) || value.length > MAX_SEARCH_FILTER_VALUES) {
    return { valid: false };
  }
  const parsed: string[] = [];
  for (const item of value) {
    const stringValue = parseRetrievalSourceString(item, MAX_SEARCH_FILTER_VALUE_CHARS);
    if (!stringValue) return { valid: false };
    if (field === "locale") {
      const normalizedLocale = normalizeAgentLocale(stringValue);
      if (!normalizedLocale) return { valid: false };
      parsed.push(normalizedLocale);
      continue;
    }
    const normalized = normalizeDocsSearchFilterValue(field, stringValue);
    if (!normalized) return { valid: false };
    parsed.push(normalized);
  }
  return { valid: true, values: sortRetrievalSourceValues(parsed) };
}

function parseRetrievalSourceVersionGroups(value: unknown): {
  valid: boolean;
  groups?: string[][];
} {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SEARCH_FILTER_VALUES) {
    return { valid: false };
  }
  const groups = value.map((group) => parseRetrievalSourceValues("version", group));
  if (groups.some((group) => !group.valid || !group.values || group.values.length === 0)) {
    return { valid: false };
  }
  return {
    valid: true,
    groups: groups.map((group) => group.values!),
  };
}

function parseDocsRetrievalSource(
  value: unknown,
  options: { allowRootRelativeCanonical?: boolean } = {},
): DocsRetrievalSourceProvenance | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const canonicalUrl = parseRetrievalSourceString(
    record.canonicalUrl,
    MAX_RETRIEVAL_SOURCE_URL_CHARS,
  );
  const digest = parseRetrievalSourceString(record.digest);
  const indexGeneration = parseRetrievalSourceString(record.indexGeneration);
  if (!canonicalUrl || !digest || !indexGeneration) return undefined;
  const digestPattern = /^sha256:[a-f\d]{64}$/iu;
  if (!digestPattern.test(digest) || !digestPattern.test(indexGeneration)) return undefined;
  if (
    !isDocsRetrievalCanonicalUrl(canonicalUrl) ||
    (/^\/(?!\/)/u.test(canonicalUrl) && !options.allowRootRelativeCanonical)
  ) {
    return undefined;
  }

  if (!record.scope || typeof record.scope !== "object" || Array.isArray(record.scope)) {
    return undefined;
  }
  const rawScope = record.scope as Record<string, unknown>;
  const audience =
    rawScope.audience === "human" || rawScope.audience === "agent" ? rawScope.audience : undefined;
  if (!audience) return undefined;
  const parseScopeFields = (
    value: unknown,
  ): { valid: boolean; values?: DocsSearchFilterField[] } => {
    if (
      !Array.isArray(value) ||
      value.length > SEARCH_FILTER_FIELDS.length ||
      value.some(
        (field) =>
          typeof field !== "string" ||
          !SEARCH_FILTER_FIELDS.includes(field as DocsSearchFilterField),
      )
    ) {
      return { valid: false };
    }
    return {
      valid: true,
      values: Array.from(new Set(value as DocsSearchFilterField[])).sort(
        (left, right) => SEARCH_FILTER_FIELDS.indexOf(left) - SEARCH_FILTER_FIELDS.indexOf(right),
      ),
    };
  };
  const parseOptionalValues = (
    field: DocsSearchFilterField | "locale",
    value: unknown,
  ): { valid: boolean; values?: string[] } =>
    value === undefined ? { valid: true } : parseRetrievalSourceValues(field, value);
  const parseOptionalScopeFields = (
    value: unknown,
  ): { valid: boolean; values?: DocsSearchFilterField[] } =>
    value === undefined ? { valid: true } : parseScopeFields(value);
  const conflicts = parseOptionalScopeFields(rawScope.conflicts);
  const truncated = parseOptionalScopeFields(rawScope.truncated);
  const locale = parseOptionalValues("locale", rawScope.locale);
  const framework = parseOptionalValues("framework", rawScope.framework);
  const version = parseOptionalValues("version", rawScope.version);
  const versionGroups =
    rawScope.versionGroups === undefined
      ? { valid: true, groups: undefined }
      : parseRetrievalSourceVersionGroups(rawScope.versionGroups);
  const packageNames = parseOptionalValues("package", rawScope.package);
  const tags = parseOptionalValues("tags", rawScope.tags);
  if (
    !conflicts.valid ||
    !truncated.valid ||
    !locale.valid ||
    !framework.valid ||
    !version.valid ||
    !versionGroups.valid ||
    !packageNames.valid ||
    !tags.valid
  ) {
    return undefined;
  }
  const scope: DocsRetrievalSourceScope = {
    audience,
    ...(locale.values ? { locale: locale.values } : {}),
    ...(framework.values ? { framework: framework.values } : {}),
    ...(version.values ? { version: version.values } : {}),
    ...(versionGroups.groups ? { versionGroups: versionGroups.groups } : {}),
    ...(packageNames.values ? { package: packageNames.values } : {}),
    ...(tags.values ? { tags: tags.values } : {}),
    ...(truncated.values && truncated.values.length > 0 ? { truncated: truncated.values } : {}),
    ...(conflicts.values && conflicts.values.length > 0 ? { conflicts: conflicts.values } : {}),
  };
  const rawLastModified = parseRetrievalSourceString(record.lastModified);
  if (
    record.lastModified !== undefined &&
    (!rawLastModified || !Number.isFinite(Date.parse(rawLastModified)))
  ) {
    return undefined;
  }
  const lastModified =
    rawLastModified && Number.isFinite(Date.parse(rawLastModified)) ? rawLastModified : undefined;

  return {
    canonicalUrl,
    scope,
    ...(lastModified ? { lastModified } : {}),
    digest,
    indexGeneration,
  };
}

function docsRetrievalSourceMatchesRequest(
  source: DocsRetrievalSourceProvenance,
  audience: DocsContentAudience,
  filters?: DocsSearchFilters,
  locale?: string,
): boolean {
  if (source.scope.audience !== audience) return false;

  for (const field of SEARCH_FILTER_FIELDS) {
    const requested = filters?.[field];
    if (!requested?.length) continue;
    if (source.scope.conflicts?.includes(field)) return false;
    if (source.scope.truncated?.includes(field)) return false;
    if (field === "version" && source.scope.versionGroups?.length) {
      if (!agentVersionConstraintGroupsOverlap([requested, ...source.scope.versionGroups])) {
        return false;
      }
      continue;
    }
    const candidates = source.scope[field];
    if (!candidates?.length) return false;
    if (
      !requested.some((requestedValue) =>
        candidates.some((candidate) =>
          docsSearchScopeValueMatches(field, requestedValue, candidate),
        ),
      )
    ) {
      return false;
    }
  }

  const requestedLocale = locale ? normalizeAgentLocale(locale) : undefined;
  if (
    requestedLocale &&
    (!source.scope.locale?.length ||
      !source.scope.locale.some((candidate) => normalizeAgentLocale(candidate) === requestedLocale))
  ) {
    return false;
  }

  return true;
}

const HOSTED_RETRIEVAL_SOURCE_FIELDS = [
  "source_canonical_url",
  "source_scope_audience",
  "source_scope_locale",
  "source_scope_framework",
  "source_scope_version",
  "source_scope_version_groups",
  "source_scope_package",
  "source_scope_tags",
  "source_scope_truncated",
  "source_scope_conflicts",
  "source_last_modified",
  "source_digest",
  "source_index_generation",
] as const;

function readFlattenedHostedRetrievalSource(record: Record<string, unknown>) {
  return parseDocsRetrievalSource(
    {
      canonicalUrl: record.source_canonical_url,
      scope: {
        audience: record.source_scope_audience,
        locale: record.source_scope_locale,
        framework: record.source_scope_framework,
        version: record.source_scope_version,
        versionGroups: (() => {
          const value = record.source_scope_version_groups;
          if (typeof value !== "string") return value;
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })(),
        package: record.source_scope_package,
        tags: record.source_scope_tags,
        truncated: record.source_scope_truncated,
        conflicts: record.source_scope_conflicts,
      },
      lastModified: record.source_last_modified,
      digest: record.source_digest,
      indexGeneration: record.source_index_generation,
    },
    { allowRootRelativeCanonical: true },
  );
}

function readHostedRetrievalSource(record: Record<string, unknown>) {
  const hasNested = record.source !== undefined;
  const hasFlattened = HOSTED_RETRIEVAL_SOURCE_FIELDS.some((key) => key in record);
  if (hasNested) {
    const nested = parseDocsRetrievalSource(record.source, {
      allowRootRelativeCanonical: true,
    });
    if (!nested) return undefined;
    if (!hasFlattened) return nested;

    const flattened = readFlattenedHostedRetrievalSource(record);
    return flattened && JSON.stringify(flattened) === JSON.stringify(nested) ? nested : undefined;
  }

  return readFlattenedHostedRetrievalSource(record);
}

function hasHostedRetrievalSource(record: Record<string, unknown>): boolean {
  return (
    record.source !== undefined ||
    ["source_corpus_id", "source_document_id", ...HOSTED_RETRIEVAL_SOURCE_FIELDS].some(
      (key) => key in record,
    )
  );
}

function serializeHostedRetrievalSource(
  source: DocsRetrievalSourceProvenance | undefined,
  corpusId?: string,
  sourceDocumentId?: string,
): Record<string, unknown> {
  if (!source) return {};
  return {
    source_corpus_id: corpusId,
    source_document_id: sourceDocumentId,
    source_canonical_url: source.canonicalUrl,
    source_scope_audience: source.scope.audience,
    source_scope_locale: source.scope.locale,
    source_scope_framework: source.scope.framework,
    source_scope_version: source.scope.version,
    source_scope_version_groups: source.scope.versionGroups
      ? JSON.stringify(source.scope.versionGroups)
      : undefined,
    source_scope_package: source.scope.package,
    source_scope_tags: source.scope.tags,
    source_scope_truncated: source.scope.truncated,
    source_scope_conflicts: source.scope.conflicts,
    source_last_modified: source.lastModified,
    source_digest: source.digest,
    source_index_generation: source.indexGeneration,
  };
}

function resolveHostedCorpusId(
  syncNamespace: string | undefined,
  context: Pick<DocsSearchAdapterContext, "audience" | "locale" | "baseUrl" | "indexBaseUrl">,
): string | undefined {
  const explicitNamespace = syncNamespace?.trim();
  if (explicitNamespace && explicitNamespace.length > 1_024) {
    throw new Error("Search syncNamespace must be 1024 characters or fewer.");
  }
  let canonicalIdentity: string | undefined;
  const indexBaseUrl = context.indexBaseUrl;
  if (!explicitNamespace && indexBaseUrl) {
    try {
      const url = new URL(indexBaseUrl);
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password
      ) {
        canonicalIdentity = `${url.origin}${url.pathname.replace(/\/+$/u, "") || "/"}`;
      }
    } catch {
      // Relative/request-derived origins do not establish safe hosted-record ownership.
    }
  }
  const identity = explicitNamespace
    ? `namespace:${explicitNamespace}`
    : canonicalIdentity
      ? `canonical:${canonicalIdentity}`
      : undefined;
  if (!identity) return undefined;

  return hashDocsRetrievalValue(
    JSON.stringify({
      format: "docs-hosted-corpus.v1",
      identity,
      audience: resolveDocsSearchAudience(context.audience),
      locale: context.locale ? normalizeAgentLocale(context.locale) : "__all__",
    }),
  );
}

function resolveHostedHumanCorpusId(
  syncNamespace: string | undefined,
  context: DocsSearchAdapterContext,
): string | undefined {
  return resolveHostedCorpusId(syncNamespace, {
    audience: "human",
    locale: context.locale,
    baseUrl: context.baseUrl,
    indexBaseUrl: context.indexBaseUrl,
  });
}

function makeHostedProviderDocumentId(corpusId: string, sourceDocumentId: string): string {
  const digest = hashDocsRetrievalValue(
    JSON.stringify({
      format: "docs-hosted-document.v1",
      corpusId,
      sourceDocumentId,
    }),
  );
  return `docs_${digest.slice("sha256:".length)}`;
}

function readHostedSourceDocumentId(record: Record<string, unknown>): string | undefined {
  return parseRetrievalSourceString(record.source_document_id, MAX_RETRIEVAL_SOURCE_URL_CHARS);
}

function hostedRecordMatchesCorpus(
  record: Record<string, unknown>,
  corpusId: string | undefined,
): boolean {
  if (!corpusId) return true;
  if (record.source_corpus_id === corpusId) return true;
  return record.source_corpus_id === undefined && !hasHostedRetrievalSource(record);
}

async function enrichDocsSearchResultsWithSources(options: {
  results: readonly DocsSearchResult[];
  pages: readonly DocsSearchSourcePage[];
  generationPages?: readonly DocsSearchSourcePage[];
  audience: DocsContentAudience;
  chunking: DocsSearchChunkingConfig;
  baseUrl?: string;
  indexGeneration?: string;
  strictExternalOrigins?: boolean;
  filters?: DocsSearchFilters;
  locale?: string;
  requireCurrentIndexGeneration?: boolean;
}): Promise<DocsSearchResult[]> {
  const digestCache = new Map<DocsSearchSourcePage, string>();
  const localizedPages = options.pages.map((page) => localizeDocsSearchPage(page, options.locale));
  const pagesByRoute = new Map<string, DocsSearchSourcePage>();
  for (const page of localizedPages) {
    const route = normalizeUrlRouteKey(page.url);
    if (!pagesByRoute.has(route)) pagesByRoute.set(route, page);
  }
  let resolvedIndexGeneration: Promise<string> | undefined;
  const getIndexGeneration = () => {
    resolvedIndexGeneration ??= options.indexGeneration
      ? Promise.resolve(options.indexGeneration)
      : buildDocsSearchIndexGeneration(options.generationPages ?? options.pages, {
          audience: options.audience,
          chunking: options.chunking,
          locale: options.locale,
          baseUrl: options.baseUrl,
          digestCache,
        });
    return resolvedIndexGeneration;
  };

  const results = await Promise.all(
    options.results.map(async (result) => {
      const { source: rawSource, ...resultWithoutSource } = result;
      const page = findPageForSearchResult(localizedPages, result, options.baseUrl, pagesByRoute);
      if (page) {
        return {
          ...resultWithoutSource,
          source: await buildDocsRetrievalSource(page, result.url, {
            audience: options.audience,
            chunking: options.chunking,
            locale: options.locale,
            baseUrl: options.baseUrl,
            indexGeneration: await getIndexGeneration(),
            digestCache,
          }),
        };
      }

      if (rawSource === undefined) return resultWithoutSource;
      const source = parseDocsRetrievalSource(rawSource, {
        allowRootRelativeCanonical: options.requireCurrentIndexGeneration,
      });
      if (!source) return null;
      if (
        !docsRetrievalSourceMatchesRequest(
          source,
          options.audience,
          options.filters,
          options.locale,
        )
      ) {
        return null;
      }
      if (
        options.requireCurrentIndexGeneration &&
        source.indexGeneration !== (await getIndexGeneration())
      ) {
        return null;
      }
      return { ...resultWithoutSource, source };
    }),
  );
  return results.filter((result): result is DocsSearchResult => Boolean(result));
}

async function enrichDocsSearchDocumentsWithSources(options: {
  documents: readonly DocsSearchDocument[];
  pages: readonly DocsSearchSourcePage[];
  audience: DocsContentAudience;
  chunking: DocsSearchChunkingConfig;
  locale?: string;
  baseUrl?: string;
  indexGeneration?: string;
}): Promise<DocsSearchDocument[]> {
  const results = await enrichDocsSearchResultsWithSources({
    results: options.documents.map((document) => ({
      id: document.id,
      url: document.url,
      content: document.title,
      description: document.description,
      type: document.type,
      section: document.section,
      source: document.source,
    })),
    pages: options.pages,
    audience: options.audience,
    chunking: options.chunking,
    locale: options.locale,
    baseUrl: options.baseUrl,
    indexGeneration: options.indexGeneration,
  });
  const sources = new Map(results.map((result) => [result.id, result.source] as const));

  return options.documents.map((document) => {
    const source = sources.get(document.id);
    return source ? { ...document, source } : document;
  });
}

export interface EnrichDocsSearchDocumentsWithProvenanceOptions {
  documents: readonly DocsSearchDocument[];
  pages: readonly DocsSearchSourcePage[];
  audience?: DocsContentAudience;
  chunking?: DocsSearchChunkingConfig;
  locale?: string;
  baseUrl?: string;
  indexGeneration?: string;
}

/**
 * Attach the same canonical provenance used by built-in search providers.
 * Custom adapters can call this before persisting their own hosted records.
 */
export function enrichDocsSearchDocumentsWithProvenance(
  options: EnrichDocsSearchDocumentsWithProvenanceOptions,
): Promise<DocsSearchDocument[]> {
  return enrichDocsSearchDocumentsWithSources({
    ...options,
    audience: resolveDocsSearchAudience(options.audience),
    chunking: options.chunking ?? { strategy: "section" },
  });
}

function isLocalProviderResult(result: DocsSearchResult, baseUrl?: string): boolean {
  const rawUrl = result.url.trim();
  const explicitScheme = rawUrl.match(/^([a-z][a-z\d+.-]*):/iu)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") return false;
  const explicitlyHosted = /^[a-z][a-z\d+.-]*:/iu.test(rawUrl) || /^[\\/]{2}/u.test(rawUrl);
  if (!explicitlyHosted) return true;
  if (!baseUrl) return false;

  try {
    return new URL(result.url, baseUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function hasOppositeAudienceEvidence(options: {
  result: DocsSearchResult;
  pages: DocsSearchSourcePage[];
  query: string;
  audience: DocsContentAudience;
  baseUrl?: string;
}): boolean {
  const { result, pages, query, audience, baseUrl } = options;
  if (!isLocalProviderResult(result, baseUrl)) return false;

  const pagePath = normalizeUrlRouteKey(result.url);
  const page = pages.find((candidate) => normalizeUrlRouteKey(candidate.url) === pagePath);
  if (!page) return false;
  if (scoreDocument(query, pageToSearchDocument(page, audience)) > 0) return false;

  const oppositeAudience = audience === "agent" ? "human" : "agent";
  if (scoreDocument(query, pageToSearchDocument(page, oppositeAudience)) > 0) return true;

  const evidence = cleanSearchResultText(result.description);
  if (!evidence) return false;
  const selectedTokens = new Set(tokenizeSearchQuery(getPageAudienceSearchText(page, audience)));
  const oppositeTokens = new Set(
    tokenizeSearchQuery(getPageAudienceSearchText(page, oppositeAudience)),
  );
  const evidenceTokens = [...new Set(tokenizeSearchQuery(evidence))];
  let selectedOnlyMatches = 0;
  let oppositeOnlyMatches = 0;

  for (const token of evidenceTokens) {
    const inSelected = selectedTokens.has(token);
    const inOpposite = oppositeTokens.has(token);
    if (inSelected && !inOpposite) selectedOnlyMatches += 1;
    if (inOpposite && !inSelected) oppositeOnlyMatches += 1;
  }

  return oppositeOnlyMatches > selectedOnlyMatches;
}

function pageToSearchDocument(
  rawPage: DocsSearchSourcePage,
  audience: DocsContentAudience = "human",
): DocsSearchDocument {
  const page = localizeDocsSearchPage(rawPage, rawPage.locale);
  const scope = resolveDocsSearchPageScope(page);
  return {
    id: makeDocumentId(page.url, "page"),
    url: page.url,
    title: page.title,
    content: getPageAudienceIndexContent(page, audience),
    description: page.description,
    type: "page",
    locale: page.locale,
    framework: scope.framework[0],
    version: scope.version[0],
    package: scope.package.length > 0 ? scope.package : undefined,
    tags: scope.tags.length > 0 ? scope.tags : undefined,
  };
}

function buildExactPageSearchResults(
  query: string,
  pages: DocsSearchSourcePage[],
  audience: DocsContentAudience = "human",
): DocsSearchResult[] {
  const normalizedQuery = normalizeSearchPhrase(query);
  if (!normalizedQuery) return [];

  const results: DocsSearchResult[] = [];

  for (const page of pages) {
    const document = pageToSearchDocument(page, audience);
    const title = normalizeSearchPhrase(page.title);
    const urlSegments = getUrlSearchSegments(page.url);
    const isExactPageMatch = title === normalizedQuery || urlSegments.includes(normalizedQuery);

    if (!isExactPageMatch) continue;

    results.push({
      id: document.id,
      url: document.url,
      content: cleanSearchResultText(document.title) ?? document.title,
      description: cleanSearchResultText(buildSnippet(document, query) ?? document.description),
      type: "page",
      score: scoreDocument(query, document) + 2_000,
    });
  }

  return results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.url.localeCompare(b.url));
}

function hasDistinctResultSection(result: DocsSearchResult): boolean {
  if (result.type === "page") return false;
  const section = normalizeSearchPhrase(stripHtml(result.section ?? ""));
  if (!section) return true;

  const label = normalizeSearchPhrase(stripHtml(result.content));
  const title = label.split(/\s+[—–]\s+/)[0] ?? "";
  return section !== normalizeSearchPhrase(title);
}

function insideLiteralResultPriority(query: string, result: DocsSearchResult): number {
  if (!hasDistinctResultSection(result) || !isLiteralLookupQuery(query)) return 0;

  return Math.max(
    literalMatchPriority(query, stripHtml(result.section ?? "")),
    literalMatchPriority(query, stripHtml(result.description ?? "")),
  );
}

function prioritizeLiteralInsideResults(
  query: string,
  results: DocsSearchResult[],
): DocsSearchResult[] {
  if (!isLiteralLookupQuery(query)) return results;

  return [...results].sort((a, b) => {
    const literalDelta =
      insideLiteralResultPriority(query, b) - insideLiteralResultPriority(query, a);
    if (literalDelta) return literalDelta;
    return 0;
  });
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
  if (result.source) {
    const scope = result.source.scope;
    const scopeEntries = [
      `audience=${scope.audience}`,
      scope.locale?.length ? `locale=${scope.locale.join(",")}` : undefined,
      scope.framework?.length ? `framework=${scope.framework.join(",")}` : undefined,
      scope.version?.length ? `version=${scope.version.join(",")}` : undefined,
      scope.package?.length ? `package=${scope.package.join(",")}` : undefined,
      scope.tags?.length ? `tags=${scope.tags.join(",")}` : undefined,
      scope.conflicts?.length ? `conflicts=${scope.conflicts.join(",")}` : undefined,
    ].filter((value): value is string => Boolean(value));
    lines.push(`Canonical URL: ${result.source.canonicalUrl}`);
    lines.push(`Source scope: ${scopeEntries.join("; ")}`);
    if (result.source.lastModified) {
      lines.push(`Source modified: ${result.source.lastModified}`);
    }
    lines.push(`Source digest: ${result.source.digest}`);
    lines.push(`Index generation: ${result.source.indexGeneration}`);
  }
  lines.push("", result.contextContent);
  return lines.join("\n").trim();
}

function makeDocumentId(url: string, suffix: string): string {
  return `${url}#${suffix}`;
}

function splitPageIntoSections(
  page: DocsSearchSourcePage,
  audience: DocsContentAudience = "human",
): DocsSearchDocument[] {
  // Search, Ask AI, and MCP parse the same agent document. The shared section parser assigns
  // authored/rendered anchors before marker-wrapped contract headings, preserving DOM citations.
  const raw = getPageAudienceSectionContent(page, audience);
  const generatedContract =
    audience === "agent" ? findDocsGeneratedAgentContractRanges(raw)[0] : undefined;
  const scope = resolveDocsSearchPageScope(page);
  let documentIndex = 0;
  return parseDocsMarkdownSections(raw).flatMap((section) => {
    // Contract metadata remains searchable through the page summary. Its generated headings stay
    // MCP-addressable but do not become duplicate search chunks.
    if (
      generatedContract &&
      section.startLine > generatedContract.startLine &&
      section.startLine < generatedContract.endLine
    ) {
      return [];
    }
    const content = normalizeWhitespace(stripMarkdownText(section.content));
    if (!content) return [];
    const index = documentIndex;
    documentIndex += 1;

    return [
      {
        id: makeDocumentId(page.url, `section-${index}`),
        url: `${page.url.split("#", 1)[0]}#${encodeURIComponent(section.anchor)}`,
        title: page.title,
        section: section.title,
        content,
        description: page.description,
        type: "heading" as const,
        locale: page.locale,
        framework: scope.framework[0],
        version: scope.version[0],
        package: scope.package.length > 0 ? scope.package : undefined,
        tags: scope.tags.length > 0 ? scope.tags : undefined,
      },
    ];
  });
}

export function buildDocsSearchDocuments(
  pages: DocsSearchSourcePage[],
  chunking: DocsSearchChunkingConfig = {},
  audience: DocsContentAudience = "human",
): DocsSearchDocument[] {
  const strategy = chunking.strategy ?? "section";

  return pages.flatMap((rawPage) => {
    const page = localizeDocsSearchPage(rawPage, rawPage.locale);
    const base = pageToSearchDocument(page, audience);

    if (strategy === "page") return [base];

    const sections = splitPageIntoSections(page, audience);
    if (sections.length === 0) return [base];

    const pageSummary = base.content ? [base] : [];
    return [...pageSummary, ...sections];
  });
}

function scoreDocument(query: string, document: DocsSearchDocument): number {
  const q = normalizeSearchPhrase(query);
  if (!q) return 0;

  const words = tokenizeSearchQuery(q);
  const title = normalizeSearchPhrase(document.title);
  const section = document.section ? normalizeSearchPhrase(document.section) : "";
  const hasDistinctSection = Boolean(section && section !== title);
  const titleSection = section
    ? normalizeSearchPhrase(`${document.title} ${document.section}`)
    : "";
  const description = document.description ? normalizeSearchPhrase(document.description) : "";
  const content = normalizeSearchPhrase(document.content);
  const url = normalizeSearchPhrase(document.url);
  const urlSegments = getUrlSearchSegments(document.url);
  const titleTokens = tokenizeSearchQuery(title);
  const sectionTokens = tokenizeSearchQuery(section);

  let score = 0;
  const insideLiteralPriority =
    document.type !== "page" && hasDistinctSection && isLiteralLookupQuery(q)
      ? Math.max(
          literalMatchPriority(q, section),
          literalMatchPriority(q, description),
          literalMatchPriority(q, content),
        )
      : 0;

  if (insideLiteralPriority > 0) {
    score += insideLiteralPriority * 2_250;
  }

  if (title === q) score += 1_120;
  else if (title.startsWith(q)) score += 70;
  else if (title.includes(q)) score += 45;

  if (hasDistinctSection) {
    if (section === q) score += 1_080;
    else if (section.startsWith(q)) score += 55;
    else if (section.includes(q)) score += 30;

    if (titleSection === q) score += 1_000;
    else if (titleSection.startsWith(q)) score += 50;
    else if (titleSection.includes(q)) score += 28;
  }

  if (urlSegments.includes(q)) score += 950;
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

    if (hasDistinctSection) {
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
    if (
      hasDistinctSection &&
      sectionTokens.length > 0 &&
      words.every((word) => sectionTokens.includes(word))
    ) {
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
  if (score > 0 && document.type === "heading" && hasDistinctSection) score += 6;

  return score;
}

function buildSnippet(document: DocsSearchDocument, query: string): string | undefined {
  const q = query.trim().toLowerCase();
  const sources = [
    normalizeWhitespace(stripMarkdownText(document.content)),
    normalizeWhitespace(stripMarkdownText(document.description ?? "")),
  ].filter(Boolean);

  for (const source of sources) {
    if (!q) return clampSearchSnippet(source);

    const idx = source.toLowerCase().indexOf(q);
    if (idx === -1) continue;

    const start = Math.max(0, idx - 48);
    const end = Math.min(source.length, idx + q.length + 96);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < source.length ? "..." : "";
    return clampSearchSnippet(`${prefix}${source.slice(start, end).trim()}${suffix}`);
  }

  return sources[0] ? clampSearchSnippet(sources[0]) : undefined;
}

function clampSearchSnippet(value: string): string {
  if (value.length <= MAX_SEARCH_SNIPPET_CHARS) return value;
  return `${value.slice(0, MAX_SEARCH_SNIPPET_CHARS - 3).trimEnd()}...`;
}

function cleanSearchResultText(value?: string): string | undefined {
  if (!value) return undefined;

  const cleaned = normalizeWhitespace(stripHtml(stripMarkdownText(value)));
  return cleaned || undefined;
}

function getHostedIndexGenerationTag(indexGeneration: string): string {
  return `docs-generation:${indexGeneration}`;
}

function buildAlgoliaRecord(document: DocsSearchDocument, corpusId?: string) {
  const providerDocumentId = corpusId
    ? makeHostedProviderDocumentId(corpusId, document.id)
    : document.id;
  const generationTag = document.source?.indexGeneration
    ? getHostedIndexGenerationTag(document.source.indexGeneration)
    : undefined;
  const record: Record<string, unknown> = {
    objectID: providerDocumentId,
    id: providerDocumentId,
    url: document.url,
    title: document.title,
    section: document.section,
    content: document.content,
    description: document.description,
    type: document.type,
    locale: document.locale ?? document.source?.scope.locale?.[0],
    framework: document.framework,
    version: document.version,
    package: document.package,
    tags: document.tags,
    _tags:
      corpusId || generationTag
        ? [corpusId, generationTag].filter((value): value is string => Boolean(value))
        : undefined,
    ...serializeHostedRetrievalSource(document.source, corpusId, document.id),
  };

  const encoder = new TextEncoder();
  const sizeOf = (value: Record<string, unknown>) => encoder.encode(JSON.stringify(value)).length;
  if (sizeOf(record) <= ALGOLIA_MAX_RECORD_BYTES) return record;

  delete record.description;
  if (sizeOf(record) <= ALGOLIA_MAX_RECORD_BYTES) return record;

  record.content = "";
  for (const field of ["package", "tags", "framework", "version"]) {
    if (sizeOf(record) <= ALGOLIA_MAX_RECORD_BYTES) break;
    delete record[field];
  }

  const trimFieldToFit = (field: "section" | "title" | "content", value: string) => {
    let low = 0;
    let high = value.length;
    let best = "";
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = middle < value.length ? `${value.slice(0, middle).trimEnd()}...` : value;
      record[field] = candidate;
      if (sizeOf(record) <= ALGOLIA_MAX_RECORD_BYTES) {
        best = candidate;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    record[field] = best;
  };

  if (sizeOf(record) > ALGOLIA_MAX_RECORD_BYTES && typeof record.section === "string") {
    trimFieldToFit("section", record.section);
  }
  if (sizeOf(record) > ALGOLIA_MAX_RECORD_BYTES && typeof record.title === "string") {
    trimFieldToFit("title", record.title);
  }
  if (sizeOf(record) > ALGOLIA_MAX_RECORD_BYTES) {
    throw new Error(
      `Algolia record ${document.id} exceeds the record limit with required provenance.`,
    );
  }

  trimFieldToFit("content", document.content);
  if (sizeOf(record) > ALGOLIA_MAX_RECORD_BYTES) {
    throw new Error(`Algolia record ${document.id} still exceeds the record limit after trimming.`);
  }

  return record;
}

async function searchSimpleDocsPage(
  query: DocsSearchQuery,
  context: DocsSearchAdapterContext,
): Promise<DocsSearchAdapterPage> {
  const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
  const offset = query.offset ?? 0;
  const matches = context.documents
    .map((document) => ({
      document,
      score: scoreDocument(query.query, document),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.document.url.localeCompare(b.document.url);
    });
  const results = matches.slice(offset, offset + limit).map(({ document, score }) => ({
    id: document.id,
    url: document.url,
    content:
      cleanSearchResultText(
        document.section ? `${document.title} — ${document.section}` : document.title,
      ) ?? (document.section ? `${document.title} — ${document.section}` : document.title),
    description: cleanSearchResultText(buildSnippet(document, query.query) ?? document.description),
    type: document.type,
    score,
    section: document.section,
    source: document.source,
  }));

  const enriched = context.deferSourceProvenance
    ? results
    : await enrichDocsSearchResultsWithSources({
        results,
        pages: context.pages,
        audience: resolveDocsSearchAudience(context.audience),
        chunking: context.chunking ?? { strategy: "section" },
        locale: query.locale ?? context.locale,
        baseUrl: context.baseUrl,
        indexGeneration: context.indexGeneration,
        filters: query.filters,
      });
  return {
    results: enriched,
    total: matches.length,
  };
}

export function createSimpleSearchAdapter(): DocsSearchAdapter {
  return {
    name: "simple",
    async search(query, context) {
      return (await searchSimpleDocsPage({ ...query, offset: 0 }, context)).results;
    },
    searchPage: searchSimpleDocsPage,
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

function getDocsSearchPaginationProviderIdentity(
  search: ResolvedDocsSearchConfig,
): Record<string, unknown> {
  const raw = search.raw;
  if (raw?.provider === "algolia") {
    return {
      provider: "algolia",
      appId: raw.appId,
      indexName: raw.indexName,
      syncNamespace: raw.syncNamespace?.trim() || undefined,
    };
  }
  if (raw?.provider === "typesense") {
    return {
      provider: "typesense",
      baseUrl: raw.baseUrl,
      collection: raw.collection,
      mode: raw.mode ?? "keyword",
      queryBy: raw.queryBy ?? ["title", "section", "content", "description"],
      embeddings: raw.embeddings
        ? {
            provider: raw.embeddings.provider,
            model: raw.embeddings.model,
            baseUrl: raw.embeddings.baseUrl ?? "http://127.0.0.1:11434",
          }
        : undefined,
      syncNamespace: raw.syncNamespace?.trim() || undefined,
    };
  }
  if (raw?.provider === "mcp") {
    return {
      provider: "mcp",
      endpoint: raw.endpoint,
      toolName: raw.toolName ?? "search_docs",
      protocolVersion: raw.protocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION,
      forwardAudience: raw.forwardAudience === true,
    };
  }
  if (raw?.provider === "custom") {
    return {
      provider: "custom",
      adapterName: typeof raw.adapter === "object" && raw.adapter ? raw.adapter.name : undefined,
      paginationRevision: raw.paginationRevision?.trim() || undefined,
    };
  }
  return { provider: search.provider };
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

function mapMcpSearchResult(value: unknown, sourceBaseUrl?: string): DocsSearchResult | null {
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
  const hasSource = item.source !== undefined;
  let sourceValue = item.source;
  if (
    hasSource &&
    sourceBaseUrl &&
    sourceValue &&
    typeof sourceValue === "object" &&
    !Array.isArray(sourceValue)
  ) {
    const sourceRecord = sourceValue as Record<string, unknown>;
    if (
      typeof sourceRecord.canonicalUrl === "string" &&
      /^\/(?!\/)/u.test(sourceRecord.canonicalUrl)
    ) {
      try {
        sourceValue = {
          ...sourceRecord,
          canonicalUrl: new URL(sourceRecord.canonicalUrl, sourceBaseUrl).toString(),
        };
      } catch {
        // The strict parser below will reject the unresolved relative source.
      }
    }
  }
  const source = hasSource ? parseDocsRetrievalSource(sourceValue) : undefined;
  if (hasSource && !source) return null;

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
    ...(source ? { source } : {}),
  };
}

function readMcpSearchToolPayload(payload: unknown): unknown {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("result" in payload) ||
    !payload.result ||
    typeof payload.result !== "object"
  ) {
    return null;
  }

  const result = payload.result as Record<string, unknown>;
  if (
    result.structuredContent &&
    typeof result.structuredContent === "object" &&
    !Array.isArray(result.structuredContent)
  ) {
    return result.structuredContent;
  }

  const content = Array.isArray(result.content) ? result.content : [];
  const resultText =
    content.length > 0 &&
    content[0] &&
    typeof content[0] === "object" &&
    "text" in content[0] &&
    typeof content[0].text === "string"
      ? content[0].text
      : null;

  return resultText ? JSON.parse(resultText) : null;
}

async function createOllamaEmbedding(
  text: string,
  config: NonNullable<TypesenseDocsSearchConfig["embeddings"]>,
  signal?: AbortSignal,
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
      signal,
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

function quoteTypesenseFilterValue(value: string): string {
  return `\`${value.replace(/\\/gu, "\\\\").replace(/`/gu, "\\`")}\``;
}

const TYPESENSE_RETRIEVAL_SOURCE_FIELDS: Array<Record<string, unknown>> = [
  { name: "source_corpus_id", type: "string", optional: true },
  { name: "source_document_id", type: "string", optional: true },
  { name: "source_canonical_url", type: "string", optional: true },
  { name: "source_scope_audience", type: "string", optional: true },
  { name: "source_scope_locale", type: "string[]", optional: true },
  { name: "source_scope_framework", type: "string[]", optional: true },
  { name: "source_scope_version", type: "string[]", optional: true },
  { name: "source_scope_version_groups", type: "string", optional: true },
  { name: "source_scope_package", type: "string[]", optional: true },
  { name: "source_scope_tags", type: "string[]", optional: true },
  { name: "source_scope_truncated", type: "string[]", optional: true },
  { name: "source_scope_conflicts", type: "string[]", optional: true },
  { name: "source_last_modified", type: "string", optional: true },
  { name: "source_digest", type: "string", optional: true },
  { name: "source_index_generation", type: "string", optional: true },
];

async function ensureTypesenseCollection(
  config: TypesenseDocsSearchConfig,
  dimensions?: number,
  signal?: AbortSignal,
  retryAfterCreateConflict = true,
  retryAfterAlterFailure = true,
) {
  const baseUrl = getTypesenseSearchBase(config);
  const headers = {
    "X-TYPESENSE-API-KEY": config.adminApiKey ?? config.apiKey,
    "Content-Type": "application/json",
  };

  const existing = await fetch(`${baseUrl}/collections/${encodeURIComponent(config.collection)}`, {
    headers,
    signal,
  });

  if (existing.ok) {
    const existingPayload = (await readResponseJson(existing)) as {
      fields?: Array<{ name?: unknown; type?: unknown; optional?: unknown; num_dim?: unknown }>;
    } | null;
    if (!Array.isArray(existingPayload?.fields)) {
      throw new Error("Typesense collection response did not include a fields array.");
    }
    const existingFields = new Map(
      existingPayload.fields.flatMap((field) =>
        typeof field.name === "string" ? [[field.name, field] as const] : [],
      ),
    );
    const incompatibleFields = TYPESENSE_RETRIEVAL_SOURCE_FIELDS.flatMap((expected) => {
      const name = typeof expected.name === "string" ? expected.name : undefined;
      const existingField = name ? existingFields.get(name) : undefined;
      if (!name || !existingField) return [];
      return existingField.type === expected.type && existingField.optional === true ? [] : [name];
    });
    if (incompatibleFields.length > 0) {
      throw new Error(
        `Typesense collection has incompatible provenance fields: ${incompatibleFields.join(", ")}.`,
      );
    }
    const missingFields = TYPESENSE_RETRIEVAL_SOURCE_FIELDS.filter(
      (field) => typeof field.name === "string" && !existingFields.has(field.name),
    );
    const embeddingField = existingPayload.fields.find((field) => field.name === "embedding");
    const expectedEmbeddingField =
      config.embeddings && dimensions
        ? {
            name: "embedding",
            type: "float[]",
            num_dim: dimensions,
            optional: true,
          }
        : undefined;
    const replaceEmbedding = Boolean(
      expectedEmbeddingField &&
      embeddingField &&
      (embeddingField.type !== "float[]" || embeddingField.num_dim !== dimensions),
    );

    if (replaceEmbedding) {
      const dropped = await fetch(
        `${baseUrl}/collections/${encodeURIComponent(config.collection)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ fields: [{ name: "embedding", drop: true }] }),
          signal,
        },
      );
      ensureOk(dropped, "Failed to replace an incompatible Typesense embedding field");
    }

    const fieldsToAdd = [
      ...missingFields,
      ...(expectedEmbeddingField && (!embeddingField || replaceEmbedding)
        ? [expectedEmbeddingField]
        : []),
    ];
    if (fieldsToAdd.length === 0) return;

    const altered = await fetch(`${baseUrl}/collections/${encodeURIComponent(config.collection)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields: fieldsToAdd }),
      signal,
    });
    if (!altered.ok && retryAfterAlterFailure) {
      // Another instance may have added the same fields after our inspection.
      // Re-read and validate the complete schema before accepting that race.
      await ensureTypesenseCollection(config, dimensions, signal, retryAfterCreateConflict, false);
      return;
    }
    ensureOk(altered, "Failed to update the Typesense search schema");
    return;
  }
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
    { name: "package", type: "string[]", optional: true },
    { name: "tags", type: "string[]", optional: true },
    ...TYPESENSE_RETRIEVAL_SOURCE_FIELDS,
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
    signal,
  });

  if (response.status === 409 && retryAfterCreateConflict) {
    await ensureTypesenseCollection(config, dimensions, signal, false, retryAfterAlterFailure);
    return;
  }
  ensureOk(response, "Failed to create Typesense collection");
}

async function ensureTypesenseImportSucceeded(
  response: Response,
  expectedRecords: number,
): Promise<void> {
  ensureOk(response, "Failed to sync documents to Typesense");
  const payload = await response.text();
  const lines = payload.split(/\r?\n/u).filter((line) => line.trim());
  if (lines.length !== expectedRecords) {
    throw new Error(
      `Typesense acknowledged ${lines.length} of ${expectedRecords} imported records.`,
    );
  }

  for (const [index, line] of lines.entries()) {
    let result: { success?: unknown; error?: unknown };
    try {
      result = JSON.parse(line) as { success?: unknown; error?: unknown };
    } catch {
      throw new Error(`Typesense import returned invalid JSON on record ${index + 1}.`);
    }
    if (result.success !== true) {
      const detail = typeof result.error === "string" ? `: ${result.error}` : "";
      throw new Error(`Typesense failed to import record ${index + 1}${detail}`);
    }
  }
}

export function createTypesenseSearchAdapter(config: TypesenseDocsSearchConfig): DocsSearchAdapter {
  const adapter: DocsSearchAdapter = {
    name: "typesense",
    async index(context) {
      const adminApiKey = config.adminApiKey ?? config.apiKey;
      const corpusId = resolveHostedHumanCorpusId(config.syncNamespace, context);
      const documents = await enrichDocsSearchDocumentsWithSources({
        documents: context.documents,
        pages: context.pages,
        audience: resolveDocsSearchAudience(context.audience),
        chunking: context.chunking ?? { strategy: "section" },
        locale: context.locale,
        baseUrl: context.baseUrl,
        indexGeneration: context.indexGeneration,
      });
      const docsForImport = await Promise.all(
        documents.map(async (document) => {
          const providerDocumentId = corpusId
            ? makeHostedProviderDocumentId(corpusId, document.id)
            : document.id;
          const next: Record<string, unknown> = {
            id: providerDocumentId,
            url: document.url,
            title: document.title,
            section: document.section,
            content: document.content,
            description: document.description,
            type: document.type,
            locale: document.locale ?? document.source?.scope.locale?.[0],
            framework: document.framework,
            version: document.version,
            package: document.package,
            tags: document.tags,
            ...serializeHostedRetrievalSource(document.source, corpusId, document.id),
          };

          if (config.mode === "hybrid" && config.embeddings) {
            next.embedding = await createOllamaEmbedding(
              `${document.title}\n${document.section ?? ""}\n${document.content}`.trim(),
              config.embeddings,
              context.signal,
            );
          }

          return next;
        }),
      );

      const embeddingDimensions = Array.isArray(docsForImport[0]?.embedding)
        ? (docsForImport[0].embedding as number[]).length
        : undefined;

      await ensureTypesenseCollection(config, embeddingDimensions, context.signal);
      if (docsForImport.length > 0) {
        const response = await fetch(
          `${getTypesenseSearchBase(config)}/collections/${encodeURIComponent(config.collection)}/documents/import?action=upsert`,
          {
            method: "POST",
            headers: {
              "X-TYPESENSE-API-KEY": adminApiKey,
              "Content-Type": "text/plain",
            },
            body: docsForImport.map((document) => JSON.stringify(document)).join("\n"),
            signal: context.signal,
          },
        );
        await ensureTypesenseImportSucceeded(response, docsForImport.length);
      }
    },
    async search(query, context) {
      return (
        await adapter.searchPage!(
          {
            ...query,
            offset: 0,
            [DOCS_UNPAGINATED_PROVIDER_QUERY]: true,
          } as InternalDocsSearchQuery,
          context,
        )
      ).results;
    },
    async searchPage(query, context) {
      const exactPagination = !(query as InternalDocsSearchQuery)[DOCS_UNPAGINATED_PROVIDER_QUERY];
      const corpusId = resolveHostedHumanCorpusId(config.syncNamespace, context);
      const scopedDocumentIds = resolveProviderScopeDocumentIds(query, context, corpusId);
      if (scopedDocumentIds === DOCS_PROVIDER_SCOPE_FILTER_OVERFLOW) {
        throw new Error("Typesense scope filters exceed the provider pagination limit.");
      }
      if (scopedDocumentIds?.length === 0) {
        return { results: [], total: 0 };
      }

      const pageSize = query.limit ?? config.maxResults ?? DEFAULT_SEARCH_LIMIT;
      if ((query.offset ?? 0) % pageSize !== 0) {
        throw new Error("Typesense search offset does not match its page boundary.");
      }
      const params = new URLSearchParams({
        q: query.query,
        query_by: (config.queryBy ?? ["title", "section", "content", "description"]).join(","),
        per_page: String(pageSize),
        prioritize_exact_match: "true",
        num_typos: "2",
        highlight_fields: "content,title,section,description",
        page: String(Math.floor((query.offset ?? 0) / pageSize) + 1),
      });

      if (config.mode === "hybrid" && config.embeddings) {
        const vector = await createOllamaEmbedding(query.query, config.embeddings, context.signal);
        params.set(
          "vector_query",
          `embedding:([${vector.join(",")}],k:${Math.max((query.limit ?? 10) * 4, 20)})`,
        );
      }

      const filterClauses = [
        corpusId ? `source_corpus_id:=${quoteTypesenseFilterValue(corpusId)}` : undefined,
        context.indexGeneration
          ? `source_index_generation:=${quoteTypesenseFilterValue(context.indexGeneration)}`
          : undefined,
        scopedDocumentIds
          ? `id:=[${scopedDocumentIds.map(quoteTypesenseFilterValue).join(",")}]`
          : undefined,
      ].filter((value): value is string => Boolean(value));
      const filterBy = filterClauses.length > 0 ? filterClauses.join(" && ") : undefined;
      if (filterBy && filterBy.length > MAX_PROVIDER_SCOPE_FILTER_CHARS) {
        throw new Error("Typesense scope filters exceed the provider pagination limit.");
      }

      const response = filterBy
        ? await fetch(`${getTypesenseSearchBase(config)}/multi_search`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-TYPESENSE-API-KEY": config.apiKey,
            },
            body: JSON.stringify({
              searches: [
                {
                  collection: config.collection,
                  ...Object.fromEntries(params),
                  filter_by: filterBy,
                },
              ],
            }),
            signal: context.signal,
          })
        : await fetch(
            `${getTypesenseSearchBase(config)}/collections/${encodeURIComponent(config.collection)}/documents/search?${params.toString()}`,
            {
              headers: {
                "X-TYPESENSE-API-KEY": config.apiKey,
              },
              signal: context.signal,
            },
          );

      ensureOk(response, "Typesense search failed");
      const rawPayload = (await readResponseJson(response)) as {
        found?: number;
        search_cutoff?: boolean;
        hits?: Array<{
          document?: Record<string, unknown>;
          text_match?: number;
          highlights?: Array<{ field?: string; snippet?: string }>;
        }>;
        results?: Array<{
          found?: number;
          search_cutoff?: boolean;
          hits?: Array<{
            document?: Record<string, unknown>;
            text_match?: number;
            highlights?: Array<{ field?: string; snippet?: string }>;
          }>;
        }>;
      };
      const payload = filterBy ? (rawPayload.results?.[0] ?? {}) : rawPayload;
      if (
        exactPagination &&
        payload.search_cutoff !== undefined &&
        payload.search_cutoff !== false
      ) {
        throw new Error("Typesense search was cut off before exact pagination completed.");
      }

      const results = (payload.hits ?? []).flatMap((hit): DocsSearchResult[] => {
        const document = hit.document ?? {};
        if (!hostedRecordMatchesCorpus(document, corpusId)) return [];
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
        const source = readHostedRetrievalSource(document);
        if (hasHostedRetrievalSource(document) && !source) return [];

        return [
          {
            id:
              readHostedSourceDocumentId(document) ??
              (typeof document.id === "string" ? document.id : String(document.url ?? content)),
            url: typeof document.url === "string" ? document.url : "/docs",
            content: cleanSearchResultText(content) ?? content,
            description: cleanSearchResultText(description),
            type:
              typeof document.type === "string" &&
              ["page", "heading", "text"].includes(document.type)
                ? (document.type as DocsSearchResult["type"])
                : section
                  ? "heading"
                  : "page",
            score: hit.text_match,
            section,
            ...(source ? { source } : {}),
          } satisfies DocsSearchResult,
        ];
      });
      const exactTotal =
        typeof payload.found === "number" &&
        Number.isSafeInteger(payload.found) &&
        payload.found >= 0
          ? payload.found
          : undefined;
      if (exactPagination && exactTotal === undefined) {
        throw new Error("Typesense search did not return an exact result total.");
      }
      const total = exactTotal ?? results.length;
      if (exactPagination && total > MAX_HOSTED_PROVIDER_CURSOR_RESULTS) {
        throw new Error("Typesense search exceeds the exact cursor pagination window.");
      }
      if (
        exactPagination &&
        (query.offset ?? 0) + results.length < total &&
        results.length !== pageSize
      ) {
        throw new Error("Typesense search returned an incomplete non-final page.");
      }
      return { results, total };
    },
  };
  return adapter;
}

export function resolveSearchRequestConfig(
  search: boolean | DocsSearchConfig | undefined,
  requestUrl?: string,
  options?: DocsSearchRequestResolutionOptions,
): boolean | DocsSearchConfig | undefined {
  if (!search || search === true || typeof search !== "object" || search.provider !== "mcp") {
    return search;
  }

  if (options) {
    const localSearch = resolveLocalDocsMcpSearchConfig(search, options.localMcp, requestUrl);
    if (localSearch !== search) return localSearch;
  }

  if (!requestUrl) return search;

  const resolvedEndpoint = new URL(search.endpoint, requestUrl);
  const usesDefaultSearchTool = (search.toolName ?? "search_docs") === "search_docs";
  const isSameOrigin = resolvedEndpoint.origin === new URL(requestUrl).origin;

  return {
    ...search,
    endpoint: resolvedEndpoint.toString(),
    forwardAudience: search.forwardAudience ?? (usesDefaultSearchTool && isSameOrigin),
  };
}

export interface DocsLocalMcpSearchRuntimeConfig {
  enabled?: boolean;
  route?: string;
  tools?: {
    searchDocs?: boolean;
  };
}

export type DocsLocalMcpSearchRuntimeInput =
  | boolean
  | DocsLocalMcpSearchRuntimeConfig
  | null
  | undefined;

export interface DocsSearchRequestResolutionOptions {
  /**
   * The built-in MCP server colocated with this search handler. When the configured
   * provider points at one of its local aliases, search runs directly instead of
   * performing a loopback MCP handshake.
   */
  localMcp?: DocsLocalMcpSearchRuntimeInput;
}

function isLocalDocsMcpSearchEndpoint(
  search: McpDocsSearchConfig,
  localMcp: DocsLocalMcpSearchRuntimeInput,
  requestUrl?: string,
): boolean {
  if (
    localMcp === false ||
    (localMcp !== null &&
      typeof localMcp === "object" &&
      (localMcp.enabled === false || localMcp.tools?.searchDocs === false)) ||
    (search.toolName ?? "search_docs") !== "search_docs"
  ) {
    return false;
  }

  const endpoint = search.endpoint.trim();
  if (!endpoint) return false;

  const route = localMcp !== null && typeof localMcp === "object" ? localMcp.route : undefined;
  let endpointPath: string;

  try {
    if (endpoint.startsWith("/") && !endpoint.startsWith("//")) {
      endpointPath = new URL(endpoint, "https://local.docs.invalid").pathname;
    } else {
      if (!requestUrl) return false;
      const request = new URL(requestUrl);
      const resolvedEndpoint = new URL(endpoint, request);
      if (
        resolvedEndpoint.origin !== request.origin ||
        resolvedEndpoint.username ||
        resolvedEndpoint.password
      ) {
        return false;
      }
      endpointPath = resolvedEndpoint.pathname;
    }
  } catch {
    return false;
  }

  return isDocsMcpResourcePath(endpointPath, route);
}

export function resolveLocalDocsMcpSearchConfig(
  search: boolean | DocsSearchConfig | undefined,
  localMcp: DocsLocalMcpSearchRuntimeInput,
  requestUrl?: string,
): boolean | DocsSearchConfig | undefined {
  if (
    !search ||
    search === true ||
    typeof search !== "object" ||
    search.provider !== "mcp" ||
    !isLocalDocsMcpSearchEndpoint(search, localMcp, requestUrl)
  ) {
    return search;
  }

  return {
    provider: "simple",
    enabled: search.enabled,
    maxResults: search.maxResults,
    chunking: search.chunking,
  };
}

/**
 * Resolve the public search audience without allowing malformed values to opt into agent content.
 * Human search remains the default for omitted, legacy, and unknown query values.
 */
export function resolveDocsSearchAudience(value: string | null | undefined): DocsContentAudience {
  return value === "agent" ? "agent" : "human";
}

export function resolveAskAISearchRequestConfig(options: {
  search: boolean | DocsSearchConfig | undefined;
  useMcp?: boolean | DocsAskAIMcpConfig;
  mcpEndpoint?: string;
  mcpEnabled?: boolean;
  mcpSearchEnabled?: boolean;
  requestUrl?: string;
}): boolean | DocsSearchConfig | undefined {
  if (!options.useMcp) {
    return resolveSearchRequestConfig(options.search, options.requestUrl);
  }

  if (typeof options.useMcp === "object") {
    return resolveSearchRequestConfig(
      {
        ...options.useMcp,
        provider: "mcp",
      },
      options.requestUrl,
    );
  }

  if (options.mcpEnabled === false || options.mcpSearchEnabled === false || !options.mcpEndpoint) {
    return resolveSearchRequestConfig(options.search, options.requestUrl);
  }

  return resolveSearchRequestConfig(
    {
      provider: "mcp",
      endpoint: options.mcpEndpoint,
    },
    options.requestUrl,
  );
}

export function createMcpSearchAdapter(config: McpDocsSearchConfig): DocsSearchAdapter {
  async function runMcpSearch(
    query: DocsSearchQuery,
    context: DocsSearchAdapterContext,
    paginated: boolean,
  ): Promise<DocsSearchResult[] | DocsSearchAdapterPage> {
    const endpoint = resolveMcpEndpoint(config.endpoint);
    const protocolVersion = config.protocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION;
    const toolName = config.toolName ?? "search_docs";
    const forwardAudience = config.forwardAudience === true;
    const audience = resolveDocsSearchAudience(query.audience);
    const baseHeaders = config.headers ?? {};

    if (audience === "human" && !forwardAudience) {
      throw new Error(
        "MCP human-projection search requires forwardAudience: true on an audience-aware tool.",
      );
    }

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
      signal: context.signal,
    });

    const initializePayload = await readMcpResponsePayload(initializeResponse);
    ensureOk(initializeResponse, "MCP search initialization failed");
    ensureJsonRpcOk(initializePayload, "MCP search initialization failed");

    const sessionId = initializeResponse.headers.get("mcp-session-id") ?? undefined;
    try {
      const initializedResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "Content-Type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": protocolVersion,
          ...(sessionId ? { "mcp-session-id": sessionId } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {},
        }),
        signal: context.signal,
      });
      ensureOk(initializedResponse, "MCP initialized notification failed");

      type McpSearchToolData =
        | {
            format?: unknown;
            filters?: unknown;
            resultCount?: unknown;
            results?: unknown[];
            pages?: unknown[];
            total?: unknown;
            hasMore?: unknown;
            nextCursor?: unknown;
          }
        | unknown[]
        | null;

      const pageSize = query.limit ?? config.maxResults ?? DEFAULT_SEARCH_LIMIT;
      const callRemoteSearchPage = async (providerCursor: string | undefined, id: number) => {
        const searchResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            ...baseHeaders,
            "Content-Type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": protocolVersion,
            ...(sessionId ? { "mcp-session-id": sessionId } : {}),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            method: "tools/call",
            params: {
              name: toolName,
              arguments: {
                query: query.query,
                limit: pageSize,
                locale: query.locale,
                ...(providerCursor !== undefined ? { cursor: providerCursor } : {}),
                ...(forwardAudience ? { audience } : {}),
                ...(query.filters?.framework ? { framework: query.filters.framework } : {}),
                ...(query.filters?.version ? { version: query.filters.version } : {}),
                ...(query.filters?.package ? { package: query.filters.package } : {}),
                ...(query.filters?.tags ? { tags: query.filters.tags } : {}),
              },
            },
          }),
          signal: context.signal,
        });

        const payload = await readMcpResponsePayload(searchResponse);
        ensureOk(searchResponse, "MCP search request failed");
        ensureJsonRpcOk(payload, "MCP search request failed");

        const parsed = readMcpSearchToolPayload(payload) as McpSearchToolData;
        if (!parsed) return { parsed, rawResults: [] as unknown[], results: [] };

        if (hasDocsSearchFilters(query.filters ?? {})) {
          if (Array.isArray(parsed) || parsed.format !== "docs-search.v1") {
            if (paginated) throw new Error("MCP search returned unverifiable pagination data.");
            return { parsed, rawResults: [] as unknown[], results: [] };
          }
          const echoedFilters = parseVerifiedMcpSearchFilters(parsed.filters);
          if (!echoedFilters || !docsSearchFiltersMatch(query.filters ?? {}, echoedFilters)) {
            if (paginated) throw new Error("MCP search returned mismatched scope filters.");
            return { parsed, rawResults: [] as unknown[], results: [] };
          }
        }

        const rawResults = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.results)
            ? parsed.results
            : Array.isArray(parsed.pages)
              ? parsed.pages
              : [];
        const results = rawResults
          .map((result) => mapMcpSearchResult(result, endpoint))
          .filter((result): result is DocsSearchResult => Boolean(result));
        return { parsed, rawResults, results };
      };

      if (!paginated) {
        return (await callRemoteSearchPage(undefined, 2)).results;
      }

      const targetOffset = query.offset ?? 0;
      if (
        (targetOffset === 0 && query.cursor !== undefined) ||
        (targetOffset > 0 && query.cursor === undefined)
      ) {
        throw new Error("MCP search continuation is missing or misplaced its provider cursor.");
      }

      let consumed = 0;
      let remoteCursor: string | undefined;
      let expectedTotal: number | undefined;
      const replayResultDigests: string[] = [];
      for (let pageIndex = 0; pageIndex < MAX_MCP_SEARCH_CURSOR_REPLAY_PAGES; pageIndex += 1) {
        const { parsed, rawResults, results } = await callRemoteSearchPage(
          remoteCursor,
          pageIndex + 2,
        );
        if (!parsed) {
          if (targetOffset === 0) return { results: [], total: 0 };
          throw new Error("MCP search continuation ended before the requested page.");
        }
        if (
          Array.isArray(parsed) ||
          parsed.format !== "docs-search.v1" ||
          results.length !== rawResults.length ||
          (parsed.resultCount !== undefined && parsed.resultCount !== results.length) ||
          typeof parsed.total !== "number" ||
          !Number.isSafeInteger(parsed.total) ||
          parsed.total < consumed + results.length ||
          typeof parsed.hasMore !== "boolean" ||
          (parsed.nextCursor !== undefined &&
            (typeof parsed.nextCursor !== "string" || parsed.nextCursor.length > 768))
        ) {
          throw new Error("MCP search returned malformed paginated results.");
        }

        const total = parsed.total;
        const nextCursor = typeof parsed.nextCursor === "string" ? parsed.nextCursor : undefined;
        const hasMore = consumed + results.length < total;
        if (
          (expectedTotal !== undefined && total !== expectedTotal) ||
          parsed.hasMore !== hasMore ||
          (nextCursor !== undefined) !== hasMore ||
          (hasMore && results.length === 0)
        ) {
          throw new Error("MCP search returned inconsistent pagination metadata.");
        }
        expectedTotal ??= total;
        if (total > MAX_MCP_SEARCH_CURSOR_RESULTS) {
          throw new Error("MCP search exceeds its bounded exact pagination window.");
        }

        replayResultDigests.push(
          ...results.map((result) => hashDocsRetrievalValue(JSON.stringify(result))),
        );
        const nextOffset = consumed + results.length;
        const nextCheckpoint = hasMore
          ? hashDocsRetrievalValue(
              JSON.stringify({
                format: "docs-mcp-search-replay.v1",
                total,
                nextOffset,
                resultDigests: replayResultDigests,
              }),
            )
          : undefined;
        if (nextOffset === targetOffset && nextCheckpoint !== query.cursor) {
          throw new Error("MCP search continuation cursor is stale.");
        }
        if (consumed === targetOffset) {
          return {
            results,
            total,
            ...(nextCheckpoint !== undefined ? { nextCursor: nextCheckpoint } : {}),
          };
        }
        if (!hasMore || nextCursor === undefined) {
          throw new Error("MCP search continuation ended before the requested page.");
        }
        consumed = nextOffset;
        if (consumed > targetOffset) {
          throw new Error("MCP search continuation offset does not match a page boundary.");
        }
        remoteCursor = nextCursor;
      }

      throw new Error("MCP search exceeds its bounded cursor replay limit.");
    } finally {
      if (sessionId) {
        const cleanupController = new AbortController();
        const cleanupTimeout = setTimeout(
          () => cleanupController.abort(),
          MCP_SESSION_CLEANUP_TIMEOUT_MS,
        );
        try {
          await fetch(endpoint, {
            method: "DELETE",
            headers: {
              ...baseHeaders,
              "mcp-protocol-version": protocolVersion,
              "mcp-session-id": sessionId,
            },
            signal: cleanupController.signal,
          });
        } catch {
          // Session cleanup is best-effort and must not replace the search result or error.
        } finally {
          clearTimeout(cleanupTimeout);
        }
      }
    }
  }

  return {
    name: "mcp",
    async search(query, context) {
      return (await runMcpSearch(query, context, false)) as DocsSearchResult[];
    },
    async searchPage(query, context) {
      return (await runMcpSearch(query, context, true)) as DocsSearchAdapterPage;
    },
  };
}

function getAlgoliaSearchBase(config: AlgoliaDocsSearchConfig): string {
  return `https://${config.appId}-dsn.algolia.net`;
}

function getAlgoliaAdminBase(config: AlgoliaDocsSearchConfig): string {
  return `https://${config.appId}.algolia.net`;
}

function getAlgoliaAdminHeaders(config: AlgoliaDocsSearchConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Algolia-Application-Id": config.appId,
    "X-Algolia-API-Key": config.adminApiKey ?? config.searchApiKey,
  };
}

async function waitForAlgoliaTask(
  config: AlgoliaDocsSearchConfig,
  taskId: string | number,
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (let attempt = 0; Date.now() < deadline; attempt += 1) {
    const response = await fetch(
      `${getAlgoliaAdminBase(config)}/1/indexes/${encodeURIComponent(config.indexName)}/task/${encodeURIComponent(String(taskId))}`,
      {
        headers: getAlgoliaAdminHeaders(config),
        signal,
      },
    );
    ensureOk(response, "Failed to inspect Algolia sync task");
    const payload = (await readResponseJson(response)) as { status?: unknown } | null;
    if (payload?.status === "published") return;
    if (payload?.status !== "notPublished") {
      throw new Error("Algolia sync task returned an unknown status.");
    }
    const delay = Math.min(100 * 2 ** Math.min(attempt, 4), 2_000);
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason ?? new Error("Algolia sync was aborted."));
      };
      timer = setTimeout(
        () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
        Math.min(delay, Math.max(1, deadline - Date.now())),
      );
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  throw new Error("Timed out waiting for Algolia to publish the synced index.");
}

interface AlgoliaBatchRequest {
  action: "addObject";
  body: Record<string, unknown>;
}

async function executeAlgoliaBatch(
  config: AlgoliaDocsSearchConfig,
  requests: readonly AlgoliaBatchRequest[],
  message: string,
  signal?: AbortSignal,
): Promise<void> {
  for (let offset = 0; offset < requests.length; offset += ALGOLIA_BATCH_OPERATIONS) {
    const batch = requests.slice(offset, offset + ALGOLIA_BATCH_OPERATIONS);
    const response = await fetch(
      `${getAlgoliaAdminBase(config)}/1/indexes/${encodeURIComponent(config.indexName)}/batch`,
      {
        method: "POST",
        headers: getAlgoliaAdminHeaders(config),
        body: JSON.stringify({ requests: batch }),
        signal,
      },
    );
    ensureOk(response, message);
    const payload = (await readResponseJson(response)) as { taskID?: unknown } | null;
    if (typeof payload?.taskID !== "string" && typeof payload?.taskID !== "number") {
      throw new Error("Algolia sync response did not include a task ID.");
    }
    await waitForAlgoliaTask(config, payload.taskID, signal);
  }
}

function quoteAlgoliaFilterValue(value: string): string {
  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

export function createAlgoliaSearchAdapter(config: AlgoliaDocsSearchConfig): DocsSearchAdapter {
  const adapter: DocsSearchAdapter = {
    name: "algolia",
    async index(context) {
      if (!config.adminApiKey) return;
      const corpusId = resolveHostedHumanCorpusId(config.syncNamespace, context);
      const documents = await enrichDocsSearchDocumentsWithSources({
        documents: context.documents,
        pages: context.pages,
        audience: resolveDocsSearchAudience(context.audience),
        chunking: context.chunking ?? { strategy: "section" },
        locale: context.locale,
        baseUrl: context.baseUrl,
        indexGeneration: context.indexGeneration,
      });
      const requests = documents.map((document) => ({
        action: "addObject" as const,
        body: buildAlgoliaRecord(document, corpusId),
      }));
      await executeAlgoliaBatch(
        config,
        requests,
        "Failed to sync documents to Algolia",
        context.signal,
      );
    },
    async search(query, context) {
      return (
        await adapter.searchPage!(
          {
            ...query,
            offset: 0,
            [DOCS_UNPAGINATED_PROVIDER_QUERY]: true,
          } as InternalDocsSearchQuery,
          context,
        )
      ).results;
    },
    async searchPage(query, context) {
      const exactPagination = !(query as InternalDocsSearchQuery)[DOCS_UNPAGINATED_PROVIDER_QUERY];
      const corpusId = resolveHostedHumanCorpusId(config.syncNamespace, context);
      const scopedDocumentIds = resolveProviderScopeDocumentIds(query, context, corpusId);
      if (scopedDocumentIds === DOCS_PROVIDER_SCOPE_FILTER_OVERFLOW) {
        throw new Error("Algolia scope filters exceed the provider pagination limit.");
      }
      if (scopedDocumentIds?.length === 0) {
        return { results: [], total: 0 };
      }
      const scopedIdsFilter = scopedDocumentIds
        ?.map((id) => `objectID:${quoteAlgoliaFilterValue(id)}`)
        .join(" OR ");
      const filterClauses = [
        corpusId ? `_tags:${quoteAlgoliaFilterValue(corpusId)}` : undefined,
        context.indexGeneration
          ? `_tags:${quoteAlgoliaFilterValue(getHostedIndexGenerationTag(context.indexGeneration))}`
          : undefined,
        scopedIdsFilter
          ? corpusId || context.indexGeneration
            ? `(${scopedIdsFilter})`
            : scopedIdsFilter
          : undefined,
      ].filter((value): value is string => Boolean(value));
      const filters = filterClauses.length > 0 ? filterClauses.join(" AND ") : undefined;
      if (filters && filters.length > MAX_PROVIDER_SCOPE_FILTER_CHARS) {
        throw new Error("Algolia scope filters exceed the provider pagination limit.");
      }

      const pageSize = query.limit ?? config.maxResults ?? DEFAULT_SEARCH_LIMIT;
      if ((query.offset ?? 0) % pageSize !== 0) {
        throw new Error("Algolia search offset does not match its page boundary.");
      }
      const response = await fetch(
        `${getAlgoliaSearchBase(config)}/1/indexes/${encodeURIComponent(config.indexName)}/query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Algolia-Application-Id": config.appId,
            "X-Algolia-API-Key": config.searchApiKey,
          },
          body: JSON.stringify({
            query: query.query,
            hitsPerPage: pageSize,
            page: Math.floor((query.offset ?? 0) / pageSize),
            restrictSearchableAttributes: ["title", "section", "content", "description"],
            attributesToSnippet: ["content:20"],
            ...(filters ? { filters } : {}),
          }),
          signal: context.signal,
        },
      );

      ensureOk(response, "Algolia search failed");
      const payload = (await readResponseJson(response)) as {
        nbHits?: number;
        nbPages?: number;
        exhaustiveNbHits?: boolean;
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

      const results = (payload.hits ?? []).flatMap((hit): DocsSearchResult[] => {
        if (!hostedRecordMatchesCorpus(hit, corpusId)) return [];
        const title = typeof hit.title === "string" ? hit.title : "Untitled result";
        const section = typeof hit.section === "string" ? hit.section : undefined;
        const source = readHostedRetrievalSource(hit);
        if (hasHostedRetrievalSource(hit) && !source) return [];
        return [
          {
            id: readHostedSourceDocumentId(hit) ?? hit.objectID ?? String(hit.url ?? title),
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
            ...(source ? { source } : {}),
          } satisfies DocsSearchResult,
        ];
      });
      const exactTotal =
        typeof payload.nbHits === "number" &&
        Number.isSafeInteger(payload.nbHits) &&
        payload.nbHits >= 0
          ? payload.nbHits
          : undefined;
      const exactPageCount =
        typeof payload.nbPages === "number" &&
        Number.isSafeInteger(payload.nbPages) &&
        payload.nbPages >= 0
          ? payload.nbPages
          : undefined;
      if (exactPagination && (exactTotal === undefined || exactPageCount === undefined)) {
        throw new Error("Algolia search did not return exact reachable pagination metadata.");
      }
      const total = exactTotal ?? results.length;
      if (exactPagination && total > MAX_HOSTED_PROVIDER_CURSOR_RESULTS) {
        throw new Error("Algolia search exceeds the exact cursor pagination window.");
      }
      if (exactPagination && payload.exhaustiveNbHits === false) {
        throw new Error("Algolia search returned an approximate result total.");
      }
      if (exactPagination && exactPageCount !== undefined && total > exactPageCount * pageSize) {
        throw new Error("Algolia search total exceeds its reachable pagination window.");
      }
      if (
        exactPagination &&
        (query.offset ?? 0) + results.length < total &&
        results.length !== pageSize
      ) {
        throw new Error("Algolia search returned an incomplete non-final page.");
      }
      return { results, total };
    },
  };
  return adapter;
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
    const corpusId = resolveHostedHumanCorpusId(raw.syncNamespace, context) ?? "__unowned__";
    return `algolia:${raw.appId}:${raw.indexName}:${corpusId}:${context.locale ?? "__default__"}`;
  }

  if (search.provider === "typesense" && raw?.provider === "typesense") {
    const corpusId = resolveHostedHumanCorpusId(raw.syncNamespace, context) ?? "__unowned__";
    return `typesense:${raw.baseUrl}:${raw.collection}:${corpusId}:${context.locale ?? "__default__"}`;
  }

  if (search.provider === "mcp" && raw?.provider === "mcp") {
    return `mcp:${raw.endpoint}:${context.locale ?? "__default__"}`;
  }

  return `${search.provider}:${context.locale ?? "__default__"}`;
}

function getSearchSyncFingerprint(
  search: ResolvedDocsSearchConfig,
  context: DocsSearchAdapterContext,
  indexGeneration: string,
): string {
  const raw = search.raw;
  const providerConfig =
    search.provider === "typesense" && raw?.provider === "typesense"
      ? {
          syncNamespace: raw.syncNamespace?.trim() || undefined,
          mode: raw.mode ?? "keyword",
          embeddings: raw.embeddings
            ? {
                provider: raw.embeddings.provider,
                model: raw.embeddings.model,
                baseUrl: raw.embeddings.baseUrl,
              }
            : undefined,
        }
      : search.provider === "algolia" && raw?.provider === "algolia"
        ? {
            syncNamespace: raw.syncNamespace?.trim() || undefined,
          }
        : undefined;

  return hashDocsRetrievalValue(
    JSON.stringify({
      format: "docs-search-sync.v1",
      indexGeneration,
      canonicalBaseUrl: context.baseUrl,
      provider: search.provider,
      providerConfig,
    }),
  );
}

async function maybeSyncSearchIndex(
  adapter: DocsSearchAdapter,
  search: ResolvedDocsSearchConfig,
  context: DocsSearchAdapterContext,
) {
  if (!shouldSyncOnSearch(search) || typeof adapter.index !== "function") return;

  const syncKey = getSyncKey(search, context);
  const indexGeneration =
    context.indexGeneration ??
    (await buildDocsSearchIndexGeneration(context.pages, {
      audience: resolveDocsSearchAudience(context.audience),
      chunking: context.chunking ?? search.chunking,
      locale: context.locale,
      baseUrl: context.baseUrl,
    }));
  context.indexGeneration = indexGeneration;
  const syncFingerprint = getSearchSyncFingerprint(search, context, indexGeneration);
  while (true) {
    const inFlight = syncingIndexes.get(syncKey);
    if (inFlight) {
      try {
        await inFlight.promise;
      } catch (error) {
        if (inFlight.fingerprint === syncFingerprint) throw error;
      }
      continue;
    }
    if (syncedIndexes.get(syncKey) === syncFingerprint) return;

    const sync = adapter.index(context).then(() => {
      syncedIndexes.set(syncKey, syncFingerprint);
    });
    syncingIndexes.set(syncKey, { fingerprint: syncFingerprint, promise: sync });
    try {
      await sync;
    } finally {
      if (syncingIndexes.get(syncKey)?.promise === sync) {
        syncingIndexes.delete(syncKey);
      }
    }
  }
}

export interface PerformDocsSearchOptions {
  pages: DocsSearchSourcePage[];
  /** @internal Complete corpus used for generation when `pages` is pre-scoped by a caller. */
  generationPages?: DocsSearchSourcePage[];
  /** @internal Precomputed complete-corpus generation for structured callers. */
  indexGeneration?: string;
  query: string;
  search?: boolean | DocsSearchConfig;
  /** Selects which audience projection is searchable. Public site search defaults to human. */
  audience?: DocsContentAudience;
  locale?: string;
  pathname?: string;
  siteTitle?: string;
  /** Canonical docs URL used to distinguish same-site absolute hits from foreign MCP results. */
  baseUrl?: string;
  /**
   * Canonical origin safe to persist in a hosted index. Pass `null` when `baseUrl`
   * came from the current request rather than trusted configuration.
   * @internal
   */
  syncBaseUrl?: string | null;
  limit?: number;
  /** Opaque continuation cursor used by structured search responses. */
  cursor?: string;
  /** Optional framework, version, package, and tag constraints. */
  filters?: DocsSearchFilterInput;
  /**
   * Controls provider failures. Runtime search keeps the resilient `fallback` default;
   * diagnostics can request `throw` so a broken configured provider cannot be scored as
   * successful simple search.
   */
  failureMode?: "fallback" | "throw";
  /**
   * Whether non-simple provider hits are supplemented with exact/local simple results.
   * Runtime search defaults to true; provider diagnostics can disable supplementation.
   */
  supplementExternalResults?: boolean;
  /** Keep absolute provider origins distinct when no canonical docs origin is available. */
  strictExternalOrigins?: boolean;
  /** Optional cancellation signal forwarded to adapters and their managed requests. */
  signal?: AbortSignal;
}

interface PerformDocsSearchInternalOptions extends PerformDocsSearchOptions {
  offset?: number;
  paginated?: boolean;
  providerCursor?: string;
  paginationMode?: DocsSearchPaginationMode;
  expectedTotal?: number;
}

type DocsSearchPaginationMode = "local" | "provider";

interface DocsSearchInternalPage extends DocsSearchAdapterPage {
  paginationMode: DocsSearchPaginationMode;
}

function normalizeDocsSearchAdapterPage(
  value: DocsSearchResult[] | DocsSearchAdapterPage,
): DocsSearchAdapterPage {
  if (Array.isArray(value)) {
    return { results: value, total: value.length };
  }
  if (
    !value ||
    !Array.isArray(value.results) ||
    !Number.isSafeInteger(value.total) ||
    value.total < 0 ||
    value.results.length > value.total ||
    (value.nextCursor !== undefined &&
      (typeof value.nextCursor !== "string" ||
        value.nextCursor.length === 0 ||
        JSON.stringify([1, "provider", value.total, value.nextCursor]).length >
          MAX_SEARCH_PROVIDER_CURSOR_STATE_CHARS))
  ) {
    throw new Error("Search adapter returned invalid pagination metadata.");
  }
  return value;
}

async function performDocsSearchInternal(
  options: PerformDocsSearchInternalOptions,
): Promise<DocsSearchInternalPage> {
  const search = normalizeDocsSearchConfig(options.search);
  if (!search.enabled) {
    if (
      options.paginationMode === "provider" ||
      (options.expectedTotal !== undefined && options.expectedTotal !== 0)
    ) {
      throw new DocsPaginationCursorError();
    }
    return { results: [], total: 0, paginationMode: "local" };
  }

  const audience = resolveDocsSearchAudience(options.audience);
  const filters = normalizeDocsSearchFilters(options.filters);
  const hasFilters = hasDocsSearchFilters(filters);
  const corpusPages = options.pages.map((page) => localizeDocsSearchPage(page, options.locale));
  const indexBaseUrl =
    options.syncBaseUrl === null ? undefined : (options.syncBaseUrl ?? options.baseUrl);
  const scopedPages = hasFilters
    ? corpusPages.filter((page) =>
        docsSearchPageMatchesFilters(resolveDocsSearchPageScope(page), filters),
      )
    : corpusPages;
  let resolvedDocuments: DocsSearchDocument[] | undefined;
  const getDocuments = (): DocsSearchDocument[] => {
    if (!resolvedDocuments) {
      resolvedDocuments = buildDocsSearchDocuments(scopedPages, search.chunking, audience);
    }
    return resolvedDocuments;
  };
  const context: DocsSearchAdapterContext = {
    pages: scopedPages,
    // Keep document construction lazy so remote providers can begin I/O before the local
    // audience projection is materialized. Adapters retain the existing array contract.
    get documents() {
      return getDocuments();
    },
    set documents(documents) {
      resolvedDocuments = documents;
    },
    audience,
    locale: options.locale,
    pathname: options.pathname,
    siteTitle: options.siteTitle,
    baseUrl: options.baseUrl,
    indexBaseUrl,
    chunking: search.chunking,
    deferSourceProvenance: true,
    signal: options.signal,
  };

  const query: DocsSearchQuery = {
    query: options.query,
    limit: options.limit ?? search.maxResults,
    ...(options.paginated ? { offset: options.offset ?? 0 } : {}),
    ...(options.providerCursor !== undefined ? { cursor: options.providerCursor } : {}),
    locale: options.locale,
    pathname: options.pathname,
    audience,
    ...(hasFilters ? { filters } : {}),
  };
  let currentIndexGeneration: Promise<string> | undefined;
  const getCurrentIndexGeneration = () => {
    currentIndexGeneration ??= options.indexGeneration
      ? Promise.resolve(options.indexGeneration)
      : buildDocsSearchIndexGeneration(options.generationPages ?? options.pages, {
          audience,
          chunking: search.chunking,
          locale: options.locale,
          baseUrl: options.baseUrl,
        });
    return currentIndexGeneration;
  };
  const requireCurrentIndexGeneration =
    search.provider === "algolia" || search.provider === "typesense";
  let hostedIndexGeneration: Promise<string> | undefined;
  const getHostedIndexGeneration = () => {
    hostedIndexGeneration ??=
      audience === "human"
        ? getCurrentIndexGeneration()
        : buildDocsSearchIndexGeneration(options.generationPages ?? options.pages, {
            audience: "human",
            chunking: search.chunking,
            locale: options.locale,
            baseUrl: indexBaseUrl,
          });
    return hostedIndexGeneration;
  };
  const finalizeResults = async (results: readonly DocsSearchResult[]) =>
    enrichDocsSearchResultsWithSources({
      results,
      pages: scopedPages,
      generationPages: options.generationPages ?? options.pages,
      audience,
      chunking: search.chunking,
      locale: options.locale,
      baseUrl: options.baseUrl,
      indexGeneration: options.indexGeneration,
      strictExternalOrigins: options.strictExternalOrigins,
      filters,
      requireCurrentIndexGeneration,
    });
  const createLocalPage = async (): Promise<DocsSearchInternalPage> => {
    const fallback = options.paginated
      ? await createSimpleSearchAdapter().searchPage!(query, context)
      : normalizeDocsSearchAdapterPage(await createSimpleSearchAdapter().search(query, context));
    if (options.expectedTotal !== undefined && fallback.total !== options.expectedTotal) {
      throw new DocsPaginationCursorError();
    }
    return {
      results: await finalizeResults(fallback.results),
      total: options.paginated ? fallback.total : fallback.results.length,
      paginationMode: "local",
    };
  };
  const fallBackFromProvider = (): Promise<DocsSearchInternalPage> => {
    if (options.paginationMode === "provider") {
      throw new DocsPaginationCursorError();
    }
    return createLocalPage();
  };

  if (options.paginated && options.paginationMode === "local") {
    return createLocalPage();
  }

  try {
    const adapter = await resolveSearchAdapter(search, context);
    if (shouldSyncOnSearch(search) && typeof adapter.index === "function") {
      const syncPages = audience === "agent" || hasFilters ? corpusPages : scopedPages;
      const syncContext: DocsSearchAdapterContext = {
        pages: syncPages,
        documents: buildDocsSearchDocuments(syncPages, search.chunking, "human"),
        audience: "human",
        locale: options.locale,
        pathname: options.pathname,
        siteTitle: options.siteTitle,
        baseUrl: indexBaseUrl,
        indexBaseUrl,
        ...(options.paginated && requireCurrentIndexGeneration
          ? { indexGeneration: await getHostedIndexGeneration() }
          : {}),
        chunking: search.chunking,
        signal: options.signal,
      };
      await maybeSyncSearchIndex(adapter, search, syncContext);
    }

    if (options.paginated && requireCurrentIndexGeneration) {
      context.indexGeneration = await getHostedIndexGeneration();
    }

    if (
      options.paginated &&
      search.provider === "custom" &&
      (!adapter.searchPage ||
        search.raw?.provider !== "custom" ||
        !search.raw.paginationRevision?.trim())
    ) {
      if (options.paginationMode === "provider") {
        throw new DocsPaginationCursorError();
      }
      return createLocalPage();
    }

    // Async adapters execute through their first await immediately, which starts remote
    // provider work before the CPU-heavy local projection below. Filtered providers that
    // require local document IDs still materialize the getter synchronously as before.
    const adapterSearch =
      options.paginated && adapter.searchPage
        ? adapter.searchPage(query, context)
        : adapter.search(query, context);
    let documents: DocsSearchDocument[];
    try {
      documents = getDocuments();
    } catch (error) {
      // The provider may still be in flight. Observe a later rejection before falling
      // through to the configured local-fallback/error path.
      void adapterSearch.catch(() => undefined);
      throw error;
    }
    const rawAdapterResult = await adapterSearch;
    const adapterPage =
      options.paginated && !adapter.searchPage && Array.isArray(rawAdapterResult)
        ? {
            results: rawAdapterResult.slice(
              options.offset ?? 0,
              (options.offset ?? 0) + (query.limit ?? search.maxResults),
            ),
            total: rawAdapterResult.length,
          }
        : normalizeDocsSearchAdapterPage(rawAdapterResult);
    const results = adapterPage.results;
    if (search.provider === "simple") {
      if (options.expectedTotal !== undefined && adapterPage.total !== options.expectedTotal) {
        throw new DocsPaginationCursorError();
      }
      return {
        results: await finalizeResults(results),
        total: options.paginated ? adapterPage.total : results.length,
        paginationMode: "local",
      };
    }

    const localAudienceProjectionResults = buildAudienceProjectionSearchResults(
      documents,
      options.query,
    );
    const localPagePaths = new Set(scopedPages.map((page) => normalizeUrlRouteKey(page.url)));
    const allLocalPagePaths =
      hasFilters && search.provider === "mcp"
        ? new Set(options.pages.map((page) => normalizeUrlRouteKey(page.url)))
        : localPagePaths;
    // External indexes can be stale or built for a different audience. Replace
    // every local-page hit with the selected local projection before returning it.
    // Human search preserves provider-only pages for backwards compatibility;
    // MCP can preserve remote-corpus hits after its adapter verifies the echoed
    // normalized filters. Known local pages still have to survive local scoping.
    const preserveUnmatched =
      (!hasFilters && audience === "human") || search.provider === "mcp"
        ? (result: DocsSearchResult) =>
            shouldPreserveUnmatchedExternalResult({
              result,
              localPagePaths: allLocalPagePaths,
              baseUrl: options.baseUrl,
            })
        : undefined;
    const isKnownLocalProviderResult = (result: DocsSearchResult) =>
      isLocalProviderResult(result, options.baseUrl) &&
      localPagePaths.has(normalizeUrlRouteKey(result.url));
    const expectedProviderGeneration = requireCurrentIndexGeneration
      ? await getHostedIndexGeneration()
      : undefined;
    const providerAudience: DocsContentAudience = requireCurrentIndexGeneration
      ? "human"
      : audience;
    // Validate provenance before replacing a hosted hit with the local projection.
    // Otherwise a stale hit could inherit a fresh digest and generation after ranking.
    const provenanceSafeProviderResults = results.filter((result) => {
      if (result.source === undefined) {
        return !requireCurrentIndexGeneration || isKnownLocalProviderResult(result);
      }
      const source = parseDocsRetrievalSource(result.source, {
        allowRootRelativeCanonical:
          requireCurrentIndexGeneration || isKnownLocalProviderResult(result),
      });
      const knownLocal = isKnownLocalProviderResult(result);
      return Boolean(
        source &&
        docsRetrievalSourceMatchesRequest(
          source,
          providerAudience,
          knownLocal ? undefined : filters,
          options.locale,
        ) &&
        (!expectedProviderGeneration || source.indexGeneration === expectedProviderGeneration),
      );
    });
    // Provider ranking may be semantic, so lexical query overlap is not required.
    // Fail closed only when a local snippet contains distinctive evidence from
    // the opposite projection and none from the selected one.
    const audienceSafeAdapterResults = provenanceSafeProviderResults.filter(
      (result) =>
        (requireCurrentIndexGeneration && isKnownLocalProviderResult(result)) ||
        !hasOppositeAudienceEvidence({
          result,
          pages: scopedPages,
          query: options.query,
          audience,
          baseUrl: options.baseUrl,
        }),
    );
    const safeAdapterResults = sanitizeExternalAudienceSearchResults(
      audienceSafeAdapterResults,
      localAudienceProjectionResults,
      options.baseUrl,
      preserveUnmatched,
      requireCurrentIndexGeneration && audience === "agent",
    );

    if (options.paginated) {
      // Pagination totals must describe the exact safe result set. If a hosted or remote
      // page fails provenance/audience validation, fall back to the complete local index
      // instead of claiming the provider's larger raw total.
      const offset = query.offset ?? 0;
      const endOffset = offset + safeAdapterResults.length;
      if (
        safeAdapterResults.length !== results.length ||
        safeAdapterResults.length > (query.limit ?? search.maxResults) ||
        endOffset > adapterPage.total ||
        (requireCurrentIndexGeneration &&
          adapterPage.total === 0 &&
          localAudienceProjectionResults.length > 0) ||
        (endOffset < adapterPage.total && safeAdapterResults.length === 0) ||
        (adapterPage.nextCursor !== undefined &&
          options.providerCursor !== undefined &&
          adapterPage.nextCursor === options.providerCursor) ||
        (adapterPage.nextCursor !== undefined && endOffset >= adapterPage.total) ||
        (options.expectedTotal !== undefined && adapterPage.total !== options.expectedTotal)
      ) {
        return fallBackFromProvider();
      }
      return {
        results: await finalizeResults(safeAdapterResults),
        total: adapterPage.total,
        ...(adapterPage.nextCursor !== undefined ? { nextCursor: adapterPage.nextCursor } : {}),
        paginationMode: "provider",
      };
    }

    if (options.supplementExternalResults === false) {
      const bounded = safeAdapterResults.slice(
        0,
        query.limit ?? search.maxResults ?? DEFAULT_SEARCH_LIMIT,
      );
      return {
        results: await finalizeResults(bounded),
        total: bounded.length,
        paginationMode: "provider",
      };
    }
    const shouldSupplementWithLocalSearch =
      audience === "agent" || results.length === 0 || safeAdapterResults.length < results.length;
    const simpleAudienceResults = shouldSupplementWithLocalSearch
      ? await createSimpleSearchAdapter().search(query, context)
      : [];
    const combinedResults = mergeSearchResults(
      [
        buildExactPageSearchResults(options.query, scopedPages, audience),
        safeAdapterResults,
        simpleAudienceResults,
      ],
      audience === "agent"
        ? (result) => getAskAIResultKey(result, options.baseUrl, options.strictExternalOrigins)
        : undefined,
    );
    const bounded = prioritizeLiteralInsideResults(options.query, combinedResults).slice(
      0,
      query.limit ?? search.maxResults ?? DEFAULT_SEARCH_LIMIT,
    );
    return {
      results: await finalizeResults(bounded),
      total: bounded.length,
      paginationMode: "provider",
    };
  } catch (error) {
    if (error instanceof DocsPaginationCursorError) throw error;
    if (options.failureMode === "throw") throw error;
    return fallBackFromProvider();
  }
}

export async function performDocsSearch(
  options: PerformDocsSearchOptions,
): Promise<DocsSearchResult[]> {
  return (await performDocsSearchInternal(options)).results;
}

function compareSearchMetadataValues(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export interface BuildDocsSearchFacetsOptions {
  pages: DocsSearchSourcePage[];
  search?: boolean | DocsSearchConfig;
  audience?: DocsContentAudience;
  locale?: string;
  baseUrl?: string;
  filters?: DocsSearchFilterInput;
  /** Facet field selected for cursor continuation. */
  facet?: DocsSearchFilterField;
  /** Opaque `nextCursor` returned for the selected facet. */
  cursor?: string;
  /** Maximum facet values returned per page. Defaults to 100. */
  limit?: number;
  /** @internal Precomputed complete-corpus generation for composed callers. */
  indexGeneration?: string;
}

function docsSearchPageMatchesFacetFilters(
  scope: ResolvedDocsSearchPageScope,
  filters: DocsSearchFilters,
  omittedField?: DocsSearchFilterField,
): boolean {
  if (scope.conflicts.length > 0) return false;
  return SEARCH_FILTER_FIELDS.every((field) => {
    if (field === omittedField) return true;
    const requested = filters[field];
    return !requested?.length || docsSearchScopeFieldMatches(scope, field, requested);
  });
}

function buildDocsSearchFacet(
  pages: readonly { scope: ResolvedDocsSearchPageScope }[],
  field: DocsSearchFilterField,
  filters: DocsSearchFilters,
  options: {
    audience: DocsContentAudience;
    cursor?: string;
    indexGeneration: string;
    limit: number;
    locale?: string;
  },
): DocsSearchFacet {
  const counts = new Map<string, number>();

  for (const { scope } of pages) {
    if (!docsSearchPageMatchesFacetFilters(scope, filters, field)) continue;
    for (const value of new Set(scope[field])) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const values = [...counts]
    .sort(([left], [right]) => compareSearchMetadataValues(left, right))
    .map(([value, count]) => ({ value, count }));
  const normalizedFilters = Object.fromEntries(
    SEARCH_FILTER_FIELDS.flatMap((filterField) => {
      const filterValues = filters[filterField];
      return filterValues?.length
        ? [[filterField, [...filterValues].sort(compareSearchMetadataValues)]]
        : [];
    }),
  );
  const page = paginateDocsItems(values, {
    kind: "docs-search-facet",
    scope: JSON.stringify({
      format: "docs-search-facet-pagination.v1",
      field,
      audience: options.audience,
      filters: normalizedFilters,
      locale: options.locale ? normalizeAgentLocale(options.locale) : undefined,
    }),
    snapshot: options.indexGeneration,
    cursor: options.cursor,
    pageSize: options.limit,
  });

  return {
    valueCount: page.total,
    total: page.total,
    hasMore: page.hasMore,
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    truncated: page.items.length < page.total,
    values: page.items,
  };
}

/**
 * Build a body-free index of valid search filter values and page counts.
 *
 * Each facet applies filters from the other fields while ignoring its own selected
 * values. This is the conventional faceted-search behavior and lets an agent discover
 * safe alternatives without guessing or fetching document bodies.
 */
export async function buildDocsSearchFacets(
  options: BuildDocsSearchFacetsOptions,
): Promise<DocsSearchFacetsResponse> {
  const audience = resolveDocsSearchAudience(options.audience);
  const filters = normalizeDocsSearchFilters(options.filters);
  const search = normalizeDocsSearchConfig(options.search);
  const requestedLimit = options.limit ?? MAX_SEARCH_FACET_VALUES;
  if (
    !Number.isSafeInteger(requestedLimit) ||
    requestedLimit < 1 ||
    requestedLimit > MAX_SEARCH_FACET_VALUES
  ) {
    throw new DocsSearchRequestError("Search limit must be an integer between 1 and 100.");
  }
  if (options.cursor !== undefined && options.facet === undefined) {
    throw new DocsSearchRequestError("Facet continuation cursors require a `facet` field.");
  }
  const pages = options.pages
    .map((page) => localizeDocsSearchPage(page, options.locale))
    .map((page) => ({ scope: resolveDocsSearchPageScope(page) }));
  const indexGeneration =
    options.indexGeneration ??
    (await buildDocsSearchIndexGeneration(options.pages, {
      audience,
      chunking: search.chunking,
      locale: options.locale,
      baseUrl: options.baseUrl,
    }));

  return {
    format: "docs-search-facets.v1",
    audience,
    filters,
    indexGeneration,
    matchedPageCount: pages.filter(({ scope }) => docsSearchPageMatchesFacetFilters(scope, filters))
      .length,
    facets: Object.fromEntries(
      SEARCH_FILTER_FIELDS.map((field) => [
        field,
        buildDocsSearchFacet(pages, field, filters, {
          audience,
          cursor: field === options.facet ? options.cursor : undefined,
          indexGeneration,
          limit:
            options.facet === undefined || field === options.facet
              ? requestedLimit
              : MAX_SEARCH_FACET_VALUES,
          locale: options.locale,
        }),
      ]),
    ) as Record<DocsSearchFilterField, DocsSearchFacet>,
  };
}

function boundedSearchWarningValues(values: readonly string[]): string[] | undefined {
  const bounded = Array.from(new Set(values))
    .sort(compareSearchMetadataValues)
    .slice(0, MAX_SEARCH_WARNING_VALUES);
  return bounded.length > 0 ? bounded : undefined;
}

function boundedSearchWarningPageUrls(
  pages: readonly DocsSearchSourcePage[],
): string[] | undefined {
  const bounded = Array.from(new Set(pages.map((page) => page.url)))
    .sort(compareSearchMetadataValues)
    .slice(0, MAX_SEARCH_WARNING_PAGE_URLS);
  return bounded.length > 0 ? bounded : undefined;
}

function findSearchResultPages(
  pages: readonly DocsSearchSourcePage[],
  results: readonly DocsSearchResult[],
  baseUrl?: string,
): DocsSearchSourcePage[] {
  const pagesByPath = new Map(pages.map((page) => [normalizeUrlRouteKey(page.url), page] as const));
  const found = new Map<string, DocsSearchSourcePage>();

  for (const result of results) {
    if (!isLocalProviderResult(result, baseUrl)) continue;
    const page = pagesByPath.get(normalizeUrlRouteKey(result.url));
    if (page) found.set(page.url, page);
  }

  return [...found.values()].sort((left, right) =>
    compareSearchMetadataValues(left.url, right.url),
  );
}

function searchScopeIsAmbiguous(
  field: (typeof SEARCH_AMBIGUITY_FIELDS)[number],
  values: readonly string[],
): boolean {
  if (values.length < 2) return false;
  if (field !== "version") return true;

  return values.some((left, index) =>
    values.slice(index + 1).some((right) => !agentVersionConstraintsOverlap(left, right)),
  );
}

function buildDocsSearchWarnings(options: {
  pages: readonly DocsSearchSourcePage[];
  results: readonly DocsSearchResult[];
  filters: DocsSearchFilters;
  query: string;
  audience: DocsContentAudience;
  baseUrl?: string;
  completeResultSet?: boolean;
}): DocsSearchWarning[] {
  const pageScopes = options.pages.map((page) => ({
    page,
    scope: resolveDocsSearchPageScope(page),
  }));
  const relevantPageScopes = pageScopes.filter(
    ({ page }) => scoreDocument(options.query, pageToSearchDocument(page, options.audience)) > 0,
  );
  const warnings: DocsSearchWarning[] = [];

  for (const field of SEARCH_FILTER_FIELDS) {
    const conflicting = relevantPageScopes.filter(({ scope }) => scope.conflicts.includes(field));
    if (conflicting.length > 0) {
      warnings.push({
        code: "conflicting_scope_metadata",
        field,
        message: `${conflicting.length} page${conflicting.length === 1 ? "" : "s"} declare conflicting ${field} metadata and cannot be selected safely by scoped search.`,
        pageUrls: boundedSearchWarningPageUrls(conflicting.map(({ page }) => page)),
        count: conflicting.length,
      });
    }

    const requested = options.filters[field];
    if (!requested || requested.length === 0) continue;

    const missing = relevantPageScopes.filter(
      ({ scope }) => scope.declarations[field].length === 0,
    );
    if (missing.length > 0) {
      warnings.push({
        code: "missing_scope_metadata",
        field,
        message: `${missing.length} page${missing.length === 1 ? "" : "s"} lack ${field} metadata and were excluded by the strict scope filter.`,
        pageUrls: boundedSearchWarningPageUrls(missing.map(({ page }) => page)),
        count: missing.length,
      });
    }

    const unknown = requested.filter(
      (value) =>
        !pageScopes.some(
          ({ scope }) =>
            !scope.conflicts.includes(field) && docsSearchScopeFieldMatches(scope, field, [value]),
        ),
    );
    if (unknown.length > 0) {
      warnings.push({
        code: "unknown_filter_value",
        field,
        message: `No page metadata matches ${field} filter value${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`,
        values: boundedSearchWarningValues(unknown),
        count: unknown.length,
      });
    }
  }

  const resultPages = options.completeResultSet
    ? relevantPageScopes
        .filter(({ scope }) => docsSearchPageMatchesFilters(scope, options.filters))
        .map(({ page }) => page)
        .sort((left, right) => compareSearchMetadataValues(left.url, right.url))
    : findSearchResultPages(options.pages, options.results, options.baseUrl);
  for (const field of SEARCH_AMBIGUITY_FIELDS) {
    if ((options.filters[field]?.length ?? 0) > 0) continue;
    const values = resultPages.flatMap((page) => {
      const scope = resolveDocsSearchPageScope(page);
      return scope.conflicts.includes(field) ? [] : scope[field];
    });
    const unique = Array.from(new Set(values)).sort(compareSearchMetadataValues);
    if (!searchScopeIsAmbiguous(field, unique)) continue;
    const contributingPages = resultPages.filter((page) => {
      const scope = resolveDocsSearchPageScope(page);
      return !scope.conflicts.includes(field) && scope[field].length > 0;
    });

    warnings.push({
      code: "ambiguous_scope",
      field,
      message: `Search results span multiple ${field} scopes; add a ${field} filter before acting on scope-specific guidance.`,
      values: boundedSearchWarningValues(unique),
      pageUrls: boundedSearchWarningPageUrls(contributingPages),
      count: unique.length,
    });
  }

  const codeOrder: Record<DocsSearchWarning["code"], number> = {
    ambiguous_scope: 0,
    unknown_filter_value: 1,
    missing_scope_metadata: 2,
    conflicting_scope_metadata: 3,
  };
  return warnings
    .sort((left, right) => {
      const codeDelta = codeOrder[left.code] - codeOrder[right.code];
      if (codeDelta !== 0) return codeDelta;
      return SEARCH_FILTER_FIELDS.indexOf(left.field) - SEARCH_FILTER_FIELDS.indexOf(right.field);
    })
    .slice(0, MAX_SEARCH_WARNINGS);
}

interface DocsSearchCursorState {
  mode: DocsSearchPaginationMode;
  total: number;
  providerCursor?: string;
}

function parseDocsSearchCursorState(
  state: string | undefined,
  offset: number,
): DocsSearchCursorState | undefined {
  if (offset === 0 && state === undefined) return undefined;
  if (state === undefined) throw new DocsPaginationCursorError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(state);
  } catch {
    throw new DocsPaginationCursorError();
  }
  if (!Array.isArray(parsed) || parsed.length !== 4 || JSON.stringify(parsed) !== state) {
    throw new DocsPaginationCursorError();
  }

  const [version, mode, total, providerCursor] = parsed;
  if (
    version !== 1 ||
    (mode !== "local" && mode !== "provider") ||
    !Number.isSafeInteger(total) ||
    (total as number) < offset ||
    !(
      providerCursor === null ||
      (typeof providerCursor === "string" && providerCursor.length <= 768)
    ) ||
    (mode === "local" && providerCursor !== null)
  ) {
    throw new DocsPaginationCursorError();
  }

  return {
    mode,
    total: total as number,
    ...(typeof providerCursor === "string" ? { providerCursor } : {}),
  };
}

function createDocsSearchCursorState(page: DocsSearchInternalPage): string {
  return JSON.stringify([
    1,
    page.paginationMode,
    page.total,
    page.paginationMode === "provider" ? (page.nextCursor ?? null) : null,
  ]);
}

export async function performDocsSearchWithMetadata(
  options: PerformDocsSearchOptions,
): Promise<DocsPaginatedSearchResponse> {
  const audience = resolveDocsSearchAudience(options.audience);
  const filters = normalizeDocsSearchFilters(options.filters);
  const search = normalizeDocsSearchConfig(options.search);
  const requestedLimit = options.limit ?? search.maxResults ?? DEFAULT_SEARCH_LIMIT;
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.max(1, Math.floor(requestedLimit))
      : DEFAULT_SEARCH_LIMIT;
  const indexGeneration =
    options.indexGeneration ??
    (await buildDocsSearchIndexGeneration(options.generationPages ?? options.pages, {
      audience,
      chunking: search.chunking,
      locale: options.locale,
      baseUrl: options.baseUrl,
    }));
  const normalizedFilters = Object.fromEntries(
    SEARCH_FILTER_FIELDS.flatMap((field) => {
      const values = filters[field];
      return values?.length ? [[field, [...values].sort(compareSearchMetadataValues)]] : [];
    }),
  );
  const provider = getDocsSearchPaginationProviderIdentity(search);
  const cursorOptions = {
    kind: "docs-search",
    scope: JSON.stringify({
      format: "docs-search-pagination.v2",
      // Bind the exact value forwarded to external/custom adapters. Canonicalizing only
      // the cursor scope would let a case- or whitespace-sensitive adapter reorder pages.
      query: options.query,
      audience,
      filters: normalizedFilters,
      locale: options.locale ? normalizeAgentLocale(options.locale) : undefined,
      pathname: options.pathname?.trim() || undefined,
      provider,
      limit,
    }),
    snapshot: indexGeneration,
  };
  const cursorPosition = resolveDocsPaginationCursor(options.cursor, cursorOptions);
  const offset = cursorPosition.offset;
  const cursorState = parseDocsSearchCursorState(cursorPosition.state, offset);
  const page = options.query.trim()
    ? await performDocsSearchInternal({
        ...options,
        audience,
        filters,
        indexGeneration,
        limit,
        offset,
        paginated: true,
        providerCursor: cursorState?.providerCursor,
        paginationMode: cursorState?.mode,
        expectedTotal: cursorState?.total,
      })
    : { results: [], total: 0, paginationMode: "local" as const };
  if (
    (options.cursor !== undefined && offset >= page.total) ||
    page.results.length > Math.min(limit, Math.max(0, page.total - offset)) ||
    (offset < page.total && page.results.length === 0)
  ) {
    throw new DocsPaginationCursorError();
  }
  const nextOffset = Math.min(page.total, offset + page.results.length);
  const hasMore = nextOffset < page.total;
  const nextCursor = hasMore
    ? createDocsPaginationCursor(nextOffset, {
        ...cursorOptions,
        state: createDocsSearchCursorState(page),
      })
    : undefined;

  return {
    format: "docs-search.v1",
    query: options.query,
    audience,
    filters,
    indexGeneration,
    resultCount: page.results.length,
    total: page.total,
    hasMore,
    ...(nextCursor ? { nextCursor } : {}),
    results: page.results,
    warnings: buildDocsSearchWarnings({
      pages: options.pages,
      results: page.results,
      filters,
      query: options.query,
      audience,
      baseUrl: options.baseUrl,
      completeResultSet: true,
    }),
  };
}

export async function buildDocsAskAIContext(options: {
  pages: DocsSearchSourcePage[];
  query: string;
  search?: boolean | DocsSearchConfig;
  locale?: string;
  pathname?: string;
  siteTitle?: string;
  baseUrl?: string;
  /** See `performDocsSearch.syncBaseUrl`. */
  syncBaseUrl?: string | null;
  limit?: number;
  filters?: DocsSearchFilterInput;
  maxContextChars?: number;
  maxResultChars?: number;
  /** See `performDocsSearch.failureMode`. Defaults to resilient runtime fallback. */
  searchFailureMode?: "fallback" | "throw";
  /** See `performDocsSearch.strictExternalOrigins`. */
  strictExternalOrigins?: boolean;
  /** Optional cancellation signal forwarded to the configured search provider. */
  signal?: AbortSignal;
}): Promise<DocsAskAIContext> {
  const limit = options.limit ?? 5;
  const searchLimit = Math.max(limit * 2, limit);
  const initialSearch = options.search === false ? true : options.search;
  const initialSearchConfig = normalizeDocsSearchConfig(initialSearch);
  const primarySearch = initialSearchConfig.enabled ? initialSearch : true;
  const searchResults = await performDocsSearch({
    pages: options.pages,
    query: options.query,
    search: primarySearch,
    audience: "agent",
    locale: options.locale,
    pathname: options.pathname,
    siteTitle: options.siteTitle,
    baseUrl: options.baseUrl,
    syncBaseUrl: options.syncBaseUrl,
    limit: searchLimit,
    filters: options.filters,
    failureMode: options.searchFailureMode,
    strictExternalOrigins: options.strictExternalOrigins,
    signal: options.signal,
  });

  const seen = new Set<string>();
  const maxResultChars = options.maxResultChars ?? DEFAULT_ASK_AI_RESULT_CHARS;
  const rankedResults = searchResults
    .map((result, index) => {
      const page = findPageForSearchResult(options.pages, result, options.baseUrl);
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
      .map((result) =>
        getAskAIResultPageKey(result.url, options.baseUrl, options.strictExternalOrigins),
      ),
  );
  const results = formattedResults
    .filter(
      (result) =>
        result.section ||
        !sectionResultPaths.has(
          getAskAIResultPageKey(result.url, options.baseUrl, options.strictExternalOrigins),
        ),
    )
    .filter((result) => {
      const key = getAskAIResultKey(result, options.baseUrl, options.strictExternalOrigins);
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
    blocks: blocks.map((text, index) => ({ text, result: results[index] })),
    results: results.slice(0, blocks.length),
    searchResults: rankedResults.map((item) => item.result),
    packageHints: inferDocsAskAIPackageHints(context),
  };
}

export function createCustomSearchAdapter(
  adapter: DocsSearchAdapter | DocsSearchAdapterFactory,
  options: { paginationRevision?: string } = {},
): CustomDocsSearchConfig {
  return {
    provider: "custom",
    adapter,
    ...(options.paginationRevision ? { paginationRevision: options.paginationRevision } : {}),
  };
}

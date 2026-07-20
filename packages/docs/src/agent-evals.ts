import { createJiti } from "jiti";
import {
  agentVersionConstraintMatches,
  agentVersionConstraintsOverlap,
  normalizeAgentFramework,
  normalizeAgentLocale,
  normalizeAgentScopeValues,
  normalizeAgentVersion,
} from "./agent-scope.js";
import {
  extractCodeBlocksFromMarkdown,
  planCodeBlockTargets,
  resolveDocsCodeBlocksValidateConfig,
  validateCodeBlockPlans,
  type DocsCodeBlockExecutionPlan,
  type DocsCodeBlockTarget,
  type DocsCodeBlockValidationResult,
} from "./code-blocks.js";
import {
  buildDocsMcpContext,
  type DocsMcpContextResult,
  type DocsMcpContextSource,
  type DocsMcpPage,
} from "./mcp.js";
import { findDocsMarkdownSection } from "./markdown-sections.js";
import { buildDocsAskAIContext, performDocsSearch, resolveSearchRequestConfig } from "./search.js";
import type {
  DocsAgentEvaluationAnswerProvider,
  DocsAgentEvaluationAnswerRequest,
  DocsAgentEvaluationAnswerResult,
  DocsAgentEvaluationSurface,
  DocsAgentGoldenAnswerExpectation,
  DocsAgentGoldenExpectedExample,
  DocsAgentGoldenTask,
  DocsAgentGoldenTaskExpectation,
  DocsAgentGoldenTaskFilters,
  DocsCodeBlocksValidateConfig,
  DocsSearchConfig,
  DocsSearchResult,
} from "./types.js";

const DEFAULT_TOP_K = 5;
const DEFAULT_TOKEN_BUDGET = 4_000;
const CONTEXT_SEPARATOR = "\n\n---\n\n";
const STATIC_CODE_PLAN_CONFIG = resolveDocsCodeBlocksValidateConfig(true);
const STATIC_JITI = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
const EXECUTABLE_LANGUAGES = new Set([
  "bash",
  "curl",
  "javascript",
  "js",
  "jsx",
  "json",
  "node",
  "py",
  "python",
  "rb",
  "ruby",
  "sh",
  "shell",
  "ts",
  "tsx",
  "typescript",
  "zsh",
]);

export type DocsGoldenEvaluationStatus = "unmeasured" | "passed" | "failed";

export type DocsGoldenTaskFilters = DocsAgentGoldenTaskFilters;
export type DocsGoldenExpectedExample = DocsAgentGoldenExpectedExample;
export type DocsGoldenTaskExpectation = DocsAgentGoldenTaskExpectation;
export type DocsGoldenTask = DocsAgentGoldenTask;

export interface DocsGoldenRetrievedSource {
  rank: number;
  url: string;
  title: string;
  framework?: string;
  version?: string;
  utf8Bytes: number;
  relevant: boolean;
  truncated: boolean;
}

export interface DocsGoldenRetrievalMetrics {
  expectedRelevant: number;
  retrievedRelevant: number;
  recallAtK: number;
  firstRelevantRank: number | null;
  reciprocalRank: number;
  forbiddenSources: string[];
  passed: boolean;
}

export interface DocsGoldenCitationMetrics {
  /** Where the citation evidence came from. Context/results are not model-answer citations. */
  evidence: "context" | "results";
  expected: string[];
  actual: string[];
  missing: string[];
  unexpected: string[];
  precision: number;
  recall: number;
  /** True when every rendered Source line maps one-to-one to a returned source record. */
  integrity: boolean;
  passed: boolean;
}

export interface DocsGoldenSelectionMetrics {
  requestedFramework?: string;
  requestedVersion?: string;
  requestedLocale?: string;
  expectedFramework?: string;
  expectedVersion?: string;
  expectedLocale?: string;
  firstFrameworkMatchRank: number | null;
  firstVersionMatchRank: number | null;
  firstLocaleMatchRank: number | null;
  conflictingSources: string[];
  ambiguousSources: string[];
  passed: boolean;
}

export interface DocsGoldenExampleResult {
  expected: DocsGoldenExpectedExample;
  matchedId?: string;
  source?: string;
  verification: "present" | "syntax" | "execute";
  status: "passed" | "failed" | "skipped";
  reason?: string;
  syntaxValid: boolean;
  executed: boolean;
  executionStatus?: DocsCodeBlockValidationResult["status"];
  /** @deprecated Static/planner executability signal retained for report compatibility. */
  executable: boolean;
  passed: boolean;
}

export interface DocsGoldenExampleMetrics {
  expected: number;
  matched: number;
  syntaxValid: number;
  executed: number;
  /** @deprecated Count of statically/planner-executable examples retained for compatibility. */
  executable: number;
  results: DocsGoldenExampleResult[];
  passed: boolean;
}

export interface DocsGoldenUsageMetrics {
  budgetUnit: "utf8-bytes";
  tokenBudget: number;
  usedUtf8Bytes: number;
  remainingUtf8Bytes: number;
  estimatedTokens: number;
  /** Exact conservative upper bound: one token per UTF-8 byte. */
  conservativeTokenUpperBound: number;
  usefulUtf8Bytes: number;
  usefulByteRatio: number;
  truncated: boolean;
  withinBudget: boolean;
  passed: boolean;
}

export interface DocsGoldenAnswerMetrics {
  evidence: "answer";
  expected: boolean;
  provided: boolean;
  textIncludesMissing: string[];
  textExcludesPresent: string[];
  citations: string[];
  requiredCitations: string[];
  missingCitations: string[];
  unexpectedCitations: string[];
  forbiddenCitations: string[];
  passed: boolean;
}

export interface DocsGoldenTaskReport {
  id: string;
  query: string;
  surface: DocsAgentEvaluationSurface;
  provider: string;
  status: "passed" | "failed";
  passed: boolean;
  score: number;
  context: string;
  sources: DocsGoldenRetrievedSource[];
  retrieval: DocsGoldenRetrievalMetrics;
  citations: DocsGoldenCitationMetrics;
  answer: DocsGoldenAnswerMetrics;
  selection: DocsGoldenSelectionMetrics;
  examples: DocsGoldenExampleMetrics;
  usage: DocsGoldenUsageMetrics;
  issues: string[];
}

export interface DocsGoldenTasksReport {
  status: DocsGoldenEvaluationStatus;
  passed: boolean | null;
  score: number | null;
  taskCount: number;
  passedTaskCount: number;
  failedTaskCount: number;
  tasks: DocsGoldenTaskReport[];
}

interface NormalizedScope {
  framework: string[];
  version: string[];
  locale: string[];
  frameworkAmbiguous: boolean;
  versionAmbiguous: boolean;
}

interface ContextCandidate {
  page: DocsMcpPage;
  source: string;
  content: string;
  scope: NormalizedScope;
}

interface RetrievedExample {
  source: string;
  target: DocsCodeBlockTarget;
  originalId: string;
  plan?: DocsCodeBlockExecutionPlan;
  syntaxSupported: boolean;
  syntaxValid: boolean;
  staticExecutable: boolean;
}

interface GoldenCitationEvidence {
  mode: "context" | "results";
  actual: string[];
  integrity: boolean;
}

interface GoldenSurfaceResult {
  surface: DocsAgentEvaluationSurface;
  provider: string;
  rankedContext: DocsMcpContextResult;
  budgetedContext: DocsMcpContextResult;
  citationEvidence: GoldenCitationEvidence;
  attributionUtf8Bytes?: number[];
}

export interface RunDocsGoldenTasksOptions {
  /** Default evaluation surface. Tasks may override this with `task.surface`. */
  surface?: DocsAgentEvaluationSurface;
  /** Search configuration used by configured-search and ask-ai-context. */
  search?: boolean | DocsSearchConfig;
  /** Production-resolved Ask AI retrieval config, including `ai.useMcp`. */
  askAISearch?: boolean | DocsSearchConfig;
  siteTitle?: string;
  baseUrl?: string;
  rootDir?: string;
  /** Permit external configured search or HTTP answer calls. @default false */
  allowNetwork?: boolean;
  /** Per-task configured-search/Ask-AI retrieval timeout in milliseconds. @default 30000 */
  searchTimeoutMs?: number;
  /** Project code-block validation config used only by explicit execute expectations. */
  codeBlocksValidate?: boolean | DocsCodeBlocksValidateConfig;
  /** Optional actual-answer runner. No model or HTTP request is made when omitted. */
  answer?: DocsAgentEvaluationAnswerProvider;
}

interface NormalizedGoldenTaskInput {
  task: DocsGoldenTask;
  issues: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRuntimeString(
  value: unknown,
  path: string,
  issues: string[],
  required = false,
): string | undefined {
  if (value === undefined) {
    if (required) issues.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  return value.trim();
}

function normalizeRuntimeStringList(
  value: unknown,
  path: string,
  issues: string[],
  options: { required?: boolean } = {},
): string[] | undefined {
  if (value === undefined) {
    if (options.required) issues.push(`${path} must be a non-empty string array.`);
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push(`${path} must be a string array.`);
    return [];
  }

  const normalized: string[] = [];
  let hasInvalidItem = false;
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      hasInvalidItem = true;
      continue;
    }
    if (!normalized.includes(item.trim())) normalized.push(item.trim());
  }
  if (hasInvalidItem) issues.push(`${path} must contain only non-empty strings.`);
  if (options.required && normalized.length === 0) {
    issues.push(`${path} must contain at least one source.`);
  }
  return normalized;
}

function normalizeRuntimeNumber(
  value: unknown,
  path: string,
  issues: string[],
  options: { minimum?: number; maximum?: number; integer?: boolean } = {},
): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (options.integer && !Number.isInteger(value)) ||
    (options.minimum !== undefined && value < options.minimum) ||
    (options.maximum !== undefined && value > options.maximum)
  ) {
    const range =
      options.minimum !== undefined || options.maximum !== undefined
        ? ` between ${options.minimum ?? "-Infinity"} and ${options.maximum ?? "Infinity"}`
        : "";
    issues.push(`${path} must be a finite${options.integer ? " integer" : " number"}${range}.`);
    return undefined;
  }
  return value;
}

function normalizeRuntimeFilters(
  value: unknown,
  path: string,
  issues: string[],
): DocsGoldenTaskFilters | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return undefined;
  }

  const framework = normalizeRuntimeString(value.framework, `${path}.framework`, issues);
  const version = normalizeRuntimeString(value.version, `${path}.version`, issues);
  const locale = normalizeRuntimeString(value.locale, `${path}.locale`, issues);
  return framework || version || locale ? { framework, version, locale } : undefined;
}

function normalizeRuntimeEnum<T extends string>(
  value: unknown,
  path: string,
  issues: string[],
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issues.push(
      `${path} must be one of ${allowed.map((item) => JSON.stringify(item)).join(", ")}.`,
    );
    return undefined;
  }
  return value as T;
}

function normalizeRuntimeAnswerExpectation(
  value: unknown,
  path: string,
  issues: string[],
): DocsAgentGoldenAnswerExpectation | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return undefined;
  }

  return {
    includes: normalizeRuntimeStringList(value.includes, `${path}.includes`, issues),
    excludes: normalizeRuntimeStringList(value.excludes, `${path}.excludes`, issues),
    requiredCitations: normalizeRuntimeStringList(
      value.requiredCitations,
      `${path}.requiredCitations`,
      issues,
    ),
    allowedCitations: normalizeRuntimeStringList(
      value.allowedCitations,
      `${path}.allowedCitations`,
      issues,
    ),
    forbiddenCitations: normalizeRuntimeStringList(
      value.forbiddenCitations,
      `${path}.forbiddenCitations`,
      issues,
    ),
  };
}

function normalizeRuntimeExamples(
  value: unknown,
  path: string,
  issues: string[],
): DocsGoldenExpectedExample[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array.`);
    return [];
  }

  return value.flatMap((item, index): DocsGoldenExpectedExample[] => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      issues.push(`${itemPath} must be an object.`);
      return [];
    }
    const source = normalizeRuntimeString(item.source, `${itemPath}.source`, issues);
    const language = normalizeRuntimeString(item.language, `${itemPath}.language`, issues);
    const framework = normalizeRuntimeString(item.framework, `${itemPath}.framework`, issues);
    const packageManager = normalizeRuntimeString(
      item.packageManager,
      `${itemPath}.packageManager`,
      issues,
    );
    const title = normalizeRuntimeString(item.title, `${itemPath}.title`, issues);
    const includes = normalizeRuntimeStringList(item.includes, `${itemPath}.includes`, issues);
    let runnable: boolean | undefined;
    if (item.runnable !== undefined) {
      if (typeof item.runnable === "boolean") runnable = item.runnable;
      else issues.push(`${itemPath}.runnable must be a boolean.`);
    }
    const verification = normalizeRuntimeEnum(
      item.verification,
      `${itemPath}.verification`,
      issues,
      ["present", "syntax", "execute"] as const,
    );
    return [
      { source, language, framework, packageManager, title, runnable, includes, verification },
    ];
  });
}

function normalizeGoldenTaskInput(
  value: unknown,
  index: number,
  initialIssues: string[] = [],
): NormalizedGoldenTaskInput {
  const issues = [...initialIssues];
  const path = `tasks[${index}]`;
  const input = isRecord(value) ? value : {};
  if (!isRecord(value)) issues.push(`${path} must be an object.`);

  const id =
    normalizeRuntimeString(input.id, `${path}.id`, issues, true) ?? `invalid-task-${index + 1}`;
  const query = normalizeRuntimeString(input.query, `${path}.query`, issues, true) ?? "";
  const filters = normalizeRuntimeFilters(input.filters, `${path}.filters`, issues);
  const tokenBudget = normalizeRuntimeNumber(input.tokenBudget, `${path}.tokenBudget`, issues, {
    minimum: 1,
    integer: true,
  });
  const topK = normalizeRuntimeNumber(input.topK, `${path}.topK`, issues, {
    minimum: 1,
    integer: true,
  });
  const surface = normalizeRuntimeEnum(input.surface, `${path}.surface`, issues, [
    "mcp-context",
    "configured-search",
    "ask-ai-context",
  ] as const);

  const expectPath = `${path}.expect`;
  const expectation = isRecord(input.expect) ? input.expect : {};
  if (!isRecord(input.expect)) issues.push(`${expectPath} must be an object.`);
  const relevantSources =
    normalizeRuntimeStringList(
      expectation.relevantSources,
      `${expectPath}.relevantSources`,
      issues,
      { required: true },
    ) ?? [];
  const allowedSources = normalizeRuntimeStringList(
    expectation.allowedSources,
    `${expectPath}.allowedSources`,
    issues,
  );
  const forbiddenSources = normalizeRuntimeStringList(
    expectation.forbiddenSources,
    `${expectPath}.forbiddenSources`,
    issues,
  );
  const requiredCitations = normalizeRuntimeStringList(
    expectation.requiredCitations,
    `${expectPath}.requiredCitations`,
    issues,
  );
  const minRecallAtK = normalizeRuntimeNumber(
    expectation.minRecallAtK,
    `${expectPath}.minRecallAtK`,
    issues,
    { minimum: 0, maximum: 1 },
  );
  const maxFirstRelevantRank = normalizeRuntimeNumber(
    expectation.maxFirstRelevantRank,
    `${expectPath}.maxFirstRelevantRank`,
    issues,
    { minimum: 1, integer: true },
  );
  const minUsefulByteRatio = normalizeRuntimeNumber(
    expectation.minUsefulByteRatio,
    `${expectPath}.minUsefulByteRatio`,
    issues,
    { minimum: 0, maximum: 1 },
  );
  const examples = normalizeRuntimeExamples(expectation.examples, `${expectPath}.examples`, issues);
  const scope = normalizeRuntimeFilters(expectation.scope, `${expectPath}.scope`, issues);
  const answer = normalizeRuntimeAnswerExpectation(
    expectation.answer,
    `${expectPath}.answer`,
    issues,
  );

  const forbidden = forbiddenSources ?? [];
  for (const [name, sources] of [
    ["relevantSources", relevantSources],
    ["allowedSources", allowedSources ?? []],
    ["requiredCitations", requiredCitations ?? []],
  ] as const) {
    const overlaps = sources.filter((source) =>
      forbidden.some(
        (forbiddenSource) =>
          sourceMatches(source, forbiddenSource) || sourceMatches(forbiddenSource, source),
      ),
    );
    if (overlaps.length > 0) {
      issues.push(
        `${expectPath}.${name} must not overlap ${expectPath}.forbiddenSources (${overlaps.join(", ")}).`,
      );
    }
  }

  return {
    task: {
      id,
      query,
      filters,
      tokenBudget,
      topK,
      surface,
      expect: {
        relevantSources,
        allowedSources,
        forbiddenSources,
        requiredCitations,
        minRecallAtK,
        maxFirstRelevantRank,
        minUsefulByteRatio,
        examples,
        scope,
        answer,
      },
    },
    issues,
  };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return clamp(Math.floor(value ?? fallback), 1, maximum);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function canonicalizeSource(value: string, baseUrl?: string): string {
  const rawValue = value.trim();
  let pathname: string;
  let hash: string;
  let origin = "";

  try {
    let configuredBase: URL | undefined;
    if (baseUrl) {
      try {
        const candidate = new URL(baseUrl);
        if (candidate.protocol === "http:" || candidate.protocol === "https:") {
          configuredBase = candidate;
        }
      } catch {
        // Relative values still need a deterministic base, but an invalid configured base must
        // never cause an explicitly hosted source to lose its origin below.
      }
    }
    const base = configuredBase ?? new URL("https://docs.local");
    const parsed = new URL(rawValue, base);
    pathname = parsed.pathname;
    hash = parsed.hash;
    const explicitlySchemed = /^[a-z][a-z\d+.-]*:/iu.test(rawValue);
    const explicitlyHosted =
      (explicitlySchemed && (parsed.protocol === "http:" || parsed.protocol === "https:")) ||
      /^[\\/]{2}/u.test(rawValue);
    if (explicitlyHosted && (!configuredBase || parsed.origin !== configuredBase.origin)) {
      origin = parsed.origin;
    }
    if (explicitlySchemed && parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      // Unsupported schemes must retain an identity that cannot collapse onto a local docs path.
      // For example, `javascript:/docs/auth` must never satisfy an expectation for `/docs/auth`.
      origin = `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    const [pathAndQuery = "/", fragment = ""] = rawValue.split("#", 2);
    pathname = pathAndQuery.split("?", 1)[0] || "/";
    hash = fragment ? `#${fragment}` : "";
  }

  pathname = pathname.replace(/\/{2,}/gu, "/").replace(/\.md$/iu, "");
  if (pathname !== "/") pathname = pathname.replace(/\/+$/gu, "");
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  const normalizedHash = hash
    ? `#${safeDecode(hash.slice(1)).trim().replace(/^#+/u, "").toLowerCase()}`
    : "";
  return `${origin}${pathname || "/"}${normalizedHash === "#" ? "" : normalizedHash}`;
}

function sourcePage(value: string): string {
  return canonicalizeSource(value).split("#", 1)[0] ?? "/";
}

function sourceMatches(actual: string, expected: string, baseUrl?: string): boolean {
  const canonicalActual = canonicalizeSource(actual, baseUrl);
  const canonicalExpected = canonicalizeSource(expected, baseUrl);
  return canonicalExpected.includes("#")
    ? canonicalActual === canonicalExpected
    : sourcePage(canonicalActual) === sourcePage(canonicalExpected);
}

function uniqueCanonicalSources(values: readonly string[], baseUrl?: string): string[] {
  return Array.from(new Set(values.map((value) => canonicalizeSource(value, baseUrl))));
}

function valuesOverlap(
  left: readonly string[],
  right: readonly string[],
  matches: (requested: string, candidate: string) => boolean,
): boolean {
  return left.some((leftValue) => right.some((rightValue) => matches(leftValue, rightValue)));
}

function getPageScope(page: DocsMcpPage): NormalizedScope {
  const topFramework = normalizeAgentScopeValues(page.framework).map(normalizeAgentFramework);
  const contractFramework = normalizeAgentScopeValues(page.agent?.appliesTo?.framework).map(
    normalizeAgentFramework,
  );
  const topVersion = normalizeAgentScopeValues(page.version).map(normalizeAgentVersion);
  const contractVersion = normalizeAgentScopeValues(page.agent?.appliesTo?.version).map(
    normalizeAgentVersion,
  );
  const locale = normalizeAgentScopeValues(page.locale).map(normalizeAgentLocale);

  return {
    framework: Array.from(new Set([...topFramework, ...contractFramework])),
    version: Array.from(new Set([...topVersion, ...contractVersion])),
    locale,
    frameworkAmbiguous:
      topFramework.length > 0 &&
      contractFramework.length > 0 &&
      !valuesOverlap(topFramework, contractFramework, (left, right) => left === right),
    versionAmbiguous:
      topVersion.length > 0 &&
      contractVersion.length > 0 &&
      !valuesOverlap(topVersion, contractVersion, agentVersionConstraintsOverlap),
  };
}

function compareCodePoints(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function toGoldenSources(
  sources: readonly DocsMcpContextSource[],
  relevantSources: readonly string[],
  baseUrl?: string,
): DocsGoldenRetrievedSource[] {
  return sources.map((source, index) => ({
    rank: index + 1,
    url: canonicalizeSource(source.url, baseUrl),
    title: source.section ?? source.title,
    framework: source.framework,
    version: source.version,
    utf8Bytes: source.utf8Bytes,
    relevant: relevantSources.some((expected) => sourceMatches(source.url, expected, baseUrl)),
    truncated: source.truncated,
  }));
}

function toContextCandidates(
  sources: readonly DocsMcpContextSource[],
  pagesByUrl: ReadonlyMap<string, DocsMcpPage>,
): ContextCandidate[] {
  return sources.flatMap((source): ContextCandidate[] => {
    const page = pagesByUrl.get(sourcePage(source.pageUrl));
    if (!page) return [];
    return [
      {
        page,
        source: canonicalizeSource(source.url),
        content: source.content,
        scope: getPageScope(page),
      },
    ];
  });
}

function extractRenderedCitations(
  context: string,
  sources: readonly DocsMcpContextSource[],
): { actual: string[]; layoutIntegrity: boolean; blockUtf8Bytes: number[] } {
  const actual: string[] = [];
  const blockUtf8Bytes: number[] = [];
  let cursor = 0;
  let layoutIntegrity = true;

  for (let index = 0; index < sources.length; index += 1) {
    const attributableStart = cursor;
    if (index > 0) {
      if (!context.startsWith(CONTEXT_SEPARATOR, cursor)) {
        layoutIntegrity = false;
        break;
      }
      cursor += CONTEXT_SEPARATOR.length;
    }

    const contentMarker = `\n\n${sources[index].content}`;
    const contentStart = context.indexOf(contentMarker, cursor);
    if (contentStart < cursor) {
      layoutIntegrity = false;
      break;
    }
    const header = context.slice(cursor, contentStart);
    const sourceLines = header
      .split(/\r?\n/u)
      .map((line) => line.match(/^Source:\s+(.+)$/u)?.[1]?.trim())
      .filter((source): source is string => Boolean(source));
    if (sourceLines.length !== 1) layoutIntegrity = false;
    actual.push(...sourceLines.map((source) => canonicalizeSource(source)));
    cursor = contentStart + contentMarker.length;
    blockUtf8Bytes.push(Buffer.byteLength(context.slice(attributableStart, cursor), "utf8"));
  }

  if (cursor !== context.length) layoutIntegrity = false;
  return { actual, layoutIntegrity, blockUtf8Bytes };
}

function getPageAgentMarkdown(page: DocsMcpPage): string {
  return (
    page.agentRawContent ??
    page.agentFallbackRawContent ??
    page.agentContent ??
    page.agentFallbackContent ??
    page.rawContent ??
    page.content
  );
}

function findPageForSource(
  pagesByUrl: ReadonlyMap<string, DocsMcpPage>,
  value: string,
): DocsMcpPage | undefined {
  return pagesByUrl.get(sourcePage(value));
}

function getResultAnchor(value: string): string | undefined {
  const canonical = canonicalizeSource(value);
  const anchor = canonical.split("#", 2)[1];
  return anchor || undefined;
}

function hydrateSearchSource(
  result: DocsSearchResult,
  index: number,
  pagesByUrl: ReadonlyMap<string, DocsMcpPage>,
  contentMode: "result" | "page-section",
  baseUrl?: string,
): DocsMcpContextSource {
  const normalizedResultUrl = canonicalizeSource(result.url, baseUrl);
  const page = findPageForSource(pagesByUrl, normalizedResultUrl);
  const anchor = getResultAnchor(result.url);
  const section = anchor ?? result.section;
  const pageSection =
    page && section ? findDocsMarkdownSection(getPageAgentMarkdown(page), section) : undefined;
  const content =
    contentMode === "page-section" && page
      ? (pageSection?.content ?? getPageAgentMarkdown(page)).trim()
      : [result.content, result.description].filter(Boolean).join("\n\n").trim();
  const scope = page ? getPageScope(page) : undefined;
  const url = normalizedResultUrl;

  return {
    id: result.id || `evaluation-result-${index + 1}`,
    title: page?.title ?? result.content.split("—", 1)[0]?.trim() ?? url,
    pageUrl: sourcePage(url),
    url,
    section: pageSection?.title ?? result.section,
    anchor: pageSection?.anchor ?? anchor,
    sourcePath: page?.sourcePath,
    lastModified: page?.lastModified,
    locale: scope?.locale[0],
    framework: scope?.framework[0],
    version: scope?.version[0],
    tags: page?.tags ? [...page.tags] : undefined,
    score: result.score,
    content,
    chars: content.length,
    utf8Bytes: Buffer.byteLength(content, "utf8"),
    truncated: false,
  };
}

function buildContextFromSources(options: {
  query: string;
  filters: DocsGoldenTaskFilters | undefined;
  sources: readonly DocsMcpContextSource[];
  tokenBudget: number;
}): DocsMcpContextResult {
  const blocks: string[] = [];
  const included: DocsMcpContextSource[] = [];
  let usedUtf8Bytes = 0;

  for (const source of options.sources) {
    const header = [`## ${source.title}`, `Source: ${source.url}`].join("\n");
    const separator = blocks.length === 0 ? "" : CONTEXT_SEPARATOR;
    const available =
      options.tokenBudget - usedUtf8Bytes - Buffer.byteLength(separator + header + "\n\n");
    if (available <= 0) break;
    const contentBuffer = Buffer.from(source.content, "utf8");
    let content = source.content;
    let truncated = false;
    if (contentBuffer.byteLength > available) {
      truncated = true;
      content = contentBuffer
        .subarray(0, available)
        .toString("utf8")
        .replace(/\uFFFD$/u, "");
      while (Buffer.byteLength(content, "utf8") > available) content = content.slice(0, -1);
    }
    if (!content) break;
    const block = `${header}\n\n${content}`;
    blocks.push(block);
    usedUtf8Bytes += Buffer.byteLength(separator + block, "utf8");
    included.push({
      ...source,
      content,
      chars: content.length,
      utf8Bytes: Buffer.byteLength(content, "utf8"),
      truncated,
    });
    if (truncated) break;
  }

  const context = blocks.join(CONTEXT_SEPARATOR);
  usedUtf8Bytes = Buffer.byteLength(context, "utf8");
  return {
    query: options.query,
    filters: {
      framework: options.filters?.framework,
      version: options.filters?.version,
      locale: options.filters?.locale,
    },
    budget: {
      requestedTokens: options.tokenBudget,
      strategy: "utf8-bytes",
      maxUtf8Bytes: options.tokenBudget,
      usedUtf8Bytes,
      conservativeTokenUpperBound: usedUtf8Bytes,
      remainingUtf8Bytes: Math.max(0, options.tokenBudget - usedUtf8Bytes),
      truncated:
        included.some((source) => source.truncated) || included.length < options.sources.length,
    },
    resultCount: included.length,
    candidateCount: options.sources.length,
    context,
    sources: included,
  };
}

function getConfiguredSearchProvider(search: boolean | DocsSearchConfig | undefined): string {
  if (search === false) return "disabled";
  if (!search || search === true) return "simple";
  if (search.enabled === false) return "disabled";
  return search.provider ?? "simple";
}

function isConfiguredSearchDisabled(search: boolean | DocsSearchConfig | undefined): boolean {
  return (
    search === false || Boolean(search && typeof search === "object" && search.enabled === false)
  );
}

function assertEvaluationSearchConfig(search: boolean | DocsSearchConfig | undefined): void {
  if (search === undefined || typeof search === "boolean") return;
  if (!isRecord(search)) {
    throw new Error("The configured search value must be a boolean or provider object.");
  }
  const runtime = search;
  if (runtime.enabled !== undefined && typeof runtime.enabled !== "boolean") {
    throw new Error("The configured search enabled field must be boolean.");
  }
  const provider = runtime.provider ?? "simple";
  if (
    typeof provider !== "string" ||
    !["simple", "custom", "typesense", "mcp", "algolia"].includes(provider)
  ) {
    throw new Error(`Unsupported configured search provider: ${String(provider)}.`);
  }

  const requireStrings = (fields: string[]) => {
    const missing = fields.filter(
      (field) => typeof runtime[field] !== "string" || !(runtime[field] as string).trim(),
    );
    if (missing.length > 0) {
      throw new Error(`The ${provider} search provider requires non-empty ${missing.join(", ")}.`);
    }
  };
  if (provider === "mcp") {
    requireStrings(["endpoint"]);
    if (
      runtime.headers !== undefined &&
      (!isRecord(runtime.headers) ||
        Object.values(runtime.headers).some((value) => typeof value !== "string"))
    ) {
      throw new Error("The MCP search provider headers must contain only string values.");
    }
  }
  if (provider === "algolia") requireStrings(["appId", "indexName", "searchApiKey"]);
  if (provider === "typesense") requireStrings(["baseUrl", "collection", "apiKey"]);
  if (provider === "custom") {
    const adapter = runtime.adapter;
    if (
      typeof adapter !== "function" &&
      (!isRecord(adapter) || typeof adapter.search !== "function")
    ) {
      throw new Error(
        "The custom search provider requires an adapter or adapter factory with a search function.",
      );
    }
  }
}

function assertEvaluationSearchAllowed(
  search: boolean | DocsSearchConfig | undefined,
  allowNetwork: boolean,
  surface: DocsAgentEvaluationSurface,
  baseUrl?: string,
): void {
  const provider = getConfiguredSearchProvider(search);
  if (surface === "configured-search" && provider === "disabled") {
    throw new Error("Configured search is disabled; no search surface can be evaluated.");
  }
  if (provider !== "simple" && provider !== "disabled" && !allowNetwork) {
    throw new Error(
      `The ${provider} search provider requires agent.evaluations.allowNetwork: true for evaluation.`,
    );
  }
  if (
    search &&
    typeof search === "object" &&
    search.provider === "mcp" &&
    !/^https?:\/\//iu.test(search.endpoint) &&
    !baseUrl
  ) {
    throw new Error(
      "A relative MCP evaluation endpoint requires ai.docsUrl or another canonical docs baseUrl.",
    );
  }
}

async function runEvaluationSearchWithTimeout<T>(options: {
  provider: string;
  timeoutMs?: number;
  run: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  if (
    options.timeoutMs !== undefined &&
    (typeof options.timeoutMs !== "number" ||
      !Number.isFinite(options.timeoutMs) ||
      options.timeoutMs <= 0)
  ) {
    throw new Error("The agent evaluation searchTimeoutMs must be a positive finite number.");
  }
  const timeoutMs = normalizePositiveInteger(options.timeoutMs, 30_000, 300_000);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timeoutError: Error | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timeoutError = new Error(
        `The ${options.provider} search provider timed out after ${timeoutMs}ms.`,
      );
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => options.run(controller.signal)),
      timedOut,
    ]).catch((error: unknown) => {
      if (timeoutError) throw timeoutError;
      throw error;
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function createContextShell(options: {
  query: string;
  filters: DocsGoldenTaskFilters | undefined;
  tokenBudget: number;
  context?: string;
  sources?: DocsMcpContextSource[];
  candidateCount?: number;
  truncated?: boolean;
}): DocsMcpContextResult {
  const context = options.context ?? "";
  const sources = options.sources ?? [];
  const usedUtf8Bytes = Buffer.byteLength(context, "utf8");
  return {
    query: options.query,
    filters: {
      framework: options.filters?.framework,
      version: options.filters?.version,
      locale: options.filters?.locale,
    },
    budget: {
      requestedTokens: options.tokenBudget,
      strategy: "utf8-bytes",
      maxUtf8Bytes: options.tokenBudget,
      usedUtf8Bytes,
      conservativeTokenUpperBound: usedUtf8Bytes,
      remainingUtf8Bytes: Math.max(0, options.tokenBudget - usedUtf8Bytes),
      truncated: options.truncated ?? usedUtf8Bytes > options.tokenBudget,
    },
    resultCount: sources.length,
    candidateCount: options.candidateCount ?? sources.length,
    context,
    sources,
  };
}

function parseAskAIContextSources(options: {
  context: string;
  blocks: readonly string[];
  results: readonly ReturnType<typeof hydrateSearchSource>[];
  baseUrl?: string;
}): { sources: DocsMcpContextSource[]; citations: string[]; integrity: boolean } {
  if (!options.context) {
    return { sources: [], citations: [], integrity: options.results.length === 0 };
  }
  const blocks = options.blocks;
  const sources: DocsMcpContextSource[] = [];
  const citations: string[] = [];
  let integrity =
    blocks.length === options.results.length && blocks.join(CONTEXT_SEPARATOR) === options.context;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] ?? "";
    const contentStart = block.indexOf("\n\n");
    if (contentStart < 0) {
      integrity = false;
      continue;
    }
    const header = block.slice(0, contentStart);
    const urlLines = header
      .split(/\r?\n/u)
      .map((line) => line.match(/^URL:\s+(.+)$/u)?.[1]?.trim())
      .filter((value): value is string => Boolean(value));
    if (urlLines.length !== 1) integrity = false;
    const url = canonicalizeSource(urlLines[0] ?? "/", options.baseUrl);
    const expected = options.results[index];
    if (
      !expected ||
      !sourceMatches(url, expected.url) ||
      canonicalizeSource(expected.url) !== url
    ) {
      integrity = false;
    }
    const content = block.slice(contentStart + 2);
    const base = expected ?? {
      id: `ask-ai-result-${index + 1}`,
      title: url,
      pageUrl: sourcePage(url),
      url,
      content: "",
      chars: 0,
      utf8Bytes: 0,
      truncated: false,
    };
    citations.push(url);
    sources.push({
      ...base,
      url,
      pageUrl: sourcePage(url),
      content,
      chars: content.length,
      utf8Bytes: Buffer.byteLength(content, "utf8"),
      truncated: content !== base.content,
    });
  }
  return { sources, citations, integrity };
}

async function buildGoldenSurface(options: {
  pages: readonly DocsMcpPage[];
  task: DocsGoldenTask;
  topK: number;
  tokenBudget: number;
  runOptions: RunDocsGoldenTasksOptions;
}): Promise<GoldenSurfaceResult> {
  const surface = options.task.surface ?? options.runOptions.surface ?? "mcp-context";
  const orderedPages = options.pages
    .slice()
    .sort((left, right) =>
      compareCodePoints(canonicalizeSource(left.url), canonicalizeSource(right.url)),
    );
  const pagesByUrl = new Map(orderedPages.map((page) => [sourcePage(page.url), page]));

  if (surface === "mcp-context") {
    const contextOptions = {
      pages: orderedPages,
      query: options.task.query,
      framework: options.task.filters?.framework,
      version: options.task.filters?.version,
      locale: options.task.filters?.locale,
      maxResults: options.topK,
    };
    const [rankedContext, budgetedContext] = await Promise.all([
      buildDocsMcpContext({ ...contextOptions, tokenBudget: Number.MAX_SAFE_INTEGER }),
      buildDocsMcpContext({ ...contextOptions, tokenBudget: options.tokenBudget }),
    ]);
    const extracted = extractRenderedCitations(budgetedContext.context, budgetedContext.sources);
    return {
      surface,
      provider: "simple",
      rankedContext,
      budgetedContext,
      citationEvidence: {
        mode: "context",
        actual: extracted.actual,
        integrity: extracted.layoutIntegrity,
      },
    };
  }

  const configuredSurfaceSearch =
    surface === "ask-ai-context"
      ? (options.runOptions.askAISearch ?? options.runOptions.search)
      : options.runOptions.search;
  const effectiveSurfaceSearch =
    surface === "ask-ai-context" && isConfiguredSearchDisabled(configuredSurfaceSearch)
      ? true
      : configuredSurfaceSearch;
  assertEvaluationSearchConfig(effectiveSurfaceSearch);
  const surfaceSearch = resolveSearchRequestConfig(
    effectiveSurfaceSearch,
    options.runOptions.baseUrl,
  );
  assertEvaluationSearchAllowed(
    surfaceSearch,
    options.runOptions.allowNetwork === true,
    surface,
    options.runOptions.baseUrl,
  );
  const provider = getConfiguredSearchProvider(surfaceSearch);

  if (surface === "configured-search") {
    const results = await runEvaluationSearchWithTimeout({
      provider,
      timeoutMs: options.runOptions.searchTimeoutMs,
      run: (signal) =>
        performDocsSearch({
          pages: orderedPages,
          query: options.task.query,
          search: surfaceSearch,
          audience: "agent",
          locale: options.task.filters?.locale,
          siteTitle: options.runOptions.siteTitle,
          baseUrl: options.runOptions.baseUrl,
          limit: options.topK,
          failureMode: "throw",
          supplementExternalResults: false,
          strictExternalOrigins: true,
          signal,
        }),
    });
    const rankedSources = results
      .slice(0, options.topK)
      .map((result, index) =>
        hydrateSearchSource(result, index, pagesByUrl, "result", options.runOptions.baseUrl),
      );
    const rankedContext = buildContextFromSources({
      query: options.task.query,
      filters: options.task.filters,
      sources: rankedSources,
      tokenBudget: Number.MAX_SAFE_INTEGER,
    });
    const budgetedContext = buildContextFromSources({
      query: options.task.query,
      filters: options.task.filters,
      sources: rankedSources,
      tokenBudget: options.tokenBudget,
    });
    return {
      surface,
      provider,
      rankedContext,
      budgetedContext,
      citationEvidence: {
        mode: "results",
        actual: rankedSources.map((source) => canonicalizeSource(source.url)),
        integrity: rankedSources.every(
          (source, index) =>
            source.url ===
            canonicalizeSource(results[index]?.url ?? "", options.runOptions.baseUrl),
        ),
      },
    };
  }

  const askAI = await runEvaluationSearchWithTimeout({
    provider,
    timeoutMs: options.runOptions.searchTimeoutMs,
    run: (signal) =>
      buildDocsAskAIContext({
        pages: orderedPages,
        query: options.task.query,
        search: surfaceSearch,
        locale: options.task.filters?.locale,
        siteTitle: options.runOptions.siteTitle,
        baseUrl: options.runOptions.baseUrl,
        limit: options.topK,
        maxContextChars: options.tokenBudget,
        searchFailureMode: "throw",
        strictExternalOrigins: true,
        signal,
      }),
  });
  const rankedSources = askAI.searchResults
    .slice(0, options.topK)
    .map((result, index) =>
      hydrateSearchSource(result, index, pagesByUrl, "result", options.runOptions.baseUrl),
    );
  const resultSources = askAI.results.map((result, index) =>
    hydrateSearchSource(result, index, pagesByUrl, "page-section", options.runOptions.baseUrl),
  );
  const parsed = parseAskAIContextSources({
    context: askAI.context,
    blocks: askAI.blocks.map((block) => block.text),
    results: resultSources,
    baseUrl: options.runOptions.baseUrl,
  });
  return {
    surface,
    provider,
    rankedContext: createContextShell({
      query: options.task.query,
      filters: options.task.filters,
      tokenBudget: Number.MAX_SAFE_INTEGER,
      sources: rankedSources,
    }),
    budgetedContext: createContextShell({
      query: options.task.query,
      filters: options.task.filters,
      tokenBudget: options.tokenBudget,
      context: askAI.context,
      sources: parsed.sources,
      candidateCount: askAI.results.length,
      truncated:
        parsed.sources.some((source) => source.truncated) ||
        Buffer.byteLength(askAI.context, "utf8") > options.tokenBudget,
    }),
    citationEvidence: {
      mode: "context",
      actual: parsed.citations,
      integrity: parsed.integrity,
    },
    attributionUtf8Bytes: askAI.blocks.map((block, index) =>
      Buffer.byteLength(`${index === 0 ? "" : CONTEXT_SEPARATOR}${block.text}`, "utf8"),
    ),
  };
}

function validateStaticSyntax(target: DocsCodeBlockTarget): {
  supported: boolean;
  valid: boolean;
} {
  const language = target.language?.toLowerCase();
  if (language === "json") {
    try {
      JSON.parse(target.code);
      return { supported: true, valid: true };
    } catch {
      return { supported: true, valid: false };
    }
  }
  if (
    language === "javascript" ||
    language === "js" ||
    language === "jsx" ||
    language === "node" ||
    language === "typescript" ||
    language === "ts" ||
    language === "tsx"
  ) {
    try {
      const typescript = language === "typescript" || language === "ts" || language === "tsx";
      const jsx = language === "jsx" || language === "tsx";
      const transformed = STATIC_JITI.transform({
        source: target.code,
        filename: `golden-example.${language === "typescript" ? "ts" : language}`,
        ts: typescript,
        jsx,
        async: true,
      });
      return {
        supported: true,
        valid: !/\bexports\.__JITI_ERROR__\s*=/u.test(transformed),
      };
    } catch {
      return { supported: true, valid: false };
    }
  }
  return { supported: false, valid: false };
}

async function collectRetrievedExamples(
  candidates: readonly ContextCandidate[],
): Promise<RetrievedExample[]> {
  const examples: Array<Pick<RetrievedExample, "source" | "target" | "originalId">> = [];
  for (const candidate of candidates) {
    const targets = extractCodeBlocksFromMarkdown({
      source: candidate.content,
      filePath: candidate.page.sourcePath ?? candidate.page.slug,
      relativePath: candidate.page.slug,
    });
    for (const target of targets) {
      examples.push({
        source: candidate.source,
        originalId: target.id,
        target: {
          ...target,
          id: `${canonicalizeSource(candidate.source)}::${target.id}`,
        },
      });
    }
  }
  const plans = await planCodeBlockTargets(
    examples.map((example) => example.target),
    STATIC_CODE_PLAN_CONFIG,
  );
  return examples.map((example, index) => ({
    ...example,
    plan: plans[index],
    ...(() => {
      const syntax = validateStaticSyntax(example.target);
      const structurallyComplete =
        Boolean(example.target.code.trim()) &&
        !example.target.code
          .split("\n")
          .some((line) => /^\s*(?:(?:\/\/|#)\s*)?\.\.\.\s*$/u.test(line));
      return {
        syntaxSupported: syntax.supported,
        syntaxValid: syntax.valid && structurallyComplete,
        staticExecutable:
          example.target.runnable &&
          Boolean(example.target.language) &&
          EXECUTABLE_LANGUAGES.has(example.target.language!.toLowerCase()) &&
          plans[index]?.action !== "skip" &&
          structurallyComplete &&
          (!syntax.supported || syntax.valid),
      };
    })(),
  }));
}

function normalizedEqual(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function exampleMetadataMatches(
  expected: DocsGoldenExpectedExample,
  actual: RetrievedExample,
  baseUrl?: string,
): boolean {
  if (expected.source && !sourceMatches(actual.source, expected.source, baseUrl)) return false;
  if (expected.language && !normalizedEqual(actual.target.language, expected.language))
    return false;
  if (expected.framework && !normalizedEqual(actual.target.framework, expected.framework))
    return false;
  if (
    expected.packageManager &&
    !normalizedEqual(actual.target.packageManager, expected.packageManager)
  ) {
    return false;
  }
  if (expected.title && !normalizedEqual(actual.target.title, expected.title)) return false;
  if (expected.includes?.some((fragment) => !actual.target.code.includes(fragment))) return false;
  if (expected.runnable === false) return !actual.target.runnable;
  return actual.target.runnable;
}

function resolveExampleVerification(
  expected: DocsGoldenExpectedExample,
): "present" | "syntax" | "execute" {
  return expected.verification ?? (expected.runnable === false ? "present" : "syntax");
}

function failedExampleResult(
  expected: DocsGoldenExpectedExample,
  verification: "present" | "syntax" | "execute",
  reason: string,
  status: "failed" | "skipped" = "failed",
): DocsGoldenExampleResult {
  return {
    expected,
    verification,
    status,
    reason,
    syntaxValid: false,
    executed: false,
    executable: false,
    passed: false,
  };
}

async function evaluateExamples(
  expectedExamples: readonly DocsGoldenExpectedExample[],
  candidates: readonly ContextCandidate[],
  options: RunDocsGoldenTasksOptions,
): Promise<DocsGoldenExampleMetrics> {
  const actualExamples = await collectRetrievedExamples(candidates);
  const claimed = new Set<number>();
  const matches = expectedExamples.map((expected) => {
    const index = actualExamples.findIndex(
      (example, candidateIndex) =>
        !claimed.has(candidateIndex) && exampleMetadataMatches(expected, example, options.baseUrl),
    );
    const verification = resolveExampleVerification(expected);
    if (index < 0) {
      return {
        expected,
        verification,
        result: failedExampleResult(
          expected,
          verification,
          "No matching code block was retrieved.",
        ),
      };
    }
    claimed.add(index);
    return { expected, verification, matched: actualExamples[index] };
  });

  const executeMatches = matches.filter(
    (match): match is (typeof matches)[number] & { matched: RetrievedExample } =>
      match.verification === "execute" && Boolean(match.matched),
  );
  const executionByTarget = new Map<DocsCodeBlockTarget, DocsCodeBlockValidationResult>();
  let executionFailure: string | undefined;

  if (executeMatches.length > 0) {
    const resolved = resolveDocsCodeBlocksValidateConfig(options.codeBlocksValidate);
    if (options.allowNetwork !== true) {
      executionFailure =
        "Execution verification requires agent.evaluations.allowNetwork: true because arbitrary examples and validators may access the network.";
    } else if (!resolved.enabled) {
      executionFailure =
        "Execution verification requires codeBlocks.validate to be explicitly enabled.";
    } else if (resolved.mode !== "report") {
      executionFailure = "Execution verification requires codeBlocks.validate.mode to be report.";
    } else if (!options.rootDir) {
      executionFailure = "Execution verification requires a project rootDir.";
    } else {
      try {
        const targets = executeMatches.map((match) => match.matched.target);
        const plans = await planCodeBlockTargets(targets, resolved);
        const validation = await validateCodeBlockPlans({
          plans,
          rootDir: options.rootDir,
          config: resolved,
        });
        for (let index = 0; index < targets.length; index += 1) {
          const plan = plans[index];
          const result = validation.find((candidate) => candidate.plan === plan);
          if (result) executionByTarget.set(targets[index], result);
        }
      } catch (error) {
        executionFailure = `Execution verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }
  }

  const results = matches.map(({ expected, verification, matched }): DocsGoldenExampleResult => {
    if (!matched)
      return failedExampleResult(expected, verification, "No matching code block was retrieved.");

    const base = {
      expected,
      matchedId: matched.originalId,
      source: matched.source,
      verification,
      syntaxValid: matched.syntaxValid,
      executed: false,
      executable: matched.staticExecutable,
    };
    if (verification === "present") {
      return { ...base, status: "passed", passed: true };
    }
    if (verification === "syntax") {
      if (!matched.syntaxSupported) {
        return {
          ...base,
          status: "skipped",
          reason: `Static syntax verification is unsupported for ${matched.target.language ?? "an untyped fence"}.`,
          passed: false,
        };
      }
      return {
        ...base,
        status: matched.syntaxValid ? "passed" : "failed",
        reason: matched.syntaxValid ? undefined : "The retrieved code block has invalid syntax.",
        passed: matched.syntaxValid,
      };
    }

    if (executionFailure) {
      return { ...base, status: "skipped", reason: executionFailure, passed: false };
    }
    const validation = executionByTarget.get(matched.target);
    if (!validation) {
      return {
        ...base,
        status: "skipped",
        reason: "The configured validator did not return an execution result.",
        passed: false,
      };
    }
    const executed = validation.plan.action === "execute" && validation.status === "PASS";
    return {
      ...base,
      status: executed ? "passed" : validation.status === "SKIP" ? "skipped" : "failed",
      reason: executed
        ? undefined
        : (validation.reason ??
          (validation.plan.action !== "execute"
            ? "The validator did not plan runtime execution."
            : `Execution returned ${validation.status}.`)),
      executed,
      executable: matched.staticExecutable,
      executionStatus: validation.status,
      passed: executed,
    };
  });
  const matched = results.filter((result) => result.passed).length;
  return {
    expected: expectedExamples.length,
    matched,
    syntaxValid: results.filter((result) => result.syntaxValid).length,
    executed: results.filter((result) => result.executed).length,
    executable: results.filter((result) => result.executable).length,
    results,
    passed: matched === expectedExamples.length,
  };
}

function buildRetrievalMetrics(
  task: DocsGoldenTask,
  sources: readonly DocsGoldenRetrievedSource[],
  topK: number,
  baseUrl?: string,
): DocsGoldenRetrievalMetrics {
  const expected = uniqueCanonicalSources(task.expect.relevantSources, baseUrl);
  const forbidden = uniqueCanonicalSources(task.expect.forbiddenSources ?? [], baseUrl);
  const retrievedRelevant = expected.filter((source) =>
    sources.some((actual) => sourceMatches(actual.url, source, baseUrl)),
  ).length;
  const recallAtK = expected.length > 0 ? retrievedRelevant / expected.length : 0;
  const firstRelevant = sources.find((source) => source.relevant)?.rank ?? null;
  const forbiddenSources = sources
    .filter((source) =>
      forbidden.some((forbiddenSource) => sourceMatches(source.url, forbiddenSource, baseUrl)),
    )
    .map((source) => source.url);
  const minimumRecall = clamp(task.expect.minRecallAtK ?? 1, 0, 1);
  const maximumRank = normalizePositiveInteger(task.expect.maxFirstRelevantRank, topK, topK);
  return {
    expectedRelevant: expected.length,
    retrievedRelevant,
    recallAtK: round(recallAtK),
    firstRelevantRank: firstRelevant,
    reciprocalRank: firstRelevant ? round(1 / firstRelevant) : 0,
    forbiddenSources,
    passed:
      expected.length > 0 &&
      recallAtK >= minimumRecall &&
      firstRelevant !== null &&
      firstRelevant <= maximumRank &&
      forbiddenSources.length === 0,
  };
}

function buildCitationMetrics(
  task: DocsGoldenTask,
  context: string,
  sources: readonly DocsMcpContextSource[],
  evidence?: GoldenCitationEvidence,
  baseUrl?: string,
): DocsGoldenCitationMetrics {
  const expected = uniqueCanonicalSources(
    task.expect.requiredCitations ?? task.expect.relevantSources,
    baseUrl,
  );
  const allowed = uniqueCanonicalSources(
    [
      ...task.expect.relevantSources,
      ...(task.expect.requiredCitations ?? []),
      ...(task.expect.allowedSources ?? []),
    ],
    baseUrl,
  );
  const extracted = evidence
    ? { actual: evidence.actual, layoutIntegrity: evidence.integrity }
    : extractRenderedCitations(context, sources);
  const actual = extracted.actual;
  const sourceRecords = sources.map((source) => canonicalizeSource(source.url));
  const missing = expected.filter(
    (expectedSource) =>
      !actual.some((actualSource) => sourceMatches(actualSource, expectedSource, baseUrl)),
  );
  const unexpected = actual.filter(
    (actualSource) =>
      !allowed.some((allowedSource) => sourceMatches(actualSource, allowedSource, baseUrl)),
  );
  const correct = actual.filter((actualSource) =>
    allowed.some((allowedSource) => sourceMatches(actualSource, allowedSource, baseUrl)),
  ).length;
  const matchedExpected = expected.filter((expectedSource) =>
    actual.some((actualSource) => sourceMatches(actualSource, expectedSource, baseUrl)),
  ).length;
  const precision = actual.length > 0 ? correct / actual.length : expected.length === 0 ? 1 : 0;
  const recall = expected.length > 0 ? matchedExpected / expected.length : 1;
  const integrity =
    extracted.layoutIntegrity &&
    actual.length === sourceRecords.length &&
    actual.every((source, index) => source === sourceRecords[index]);
  return {
    evidence: evidence?.mode ?? "context",
    expected,
    actual,
    missing,
    unexpected,
    precision: round(precision),
    recall: round(recall),
    integrity,
    passed: missing.length === 0 && unexpected.length === 0 && integrity,
  };
}

function canonicalizeAnswerCitation(value: string, baseUrl?: string): string {
  return canonicalizeSource(value.trim(), baseUrl);
}

function uniqueAnswerCitations(values: readonly string[], baseUrl?: string): string[] {
  return Array.from(new Set(values.map((value) => canonicalizeAnswerCitation(value, baseUrl))));
}

function answerCitationMatches(actual: string, expected: string): boolean {
  return expected.includes("#")
    ? actual === expected
    : actual.split("#", 1)[0] === expected.split("#", 1)[0];
}

function maskMarkdownCitationInertRegions(text: string): string {
  const masked = new Uint8Array(text.length);
  const maskRange = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) masked[index] = 1;
  };

  // Markdown links in comments do not produce visible citations.
  for (let start = text.indexOf("<!--"); start >= 0; start = text.indexOf("<!--", start + 4)) {
    const closing = text.indexOf("-->", start + 4);
    const end = closing < 0 ? text.length : closing + 3;
    maskRange(start, end);
    if (closing < 0) break;
    start = closing;
  }

  // Mask fenced code blocks before scanning inline code spans.
  let openFence: { character: "`" | "~"; length: number; start: number } | undefined;
  let lineStart = 0;
  while (lineStart <= text.length) {
    const newline = text.indexOf("\n", lineStart);
    const lineEnd = newline < 0 ? text.length : newline + 1;
    const line = text.slice(lineStart, newline < 0 ? text.length : newline);
    if (!masked[lineStart]) {
      if (!openFence) {
        const opening = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/u)?.[1];
        if (opening) {
          openFence = {
            character: opening[0] as "`" | "~",
            length: opening.length,
            start: lineStart,
          };
        }
      } else {
        const closingPattern = new RegExp(
          `^[ \\t]{0,3}${openFence.character}{${openFence.length},}[ \\t]*$`,
          "u",
        );
        if (closingPattern.test(line)) {
          maskRange(openFence.start, lineEnd);
          openFence = undefined;
        }
      }
    }
    if (newline < 0) break;
    lineStart = lineEnd;
  }
  if (openFence) maskRange(openFence.start, text.length);

  // CommonMark code spans close only on a backtick run of the same length.
  for (let index = 0; index < text.length; index += 1) {
    if (masked[index] || text[index] !== "`") continue;
    let runEnd = index + 1;
    while (!masked[runEnd] && text[runEnd] === "`") runEnd += 1;
    const runLength = runEnd - index;
    let cursor = runEnd;
    let closingEnd = -1;
    while (cursor < text.length) {
      if (masked[cursor] || text[cursor] !== "`") {
        cursor += 1;
        continue;
      }
      let candidateEnd = cursor + 1;
      while (!masked[candidateEnd] && text[candidateEnd] === "`") candidateEnd += 1;
      if (candidateEnd - cursor === runLength) {
        closingEnd = candidateEnd;
        break;
      }
      cursor = candidateEnd;
    }
    if (closingEnd > 0) {
      maskRange(index, closingEnd);
      index = closingEnd - 1;
    } else {
      index = runEnd - 1;
    }
  }

  return text
    .split("")
    .map((character, index) =>
      masked[index] && character !== "\n" && character !== "\r" ? " " : character,
    )
    .join("");
}

function extractInlineMarkdownLinkDestinations(text: string): string[] {
  text = maskMarkdownCitationInertRegions(text);
  const destinations: string[] = [];
  const escapedAt = (index: number) => {
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
      backslashes += 1;
    }
    return backslashes % 2 === 1;
  };
  for (let index = 0; index < text.length - 1; index += 1) {
    if (text[index] !== "]" || text[index + 1] !== "(" || escapedAt(index)) continue;
    let bracketDepth = 1;
    let openingBracket = -1;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (escapedAt(cursor)) continue;
      if (text[cursor] === "]") bracketDepth += 1;
      if (text[cursor] === "[") {
        bracketDepth -= 1;
        if (bracketDepth === 0) {
          openingBracket = cursor;
          break;
        }
      }
    }
    if (
      openingBracket < 0 ||
      (text[openingBracket - 1] === "!" && !escapedAt(openingBracket - 1))
    ) {
      continue;
    }
    let cursor = index + 2;
    while (/\s/u.test(text[cursor] ?? "")) cursor += 1;
    if (text[cursor] === "<") {
      const end = text.indexOf(">", cursor + 1);
      if (end <= cursor + 1) continue;
      let closingCursor = end + 1;
      while (/\s/u.test(text[closingCursor] ?? "")) closingCursor += 1;
      const titleOpener = text[closingCursor];
      if (titleOpener === '"' || titleOpener === "'" || titleOpener === "(") {
        const titleCloser = titleOpener === "(" ? ")" : titleOpener;
        closingCursor += 1;
        let escaped = false;
        while (closingCursor < text.length) {
          const character = text[closingCursor] ?? "";
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === titleCloser) {
            closingCursor += 1;
            break;
          }
          closingCursor += 1;
        }
        while (/\s/u.test(text[closingCursor] ?? "")) closingCursor += 1;
      }
      if (text[closingCursor] === ")") destinations.push(text.slice(cursor + 1, end));
      continue;
    }

    const start = cursor;
    let depth = 1;
    let escaped = false;
    let destinationEnd = -1;
    for (; cursor < text.length; cursor += 1) {
      const character = text[cursor] ?? "";
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === "(") depth += 1;
      if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          destinationEnd = cursor;
          break;
        }
      }
    }
    if (destinationEnd <= start) continue;
    const raw = text.slice(start, destinationEnd).trim();
    const destination = raw.match(/^(\S+)/u)?.[1];
    if (destination) destinations.push(destination.replace(/\\([()])/gu, "$1"));
  }
  return destinations;
}

function extractAnswerCitations(
  answer: DocsAgentEvaluationAnswerResult,
  baseUrl?: string,
): string[] {
  const values = [...(answer.citations ?? [])];
  for (const destination of extractInlineMarkdownLinkDestinations(answer.text)) {
    const value = destination.trim();
    const explicitlyReferenced = /^[a-z][a-z\d+.-]*:/iu.test(value) || /^[\\/]{2}/u.test(value);
    let isHttpReference = false;
    if (explicitlyReferenced) {
      try {
        let parsedBase = new URL("https://docs.local");
        if (baseUrl) {
          try {
            const candidate = new URL(baseUrl);
            if (candidate.protocol === "http:" || candidate.protocol === "https:") {
              parsedBase = candidate;
            }
          } catch {
            // Keep the neutral parsing base so absolute citations retain their own origin.
          }
        }
        const parsed = new URL(value, parsedBase);
        isHttpReference = parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        // Malformed destinations are not citation evidence.
      }
    }
    if (value && (value.startsWith("/") || isHttpReference)) values.push(value);
  }
  return uniqueAnswerCitations(values, baseUrl);
}

function buildAnswerMetrics(
  task: DocsGoldenTask,
  answer: DocsAgentEvaluationAnswerResult | undefined,
  baseUrl?: string,
): DocsGoldenAnswerMetrics {
  const expectation = task.expect.answer;
  if (!expectation) {
    return {
      evidence: "answer",
      expected: false,
      provided: Boolean(answer),
      textIncludesMissing: [],
      textExcludesPresent: [],
      citations: answer ? extractAnswerCitations(answer, baseUrl) : [],
      requiredCitations: [],
      missingCitations: [],
      unexpectedCitations: [],
      forbiddenCitations: [],
      passed: true,
    };
  }

  const text = answer?.text ?? "";
  const citations = answer ? extractAnswerCitations(answer, baseUrl) : [];
  const requiredCitations = uniqueAnswerCitations(
    expectation.requiredCitations ?? task.expect.requiredCitations ?? task.expect.relevantSources,
    baseUrl,
  );
  const allowed = uniqueAnswerCitations(
    [
      ...task.expect.relevantSources,
      ...(task.expect.requiredCitations ?? []),
      ...(task.expect.allowedSources ?? []),
      ...requiredCitations,
      ...(expectation.allowedCitations ?? []),
    ],
    baseUrl,
  );
  const forbiddenExpected = uniqueAnswerCitations(
    [...(task.expect.forbiddenSources ?? []), ...(expectation.forbiddenCitations ?? [])],
    baseUrl,
  );
  const textIncludesMissing = (expectation.includes ?? []).filter(
    (fragment) => !text.includes(fragment),
  );
  const textExcludesPresent = (expectation.excludes ?? []).filter((fragment) =>
    text.includes(fragment),
  );
  const missingCitations = requiredCitations.filter(
    (expected) => !citations.some((citation) => answerCitationMatches(citation, expected)),
  );
  const unexpectedCitations = citations.filter(
    (citation) => !allowed.some((allowedSource) => answerCitationMatches(citation, allowedSource)),
  );
  const forbiddenCitations = citations.filter((citation) =>
    forbiddenExpected.some((forbidden) => answerCitationMatches(citation, forbidden)),
  );
  return {
    evidence: "answer",
    expected: true,
    provided: Boolean(answer),
    textIncludesMissing,
    textExcludesPresent,
    citations,
    requiredCitations,
    missingCitations,
    unexpectedCitations,
    forbiddenCitations,
    passed:
      Boolean(answer) &&
      textIncludesMissing.length === 0 &&
      textExcludesPresent.length === 0 &&
      missingCitations.length === 0 &&
      unexpectedCitations.length === 0 &&
      forbiddenCitations.length === 0,
  };
}

function normalizeAnswerResult(value: unknown): DocsAgentEvaluationAnswerResult {
  if (!isRecord(value) || typeof value.text !== "string" || !value.text.trim()) {
    throw new Error("The answer runner must return { text: string, citations?: string[] }.");
  }
  if (
    value.citations !== undefined &&
    (!Array.isArray(value.citations) ||
      value.citations.some((citation) => typeof citation !== "string" || !citation.trim()))
  ) {
    throw new Error("The answer runner citations field must contain only non-empty strings.");
  }
  return {
    text: value.text,
    citations: Array.isArray(value.citations) ? (value.citations as string[]) : undefined,
  };
}

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
  controller: AbortController,
): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        controller.abort();
        await reader.cancel().catch(() => undefined);
        throw new Error("The HTTP answer provider response exceeds the 1 MB limit.");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

async function runAnswerProvider(options: {
  provider: DocsAgentEvaluationAnswerProvider | unknown;
  input: DocsAgentEvaluationAnswerRequest;
  allowNetwork: boolean;
}): Promise<DocsAgentEvaluationAnswerResult> {
  if (!isRecord(options.provider)) {
    throw new Error("The answer provider must be a callback or HTTP provider object.");
  }
  const provider = options.provider.provider;
  if (provider !== "callback" && provider !== "http") {
    throw new Error('The answer provider must set provider to "callback" or "http".');
  }
  const timeoutValue = options.provider.timeoutMs;
  if (
    timeoutValue !== undefined &&
    (typeof timeoutValue !== "number" || !Number.isFinite(timeoutValue) || timeoutValue <= 0)
  ) {
    throw new Error("The answer provider timeoutMs must be a positive finite number.");
  }
  const timeoutMs = normalizePositiveInteger(
    typeof timeoutValue === "number" ? timeoutValue : undefined,
    30_000,
    300_000,
  );
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timeoutError: Error | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timeoutError = new Error(`The ${provider} answer provider timed out after ${timeoutMs}ms.`);
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });

  if (provider === "callback") {
    if (typeof options.provider.run !== "function") {
      if (timeout) clearTimeout(timeout);
      throw new Error("The callback answer provider requires a callable run function.");
    }
    try {
      const result = await Promise.race([
        Promise.resolve(options.provider.run({ ...options.input, signal: controller.signal })),
        timedOut,
      ]).catch((error: unknown) => {
        if (timeoutError) throw timeoutError;
        throw error;
      });
      return normalizeAnswerResult(result);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  if (!options.allowNetwork) {
    if (timeout) clearTimeout(timeout);
    throw new Error(
      "The HTTP answer provider requires agent.evaluations.allowNetwork: true for evaluation.",
    );
  }
  if (typeof options.provider.endpoint !== "string" || !options.provider.endpoint.trim()) {
    if (timeout) clearTimeout(timeout);
    throw new Error("The HTTP answer provider requires a non-empty endpoint.");
  }
  let endpoint: URL;
  try {
    endpoint = new URL(options.provider.endpoint);
  } catch {
    if (timeout) clearTimeout(timeout);
    throw new Error("The HTTP answer provider endpoint must be an absolute HTTP(S) URL.");
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    if (timeout) clearTimeout(timeout);
    throw new Error("The HTTP answer provider endpoint must use HTTP or HTTPS.");
  }
  const rawHeaders = options.provider.headers;
  if (
    rawHeaders !== undefined &&
    (!isRecord(rawHeaders) || Object.values(rawHeaders).some((value) => typeof value !== "string"))
  ) {
    if (timeout) clearTimeout(timeout);
    throw new Error("The HTTP answer provider headers must contain only string values.");
  }
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", ...rawHeaders },
          body: JSON.stringify(options.input),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`The HTTP answer provider returned ${response.status}.`);
        }
        const contentLength = Number(response.headers.get("content-length"));
        const maxResponseBytes = 1_000_000;
        if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
          throw new Error("The HTTP answer provider response exceeds the 1 MB limit.");
        }
        const responseText = await readResponseTextWithLimit(
          response,
          maxResponseBytes,
          controller,
        );
        let payload: unknown;
        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new Error("The HTTP answer provider must return valid JSON.");
        }
        return normalizeAnswerResult(payload);
      })(),
      timedOut,
    ]).catch((error: unknown) => {
      if (timeoutError) throw timeoutError;
      throw error;
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function buildSelectionMetrics(
  task: DocsGoldenTask,
  sources: readonly DocsMcpContextSource[],
  pagesByUrl: ReadonlyMap<string, DocsMcpPage>,
): DocsGoldenSelectionMetrics {
  const requestedFramework = task.filters?.framework;
  const requestedVersion = task.filters?.version;
  const requestedLocale = task.filters?.locale;
  const expectedFramework = task.expect.scope?.framework ?? requestedFramework;
  const expectedVersion = task.expect.scope?.version ?? requestedVersion;
  const expectedLocale = task.expect.scope?.locale ?? requestedLocale;
  const framework = expectedFramework ? normalizeAgentFramework(expectedFramework) : undefined;
  const locale = expectedLocale ? normalizeAgentLocale(expectedLocale) : undefined;
  const candidates = sources.map((source) => {
    const page = findPageForSource(pagesByUrl, source.pageUrl || source.url);
    const scope = page
      ? getPageScope(page)
      : {
          framework: normalizeAgentScopeValues(source.framework).map(normalizeAgentFramework),
          version: normalizeAgentScopeValues(source.version).map(normalizeAgentVersion),
          locale: normalizeAgentScopeValues(source.locale).map(normalizeAgentLocale),
          frameworkAmbiguous: false,
          versionAmbiguous: false,
        };
    return { source: canonicalizeSource(source.url), scope };
  });
  const firstFrameworkMatchRank = framework
    ? candidates.findIndex((candidate) => candidate.scope.framework.includes(framework)) + 1 || null
    : null;
  const firstVersionMatchRank = expectedVersion
    ? candidates.findIndex((candidate) =>
        candidate.scope.version.some((version) =>
          agentVersionConstraintMatches(expectedVersion, version),
        ),
      ) + 1 || null
    : null;
  const firstLocaleMatchRank = locale
    ? candidates.findIndex((candidate) => candidate.scope.locale.includes(locale)) + 1 || null
    : null;
  const conflictingSources = candidates
    .filter(
      (candidate) =>
        (framework &&
          candidate.scope.framework.length > 0 &&
          !candidate.scope.framework.includes(framework)) ||
        (expectedVersion &&
          candidate.scope.version.length > 0 &&
          !candidate.scope.version.some((version) =>
            agentVersionConstraintMatches(expectedVersion, version),
          )) ||
        (locale && candidate.scope.locale.length > 0 && !candidate.scope.locale.includes(locale)),
    )
    .map((candidate) => candidate.source);
  const ambiguousSources = candidates
    .filter(
      (candidate) =>
        candidate.scope.frameworkAmbiguous ||
        candidate.scope.versionAmbiguous ||
        Boolean(framework && candidate.scope.framework.length === 0) ||
        Boolean(expectedVersion && candidate.scope.version.length === 0) ||
        Boolean(locale && candidate.scope.locale.length === 0),
    )
    .map((candidate) => candidate.source);
  const frameworkPassed = !framework || firstFrameworkMatchRank !== null;
  const versionPassed = !expectedVersion || firstVersionMatchRank !== null;
  const localePassed = !locale || firstLocaleMatchRank !== null;
  return {
    requestedFramework,
    requestedVersion,
    requestedLocale,
    expectedFramework,
    expectedVersion,
    expectedLocale,
    firstFrameworkMatchRank,
    firstVersionMatchRank,
    firstLocaleMatchRank,
    conflictingSources,
    ambiguousSources,
    passed:
      frameworkPassed &&
      versionPassed &&
      localePassed &&
      conflictingSources.length === 0 &&
      ambiguousSources.length === 0,
  };
}

function buildUsageMetrics(
  task: DocsGoldenTask,
  tokenBudget: number,
  context: DocsMcpContextResult,
  relevantSources: readonly string[],
  attributionUtf8Bytes?: readonly number[],
  baseUrl?: string,
): DocsGoldenUsageMetrics {
  const usedUtf8Bytes = context.budget.usedUtf8Bytes;
  const rendered = extractRenderedCitations(context.context, context.sources);
  const blockUtf8Bytes =
    attributionUtf8Bytes ?? (rendered.layoutIntegrity ? rendered.blockUtf8Bytes : []);
  const usefulUtf8Bytes = context.sources.reduce(
    (total, source, index) =>
      relevantSources.some((expected) => sourceMatches(source.url, expected, baseUrl))
        ? total + (blockUtf8Bytes[index] ?? 0)
        : total,
    0,
  );
  const usefulByteRatio = usedUtf8Bytes > 0 ? usefulUtf8Bytes / usedUtf8Bytes : 0;
  const minimumUsefulRatio = clamp(task.expect.minUsefulByteRatio ?? 0, 0, 1);
  const withinBudget = usedUtf8Bytes <= tokenBudget;
  return {
    budgetUnit: "utf8-bytes",
    tokenBudget,
    usedUtf8Bytes,
    remainingUtf8Bytes: context.budget.remainingUtf8Bytes,
    estimatedTokens: Math.ceil(usedUtf8Bytes / 4),
    conservativeTokenUpperBound: usedUtf8Bytes,
    usefulUtf8Bytes,
    usefulByteRatio: round(usefulByteRatio),
    truncated: context.budget.truncated,
    withinBudget,
    passed: withinBudget && usefulByteRatio >= minimumUsefulRatio,
  };
}

function calculateTaskScore(report: {
  retrieval: DocsGoldenRetrievalMetrics;
  citations: DocsGoldenCitationMetrics;
  answer: DocsGoldenAnswerMetrics;
  selection: DocsGoldenSelectionMetrics;
  examples: DocsGoldenExampleMetrics;
  usage: DocsGoldenUsageMetrics;
  hasSelectionExpectation: boolean;
  hasExampleExpectation: boolean;
  hasAnswerExpectation: boolean;
}): number {
  const dimensions = [
    {
      weight: 30,
      score:
        report.retrieval.forbiddenSources.length > 0
          ? 0
          : (report.retrieval.recallAtK + report.retrieval.reciprocalRank) / 2,
    },
    {
      weight: 25,
      score: report.citations.integrity
        ? (report.citations.precision + report.citations.recall) / 2
        : 0,
    },
    ...(report.hasSelectionExpectation
      ? [{ weight: 20, score: report.selection.passed ? 1 : 0 }]
      : []),
    ...(report.hasAnswerExpectation ? [{ weight: 25, score: report.answer.passed ? 1 : 0 }] : []),
    ...(report.hasExampleExpectation
      ? [
          {
            weight: 15,
            score:
              report.examples.expected > 0 ? report.examples.matched / report.examples.expected : 1,
          },
        ]
      : []),
    {
      weight: 10,
      score: report.usage.passed ? 1 : 0,
    },
  ];
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  return round(
    (dimensions.reduce((sum, dimension) => sum + dimension.weight * dimension.score, 0) /
      totalWeight) *
      100,
  );
}

async function evaluateTask(
  pages: readonly DocsMcpPage[],
  task: DocsGoldenTask,
  configurationIssues: readonly string[] = [],
  runOptions: RunDocsGoldenTasksOptions = {},
): Promise<DocsGoldenTaskReport> {
  const topK = normalizePositiveInteger(task.topK, DEFAULT_TOP_K, 50);
  const tokenBudget = normalizePositiveInteger(task.tokenBudget, DEFAULT_TOKEN_BUDGET, 1_000_000);
  const relevantSources = uniqueCanonicalSources(task.expect.relevantSources, runOptions.baseUrl);
  const orderedPages = pages
    .slice()
    .sort((left, right) =>
      compareCodePoints(canonicalizeSource(left.url), canonicalizeSource(right.url)),
    );
  const pagesByUrl = new Map(orderedPages.map((page) => [sourcePage(page.url), page]));
  const requestedSurface = task.surface ?? runOptions.surface ?? "mcp-context";
  let surfaceResult: GoldenSurfaceResult;
  let surfaceError: string | undefined;
  if (configurationIssues.length > 0) {
    const empty = createContextShell({
      query: task.query,
      filters: task.filters,
      tokenBudget,
    });
    surfaceResult = {
      surface:
        requestedSurface === "configured-search" || requestedSurface === "ask-ai-context"
          ? requestedSurface
          : "mcp-context",
      provider: "unavailable",
      rankedContext: empty,
      budgetedContext: empty,
      citationEvidence: { mode: "context", actual: [], integrity: false },
    };
  } else
    try {
      if (
        requestedSurface !== "mcp-context" &&
        requestedSurface !== "configured-search" &&
        requestedSurface !== "ask-ai-context"
      ) {
        throw new Error(`Unknown evaluation surface: ${String(requestedSurface)}.`);
      }
      surfaceResult = await buildGoldenSurface({
        pages: orderedPages,
        task,
        topK,
        tokenBudget,
        runOptions,
      });
    } catch (error) {
      surfaceError = error instanceof Error ? error.message : String(error);
      const empty = createContextShell({
        query: task.query,
        filters: task.filters,
        tokenBudget,
      });
      surfaceResult = {
        surface:
          requestedSurface === "configured-search" || requestedSurface === "ask-ai-context"
            ? requestedSurface
            : "mcp-context",
        provider: "unavailable",
        rankedContext: empty,
        budgetedContext: empty,
        citationEvidence: { mode: "context", actual: [], integrity: false },
      };
    }
  const { rankedContext, budgetedContext } = surfaceResult;
  const rankedSources = toGoldenSources(rankedContext.sources, relevantSources, runOptions.baseUrl);
  const budgetedSources = toGoldenSources(
    budgetedContext.sources,
    relevantSources,
    runOptions.baseUrl,
  );
  const budgetedCandidates = toContextCandidates(budgetedContext.sources, pagesByUrl);
  const retrieval = buildRetrievalMetrics(task, rankedSources, topK, runOptions.baseUrl);
  const citationSources =
    surfaceResult.citationEvidence.mode === "results"
      ? rankedContext.sources
      : budgetedContext.sources;
  const citations = buildCitationMetrics(
    task,
    budgetedContext.context,
    citationSources,
    surfaceResult.citationEvidence,
    runOptions.baseUrl,
  );
  const selection = buildSelectionMetrics(task, rankedContext.sources, pagesByUrl);
  const examples = await evaluateExamples(
    task.expect.examples ?? [],
    budgetedCandidates,
    runOptions,
  );
  const usage = buildUsageMetrics(
    task,
    tokenBudget,
    budgetedContext,
    relevantSources,
    surfaceResult.attributionUtf8Bytes,
    runOptions.baseUrl,
  );
  const issues = configurationIssues.map((issue) => `Invalid golden task configuration: ${issue}`);
  if (surfaceError) issues.push(`Evaluation surface failed: ${surfaceError}`);

  let answerResult: DocsAgentEvaluationAnswerResult | undefined;
  let answerError: string | undefined;
  if (
    configurationIssues.length === 0 &&
    !surfaceError &&
    task.expect.answer &&
    runOptions.answer
  ) {
    try {
      answerResult = await runAnswerProvider({
        provider: runOptions.answer,
        allowNetwork: runOptions.allowNetwork === true,
        input: {
          task: {
            id: task.id,
            query: task.query,
            filters: task.filters,
          },
          surface: surfaceResult.surface,
          context: budgetedContext.context,
          sources: budgetedContext.sources.map((source) => ({
            url: source.url,
            title: source.title,
            framework: source.framework,
            version: source.version,
            locale: source.locale,
          })),
        },
      });
    } catch (error) {
      answerError = error instanceof Error ? error.message : String(error);
      issues.push(`Answer evaluation failed: ${answerError}`);
    }
  }
  const answer = buildAnswerMetrics(task, answerResult, runOptions.baseUrl);
  if (relevantSources.length === 0) issues.push("No relevantSources are configured for this task.");
  if (!retrieval.passed)
    issues.push("Retrieval did not satisfy the expected recall, rank, or exclusion rules.");
  if (!citations.passed)
    issues.push(
      `${citations.evidence === "results" ? "Search-result" : "Context"} citations are missing, unexpected, or do not match source records.`,
    );
  if (task.expect.answer && !runOptions.answer) {
    issues.push("Answer expectations require agent.evaluations.answer to be configured.");
  }
  if (!answer.passed)
    issues.push(
      "The actual answer is missing required text/citations or contains invalid evidence.",
    );
  if (!selection.passed)
    issues.push(
      "Retrieved sources are ambiguous or do not explicitly match the expected framework/version/locale.",
    );
  if (!examples.passed)
    issues.push("One or more expected examples did not meet the requested verification level.");
  if (!usage.passed)
    issues.push("Context exceeded its budget or did not meet the configured useful-byte ratio.");
  const passed =
    configurationIssues.length === 0 &&
    !surfaceError &&
    !answerError &&
    relevantSources.length > 0 &&
    retrieval.passed &&
    citations.passed &&
    answer.passed &&
    selection.passed &&
    examples.passed &&
    usage.passed;
  const calculatedScore =
    configurationIssues.length > 0
      ? 0
      : calculateTaskScore({
          retrieval,
          citations,
          answer,
          selection,
          examples,
          usage,
          hasSelectionExpectation: Boolean(
            task.expect.scope?.framework ||
            task.expect.scope?.version ||
            task.expect.scope?.locale ||
            task.filters?.framework ||
            task.filters?.version ||
            task.filters?.locale,
          ),
          hasExampleExpectation: (task.expect.examples?.length ?? 0) > 0,
          hasAnswerExpectation: Boolean(task.expect.answer),
        });
  const score = passed ? calculatedScore : Math.min(calculatedScore, 99);
  return {
    id: task.id,
    query: task.query,
    surface: surfaceResult.surface,
    provider: surfaceResult.provider,
    status: passed ? "passed" : "failed",
    passed,
    score,
    context: budgetedContext.context,
    sources: budgetedSources,
    retrieval,
    citations,
    answer,
    selection,
    examples,
    usage,
    issues,
  };
}

/**
 * Run offline-by-default golden-task evaluations against MCP-ready docs pages.
 * Configured external retrieval, HTTP answers, and runtime execution require explicit opt-in.
 * An empty task list is intentionally unmeasured so CI cannot turn absent coverage into a pass.
 */
export async function runDocsGoldenTasks(
  pages: readonly DocsMcpPage[],
  tasks: readonly DocsGoldenTask[] | undefined,
  options: RunDocsGoldenTasksOptions = {},
): Promise<DocsGoldenTasksReport> {
  const runtimeTasks: unknown = tasks;
  if (runtimeTasks === undefined || (Array.isArray(runtimeTasks) && runtimeTasks.length === 0)) {
    return {
      status: "unmeasured",
      passed: null,
      score: null,
      taskCount: 0,
      passedTaskCount: 0,
      failedTaskCount: 0,
      tasks: [],
    };
  }

  const normalizedTasks = Array.isArray(runtimeTasks)
    ? runtimeTasks.map((task, index) => normalizeGoldenTaskInput(task, index))
    : [normalizeGoldenTaskInput(runtimeTasks, 0, ["agent.evaluations.tasks must be an array."])];
  const idCounts = normalizedTasks.reduce((counts, input) => {
    counts.set(input.task.id, (counts.get(input.task.id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  for (const input of normalizedTasks) {
    if ((idCounts.get(input.task.id) ?? 0) > 1) {
      input.issues.push(`task id ${JSON.stringify(input.task.id)} is duplicated.`);
    }
  }
  const reports = await Promise.all(
    normalizedTasks.map(({ task, issues }) => evaluateTask(pages, task, issues, options)),
  );
  const passedTaskCount = reports.filter((task) => task.passed).length;
  const failedTaskCount = reports.length - passedTaskCount;
  return {
    status: failedTaskCount === 0 ? "passed" : "failed",
    passed: failedTaskCount === 0,
    score: round(reports.reduce((sum, task) => sum + task.score, 0) / reports.length),
    taskCount: reports.length,
    passedTaskCount,
    failedTaskCount,
    tasks: reports,
  };
}

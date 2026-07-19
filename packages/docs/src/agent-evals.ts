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
  type DocsCodeBlockExecutionPlan,
  type DocsCodeBlockTarget,
} from "./code-blocks.js";
import {
  buildDocsMcpContext,
  type DocsMcpContextResult,
  type DocsMcpContextSource,
  type DocsMcpPage,
} from "./mcp.js";
import type {
  DocsAgentGoldenExpectedExample,
  DocsAgentGoldenTask,
  DocsAgentGoldenTaskExpectation,
  DocsAgentGoldenTaskFilters,
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
  firstFrameworkMatchRank: number | null;
  firstVersionMatchRank: number | null;
  conflictingSources: string[];
  ambiguousSources: string[];
  passed: boolean;
}

export interface DocsGoldenExampleResult {
  expected: DocsGoldenExpectedExample;
  matchedId?: string;
  source?: string;
  executable: boolean;
  passed: boolean;
}

export interface DocsGoldenExampleMetrics {
  expected: number;
  matched: number;
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

export interface DocsGoldenTaskReport {
  id: string;
  query: string;
  status: "passed" | "failed";
  passed: boolean;
  score: number;
  context: string;
  sources: DocsGoldenRetrievedSource[];
  retrieval: DocsGoldenRetrievalMetrics;
  citations: DocsGoldenCitationMetrics;
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
  executable: boolean;
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
    return [{ source, language, framework, packageManager, title, runnable, includes }];
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
      expect: {
        relevantSources,
        allowedSources,
        forbiddenSources,
        requiredCitations,
        minRecallAtK,
        maxFirstRelevantRank,
        minUsefulByteRatio,
        examples,
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

function canonicalizeSource(value: string): string {
  let pathname: string;
  let hash: string;

  try {
    const parsed = new URL(value, "https://docs.local");
    pathname = parsed.pathname;
    hash = parsed.hash;
  } catch {
    const [pathAndQuery = "/", fragment = ""] = value.split("#", 2);
    pathname = pathAndQuery.split("?", 1)[0] || "/";
    hash = fragment ? `#${fragment}` : "";
  }

  pathname = pathname.replace(/\/{2,}/gu, "/").replace(/\.md$/iu, "");
  if (pathname !== "/") pathname = pathname.replace(/\/+$/gu, "");
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  const normalizedHash = hash
    ? `#${safeDecode(hash.slice(1)).trim().replace(/^#+/u, "").toLowerCase()}`
    : "";
  return `${pathname || "/"}${normalizedHash === "#" ? "" : normalizedHash}`;
}

function sourcePage(value: string): string {
  return canonicalizeSource(value).split("#", 1)[0] ?? "/";
}

function sourceMatches(actual: string, expected: string): boolean {
  const canonicalActual = canonicalizeSource(actual);
  const canonicalExpected = canonicalizeSource(expected);
  return canonicalExpected.includes("#")
    ? canonicalActual === canonicalExpected
    : sourcePage(canonicalActual) === sourcePage(canonicalExpected);
}

function uniqueCanonicalSources(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(canonicalizeSource)));
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
): DocsGoldenRetrievedSource[] {
  return sources.map((source, index) => ({
    rank: index + 1,
    url: canonicalizeSource(source.url),
    title: source.section ?? source.title,
    framework: source.framework,
    version: source.version,
    utf8Bytes: source.utf8Bytes,
    relevant: relevantSources.some((expected) => sourceMatches(source.url, expected)),
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
    actual.push(...sourceLines.map(canonicalizeSource));
    cursor = contentStart + contentMarker.length;
    blockUtf8Bytes.push(Buffer.byteLength(context.slice(attributableStart, cursor), "utf8"));
  }

  if (cursor !== context.length) layoutIntegrity = false;
  return { actual, layoutIntegrity, blockUtf8Bytes };
}

function hasValidStaticSyntax(target: DocsCodeBlockTarget): boolean {
  const language = target.language?.toLowerCase();
  if (language === "json") {
    try {
      JSON.parse(target.code);
      return true;
    } catch {
      return false;
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
      return !/\bexports\.__JITI_ERROR__\s*=/u.test(transformed);
    } catch {
      return false;
    }
  }
  return true;
}

function isStaticExecutable(
  target: DocsCodeBlockTarget,
  plan: DocsCodeBlockExecutionPlan | undefined,
): boolean {
  const language = target.language?.toLowerCase();
  if (!target.runnable || !language || !EXECUTABLE_LANGUAGES.has(language)) return false;
  if (!plan || plan.action === "skip") return false;
  if (!target.code.trim()) return false;
  if (target.code.split("\n").some((line) => /^\s*(?:(?:\/\/|#)\s*)?\.\.\.\s*$/u.test(line))) {
    return false;
  }
  return hasValidStaticSyntax(target);
}

async function collectRetrievedExamples(
  candidates: readonly ContextCandidate[],
): Promise<RetrievedExample[]> {
  const examples: Array<Omit<RetrievedExample, "executable">> = [];
  for (const candidate of candidates) {
    const targets = extractCodeBlocksFromMarkdown({
      source: candidate.content,
      filePath: candidate.page.sourcePath ?? candidate.page.slug,
      relativePath: candidate.page.slug,
    });
    for (const target of targets) {
      examples.push({
        source: candidate.source,
        target,
      });
    }
  }
  const plans = await planCodeBlockTargets(
    examples.map((example) => example.target),
    STATIC_CODE_PLAN_CONFIG,
  );
  return examples.map((example, index) => ({
    ...example,
    executable: isStaticExecutable(example.target, plans[index]),
  }));
}

function normalizedEqual(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function exampleMatches(expected: DocsGoldenExpectedExample, actual: RetrievedExample): boolean {
  if (expected.source && !sourceMatches(actual.source, expected.source)) return false;
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
  return actual.executable;
}

async function evaluateExamples(
  expectedExamples: readonly DocsGoldenExpectedExample[],
  candidates: readonly ContextCandidate[],
): Promise<DocsGoldenExampleMetrics> {
  const actualExamples = await collectRetrievedExamples(candidates);
  const claimed = new Set<number>();
  const results = expectedExamples.map((expected): DocsGoldenExampleResult => {
    const index = actualExamples.findIndex(
      (example, candidateIndex) =>
        !claimed.has(candidateIndex) && exampleMatches(expected, example),
    );
    if (index < 0) return { expected, executable: false, passed: false };
    claimed.add(index);
    const matched = actualExamples[index];
    return {
      expected,
      matchedId: matched.target.id,
      source: matched.source,
      executable: matched.executable,
      passed: true,
    };
  });
  const matched = results.filter((result) => result.passed).length;
  return {
    expected: expectedExamples.length,
    matched,
    executable: results.filter((result) => result.executable).length,
    results,
    passed: matched === expectedExamples.length,
  };
}

function buildRetrievalMetrics(
  task: DocsGoldenTask,
  sources: readonly DocsGoldenRetrievedSource[],
  topK: number,
): DocsGoldenRetrievalMetrics {
  const expected = uniqueCanonicalSources(task.expect.relevantSources);
  const forbidden = uniqueCanonicalSources(task.expect.forbiddenSources ?? []);
  const retrievedRelevant = expected.filter((source) =>
    sources.some((actual) => sourceMatches(actual.url, source)),
  ).length;
  const recallAtK = expected.length > 0 ? retrievedRelevant / expected.length : 0;
  const firstRelevant = sources.find((source) => source.relevant)?.rank ?? null;
  const forbiddenSources = sources
    .filter((source) =>
      forbidden.some((forbiddenSource) => sourceMatches(source.url, forbiddenSource)),
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
): DocsGoldenCitationMetrics {
  const expected = uniqueCanonicalSources(
    task.expect.requiredCitations ?? task.expect.relevantSources,
  );
  const allowed = uniqueCanonicalSources([
    ...task.expect.relevantSources,
    ...(task.expect.requiredCitations ?? []),
    ...(task.expect.allowedSources ?? []),
  ]);
  const extracted = extractRenderedCitations(context, sources);
  const actual = extracted.actual;
  const sourceRecords = sources.map((source) => canonicalizeSource(source.url));
  const missing = expected.filter(
    (expectedSource) => !actual.some((actualSource) => sourceMatches(actualSource, expectedSource)),
  );
  const unexpected = actual.filter(
    (actualSource) => !allowed.some((allowedSource) => sourceMatches(actualSource, allowedSource)),
  );
  const correct = actual.filter((actualSource) =>
    allowed.some((allowedSource) => sourceMatches(actualSource, allowedSource)),
  ).length;
  const matchedExpected = expected.filter((expectedSource) =>
    actual.some((actualSource) => sourceMatches(actualSource, expectedSource)),
  ).length;
  const precision = actual.length > 0 ? correct / actual.length : expected.length === 0 ? 1 : 0;
  const recall = expected.length > 0 ? matchedExpected / expected.length : 1;
  const integrity =
    extracted.layoutIntegrity &&
    actual.length === sourceRecords.length &&
    actual.every((source, index) => source === sourceRecords[index]);
  return {
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

function buildSelectionMetrics(
  filters: DocsGoldenTaskFilters | undefined,
  candidates: readonly ContextCandidate[],
): DocsGoldenSelectionMetrics {
  const requestedFramework = filters?.framework;
  const requestedVersion = filters?.version;
  const framework = requestedFramework ? normalizeAgentFramework(requestedFramework) : undefined;
  const firstFrameworkMatchRank = framework
    ? candidates.findIndex((candidate) => candidate.scope.framework.includes(framework)) + 1 || null
    : null;
  const firstVersionMatchRank = requestedVersion
    ? candidates.findIndex((candidate) =>
        candidate.scope.version.some((version) =>
          agentVersionConstraintMatches(requestedVersion, version),
        ),
      ) + 1 || null
    : null;
  const conflictingSources = candidates
    .filter(
      (candidate) =>
        (framework &&
          candidate.scope.framework.length > 0 &&
          !candidate.scope.framework.includes(framework)) ||
        (requestedVersion &&
          candidate.scope.version.length > 0 &&
          !candidate.scope.version.some((version) =>
            agentVersionConstraintMatches(requestedVersion, version),
          )),
    )
    .map((candidate) => candidate.source);
  const ambiguousSources = candidates
    .filter(
      (candidate) =>
        candidate.scope.frameworkAmbiguous ||
        candidate.scope.versionAmbiguous ||
        Boolean(framework && candidate.scope.framework.length === 0) ||
        Boolean(requestedVersion && candidate.scope.version.length === 0),
    )
    .map((candidate) => candidate.source);
  const frameworkPassed = !framework || firstFrameworkMatchRank !== null;
  const versionPassed = !requestedVersion || firstVersionMatchRank !== null;
  return {
    requestedFramework,
    requestedVersion,
    firstFrameworkMatchRank,
    firstVersionMatchRank,
    conflictingSources,
    ambiguousSources,
    passed:
      frameworkPassed &&
      versionPassed &&
      conflictingSources.length === 0 &&
      ambiguousSources.length === 0,
  };
}

function buildUsageMetrics(
  task: DocsGoldenTask,
  tokenBudget: number,
  context: DocsMcpContextResult,
  relevantSources: readonly string[],
): DocsGoldenUsageMetrics {
  const usedUtf8Bytes = context.budget.usedUtf8Bytes;
  const rendered = extractRenderedCitations(context.context, context.sources);
  const usefulUtf8Bytes = context.sources.reduce(
    (total, source, index) =>
      relevantSources.some((expected) => sourceMatches(source.url, expected))
        ? total + (rendered.blockUtf8Bytes[index] ?? 0)
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
  selection: DocsGoldenSelectionMetrics;
  examples: DocsGoldenExampleMetrics;
  usage: DocsGoldenUsageMetrics;
  hasSelectionExpectation: boolean;
  hasExampleExpectation: boolean;
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
): Promise<DocsGoldenTaskReport> {
  const topK = normalizePositiveInteger(task.topK, DEFAULT_TOP_K, 50);
  const tokenBudget = normalizePositiveInteger(task.tokenBudget, DEFAULT_TOKEN_BUDGET, 1_000_000);
  const relevantSources = uniqueCanonicalSources(task.expect.relevantSources);
  const orderedPages = pages
    .slice()
    .sort((left, right) =>
      compareCodePoints(canonicalizeSource(left.url), canonicalizeSource(right.url)),
    );
  const pagesByUrl = new Map(orderedPages.map((page) => [sourcePage(page.url), page]));
  const contextOptions = {
    pages: orderedPages,
    query: task.query,
    framework: task.filters?.framework,
    version: task.filters?.version,
    locale: task.filters?.locale,
    maxResults: topK,
  };
  const [rankedContext, budgetedContext] = await Promise.all([
    buildDocsMcpContext({ ...contextOptions, tokenBudget: Number.MAX_SAFE_INTEGER }),
    buildDocsMcpContext({ ...contextOptions, tokenBudget }),
  ]);
  const rankedSources = toGoldenSources(rankedContext.sources, relevantSources);
  const budgetedSources = toGoldenSources(budgetedContext.sources, relevantSources);
  const rankedCandidates = toContextCandidates(rankedContext.sources, pagesByUrl);
  const budgetedCandidates = toContextCandidates(budgetedContext.sources, pagesByUrl);
  const retrieval = buildRetrievalMetrics(task, rankedSources, topK);
  const citations = buildCitationMetrics(task, budgetedContext.context, budgetedContext.sources);
  const selection = buildSelectionMetrics(task.filters, rankedCandidates);
  const examples = await evaluateExamples(task.expect.examples ?? [], budgetedCandidates);
  const usage = buildUsageMetrics(task, tokenBudget, budgetedContext, relevantSources);
  const issues = configurationIssues.map((issue) => `Invalid golden task configuration: ${issue}`);
  if (relevantSources.length === 0) issues.push("No relevantSources are configured for this task.");
  if (!retrieval.passed)
    issues.push("Retrieval did not satisfy the expected recall, rank, or exclusion rules.");
  if (!citations.passed)
    issues.push("Rendered citations are missing, unexpected, or do not match source records.");
  if (!selection.passed)
    issues.push(
      "Retrieved context is ambiguous or does not explicitly match the requested framework/version.",
    );
  if (!examples.passed)
    issues.push("One or more expected runnable examples were not retrieved or are not executable.");
  if (!usage.passed)
    issues.push("Context exceeded its budget or did not meet the configured useful-byte ratio.");
  const passed =
    configurationIssues.length === 0 &&
    relevantSources.length > 0 &&
    retrieval.passed &&
    citations.passed &&
    selection.passed &&
    examples.passed &&
    usage.passed;
  const calculatedScore =
    configurationIssues.length > 0
      ? 0
      : calculateTaskScore({
          retrieval,
          citations,
          selection,
          examples,
          usage,
          hasSelectionExpectation: Boolean(task.filters?.framework || task.filters?.version),
          hasExampleExpectation: (task.expect.examples?.length ?? 0) > 0,
        });
  const score = passed ? calculatedScore : Math.min(calculatedScore, 99);
  return {
    id: task.id,
    query: task.query,
    status: passed ? "passed" : "failed",
    passed,
    score,
    context: budgetedContext.context,
    sources: budgetedSources,
    retrieval,
    citations,
    selection,
    examples,
    usage,
    issues,
  };
}

/**
 * Run deterministic, offline golden-task evaluations against MCP-ready docs pages.
 * An empty task list is intentionally unmeasured so CI cannot turn absent coverage into a pass.
 */
export async function runDocsGoldenTasks(
  pages: readonly DocsMcpPage[],
  tasks: readonly DocsGoldenTask[] | undefined,
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
    normalizedTasks.map(({ task, issues }) => evaluateTask(pages, task, issues)),
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

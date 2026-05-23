import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import type {
  DocsConfig,
  DocsReviewCiMode,
  DocsReviewConfig,
  DocsReviewRulesConfig,
  DocsReviewScoreConfig,
  DocsReviewSeverity,
} from "./types.js";

export const DEFAULT_DOCS_REVIEW_WORKFLOW_PATH = ".github/workflows/docs-review.yml";
export const DEFAULT_DOCS_REVIEW_REUSABLE_WORKFLOW_PATH =
  ".github/workflows/docs-review-reusable.yml";
export const DEFAULT_DOCS_REVIEW_REUSABLE_WORKFLOW =
  "farming-labs/docs/.github/workflows/docs-review-reusable.yml@main";
export const LOCAL_DOCS_REVIEW_REUSABLE_WORKFLOW = "./.github/workflows/docs-review-reusable.yml";
export const DEFAULT_DOCS_REVIEW_SCORE_THRESHOLD = 80;
export const DEFAULT_DOCS_REVIEW_CI_NAME = "docs-review";

export interface ResolvedDocsReviewConfig {
  enabled: boolean;
  ci: {
    enabled: boolean;
    name: string;
    mode: DocsReviewCiMode;
    annotations: boolean;
    comment: boolean;
  };
  score: {
    threshold: number;
    weights: {
      error: number;
      warn: number;
      suggestion: number;
    };
  };
  rules: Required<DocsReviewRulesConfig>;
}

export interface DocsReviewWorkflowOptions {
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  ciName?: string;
  reusableWorkflow?: string;
  projectDir?: string;
  configPath?: string;
  buildCommand?: string;
  reviewCommand?: string;
  pathFilters?: string[];
}

export interface EnsureDocsReviewWorkflowOptions {
  rootDir: string;
  config?: DocsConfig;
  configPath?: string;
  configContent?: string;
  workflowPath?: string;
  log?: (message: string) => void;
}

export type EnsureDocsReviewWorkflowResult =
  | { status: "created"; path: string; relativePath: string }
  | { status: "exists"; path: string; relativePath: string }
  | { status: "disabled"; path: string; relativePath: string };

const DEFAULT_REVIEW_RULES: Required<DocsReviewRulesConfig> = {
  brokenLinks: "error",
  frontmatter: "error",
  duplicateSlugs: "error",
  invalidMdx: "error",
  configExamples: "warn",
  codeFenceMetadata: "warn",
  runnableMetadata: "warn",
  agentContext: "suggestion",
};

const DEFAULT_REVIEW_WEIGHTS = {
  error: 20,
  warn: 8,
  suggestion: 2,
};

const REVIEW_SEVERITIES = new Set<DocsReviewSeverity>(["off", "suggestion", "warn", "error"]);
const REVIEW_CI_MODES = new Set<DocsReviewCiMode>(["off", "warn", "block"]);
const FILE_EXTS = ["tsx", "ts", "jsx", "js"];

export function resolveDocsReviewConfig(
  review?: boolean | DocsReviewConfig,
): ResolvedDocsReviewConfig {
  if (review === false) {
    return {
      enabled: false,
      ci: {
        enabled: false,
        name: DEFAULT_DOCS_REVIEW_CI_NAME,
        mode: "off",
        annotations: false,
        comment: false,
      },
      score: { threshold: DEFAULT_DOCS_REVIEW_SCORE_THRESHOLD, weights: DEFAULT_REVIEW_WEIGHTS },
      rules: DEFAULT_REVIEW_RULES,
    };
  }

  const objectConfig = review && typeof review === "object" ? review : {};
  const ciConfig = objectConfig.ci;
  const ciObject = ciConfig && typeof ciConfig === "object" ? ciConfig : {};
  const configuredMode = ciObject.mode;
  const mode =
    configuredMode && REVIEW_CI_MODES.has(configuredMode) ? configuredMode : ("warn" as const);
  const enabled = objectConfig.enabled !== false;
  const ciEnabled = enabled && ciConfig !== false && ciObject.enabled !== false && mode !== "off";

  return {
    enabled,
    ci: {
      enabled: ciEnabled,
      name: normalizeCiName(ciObject.name),
      mode: ciEnabled ? mode : "off",
      annotations: ciObject.annotations !== false,
      comment: ciObject.comment !== false,
    },
    score: {
      threshold: clampScoreThreshold(objectConfig.score?.threshold),
      weights: {
        error: normalizeWeight(objectConfig.score?.weights?.error, DEFAULT_REVIEW_WEIGHTS.error),
        warn: normalizeWeight(objectConfig.score?.weights?.warn, DEFAULT_REVIEW_WEIGHTS.warn),
        suggestion: normalizeWeight(
          objectConfig.score?.weights?.suggestion,
          DEFAULT_REVIEW_WEIGHTS.suggestion,
        ),
      },
    },
    rules: {
      ...DEFAULT_REVIEW_RULES,
      ...normalizeRules(objectConfig.rules),
    },
  };
}

export function buildDocsReviewWorkflow(options: DocsReviewWorkflowOptions = {}): string {
  const packageManager = options.packageManager ?? "npm";
  const ciName = normalizeCiName(options.ciName);
  const projectDir = normalizeProjectDir(options.projectDir);
  const configPath = options.configPath ?? "docs.config.ts";
  const reusableWorkflow = options.reusableWorkflow ?? DEFAULT_DOCS_REVIEW_REUSABLE_WORKFLOW;
  const filters = normalizePathFilters(options.pathFilters);
  const optionalInputs = [
    options.buildCommand ? ["build-command", options.buildCommand] : undefined,
    options.reviewCommand ? ["review-command", options.reviewCommand] : undefined,
  ]
    .filter((input): input is string[] => Boolean(input))
    .map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`)
    .join("\n");

  return `# Generated by @farming-labs/docs. You can edit this file.
name: Docs Review

on:
  pull_request:
    paths:
${filters.map((filter) => `      - ${JSON.stringify(filter)}`).join("\n")}

permissions:
  contents: read
  checks: write
  pull-requests: write

jobs:
  docs-review:
    name: ${JSON.stringify(ciName)}
    uses: ${reusableWorkflow}
    with:
      check-name: ${JSON.stringify(ciName)}
      config: ${JSON.stringify(configPath)}
      working-directory: ${JSON.stringify(projectDir)}
      package-manager: ${JSON.stringify(packageManager)}
${optionalInputs ? `${optionalInputs}\n` : ""}    permissions:
      contents: read
      checks: write
      pull-requests: write
`;
}

export function ensureDocsReviewWorkflow(
  options: EnsureDocsReviewWorkflowOptions,
): EnsureDocsReviewWorkflowResult {
  const rootDir = options.rootDir;
  const repoRoot = findGitRoot(rootDir) ?? rootDir;
  const workflowRelativePath = options.workflowPath ?? DEFAULT_DOCS_REVIEW_WORKFLOW_PATH;
  const workflowPath = isAbsolute(workflowRelativePath)
    ? workflowRelativePath
    : join(repoRoot, workflowRelativePath);
  const resultRelativePath = toPosixPath(relative(repoRoot, workflowPath));
  const reviewInput =
    options.config?.review ??
    readDocsReviewConfigFromSource(options.configContent ?? readConfig(rootDir));
  const review = resolveDocsReviewConfig(reviewInput);

  if (!review.enabled || !review.ci.enabled) {
    return { status: "disabled", path: workflowPath, relativePath: resultRelativePath };
  }

  if (existsSync(workflowPath)) {
    return { status: "exists", path: workflowPath, relativePath: resultRelativePath };
  }

  const configPath = options.configPath ?? findDocsConfigPath(rootDir);
  const configContent = options.configContent ?? readConfig(rootDir, configPath);
  const projectDir = toPosixPath(relative(repoRoot, rootDir)) || ".";
  const packageManager = detectPackageManager(repoRoot);
  const workflow = buildDocsReviewWorkflow({
    packageManager,
    ciName: review.ci.name,
    reusableWorkflow: hasLocalDocsWorkspacePackage(repoRoot)
      ? LOCAL_DOCS_REVIEW_REUSABLE_WORKFLOW
      : DEFAULT_DOCS_REVIEW_REUSABLE_WORKFLOW,
    projectDir,
    configPath,
    buildCommand: detectLocalDocsCliBuildCommand(repoRoot, packageManager),
    reviewCommand: detectLocalDocsCliReviewCommand(repoRoot, rootDir),
    pathFilters: buildDocsReviewWorkflowPathFilters({
      rootDir,
      repoRoot,
      config: options.config,
      configPath,
      configContent,
    }),
  });

  mkdirSync(dirname(workflowPath), { recursive: true });
  writeFileSync(workflowPath, workflow, "utf-8");
  options.log?.(`[docs] Created ${resultRelativePath} for Docs Review CI.`);

  return { status: "created", path: workflowPath, relativePath: resultRelativePath };
}

export function readDocsReviewConfigFromSource(
  content?: string,
): boolean | DocsReviewConfig | undefined {
  if (!content) return undefined;

  const rootObject = extractRootObjectLiteral(content) ?? content;
  const reviewCursor = findTopLevelPropertyValueIndex(rootObject, "review");
  if (reviewCursor === undefined) return undefined;

  if (rootObject.startsWith("true", reviewCursor)) return true;
  if (rootObject.startsWith("false", reviewCursor)) return false;
  if (rootObject[reviewCursor] !== "{") return undefined;

  const reviewEnd = findMatchingObjectEnd(rootObject, reviewCursor);
  if (reviewEnd === undefined) return undefined;

  const reviewBlock = rootObject.slice(reviewCursor + 1, reviewEnd);
  const scoreBlock = extractTopLevelObjectLiteral(reviewBlock, "score");
  const ciCursor = findTopLevelPropertyValueIndex(reviewBlock, "ci");
  const rulesBlock = extractTopLevelObjectLiteral(reviewBlock, "rules");
  const ci =
    ciCursor === undefined
      ? undefined
      : reviewBlock.startsWith("true", ciCursor)
        ? true
        : reviewBlock.startsWith("false", ciCursor)
          ? false
          : reviewBlock[ciCursor] === "{"
            ? readReviewCiObject(reviewBlock, ciCursor)
            : undefined;

  return {
    enabled: readTopLevelBoolean(reviewBlock, "enabled"),
    score: scoreBlock
      ? {
          threshold: readTopLevelNumber(scoreBlock, "threshold"),
          weights: readReviewWeights(scoreBlock),
        }
      : undefined,
    ci,
    rules: rulesBlock ? readReviewRules(rulesBlock) : undefined,
  };
}

export function buildDocsReviewWorkflowPathFilters(options: {
  rootDir: string;
  repoRoot?: string;
  config?: DocsConfig;
  configPath?: string;
  configContent?: string;
}): string[] {
  const repoRoot = options.repoRoot ?? findGitRoot(options.rootDir) ?? options.rootDir;
  const configPath = options.configPath ?? findDocsConfigPath(options.rootDir);
  const configContent = options.configContent ?? readConfig(options.rootDir, configPath);
  const entry = options.config?.entry ?? readTopLevelString(configContent, "entry") ?? "docs";
  const contentDir = options.config?.contentDir ?? readTopLevelString(configContent, "contentDir");
  const projectDir = toPosixPath(relative(repoRoot, options.rootDir));
  const projectPrefix = projectDir && projectDir !== "." ? `${projectDir}/` : "";
  const candidates = [
    prefixPath(projectPrefix, configPath),
    prefixPath(projectPrefix, `${entry}/**`),
    prefixPath(projectPrefix, `app/${entry}/**`),
    prefixPath(projectPrefix, `src/app/${entry}/**`),
    contentDir ? prefixPath(projectPrefix, `${trimSlashes(contentDir)}/**`) : undefined,
    prefixPath(projectPrefix, "content/docs/**"),
    prefixPath(projectPrefix, "src/content/docs/**"),
    prefixPath(projectPrefix, "src/lib/docs.config.*"),
    DEFAULT_DOCS_REVIEW_WORKFLOW_PATH,
    DEFAULT_DOCS_REVIEW_REUSABLE_WORKFLOW_PATH,
  ];

  return Array.from(
    new Set(candidates.filter((candidate): candidate is string => Boolean(candidate))),
  );
}

function normalizeRules(rules?: DocsReviewRulesConfig): Partial<DocsReviewRulesConfig> {
  if (!rules) return {};

  return Object.fromEntries(
    Object.entries(rules).filter(
      (entry): entry is [keyof DocsReviewRulesConfig, DocsReviewSeverity] =>
        REVIEW_SEVERITIES.has(entry[1] as DocsReviewSeverity),
    ),
  ) as Partial<DocsReviewRulesConfig>;
}

function normalizeWeight(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeCiName(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_DOCS_REVIEW_CI_NAME;
}

function clampScoreThreshold(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    return DEFAULT_DOCS_REVIEW_SCORE_THRESHOLD;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function readReviewCiObject(source: string, cursor: number): DocsReviewConfig["ci"] {
  const end = findMatchingObjectEnd(source, cursor);
  if (end === undefined) return undefined;

  const block = source.slice(cursor + 1, end);
  const mode = readTopLevelString(block, "mode");
  return {
    enabled: readTopLevelBoolean(block, "enabled"),
    name: readTopLevelString(block, "name"),
    mode:
      mode && REVIEW_CI_MODES.has(mode as DocsReviewCiMode)
        ? (mode as DocsReviewCiMode)
        : undefined,
    annotations: readTopLevelBoolean(block, "annotations"),
    comment: readTopLevelBoolean(block, "comment"),
  };
}

function readReviewRules(block: string): DocsReviewRulesConfig {
  const rules: DocsReviewRulesConfig = {};

  for (const key of Object.keys(DEFAULT_REVIEW_RULES) as Array<keyof DocsReviewRulesConfig>) {
    const value = readTopLevelString(block, key);
    if (value && REVIEW_SEVERITIES.has(value as DocsReviewSeverity)) {
      rules[key] = value as DocsReviewSeverity;
    }
  }

  return rules;
}

function readReviewWeights(block: string): DocsReviewScoreConfig["weights"] {
  const weightsBlock = extractTopLevelObjectLiteral(block, "weights");
  if (!weightsBlock) return undefined;

  return {
    error: readTopLevelNumber(weightsBlock, "error"),
    warn: readTopLevelNumber(weightsBlock, "warn"),
    suggestion: readTopLevelNumber(weightsBlock, "suggestion"),
  };
}

function detectPackageManager(rootDir: string): "npm" | "pnpm" | "yarn" | "bun" {
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(rootDir, "bun.lock")) || existsSync(join(rootDir, "bun.lockb"))) return "bun";
  return "npm";
}

function detectLocalDocsCliBuildCommand(
  repoRoot: string,
  packageManager: "npm" | "pnpm" | "yarn" | "bun",
): string | undefined {
  if (!hasLocalDocsWorkspacePackage(repoRoot)) return undefined;

  if (packageManager === "pnpm") return "pnpm --filter @farming-labs/docs run build";
  if (packageManager === "yarn") return "yarn workspace @farming-labs/docs build";
  if (packageManager === "bun") return "bun run --filter @farming-labs/docs build";
  return "npm run build --workspace=@farming-labs/docs";
}

function detectLocalDocsCliReviewCommand(repoRoot: string, rootDir: string): string | undefined {
  if (!hasLocalDocsWorkspacePackage(repoRoot)) return undefined;

  const cliPath = toPosixPath(
    relative(rootDir, join(repoRoot, "packages", "docs", "dist", "cli", "index.mjs")),
  );
  return `node ${shellQuote(cliPath || "./packages/docs/dist/cli/index.mjs")}`;
}

function hasLocalDocsWorkspacePackage(repoRoot: string): boolean {
  const packageJsonPath = join(repoRoot, "packages", "docs", "package.json");
  if (!existsSync(packageJsonPath)) return false;

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    return packageJson.name === "@farming-labs/docs" && Boolean(packageJson.scripts?.build);
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function normalizeProjectDir(value?: string): string {
  if (!value || value === "") return ".";
  return toPosixPath(value).replace(/\/+$/, "") || ".";
}

function normalizePathFilters(filters?: string[]): string[] {
  const normalized = (filters && filters.length > 0 ? filters : ["docs.config.*", "app/docs/**"])
    .map((filter) => toPosixPath(filter).replace(/^\.\/+/, ""))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function findGitRoot(start: string): string | undefined {
  let current = start;

  while (true) {
    if (existsSync(join(current, ".git"))) return current;

    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function findDocsConfigPath(rootDir: string): string {
  for (const ext of FILE_EXTS) {
    const path = `docs.config.${ext}`;
    if (existsSync(join(rootDir, path))) return path;
  }

  return "docs.config.ts";
}

function readConfig(rootDir: string, configPath = findDocsConfigPath(rootDir)): string | undefined {
  const fullPath = join(rootDir, configPath);
  if (!existsSync(fullPath)) return undefined;

  try {
    return readFileSync(fullPath, "utf-8");
  } catch {
    return undefined;
  }
}

function prefixPath(prefix: string, value: string): string {
  return `${prefix}${toPosixPath(value).replace(/^\.\/+/, "")}`;
}

function trimSlashes(value: string): string {
  return toPosixPath(value).replace(/^\/+|\/+$/g, "");
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function extractRootObjectLiteral(content: string): string | undefined {
  const candidateIndexes = [
    content.search(/\bdefineDocs\s*\(/),
    content.search(/\bexport\s+default\b/),
  ].filter((value) => value !== -1);

  for (const startIndex of candidateIndexes) {
    const braceStart = content.indexOf("{", startIndex);
    if (braceStart === -1) continue;

    const braceEnd = findMatchingObjectEnd(content, braceStart);
    if (braceEnd !== undefined) return content.slice(braceStart + 1, braceEnd);
  }

  return undefined;
}

function extractTopLevelObjectLiteral(content: string, key: string): string | undefined {
  const cursor = findTopLevelPropertyValueIndex(content, key);
  if (cursor === undefined || content[cursor] !== "{") return undefined;

  const end = findMatchingObjectEnd(content, cursor);
  return end === undefined ? undefined : content.slice(cursor + 1, end);
}

function readTopLevelBoolean(content: string, key: string): boolean | undefined {
  const cursor = findTopLevelPropertyValueIndex(content, key);
  if (cursor === undefined) return undefined;
  if (content.startsWith("true", cursor)) return true;
  if (content.startsWith("false", cursor)) return false;
  return undefined;
}

function readTopLevelNumber(content: string, key: string): number | undefined {
  const cursor = findTopLevelPropertyValueIndex(content, key);
  if (cursor === undefined) return undefined;

  const match = content.slice(cursor).match(/^-?\d+(?:\.\d+)?/);
  if (!match) return undefined;

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function readTopLevelString(content: string | undefined, key: string): string | undefined {
  if (!content) return undefined;

  const cursor = findTopLevelPropertyValueIndex(content, key);
  if (cursor === undefined) return undefined;

  const quote = content[cursor];
  if (quote !== '"' && quote !== "'") return undefined;

  let value = "";
  for (let index = cursor + 1; index < content.length; index += 1) {
    const char = content[index];
    if (char === "\\") {
      const escaped = content[index + 1];
      if (escaped) {
        value += escaped;
        index += 1;
      }
      continue;
    }

    if (char === quote) return value;
    value += char;
  }

  return undefined;
}

function findTopLevelPropertyValueIndex(block: string, key: string): number | undefined {
  let objectDepth = 0;
  let arrayDepth = 0;
  let parenDepth = 0;
  let inString: '"' | "'" | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let index = 0; index < block.length; index += 1) {
    const char = block[index];
    const next = block[index + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === inString) inString = null;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }

    if (char === "{") {
      objectDepth += 1;
      continue;
    }

    if (char === "}") {
      objectDepth = Math.max(0, objectDepth - 1);
      continue;
    }

    if (char === "[") {
      arrayDepth += 1;
      continue;
    }

    if (char === "]") {
      arrayDepth = Math.max(0, arrayDepth - 1);
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

    if (objectDepth !== 0 || arrayDepth !== 0 || parenDepth !== 0) continue;
    if (!block.startsWith(key, index)) continue;

    const before = block[index - 1] ?? "";
    const after = block[index + key.length] ?? "";
    if (/[A-Za-z0-9_$]/.test(before) || /[A-Za-z0-9_$]/.test(after)) continue;

    let cursor = index + key.length;
    while (/\s/.test(block[cursor] ?? "")) cursor += 1;
    if (block[cursor] !== ":") continue;

    cursor += 1;
    while (/\s/.test(block[cursor] ?? "")) cursor += 1;

    return cursor;
  }

  return undefined;
}

function findMatchingObjectEnd(block: string, start: number): number | undefined {
  let depth = 0;
  let inString: '"' | "'" | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let index = start; index < block.length; index += 1) {
    const char = block[index];
    const next = block[index + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === inString) inString = null;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
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

  return undefined;
}

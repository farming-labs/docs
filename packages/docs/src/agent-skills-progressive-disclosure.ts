import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  resolveConfiguredAgentSkillPathsSync,
  type ResolveConfiguredAgentSkillsOptions,
} from "./agent-skills-server.js";
import { validateDocsAgentSkillFrontmatter } from "./agent-skills-spec.js";
import type {
  DocsAgentSkillsCompatibilityPolicy,
  DocsAgentSkillsInput,
  DocsAgentSkillsProgressiveDisclosureConfig,
} from "./types.js";

export const DEFAULT_AGENT_SKILL_MAX_LINES = 500;
export const DEFAULT_AGENT_SKILL_INSTRUCTION_TOKEN_BUDGET = 5_000;
export const DEFAULT_AGENT_SKILL_MAX_REFERENCE_DEPTH = 1;

export type DocsAgentSkillProgressiveDisclosureIssueCode =
  | "skill-lines-exceeded"
  | "skill-token-budget-exceeded"
  | "skill-reference-broken"
  | "skill-reference-unpublished"
  | "skill-reference-outside-root"
  | "skill-reference-depth-exceeded"
  | "skill-compatibility-missing"
  | "skill-script-undocumented"
  | "skill-script-dependencies-undocumented"
  | "skill-script-validation-undocumented";

export type DocsAgentSkillProgressiveDisclosureIssueSeverity = "suggestion" | "warning" | "error";

export interface DocsAgentSkillProgressiveDisclosureIssue {
  code: DocsAgentSkillProgressiveDisclosureIssueCode;
  severity: DocsAgentSkillProgressiveDisclosureIssueSeverity;
  skill: string;
  skillPath: string;
  filePath: string;
  line?: number;
  message: string;
}

export interface DocsAgentSkillProgressiveDisclosureSummary {
  name: string;
  skillPath: string;
  lineCount: number;
  estimatedInstructionTokens: number;
  referenceCount: number;
  scriptCount: number;
}

export interface ResolvedDocsAgentSkillsProgressiveDisclosureConfig {
  maxSkillLines: number;
  instructionTokenBudget: number;
  maxReferenceDepth: number;
  compatibility: DocsAgentSkillsCompatibilityPolicy;
  checkScripts: boolean;
}

export interface DocsAgentSkillsProgressiveDisclosureReport {
  config: ResolvedDocsAgentSkillsProgressiveDisclosureConfig;
  skills: DocsAgentSkillProgressiveDisclosureSummary[];
  issues: DocsAgentSkillProgressiveDisclosureIssue[];
}

interface LocalReference {
  target: string;
  index: number;
  line: number;
}

const MARKDOWN_LINK_PATTERN = /!?\[[^\]]*\]\(([^)\n]+)\)/gu;
const SKILL_PATH_PATTERN =
  /(?:^|[\s"'`(])((?:\.\/)?(?:references|scripts|assets)\/[\p{L}\p{N}@._+\-/]+)/gmu;
const REQUIREMENT_PATTERN =
  /\b(?:requires?|prerequisites?|node(?:\.js)?|python|npm|pnpm|yarn|bun|deno|docker|git|network access|internet access|api key|environment variables?|macos|linux|windows)\b/iu;
const DEPENDENCY_DOCUMENTATION_PATTERN =
  /\b(?:dependenc(?:y|ies)|requires?|prerequisites?|self-contained|standard library|no external dependencies)\b/iu;
const VALIDATION_DOCUMENTATION_PATTERN =
  /\b(?:validate|validation|verify|verification|tests?|expected (?:result|output)|--check|--dry-run)\b/iu;
const PUBLISHED_SKILL_ROOTS = new Set(["references", "scripts", "assets"]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function readProgressiveDisclosureConfig(
  input: DocsAgentSkillsInput | undefined,
): DocsAgentSkillsProgressiveDisclosureConfig | undefined {
  if (!input || typeof input === "string" || Array.isArray(input)) return undefined;
  return (input as { progressiveDisclosure?: DocsAgentSkillsProgressiveDisclosureConfig })
    .progressiveDisclosure;
}

export function resolveDocsAgentSkillsProgressiveDisclosureConfig(
  input: DocsAgentSkillsInput | undefined,
): ResolvedDocsAgentSkillsProgressiveDisclosureConfig {
  const config = readProgressiveDisclosureConfig(input);
  return {
    maxSkillLines: positiveInteger(config?.maxSkillLines, DEFAULT_AGENT_SKILL_MAX_LINES),
    instructionTokenBudget: positiveInteger(
      config?.instructionTokenBudget,
      DEFAULT_AGENT_SKILL_INSTRUCTION_TOKEN_BUDGET,
    ),
    maxReferenceDepth: nonNegativeInteger(
      config?.maxReferenceDepth,
      DEFAULT_AGENT_SKILL_MAX_REFERENCE_DEPTH,
    ),
    compatibility:
      config?.compatibility === "always" ||
      config?.compatibility === "off" ||
      config?.compatibility === "when-needed"
        ? config.compatibility
        : "when-needed",
    checkScripts: config?.checkScripts !== false,
  };
}

function stripFrontmatter(document: string): string {
  if (!/^---[ \t]*(?:\r?\n)/u.test(document)) return document;
  const closing = /^---[ \t]*(?:\r?\n|$)/gmu;
  closing.lastIndex = document.indexOf("\n") + 1;
  const match = closing.exec(document);
  return match ? document.slice(match.index + match[0].length) : document;
}

/**
 * Dependency-free estimate for diagnostics, deliberately using three UTF-8 bytes per token
 * so code-heavy instructions are less likely to be under-counted.
 */
export function estimateAgentSkillInstructionTokens(document: string): number {
  return Math.ceil(Buffer.byteLength(stripFrontmatter(document), "utf8") / 3);
}

function lineForIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/u).length;
}

function cleanReferenceTarget(rawTarget: string): string | null {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.includes(">")) {
    target = target.slice(1, target.indexOf(">"));
  } else {
    target = target.split(/\s+(?=["'])/u, 1)[0] ?? "";
  }
  if (
    !target ||
    target.startsWith("#") ||
    target.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/iu.test(target) ||
    target.includes("{") ||
    target.includes("}")
  ) {
    return null;
  }
  const withoutFragment = target.split("#", 1)[0]?.split("?", 1)[0] ?? "";
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment)
      .replace(/^\.\//u, "")
      .replace(/[.,;:!?]+$/u, "");
  } catch {
    return withoutFragment.replace(/^\.\//u, "").replace(/[.,;:!?]+$/u, "");
  }
}

function extractLocalReferences(source: string): LocalReference[] {
  const references: LocalReference[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  while ((match = MARKDOWN_LINK_PATTERN.exec(source))) {
    if (match[0]?.startsWith("!")) continue;
    const target = cleanReferenceTarget(match[1] ?? "");
    if (!target) continue;
    const index = match.index + (match[0]?.indexOf(match[1] ?? "") ?? 0);
    const key = `${target}:${index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push({ target, index, line: lineForIndex(source, index) });
  }

  SKILL_PATH_PATTERN.lastIndex = 0;
  while ((match = SKILL_PATH_PATTERN.exec(source))) {
    const target = cleanReferenceTarget(match[1] ?? "");
    if (!target) continue;
    const index = match.index + (match[0]?.lastIndexOf(match[1] ?? "") ?? 0);
    const key = `${target}:${index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push({ target, index, line: lineForIndex(source, index) });
  }

  return references.sort((left, right) => left.index - right.index);
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toSkillRelativePath(skillDir: string, filePath: string): string {
  return path.relative(skillDir, filePath).replaceAll("\\", "/");
}

function isPublishedSkillPath(relativePath: string): boolean {
  if (relativePath === "SKILL.md") return true;
  const [root] = relativePath.split("/");
  return Boolean(root && PUBLISHED_SKILL_ROOTS.has(root));
}

function resolveReferencePath(skillDir: string, currentFilePath: string, target: string): string {
  const normalizedTarget = target.replaceAll("\\", "/");
  const [root] = normalizedTarget.replace(/^\.\//u, "").split("/");
  return path.resolve(
    root && PUBLISHED_SKILL_ROOTS.has(root) ? skillDir : path.dirname(currentFilePath),
    target,
  );
}

function listRegularFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...listRegularFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function issue(
  issues: DocsAgentSkillProgressiveDisclosureIssue[],
  input: Omit<DocsAgentSkillProgressiveDisclosureIssue, "skillPath"> & { skillPath: string },
): void {
  issues.push(input);
}

function analyzeOneSkill(
  skillPath: string,
  config: ResolvedDocsAgentSkillsProgressiveDisclosureConfig,
): {
  summary: DocsAgentSkillProgressiveDisclosureSummary;
  issues: DocsAgentSkillProgressiveDisclosureIssue[];
} {
  const skillDir = path.dirname(skillPath);
  const document = readFileSync(skillPath, "utf8");
  const frontmatter = validateDocsAgentSkillFrontmatter(document, {
    directoryName: path.basename(skillDir),
  });
  const name = frontmatter.valid ? frontmatter.data.name : path.basename(skillDir);
  const issues: DocsAgentSkillProgressiveDisclosureIssue[] = [];
  const lineCount = document.split(/\r?\n/u).length;
  const estimatedInstructionTokens = estimateAgentSkillInstructionTokens(document);

  if (lineCount > config.maxSkillLines) {
    issue(issues, {
      code: "skill-lines-exceeded",
      severity: "warning",
      skill: name,
      skillPath,
      filePath: skillPath,
      line: 1,
      message: `SKILL.md has ${lineCount} lines, exceeding the configured ${config.maxSkillLines}-line limit; move detailed material into focused references/.`,
    });
  }
  if (estimatedInstructionTokens > config.instructionTokenBudget) {
    issue(issues, {
      code: "skill-token-budget-exceeded",
      severity: "warning",
      skill: name,
      skillPath,
      filePath: skillPath,
      line: 1,
      message: `SKILL.md instructions are approximately ${estimatedInstructionTokens} tokens, exceeding the configured ${config.instructionTokenBudget}-token budget.`,
    });
  }

  const referenceQueue: Array<{ filePath: string; depth: number }> = [
    { filePath: skillPath, depth: 0 },
  ];
  const visitedDepth = new Map<string, number>([[skillPath, 0]]);
  const markdownDocuments = new Map<string, string>([[skillPath, document]]);
  const validReferencePaths = new Set<string>();
  const referencedTargets = new Set<string>();

  for (let cursor = 0; cursor < referenceQueue.length; cursor += 1) {
    const current = referenceQueue[cursor]!;
    const source =
      markdownDocuments.get(current.filePath) ?? readFileSync(current.filePath, "utf8");
    markdownDocuments.set(current.filePath, source);

    for (const reference of extractLocalReferences(source)) {
      referencedTargets.add(reference.target);
      const resolved = resolveReferencePath(skillDir, current.filePath, reference.target);
      if (!isInside(skillDir, resolved)) {
        issue(issues, {
          code: "skill-reference-outside-root",
          severity: "error",
          skill: name,
          skillPath,
          filePath: current.filePath,
          line: reference.line,
          message: `Local reference escapes the skill directory: ${reference.target}`,
        });
        continue;
      }

      const relativeTarget = toSkillRelativePath(skillDir, resolved);
      if (!isPublishedSkillPath(relativeTarget)) {
        issue(issues, {
          code: "skill-reference-unpublished",
          severity: "error",
          skill: name,
          skillPath,
          filePath: current.filePath,
          line: reference.line,
          message: `Local reference is outside SKILL.md, references/, scripts/, or assets/ and will not be published: ${reference.target}`,
        });
        continue;
      }
      if (!existsSync(resolved) || !lstatSync(resolved).isFile()) {
        issue(issues, {
          code: "skill-reference-broken",
          severity: "error",
          skill: name,
          skillPath,
          filePath: current.filePath,
          line: reference.line,
          message: `Local skill reference does not resolve to a regular file: ${reference.target}`,
        });
        continue;
      }

      validReferencePaths.add(relativeTarget);
      if (!MARKDOWN_EXTENSIONS.has(path.extname(resolved).toLowerCase())) continue;

      const nextDepth = current.depth + 1;
      const previousDepth = visitedDepth.get(resolved);
      if (
        resolved !== skillPath &&
        previousDepth === undefined &&
        nextDepth > config.maxReferenceDepth
      ) {
        issue(issues, {
          code: "skill-reference-depth-exceeded",
          severity: "warning",
          skill: name,
          skillPath,
          filePath: current.filePath,
          line: reference.line,
          message: `Reference chain reaches depth ${nextDepth}, exceeding the configured maximum of ${config.maxReferenceDepth}: ${reference.target}`,
        });
      }
      if (previousDepth !== undefined && previousDepth <= nextDepth) continue;
      visitedDepth.set(resolved, nextDepth);
      referenceQueue.push({ filePath: resolved, depth: nextDepth });
    }
  }

  const scriptPaths = listRegularFiles(path.join(skillDir, "scripts"));
  const documentation = [...markdownDocuments.values()].join("\n\n");
  const compatibilityRequired =
    config.compatibility === "always" ||
    (config.compatibility === "when-needed" &&
      (scriptPaths.length > 0 || REQUIREMENT_PATTERN.test(documentation)));
  if (compatibilityRequired && frontmatter.valid && !frontmatter.data.compatibility?.trim()) {
    issue(issues, {
      code: "skill-compatibility-missing",
      severity: "warning",
      skill: name,
      skillPath,
      filePath: skillPath,
      line: 1,
      message:
        "Skill instructions require tools, environment capabilities, or scripts but frontmatter does not declare compatibility requirements.",
    });
  }

  if (config.checkScripts && scriptPaths.length > 0) {
    const dependencyDocumented =
      Boolean(frontmatter.valid && frontmatter.data.compatibility?.trim()) ||
      DEPENDENCY_DOCUMENTATION_PATTERN.test(documentation);
    const validationDocumented = VALIDATION_DOCUMENTATION_PATTERN.test(documentation);

    for (const scriptPath of scriptPaths) {
      const relativeScript = toSkillRelativePath(skillDir, scriptPath);
      if (!validReferencePaths.has(relativeScript)) {
        issue(issues, {
          code: "skill-script-undocumented",
          severity: "warning",
          skill: name,
          skillPath,
          filePath: scriptPath,
          line: 1,
          message: `Script is bundled but never referenced by SKILL.md or a reachable reference: ${relativeScript}`,
        });
      }
      if (!dependencyDocumented) {
        issue(issues, {
          code: "skill-script-dependencies-undocumented",
          severity: "warning",
          skill: name,
          skillPath,
          filePath: scriptPath,
          line: 1,
          message: `Document required runtimes/packages or explicitly state that ${relativeScript} is self-contained.`,
        });
      }
      if (!validationDocumented) {
        issue(issues, {
          code: "skill-script-validation-undocumented",
          severity: "warning",
          skill: name,
          skillPath,
          filePath: scriptPath,
          line: 1,
          message: `Document how to validate ${relativeScript}, including an expected result, test, --check, or --dry-run command.`,
        });
      }
    }
  }

  return {
    summary: {
      name,
      skillPath,
      lineCount,
      estimatedInstructionTokens,
      referenceCount: referencedTargets.size,
      scriptCount: scriptPaths.length,
    },
    issues,
  };
}

export function analyzeConfiguredAgentSkillsProgressiveDisclosure(
  input: DocsAgentSkillsInput | undefined,
  options: ResolveConfiguredAgentSkillsOptions = {},
): DocsAgentSkillsProgressiveDisclosureReport {
  const config = resolveDocsAgentSkillsProgressiveDisclosureConfig(input);
  const skillPaths = resolveConfiguredAgentSkillPathsSync(input, options);
  const analyses = skillPaths.map((skillPath) => analyzeOneSkill(skillPath, config));
  return {
    config,
    skills: analyses.map((analysis) => analysis.summary),
    issues: analyses
      .flatMap((analysis) => analysis.issues)
      .sort((left, right) => {
        const fileOrder = left.filePath.localeCompare(right.filePath);
        if (fileOrder !== 0) return fileOrder;
        const lineOrder = (left.line ?? 0) - (right.line ?? 0);
        return lineOrder !== 0 ? lineOrder : left.code.localeCompare(right.code);
      }),
  };
}

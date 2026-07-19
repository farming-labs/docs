import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { hasStructuredPageAgentContract, normalizePageAgentFrontmatter } from "./agent-contract.js";
import {
  agentVersionConstraintsOverlap,
  normalizeAgentFramework,
  normalizeAgentVersion,
} from "./agent-scope.js";
import { extractCodeBlocksFromMarkdown } from "./code-blocks.js";
import type { DocsMcpPage } from "./mcp.js";
import type { PageAgentCommand, PageAgentFrontmatter } from "./types.js";

export type AgentUsefulnessFindingSeverity = "suggestion" | "warning" | "error";

export type AgentUsefulnessFindingCode =
  | "agent-block-duplicate"
  | "agent-block-boilerplate"
  | "agent-block-generic"
  | "task-missing-prerequisites"
  | "task-missing-expected-result"
  | "task-missing-recovery"
  | "applicability-framework-conflict"
  | "applicability-framework-ambiguous"
  | "applicability-framework-mismatch"
  | "applicability-version-conflict"
  | "applicability-version-ambiguous"
  | "command-package-manager-mismatch"
  | "command-script-missing"
  | "command-cwd-missing"
  | "command-cwd-outside-root"
  | "command-cli-unknown"
  | "command-unverified"
  | "related-missing"
  | "related-broken";

export interface AgentUsefulnessPage {
  /** Canonical page route, for example `/docs/installation`. */
  route: string;
  /** Project-relative source path used for findings and filesystem checks. */
  sourcePath: string;
  /** Raw Markdown or MDX source, including frontmatter when available. */
  source: string;
  /** Optional sibling `agent.md` path. */
  agentSourcePath?: string;
  /** Optional sibling `agent.md` contents. */
  agentSource?: string;
  title?: string;
  description?: string;
  related?: Array<string | { href: string }>;
  /** Legacy/top-level applicability metadata. */
  framework?: string | string[];
  /** Legacy/top-level applicability metadata. */
  version?: string | string[];
  /** Untrusted page-level `agent` frontmatter. */
  agent?: unknown;
  /** Override actionable-page inference when the caller has stronger knowledge. */
  actionable?: boolean;
}

export interface AgentBlockOccurrence {
  sourcePath: string;
  route?: string;
  line: number;
  content: string;
}

export interface AgentUsefulnessFinding {
  code: AgentUsefulnessFindingCode;
  severity: AgentUsefulnessFindingSeverity;
  category: "context" | "task" | "applicability" | "command" | "related";
  file: string;
  route: string;
  line?: number;
  message: string;
  relatedFiles?: string[];
  command?: string;
}

export interface AgentUsefulnessMetrics {
  totalPages: number;
  actionablePages: number;
  agentBlocks: {
    total: number;
    pages: number;
    duplicate: number;
    boilerplate: number;
    generic: number;
    useful: number;
  };
  taskCompleteness: {
    completePages: number;
    missingPrerequisites: number;
    missingExpectedResults: number;
    missingRecovery: number;
    coverage: number;
  };
  applicability: {
    conflictingPages: number;
    ambiguousPages: number;
    mismatchedPages: number;
  };
  commands: {
    total: number;
    healthy: number;
    unhealthy: number;
    unverified: number;
  };
  related: {
    coveredActionablePages: number;
    missingActionablePages: number;
    brokenLinks: number;
    coverage: number;
  };
}

export interface AgentUsefulnessReport {
  findings: AgentUsefulnessFinding[];
  metrics: AgentUsefulnessMetrics;
}

export interface AnalyzeAgentUsefulnessOptions {
  pages: AgentUsefulnessPage[];
  rootDir: string;
  projectFramework?: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  /** Additional supported `docs` CLI command paths, such as `cloud publish`. */
  knownDocsCommands?: readonly string[];
  boilerplate?: {
    /** Minimum share of a block's normalized sentence characters that must be repeated. */
    blockRatio?: number;
    /** Minimum corpus share for a sentence to count as repeated. */
    corpusRatio?: number;
    /** Absolute repeated-sentence threshold for larger corpora. */
    minOccurrences?: number;
  };
}

/** Build analyzer inputs from the same filesystem MCP pages used by doctor and review. */
export function createAgentUsefulnessPagesFromMcp(
  rootDir: string,
  pages: readonly DocsMcpPage[],
): AgentUsefulnessPage[] {
  return pages.map((page) => {
    const sourcePath = page.sourcePath ?? page.url;
    const absoluteSourcePath = page.sourcePath
      ? path.isAbsolute(page.sourcePath)
        ? page.sourcePath
        : path.join(rootDir, page.sourcePath)
      : undefined;
    const source =
      absoluteSourcePath && existsSync(absoluteSourcePath)
        ? readFileSync(absoluteSourcePath, "utf-8")
        : (page.rawContent ?? page.agentFallbackRawContent ?? page.content);
    const isFolderPage = Boolean(
      absoluteSourcePath &&
      /(?:^|\/)(?:page|index|\+page)\.(?:md|mdx|svx)$/i.test(absoluteSourcePath),
    );
    const absoluteAgentPath =
      isFolderPage && absoluteSourcePath
        ? path.join(path.dirname(absoluteSourcePath), "agent.md")
        : undefined;
    const hasAgentSource = Boolean(absoluteAgentPath && existsSync(absoluteAgentPath));

    return {
      route: page.url,
      sourcePath,
      source,
      agentSourcePath:
        hasAgentSource && absoluteAgentPath
          ? path.relative(rootDir, absoluteAgentPath).replace(/\\/g, "/")
          : undefined,
      agentSource:
        hasAgentSource && absoluteAgentPath ? readFileSync(absoluteAgentPath, "utf-8") : undefined,
      title: page.title,
      description: page.description,
      related: page.related,
      framework: page.framework,
      version: page.version,
      agent: page.agent,
    };
  });
}

interface PageAnalysis {
  page: AgentUsefulnessPage;
  agent?: PageAgentFrontmatter;
  blocks: AgentBlockOccurrence[];
  shellCommands: AnalyzedCommand[];
  actionable: boolean;
}

interface AnalyzedCommand {
  run: string;
  cwd?: string;
  line?: number;
  sourcePath?: string;
  packageManagerHint?: string;
  source: "contract" | "fence";
}

interface ProjectPackageManifest {
  directory: string;
  relativePath: string;
  scripts: Set<string>;
}

interface CommandAnalysis {
  findings: AgentUsefulnessFinding[];
  status: "healthy" | "unhealthy" | "unverified";
}

interface WorkspaceSelection {
  requested: boolean;
  selectors: string[];
}

type WorkspaceResolution =
  | { status: "none"; manifests: [] }
  | { status: "resolved"; manifests: ProjectPackageManifest[] }
  | { status: "unresolved"; manifests: [] };

const DEFAULT_DOCS_COMMANDS = [
  "init",
  "dev",
  "deploy",
  "preview",
  "cloud init",
  "cloud sync",
  "cloud check",
  "cloud deploy",
  "cloud preview",
  "mcp",
  "agent compact",
  "agent export",
  "agents generate",
  "doctor",
  "review",
  "codeblocks validate",
  "code-blocks validate",
  "search sync",
  "sitemap generate",
  "robots generate",
  "upgrade",
  "downgrade",
] as const;

const ACTIONABLE_PATTERN =
  /\b(?:add|authenticate|build|configure|create|debug|deploy|disable|enable|fetch|fix|implement|install|integrate|migrate|open|remove|run|set|set\s*up|test|troubleshoot|update|upgrade)\b/i;
const PREREQUISITE_PATTERN =
  /(?:^|\n)\s{0,3}#{1,6}\s+(?:before you begin|prerequisites?|requirements?|setup)\b|\b(?:before (?:starting|you begin)|requires? (?:an?|the|you))\b/i;
const EXPECTED_RESULT_PATTERN =
  /(?:^|\n)\s{0,3}#{1,6}\s+(?:expected (?:result|output)|outcome|result|success|verification)\b|\b(?:you should see|expected to (?:see|return|produce)|succeeds? when|tests? pass(?:es)?)\b/i;
const RECOVERY_PATTERN =
  /(?:^|\n)\s{0,3}#{1,6}\s+(?:failure modes?|recovery|rollback|troubleshooting)\b|\b(?:if .{0,80} fails?|recover(?:y)?|restore|retry|revert|roll back|undo)\b/i;
const STRONG_SPECIFIC_CONTEXT_PATTERN =
  /(?:@[a-z0-9_-]+\/[a-z0-9_.-]+|(?:^|\s)--[a-z][\w-]*|(?:^|\s)(?:\.\.?\/|\/)[\w./-]+|\b[\w-]+\.(?:[cm]?[jt]sx?|json|mdx?|vue|svelte|astro)\b|\bv?\d+(?:\.\d+)+\b)/im;
const GENERIC_SENTENCE_PATTERN =
  /\b(?:follow|keep answers|refer to|read|use) (?:the |this )?(?:documentation|docs|instructions|page)\b|\bkeep answers grounded\b|\bpoint to (?:the )?(?:closest )?related docs\b|\bif the request moves beyond this page\b|\bdo not (?:guess|invent)\b/i;

const FRAMEWORK_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["nextjs", /\bNext\.js\b|@farming-labs\/next\b|\bnext\.config\b|\bApp Router\b/i],
  [
    "tanstackstart",
    /\bTanStack Start\b|@farming-labs\/(?:tanstack|tanstack-start)\b|\bcreateFileRoute\b/i,
  ],
  [
    "sveltekit",
    /\bSvelteKit\b|@farming-labs\/svelte(?:kit)?\b|\bhooks\.server\b|\+server\.[cm]?[jt]s\b/i,
  ],
  ["astro", /\bAstro\b|@farming-labs\/astro\b|\bastro\.config\b/i],
  ["nuxt", /\bNuxt\b|@farming-labs\/nuxt\b|\bnuxt\.config\b/i],
];

const PACKAGE_MANAGER_BUILT_INS: Record<string, Set<string>> = {
  npm: new Set([
    "access",
    "adduser",
    "audit",
    "cache",
    "ci",
    "config",
    "dedupe",
    "exec",
    "help",
    "init",
    "install",
    "link",
    "login",
    "logout",
    "org",
    "outdated",
    "owner",
    "pack",
    "ping",
    "prefix",
    "profile",
    "prune",
    "publish",
    "query",
    "rebuild",
    "repo",
    "restart",
    "root",
    "run",
    "run-script",
    "search",
    "shrinkwrap",
    "star",
    "stars",
    "start",
    "stop",
    "team",
    "test",
    "token",
    "uninstall",
    "unpublish",
    "unstar",
    "update",
    "version",
    "view",
    "whoami",
  ]),
  pnpm: new Set([
    "add",
    "approve-builds",
    "audit",
    "bin",
    "config",
    "create",
    "dedupe",
    "deploy",
    "dlx",
    "env",
    "exec",
    "fetch",
    "help",
    "import",
    "init",
    "install",
    "link",
    "list",
    "outdated",
    "pack",
    "patch",
    "patch-commit",
    "prune",
    "publish",
    "rebuild",
    "remove",
    "root",
    "run",
    "server",
    "setup",
    "store",
    "test",
    "unlink",
    "update",
    "view",
    "why",
  ]),
  yarn: new Set([
    "add",
    "bin",
    "cache",
    "config",
    "create",
    "dedupe",
    "dlx",
    "exec",
    "help",
    "info",
    "init",
    "install",
    "link",
    "npm",
    "pack",
    "plugin",
    "rebuild",
    "remove",
    "run",
    "set",
    "stage",
    "unlink",
    "up",
    "why",
    "workspace",
    "workspaces",
  ]),
  bun: new Set([
    "add",
    "build",
    "create",
    "dev",
    "help",
    "install",
    "link",
    "pm",
    "publish",
    "remove",
    "repl",
    "run",
    "test",
    "unlink",
    "update",
    "upgrade",
    "x",
  ]),
};

const PACKAGE_MANAGER_OPTIONS_WITH_VALUES = new Set([
  "--cwd",
  "--dir",
  "--filter",
  "--prefix",
  "--workspace",
  "-C",
  "-F",
  "-w",
]);

/** Extract actual `<Agent>` blocks while ignoring examples inside fenced code blocks. */
export function extractAgentBlocks(
  source: string,
  options: { sourcePath?: string; route?: string } = {},
): AgentBlockOccurrence[] {
  const sourcePath = options.sourcePath ?? "unknown";
  const lines = source.split(/\r?\n/);
  const blocks: AgentBlockOccurrence[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  let active:
    | {
        line: number;
        depth: number;
        content: string[];
      }
    | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    const nextFence = advanceFence(trimmed, fence);

    if (active) {
      if (fence || nextFence) {
        active.content.push(line);
        fence = nextFence;
        continue;
      }

      const nested = /^<Agent(?:\s[^>]*)?>\s*$/.test(trimmed);
      if (nested) {
        active.depth += 1;
        continue;
      }

      const closeWithContent = /^(.*?)<\/Agent>\s*$/.exec(line);
      if (closeWithContent) {
        if (closeWithContent[1]) active.content.push(closeWithContent[1]);
        active.depth -= 1;
        if (active.depth === 0) {
          blocks.push({
            sourcePath,
            route: options.route,
            line: active.line,
            content: active.content.join("\n").trim(),
          });
          active = undefined;
        }
        continue;
      }

      active.content.push(line);
      continue;
    }

    if (fence || nextFence) {
      fence = nextFence;
      continue;
    }

    if (/^<Agent(?:\s[^>]*)?\s*\/>$/.test(trimmed)) continue;

    const singleLine = /^<Agent(?:\s[^>]*)?>(.*?)<\/Agent>\s*$/.exec(trimmed);
    if (singleLine) {
      blocks.push({
        sourcePath,
        route: options.route,
        line: index + 1,
        content: (singleLine[1] ?? "").trim(),
      });
      continue;
    }

    const opening = /^<Agent(?:\s[^>]*)?>(.*)$/.exec(trimmed);
    if (opening) {
      active = {
        line: index + 1,
        depth: 1,
        content: opening[1] ? [opening[1]] : [],
      };
    }
  }

  return blocks;
}

/** Analyze page-level context quality without executing documented commands. */
export function analyzeAgentUsefulness(
  options: AnalyzeAgentUsefulnessOptions,
): AgentUsefulnessReport {
  const rootDir = path.resolve(options.rootDir);
  const packageManager = options.packageManager ?? detectPackageManager(rootDir);
  const knownDocsCommands = new Set([
    ...DEFAULT_DOCS_COMMANDS,
    ...(options.knownDocsCommands ?? []),
  ]);
  const packageManifests = readProjectPackageManifests(rootDir);
  const pages = options.pages.map((page) => analyzePage(page));
  const findings: AgentUsefulnessFinding[] = [];
  const unhealthyCommandKeys = new Set<string>();
  const unverifiedCommandKeys = new Set<string>();

  const blockQuality = analyzeBlockQuality(pages, options.boilerplate);
  findings.push(...blockQuality.findings);

  let completeTaskPages = 0;
  let missingPrerequisites = 0;
  let missingExpectedResults = 0;
  let missingRecovery = 0;
  let conflictingPages = 0;
  let ambiguousPages = 0;
  let mismatchedPages = 0;
  let commandCount = 0;
  let coveredActionablePages = 0;
  let missingRelatedPages = 0;
  let brokenRelatedLinks = 0;
  const knownRoutes = new Set(options.pages.map((page) => normalizeRoute(page.route)));

  for (const analysis of pages) {
    const { page, agent, actionable } = analysis;

    if (actionable) {
      const guidance = [
        stripFencedContent(page.source),
        page.agentSource ? stripFencedContent(page.agentSource) : undefined,
        ...analysis.blocks.map((block) => stripFencedContent(block.content)),
      ]
        .filter((value): value is string => Boolean(value))
        .join("\n\n");
      const taskIssuesBefore = findings.length;

      if (!agent?.prerequisites?.length && !PREREQUISITE_PATTERN.test(guidance)) {
        missingPrerequisites += 1;
        findings.push(
          makeFinding(page, {
            code: "task-missing-prerequisites",
            severity: "warning",
            category: "task",
            message:
              "Actionable agent guidance is missing prerequisites or an explicit before-you-begin condition.",
          }),
        );
      }

      if (!hasExpectedResult(agent) && !EXPECTED_RESULT_PATTERN.test(guidance)) {
        missingExpectedResults += 1;
        findings.push(
          makeFinding(page, {
            code: "task-missing-expected-result",
            severity: "warning",
            category: "task",
            message:
              "Actionable agent guidance is missing an observable outcome or expected verification result.",
          }),
        );
      }

      if (!hasRecovery(agent) && !RECOVERY_PATTERN.test(guidance)) {
        missingRecovery += 1;
        findings.push(
          makeFinding(page, {
            code: "task-missing-recovery",
            severity: "warning",
            category: "task",
            message:
              "Actionable agent guidance is missing rollback, recovery, or resolved failure-mode steps.",
          }),
        );
      }

      if (findings.length === taskIssuesBefore) completeTaskPages += 1;
    }

    const applicability = analyzeApplicability(page, agent, actionable, options.projectFramework);
    findings.push(...applicability.findings);
    if (applicability.conflicting) conflictingPages += 1;
    if (applicability.ambiguous) ambiguousPages += 1;
    if (applicability.mismatched) mismatchedPages += 1;

    for (const [commandIndex, command] of analysis.shellCommands.entries()) {
      commandCount += 1;
      const commandKey = `${page.sourcePath}:${command.line ?? 1}:${commandIndex}`;
      const commandAnalysis = analyzeCommand({
        page,
        command,
        rootDir,
        packageManager,
        knownDocsCommands,
        packageManifests,
      });
      if (commandAnalysis.status === "unhealthy") unhealthyCommandKeys.add(commandKey);
      if (commandAnalysis.status === "unverified") unverifiedCommandKeys.add(commandKey);
      findings.push(...commandAnalysis.findings);
    }

    if (actionable) {
      const related = normalizeRelated(page.related);
      const validRelated = related.filter((href) => {
        const route = internalRelatedRoute(href);
        return route !== undefined && knownRoutes.has(route);
      });

      for (const href of related) {
        const route = internalRelatedRoute(href);
        if (!route || knownRoutes.has(route)) continue;
        brokenRelatedLinks += 1;
        findings.push(
          makeFinding(page, {
            code: "related-broken",
            severity: "warning",
            category: "related",
            message: `Related page does not resolve to a known docs route: ${href}`,
          }),
        );
      }

      if (validRelated.length > 0) {
        coveredActionablePages += 1;
      } else {
        missingRelatedPages += 1;
        findings.push(
          makeFinding(page, {
            code: "related-missing",
            severity: "suggestion",
            category: "related",
            message: "Actionable agent guidance has no valid related-page route.",
          }),
        );
      }
    }
  }

  const actionablePages = pages.filter((page) => page.actionable).length;
  const usefulBlocks = Math.max(
    0,
    blockQuality.totalBlocks - blockQuality.lowQualityBlockKeys.size,
  );

  return {
    findings: findings.sort(compareFindings),
    metrics: {
      totalPages: pages.length,
      actionablePages,
      agentBlocks: {
        total: blockQuality.totalBlocks,
        pages: pages.filter((page) => page.blocks.length > 0).length,
        duplicate: blockQuality.duplicateBlockKeys.size,
        boilerplate: blockQuality.boilerplateBlockKeys.size,
        generic: blockQuality.genericBlockKeys.size,
        useful: usefulBlocks,
      },
      taskCompleteness: {
        completePages: completeTaskPages,
        missingPrerequisites,
        missingExpectedResults,
        missingRecovery,
        coverage: percentage(completeTaskPages, actionablePages),
      },
      applicability: {
        conflictingPages,
        ambiguousPages,
        mismatchedPages,
      },
      commands: {
        total: commandCount,
        healthy: Math.max(0, commandCount - unhealthyCommandKeys.size - unverifiedCommandKeys.size),
        unhealthy: unhealthyCommandKeys.size,
        unverified: unverifiedCommandKeys.size,
      },
      related: {
        coveredActionablePages,
        missingActionablePages: missingRelatedPages,
        brokenLinks: brokenRelatedLinks,
        coverage: percentage(coveredActionablePages, actionablePages),
      },
    },
  };
}

function analyzePage(page: AgentUsefulnessPage): PageAnalysis {
  const agent = normalizePageAgentFrontmatter(page.agent);
  const blocks = extractAgentBlocks(page.source, {
    sourcePath: page.sourcePath,
    route: page.route,
  });
  const shellCommands = collectPageCommands(page, agent);
  const actionable =
    page.actionable ??
    (hasStructuredPageAgentContract(agent) ||
      shellCommands.length > 0 ||
      blocks.some((block) => ACTIONABLE_PATTERN.test(block.content)) ||
      ACTIONABLE_PATTERN.test(page.agentSource ?? ""));

  return { page, agent, blocks, shellCommands, actionable };
}

function analyzeBlockQuality(
  pages: PageAnalysis[],
  config: AnalyzeAgentUsefulnessOptions["boilerplate"],
) {
  const findings: AgentUsefulnessFinding[] = [];
  const allBlocks = pages.flatMap((analysis) =>
    analysis.blocks.map((block, index) => ({ analysis, block, index })),
  );
  const signatureGroups = new Map<string, typeof allBlocks>();
  const sentenceOccurrences = new Map<string, Set<string>>();
  const blockSentences = new Map<string, string[]>();

  for (const item of allBlocks) {
    const key = blockKey(item.block, item.index);
    const sentences = splitNormalizedSentences(item.block.content);
    blockSentences.set(key, sentences);
    const signature = normalizeBlockSignature(item.block.content);
    if (signature) {
      const group = signatureGroups.get(signature) ?? [];
      group.push(item);
      signatureGroups.set(signature, group);
    }

    for (const sentence of new Set(sentences)) {
      const occurrences = sentenceOccurrences.get(sentence) ?? new Set<string>();
      occurrences.add(key);
      sentenceOccurrences.set(sentence, occurrences);
    }
  }

  const minOccurrences = Math.max(2, Math.round(config?.minOccurrences ?? 3));
  const corpusRatio = clampRatio(config?.corpusRatio ?? 0.2);
  const repeatedThreshold = Math.min(
    minOccurrences,
    Math.max(2, Math.ceil(allBlocks.length * corpusRatio)),
  );
  const blockRatio = clampRatio(config?.blockRatio ?? 0.5);
  const repeatedSentences = new Set(
    [...sentenceOccurrences]
      .filter(([, occurrences]) => occurrences.size >= repeatedThreshold)
      .map(([sentence]) => sentence),
  );
  const duplicateBlockKeys = new Set<string>();
  const boilerplateBlockKeys = new Set<string>();
  const genericBlockKeys = new Set<string>();
  const lowQualityBlockKeys = new Set<string>();

  for (const group of signatureGroups.values()) {
    if (group.length < 2) continue;
    const relatedFiles = Array.from(new Set(group.map((item) => item.block.sourcePath))).sort();
    for (const item of group) {
      const key = blockKey(item.block, item.index);
      duplicateBlockKeys.add(key);
      lowQualityBlockKeys.add(key);
      findings.push(
        makeFinding(item.analysis.page, {
          code: "agent-block-duplicate",
          severity: "warning",
          category: "context",
          line: item.block.line,
          relatedFiles: relatedFiles.filter((file) => file !== item.block.sourcePath),
          message: `Agent block duplicates context used on ${group.length - 1} other page${group.length === 2 ? "" : "s"}.`,
        }),
      );
    }
  }

  for (const item of allBlocks) {
    const key = blockKey(item.block, item.index);
    const sentences = blockSentences.get(key) ?? [];
    const totalChars = sentences.reduce((total, sentence) => total + sentence.length, 0);
    const repeatedChars = sentences
      .filter((sentence) => repeatedSentences.has(sentence))
      .reduce((total, sentence) => total + sentence.length, 0);
    const ratio = totalChars > 0 ? repeatedChars / totalChars : 0;

    if (ratio >= blockRatio) {
      boilerplateBlockKeys.add(key);
      lowQualityBlockKeys.add(key);
      if (!duplicateBlockKeys.has(key)) {
        findings.push(
          makeFinding(item.analysis.page, {
            code: "agent-block-boilerplate",
            severity: "warning",
            category: "context",
            line: item.block.line,
            message: `${Math.round(ratio * 100)}% of this Agent block repeats sentences used across the docs corpus.`,
          }),
        );
      }
    }

    if (isGenericAgentBlock(item.block.content, sentences)) {
      genericBlockKeys.add(key);
      lowQualityBlockKeys.add(key);
      findings.push(
        makeFinding(item.analysis.page, {
          code: "agent-block-generic",
          severity: "suggestion",
          category: "context",
          line: item.block.line,
          message:
            "Agent block is generic and lacks a concrete command, path, identifier, version, or task-specific constraint.",
        }),
      );
    }
  }

  return {
    findings,
    totalBlocks: allBlocks.length,
    duplicateBlockKeys,
    boilerplateBlockKeys,
    genericBlockKeys,
    lowQualityBlockKeys,
  };
}

function analyzeApplicability(
  page: AgentUsefulnessPage,
  agent: PageAgentFrontmatter | undefined,
  actionable: boolean,
  projectFramework?: string,
) {
  const findings: AgentUsefulnessFinding[] = [];
  const topFrameworks = normalizeFrameworks(page.framework);
  const contractFrameworks = normalizeFrameworks(agent?.appliesTo?.framework);
  const topVersions = normalizeValues(page.version);
  const contractVersions = normalizeValues(agent?.appliesTo?.version);
  let conflicting = false;
  let ambiguous = false;
  let mismatched = false;

  if (
    topFrameworks.length > 0 &&
    contractFrameworks.length > 0 &&
    !setsOverlap(topFrameworks, contractFrameworks)
  ) {
    conflicting = true;
    findings.push(
      makeFinding(page, {
        code: "applicability-framework-conflict",
        severity: "warning",
        category: "applicability",
        message: `Top-level framework (${topFrameworks.join(", ")}) conflicts with agent.appliesTo.framework (${contractFrameworks.join(", ")}).`,
      }),
    );
  }

  if (
    topVersions.length > 0 &&
    contractVersions.length > 0 &&
    !versionSetsCompatible(topVersions, contractVersions)
  ) {
    conflicting = true;
    findings.push(
      makeFinding(page, {
        code: "applicability-version-conflict",
        severity: "warning",
        category: "applicability",
        message: `Top-level version (${topVersions.join(", ")}) conflicts with agent.appliesTo.version (${contractVersions.join(", ")}).`,
      }),
    );
  }

  const declaredFrameworks = Array.from(new Set([...topFrameworks, ...contractFrameworks]));
  const inferredFrameworks = inferFrameworks(`${page.source}\n${page.agentSource ?? ""}`);
  if (actionable && declaredFrameworks.length === 0 && inferredFrameworks.length > 1) {
    ambiguous = true;
    findings.push(
      makeFinding(page, {
        code: "applicability-framework-ambiguous",
        severity: "warning",
        category: "applicability",
        message: `Actionable page references multiple frameworks (${inferredFrameworks.join(", ")}) without framework applicability metadata.`,
      }),
    );
  }

  const normalizedProjectFramework = projectFramework
    ? normalizeAgentFramework(projectFramework)
    : undefined;
  const effectiveFrameworks =
    declaredFrameworks.length > 0 ? declaredFrameworks : inferredFrameworks;
  if (
    actionable &&
    normalizedProjectFramework &&
    effectiveFrameworks.length > 0 &&
    !effectiveFrameworks.includes(normalizedProjectFramework)
  ) {
    mismatched = true;
    findings.push(
      makeFinding(page, {
        code: "applicability-framework-mismatch",
        severity: "warning",
        category: "applicability",
        message: `Page applicability (${effectiveFrameworks.join(", ")}) does not include the detected project framework (${normalizedProjectFramework}).`,
      }),
    );
  }

  if (
    actionable &&
    topVersions.length === 0 &&
    contractVersions.length === 0 &&
    hasAmbiguousVersionSignals(`${page.source}\n${page.agentSource ?? ""}`)
  ) {
    ambiguous = true;
    findings.push(
      makeFinding(page, {
        code: "applicability-version-ambiguous",
        severity: "warning",
        category: "applicability",
        message:
          "Actionable page discusses multiple current, legacy, or migrated versions without version applicability metadata.",
      }),
    );
  }

  return { findings, conflicting, ambiguous, mismatched };
}

function analyzeCommand(options: {
  page: AgentUsefulnessPage;
  command: AnalyzedCommand;
  rootDir: string;
  packageManager?: string;
  knownDocsCommands: Set<string>;
  packageManifests: Map<string, ProjectPackageManifest>;
}): CommandAnalysis {
  const findings: AgentUsefulnessFinding[] = [];
  let verificationEstablished = false;
  const commandText = normalizeShellCommand(options.command.run);
  if (!commandText) return commandAnalysis(findings);

  let commandCwd = options.command.cwd ?? ".";
  const inlineCwd = /^(?:cd)\s+([^;&|]+?)\s*&&\s*(.+)$/s.exec(commandText);
  const executableCommand = inlineCwd?.[2]?.trim() ?? commandText;
  if (inlineCwd?.[1]) commandCwd = stripShellQuotes(inlineCwd[1].trim());

  const resolvedCwd = path.resolve(options.rootDir, commandCwd);
  if (!isPathInside(options.rootDir, resolvedCwd)) {
    findings.push(
      commandFinding(options, {
        code: "command-cwd-outside-root",
        severity: "error",
        message: `Command working directory resolves outside the project root: ${commandCwd}`,
      }),
    );
    return commandAnalysis(findings);
  }

  if (!existsSync(resolvedCwd)) {
    findings.push(
      commandFinding(options, {
        code: "command-cwd-missing",
        severity: "error",
        message: `Command working directory does not exist: ${commandCwd}`,
      }),
    );
    return commandAnalysis(findings);
  }

  const tokens = tokenizeShellCommand(executableCommand);
  const commandPackageManager = readCommandPackageManager(tokens);
  const expectedPackageManager =
    options.command.packageManagerHint ??
    (options.command.source === "contract" ? options.packageManager : undefined);
  if (
    commandPackageManager &&
    expectedPackageManager &&
    commandPackageManager !== expectedPackageManager
  ) {
    findings.push(
      commandFinding(options, {
        code: "command-package-manager-mismatch",
        severity: "warning",
        message: `Command uses ${commandPackageManager}, but ${expectedPackageManager} is expected for this project or code block.`,
      }),
    );
  }

  const workspaceSelection = readWorkspaceSelection(tokens, commandPackageManager);
  const workspaceResolution = resolveWorkspaceSelection(
    workspaceSelection,
    options.packageManifests,
    options.rootDir,
  );
  if (workspaceResolution.status === "unresolved") {
    const selectors = workspaceSelection.selectors.length
      ? workspaceSelection.selectors.join(", ")
      : "all workspaces";
    findings.push(
      commandFinding(options, {
        code: "command-unverified",
        severity: "suggestion",
        message: `Workspace selector could not be resolved statically (${selectors}); this command is unverified.`,
      }),
    );
  }

  const script = readPackageScript(tokens);
  if (script) {
    const packageJsons =
      workspaceResolution.status === "resolved"
        ? workspaceResolution.manifests
        : workspaceResolution.status === "none"
          ? [readNearestPackageJson(resolvedCwd, options.rootDir)].filter(
              (manifest): manifest is ProjectPackageManifest => Boolean(manifest),
            )
          : [];

    if (workspaceResolution.status === "none" && packageJsons.length === 0) {
      findings.push(
        commandFinding(options, {
          code: "command-unverified",
          severity: "suggestion",
          message: `No package.json could be found for package script "${script}"; this command is unverified.`,
        }),
      );
    }

    for (const packageJson of packageJsons) {
      if (packageJson.scripts.has(script)) {
        verificationEstablished = true;
      } else {
        findings.push(
          commandFinding(options, {
            code: "command-script-missing",
            severity: "error",
            message: `Command references package script "${script}", but that script is not defined in ${packageJson.relativePath}.`,
          }),
        );
      }
    }
  }

  const docsCommand = readDocsCommand(tokens);
  if (docsCommand) {
    if (matchesKnownDocsCommand(docsCommand, options.knownDocsCommands)) {
      verificationEstablished = true;
    } else {
      findings.push(
        commandFinding(options, {
          code: "command-cli-unknown",
          severity: "error",
          message: `Command references an unknown docs CLI command: docs ${docsCommand}`,
        }),
      );
    }
  }

  if (isStaticallyKnownPackageManagerCommand(tokens) || isVersionProbe(tokens)) {
    verificationEstablished = true;
  }

  if (!verificationEstablished && findings.length === 0) {
    findings.push(
      commandFinding(options, {
        code: "command-unverified",
        severity: "suggestion",
        message: "Command form could not be verified statically; this command is unverified.",
      }),
    );
  }

  return commandAnalysis(findings);
}

function commandAnalysis(findings: AgentUsefulnessFinding[]): CommandAnalysis {
  if (findings.some((finding) => finding.code !== "command-unverified")) {
    return { findings, status: "unhealthy" };
  }
  if (findings.length > 0) return { findings, status: "unverified" };
  return { findings, status: "healthy" };
}

function collectPageCommands(
  page: AgentUsefulnessPage,
  agent: PageAgentFrontmatter | undefined,
): AnalyzedCommand[] {
  const commands: AnalyzedCommand[] = [];

  for (const command of agent?.commands ?? []) {
    commands.push(normalizeAgentCommand(command, page.sourcePath));
  }

  for (const verification of agent?.verification ?? []) {
    if (typeof verification !== "string" && verification.run) {
      commands.push({
        run: verification.run,
        sourcePath: page.sourcePath,
        source: "contract",
      });
    }
  }

  collectMarkdownCommands(commands, page.source, page.sourcePath);
  if (page.agentSource) {
    collectMarkdownCommands(commands, page.agentSource, page.agentSourcePath ?? page.sourcePath);
  }

  return dedupeCommands(commands);
}

function collectMarkdownCommands(commands: AnalyzedCommand[], source: string, sourcePath: string) {
  const blocks = extractCodeBlocksFromMarkdown({
    source,
    filePath: sourcePath,
    relativePath: sourcePath,
  });

  for (const block of blocks) {
    if (!/^(?:bash|console|sh|shell|zsh)$/i.test(block.language ?? "")) continue;
    for (const command of shellLines(block.code, block.language)) {
      commands.push({
        run: command,
        line: block.lineStart,
        sourcePath,
        packageManagerHint: block.packageManager,
        source: "fence",
      });
    }
  }
}

function normalizeAgentCommand(
  command: string | PageAgentCommand,
  sourcePath: string,
): AnalyzedCommand {
  return typeof command === "string"
    ? { run: command, sourcePath, source: "contract" }
    : { run: command.run, cwd: command.cwd, sourcePath, source: "contract" };
}

function shellLines(code: string, language: string | undefined): string[] {
  const joined = code.replace(/\\\s*\r?\n\s*/g, " ");
  const lines = joined.split(/\r?\n/);
  const promptedConsole =
    language?.toLowerCase() === "console" && lines.some((line) => /^(?:\$|>)\s+/.test(line.trim()));

  return lines
    .map((line) => line.trim())
    .filter((line) => !promptedConsole || /^(?:\$|>)\s+/.test(line))
    .map((line) => line.replace(/^(?:\$|>)\s+/, ""))
    .filter((line) => Boolean(line) && !line.startsWith("#") && !/^\w+=\S+$/.test(line));
}

function dedupeCommands(commands: AnalyzedCommand[]): AnalyzedCommand[] {
  const seen = new Set<string>();
  return commands.filter((command) => {
    const key = `${command.sourcePath ?? ""}\0${command.cwd ?? ""}\0${command.run}\0${command.packageManagerHint ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasExpectedResult(agent: PageAgentFrontmatter | undefined): boolean {
  if (agent?.outcome) return true;
  return Boolean(
    agent?.verification?.some((step) => {
      if (typeof step === "string") return EXPECTED_RESULT_PATTERN.test(step);
      return Boolean(step.expect?.trim() || EXPECTED_RESULT_PATTERN.test(step.description ?? ""));
    }),
  );
}

function hasRecovery(agent: PageAgentFrontmatter | undefined): boolean {
  if (agent?.rollback?.length) return true;
  return Boolean(
    agent?.failureModes?.some((mode) => {
      if (typeof mode === "string") return RECOVERY_PATTERN.test(mode);
      return Boolean(mode.resolution?.trim());
    }),
  );
}

function splitNormalizedSentences(content: string): string[] {
  const withoutFences = stripFencedContent(content);
  const sentences: string[] = [];

  for (const line of withoutFences.split(/\r?\n/)) {
    const cleanedLine = line
      .replace(/^\s*(?:[-*+] |\d+[.)] )/, "")
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .trim();
    if (!cleanedLine) continue;
    const parts = cleanedLine.match(/[^.!?]+[.!?]?/g) ?? [cleanedLine];
    for (const part of parts) {
      const normalized = normalizeSentence(part);
      if (normalized) sentences.push(normalized);
    }
  }

  return sentences;
}

function normalizeSentence(value: string): string {
  return value
    .replace(/!?(?:\[([^\]]*)\])\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeBlockSignature(content: string): string {
  const signature: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;

  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim();
    const nextFence = advanceFence(trimmed, fence);

    if (fence) {
      if (nextFence) {
        // Code is case- and indentation-sensitive. Preserve it exactly.
        signature.push(`code:${line}`);
      } else {
        signature.push("fence:end");
      }
      fence = nextFence;
      continue;
    }

    if (nextFence) {
      signature.push(`fence:start:${trimmed}`);
      fence = nextFence;
      continue;
    }

    const prose = normalizeSentence(line);
    if (prose) signature.push(`prose:${prose}`);
  }

  return signature.join("\n");
}

function stripFencedContent(source: string): string {
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;

  for (const line of source.split(/\r?\n/)) {
    const nextFence = advanceFence(line.trim(), fence);
    if (!fence && !nextFence) output.push(line);
    fence = nextFence;
  }

  return output.join("\n");
}

function advanceFence(line: string, fence: { character: "`" | "~"; length: number } | undefined) {
  if (fence) {
    const closing = /^(`+|~+)\s*$/.exec(line)?.[1];
    if (closing?.[0] === fence.character && closing.length >= fence.length) return undefined;
    return fence;
  }

  const opening = /^(`{3,}|~{3,})(.*)$/.exec(line)?.[1];
  if (!opening) return undefined;
  return {
    character: opening[0] as "`" | "~",
    length: opening.length,
  };
}

function isGenericAgentBlock(content: string, sentences: string[]): boolean {
  const words = normalizeSentence(content).match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
  const hasSpecificContext = hasMeaningfulSpecificContext(content);
  const genericSentences = sentences.filter((sentence) => GENERIC_SENTENCE_PATTERN.test(sentence));
  const totalSentenceChars = sentences.reduce((total, sentence) => total + sentence.length, 0);
  const genericSentenceChars = genericSentences.reduce(
    (total, sentence) => total + sentence.length,
    0,
  );
  const genericRatio = totalSentenceChars > 0 ? genericSentenceChars / totalSentenceChars : 0;
  return (
    (!hasSpecificContext && words.length < 12) ||
    (!hasSpecificContext && sentences.length > 0 && genericRatio >= 0.67)
  );
}

function hasMeaningfulSpecificContext(content: string): boolean {
  if (STRONG_SPECIFIC_CONTEXT_PATTERN.test(content)) return true;
  if (!ACTIONABLE_PATTERN.test(content)) return false;

  if (/https?:\/\/[^\s)]+/i.test(content)) return true;

  const trivialInlineValues = new Set(["config", "documentation", "docs", "page", "settings"]);
  return [...content.matchAll(/`([^`\n]+)`/g)].some((match) => {
    const value = (match[1] ?? "").trim().toLowerCase();
    return value.length >= 3 && !trivialInlineValues.has(value);
  });
}

function normalizeFrameworks(value: string | string[] | undefined): string[] {
  return normalizeValues(value).map(normalizeAgentFramework);
}

function normalizeValues(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(
    new Set(values.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0)),
  );
}

function inferFrameworks(source: string): string[] {
  return FRAMEWORK_PATTERNS.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}

function hasAmbiguousVersionSignals(source: string): boolean {
  if (!/\b(?:current|deprecated|latest|legacy|migrat(?:e|ion)|version)\b/i.test(source)) {
    return false;
  }
  const versions = new Set(
    [...source.matchAll(/\b(?:v|version\s*)(\d+(?:\.\d+){0,2})\b/gi)].map((match) => match[1]),
  );
  return versions.size > 1;
}

function versionSetsCompatible(left: string[], right: string[]): boolean {
  return left.some((leftVersion) =>
    right.some((rightVersion) => versionsCompatible(leftVersion, rightVersion)),
  );
}

function versionsCompatible(left: string, right: string): boolean {
  const normalizedLeft = normalizeAgentVersion(left);
  const normalizedRight = normalizeAgentVersion(right);
  if (normalizedLeft === normalizedRight) return true;

  if (isVersionConstraint(normalizedLeft) && isVersionConstraint(normalizedRight)) {
    return agentVersionConstraintsOverlap(normalizedLeft, normalizedRight);
  }

  // Named channels need an external release policy to prove a conflict.
  return true;
}

function isExactVersion(value: string): boolean {
  return /^\d+(?:\.\d+){0,2}(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i.test(value);
}

function isVersionConstraint(value: string): boolean {
  return isExactVersion(value) || /(?:[<>=~^*x]|\|\||\s+-\s+)/i.test(value);
}

function setsOverlap(left: string[], right: string[]): boolean {
  return left.some((value) => right.includes(value));
}

function normalizeRelated(related: Array<string | { href: string }> | undefined): string[] {
  if (!related) return [];
  return Array.from(
    new Set(
      related
        .map((item) => (typeof item === "string" ? item : item.href))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function internalRelatedRoute(href: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return undefined;
  const pathname = href.split(/[?#]/, 1)[0];
  if (!pathname) return undefined;
  return normalizeRoute(pathname);
}

function normalizeRoute(route: string): string {
  const normalized = `/${route}`.replace(/\/+/g, "/").replace(/\.md$/i, "");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function detectPackageManager(rootDir: string): "npm" | "pnpm" | "yarn" | "bun" | undefined {
  if (existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(rootDir, "bun.lock")) || existsSync(path.join(rootDir, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync(path.join(rootDir, "package-lock.json"))) return "npm";

  const packageJson = readJsonFile(path.join(rootDir, "package.json"));
  const declared =
    typeof packageJson?.packageManager === "string" ? packageJson.packageManager : "";
  const name = /^(npm|pnpm|yarn|bun)@/.exec(declared)?.[1];
  return name as "npm" | "pnpm" | "yarn" | "bun" | undefined;
}

function normalizeShellCommand(command: string): string {
  return command.trim().replace(/^\$\s*/, "");
}

function tokenizeShellCommand(command: string): string[] {
  return command.match(/"[^"]*"|'[^']*'|[^\s]+/g)?.map(stripShellQuotes) ?? [];
}

function stripShellQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readCommandPackageManager(tokens: string[]): string | undefined {
  const command = tokens[0];
  if (command === "npx") return "npm";
  if (command === "pnpx") return "pnpm";
  if (command === "bunx") return "bun";
  return command && command in PACKAGE_MANAGER_BUILT_INS ? command : undefined;
}

function readPackageScript(tokens: string[]): string | undefined {
  const manager = readCommandPackageManager(tokens);
  if (!manager) return undefined;

  if (["npx", "pnpx", "bunx"].includes(tokens[0] ?? "")) return undefined;

  if (manager === "yarn") {
    const workspaceIndex = findPackageManagerCommandIndex(tokens);
    if (workspaceIndex >= 0 && tokens[workspaceIndex] === "workspace") {
      return readScriptFromArguments(manager, tokens.slice(workspaceIndex + 2));
    }
  }

  return readScriptFromArguments(manager, readPackageManagerArguments(tokens));
}

function readScriptFromArguments(manager: string, commandArguments: string[]): string | undefined {
  if (["dlx", "exec", "x"].includes(commandArguments[0] ?? "")) return undefined;
  if (["run", "run-script"].includes(commandArguments[0] ?? "")) {
    return cleanShellToken(commandArguments[1]);
  }

  const candidate = cleanShellToken(commandArguments[0]);
  if (!candidate) return undefined;
  if (["start", "stop", "restart", "test"].includes(candidate)) {
    return candidate;
  }
  return PACKAGE_MANAGER_BUILT_INS[manager]?.has(candidate) ? undefined : candidate;
}

function readWorkspaceSelection(tokens: string[], manager: string | undefined): WorkspaceSelection {
  if (!manager) return { requested: false, selectors: [] };

  if (manager === "pnpm" || manager === "bun") {
    const selectors = readOptionValues(tokens, ["--filter"], manager === "pnpm" ? ["-F"] : []);
    const recursive = manager === "pnpm" && hasOptionBeforeCommand(tokens, ["-r", "--recursive"]);
    return { requested: selectors.length > 0 || recursive, selectors };
  }

  if (manager === "npm") {
    const selectors = readOptionValues(tokens, ["--workspace"], ["-w"]);
    const allWorkspaces = hasOptionBeforeCommand(tokens, ["--workspaces"]);
    return { requested: selectors.length > 0 || allWorkspaces, selectors };
  }

  if (manager === "yarn") {
    const workspaceIndex = findPackageManagerCommandIndex(tokens);
    if (workspaceIndex >= 0 && tokens[workspaceIndex] === "workspace") {
      const selector = cleanShellToken(tokens[workspaceIndex + 1]);
      return { requested: true, selectors: selector ? [selector] : [] };
    }
    if (workspaceIndex >= 0 && tokens[workspaceIndex] === "workspaces") {
      return { requested: true, selectors: [] };
    }
  }

  return { requested: false, selectors: [] };
}

function readOptionValues(
  tokens: string[],
  longOptions: string[],
  shortOptions: string[],
): string[] {
  const values: string[] = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (token === "--" || !token.startsWith("-")) break;

    if ([...longOptions, ...shortOptions].includes(token)) {
      const value = cleanShellToken(tokens[index + 1]);
      if (value) values.push(value);
      index += 1;
      continue;
    }

    const longOption = longOptions.find((option) => token.startsWith(`${option}=`));
    if (longOption) {
      const value = cleanShellToken(token.slice(longOption.length + 1));
      if (value) values.push(value);
      continue;
    }

    if (PACKAGE_MANAGER_OPTIONS_WITH_VALUES.has(token)) {
      index += 1;
      continue;
    }

    const shortOption = shortOptions.find(
      (option) => token.startsWith(option) && token.length > option.length,
    );
    if (shortOption) {
      const inlineValue = token.slice(shortOption.length).replace(/^=/, "");
      const value = cleanShellToken(inlineValue);
      if (value) values.push(value);
    }
  }
  return values;
}

function readPackageManagerArguments(tokens: string[]): string[] {
  const commandArguments: string[] = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (token === "--") break;
    if (PACKAGE_MANAGER_OPTIONS_WITH_VALUES.has(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith("-")) continue;
    commandArguments.push(token);
  }
  return commandArguments;
}

function findPackageManagerCommandIndex(tokens: string[]): number {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (token === "--") return -1;
    if (PACKAGE_MANAGER_OPTIONS_WITH_VALUES.has(token)) {
      index += 1;
      continue;
    }
    if (!token.startsWith("-")) return index;
  }
  return -1;
}

function hasOptionBeforeCommand(tokens: string[], options: string[]): boolean {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (token === "--" || !token.startsWith("-")) return false;
    if (options.includes(token)) return true;
    if (PACKAGE_MANAGER_OPTIONS_WITH_VALUES.has(token)) index += 1;
  }
  return false;
}

function isStaticallyKnownPackageManagerCommand(tokens: string[]): boolean {
  const manager = readCommandPackageManager(tokens);
  if (!manager || ["npx", "pnpx", "bunx"].includes(tokens[0] ?? "")) return false;

  const command = readPackageManagerArguments(tokens)[0];
  if (!command || ["dlx", "exec", "x"].includes(command)) return false;
  return Boolean(PACKAGE_MANAGER_BUILT_INS[manager]?.has(command));
}

function isVersionProbe(tokens: string[]): boolean {
  return (
    tokens.length === 2 &&
    ["node", "deno", "bun", "npm", "pnpm", "yarn"].includes(tokens[0] ?? "") &&
    ["--version", "-v"].includes(tokens[1] ?? "")
  );
}

function resolveWorkspaceSelection(
  selection: WorkspaceSelection,
  manifests: Map<string, ProjectPackageManifest>,
  rootDir: string,
): WorkspaceResolution {
  if (!selection.requested) return { status: "none", manifests: [] };
  if (selection.selectors.length === 0) return { status: "unresolved", manifests: [] };

  const resolved: ProjectPackageManifest[] = [];
  for (const rawSelector of selection.selectors) {
    const selector = rawSelector.trim();
    if (!selector || selector.startsWith("!") || /(?:\.\.\.|[?*[\]{}<>])/.test(selector)) {
      return { status: "unresolved", manifests: [] };
    }

    const namedManifest = manifests.get(selector);
    if (namedManifest) {
      resolved.push(namedManifest);
      continue;
    }

    const selectorPath = path.resolve(rootDir, selector);
    const pathManifest = [...manifests.values()].find(
      (manifest) => path.resolve(manifest.directory) === selectorPath,
    );
    if (!pathManifest) return { status: "unresolved", manifests: [] };
    resolved.push(pathManifest);
  }

  return { status: "resolved", manifests: Array.from(new Set(resolved)) };
}

function cleanShellToken(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/[;&|]+$/, "").trim();
  return cleaned || undefined;
}

function readDocsCommand(tokens: string[]): string | undefined {
  const first = tokens[0] ?? "";
  const isDocsBinary = (token: string) =>
    token === "docs" || (!token.startsWith("@") && /(?:^|\/)\.?(?:bin\/)?docs$/.test(token));
  let commandStart = -1;

  if (isDocsBinary(first)) {
    commandStart = 1;
  } else if (["npx", "pnpx", "bunx"].includes(first) && tokens[1] === "@farming-labs/docs") {
    commandStart = 2;
  } else if (["npm", "pnpm", "yarn", "bun"].includes(first)) {
    const launcherIndex = tokens.findIndex(
      (token, index) => index > 0 && ["dlx", "exec", "x"].includes(token),
    );
    if (launcherIndex >= 0) {
      const binaryIndex = tokens.findIndex(
        (token, index) =>
          index > launcherIndex && (token === "@farming-labs/docs" || isDocsBinary(token)),
      );
      if (binaryIndex >= 0) commandStart = binaryIndex + 1;
    }
  }

  if (commandStart < 0) return undefined;
  return tokens
    .slice(commandStart)
    .filter((token) => !token.startsWith("-"))
    .slice(0, 2)
    .map((token) => cleanShellToken(token))
    .filter((token): token is string => Boolean(token))
    .join(" ");
}

function matchesKnownDocsCommand(command: string, known: Set<string>): boolean {
  if (!command) return true;
  if (known.has(command)) return true;
  const first = command.split(" ")[0];
  return known.has(first);
}

function readNearestPackageJson(
  startDir: string,
  rootDir: string,
): ProjectPackageManifest | undefined {
  let current = startDir;
  while (isPathInside(rootDir, current)) {
    const packagePath = path.join(current, "package.json");
    const contents = readJsonFile(packagePath);
    if (contents) {
      const scripts =
        contents.scripts && typeof contents.scripts === "object" && !Array.isArray(contents.scripts)
          ? new Set(Object.keys(contents.scripts as Record<string, unknown>))
          : new Set<string>();
      return {
        directory: current,
        scripts,
        relativePath: path.relative(rootDir, packagePath).replace(/\\/g, "/") || "package.json",
      };
    }
    if (current === rootDir) break;
    current = path.dirname(current);
  }
  return undefined;
}

function readProjectPackageManifests(rootDir: string): Map<string, ProjectPackageManifest> {
  const manifests = new Map<string, ProjectPackageManifest>();
  const ignored = new Set([
    ".git",
    ".next",
    ".nuxt",
    ".output",
    ".svelte-kit",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
  ]);

  const visit = (directory: string) => {
    const packagePath = path.join(directory, "package.json");
    const contents = readJsonFile(packagePath);
    if (contents) {
      const name = typeof contents.name === "string" ? contents.name.trim() : "";
      const scripts =
        contents.scripts && typeof contents.scripts === "object" && !Array.isArray(contents.scripts)
          ? new Set(Object.keys(contents.scripts as Record<string, unknown>))
          : new Set<string>();
      if (name) {
        manifests.set(name, {
          directory,
          scripts,
          relativePath: path.relative(rootDir, packagePath).replace(/\\/g, "/") || "package.json",
        });
      }
    }

    let names: string[];
    try {
      names = readdirSync(directory);
    } catch {
      return;
    }
    for (const name of names) {
      if (ignored.has(name)) continue;
      const child = path.join(directory, name);
      try {
        if (lstatSync(child).isDirectory()) visit(child);
      } catch {
        // Ignore files that disappear or cannot be inspected during diagnostics.
      }
    }
  };

  visit(rootDir);
  return manifests;
}

function readJsonFile(filePath: string): Record<string, unknown> | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function isPathInside(rootDir: string, candidate: string): boolean {
  const relative = path.relative(rootDir, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function commandFinding(
  options: { page: AgentUsefulnessPage; command: AnalyzedCommand },
  finding: Pick<AgentUsefulnessFinding, "code" | "severity" | "message">,
): AgentUsefulnessFinding {
  return {
    ...makeFinding(options.page, {
      ...finding,
      category: "command",
      line: options.command.line,
      command: options.command.run,
    }),
    file: options.command.sourcePath ?? options.page.sourcePath,
  };
}

function makeFinding(
  page: AgentUsefulnessPage,
  finding: Omit<AgentUsefulnessFinding, "file" | "route">,
): AgentUsefulnessFinding {
  return {
    ...finding,
    file: page.sourcePath,
    route: page.route,
  };
}

function blockKey(block: AgentBlockOccurrence, index: number): string {
  return `${block.sourcePath}:${block.line}:${index}`;
}

function compareFindings(left: AgentUsefulnessFinding, right: AgentUsefulnessFinding): number {
  return (
    left.file.localeCompare(right.file) ||
    (left.line ?? 0) - (right.line ?? 0) ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import pc from "picocolors";
import type { DocsConfig, DocsReviewCiMode } from "../types.js";
import {
  ensureDocsReviewWorkflow,
  readDocsReviewConfigFromSource,
  resolveDocsReviewConfig,
  type ResolvedDocsReviewConfig,
} from "../review.js";
import {
  loadDocsConfigModule,
  readTopLevelStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";

type ReviewFindingSeverity = "error" | "warn" | "suggestion";

export interface ReviewOptions {
  configPath?: string;
  ci?: boolean;
  json?: boolean;
  setup?: boolean;
  base?: string;
  head?: string;
  mode?: DocsReviewCiMode;
  scoreThreshold?: number;
}

export interface ParsedReviewArgs extends ReviewOptions {
  help?: boolean;
}

export interface DocsReviewFinding {
  rule: string;
  severity: ReviewFindingSeverity;
  file: string;
  line?: number;
  message: string;
}

export interface DocsReviewReport {
  score: number;
  threshold: number;
  mode: DocsReviewCiMode | "local";
  reviewedFiles: string[];
  changedFiles: string[];
  findings: DocsReviewFinding[];
}

interface DocsPageFile {
  relativePath: string;
  absolutePath: string;
  route: string;
  markdownRoute: string;
}

const DOCS_FILE_PATTERN = /\.(?:md|mdx)$/;
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

export function parseReviewArgs(argv: string[]): ParsedReviewArgs {
  const parsed: ParsedReviewArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "setup") {
      parsed.setup = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--ci") {
      parsed.ci = true;
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--config" || arg === "--base" || arg === "--head" || arg === "--mode") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}.`);
      }
      if (arg === "--config") parsed.configPath = value;
      if (arg === "--base") parsed.base = value;
      if (arg === "--head") parsed.head = value;
      if (arg === "--mode") parsed.mode = parseReviewCiMode(value);
      index += 1;
      continue;
    }

    if (arg === "--score-threshold") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --score-threshold.");
      }
      parsed.scoreThreshold = Number.parseInt(value, 10);
      index += 1;
      continue;
    }

    if (arg.startsWith("--config=")) {
      parsed.configPath = readInlineFlag(arg, "--config=");
      continue;
    }

    if (arg.startsWith("--base=")) {
      parsed.base = readInlineFlag(arg, "--base=");
      continue;
    }

    if (arg.startsWith("--head=")) {
      parsed.head = readInlineFlag(arg, "--head=");
      continue;
    }

    if (arg.startsWith("--mode=")) {
      parsed.mode = parseReviewCiMode(readInlineFlag(arg, "--mode="));
      continue;
    }

    if (arg.startsWith("--score-threshold=")) {
      parsed.scoreThreshold = Number.parseInt(readInlineFlag(arg, "--score-threshold="), 10);
      continue;
    }

    throw new Error(`Unknown review flag: ${arg}.`);
  }

  return parsed;
}

export async function runReview(options: ReviewOptions = {}): Promise<DocsReviewReport | void> {
  const rootDir = process.cwd();
  const configPath = resolveDocsConfigPath(rootDir, options.configPath);
  const configContent = readFileSync(configPath, "utf-8");
  const loadedConfig = await loadDocsConfigModule(rootDir, options.configPath);
  const config = loadedConfig?.config;
  const reviewInput = config?.review ?? readDocsReviewConfigFromSource(configContent);
  const review = withReviewOptionOverrides(
    resolveDocsReviewConfig(reviewInput),
    options.mode,
    options.scoreThreshold,
  );

  if (options.setup) {
    const result = ensureDocsReviewWorkflow({
      rootDir,
      config,
      configPath: path.relative(rootDir, configPath),
      configContent,
      log: (message) => console.log(pc.green(message)),
    });
    if (result.status === "exists") console.log(pc.dim(`${result.relativePath} already exists.`));
    if (result.status === "disabled") {
      console.log(pc.yellow("Docs Review CI is disabled in docs.config."));
    }
    return;
  }

  if (!review.enabled) {
    const report: DocsReviewReport = {
      score: 100,
      threshold: review.score.threshold,
      mode: options.ci ? review.ci.mode : "local",
      reviewedFiles: [],
      changedFiles: [],
      findings: [],
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(pc.yellow("Docs Review is disabled in docs.config."));
    }

    return report;
  }

  const entry = config?.entry ?? readTopLevelStringProperty(configContent, "entry") ?? "docs";
  const contentDir = config?.contentDir ?? resolveDocsContentDir(rootDir, configContent, entry);
  const pages = scanDocsPages(rootDir, contentDir, entry);
  const changedFiles = getChangedFiles(rootDir, options);
  const relevantFiles = selectReviewFiles({
    changedFiles,
    pages,
    configPath: path.relative(rootDir, configPath),
    rootDir,
    contentDir,
  });
  const findings = collectReviewFindings({
    rootDir,
    entry,
    pages,
    files: relevantFiles,
    review,
  });
  const score = calculateReviewScore(findings, review);
  const mode = options.ci ? review.ci.mode : "local";
  const report: DocsReviewReport = {
    score,
    threshold: review.score.threshold,
    mode,
    reviewedFiles: relevantFiles,
    changedFiles,
    findings,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReviewReport(report);
  }

  if (options.ci && review.ci.annotations) {
    emitGitHubAnnotations(report.findings);
  }

  if (
    options.ci &&
    review.ci.mode === "block" &&
    (score < review.score.threshold || findings.some((finding) => finding.severity === "error"))
  ) {
    process.exitCode = 1;
  }

  return report;
}

export function printReviewHelp() {
  console.log(`
${pc.bold("docs review")} — Review changed docs content for CI and agent-readiness.

${pc.dim("Usage:")}
  pnpm exec docs ${pc.cyan("review")} ${pc.dim("[--ci]")}
  pnpm exec docs ${pc.cyan("review setup")}

${pc.dim("Options:")}
  ${pc.cyan("--ci")}                         Use docs.config review.ci behavior and GitHub annotations
  ${pc.cyan("--json")}                       Print JSON report
  ${pc.cyan("--config <path>")}              Use a custom docs config path
  ${pc.cyan("--base <ref> --head <ref>")}    Review files changed between two git refs
  ${pc.cyan("--mode <off|warn|block>")}      Override review.ci.mode
  ${pc.cyan("--score-threshold <0-100>")}    Override review.score.threshold
`);
}

function withReviewOptionOverrides(
  review: ResolvedDocsReviewConfig,
  mode?: DocsReviewCiMode,
  scoreThreshold?: number,
): ResolvedDocsReviewConfig {
  return {
    ...review,
    ci: mode ? { ...review.ci, mode, enabled: mode !== "off" } : review.ci,
    score:
      typeof scoreThreshold === "number" && Number.isFinite(scoreThreshold)
        ? { ...review.score, threshold: Math.max(0, Math.min(100, Math.round(scoreThreshold))) }
        : review.score,
  };
}

function collectReviewFindings(options: {
  rootDir: string;
  entry: string;
  pages: DocsPageFile[];
  files: string[];
  review: ResolvedDocsReviewConfig;
}): DocsReviewFinding[] {
  const findings: DocsReviewFinding[] = [];
  const knownRoutes = new Set<string>();
  const slugSources = new Map<string, string>();

  for (const page of options.pages) {
    knownRoutes.add(page.route);
    knownRoutes.add(page.markdownRoute);
    if (slugSources.has(page.route)) {
      pushFinding(findings, options.review, {
        rule: "duplicateSlugs",
        severity: "error",
        file: page.relativePath,
        message: `Duplicate docs route ${page.route}; already used by ${slugSources.get(page.route)}.`,
      });
    } else {
      slugSources.set(page.route, page.relativePath);
    }
  }

  for (const file of options.files) {
    if (!DOCS_FILE_PATTERN.test(file)) continue;

    const absolutePath = path.join(options.rootDir, file);
    if (!existsSync(absolutePath)) continue;

    let source = "";
    let parsed: matter.GrayMatterFile<string> | undefined;
    try {
      source = readFileSync(absolutePath, "utf-8");
      parsed = matter(source);
    } catch (error) {
      pushFinding(findings, options.review, {
        rule: "invalidMdx",
        severity: "error",
        file,
        message: `Could not read or parse this docs file: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    if (!file.endsWith("agent.md")) {
      checkFrontmatter(findings, options.review, file, parsed.data);
      checkAgentContext(findings, options.review, {
        file,
        source,
        rootDir: options.rootDir,
      });
    }

    checkBrokenLinks(findings, options.review, {
      file,
      source,
      entry: options.entry,
      knownRoutes,
    });
    checkCodeFences(findings, options.review, { file, source });
  }

  return findings;
}

function checkFrontmatter(
  findings: DocsReviewFinding[],
  review: ResolvedDocsReviewConfig,
  file: string,
  data: Record<string, unknown>,
) {
  if (!data.title || typeof data.title !== "string") {
    pushFinding(findings, review, {
      rule: "frontmatter",
      severity: "error",
      file,
      line: 1,
      message: "Missing frontmatter title.",
    });
  }

  if (!data.description || typeof data.description !== "string") {
    pushFinding(findings, review, {
      rule: "frontmatter",
      severity: "error",
      file,
      line: 1,
      message: "Missing frontmatter description.",
    });
  }
}

function checkBrokenLinks(
  findings: DocsReviewFinding[],
  review: ResolvedDocsReviewConfig,
  options: {
    file: string;
    source: string;
    entry: string;
    knownRoutes: Set<string>;
  },
) {
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)|href=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(options.source))) {
    const href = match[1] ?? match[2];
    if (!href || !href.startsWith("/")) continue;

    const normalized = normalizeInternalHref(href);
    if (!normalized || !normalized.startsWith(`/${options.entry}`)) continue;
    if (options.knownRoutes.has(normalized)) continue;

    pushFinding(findings, review, {
      rule: "brokenLinks",
      severity: "error",
      file: options.file,
      line: lineForIndex(options.source, match.index),
      message: `Internal docs link does not resolve: ${href}`,
    });
  }
}

function checkCodeFences(
  findings: DocsReviewFinding[],
  review: ResolvedDocsReviewConfig,
  options: { file: string; source: string },
) {
  const fencePattern = /^```([^\n`]*)\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(options.source))) {
    const info = match[1]?.trim() ?? "";
    const code = match[2] ?? "";
    const language = info.split(/\s+/)[0] ?? "";
    if (!language || !isImplementationLanguage(language)) continue;

    const hasTitle = /\btitle=/.test(info);
    const hasPackageManager = /\bpackageManager=/.test(info);
    const isRunnable = /\brunnable\b/.test(info);
    const isConfigExample = /\bdefineDocs\s*\(|\bwithDocs\s*\(|\bdocs\.config\b/.test(code);

    if (!hasTitle && (isRunnable || isConfigExample)) {
      pushFinding(findings, review, {
        rule: "codeFenceMetadata",
        severity: "warn",
        file: options.file,
        line: lineForIndex(options.source, match.index),
        message: 'Code block is missing title metadata, e.g. title="docs.config.ts".',
      });
    }

    if (isRunnable && !hasPackageManager) {
      pushFinding(findings, review, {
        rule: "runnableMetadata",
        severity: "warn",
        file: options.file,
        line: lineForIndex(options.source, match.index),
        message: "Runnable code block is missing packageManager metadata.",
      });
    }
  }
}

function checkAgentContext(
  findings: DocsReviewFinding[],
  review: ResolvedDocsReviewConfig,
  options: { file: string; source: string; rootDir: string },
) {
  if (options.source.includes("<Agent>") || options.source.includes("</Agent>")) return;
  if (existsSync(path.join(path.dirname(path.join(options.rootDir, options.file)), "agent.md")))
    return;
  if (
    !/\b(install|configure|setup|implement|defineDocs|docs\.config|MCP|agent)\b/i.test(
      options.source,
    )
  ) {
    return;
  }

  pushFinding(findings, review, {
    rule: "agentContext",
    severity: "suggestion",
    file: options.file,
    line: 1,
    message: "Implementation-heavy docs page could use an <Agent> block or sibling agent.md.",
  });
}

function pushFinding(
  findings: DocsReviewFinding[],
  review: ResolvedDocsReviewConfig,
  finding: DocsReviewFinding,
) {
  const configured = review.rules[finding.rule as keyof typeof review.rules];
  if (configured === "off") return;

  findings.push({
    ...finding,
    severity: configured === "error" || configured === "warn" ? configured : "suggestion",
  });
}

function calculateReviewScore(
  findings: DocsReviewFinding[],
  review: ResolvedDocsReviewConfig,
): number {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === "error") return total + review.score.weights.error;
    if (finding.severity === "warn") return total + review.score.weights.warn;
    return total + review.score.weights.suggestion;
  }, 0);

  return Math.max(0, 100 - penalty);
}

function printReviewReport(report: DocsReviewReport) {
  const counts = countFindings(report.findings);
  const modeLabel = report.mode === "local" ? "local" : report.mode;

  console.log(pc.bold("Docs Review"));
  console.log("");
  console.log(`Score: ${scoreColor(report.score, report.threshold)} / 100`);
  console.log(`Threshold: ${report.threshold}`);
  console.log(`Mode: ${modeLabel}`);
  console.log(`Changed files: ${report.changedFiles.length}`);
  console.log(`Reviewed docs files: ${report.reviewedFiles.length}`);
  console.log(
    `Findings: ${counts.error} error${counts.error === 1 ? "" : "s"}, ${counts.warn} warning${counts.warn === 1 ? "" : "s"}, ${counts.suggestion} suggestion${counts.suggestion === 1 ? "" : "s"}`,
  );

  if (report.reviewedFiles.length === 0) {
    console.log("");
    console.log(pc.green("No docs changes detected. Skipping review."));
    return;
  }

  if (report.findings.length === 0) {
    console.log("");
    console.log(pc.green("No docs review findings."));
    return;
  }

  console.log("");
  for (const finding of report.findings) {
    const label =
      finding.severity === "error"
        ? pc.red("ERROR")
        : finding.severity === "warn"
          ? pc.yellow("WARN")
          : pc.cyan("SUGGEST");
    const location = `${finding.file}${finding.line ? `:${finding.line}` : ""}`;
    console.log(`${label} ${pc.dim(location)} ${finding.message}`);
  }
}

function emitGitHubAnnotations(findings: DocsReviewFinding[]) {
  if (process.env.GITHUB_ACTIONS !== "true") return;

  for (const finding of findings) {
    const command =
      finding.severity === "error" ? "error" : finding.severity === "warn" ? "warning" : "notice";
    const location = [
      `file=${escapeGitHubAnnotationValue(finding.file)}`,
      finding.line ? `line=${finding.line}` : undefined,
    ]
      .filter(Boolean)
      .join(",");
    console.log(`::${command} ${location}::${escapeGitHubAnnotationValue(finding.message)}`);
  }
}

function scoreColor(score: number, threshold: number): string {
  if (score < threshold) return pc.red(String(score));
  if (score < Math.min(100, threshold + 10)) return pc.yellow(String(score));
  return pc.green(String(score));
}

function countFindings(findings: DocsReviewFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    },
    { error: 0, warn: 0, suggestion: 0 } as Record<ReviewFindingSeverity, number>,
  );
}

function selectReviewFiles(options: {
  changedFiles: string[];
  pages: DocsPageFile[];
  configPath: string;
  rootDir: string;
  contentDir: string;
}): string[] {
  const pageFiles = new Set(options.pages.map((page) => page.relativePath));
  const normalizedConfigPath = toPosixPath(options.configPath);

  if (options.changedFiles.includes(normalizedConfigPath)) {
    return Array.from(pageFiles).sort();
  }

  return options.changedFiles
    .map(toPosixPath)
    .filter((file) => pageFiles.has(file))
    .sort();
}

function getChangedFiles(rootDir: string, options: ReviewOptions): string[] {
  const explicitRange =
    options.base && options.head ? `${options.base}...${options.head}` : undefined;
  const githubRange = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}...HEAD`
    : undefined;
  const ranges = [explicitRange, githubRange, "HEAD~1...HEAD", undefined].filter(
    (range, index, allRanges): range is string | undefined =>
      range !== undefined || index === allRanges.length - 1,
  );

  for (const range of ranges) {
    try {
      const args = ["diff", "--relative", "--name-only", "--diff-filter=ACMRTUXB"];
      if (range) args.push(range);
      const output = execFileSync("git", args, { cwd: rootDir, encoding: "utf-8" });
      const files = output
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean)
        .map(toPosixPath);
      if (files.length > 0 || range === undefined) return files;
    } catch {
      // try the next range
    }
  }

  return [];
}

function scanDocsPages(rootDir: string, contentDir: string, entry: string): DocsPageFile[] {
  const contentRoot = path.isAbsolute(contentDir) ? contentDir : path.join(rootDir, contentDir);
  if (!existsSync(contentRoot)) return [];

  const files = listFiles(contentRoot).filter((file) => DOCS_FILE_PATTERN.test(file));
  return files.map((absolutePath) => {
    const relativeToContent = toPosixPath(path.relative(contentRoot, absolutePath));
    const relativePath = toPosixPath(path.relative(rootDir, absolutePath));
    const slug = docsSlugFromFile(relativeToContent);
    const route = normalizeRoute(`/${entry}${slug ? `/${slug}` : ""}`);

    return {
      relativePath,
      absolutePath,
      route,
      markdownRoute: `${route}.md`,
    };
  });
}

function listFiles(dir: string): string[] {
  const files: string[] = [];

  for (const name of readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;

    const fullPath = path.join(dir, name);
    let stat;
    try {
      stat = lstatSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function docsSlugFromFile(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.(?:md|mdx)$/, "");
  if (withoutExt === "page" || withoutExt === "index") return "";
  if (withoutExt.endsWith("/page") || withoutExt.endsWith("/index")) {
    return withoutExt.replace(/\/(?:page|index)$/, "");
  }
  return withoutExt;
}

function normalizeInternalHref(href: string): string | undefined {
  const [withoutHash] = href.split("#");
  const [withoutQuery] = withoutHash.split("?");
  if (!withoutQuery || withoutQuery === "/") return "/";
  return normalizeRoute(withoutQuery.replace(/\.md$/, ""));
}

function normalizeRoute(route: string): string {
  const normalized = `/${route}`.replace(/\/+/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function isImplementationLanguage(language: string): boolean {
  return /^(?:bash|sh|shell|zsh|ts|tsx|js|jsx|json|mdx?)$/.test(language);
}

function lineForIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function escapeGitHubAnnotationValue(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function parseReviewCiMode(value: string): DocsReviewCiMode {
  if (value === "off" || value === "warn" || value === "block") return value;
  throw new Error(`Invalid review mode: ${value}. Expected off, warn, or block.`);
}

function readInlineFlag(arg: string, prefix: string): string {
  const value = arg.slice(prefix.length);
  if (!value) throw new Error(`Missing value for ${prefix.replace(/=$/, "")}.`);
  return value;
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

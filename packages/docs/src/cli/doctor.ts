import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import pc from "picocolors";
import {
  DEFAULT_AGENTS_MD_ROUTE,
  DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE,
  DEFAULT_AGENT_FEEDBACK_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_TXT_ROUTE,
  DEFAULT_MCP_PUBLIC_ROUTE,
  DEFAULT_MCP_WELL_KNOWN_ROUTE,
  DEFAULT_SKILL_MD_ROUTE,
  DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
  buildDocsMcpEndpointCandidates,
} from "../agent.js";
import { createFilesystemDocsMcpSource, resolveDocsMcpConfig } from "../server.js";
import {
  DEFAULT_SITEMAP_MD_ROUTE,
  DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE,
  DEFAULT_SITEMAP_XML_ROUTE,
  resolveDocsSitemapConfig,
} from "../sitemap.js";
import {
  DEFAULT_ROBOTS_TXT_ROUTE,
  analyzeDocsRobotsTxt,
  resolveDocsRobotsConfig,
} from "../robots.js";
import type { DocsConfig, DocsMcpConfig, DocsRobotsConfig, DocsSitemapConfig } from "../types.js";
import {
  extractNestedObjectLiteral,
  extractTopLevelConfigObject,
  loadDocsConfigModule,
  loadProjectEnv,
  readBooleanProperty,
  readNavTitle,
  readTopLevelStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";
import { compactAgentDocs, inspectAgentCompactionState, scanDocsPageTargets } from "./agent.js";
import type { AgentCompactOptions } from "./agent.js";
import { detectFramework, type Framework } from "./utils.js";

type DoctorStatus = "pass" | "warn" | "fail";
type AgentDoctorGrade = "Agent-optimized" | "Agent-ready" | "Promising" | "Needs work";
type HumanDoctorGrade = "Human-optimized" | "Reader-ready" | "Promising" | "Needs work";
type DoctorMode = "agent" | "human";
type DoctorFailOn = "warn" | "fail";

export interface DoctorOptions {
  configPath?: string;
  mode?: DoctorMode;
  json?: boolean;
  strict?: boolean;
  failOn?: DoctorFailOn;
  url?: string;
  fix?: boolean;
  dryRun?: boolean;
}

export interface ParsedDoctorArgs extends DoctorOptions {
  help?: boolean;
}

export interface AgentDoctorCheck {
  id: string;
  title: string;
  detail: string;
  status: DoctorStatus;
  score: number;
  maxScore: number;
  recommendation?: string;
}

export interface AgentDoctorCoverage {
  totalPages: number;
  pagesWithAgentFiles: number;
  pagesWithAgentBlocks: number;
  explicitPages: number;
  explicitCoverage: number;
  compaction: AgentDoctorCompactionCoverage;
}

export interface AgentDoctorCompactionCoverage {
  freshGeneratedPages: number;
  staleGeneratedPages: number;
  modifiedGeneratedPages: number;
  unknownGeneratedPages: number;
  tokenBudgetMissingPages: number;
  otherMissingPages: number;
}

export interface AgentDoctorReport {
  mode: "agent";
  framework: Framework | "unknown";
  configPath?: string;
  entry?: string;
  contentDir?: string;
  url?: string;
  score: number;
  maxScore: number;
  grade: AgentDoctorGrade;
  checks: AgentDoctorCheck[];
  coverage: AgentDoctorCoverage;
  recommendations: string[];
  fixes?: AgentDoctorFix[];
}

export interface AgentDoctorFix {
  id: string;
  title: string;
  status: "applied" | "skipped";
  detail: string;
}

export interface HumanDoctorCheck {
  id: string;
  title: string;
  detail: string;
  status: DoctorStatus;
  score: number;
  maxScore: number;
  recommendation?: string;
}

export interface HumanDoctorCoverage {
  totalPages: number;
  describedPages: number;
  descriptionCoverage: number;
  longPages: number;
  structuredLongPages: number;
  structureCoverage: number;
  navigationPages: number;
}

export interface HumanDoctorReport {
  mode: "human";
  framework: Framework | "unknown";
  configPath?: string;
  entry?: string;
  contentDir?: string;
  score: number;
  maxScore: number;
  grade: HumanDoctorGrade;
  checks: HumanDoctorCheck[];
  coverage: HumanDoctorCoverage;
  recommendations: string[];
}

const NEXT_CONFIG_PATTERN = /^next\.config\.(?:[cm]?js|[cm]?ts)$/;
const ASTRO_CONFIG_PATTERN = /^astro\.config\.(?:[cm]?js|[cm]?ts)$/;
const CODE_FILE_PATTERN = /\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/;
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

function parseInlineFlag(arg: string): { key: string; value?: string } {
  const [rawKey, value] = arg.slice(2).split("=", 2);
  return { key: rawKey.trim(), value };
}

function parseDoctorOnlyMode(value: string): DoctorMode {
  if (value === "agent") return "agent";
  if (value === "site") return "human";
  throw new Error("Invalid value for --only. Expected agent or site.");
}

function parseDoctorFailOn(value: string): DoctorFailOn {
  if (value === "warn" || value === "fail") return value;
  throw new Error("Invalid value for --fail-on. Expected warn or fail.");
}

export function parseDoctorArgs(argv: string[]): ParsedDoctorArgs {
  const parsed: ParsedDoctorArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--agent" || arg === "agent") {
      parsed.mode = "agent";
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--strict") {
      parsed.strict = true;
      continue;
    }

    if (arg === "--fix") {
      parsed.fix = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg.startsWith("--fail-on=")) {
      const value = parseInlineFlag(arg).value;
      if (!value) {
        throw new Error("Missing value for --fail-on.");
      }
      parsed.failOn = parseDoctorFailOn(value);
      continue;
    }

    if (arg === "--fail-on") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --fail-on.");
      }
      parsed.failOn = parseDoctorFailOn(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--only=")) {
      const value = parseInlineFlag(arg).value;
      if (!value) {
        throw new Error("Missing value for --only.");
      }
      parsed.mode = parseDoctorOnlyMode(value);
      continue;
    }

    if (arg === "--only") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --only.");
      }
      parsed.mode = parseDoctorOnlyMode(value);
      index += 1;
      continue;
    }

    if (arg === "--human" || arg === "human" || arg === "--site" || arg === "site") {
      parsed.mode = "human";
      continue;
    }

    if (arg.startsWith("--config=")) {
      const value = parseInlineFlag(arg).value;
      if (!value) {
        throw new Error("Missing value for --config.");
      }
      parsed.configPath = value;
      continue;
    }

    if (arg.startsWith("--url=")) {
      const value = parseInlineFlag(arg).value;
      if (!value) {
        throw new Error("Missing value for --url.");
      }
      parsed.url = value;
      continue;
    }

    if (arg === "--url") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --url.");
      }
      parsed.url = value;
      index += 1;
      continue;
    }

    if (arg === "--config") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --config.");
      }
      parsed.configPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown doctor flag or subcommand: ${arg}.`);
  }

  if (!parsed.help && !parsed.mode) {
    parsed.mode = "agent";
  }

  return parsed;
}

export function printDoctorHelp() {
  console.log(`
${pc.bold("@farming-labs/docs doctor")}

${pc.dim("Usage:")}
  pnpm exec docs doctor
  pnpm exec docs doctor --agent
  pnpm exec docs doctor --site
  pnpm exec docs doctor --agent --json
  pnpm exec docs doctor --agent --strict
  pnpm exec docs doctor --agent --fix
  pnpm exec docs doctor --agent --fix --dry-run
  pnpm exec docs doctor --agent --fail-on fail
  pnpm exec docs doctor --only agent
  pnpm exec docs doctor --only site
  pnpm exec docs doctor agent
  pnpm exec docs doctor site

${pc.dim("Options:")}
  ${pc.cyan("--agent")}            Score agent-readiness for the current docs app (default)
  ${pc.cyan("--site")}             Score reader-facing docs quality for the current docs app
  ${pc.cyan("--human")}            Alias for ${pc.cyan("--site")}
  ${pc.cyan("--only <mode>")}      Run only one doctor suite: ${pc.cyan("agent")} or ${pc.cyan("site")}
  ${pc.cyan("--json")}             Print the report as JSON for CI, scripts, and other agents
  ${pc.cyan("--strict")}           Exit with failure when any check warns or fails
  ${pc.cyan("--fix")}              Refresh stale generated agent.md files and token-budget missing outputs
  ${pc.cyan("--dry-run")}          With ${pc.cyan("--fix")}, report the compaction command without writing files
  ${pc.cyan("--fail-on <level>")}  Exit with failure on ${pc.cyan("warn")} or only on ${pc.cyan("fail")}
  ${pc.cyan("--url <url>")}        Probe hosted agent surfaces, e.g. ${pc.dim("https://docs.example.com")}
  ${pc.cyan("--config <path>")}    Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}
  ${pc.cyan("-h, --help")}         Show this help message
`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitTopLevelProperties(content: string): string[] {
  const properties: string[] = [];
  let start = 0;
  let stringQuote: '"' | "'" | "`" | null = null;
  let escaped = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (stringQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }

    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
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

    if (char === "," && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      properties.push(content.slice(start, index));
      start = index + 1;
    }
  }

  const trailing = content.slice(start);
  if (trailing.trim().length > 0) properties.push(trailing);
  return properties;
}

function readTopLevelBooleanProperty(content: string, key: string): boolean | undefined {
  const rootObject = extractTopLevelConfigObject(content) ?? content;
  const propertyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:\\s*(true|false)(?:\\s|$)`);

  for (const property of splitTopLevelProperties(rootObject)) {
    const match = property.trim().match(propertyPattern);
    if (match) return match[1] === "true";
  }

  return undefined;
}

function readObjectBooleanProperty(content: string, key: string): boolean | undefined {
  const propertyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:\\s*(true|false)(?:\\s|$)`);

  for (const property of splitTopLevelProperties(content)) {
    const match = property.trim().match(propertyPattern);
    if (match) return match[1] === "true";
  }

  return undefined;
}

function resolveFeatureEnabled(
  config: DocsConfig | undefined,
  content: string,
  key: "llmsTxt" | "search" | "mcp",
): boolean {
  const current = config?.[key];
  if (typeof current === "boolean") return current;
  if (current && typeof current === "object") {
    const enabled = (current as { enabled?: boolean }).enabled;
    return enabled ?? true;
  }

  const topLevelBoolean = readTopLevelBooleanProperty(content, key);
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const block = extractNestedObjectLiteral(content, [key]);
  if (!block) return true;

  const enabled = readBooleanProperty(block, "enabled");
  return enabled ?? true;
}

function readSitemapConfigFromStatic(content: string): boolean | DocsSitemapConfig | undefined {
  const topLevelBoolean = readTopLevelBooleanProperty(content, "sitemap");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const block = extractNestedObjectLiteral(content, ["sitemap"]);
  if (!block) return undefined;

  const config: DocsSitemapConfig = {};
  const enabled = readObjectBooleanProperty(block, "enabled");
  const routePrefix = block.match(/\broutePrefix\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  const baseUrl = block.match(/\bbaseUrl\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  const manifestPath = block.match(/\bmanifestPath\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];

  if (typeof enabled === "boolean") config.enabled = enabled;
  if (routePrefix) config.routePrefix = routePrefix;
  if (baseUrl) config.baseUrl = baseUrl;
  if (manifestPath) config.manifestPath = manifestPath;

  return config;
}

function readRobotsConfigFromStatic(content: string): boolean | DocsRobotsConfig | undefined {
  const topLevelBoolean = readTopLevelBooleanProperty(content, "robots");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const block = extractNestedObjectLiteral(content, ["robots"]);
  if (!block) return undefined;

  const config: DocsRobotsConfig = {};
  const enabled = readObjectBooleanProperty(block, "enabled");
  const pathValue = block.match(/\bpath\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  const baseUrl = block.match(/\bbaseUrl\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  const aiString = block.match(/\bai\s*:\s*["'`](allow|disallow)["'`]/)?.[1] as
    | "allow"
    | "disallow"
    | undefined;
  const aiBoolean = readObjectBooleanProperty(block, "ai");

  if (typeof enabled === "boolean") config.enabled = enabled;
  if (pathValue) config.path = pathValue;
  if (baseUrl) config.baseUrl = baseUrl;
  if (aiString) config.ai = aiString;
  else if (typeof aiBoolean === "boolean") config.ai = aiBoolean;

  return config;
}

function resolvePublicDir(rootDir: string, framework: Framework | "unknown"): string {
  if (framework === "sveltekit") return path.join(rootDir, "static");
  return path.join(rootDir, "public");
}

function resolveRobotsFilePath(
  rootDir: string,
  framework: Framework | "unknown",
  robots: DocsRobotsConfig | undefined,
): string {
  if (robots?.path) {
    return path.isAbsolute(robots.path) ? robots.path : path.resolve(rootDir, robots.path);
  }

  return path.join(resolvePublicDir(rootDir, framework), "robots.txt");
}

function resolveStaticExport(config: DocsConfig | undefined, content: string): boolean {
  if (typeof config?.staticExport === "boolean") return config.staticExport;
  return readTopLevelBooleanProperty(content, "staticExport") ?? false;
}

function resolveAgentFeedbackEnabled(config: DocsConfig | undefined, content: string): boolean {
  const feedback = config?.feedback;
  if (feedback === false) return false;
  if (feedback === true) return true;
  if (feedback && typeof feedback === "object") {
    const agent = feedback.agent;
    if (typeof agent === "boolean") return agent;
    if (agent && typeof agent === "object") return agent.enabled ?? true;
    return true;
  }

  const topLevelBoolean = readTopLevelBooleanProperty(content, "feedback");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const feedbackBlock = extractNestedObjectLiteral(content, ["feedback"]);
  if (!feedbackBlock) return true;

  const nestedAgentBlock = extractNestedObjectLiteral(content, ["feedback", "agent"]);
  if (nestedAgentBlock) {
    return readBooleanProperty(nestedAgentBlock, "enabled") ?? true;
  }

  return readBooleanProperty(feedbackBlock, "agent") ?? true;
}

function resolveHumanFeedbackEnabled(config: DocsConfig | undefined, content: string): boolean {
  const feedback = config?.feedback;
  if (typeof feedback === "boolean") return feedback;
  if (feedback && typeof feedback === "object") return feedback.enabled ?? true;

  const topLevelBoolean = readTopLevelBooleanProperty(content, "feedback");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const feedbackBlock = extractNestedObjectLiteral(content, ["feedback"]);
  if (!feedbackBlock) return false;
  return readBooleanProperty(feedbackBlock, "enabled") ?? true;
}

function resolveLastUpdatedEnabled(config: DocsConfig | undefined, content: string): boolean {
  const current = config?.lastUpdated;
  if (typeof current === "boolean") return current;
  if (current && typeof current === "object") return current.enabled ?? true;

  const topLevelBoolean = readTopLevelBooleanProperty(content, "lastUpdated");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const block = extractNestedObjectLiteral(content, ["lastUpdated"]);
  if (!block) return true;
  return readBooleanProperty(block, "enabled") ?? true;
}

function hasGithubIntegration(config: DocsConfig | undefined, content: string): boolean {
  if (typeof config?.github === "string") return config.github.trim().length > 0;
  if (config?.github && typeof config.github === "object") {
    return typeof config.github.url === "string" && config.github.url.trim().length > 0;
  }

  const topLevelString = readTopLevelStringProperty(content, "github");
  if (typeof topLevelString === "string" && topLevelString.trim().length > 0) return true;

  const githubBlock = extractNestedObjectLiteral(content, ["github"]);
  if (!githubBlock) return false;

  const urlMatch = githubBlock.match(/\burl\s*:\s*["'`]([^"'`]+)["'`]/);
  return typeof urlMatch?.[1] === "string" && urlMatch[1].trim().length > 0;
}

function hasReadingTimeSurface(config: DocsConfig | undefined, content: string): boolean {
  const current = config?.readingTime;
  if (current === true) return true;
  if (current && typeof current === "object") return current.enabled !== false;

  const topLevelBoolean = readTopLevelBooleanProperty(content, "readingTime");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const block = extractNestedObjectLiteral(content, ["readingTime"]);
  if (!block) return false;
  return readBooleanProperty(block, "enabled") ?? true;
}

function hasAgentCompactDefaults(config: DocsConfig | undefined, content: string): boolean {
  if (config?.agent?.compact) return true;
  return extractNestedObjectLiteral(content, ["agent", "compact"]) !== undefined;
}

function listProjectFiles(rootDir: string): string[] {
  const files: string[] = [];

  const visit = (dir: string) => {
    if (!existsSync(dir)) return;

    for (const entry of readdirSync(dir).sort()) {
      const fullPath = path.join(dir, entry);
      const stat = lstatSync(fullPath);

      if (stat.isSymbolicLink()) continue;

      if (stat.isDirectory()) {
        if (IGNORED_DIRS.has(entry)) continue;
        visit(fullPath);
        continue;
      }

      files.push(path.relative(rootDir, fullPath).replace(/\\/g, "/"));
    }
  };

  visit(rootDir);
  return files;
}

function buildFileReader(rootDir: string) {
  const cache = new Map<string, string>();

  return (relativePath: string): string => {
    const cached = cache.get(relativePath);
    if (cached !== undefined) return cached;

    const content = readFileSync(path.join(rootDir, relativePath), "utf-8");
    cache.set(relativePath, content);
    return content;
  };
}

function formatPathList(paths: string[]): string {
  if (paths.length === 0) return "";
  if (paths.length === 1) return paths[0];
  return `${paths[0]} (+${paths.length - 1} more)`;
}

function findCodeFiles(files: string[], predicate: (relativePath: string) => boolean): string[] {
  return files.filter(
    (relativePath) => CODE_FILE_PATTERN.test(relativePath) && predicate(relativePath),
  );
}

function detectFrameworkFromFiles(files: string[]): Framework | null {
  if (files.some((file) => NEXT_CONFIG_PATTERN.test(path.basename(file)))) return "nextjs";
  if (files.some((file) => file.startsWith("src/routes/") && file.includes("api.docs"))) {
    return "tanstack-start";
  }
  if (files.some((file) => file === "src/hooks.server.js" || file === "src/hooks.server.ts")) {
    return "sveltekit";
  }
  if (files.some((file) => ASTRO_CONFIG_PATTERN.test(path.basename(file)))) {
    return "astro";
  }
  if (files.some((file) => file.startsWith("server/middleware/"))) return "nuxt";
  return null;
}

function detectRouteSurface(
  rootDir: string,
  framework: Framework | "unknown",
  staticExport: boolean,
  files: string[],
): {
  apiMounted: boolean;
  apiDetail: string;
  publicMounted: boolean;
  publicDetail: string;
} {
  const read = buildFileReader(rootDir);

  if (framework === "nextjs") {
    const nextConfigs = files.filter((file) => NEXT_CONFIG_PATTERN.test(path.basename(file)));
    const withDocsConfigs = nextConfigs.filter((file) => read(file).includes("withDocs("));
    const apiRoutes = findCodeFiles(
      files,
      (file) =>
        /(?:^|\/)route\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/.test(file) &&
        read(file).includes("createDocsAPI("),
    );

    if (staticExport) {
      return {
        apiMounted: false,
        apiDetail: "Next static export disables /api/docs and the shared agent endpoints.",
        publicMounted: false,
        publicDetail:
          "Public .md, llms.txt, sitemap, AGENTS.md, skill.md, and agent discovery routes depend on /api/docs.",
      };
    }

    return {
      apiMounted: apiRoutes.length > 0,
      apiDetail:
        apiRoutes.length > 0
          ? `Found docs API route at ${formatPathList(apiRoutes)}.`
          : "Could not find a Next docs API route that uses createDocsAPI().",
      publicMounted: withDocsConfigs.length > 0,
      publicDetail:
        withDocsConfigs.length > 0
          ? `Found withDocs() in ${formatPathList(withDocsConfigs)}.`
          : "Could not find withDocs() in next.config.*, so public docs rewrites are not verified.",
    };
  }

  if (framework === "tanstack-start") {
    const apiRoutes = findCodeFiles(
      files,
      (file) =>
        file.startsWith("src/routes/") &&
        read(file).includes("docsServer.GET") &&
        /createFileRoute\((["'])\/api/.test(read(file)),
    );
    const publicHandlers = findCodeFiles(
      files,
      (file) =>
        file.startsWith("src/routes/") &&
        read(file).includes("isDocsPublicGetRequest(") &&
        read(file).includes("isDocsMcpRequest("),
    );

    return {
      apiMounted: apiRoutes.length > 0,
      apiDetail:
        apiRoutes.length > 0
          ? `Found TanStack docs API route at ${formatPathList(apiRoutes)}.`
          : "Could not find a TanStack route that forwards /api/docs into docsServer.GET.",
      publicMounted: publicHandlers.length > 0,
      publicDetail:
        publicHandlers.length > 0
          ? `Found public docs forwarder at ${formatPathList(publicHandlers)}.`
          : "Could not find a TanStack public docs forwarder using isDocsPublicGetRequest().",
    };
  }

  if (framework === "sveltekit") {
    const apiRoutes = findCodeFiles(
      files,
      (file) =>
        file.startsWith("src/routes/") &&
        path.basename(file).startsWith("+server.") &&
        read(file).includes("docs.server"),
    );
    const publicHandlers = findCodeFiles(
      files,
      (file) =>
        /^src\/hooks\.server\.(?:[cm]?js|[cm]?ts)$/.test(file) &&
        read(file).includes("isDocsPublicGetRequest("),
    );

    return {
      apiMounted: apiRoutes.length > 0,
      apiDetail:
        apiRoutes.length > 0
          ? `Found SvelteKit docs API route at ${formatPathList(apiRoutes)}.`
          : "Could not find a SvelteKit +server route that re-exports docs.server.",
      publicMounted: publicHandlers.length > 0,
      publicDetail:
        publicHandlers.length > 0
          ? `Found SvelteKit public docs hook at ${formatPathList(publicHandlers)}.`
          : "Could not find hooks.server with isDocsPublicGetRequest().",
    };
  }

  if (framework === "astro") {
    const apiRoutes = findCodeFiles(
      files,
      (file) =>
        file.startsWith("src/pages/") &&
        read(file).includes("docsGET") &&
        read(file).includes("docsPOST"),
    );
    const publicHandlers = findCodeFiles(
      files,
      (file) =>
        /^src\/middleware\.(?:[cm]?js|[cm]?ts)$/.test(file) &&
        read(file).includes("isDocsPublicGetRequest("),
    );

    return {
      apiMounted: apiRoutes.length > 0,
      apiDetail:
        apiRoutes.length > 0
          ? `Found Astro docs API route at ${formatPathList(apiRoutes)}.`
          : "Could not find an Astro docs API route that forwards to docs.server.",
      publicMounted: publicHandlers.length > 0,
      publicDetail:
        publicHandlers.length > 0
          ? `Found Astro middleware forwarder at ${formatPathList(publicHandlers)}.`
          : "Could not find Astro middleware using isDocsPublicGetRequest().",
    };
  }

  if (framework === "nuxt") {
    const apiRoutes = findCodeFiles(
      files,
      (file) => file.startsWith("server/api/") && read(file).includes("defineDocsHandler("),
    );
    const publicHandlers = findCodeFiles(
      files,
      (file) =>
        file.startsWith("server/middleware/") && read(file).includes("defineDocsPublicHandler("),
    );

    return {
      apiMounted: apiRoutes.length > 0,
      apiDetail:
        apiRoutes.length > 0
          ? `Found Nuxt docs API handler at ${formatPathList(apiRoutes)}.`
          : "Could not find a Nuxt docs API handler using defineDocsHandler().",
      publicMounted: publicHandlers.length > 0,
      publicDetail:
        publicHandlers.length > 0
          ? `Found Nuxt public docs middleware at ${formatPathList(publicHandlers)}.`
          : "Could not find Nuxt middleware using defineDocsPublicHandler().",
    };
  }

  return {
    apiMounted: false,
    apiDetail: "Could not detect a supported framework, so API route inspection was skipped.",
    publicMounted: false,
    publicDetail: "Could not detect a supported framework, so public route inspection was skipped.",
  };
}

function coverageScore(explicitCoverage: number): { status: DoctorStatus; score: number } {
  if (explicitCoverage >= 80) return { status: "pass", score: 10 };
  if (explicitCoverage >= 50) return { status: "pass", score: 8 };
  if (explicitCoverage >= 20) return { status: "warn", score: 5 };
  if (explicitCoverage > 0) return { status: "warn", score: 3 };
  return { status: "warn", score: 0 };
}

function metadataScore(
  descriptionCoverage: number,
  relatedCoverage: number,
): { status: DoctorStatus; score: number } {
  if (descriptionCoverage >= 90 && relatedCoverage >= 20) return { status: "pass", score: 5 };
  if (descriptionCoverage >= 75) return { status: "pass", score: 4 };
  if (descriptionCoverage >= 50) return { status: "warn", score: 2 };
  if (descriptionCoverage > 0) return { status: "warn", score: 1 };
  return { status: "warn", score: 0 };
}

function descriptionScore(descriptionCoverage: number): { status: DoctorStatus; score: number } {
  if (descriptionCoverage >= 90) return { status: "pass", score: 15 };
  if (descriptionCoverage >= 75) return { status: "pass", score: 12 };
  if (descriptionCoverage >= 50) return { status: "warn", score: 8 };
  if (descriptionCoverage > 0) return { status: "warn", score: 4 };
  return { status: "warn", score: 0 };
}

function structureScore(structureCoverage: number): { status: DoctorStatus; score: number } {
  if (structureCoverage >= 90) return { status: "pass", score: 15 };
  if (structureCoverage >= 75) return { status: "pass", score: 12 };
  if (structureCoverage >= 50) return { status: "warn", score: 8 };
  if (structureCoverage > 0) return { status: "warn", score: 4 };
  return { status: "warn", score: 0 };
}

function navigationScore(navigationCoverage: number): { status: DoctorStatus; score: number } {
  if (navigationCoverage >= 100) return { status: "pass", score: 15 };
  if (navigationCoverage >= 80) return { status: "pass", score: 12 };
  if (navigationCoverage >= 50) return { status: "warn", score: 8 };
  if (navigationCoverage > 0) return { status: "warn", score: 4 };
  return { status: "fail", score: 0 };
}

function gradeForAgentScore(score: number): AgentDoctorGrade {
  if (score >= 90) return "Agent-optimized";
  if (score >= 75) return "Agent-ready";
  if (score >= 60) return "Promising";
  return "Needs work";
}

function gradeForHumanScore(score: number): HumanDoctorGrade {
  if (score >= 90) return "Human-optimized";
  if (score >= 75) return "Reader-ready";
  if (score >= 60) return "Promising";
  return "Needs work";
}

function percentageScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

function normalizedDoctorScore(score: number, maxScore: number): { score: number; maxScore: 100 } {
  return {
    score: percentageScore(score, maxScore),
    maxScore: 100,
  };
}

function formatStatus(status: DoctorStatus): string {
  if (status === "pass") return pc.green("PASS");
  if (status === "warn") return pc.yellow("WARN");
  return pc.red("FAIL");
}

function buildCoverage(
  pages: Array<{
    description?: string;
    related?: unknown[];
    agentRawContent?: string;
    agentFallbackRawContent?: string;
  }>,
): AgentDoctorCoverage {
  const totalPages = pages.length;
  const pagesWithAgentFiles = pages.filter((page) => page.agentRawContent !== undefined).length;
  const pagesWithAgentBlocks = pages.filter(
    (page) => page.agentFallbackRawContent !== undefined,
  ).length;
  const explicitPages = pages.filter(
    (page) => page.agentRawContent !== undefined || page.agentFallbackRawContent !== undefined,
  ).length;
  const explicitCoverage =
    totalPages === 0 ? 0 : Math.round((explicitPages / Math.max(totalPages, 1)) * 100);

  return {
    totalPages,
    pagesWithAgentFiles,
    pagesWithAgentBlocks,
    explicitPages,
    explicitCoverage,
    compaction: {
      freshGeneratedPages: 0,
      staleGeneratedPages: 0,
      modifiedGeneratedPages: 0,
      unknownGeneratedPages: 0,
      tokenBudgetMissingPages: 0,
      otherMissingPages: 0,
    },
  };
}

function buildCompactionCoverage(
  rootDir: string,
  contentDir: string,
  entry: string,
  pages: Awaited<ReturnType<ReturnType<typeof createFilesystemDocsMcpSource>["getPages"]>>,
  defaults: AgentCompactOptions,
): AgentDoctorCompactionCoverage {
  const targets = scanDocsPageTargets(rootDir, contentDir, entry);
  const targetsBySlug = new Map(targets.map((target) => [target.slug, target] as const));

  const coverage: AgentDoctorCompactionCoverage = {
    freshGeneratedPages: 0,
    staleGeneratedPages: 0,
    modifiedGeneratedPages: 0,
    unknownGeneratedPages: 0,
    tokenBudgetMissingPages: 0,
    otherMissingPages: 0,
  };

  for (const page of pages) {
    const target = targetsBySlug.get(page.slug);
    if (!target) continue;

    const state = inspectAgentCompactionState(page, target, defaults);

    switch (state.status) {
      case "fresh":
        coverage.freshGeneratedPages += 1;
        break;
      case "stale":
        coverage.staleGeneratedPages += 1;
        break;
      case "modified":
      case "stale-modified":
        coverage.modifiedGeneratedPages += 1;
        break;
      case "unknown":
        coverage.unknownGeneratedPages += 1;
        break;
      case "missing":
        if (state.tokenBudget !== undefined) coverage.tokenBudgetMissingPages += 1;
        else coverage.otherMissingPages += 1;
        break;
    }
  }

  return coverage;
}

function compactionFreshnessScore(
  coverage: AgentDoctorCompactionCoverage,
  compactConfigured: boolean,
): { status: DoctorStatus; score: number; recommendation?: string } {
  const hasActionableIssues =
    coverage.staleGeneratedPages > 0 ||
    coverage.modifiedGeneratedPages > 0 ||
    coverage.tokenBudgetMissingPages > 0;

  if (hasActionableIssues) {
    const recommendations: string[] = [];
    if (coverage.staleGeneratedPages > 0) {
      recommendations.push(
        "Run docs agent compact --stale to refresh stale generated agent.md files.",
      );
    }
    if (coverage.modifiedGeneratedPages > 0) {
      recommendations.push(
        "Review modified generated agent.md files before overwriting them; --stale skips manual edits on purpose.",
      );
    }
    if (coverage.tokenBudgetMissingPages > 0) {
      recommendations.push(
        "Run docs agent compact --stale --include-missing to create generated agent.md files for pages that opted into agent.tokenBudget.",
      );
    }

    return {
      status: "warn",
      score: compactConfigured ? 2 : 0,
      recommendation: recommendations.join(" "),
    };
  }

  if (coverage.unknownGeneratedPages > 0) {
    return {
      status: "pass",
      score: compactConfigured ? 5 : 3,
    };
  }

  if (coverage.freshGeneratedPages > 0) {
    return {
      status: "pass",
      score: compactConfigured ? 5 : 4,
    };
  }

  if (compactConfigured) {
    return {
      status: "pass",
      score: 5,
    };
  }

  return {
    status: "warn",
    score: 0,
    recommendation:
      "Add agent.compact defaults if you want docs agent compact and stale detection to run without repeating model and compression settings.",
  };
}

function buildMetadataCoverage(
  pages: Array<{
    description?: string;
    related?: unknown[];
  }>,
): {
  describedPages: number;
  relatedPages: number;
  descriptionCoverage: number;
  relatedCoverage: number;
} {
  const totalPages = pages.length;
  const describedPages = pages.filter(
    (page) => typeof page.description === "string" && page.description.trim().length > 0,
  ).length;
  const relatedPages = pages.filter(
    (page) => Array.isArray(page.related) && page.related.length > 0,
  ).length;

  return {
    describedPages,
    relatedPages,
    descriptionCoverage: totalPages === 0 ? 0 : Math.round((describedPages / totalPages) * 100),
    relatedCoverage: totalPages === 0 ? 0 : Math.round((relatedPages / totalPages) * 100),
  };
}

function countNavigationPages(node: {
  children?: unknown[];
  index?: unknown;
  type?: string;
  url?: unknown;
}): number {
  const urls = new Set<string>();

  const visit = (current: {
    children?: unknown[];
    index?: unknown;
    type?: string;
    url?: unknown;
  }) => {
    if (current.type === "page" && typeof current.url === "string") {
      urls.add(current.url);
    }

    if (current.index && typeof current.index === "object") {
      const indexNode = current.index as { url?: unknown };
      if (typeof indexNode.url === "string") {
        urls.add(indexNode.url);
      }
    }

    const children = Array.isArray(current.children) ? current.children : [];
    for (const child of children) {
      if (!child || typeof child !== "object") continue;
      visit(child as { children?: unknown[]; index?: unknown; type?: string; url?: unknown });
    }
  };

  visit(node);
  return urls.size;
}

function estimateWordCount(content: string): number {
  return content.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length ?? 0;
}

function hasSectionHeadings(content: string): boolean {
  return /^###{0,1}\s+/m.test(content);
}

function buildHumanCoverage(
  pages: Array<{
    description?: string;
    rawContent?: string;
  }>,
  navigationPages: number,
): HumanDoctorCoverage {
  const totalPages = pages.length;
  const describedPages = pages.filter(
    (page) => typeof page.description === "string" && page.description.trim().length > 0,
  ).length;
  const longPages = pages.filter((page) => estimateWordCount(page.rawContent ?? "") >= 120).length;
  const structuredLongPages = pages.filter((page) => {
    const content = page.rawContent ?? "";
    return estimateWordCount(content) >= 120 && hasSectionHeadings(content);
  }).length;

  const descriptionCoverage =
    totalPages === 0 ? 0 : Math.round((describedPages / totalPages) * 100);
  const structureCoverage =
    longPages === 0 ? 100 : Math.round((structuredLongPages / longPages) * 100);

  return {
    totalPages,
    describedPages,
    descriptionCoverage,
    longPages,
    structuredLongPages,
    structureCoverage,
    navigationPages,
  };
}

function normalizeDoctorBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

function joinDoctorUrl(baseUrl: string, route: string): string {
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  const routePath = route.startsWith("/") ? route : `/${route}`;
  return new URL(`${basePath}${routePath}`, base.origin).toString();
}

function toMarkdownRoute(pageUrl?: string): string | undefined {
  if (!pageUrl) return undefined;
  const normalized = pageUrl === "/" ? "/index" : pageUrl.replace(/\/+$/, "");
  return normalized.endsWith(".md") ? normalized : `${normalized}.md`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeTextRoute(
  baseUrl: string,
  route: string,
): Promise<{ ok: boolean; status?: number; detail: string; body?: string; linkHeader?: string }> {
  const url = joinDoctorUrl(baseUrl, route);

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "text/plain, text/markdown, */*",
      },
    });
    const body = await response.text().catch(() => "");

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned HTTP ${response.status}.`,
      };
    }

    if (body.trim().length === 0) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned an empty body.`,
      };
    }

    return {
      ok: true,
      status: response.status,
      detail: `${route} returned HTTP ${response.status} with ${body.length} characters.`,
      body,
      linkHeader: response.headers.get("link") ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${route} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

function decodeHtmlEntity(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, raw: string) => {
    const lower = raw.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return named[lower] ?? entity;
  });
}

function htmlAttribute(tag: string, name: string): string | undefined {
  const pattern = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    if (match[1]?.toLowerCase() !== name.toLowerCase()) continue;
    return decodeHtmlEntity(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return undefined;
}

function hasJsonLdScript(html: string): boolean {
  return /<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>/i.test(html);
}

function markdownAlternateHref(html: string): string | undefined {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = htmlAttribute(tag, "rel") ?? "";
    const type = htmlAttribute(tag, "type") ?? "";
    const href = htmlAttribute(tag, "href");
    const relTokens = rel.toLowerCase().split(/\s+/).filter(Boolean);

    if (href && relTokens.includes("alternate") && /^text\/markdown(?:\s*;|$)/i.test(type.trim())) {
      return href;
    }
  }

  return undefined;
}

function resolveMarkdownAlternateUrl(href: string | undefined, pageUrl: string): URL | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, pageUrl);
    const page = new URL(pageUrl);
    return url.origin === page.origin && url.pathname.endsWith(".md") ? url : undefined;
  } catch {
    return undefined;
  }
}

function canonicalLinkFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;

  for (const match of header.matchAll(/<([^>]+)>\s*((?:;\s*[^,]+)*)/g)) {
    const params = match[2] ?? "";
    const rel = params.match(/(?:^|;)\s*rel\s*=\s*(?:"([^"]*)"|([^;\s,]+))/i);
    const relValue = rel?.[1] ?? rel?.[2] ?? "";
    if (relValue.toLowerCase().split(/\s+/).includes("canonical")) return match[1];
  }

  return undefined;
}

function normalizeCanonicalUrl(value: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function hasCanonicalLinkHeader(
  header: string | undefined,
  pageUrl: string,
  responseUrl: string,
): boolean {
  const canonical = canonicalLinkFromHeader(header);
  if (!canonical) return false;
  return normalizeCanonicalUrl(canonical, responseUrl) === normalizeCanonicalUrl(pageUrl, pageUrl);
}

async function probeRobotsRoute(
  baseUrl: string,
  route = DEFAULT_ROBOTS_TXT_ROUTE,
): Promise<{
  ok: boolean;
  status?: number;
  detail: string;
  body?: string;
}> {
  const url = joinDoctorUrl(baseUrl, route);

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "text/plain, */*",
      },
    });
    const body = await response.text().catch(() => "");

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned HTTP ${response.status}.`,
      };
    }

    if (body.trim().length === 0) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned an empty body.`,
      };
    }

    return {
      ok: true,
      status: response.status,
      body,
      detail: `${route} returned HTTP ${response.status} with ${body.length} characters.`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${route} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

async function probeJsonRoute(
  baseUrl: string,
  route: string,
): Promise<{ ok: boolean; status?: number; detail: string; body?: unknown }> {
  const url = joinDoctorUrl(baseUrl, route);

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
      },
    });
    const text = await response.text().catch(() => "");

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `${route} returned HTTP ${response.status}.`,
      };
    }

    try {
      const body = JSON.parse(text) as unknown;
      return {
        ok: true,
        status: response.status,
        detail: `${route} returned valid JSON.`,
        body,
      };
    } catch {
      return {
        ok: false,
        status: response.status,
        detail: `${route} did not return valid JSON.`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      detail: `${route} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

async function parseMcpResponse(response: Response): Promise<{
  jsonrpc?: string;
  id?: unknown;
  result?: unknown;
  error?: { code?: unknown; message?: unknown; data?: unknown };
}> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("application/json")) {
    return JSON.parse(body);
  }

  const data = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .filter(Boolean)
    .at(-1);

  if (!data) {
    throw new Error(`Expected MCP JSON-RPC payload, got ${body.slice(0, 120) || "empty body"}.`);
  }

  return JSON.parse(data);
}

async function postMcpJson(
  baseUrl: string,
  route: string,
  body: unknown,
  sessionId?: string,
): Promise<Response> {
  return fetchWithTimeout(joinDoctorUrl(baseUrl, route), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function probeMcpRoute(
  baseUrl: string,
  route: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const initializeResponse = await postMcpJson(baseUrl, route, {
      jsonrpc: "2.0",
      id: "doctor-initialize",
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "@farming-labs/docs doctor",
          version: "0.0.0",
        },
      },
    });
    const initializePayload = await parseMcpResponse(initializeResponse);

    if (!initializeResponse.ok || initializePayload.error) {
      return {
        ok: false,
        detail: `${route} initialize returned HTTP ${initializeResponse.status}: ${String(initializePayload.error?.message ?? "unknown MCP error")}.`,
      };
    }

    const sessionId = initializeResponse.headers.get("mcp-session-id") ?? undefined;

    if (sessionId) {
      await postMcpJson(
        baseUrl,
        route,
        {
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {},
        },
        sessionId,
      ).catch(() => undefined);
    }

    const toolsResponse = await postMcpJson(
      baseUrl,
      route,
      {
        jsonrpc: "2.0",
        id: "doctor-tools-list",
        method: "tools/list",
        params: {},
      },
      sessionId,
    );
    const toolsPayload = await parseMcpResponse(toolsResponse);

    if (sessionId) {
      await fetchWithTimeout(joinDoctorUrl(baseUrl, route), {
        method: "DELETE",
        headers: {
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": sessionId,
        },
      }).catch(() => undefined);
    }

    if (!toolsResponse.ok || toolsPayload.error) {
      return {
        ok: false,
        detail: `${route} tools/list returned HTTP ${toolsResponse.status}: ${String(toolsPayload.error?.message ?? "unknown MCP error")}.`,
      };
    }

    const tools = (toolsPayload.result as { tools?: Array<{ name?: unknown }> } | undefined)?.tools;
    const toolNames = Array.isArray(tools)
      ? tools.map((tool) => tool.name).filter((name): name is string => typeof name === "string")
      : [];
    const expectedTools = [
      "list_docs",
      "list_pages",
      "list_tasks",
      "read_task",
      "get_navigation",
      "search_docs",
      "read_page",
      "get_code_examples",
      "get_config_schema",
    ];
    const missingTools = expectedTools.filter((tool) => !toolNames.includes(tool));

    if (missingTools.length > 0) {
      return {
        ok: false,
        detail: `${route} connected but is missing tools: ${missingTools.join(", ")}.`,
      };
    }

    return {
      ok: true,
      detail: `${route} initialized ${sessionId ? "with a session" : "statelessly"} and exposed ${toolNames.length} MCP tool${toolNames.length === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${route} failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

async function probeMcpRouteCandidates(
  baseUrl: string,
  routes: string[],
): Promise<{ labels: string[]; probes: Array<{ ok: boolean; detail: string }> }> {
  const candidates = buildDocsMcpEndpointCandidates(baseUrl, routes);
  const probes = await Promise.all(
    candidates.map(async (candidate) => {
      const probe = await probeMcpRoute(candidate.baseUrl, candidate.route);
      return {
        ...probe,
        detail: `${candidate.label}: ${probe.detail}`,
      };
    }),
  );

  return {
    labels: candidates.map((candidate) => candidate.label),
    probes,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readDiscoveryRoute(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") ? value : undefined;
}

function hostedSitemapRoutes(discoveryBody: unknown): {
  enabled: boolean;
  routes: string[];
} {
  const sitemap = asRecord(asRecord(discoveryBody)?.sitemap);

  if (sitemap?.enabled === false) {
    return { enabled: false, routes: [] };
  }

  const xml = asRecord(sitemap?.xml);
  const markdown = asRecord(sitemap?.markdown);
  const routes = [
    xml?.enabled === false
      ? undefined
      : (readDiscoveryRoute(xml?.route) ?? DEFAULT_SITEMAP_XML_ROUTE),
    markdown?.enabled === false
      ? undefined
      : (readDiscoveryRoute(markdown?.route) ?? DEFAULT_SITEMAP_MD_ROUTE),
    markdown?.enabled === false ? undefined : readDiscoveryRoute(markdown?.docsRoute),
    markdown?.enabled === false
      ? undefined
      : (readDiscoveryRoute(markdown?.wellKnownRoute) ?? DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE),
  ].filter((route): route is string => typeof route === "string");

  return { enabled: true, routes: Array.from(new Set(routes)) };
}

function hostedRobotsRoute(discoveryBody: unknown): { enabled: boolean; route: string } {
  const robots = asRecord(asRecord(discoveryBody)?.robots);
  return {
    enabled: robots?.enabled === false ? false : true,
    route: readDiscoveryRoute(robots?.route) ?? DEFAULT_ROBOTS_TXT_ROUTE,
  };
}

function hostedMcpRoutes(discoveryBody: unknown): string[] {
  const mcp = asRecord(asRecord(discoveryBody)?.mcp);
  const publicEndpoints = (mcp?.publicEndpoints ?? mcp?.endpoints) as unknown;
  const declaredRoutes = Array.isArray(publicEndpoints)
    ? publicEndpoints.filter(
        (value): value is string => typeof value === "string" && value.startsWith("/"),
      )
    : [];

  if (declaredRoutes.length > 0) return Array.from(new Set(declaredRoutes));

  return Array.from(
    new Set([
      readDiscoveryRoute(mcp?.publicEndpoint) ?? DEFAULT_MCP_PUBLIC_ROUTE,
      readDiscoveryRoute(mcp?.wellKnownEndpoint) ?? DEFAULT_MCP_WELL_KNOWN_ROUTE,
    ]),
  );
}

function hostedCapability(discoveryBody: unknown, key: string): boolean | undefined {
  const root = asRecord(discoveryBody);
  const capabilities = asRecord(root?.capabilities);
  const capability = capabilities?.[key];
  if (typeof capability === "boolean") return capability;

  const block = asRecord(root?.[key]);
  const enabled = block?.enabled;
  return typeof enabled === "boolean" ? enabled : undefined;
}

function hostedRootDocsRoute(discoveryBody: unknown): string {
  const site = asRecord(asRecord(discoveryBody)?.site);
  const entry = typeof site?.entry === "string" && site.entry.trim() ? site.entry.trim() : "docs";
  return `/${entry.replace(/^\/+|\/+$/g, "") || "docs"}`;
}

function hostedPageUrl(baseUrl: string, pageRoute: string): string | undefined {
  try {
    const base = new URL(baseUrl);
    const parsed = new URL(pageRoute, base.origin);
    if (parsed.origin !== base.origin) return undefined;

    parsed.hash = "";
    parsed.search = "";

    const basePath = base.pathname.replace(/\/+$/, "");
    const pagePath = parsed.pathname.replace(/\/+$/, "") || "/";
    const shouldUsePagePath =
      !basePath || pagePath === basePath || pagePath.startsWith(`${basePath}/`);
    const pathname = shouldUsePagePath ? pagePath : `${basePath}${pagePath}`;
    return new URL(pathname || "/", base.origin).toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function sampleHostedPageUrls(
  baseUrl: string,
  discoveryBody: unknown,
  pages: Array<{ url: string }>,
  limit = 10,
): string[] {
  const pageRoutes = pages
    .map((page) => page.url)
    .filter((route) => route.startsWith("/") && !route.endsWith(".md"));
  const fallback = hostedRootDocsRoute(discoveryBody);
  const unique = Array.from(new Set(pageRoutes.length > 0 ? pageRoutes : [fallback])).sort();
  const sampled =
    unique.length <= limit
      ? unique
      : Array.from(
          { length: limit },
          (_, index) => unique[Math.floor(index * (unique.length / limit))]!,
        );

  return sampled
    .map((route) => hostedPageUrl(baseUrl, route))
    .filter((url): url is string => typeof url === "string");
}

interface HostedHtmlPageProbe {
  ok: boolean;
  detail: string;
  hasJsonLd: boolean;
  hasMarkdownAlternate: boolean;
}

async function probeHostedHtmlPage(url: string): Promise<HostedHtmlPageProbe> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: "text/html, */*" },
    });
    const body = await response.text().catch(() => "");
    const pathname = new URL(url).pathname;

    if (!response.ok) {
      return {
        ok: false,
        detail: `${pathname} returned HTTP ${response.status}.`,
        hasJsonLd: false,
        hasMarkdownAlternate: false,
      };
    }

    const alternateUrl = resolveMarkdownAlternateUrl(markdownAlternateHref(body), url);
    return {
      ok: true,
      detail: `${pathname} returned HTML with ${body.length} characters.`,
      hasJsonLd: hasJsonLdScript(body),
      hasMarkdownAlternate: Boolean(alternateUrl),
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${url} failed: ${error instanceof Error ? error.message : String(error)}.`,
      hasJsonLd: false,
      hasMarkdownAlternate: false,
    };
  }
}

function hostedSurfaceScore(
  probes: HostedHtmlPageProbe[],
  predicate: (probe: HostedHtmlPageProbe) => boolean,
): { status: DoctorStatus; score: number; passed: number; total: number } {
  const total = probes.length;
  const passed = probes.filter((probe) => probe.ok && predicate(probe)).length;
  if (total === 0) return { status: "warn", score: 0, passed: 0, total };
  if (passed === total) return { status: "pass", score: 5, passed, total };
  if (passed > 0) return { status: "warn", score: Math.round((passed / total) * 5), passed, total };
  return { status: "fail", score: 0, passed, total };
}

async function buildHostedAgentChecks(
  url: string,
  pages: Array<{ url: string }>,
): Promise<{ baseUrl?: string; checks: AgentDoctorCheck[] }> {
  let baseUrl: string;

  try {
    baseUrl = normalizeDoctorBaseUrl(url);
  } catch (error) {
    return {
      checks: [
        makeCheck(
          "hosted-url",
          "Hosted URL",
          "fail",
          0,
          5,
          `Could not parse --url "${url}": ${error instanceof Error ? error.message : String(error)}`,
          "Pass a full hosted URL such as https://docs.example.com.",
        ),
      ],
    };
  }

  const checks: AgentDoctorCheck[] = [];
  const discovery = await probeJsonRoute(baseUrl, DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE);
  checks.push(
    makeCheck(
      "hosted-agent-discovery",
      "Hosted agent discovery",
      discovery.ok ? "pass" : "fail",
      discovery.ok ? 5 : 0,
      5,
      `${baseUrl}: ${discovery.detail}`,
      discovery.ok
        ? undefined
        : `Make sure ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE} is routed to the shared docs API on the deployed site.`,
    ),
  );

  const llms = await Promise.all([
    probeTextRoute(baseUrl, DEFAULT_LLMS_TXT_ROUTE),
    probeTextRoute(baseUrl, DEFAULT_LLMS_FULL_TXT_ROUTE),
  ]);
  const llmsPassed = llms.filter((result) => result.ok).length;
  checks.push(
    makeCheck(
      "hosted-llms",
      "Hosted llms.txt",
      llmsPassed === llms.length ? "pass" : llmsPassed > 0 ? "warn" : "fail",
      llmsPassed === llms.length ? 5 : llmsPassed > 0 ? 3 : 0,
      5,
      llms.map((result) => result.detail).join(" "),
      llmsPassed === llms.length
        ? undefined
        : "Verify deployed /llms.txt and /llms-full.txt routes return non-empty text.",
    ),
  );

  const sitemapRoutes = hostedSitemapRoutes(discovery.body);
  if (sitemapRoutes.enabled && sitemapRoutes.routes.length > 0) {
    const sitemap = await Promise.all(
      sitemapRoutes.routes.map((route) => probeTextRoute(baseUrl, route)),
    );
    const sitemapPassed = sitemap.filter((result) => result.ok).length;
    checks.push(
      makeCheck(
        "hosted-sitemap",
        "Hosted sitemap",
        sitemapPassed === sitemap.length ? "pass" : sitemapPassed > 0 ? "warn" : "fail",
        sitemapPassed === sitemap.length ? 5 : sitemapPassed > 0 ? 3 : 0,
        5,
        sitemap.map((result) => result.detail).join(" "),
        sitemapPassed === sitemap.length
          ? undefined
          : `Verify deployed sitemap routes return non-empty text: ${sitemapRoutes.routes.join(", ")}.`,
      ),
    );
  } else if (sitemapRoutes.enabled) {
    checks.push(
      makeCheck(
        "hosted-sitemap",
        "Hosted sitemap",
        "warn",
        0,
        5,
        "The hosted discovery spec reports sitemap support but did not expose sitemap routes.",
        "Check sitemap.xml and sitemap.markdown config so at least one sitemap route is enabled.",
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "hosted-sitemap",
        "Hosted sitemap",
        "warn",
        0,
        5,
        "The hosted discovery spec reports sitemap routes as disabled.",
        "Enable sitemap in docs.config when agents and crawlers should discover canonical URLs and freshness metadata.",
      ),
    );
  }

  const robotsRoute = hostedRobotsRoute(discovery.body);
  if (robotsRoute.enabled) {
    const robots = await probeRobotsRoute(baseUrl, robotsRoute.route);
    const robotsAnalysis = robots.body ? analyzeDocsRobotsTxt(robots.body) : undefined;
    const robotsBlocked = robotsAnalysis?.blocksAgentRoutes || robotsAnalysis?.blocksAiAgents;
    const robotsComplete = robotsAnalysis?.hasAgentRoutes && robotsAnalysis?.hasAiPolicy;
    checks.push(
      makeCheck(
        "hosted-robots",
        "Hosted robots.txt",
        robots.ok && !robotsBlocked && robotsComplete
          ? "pass"
          : robots.ok && !robotsBlocked
            ? "warn"
            : "fail",
        robots.ok && !robotsBlocked && robotsComplete ? 5 : robots.ok && !robotsBlocked ? 3 : 0,
        5,
        robots.ok
          ? robotsBlocked
            ? `${robotsRoute.route} is reachable but blocks ${robotsAnalysis?.blocksAiAgents ? "common AI crawlers" : "agent-readable docs routes"}.`
            : robotsComplete
              ? `${robots.detail} It advertises agent-readable routes and common AI crawler policy.`
              : `${robots.detail} It is missing ${robotsAnalysis?.missingRoutes.length ? `agent routes (${robotsAnalysis.missingRoutes.join(", ")})` : "common AI crawler policy"}.`
          : robots.detail,
        robots.ok && !robotsBlocked && robotsComplete
          ? undefined
          : "Publish an agent-friendly robots.txt with `docs robots generate`, or append the generated block to the existing file.",
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "hosted-robots",
        "Hosted robots.txt",
        "warn",
        0,
        5,
        "The hosted discovery spec reports robots.txt as disabled.",
        "Enable robots and publish an agent-friendly robots.txt with `docs robots generate`.",
      ),
    );
  }

  const skill = await Promise.all([
    probeTextRoute(baseUrl, DEFAULT_SKILL_MD_ROUTE),
    probeTextRoute(baseUrl, DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE),
  ]);
  const skillPassed = skill.filter((result) => result.ok).length;
  checks.push(
    makeCheck(
      "hosted-skill",
      "Hosted skill.md",
      skillPassed === skill.length ? "pass" : skillPassed > 0 ? "warn" : "fail",
      skillPassed === skill.length ? 5 : skillPassed > 0 ? 3 : 0,
      5,
      skill.map((result) => result.detail).join(" "),
      skillPassed === skill.length
        ? undefined
        : "Verify deployed /skill.md and /.well-known/skill.md routes return non-empty markdown.",
    ),
  );

  const agents = await Promise.all([
    probeTextRoute(baseUrl, DEFAULT_AGENTS_MD_ROUTE),
    probeTextRoute(baseUrl, DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE),
  ]);
  const agentsPassed = agents.filter((result) => result.ok).length;
  checks.push(
    makeCheck(
      "hosted-agents",
      "Hosted AGENTS.md",
      agentsPassed === agents.length ? "pass" : agentsPassed > 0 ? "warn" : "fail",
      agentsPassed === agents.length ? 5 : agentsPassed > 0 ? 3 : 0,
      5,
      agents.map((result) => result.detail).join(" "),
      agentsPassed === agents.length
        ? undefined
        : "Verify deployed /AGENTS.md and /.well-known/AGENTS.md routes return non-empty markdown.",
    ),
  );

  const markdownRoute = toMarkdownRoute(pages[0]?.url);
  if (markdownRoute) {
    const markdownPageUrl = pages[0]?.url ? joinDoctorUrl(baseUrl, pages[0].url) : undefined;
    const markdownResponseUrl = joinDoctorUrl(baseUrl, markdownRoute);
    const markdown = await probeTextRoute(baseUrl, markdownRoute);
    checks.push(
      makeCheck(
        "hosted-markdown",
        "Hosted markdown route",
        markdown.ok ? "pass" : "fail",
        markdown.ok ? 5 : 0,
        5,
        markdown.detail,
        markdown.ok
          ? undefined
          : `Verify deployed markdown routes are forwarded, starting with ${markdownRoute}.`,
      ),
    );

    const hasCanonicalHeader =
      markdown.ok && markdownPageUrl
        ? hasCanonicalLinkHeader(markdown.linkHeader, markdownPageUrl, markdownResponseUrl)
        : false;
    checks.push(
      makeCheck(
        "hosted-markdown-canonical",
        "Hosted markdown canonical header",
        hasCanonicalHeader ? "pass" : "warn",
        hasCanonicalHeader ? 1 : 0,
        1,
        markdown.ok
          ? hasCanonicalHeader
            ? `${markdownRoute} includes a canonical Link header pointing to ${pages[0]?.url}.`
            : `${markdownRoute} is reachable but is missing a canonical Link response header.`
          : markdown.detail,
        hasCanonicalHeader
          ? undefined
          : 'Return `Link: <canonical-page-url>; rel="canonical"` on successful markdown page responses so agents can cite the normal docs URL.',
      ),
    );
  } else {
    checks.push(
      makeCheck(
        "hosted-markdown",
        "Hosted markdown route",
        "warn",
        0,
        5,
        "No local docs page was available to choose a sample .md route.",
        "Add docs pages so the hosted doctor can probe a representative .md route.",
      ),
    );
    checks.push(
      makeCheck(
        "hosted-markdown-canonical",
        "Hosted markdown canonical header",
        "warn",
        0,
        1,
        "No local docs page was available to choose a sample .md route.",
        "Add docs pages so the hosted doctor can probe a markdown canonical Link header.",
      ),
    );
  }

  const htmlPageUrls = sampleHostedPageUrls(baseUrl, discovery.body, pages);
  const htmlPageProbes = await Promise.all(
    htmlPageUrls.map((pageUrl) => probeHostedHtmlPage(pageUrl)),
  );
  const structuredDataScore = hostedSurfaceScore(htmlPageProbes, (probe) => probe.hasJsonLd);
  const structuredDataEnabled = hostedCapability(discovery.body, "structuredData");
  checks.push(
    makeCheck(
      "hosted-structured-data",
      "Hosted structured data",
      structuredDataEnabled === false ? "warn" : structuredDataScore.status,
      structuredDataEnabled === false ? 0 : structuredDataScore.score,
      5,
      structuredDataEnabled === false
        ? "The hosted discovery spec reports structured data as disabled."
        : structuredDataScore.total > 0
          ? `${structuredDataScore.passed}/${structuredDataScore.total} sampled hosted docs pages include application/ld+json structured data.`
          : "No hosted docs pages were available to verify application/ld+json structured data.",
      structuredDataEnabled === false || structuredDataScore.status === "pass"
        ? undefined
        : "Keep JSON-LD enabled on every docs page so agents can read canonical title, description, URL, breadcrumbs, and freshness hints.",
    ),
  );

  const markdownAlternateScore = hostedSurfaceScore(
    htmlPageProbes,
    (probe) => probe.hasMarkdownAlternate,
  );
  const markdownRoutesEnabled = hostedCapability(discovery.body, "markdownRoutes");
  checks.push(
    makeCheck(
      "hosted-markdown-alternate",
      "Hosted markdown alternate links",
      markdownRoutesEnabled === false ? "warn" : markdownAlternateScore.status,
      markdownRoutesEnabled === false ? 0 : markdownAlternateScore.score,
      5,
      markdownRoutesEnabled === false
        ? "The hosted discovery spec reports markdown routes as disabled."
        : markdownAlternateScore.total > 0
          ? `${markdownAlternateScore.passed}/${markdownAlternateScore.total} sampled hosted docs pages include <link rel="alternate" type="text/markdown"> pointing to .md routes.`
          : "No hosted docs pages were available to verify markdown alternate links.",
      markdownRoutesEnabled === false || markdownAlternateScore.status === "pass"
        ? undefined
        : "Add a text/markdown alternate link in each docs page head, usually through `alternates.types['text/markdown']`, so agents can discover the page markdown URL from HTML.",
    ),
  );

  const mcp = await probeMcpRouteCandidates(baseUrl, hostedMcpRoutes(discovery.body));
  const mcpPassed = mcp.probes.filter((result) => result.ok).length;
  const mcpDetailProbes = mcpPassed > 0 ? mcp.probes.filter((result) => result.ok) : mcp.probes;
  checks.push(
    makeCheck(
      "hosted-mcp",
      "Hosted MCP handshake",
      mcpPassed > 0 ? "pass" : "fail",
      mcpPassed > 0 ? 10 : 0,
      10,
      mcpDetailProbes.map((result) => result.detail).join(" "),
      mcpPassed > 0
        ? undefined
        : `Verify one of ${mcp.labels.join(" or ")} supports Streamable HTTP initialize and tools/list.`,
    ),
  );

  return { baseUrl, checks };
}

async function loadDocsConfigModuleWithProjectEnv(
  rootDir: string,
  explicitPath?: string,
): Promise<{ path: string; config: DocsConfig } | null> {
  const env = loadProjectEnv(rootDir);
  const injectedKeys = Object.entries(env)
    .filter(([key]) => process.env[key] === undefined)
    .map(([key, value]) => {
      process.env[key] = value;
      return key;
    });

  try {
    return await loadDocsConfigModule(rootDir, explicitPath);
  } finally {
    for (const key of injectedKeys) {
      delete process.env[key];
    }
  }
}

function makeCheck(
  id: string,
  title: string,
  status: DoctorStatus,
  score: number,
  maxScore: number,
  detail: string,
  recommendation?: string,
): AgentDoctorCheck {
  return { id, title, status, score, maxScore, detail, recommendation };
}

export async function inspectAgentReadiness(
  options: DoctorOptions = {},
): Promise<AgentDoctorReport> {
  const rootDir = process.cwd();
  const files = listProjectFiles(rootDir);
  const framework = detectFramework(rootDir) ?? detectFrameworkFromFiles(files) ?? "unknown";
  const configCheckMax = 10;

  let configPath: string | undefined;
  try {
    configPath = resolveDocsConfigPath(rootDir, options.configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const checks = [
      makeCheck(
        "config",
        "Docs config",
        "fail",
        0,
        configCheckMax,
        message,
        "Add docs.config.ts[x] or pass --config so the doctor can inspect the docs app.",
      ),
    ];

    return {
      mode: "agent",
      framework,
      score: 0,
      maxScore: 100,
      grade: gradeForAgentScore(0),
      checks,
      coverage: {
        totalPages: 0,
        pagesWithAgentFiles: 0,
        pagesWithAgentBlocks: 0,
        explicitPages: 0,
        explicitCoverage: 0,
        compaction: {
          freshGeneratedPages: 0,
          staleGeneratedPages: 0,
          modifiedGeneratedPages: 0,
          unknownGeneratedPages: 0,
          tokenBudgetMissingPages: 0,
          otherMissingPages: 0,
        },
      },
      recommendations: checks.map((check) => check.recommendation).filter(Boolean) as string[],
    };
  }

  const configContent = readFileSync(configPath, "utf-8");
  const loadedConfig = await loadDocsConfigModuleWithProjectEnv(rootDir, options.configPath);
  const config = loadedConfig?.config;
  const entry = config?.entry ?? readTopLevelStringProperty(configContent, "entry") ?? "docs";
  const contentDir = config?.contentDir ?? resolveDocsContentDir(rootDir, configContent, entry);
  const ordering =
    config?.ordering === "alphabetical" ||
    config?.ordering === "numeric" ||
    Array.isArray(config?.ordering)
      ? config.ordering
      : undefined;
  const siteTitle =
    typeof config?.nav?.title === "string"
      ? config.nav.title
      : (readNavTitle(configContent) ?? "Documentation");
  const staticExport = resolveStaticExport(config, configContent);
  const llmsEnabled = resolveFeatureEnabled(config, configContent, "llmsTxt");
  const searchEnabled = resolveFeatureEnabled(config, configContent, "search");
  const mcpEnabled = resolveFeatureEnabled(config, configContent, "mcp");
  const agentFeedbackEnabled = resolveAgentFeedbackEnabled(config, configContent);
  const compactConfigured = hasAgentCompactDefaults(config, configContent);
  const skillFileExists = existsSync(path.join(rootDir, "skill.md"));
  const agentsFileExists =
    existsSync(path.join(rootDir, "AGENTS.md")) || existsSync(path.join(rootDir, "AGENT.md"));

  const source = createFilesystemDocsMcpSource({
    rootDir,
    entry,
    contentDir,
    siteTitle,
    ordering,
  });
  const pages = await Promise.resolve(source.getPages());
  const coverage = buildCoverage(pages);
  const compactionCoverage = buildCompactionCoverage(
    rootDir,
    contentDir,
    entry,
    pages,
    config?.agent?.compact ?? {},
  );
  coverage.compaction = compactionCoverage;
  const metadataCoverage = buildMetadataCoverage(pages);
  const metadataResult = metadataScore(
    metadataCoverage.descriptionCoverage,
    metadataCoverage.relatedCoverage,
  );
  const compactionResult = compactionFreshnessScore(compactionCoverage, compactConfigured);
  const routeSurface = detectRouteSurface(rootDir, framework, staticExport, files);
  const mcpConfig = resolveDocsMcpConfig(
    (config?.mcp as boolean | DocsMcpConfig | undefined) ?? undefined,
    {
      defaultName: siteTitle,
    },
  );
  const sitemapConfig = resolveDocsSitemapConfig(
    config?.sitemap ?? readSitemapConfigFromStatic(configContent) ?? true,
  );
  const robotsInput = config?.robots ?? readRobotsConfigFromStatic(configContent) ?? true;
  const robotsConfig =
    robotsInput === false
      ? resolveDocsRobotsConfig(false)
      : resolveDocsRobotsConfig(robotsInput, {
          baseUrl:
            (typeof robotsInput === "object" ? robotsInput.baseUrl : undefined) ??
            sitemapConfig.baseUrl,
        });
  const robotsPath = resolveRobotsFilePath(
    rootDir,
    framework,
    typeof robotsInput === "object" ? robotsInput : undefined,
  );
  const feedbackRoute = DEFAULT_AGENT_FEEDBACK_ROUTE;
  const feedbackSchemaRoute = `${feedbackRoute}/schema`;

  const checks: AgentDoctorCheck[] = [];

  checks.push(
    makeCheck(
      "config",
      "Docs config",
      "pass",
      10,
      configCheckMax,
      loadedConfig
        ? `Resolved ${path.relative(rootDir, loadedConfig.path).replace(/\\/g, "/")} and evaluated the config module.`
        : `Resolved ${path.relative(rootDir, configPath).replace(/\\/g, "/")} using static parsing fallback.`,
    ),
  );

  const contentDirAbs = path.resolve(rootDir, contentDir);
  checks.push(
    coverage.totalPages > 0
      ? makeCheck(
          "content",
          "Docs content",
          "pass",
          10,
          10,
          `Found ${coverage.totalPages} docs page${coverage.totalPages === 1 ? "" : "s"} in ${path.relative(rootDir, contentDirAbs).replace(/\\/g, "/")}.`,
        )
      : makeCheck(
          "content",
          "Docs content",
          "fail",
          0,
          10,
          `No folder-based docs pages were found in ${path.relative(rootDir, contentDirAbs).replace(/\\/g, "/")}.`,
          "Add index/page MDX files under the configured contentDir so the machine-readable surfaces have pages to serve.",
        ),
  );

  checks.push(
    makeCheck(
      "api-route",
      "Docs API route",
      routeSurface.apiMounted ? "pass" : "fail",
      routeSurface.apiMounted ? 10 : 0,
      10,
      routeSurface.apiDetail,
      routeSurface.apiMounted
        ? undefined
        : "Wire the framework docs API route so /api/docs can serve markdown, llms.txt, sitemap, AGENTS.md, skill.md, and discovery responses.",
    ),
  );

  checks.push(
    makeCheck(
      "public-routes",
      "Public agent routes",
      routeSurface.publicMounted ? "pass" : "fail",
      routeSurface.publicMounted ? 10 : 0,
      10,
      routeSurface.publicDetail,
      routeSurface.publicMounted
        ? undefined
        : "Add the framework public forwarder so /.well-known/*, /llms.txt, /sitemap.xml, /sitemap.md, /docs/sitemap.md, /AGENTS.md, /skill.md, /mcp, and .md routes resolve from the shared docs API.",
    ),
  );

  checks.push(
    makeCheck(
      "agent-discovery",
      "Agent discovery spec",
      routeSurface.apiMounted && routeSurface.publicMounted ? "pass" : "fail",
      routeSurface.apiMounted && routeSurface.publicMounted ? 5 : 0,
      5,
      routeSurface.apiMounted && routeSurface.publicMounted
        ? `Expected discovery endpoints are available through ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}, ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}, and /api/docs?agent=spec.`
        : "Could not verify the shared agent discovery spec endpoints because docs API/public route wiring is incomplete.",
      routeSurface.apiMounted && routeSurface.publicMounted
        ? undefined
        : "Make sure both the docs API handler and the public docs forwarder are mounted so agents can discover the site through the well-known agent spec.",
    ),
  );

  checks.push(
    llmsEnabled
      ? makeCheck(
          "llms",
          "llms.txt discovery",
          "pass",
          5,
          5,
          `Enabled via ${DEFAULT_LLMS_TXT_ROUTE} and ${DEFAULT_LLMS_FULL_TXT_ROUTE}.`,
        )
      : makeCheck(
          "llms",
          "llms.txt discovery",
          "warn",
          0,
          5,
          `${DEFAULT_LLMS_TXT_ROUTE} and ${DEFAULT_LLMS_FULL_TXT_ROUTE} are disabled in docs config.`,
          "Enable llmsTxt so agents and GEO crawlers can discover the docs index and full context surfaces.",
        ),
  );

  checks.push(
    sitemapConfig.enabled
      ? makeCheck(
          "sitemap",
          "Sitemap discovery",
          "pass",
          5,
          5,
          `Enabled via ${[
            sitemapConfig.xml.route,
            sitemapConfig.markdown.route,
            sitemapConfig.markdown.docsRoute,
            sitemapConfig.markdown.wellKnownRoute,
          ]
            .filter(Boolean)
            .join(", ")}.`,
        )
      : makeCheck(
          "sitemap",
          "Sitemap discovery",
          "warn",
          0,
          5,
          "Generated sitemap routes are disabled in docs config.",
          "Enable sitemap so crawlers and agents can discover canonical docs URLs, semantic sections, and lastmod freshness metadata.",
        ),
  );

  const relativeRobotsPath = path.relative(rootDir, robotsPath).replace(/\\/g, "/");
  if (!robotsConfig.enabled) {
    checks.push(
      makeCheck(
        "robots",
        "Robots agent policy",
        "warn",
        0,
        5,
        "Robots generation is disabled in docs config.",
        "Enable robots and run `docs robots generate` so crawlers can discover agent-readable docs routes.",
      ),
    );
  } else if (!existsSync(robotsPath)) {
    if (routeSurface.apiMounted && routeSurface.publicMounted && !staticExport) {
      checks.push(
        makeCheck(
          "robots",
          "Robots agent policy",
          "pass",
          5,
          5,
          "Runtime /robots.txt is served by the shared docs handler.",
        ),
      );
    } else {
      checks.push(
        makeCheck(
          "robots",
          "Robots agent policy",
          "warn",
          0,
          5,
          `No robots.txt found at ${relativeRobotsPath}.`,
          `Run docs robots generate --path ${relativeRobotsPath} to publish an agent-friendly crawl policy.`,
        ),
      );
    }
  } else {
    const robots = readFileSync(robotsPath, "utf-8");
    const analysis = analyzeDocsRobotsTxt(robots, {
      entry,
      sitemap: sitemapConfig,
      baseUrl: robotsConfig.baseUrl,
      robots: robotsConfig,
    });
    const blocked = analysis.blocksAgentRoutes || analysis.blocksAiAgents;
    const complete = analysis.hasAgentRoutes && analysis.hasAiPolicy;

    checks.push(
      makeCheck(
        "robots",
        "Robots agent policy",
        blocked ? "fail" : complete ? "pass" : "warn",
        blocked ? 0 : complete ? 5 : 3,
        5,
        blocked
          ? `${relativeRobotsPath} blocks ${analysis.blocksAiAgents ? "common AI crawlers" : "agent-readable docs routes"}.`
          : complete
            ? `${relativeRobotsPath} advertises agent-readable routes and common AI crawler policy.`
            : `${relativeRobotsPath} exists, but is missing ${analysis.missingRoutes.length > 0 ? `agent routes (${analysis.missingRoutes.join(", ")})` : "common AI crawler policy"}.`,
        blocked || !complete
          ? `Run docs robots generate --append --path ${relativeRobotsPath} to add the generated agent policy without replacing the existing file.`
          : undefined,
      ),
    );
  }

  checks.push(
    skillFileExists
      ? makeCheck(
          "skill",
          "Skill document",
          "pass",
          5,
          5,
          `Found root skill.md for ${DEFAULT_SKILL_MD_ROUTE} and ${DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE}.`,
        )
      : makeCheck(
          "skill",
          "Skill document",
          "pass",
          5,
          5,
          `No root skill.md found; the framework will serve the generated fallback at ${DEFAULT_SKILL_MD_ROUTE}.`,
        ),
  );

  checks.push(
    agentsFileExists
      ? makeCheck(
          "agents",
          "Agent instructions",
          "pass",
          5,
          5,
          `Found root AGENTS.md/AGENT.md for ${DEFAULT_AGENTS_MD_ROUTE} and ${DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE}.`,
        )
      : makeCheck(
          "agents",
          "Agent instructions",
          "pass",
          5,
          5,
          `No root AGENTS.md found; the framework will serve the generated fallback at ${DEFAULT_AGENTS_MD_ROUTE}.`,
        ),
  );

  checks.push(
    mcpEnabled
      ? makeCheck(
          "mcp",
          "MCP access",
          "pass",
          10,
          10,
          `Enabled with public aliases ${DEFAULT_MCP_PUBLIC_ROUTE} and ${DEFAULT_MCP_WELL_KNOWN_ROUTE} (canonical route ${mcpConfig.route}).`,
        )
      : makeCheck(
          "mcp",
          "MCP access",
          "warn",
          0,
          10,
          "MCP is disabled in docs config.",
          "Enable mcp so agents can use list/search/read tools directly instead of only scraping markdown routes.",
        ),
  );

  checks.push(
    searchEnabled
      ? makeCheck(
          "search",
          "Search surface",
          "pass",
          5,
          5,
          "Search is enabled for the shared docs API and agent flows.",
        )
      : makeCheck(
          "search",
          "Search surface",
          "warn",
          0,
          5,
          "Search is disabled in docs config.",
          "Enable search so agents can narrow retrieval before reading whole markdown pages.",
        ),
  );

  checks.push(
    agentFeedbackEnabled
      ? makeCheck(
          "feedback",
          "Agent feedback",
          "pass",
          5,
          5,
          `Structured agent feedback is enabled at ${feedbackRoute} with schema ${feedbackSchemaRoute}.`,
        )
      : makeCheck(
          "feedback",
          "Agent feedback",
          "warn",
          0,
          5,
          "Structured agent feedback is not enabled.",
          "Enable feedback.agent if you want agents to discover and post feedback through the shared docs API.",
        ),
  );

  checks.push(
    makeCheck(
      "metadata",
      "Page metadata",
      metadataResult.status,
      metadataResult.score,
      5,
      coverage.totalPages > 0
        ? `${metadataCoverage.describedPages}/${coverage.totalPages} pages include descriptions and ${metadataCoverage.relatedPages}/${coverage.totalPages} pages include related links (${metadataCoverage.descriptionCoverage}% described, ${metadataCoverage.relatedCoverage}% related).`
        : "No docs pages were available to score page metadata.",
      metadataCoverage.descriptionCoverage >= 75
        ? undefined
        : "Add page descriptions and related links to more docs pages so agent markdown output carries better context and navigation hints.",
    ),
  );

  const coverageResult = coverageScore(coverage.explicitCoverage);
  checks.push(
    makeCheck(
      "coverage",
      "Explicit page optimization",
      coverageResult.status,
      coverageResult.score,
      10,
      coverage.totalPages > 0
        ? `${coverage.explicitPages}/${coverage.totalPages} pages define explicit machine-only context (${coverage.pagesWithAgentFiles} agent.md, ${coverage.pagesWithAgentBlocks} Agent blocks, ${coverage.explicitCoverage}% of pages).`
        : "No docs pages were available to score explicit page optimization.",
      coverage.explicitCoverage >= 50
        ? undefined
        : "Add agent.md files or <Agent> blocks to more pages, or run docs agent compact to create page-level machine docs.",
    ),
  );

  checks.push(
    makeCheck(
      "compact",
      "Agent compaction freshness",
      compactionResult.status,
      compactionResult.score,
      5,
      `${compactionCoverage.freshGeneratedPages} fresh, ${compactionCoverage.staleGeneratedPages} stale, ${compactionCoverage.modifiedGeneratedPages} modified, ${compactionCoverage.unknownGeneratedPages} unknown, ${compactionCoverage.tokenBudgetMissingPages} token-budget missing, and ${compactionCoverage.otherMissingPages} other missing page${compactionCoverage.otherMissingPages === 1 ? "" : "s"} across compactable docs pages.` +
        (compactConfigured
          ? " agent.compact defaults are configured."
          : " No agent.compact defaults were found in docs config."),
      compactionResult.recommendation,
    ),
  );

  const hosted = options.url ? await buildHostedAgentChecks(options.url, pages) : undefined;
  if (hosted) {
    checks.push(...hosted.checks);
  }

  const rawScore = checks.reduce((total, check) => total + check.score, 0);
  const rawMaxScore = checks.reduce((total, check) => total + check.maxScore, 0);
  const { score, maxScore } = normalizedDoctorScore(rawScore, rawMaxScore);

  return {
    mode: "agent",
    framework,
    configPath: path.relative(rootDir, configPath).replace(/\\/g, "/"),
    entry,
    contentDir,
    url: hosted?.baseUrl,
    score,
    maxScore,
    grade: gradeForAgentScore(score),
    checks,
    coverage,
    recommendations: checks
      .map((check) => check.recommendation)
      .filter((recommendation): recommendation is string => Boolean(recommendation))
      .slice(0, 3),
  };
}

export async function inspectHumanReadiness(
  options: DoctorOptions = {},
): Promise<HumanDoctorReport> {
  const rootDir = process.cwd();
  const files = listProjectFiles(rootDir);
  const framework = detectFramework(rootDir) ?? detectFrameworkFromFiles(files) ?? "unknown";
  const configCheckMax = 10;

  let configPath: string | undefined;
  try {
    configPath = resolveDocsConfigPath(rootDir, options.configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const checks = [
      makeCheck(
        "config",
        "Docs config",
        "fail",
        0,
        configCheckMax,
        message,
        "Add docs.config.ts[x] or pass --config so the doctor can inspect the docs app.",
      ),
    ];

    return {
      mode: "human",
      framework,
      score: 0,
      maxScore: 100,
      grade: gradeForHumanScore(0),
      checks,
      coverage: {
        totalPages: 0,
        describedPages: 0,
        descriptionCoverage: 0,
        longPages: 0,
        structuredLongPages: 0,
        structureCoverage: 0,
        navigationPages: 0,
      },
      recommendations: checks.map((check) => check.recommendation).filter(Boolean) as string[],
    };
  }

  const configContent = readFileSync(configPath, "utf-8");
  const loadedConfig = await loadDocsConfigModuleWithProjectEnv(rootDir, options.configPath);
  const config = loadedConfig?.config;
  const entry = config?.entry ?? readTopLevelStringProperty(configContent, "entry") ?? "docs";
  const contentDir = config?.contentDir ?? resolveDocsContentDir(rootDir, configContent, entry);
  const ordering =
    config?.ordering === "alphabetical" ||
    config?.ordering === "numeric" ||
    Array.isArray(config?.ordering)
      ? config.ordering
      : undefined;
  const siteTitle =
    typeof config?.nav?.title === "string"
      ? config.nav.title
      : (readNavTitle(configContent) ?? "Documentation");
  const searchEnabled = resolveFeatureEnabled(config, configContent, "search");
  const humanFeedbackEnabled = resolveHumanFeedbackEnabled(config, configContent);
  const lastUpdatedEnabled = resolveLastUpdatedEnabled(config, configContent);
  const githubEnabled = hasGithubIntegration(config, configContent);
  const readingTimeEnabled = hasReadingTimeSurface(config, configContent);

  const source = createFilesystemDocsMcpSource({
    rootDir,
    entry,
    contentDir,
    siteTitle,
    ordering,
  });
  const pages = await Promise.resolve(source.getPages());
  const navigation = await Promise.resolve(source.getNavigation());
  const navigationPages = countNavigationPages(navigation as { children?: unknown[] });
  const coverage = buildHumanCoverage(pages, navigationPages);
  const descriptionResult = descriptionScore(coverage.descriptionCoverage);
  const structureResult = structureScore(coverage.structureCoverage);
  const navigationCoverage =
    coverage.totalPages === 0
      ? 0
      : Math.min(100, Math.round((coverage.navigationPages / coverage.totalPages) * 100));
  const navigationResult = navigationScore(navigationCoverage);

  const checks: HumanDoctorCheck[] = [];

  checks.push(
    makeCheck(
      "config",
      "Docs config",
      "pass",
      10,
      10,
      loadedConfig
        ? `Resolved ${path.relative(rootDir, loadedConfig.path).replace(/\\/g, "/")} and evaluated the config module.`
        : `Resolved ${path.relative(rootDir, configPath).replace(/\\/g, "/")} using static parsing fallback.`,
    ),
  );

  const contentDirAbs = path.resolve(rootDir, contentDir);
  checks.push(
    coverage.totalPages > 0
      ? makeCheck(
          "content",
          "Docs content",
          "pass",
          15,
          15,
          `Found ${coverage.totalPages} docs page${coverage.totalPages === 1 ? "" : "s"} in ${path.relative(rootDir, contentDirAbs).replace(/\\/g, "/")}.`,
        )
      : makeCheck(
          "content",
          "Docs content",
          "fail",
          0,
          15,
          `No folder-based docs pages were found in ${path.relative(rootDir, contentDirAbs).replace(/\\/g, "/")}.`,
          "Add index/page MDX files under the configured contentDir so the human docs site has pages to render.",
        ),
  );

  checks.push(
    makeCheck(
      "navigation",
      "Navigation coverage",
      navigationResult.status,
      navigationResult.score,
      15,
      coverage.totalPages > 0
        ? `The generated docs navigation exposes ${coverage.navigationPages}/${coverage.totalPages} page entries (${navigationCoverage}% coverage).`
        : "No docs pages were available to score navigation coverage.",
      navigationCoverage >= 100
        ? undefined
        : "Make sure every important docs page is reachable from the generated navigation tree and not stranded outside the main docs flow.",
    ),
  );

  checks.push(
    makeCheck(
      "descriptions",
      "Page descriptions",
      descriptionResult.status,
      descriptionResult.score,
      15,
      coverage.totalPages > 0
        ? `${coverage.describedPages}/${coverage.totalPages} pages include a description (${coverage.descriptionCoverage}% coverage).`
        : "No docs pages were available to score descriptions.",
      coverage.descriptionCoverage >= 75
        ? undefined
        : "Add frontmatter descriptions to more pages so readers get better search snippets, summaries, and page introductions.",
    ),
  );

  checks.push(
    makeCheck(
      "structure",
      "Page structure",
      structureResult.status,
      structureResult.score,
      15,
      coverage.longPages > 0
        ? `${coverage.structuredLongPages}/${coverage.longPages} longer pages include section headings (${coverage.structureCoverage}% coverage).`
        : "No longer docs pages required section-heading checks.",
      coverage.structureCoverage >= 75
        ? undefined
        : "Break longer pages into clearer sections with H2/H3 headings so readers can scan and navigate without hitting a wall of text.",
    ),
  );

  checks.push(
    searchEnabled
      ? makeCheck(
          "search",
          "Search surface",
          "pass",
          10,
          10,
          "Search is enabled for the docs site.",
        )
      : makeCheck(
          "search",
          "Search surface",
          "warn",
          0,
          10,
          "Search is disabled in docs config.",
          "Enable search so readers can jump directly to the right page instead of relying only on sidebar browsing.",
        ),
  );

  const trustScore = (githubEnabled ? 5 : 0) + (lastUpdatedEnabled ? 5 : 0);
  checks.push(
    makeCheck(
      "trust",
      "Trust signals",
      trustScore === 10 ? "pass" : "warn",
      trustScore,
      10,
      githubEnabled && lastUpdatedEnabled
        ? "Edit links and last-updated metadata are configured."
        : githubEnabled
          ? "Edit links are configured, but last-updated metadata is not enabled."
          : lastUpdatedEnabled
            ? "Last-updated metadata is enabled, but edit links are not configured."
            : "Edit links and last-updated metadata are not configured.",
      trustScore === 10
        ? undefined
        : "Configure GitHub edit links and/or lastUpdated so readers can trust freshness and find the source of truth faster.",
    ),
  );

  checks.push(
    humanFeedbackEnabled
      ? makeCheck(
          "feedback",
          "Reader feedback",
          "pass",
          5,
          5,
          "Built-in page feedback is enabled for the docs site.",
        )
      : makeCheck(
          "feedback",
          "Reader feedback",
          "warn",
          0,
          5,
          "Built-in page feedback is not enabled.",
          "Enable feedback if you want readers to leave quick page-level quality signals without opening an issue.",
        ),
  );

  checks.push(
    readingTimeEnabled
      ? makeCheck(
          "reading-time",
          "Reading-time cues",
          "pass",
          5,
          5,
          "Reading time is configured for the docs site.",
        )
      : makeCheck(
          "reading-time",
          "Reading-time cues",
          "warn",
          0,
          5,
          "Reading time is not enabled.",
          "Enable readingTime if you want readers to get a quick effort estimate before they dive into longer pages.",
        ),
  );

  const rawScore = checks.reduce((total, check) => total + check.score, 0);
  const rawMaxScore = checks.reduce((total, check) => total + check.maxScore, 0);
  const { score, maxScore } = normalizedDoctorScore(rawScore, rawMaxScore);

  return {
    mode: "human",
    framework,
    configPath: path.relative(rootDir, configPath).replace(/\\/g, "/"),
    entry,
    contentDir,
    score,
    maxScore,
    grade: gradeForHumanScore(score),
    checks,
    coverage,
    recommendations: checks
      .map((check) => check.recommendation)
      .filter((recommendation): recommendation is string => Boolean(recommendation))
      .slice(0, 3),
  };
}

export function printAgentDoctorReport(report: AgentDoctorReport) {
  console.log(`${pc.bold("@farming-labs/docs doctor")} ${pc.dim("—")} ${pc.bold("agent")}`);
  console.log();
  console.log(`${pc.bold("Score:")} ${pc.cyan(`${report.score}%`)} ${pc.dim(`(${report.grade})`)}`);
  console.log(
    `${pc.bold("Framework:")} ${report.framework} ${pc.dim("•")} ${pc.bold("Entry:")} ${report.entry ?? "docs"} ${pc.dim("•")} ${pc.bold("Content:")} ${report.contentDir ?? "-"}`,
  );
  if (report.url) {
    console.log(`${pc.bold("Hosted URL:")} ${report.url}`);
  }
  console.log(
    `${pc.bold("Explicit agent-friendly pages:")} ${report.coverage.explicitPages}/${report.coverage.totalPages} pages ${pc.dim(`(${report.coverage.explicitCoverage}%)`)}`,
  );
  console.log(
    `${pc.bold("Generated agent.md freshness:")} ${report.coverage.compaction.freshGeneratedPages} fresh ${pc.dim("•")} ${report.coverage.compaction.staleGeneratedPages} stale ${pc.dim("•")} ${report.coverage.compaction.modifiedGeneratedPages} modified ${pc.dim("•")} ${report.coverage.compaction.tokenBudgetMissingPages} token-budget missing`,
  );

  if (report.fixes && report.fixes.length > 0) {
    console.log(
      `${pc.bold("Fixes:")} ${report.fixes
        .map((fix) => `${fix.status === "applied" ? "applied" : "skipped"} ${fix.title}`)
        .join(pc.dim(" • "))}`,
    );
  }

  console.log();

  for (const check of report.checks) {
    console.log(
      `${formatStatus(check.status)} ${check.title} ${pc.dim(`(${check.score}/${check.maxScore})`)}`,
    );
    console.log(`  ${check.detail}`);
  }

  if (report.recommendations.length > 0) {
    console.log();
    console.log(pc.bold("Next steps"));
    for (const recommendation of report.recommendations) {
      console.log(`- ${recommendation}`);
    }
  }

  console.log();
  console.log(
    pc.dim(
      `Expected public surfaces: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}, ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}, ${DEFAULT_LLMS_TXT_ROUTE}, ${DEFAULT_LLMS_FULL_TXT_ROUTE}, ${DEFAULT_AGENTS_MD_ROUTE}, ${DEFAULT_SKILL_MD_ROUTE}, ${DEFAULT_MCP_PUBLIC_ROUTE}`,
    ),
  );
}

export function printHumanDoctorReport(report: HumanDoctorReport) {
  console.log(`${pc.bold("@farming-labs/docs doctor")} ${pc.dim("—")} ${pc.bold("site")}`);
  console.log();
  console.log(`${pc.bold("Score:")} ${pc.cyan(`${report.score}%`)} ${pc.dim(`(${report.grade})`)}`);
  console.log(
    `${pc.bold("Framework:")} ${report.framework} ${pc.dim("•")} ${pc.bold("Entry:")} ${report.entry ?? "docs"} ${pc.dim("•")} ${pc.bold("Content:")} ${report.contentDir ?? "-"}`,
  );
  console.log(
    `${pc.bold("Described pages:")} ${report.coverage.describedPages}/${report.coverage.totalPages} pages ${pc.dim(`(${report.coverage.descriptionCoverage}%)`)}`,
  );
  console.log();

  for (const check of report.checks) {
    console.log(
      `${formatStatus(check.status)} ${check.title} ${pc.dim(`(${check.score}/${check.maxScore})`)}`,
    );
    console.log(`  ${check.detail}`);
  }

  if (report.recommendations.length > 0) {
    console.log();
    console.log(pc.bold("Next steps"));
    for (const recommendation of report.recommendations) {
      console.log(`- ${recommendation}`);
    }
  }
}

function serializeDoctorJsonReport(report: AgentDoctorReport | HumanDoctorReport) {
  if (report.mode === "human") {
    return {
      ...report,
      mode: "site" as const,
    };
  }

  return report;
}

export function printDoctorJsonReport(report: AgentDoctorReport | HumanDoctorReport) {
  console.log(JSON.stringify(serializeDoctorJsonReport(report), null, 2));
}

function hasNonPassingDoctorCheck(report: AgentDoctorReport | HumanDoctorReport) {
  return report.checks.some((check) => check.status !== "pass");
}

function hasFailingDoctorCheck(report: AgentDoctorReport | HumanDoctorReport) {
  return report.checks.some((check) => check.status === "fail");
}

function applyDoctorExitCode(
  report: AgentDoctorReport | HumanDoctorReport,
  options: DoctorOptions,
) {
  const failOn = options.failOn ?? (options.strict ? "warn" : undefined);
  if (!failOn) {
    return;
  }

  const shouldFail =
    failOn === "warn" ? hasNonPassingDoctorCheck(report) : hasFailingDoctorCheck(report);

  if (shouldFail) {
    process.exitCode = 1;
  }
}

async function runAgentDoctorFixes(
  report: AgentDoctorReport,
  options: DoctorOptions,
): Promise<AgentDoctorFix[]> {
  const fixes: AgentDoctorFix[] = [];
  const compaction = report.coverage.compaction;
  const shouldRunCompaction =
    compaction.staleGeneratedPages > 0 || compaction.tokenBudgetMissingPages > 0;

  if (!shouldRunCompaction) {
    if (compaction.modifiedGeneratedPages > 0 || compaction.unknownGeneratedPages > 0) {
      fixes.push({
        id: "agent-compact",
        title: "agent compact",
        status: "skipped",
        detail:
          "Only modified or unknown generated agent.md files need attention; doctor --fix leaves those for manual review.",
      });
    }

    return fixes;
  }

  const runCompaction = () =>
    compactAgentDocs({
      configPath: options.configPath,
      stale: true,
      includeMissing: compaction.tokenBudgetMissingPages > 0,
    });
  const command = `docs agent compact --stale${compaction.tokenBudgetMissingPages > 0 ? " --include-missing" : ""}`;

  if (options.dryRun) {
    const missingOutputDetail =
      compaction.tokenBudgetMissingPages > 0 ? " and create token-budget missing outputs" : "";

    fixes.push({
      id: "agent-compact",
      title: "agent compact",
      status: "skipped",
      detail: `Dry run: would run ${command} to refresh stale generated agent.md files${missingOutputDetail}.`,
    });

    return fixes;
  }

  if (options.json) {
    const originalLog = console.log;
    console.log = () => undefined;
    try {
      await runCompaction();
    } finally {
      console.log = originalLog;
    }
  } else {
    console.log();
    console.log(pc.bold("Applying doctor --fix"));
    await runCompaction();
  }

  fixes.push({
    id: "agent-compact",
    title: "agent compact",
    status: "applied",
    detail:
      compaction.tokenBudgetMissingPages > 0
        ? "Ran docs agent compact --stale --include-missing to refresh stale generated agent.md files and create token-budget missing outputs."
        : "Ran docs agent compact --stale to refresh stale generated agent.md files.",
  });

  return fixes;
}

export async function runDoctor(options: DoctorOptions = {}) {
  if (options.mode === "human") {
    if (options.fix) {
      throw new Error("doctor --fix is currently only supported with --agent.");
    }

    const report = await inspectHumanReadiness(options);
    applyDoctorExitCode(report, options);
    if (options.json) {
      printDoctorJsonReport(report);
      return report;
    }
    printHumanDoctorReport(report);
    return report;
  }

  let report = await inspectAgentReadiness(options);
  let fixes: AgentDoctorFix[] | undefined;

  if (options.fix) {
    fixes = await runAgentDoctorFixes(report, options);
    report = {
      ...(await inspectAgentReadiness(options)),
      fixes,
    };
  }

  applyDoctorExitCode(report, options);
  if (options.json) {
    printDoctorJsonReport(report);
    return report;
  }
  printAgentDoctorReport(report);
  return report;
}

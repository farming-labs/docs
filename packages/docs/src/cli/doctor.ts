import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  DEFAULT_AGENT_FEEDBACK_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_TXT_ROUTE,
  DEFAULT_MCP_PUBLIC_ROUTE,
  DEFAULT_MCP_WELL_KNOWN_ROUTE,
  DEFAULT_SKILL_MD_ROUTE,
  DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
} from "../agent.js";
import { createFilesystemDocsMcpSource, resolveDocsMcpConfig } from "../server.js";
import type { DocsConfig, DocsMcpConfig, DocsSearchConfig, FeedbackConfig } from "../types.js";
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
import { detectFramework, type Framework } from "./utils.js";

type DoctorStatus = "pass" | "warn" | "fail";
type DoctorGrade = "Agent-optimized" | "Agent-ready" | "Promising" | "Needs work";

export interface DoctorOptions {
  configPath?: string;
  agent?: boolean;
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
}

export interface AgentDoctorReport {
  mode: "agent";
  framework: Framework | "unknown";
  configPath?: string;
  entry?: string;
  contentDir?: string;
  score: number;
  maxScore: number;
  grade: DoctorGrade;
  checks: AgentDoctorCheck[];
  coverage: AgentDoctorCoverage;
  recommendations: string[];
}

const NEXT_CONFIG_PATTERN = /^next\.config\.(?:[cm]?js|[cm]?ts)$/;
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

export function parseDoctorArgs(argv: string[]): ParsedDoctorArgs {
  const parsed: ParsedDoctorArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--agent" || arg === "agent") {
      parsed.agent = true;
      continue;
    }

    if (arg.startsWith("--config=")) {
      parsed.configPath = parseInlineFlag(arg).value;
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

  if (!parsed.help && parsed.agent !== true) {
    parsed.agent = true;
  }

  return parsed;
}

export function printDoctorHelp() {
  console.log(`
${pc.bold("@farming-labs/docs doctor")}

${pc.dim("Usage:")}
  pnpm exec docs doctor
  pnpm exec docs doctor --agent
  pnpm exec docs doctor agent

${pc.dim("Options:")}
  ${pc.cyan("--agent")}            Score agent-readiness for the current docs app (default)
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

function resolveStaticExport(config: DocsConfig | undefined, content: string): boolean {
  if (typeof config?.staticExport === "boolean") return config.staticExport;
  return readTopLevelBooleanProperty(content, "staticExport") ?? false;
}

function resolveAgentFeedbackEnabled(config: DocsConfig | undefined, content: string): boolean {
  const feedback = config?.feedback;
  if (feedback && typeof feedback === "object") {
    const agent = feedback.agent;
    if (typeof agent === "boolean") return agent;
    if (agent && typeof agent === "object") return agent.enabled ?? true;
  }

  const feedbackBlock = extractNestedObjectLiteral(content, ["feedback"]);
  if (!feedbackBlock) return false;

  const nestedAgentBlock = extractNestedObjectLiteral(content, ["feedback", "agent"]);
  if (nestedAgentBlock) {
    return readBooleanProperty(nestedAgentBlock, "enabled") ?? true;
  }

  return readBooleanProperty(feedbackBlock, "agent") ?? false;
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
      const stat = statSync(fullPath);

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
  if (files.some((file) => file === "src/middleware.ts" || file === "src/middleware.js")) {
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
          "Public .md, llms.txt, skill.md, and agent discovery routes depend on /api/docs.",
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

function gradeForScore(score: number): DoctorGrade {
  if (score >= 90) return "Agent-optimized";
  if (score >= 75) return "Agent-ready";
  if (score >= 60) return "Promising";
  return "Needs work";
}

function formatStatus(status: DoctorStatus): string {
  if (status === "pass") return pc.green("PASS");
  if (status === "warn") return pc.yellow("WARN");
  return pc.red("FAIL");
}

function buildCoverage(
  pages: Array<{
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
  };
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
  const env = loadProjectEnv(rootDir);
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

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
      grade: gradeForScore(0),
      checks,
      coverage: {
        totalPages: 0,
        pagesWithAgentFiles: 0,
        pagesWithAgentBlocks: 0,
        explicitPages: 0,
        explicitCoverage: 0,
      },
      recommendations: checks.map((check) => check.recommendation).filter(Boolean) as string[],
    };
  }

  const configContent = readFileSync(configPath, "utf-8");
  const loadedConfig = await loadDocsConfigModule(rootDir, options.configPath);
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

  const source = createFilesystemDocsMcpSource({
    rootDir,
    entry,
    contentDir,
    siteTitle,
    ordering,
  });
  const pages = await Promise.resolve(source.getPages());
  const coverage = buildCoverage(pages);
  const routeSurface = detectRouteSurface(rootDir, framework, staticExport, files);
  const mcpConfig = resolveDocsMcpConfig(
    (config?.mcp as boolean | DocsMcpConfig | undefined) ?? undefined,
    {
      defaultName: siteTitle,
    },
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
      routeSurface.apiMounted ? 15 : 0,
      15,
      routeSurface.apiDetail,
      routeSurface.apiMounted
        ? undefined
        : "Wire the framework docs API route so /api/docs can serve markdown, llms.txt, skill.md, and discovery responses.",
    ),
  );

  checks.push(
    makeCheck(
      "public-routes",
      "Public agent routes",
      routeSurface.publicMounted ? "pass" : "fail",
      routeSurface.publicMounted ? 15 : 0,
      15,
      routeSurface.publicDetail,
      routeSurface.publicMounted
        ? undefined
        : "Add the framework public forwarder so /.well-known/*, /llms.txt, /skill.md, /mcp, and .md routes resolve from the shared docs API.",
    ),
  );

  checks.push(
    llmsEnabled
      ? makeCheck(
          "llms",
          "llms.txt discovery",
          "pass",
          10,
          10,
          `Enabled via ${DEFAULT_LLMS_TXT_ROUTE} and ${DEFAULT_LLMS_FULL_TXT_ROUTE}.`,
        )
      : makeCheck(
          "llms",
          "llms.txt discovery",
          "warn",
          0,
          10,
          `${DEFAULT_LLMS_TXT_ROUTE} and ${DEFAULT_LLMS_FULL_TXT_ROUTE} are disabled in docs config.`,
          "Enable llmsTxt so agents and GEO crawlers can discover the docs index and full context surfaces.",
        ),
  );

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
          "warn",
          3,
          5,
          `No root skill.md found; the framework will serve the generated fallback at ${DEFAULT_SKILL_MD_ROUTE}.`,
          "Add a root skill.md if you want a custom site-specific bootstrap document instead of the generated fallback.",
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
    compactConfigured
      ? makeCheck(
          "compact",
          "Compaction defaults",
          "pass",
          5,
          5,
          "agent.compact defaults are configured in docs.config for repeatable page compaction.",
        )
      : makeCheck(
          "compact",
          "Compaction defaults",
          "warn",
          0,
          5,
          "No agent.compact defaults were found in docs config.",
          "Add agent.compact defaults if you want docs agent compact to run without repeating model and key settings.",
        ),
  );

  const score = checks.reduce((total, check) => total + check.score, 0);

  return {
    mode: "agent",
    framework,
    configPath: path.relative(rootDir, configPath).replace(/\\/g, "/"),
    entry,
    contentDir,
    score,
    maxScore: 100,
    grade: gradeForScore(score),
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
  console.log(
    `${pc.bold("Score:")} ${pc.cyan(`${report.score}/${report.maxScore}`)} ${pc.dim(`(${report.grade})`)}`,
  );
  console.log(
    `${pc.bold("Framework:")} ${report.framework} ${pc.dim("•")} ${pc.bold("Entry:")} ${report.entry ?? "docs"} ${pc.dim("•")} ${pc.bold("Content:")} ${report.contentDir ?? "-"}`,
  );
  console.log(
    `${pc.bold("Explicit agent-friendly pages:")} ${report.coverage.explicitPages}/${report.coverage.totalPages} pages ${pc.dim(`(${report.coverage.explicitCoverage}%)`)}`,
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

  console.log();
  console.log(
    pc.dim(
      `Expected public surfaces: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}, ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}, ${DEFAULT_LLMS_TXT_ROUTE}, ${DEFAULT_LLMS_FULL_TXT_ROUTE}, ${DEFAULT_SKILL_MD_ROUTE}, ${DEFAULT_MCP_PUBLIC_ROUTE}`,
    ),
  );
}

export async function runDoctor(options: DoctorOptions = {}) {
  const report = await inspectAgentReadiness(options);
  printAgentDoctorReport(report);
  return report;
}

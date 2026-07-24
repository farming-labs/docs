import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  DOCS_ROBOTS_GENERATED_BLOCK_END,
  DOCS_ROBOTS_GENERATED_BLOCK_START,
  renderDocsRobotsGeneratedBlock,
  resolveDocsRobotsConfig,
  upsertDocsRobotsGeneratedBlock,
} from "../robots.js";
import type { DocsConfig, DocsRobotsConfig, DocsSitemapConfig } from "../types.js";
import {
  extractNestedObjectLiteral,
  loadDocsConfigModule,
  readBooleanProperty,
  readStringProperty,
  readTopLevelBooleanProperty,
  readTopLevelStringProperty,
  resolveDocsConfigPath,
} from "./config.js";
import { detectFramework } from "./utils.js";

export interface RobotsGenerateOptions {
  configPath?: string;
  path?: string;
  append?: boolean;
  force?: boolean;
  check?: boolean;
}

export interface ParsedRobotsGenerateArgs extends RobotsGenerateOptions {
  help?: boolean;
}

function parseInlineFlag(arg: string): { key: string; value?: string } {
  const [rawKey, value] = arg.slice(2).split("=", 2);
  return { key: rawKey.trim(), value };
}

export function parseRobotsGenerateArgs(argv: string[]): ParsedRobotsGenerateArgs {
  const parsed: ParsedRobotsGenerateArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--append") {
      parsed.append = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg === "--check") {
      parsed.check = true;
      continue;
    }

    if (arg.startsWith("--config=")) {
      const value = parseInlineFlag(arg).value;
      if (!value) throw new Error("Missing value for --config.");
      parsed.configPath = value;
      continue;
    }

    if (arg === "--config") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --config.");
      parsed.configPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--path=")) {
      const value = parseInlineFlag(arg).value;
      if (!value) throw new Error("Missing value for --path.");
      parsed.path = value;
      continue;
    }

    if (arg === "--path") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --path.");
      parsed.path = value;
      index += 1;
      continue;
    }

    if (!arg.startsWith("--") && !parsed.path) {
      parsed.path = arg;
      continue;
    }

    throw new Error(`Unknown robots generate flag: ${arg}.`);
  }

  if (parsed.append && parsed.force) {
    throw new Error("Use either --append or --force, not both.");
  }

  return parsed;
}

function readLlmsBaseUrlFromConfig(content: string, config?: DocsConfig): string | undefined {
  if (config?.llmsTxt && typeof config.llmsTxt === "object") return config.llmsTxt.baseUrl;
  const block = extractNestedObjectLiteral(content, ["llmsTxt"]);
  return block ? readStringProperty(block, "baseUrl") : undefined;
}

function isApiCatalogEnabled(content: string, config?: DocsConfig): boolean {
  const staticExport =
    config?.staticExport ?? readTopLevelBooleanProperty(content, "staticExport") ?? false;
  if (staticExport) return false;
  if (config?.llmsTxt && typeof config.llmsTxt === "object") {
    return config.llmsTxt.apiCatalog !== false;
  }

  const block = extractNestedObjectLiteral(content, ["llmsTxt"]);
  return block ? readBooleanProperty(block, "apiCatalog") !== false : true;
}

function isAgentCardEnabled(content: string, config?: DocsConfig): boolean {
  if (config) return Boolean(config.agent?.a2a);
  return Boolean(extractNestedObjectLiteral(content, ["agent", "a2a"]));
}

function readSitemapConfigFromStatic(content: string): boolean | DocsSitemapConfig | undefined {
  const topLevelBoolean = readTopLevelBooleanProperty(content, "sitemap");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const block = extractNestedObjectLiteral(content, ["sitemap"]);
  if (!block) return undefined;

  return {
    enabled: readBooleanProperty(block, "enabled") ?? true,
    routePrefix: readStringProperty(block, "routePrefix"),
    baseUrl: readStringProperty(block, "baseUrl"),
    manifestPath: readStringProperty(block, "manifestPath"),
  };
}

function readRobotsConfigFromStatic(content: string): boolean | DocsRobotsConfig | undefined {
  const topLevelBoolean = readTopLevelBooleanProperty(content, "robots");
  if (typeof topLevelBoolean === "boolean") return topLevelBoolean;

  const block = extractNestedObjectLiteral(content, ["robots"]);
  if (!block) return undefined;

  const aiString = readStringProperty(block, "ai");
  const aiBoolean = readBooleanProperty(block, "ai");
  return {
    enabled: readBooleanProperty(block, "enabled") ?? true,
    path: readStringProperty(block, "path"),
    baseUrl: readStringProperty(block, "baseUrl"),
    ai:
      aiString === "allow" || aiString === "disallow"
        ? aiString
        : typeof aiBoolean === "boolean"
          ? aiBoolean
          : undefined,
  };
}

function resolveConfiguredRobots(content: string, config?: DocsConfig): boolean | DocsRobotsConfig {
  if (config?.robots !== undefined) return config.robots;
  return readRobotsConfigFromStatic(content) ?? true;
}

function resolvePublicDir(rootDir: string): string {
  const framework = detectFramework(rootDir);
  if (framework === "sveltekit") return path.join(rootDir, "static");
  return path.join(rootDir, "public");
}

function resolveRobotsPath(
  rootDir: string,
  options: RobotsGenerateOptions,
  robots: DocsRobotsConfig | undefined,
): string {
  const configuredPath = options.path ?? robots?.path;
  if (configuredPath) {
    return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(rootDir, configuredPath);
  }

  return path.join(resolvePublicDir(rootDir), "robots.txt");
}

function writeIfChanged(filePath: string, content: string, check: boolean): boolean {
  const current = existsSync(filePath) ? readFileSync(filePath, "utf-8") : undefined;
  if (current === content) return false;
  if (check) return true;

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  return true;
}

export async function generateRobots(options: RobotsGenerateOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const loadedConfigModule = await loadDocsConfigModule(rootDir, options.configPath);
  const configPath = loadedConfigModule?.path ?? resolveDocsConfigPath(rootDir, options.configPath);
  const configContent = readFileSync(configPath, "utf-8");
  const config = loadedConfigModule?.config;
  const entry = config?.entry ?? readTopLevelStringProperty(configContent, "entry") ?? "docs";
  const sitemap = config?.sitemap ?? readSitemapConfigFromStatic(configContent) ?? true;
  const sitemapBaseUrl = typeof sitemap === "object" ? sitemap.baseUrl : undefined;
  const llmsBaseUrl = readLlmsBaseUrlFromConfig(configContent, config);
  const apiCatalog = isApiCatalogEnabled(configContent, config);
  const agentCard = isAgentCardEnabled(configContent, config);
  const configuredRobots = resolveConfiguredRobots(configContent, config);

  if (configuredRobots === false) {
    throw new Error("Robots generation is disabled by `robots: false`.");
  }

  const robotsInput = typeof configuredRobots === "object" ? configuredRobots : {};
  const robots = resolveDocsRobotsConfig(robotsInput, {
    baseUrl: robotsInput.baseUrl ?? sitemapBaseUrl ?? llmsBaseUrl,
  });

  if (!robots.enabled) {
    throw new Error("Robots generation is disabled by `robots.enabled: false`.");
  }

  const robotsPath = resolveRobotsPath(rootDir, options, robotsInput);
  const relativeRobotsPath = path.relative(rootDir, robotsPath).replace(/\\/g, "/");
  const generatedBlock = renderDocsRobotsGeneratedBlock({
    entry,
    apiCatalog,
    agentCard,
    sitemap,
    baseUrl: robots.baseUrl,
    robots,
  });
  const existing = existsSync(robotsPath) ? readFileSync(robotsPath, "utf-8") : undefined;
  const hasGeneratedBlock =
    existing?.includes(DOCS_ROBOTS_GENERATED_BLOCK_START) === true &&
    existing.includes(DOCS_ROBOTS_GENERATED_BLOCK_END);

  if (existing !== undefined && !options.force && !options.append && !hasGeneratedBlock) {
    console.log(pc.yellow(`Found existing robots.txt at ${relativeRobotsPath}.`));
    console.log(
      pc.dim(
        "Keeping the user-owned file. Use --append to add/update the generated block, or --force to replace it.",
      ),
    );
    return;
  }

  const nextContent =
    existing !== undefined && (options.append || hasGeneratedBlock)
      ? upsertDocsRobotsGeneratedBlock(existing, generatedBlock)
      : generatedBlock;

  const changed = writeIfChanged(robotsPath, nextContent, options.check === true);
  if (options.check && changed) {
    throw new Error(
      `Robots output is stale at ${relativeRobotsPath}. Run \`docs robots generate${options.append ? " --append" : options.force ? " --force" : ""}${options.path ? ` --path ${options.path}` : ""}\` to update it.`,
    );
  }

  console.log(
    changed
      ? pc.green(`Generated robots policy at ${relativeRobotsPath}.`)
      : pc.green(`Robots policy is current at ${relativeRobotsPath}.`),
  );
}

export function printRobotsGenerateHelp() {
  console.log(`
${pc.bold("docs robots generate")} — Generate a static robots.txt agent access policy.

${pc.dim("Usage:")}
  pnpm exec docs ${pc.cyan("robots generate")} ${pc.dim("[path]")}

${pc.dim("Options:")}
  ${pc.cyan("--path <path>")}       Write to a specific robots.txt path; defaults to the framework public directory
  ${pc.cyan("--append")}            Add or update a generated block inside an existing robots.txt
  ${pc.cyan("--force")}             Replace the target robots.txt with the generated policy
  ${pc.cyan("--check")}             Fail if the generated output would change
  ${pc.cyan("--config <path>")}     Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}
  ${pc.cyan("-h, --help")}          Show this help message
`);
}

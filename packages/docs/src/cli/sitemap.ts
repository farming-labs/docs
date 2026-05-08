import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  buildDocsSitemapManifest,
  renderDocsSitemapMarkdown,
  renderDocsSitemapXml,
  resolveDocsSitemapConfig,
  type DocsSitemapManifest,
} from "../sitemap.js";
import { createFilesystemDocsMcpSource } from "../server.js";
import type { DocsConfig, DocsSitemapConfig } from "../types.js";
import {
  extractNestedObjectLiteral,
  loadDocsConfigModule,
  readBooleanProperty,
  readNavTitle,
  readStringProperty,
  readTopLevelStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";
import { detectFramework } from "./utils.js";

export interface SitemapGenerateOptions {
  configPath?: string;
  public?: boolean;
  manifestOnly?: boolean;
  check?: boolean;
}

export interface ParsedSitemapGenerateArgs extends SitemapGenerateOptions {
  help?: boolean;
}

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function parseInlineFlag(arg: string): { key: string; value?: string } {
  const [rawKey, value] = arg.slice(2).split("=", 2);
  return { key: rawKey.trim(), value };
}

export function parseSitemapGenerateArgs(argv: string[]): ParsedSitemapGenerateArgs {
  const parsed: ParsedSitemapGenerateArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--public") {
      parsed.public = true;
      continue;
    }

    if (arg === "--manifest-only") {
      parsed.manifestOnly = true;
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

    throw new Error(`Unknown sitemap generate flag: ${arg}.`);
  }

  return parsed;
}

function readLlmsBaseUrlFromConfig(content: string, config?: DocsConfig): string | undefined {
  if (config?.llmsTxt && typeof config.llmsTxt === "object") return config.llmsTxt.baseUrl;
  const block = extractNestedObjectLiteral(content, ["llmsTxt"]);
  return block ? readStringProperty(block, "baseUrl") : undefined;
}

function readSitemapConfigFromStatic(content: string): boolean | DocsSitemapConfig | undefined {
  if (/\bsitemap\s*:\s*false/.test(content)) return false;
  if (/\bsitemap\s*:\s*true/.test(content)) return true;

  const block = extractNestedObjectLiteral(content, ["sitemap"]);
  if (!block) return undefined;

  return {
    enabled: readBooleanProperty(block, "enabled") ?? true,
    routePrefix: readStringProperty(block, "routePrefix"),
    baseUrl: readStringProperty(block, "baseUrl"),
    manifestPath: readStringProperty(block, "manifestPath"),
  };
}

function resolveConfiguredSitemap(
  content: string,
  config?: DocsConfig,
): boolean | DocsSitemapConfig {
  if (config?.sitemap !== undefined) return config.sitemap;
  return readSitemapConfigFromStatic(content) ?? true;
}

function formatDateOnly(value: string): string | undefined {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function gitLastCommitDate(rootDir: string, sourcePath?: string): string | undefined {
  if (!sourcePath) return undefined;

  try {
    const output = execFileSync("git", ["log", "-1", "--format=%cI", "--", sourcePath], {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return formatDateOnly(output);
  } catch {
    return undefined;
  }
}

function fileModifiedDate(rootDir: string, sourcePath?: string): string | undefined {
  if (!sourcePath) return undefined;
  const fullPath = path.isAbsolute(sourcePath) ? sourcePath : path.join(rootDir, sourcePath);
  if (!existsSync(fullPath)) return undefined;

  try {
    return statSync(fullPath).mtime.toISOString().slice(0, 10);
  } catch {
    return undefined;
  }
}

function writeIfChanged(filePath: string, content: string, check: boolean): boolean {
  const current = existsSync(filePath) ? readFileSync(filePath, "utf-8") : undefined;
  if (current === content) return false;
  if (check) return true;

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  return true;
}

function readExistingManifest(filePath: string): DocsSitemapManifest | undefined {
  if (!existsSync(filePath)) return undefined;

  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as DocsSitemapManifest;
  } catch {
    return undefined;
  }
}

function comparableManifest(manifest: DocsSitemapManifest): DocsSitemapManifest {
  return { ...manifest, generatedAt: "" };
}

function preserveGeneratedAtWhenUnchanged(
  manifest: DocsSitemapManifest,
  existing: DocsSitemapManifest | undefined,
): DocsSitemapManifest {
  if (!existing?.generatedAt) return manifest;

  const nextComparable = JSON.stringify(comparableManifest(manifest));
  const existingComparable = JSON.stringify(comparableManifest(existing));
  if (nextComparable !== existingComparable) return manifest;

  return { ...manifest, generatedAt: existing.generatedAt };
}

function resolvePublicDir(rootDir: string): string {
  const framework = detectFramework(rootDir);
  if (framework === "sveltekit") return path.join(rootDir, "static");
  return path.join(rootDir, "public");
}

function publicFilePath(rootDir: string, route: string): string {
  return path.join(resolvePublicDir(rootDir), route.replace(/^\/+/, ""));
}

export async function generateSitemap(options: SitemapGenerateOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const loadedConfigModule = await loadDocsConfigModule(rootDir, options.configPath);
  const configPath = loadedConfigModule?.path ?? resolveDocsConfigPath(rootDir, options.configPath);
  const configContent = readFileSync(configPath, "utf-8");
  const config = loadedConfigModule?.config;

  const entry =
    normalizePathSegment(
      config?.entry ?? readTopLevelStringProperty(configContent, "entry") ?? "docs",
    ) || "docs";
  const contentDir =
    typeof config?.contentDir === "string"
      ? config.contentDir
      : resolveDocsContentDir(rootDir, configContent, entry);
  const siteTitle =
    typeof config?.nav?.title === "string"
      ? config.nav.title
      : (readNavTitle(configContent) ?? "Documentation");
  const sitemapInput = resolveConfiguredSitemap(configContent, config);
  if (sitemapInput === false) {
    throw new Error("Sitemap generation is disabled by `sitemap: false`.");
  }

  const baseUrl =
    (typeof sitemapInput === "object" ? sitemapInput.baseUrl : undefined) ??
    readLlmsBaseUrlFromConfig(configContent, config);
  const sitemap = resolveDocsSitemapConfig(sitemapInput, { baseUrl });

  const source = createFilesystemDocsMcpSource({
    rootDir,
    entry,
    contentDir,
    siteTitle,
    ordering: config?.ordering,
  });
  const pages = await Promise.resolve(source.getPages());
  if (pages.length === 0) {
    throw new Error(`No docs content was found under ${contentDir}.`);
  }

  const builtManifest = buildDocsSitemapManifest({
    pages,
    entry,
    siteTitle,
    baseUrl: sitemap.baseUrl,
    resolveLastmod(page) {
      const gitDate = gitLastCommitDate(rootDir, page.sourcePath);
      if (gitDate) return { lastmod: gitDate, lastmodSource: "git" };

      const fsDate = fileModifiedDate(rootDir, page.sourcePath);
      if (fsDate) return { lastmod: fsDate, lastmodSource: "filesystem" };

      return undefined;
    },
  });

  const manifestPath = path.resolve(rootDir, sitemap.manifestPath);
  const manifest = preserveGeneratedAtWhenUnchanged(
    builtManifest,
    readExistingManifest(manifestPath),
  );
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestChanged = writeIfChanged(manifestPath, manifestJson, options.check === true);

  const shouldWritePublic = options.manifestOnly !== true;
  const publicWrites: string[] = [];

  if (shouldWritePublic) {
    const xml = renderDocsSitemapXml(manifest, {
      baseUrl: sitemap.baseUrl,
      includeLastmod: sitemap.xml.includeLastmod,
    });
    const markdown = renderDocsSitemapMarkdown(manifest, {
      baseUrl: sitemap.baseUrl,
      includeDescriptions: sitemap.markdown.includeDescriptions,
      includeLastmod: sitemap.markdown.includeLastmod,
      linkTarget: sitemap.markdown.linkTarget,
    });

    if (sitemap.xml.enabled) {
      const filePath = publicFilePath(rootDir, sitemap.xml.route);
      if (writeIfChanged(filePath, xml, options.check === true)) publicWrites.push(filePath);
    }

    if (sitemap.markdown.enabled) {
      for (const route of [sitemap.markdown.route, sitemap.markdown.wellKnownRoute]) {
        const filePath = publicFilePath(rootDir, route);
        if (writeIfChanged(filePath, markdown, options.check === true)) publicWrites.push(filePath);
      }
    }
  }

  if (options.check && (manifestChanged || publicWrites.length > 0)) {
    throw new Error("Sitemap output is stale. Run `docs sitemap generate` to update it.");
  }

  console.log(pc.green(`Generated sitemap manifest for ${manifest.pages.length} page(s).`));
  console.log(pc.dim(path.relative(rootDir, manifestPath)));
  for (const filePath of publicWrites) {
    console.log(pc.dim(path.relative(rootDir, filePath)));
  }
}

export function printSitemapGenerateHelp() {
  console.log(`
${pc.bold("docs sitemap generate")} — Generate sitemap metadata and static sitemap files.

${pc.dim("Usage:")}
  pnpm exec docs ${pc.cyan("sitemap generate")}

${pc.dim("Options:")}
  ${pc.cyan("--config <path>")}     Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}
  ${pc.cyan("--public")}            Explicitly write public sitemap.xml and sitemap.md files
  ${pc.cyan("--manifest-only")}     Only write the internal sitemap manifest
  ${pc.cyan("--check")}             Fail if generated output is stale
  ${pc.cyan("-h, --help")}          Show this help message
`);
}

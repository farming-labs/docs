import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { z } from "zod";
import { createDevLogger, printDevBanner } from "./dev-banner.js";
import {
  docsLayoutTemplate,
  globalCssTemplate,
  postcssConfigTemplate,
  rootLayoutTemplate,
  tsconfigTemplate,
  type TemplateConfig,
} from "./templates.js";
import { detectPackageManagerFromLockfile, type PackageManager } from "./utils.js";

const PRIMARY_MANAGED_CONFIG_FILE = "docs.json";
const LEGACY_MANAGED_CONFIG_FILE = "docs.cloud.json";
const DEFAULT_RUNTIME_ROOT = ".docs/site";
const DEFAULT_DOCS_ROOT = "docs";
const DEFAULT_API_REFERENCE_ROOT = "api-reference";
const DEFAULT_MANAGED_OPENAPI_ENDPOINT = "/api/docs/openapi";
const DEFAULT_THEME_PRESET = "default";
const DEFAULT_POLL_INTERVAL_MS = 750;
const DEFAULT_NEXT_VERSION = "16.2.3";
const DEFAULT_REACT_VERSION = "^19.2.0";
const DEFAULT_TAILWIND_VERSION = "^4.1.18";
const DEFAULT_POSTCSS_VERSION = "^8.5.6";
const DEFAULT_TYPESCRIPT_VERSION = "^5.9.3";
const ANSI_ESCAPE_PATTERN = /\u001B\[[0-9;]*m/g;
const MANAGED_OPENAPI_CONVENTION_CANDIDATES = [
  "api/openapi.json",
  "api/openapi.yaml",
  "api/openapi.yml",
  "openapi.json",
  "openapi.yaml",
  "openapi.yml",
] as const;
const RUNTIME_FRAMEWORK_VALUES = [
  "nextjs",
  "tanstack-start",
  "sveltekit",
  "astro",
  "nuxt",
] as const;
type RuntimeFrameworkName = (typeof RUNTIME_FRAMEWORK_VALUES)[number];

type ThemePresetName =
  | "default"
  | "fumadocs"
  | "darksharp"
  | "pixel-border"
  | "colorful"
  | "darkbold"
  | "shiny"
  | "ledger"
  | "greentree"
  | "concrete"
  | "command-grid"
  | "hardline";

interface ManagedThemePreset {
  configName: ThemePresetName;
  templateTheme: TemplateConfig["theme"];
  importPath: string;
  factory: string;
}

interface ManagedDocsProject {
  configPath: string;
  configFileName: string;
  projectRoot: string;
  runtimeDir: string;
  runtimeFramework: RuntimeFrameworkName;
  docsRoot: string;
  apiReferenceRoot: string;
  apiReferenceSpec?: ManagedOpenApiSpec;
  siteName: string;
  titleTemplate: string;
  description: string;
  theme: ManagedThemePreset;
}

interface ManagedOpenApiSpec {
  name: string;
  route: string;
  path: string;
  specUrl: string;
  sourcePath?: string;
  navigationLabel?: string;
}

interface SyncResult {
  pageCount: number;
  routes: string[];
}

interface MaterializedManagedRuntime {
  runtimeDir: string;
  docs: SyncResult;
  apiReference: SyncResult;
  homeTarget: string;
}

export interface DevOptions {
  verbose?: boolean;
  port?: string;
  host?: string | boolean;
  hostname?: string;
}

interface RewriteContext {
  sourcePagePath: string;
  destinationPagePath: string;
  pageMap: Map<string, string>;
  routeMap: Map<string, string>;
  assetCopies: Map<string, string>;
  projectRoot: string;
  contentRootHints: string[];
}

type DevLabel =
  | "docs"
  | "source"
  | "runtime"
  | "install"
  | "watch"
  | "server"
  | "sync"
  | "PAGE"
  | "compile"
  | "ready"
  | "local"
  | "network"
  | "note"
  | "warn"
  | "error"
  | "next";

type NextDevEvent =
  | { type: "starting" }
  | { type: "local"; url: string }
  | { type: "network"; url: string }
  | { type: "ready"; duration?: string }
  | { type: "page"; pathname: string }
  | { type: "compiling"; target: string }
  | { type: "compiled"; target: string; duration?: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string };

const THEME_PRESETS: Record<string, ManagedThemePreset> = {
  default: {
    configName: "default",
    templateTheme: "fumadocs",
    importPath: "@farming-labs/theme",
    factory: "fumadocs",
  },
  fumadocs: {
    configName: "fumadocs",
    templateTheme: "fumadocs",
    importPath: "@farming-labs/theme",
    factory: "fumadocs",
  },
  darksharp: {
    configName: "darksharp",
    templateTheme: "darksharp",
    importPath: "@farming-labs/theme/darksharp",
    factory: "darksharp",
  },
  "pixel-border": {
    configName: "pixel-border",
    templateTheme: "pixel-border",
    importPath: "@farming-labs/theme/pixel-border",
    factory: "pixelBorder",
  },
  colorful: {
    configName: "colorful",
    templateTheme: "colorful",
    importPath: "@farming-labs/theme/colorful",
    factory: "colorful",
  },
  darkbold: {
    configName: "darkbold",
    templateTheme: "darkbold",
    importPath: "@farming-labs/theme/darkbold",
    factory: "darkbold",
  },
  shiny: {
    configName: "shiny",
    templateTheme: "shiny",
    importPath: "@farming-labs/theme/shiny",
    factory: "shiny",
  },
  ledger: {
    configName: "ledger",
    templateTheme: "ledger",
    importPath: "@farming-labs/theme/ledger",
    factory: "ledger",
  },
  greentree: {
    configName: "greentree",
    templateTheme: "greentree",
    importPath: "@farming-labs/theme/greentree",
    factory: "greentree",
  },
  concrete: {
    configName: "concrete",
    templateTheme: "concrete",
    importPath: "@farming-labs/theme/concrete",
    factory: "concrete",
  },
  "command-grid": {
    configName: "command-grid",
    templateTheme: "command-grid",
    importPath: "@farming-labs/theme/command-grid",
    factory: "commandGrid",
  },
  hardline: {
    configName: "hardline",
    templateTheme: "hardline",
    importPath: "@farming-labs/theme/hardline",
    factory: "hardline",
  },
};

const managedConfigSchema = z
  .object({
    docs: z.union([
      z
        .object({
          mode: z.literal("frameworkless"),
          root: z.string().optional(),
          runtime: z.enum(RUNTIME_FRAMEWORK_VALUES).optional(),
        })
        .passthrough(),
      z
        .object({
          mode: z.literal("framework"),
          root: z.string().optional(),
          runtime: z.enum(RUNTIME_FRAMEWORK_VALUES),
        })
        .passthrough(),
      z
        .object({
          framework: z.literal("managed"),
          root: z.string().optional(),
          runtime: z.enum(RUNTIME_FRAMEWORK_VALUES).optional(),
        })
        .passthrough(),
    ]),
    content: z
      .object({
        docsRoot: z.string().optional(),
        apiReferenceRoot: z.string().optional(),
        openapi: z
          .array(
            z
              .object({
                name: z.string().optional(),
                path: z.string(),
                route: z.string().optional(),
                navigationLabel: z.string().optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
    site: z
      .object({
        name: z.string().optional(),
        title: z.string().optional(),
        titleTemplate: z.string().optional(),
        description: z.string().optional(),
      })
      .passthrough()
      .optional(),
    theme: z
      .object({
        preset: z.string().optional(),
      })
      .passthrough()
      .optional(),
    cloud: z
      .object({
        enabled: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function normalizePathKey(value: string): string {
  return path.resolve(value);
}

function normalizeManagedRoutePath(value?: string): string {
  const normalized = value?.trim().replace(/^\/+|\/+$/g, "");
  return normalized || DEFAULT_API_REFERENCE_ROOT;
}

function isRemoteManagedSpecPath(value: string): boolean {
  return /^(?:https?:)?\/\//i.test(value);
}

function isRequestRelativeManagedSpecPath(value: string): boolean {
  return value.startsWith("/");
}

function resolveManagedOpenApiSpec(
  projectRoot: string,
  openapi:
    | Array<{
        name?: string;
        path: string;
        route?: string;
        navigationLabel?: string;
      }>
    | undefined,
): ManagedOpenApiSpec | undefined {
  const configured = openapi?.find((entry) => typeof entry.path === "string" && entry.path.trim());
  if (configured) {
    const rawPath = configured.path.trim();
    const route = normalizeManagedRoutePath(configured.route);

    if (isRemoteManagedSpecPath(rawPath) || isRequestRelativeManagedSpecPath(rawPath)) {
      return {
        name: configured.name?.trim() || "API Reference",
        route,
        path: rawPath,
        specUrl: rawPath,
        navigationLabel: configured.navigationLabel?.trim() || undefined,
      };
    }

    return {
      name: configured.name?.trim() || "API Reference",
      route,
      path: rawPath,
      specUrl: DEFAULT_MANAGED_OPENAPI_ENDPOINT,
      sourcePath: path.resolve(projectRoot, rawPath),
      navigationLabel: configured.navigationLabel?.trim() || undefined,
    };
  }

  for (const candidate of MANAGED_OPENAPI_CONVENTION_CANDIDATES) {
    const sourcePath = path.join(projectRoot, candidate);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) continue;

    return {
      name: "API Reference",
      route: DEFAULT_API_REFERENCE_ROOT,
      path: candidate,
      specUrl: DEFAULT_MANAGED_OPENAPI_ENDPOINT,
      sourcePath,
    };
  }

  return undefined;
}

function getDocsPackageVersion(): string {
  const candidateUrls = [
    new URL("../package.json", import.meta.url),
    new URL("../../package.json", import.meta.url),
  ];

  for (const candidateUrl of candidateUrls) {
    try {
      const packageJsonPath = fileURLToPath(candidateUrl);
      const raw = fs.readFileSync(packageJsonPath, "utf-8");
      const parsed = JSON.parse(raw) as { name?: string; version?: string };
      if (parsed.name === "@farming-labs/docs" && parsed.version) {
        return parsed.version;
      }
    } catch {}
  }

  return "latest";
}

function resolveThemePreset(preset?: string): ManagedThemePreset {
  if (!preset) return THEME_PRESETS[DEFAULT_THEME_PRESET];
  return THEME_PRESETS[preset] ?? THEME_PRESETS[DEFAULT_THEME_PRESET];
}

function isMarkdownFile(filePath: string): boolean {
  return /\.(md|mdx)$/i.test(filePath);
}

function isPageSourceFile(filePath: string): boolean {
  if (!isMarkdownFile(filePath)) return false;
  return path.basename(filePath).toLowerCase() !== "agent.md";
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${where}: ${issue.message}`;
    })
    .join("; ");
}

function formatLogLabel(label: DevLabel): string {
  switch (label) {
    case "docs":
      return pc.bold(pc.cyan(`[${label}]`));
    case "ready":
    case "local":
    case "network":
      return pc.bold(pc.green(`[${label}]`));
    case "warn":
      return pc.bold(pc.yellow(`[${label}]`));
    case "error":
      return pc.bold(pc.red(`[${label}]`));
    case "note":
    case "next":
      return pc.bold(pc.dim(`[${label}]`));
    case "PAGE":
      return pc.bold(pc.green(`[${label}]`));
    default:
      return pc.bold(pc.blue(`[${label}]`));
  }
}

function logLine(label: DevLabel, message: string): void {
  console.log(`${formatLogLabel(label)} ${message}`);
}

function logErrorLine(message: string): void {
  console.error(`${formatLogLabel("error")} ${message}`);
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, "");
}

function normalizeLogLine(value: string): string {
  return stripAnsi(value).replace(/\r/g, "").trim();
}

function normalizeVersionTag(value: string): string {
  return value.startsWith("v") ? value : `v${value}`;
}

function resolveRequestedHost(options: DevOptions): string | boolean | undefined {
  return options.hostname ?? options.host;
}

function resolveBannerPort(localUrl: string | undefined, fallbackPort: string | undefined): number {
  if (localUrl) {
    try {
      const parsed = new URL(localUrl);
      if (parsed.port) return Number(parsed.port);
      return parsed.protocol === "https:" ? 443 : 80;
    } catch {}
  }

  if (fallbackPort) {
    const numeric = Number(fallbackPort);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }

  return 3000;
}

function resolveBannerProtocol(localUrl: string | undefined): "http" | "https" {
  if (!localUrl) return "http";

  try {
    const parsed = new URL(localUrl);
    return parsed.protocol === "https:" ? "https" : "http";
  } catch {
    return "http";
  }
}

function createLineReader(onLine: (line: string) => void): {
  push: (chunk: Buffer | string) => void;
  flush: () => void;
} {
  let buffer = "";

  return {
    push(chunk) {
      buffer += chunk.toString();
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        onLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    },
    flush() {
      const line = buffer.replace(/\r$/, "");
      buffer = "";
      if (line) onLine(line);
    },
  };
}

export function parseNextDevLine(rawLine: string): NextDevEvent | null {
  const line = normalizeLogLine(rawLine);
  if (!line) return null;

  const routeMatch = line.match(/^\[docs-page\]\s+(\S+)$/);
  if (routeMatch) {
    return { type: "page", pathname: routeMatch[1] };
  }

  const localMatch = line.match(/Local:\s*(https?:\/\/\S+)/i);
  if (localMatch) {
    return { type: "local", url: localMatch[1] };
  }

  const networkMatch = line.match(/Network:\s*(https?:\/\/\S+)/i);
  if (networkMatch) {
    return { type: "network", url: networkMatch[1] };
  }

  const readyMatch = line.match(/Ready in\s+(.+)$/i);
  if (readyMatch) {
    return { type: "ready", duration: readyMatch[1].trim() };
  }

  if (/\bStarting\b/i.test(line)) {
    return { type: "starting" };
  }

  const compilingMatch = line.match(/Compiling(?:\s+(.+?))?(?:\s*\.\.\.)?$/i);
  if (compilingMatch) {
    return {
      type: "compiling",
      target: compilingMatch[1]?.trim() || "app",
    };
  }

  const compiledMatch = line.match(/Compiled(?:\s+(.+?))?\s+in\s+(.+)$/i);
  if (compiledMatch) {
    return {
      type: "compiled",
      target: compiledMatch[1]?.trim() || "app",
      duration: compiledMatch[2].trim(),
    };
  }

  if (/^(?:warning\b|warn\b)/i.test(line) || /\bdeprecated\b/i.test(line)) {
    return {
      type: "warning",
      message: line.replace(/^(?:warning\b|warn\b):?\s*/i, "").trim(),
    };
  }

  if (
    /\b(failed to compile|module not found|error:|type error|syntax error|uncaught)\b/i.test(line)
  ) {
    return { type: "error", message: line };
  }

  return null;
}

function walkFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];

  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function directoryHasMarkdown(rootDir: string): boolean {
  return walkFiles(rootDir).some(isPageSourceFile);
}

function findLocalFrameworkRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const docsPkg = path.join(current, "packages", "docs", "package.json");
    const nextPkg = path.join(current, "packages", "next", "package.json");
    const themePkg = path.join(current, "packages", "fumadocs", "package.json");
    if (fs.existsSync(docsPkg) && fs.existsSync(nextPkg) && fs.existsSync(themePkg)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function detectNearestPackageManager(startDir: string): PackageManager {
  let current = path.resolve(startDir);
  while (true) {
    const detected = detectPackageManagerFromLockfile(current);
    if (detected) return detected;
    const parent = path.dirname(current);
    if (parent === current) return "npm";
    current = parent;
  }
}

function resolveManagedConfigPath(projectRoot: string): {
  configPath: string;
  configFileName: string;
} {
  const primaryPath = path.join(projectRoot, PRIMARY_MANAGED_CONFIG_FILE);
  if (fs.existsSync(primaryPath)) {
    return {
      configPath: primaryPath,
      configFileName: PRIMARY_MANAGED_CONFIG_FILE,
    };
  }

  const legacyPath = path.join(projectRoot, LEGACY_MANAGED_CONFIG_FILE);
  if (fs.existsSync(legacyPath)) {
    return {
      configPath: legacyPath,
      configFileName: LEGACY_MANAGED_CONFIG_FILE,
    };
  }

  throw new Error(
    `Could not find ${PRIMARY_MANAGED_CONFIG_FILE} in ${projectRoot}. Frameworkless dev expects ${PRIMARY_MANAGED_CONFIG_FILE}, ${DEFAULT_DOCS_ROOT}/, and optionally ${DEFAULT_API_REFERENCE_ROOT}/. ${LEGACY_MANAGED_CONFIG_FILE} is still supported for older repos.`,
  );
}

function readManagedDocsProject(projectRoot: string): ManagedDocsProject {
  const { configPath, configFileName } = resolveManagedConfigPath(projectRoot);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (error) {
    throw new Error(
      `Could not parse ${configFileName}. The file must be valid JSON.${error instanceof Error ? ` ${error.message}` : ""}`,
    );
  }

  const parsed = managedConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Invalid ${configFileName}: ${formatZodError(parsed.error)}`);
  }

  const docsConfig = parsed.data.docs;
  const docsMode =
    "mode" in docsConfig
      ? docsConfig.mode
      : docsConfig.framework === "managed"
        ? "frameworkless"
        : "framework";
  if (docsMode !== "frameworkless") {
    throw new Error(
      `${configFileName} uses docs.mode = "framework". ${pc.cyan("docs dev")} only supports frameworkless projects right now.`,
    );
  }

  const runtimeFramework =
    "runtime" in docsConfig && docsConfig.runtime ? docsConfig.runtime : "nextjs";
  if (runtimeFramework !== "nextjs") {
    throw new Error(
      `Frameworkless ${pc.cyan("docs dev")} currently supports only docs.runtime = "nextjs".`,
    );
  }

  const docsRoot = parsed.data.content?.docsRoot ?? DEFAULT_DOCS_ROOT;
  const apiReferenceRoot = parsed.data.content?.apiReferenceRoot ?? DEFAULT_API_REFERENCE_ROOT;
  const runtimeDir = path.resolve(projectRoot, docsConfig.root ?? DEFAULT_RUNTIME_ROOT);
  const docsSourceDir = path.resolve(projectRoot, docsRoot);
  const apiReferenceSourceDir = path.resolve(projectRoot, apiReferenceRoot);
  const apiReferenceSpec = resolveManagedOpenApiSpec(projectRoot, parsed.data.content?.openapi);

  if (
    runtimeDir === docsSourceDir ||
    runtimeDir.startsWith(`${docsSourceDir}${path.sep}`) ||
    runtimeDir === apiReferenceSourceDir ||
    runtimeDir.startsWith(`${apiReferenceSourceDir}${path.sep}`)
  ) {
    throw new Error(
      `docs.root must point outside ${docsRoot}/ and ${apiReferenceRoot}/ so the generated runtime does not overwrite authored content.`,
    );
  }

  const siteName =
    parsed.data.site?.name ?? parsed.data.site?.title ?? path.basename(projectRoot) ?? "Docs";
  const theme = resolveThemePreset(parsed.data.theme?.preset);

  return {
    configPath,
    configFileName,
    projectRoot,
    runtimeDir,
    runtimeFramework,
    docsRoot,
    apiReferenceRoot,
    apiReferenceSpec,
    siteName,
    titleTemplate: parsed.data.site?.titleTemplate ?? `%s | ${siteName}`,
    description: parsed.data.site?.description ?? `Documentation for ${siteName}.`,
    theme,
  };
}

function resolveLocalPackageSpec(
  projectRoot: string,
  runtimeDir: string,
): Record<string, string> | null {
  const frameworkRoot = findLocalFrameworkRoot(projectRoot);
  if (!frameworkRoot) return null;

  const packageDirs = {
    "@farming-labs/docs": path.join(frameworkRoot, "packages", "docs"),
    "@farming-labs/next": path.join(frameworkRoot, "packages", "next"),
    "@farming-labs/theme": path.join(frameworkRoot, "packages", "fumadocs"),
  };

  if (
    !Object.values(packageDirs).every((value) => fs.existsSync(path.join(value, "package.json")))
  ) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(packageDirs).map(([name, packageDir]) => {
      const relative = toPosixPath(path.relative(runtimeDir, packageDir) || ".");
      return [name, `file:${relative}`];
    }),
  );
}

function renderRuntimePackageJson(project: ManagedDocsProject): string {
  const localPackageSpec = resolveLocalPackageSpec(project.projectRoot, project.runtimeDir);
  const docsVersion = getDocsPackageVersion();
  const frameworkSpec = localPackageSpec ?? {
    "@farming-labs/docs": docsVersion,
    "@farming-labs/next": docsVersion,
    "@farming-labs/theme": docsVersion,
  };

  return `${JSON.stringify(
    {
      name: `${project.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "docs"}-managed-runtime`,
      private: true,
      scripts: {
        dev: "next dev --turbopack",
        build: "next build --turbopack",
        start: "next start",
      },
      dependencies: {
        ...frameworkSpec,
        next: DEFAULT_NEXT_VERSION,
        react: DEFAULT_REACT_VERSION,
        "react-dom": DEFAULT_REACT_VERSION,
        yaml: "^2.8.2",
      },
      devDependencies: {
        "@tailwindcss/postcss": DEFAULT_TAILWIND_VERSION,
        "@types/mdx": "^2.0.13",
        "@types/node": "^22.10.0",
        "@types/react": "^19.2.2",
        "@types/react-dom": "^19.2.2",
        postcss: DEFAULT_POSTCSS_VERSION,
        tailwindcss: DEFAULT_TAILWIND_VERSION,
        typescript: DEFAULT_TYPESCRIPT_VERSION,
      },
    },
    null,
    2,
  )}\n`;
}

function renderNextConfig(project: ManagedDocsProject): string {
  const relativeProjectRoot = toPosixPath(
    path.relative(project.runtimeDir, project.projectRoot) || ".",
  );

  return `import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

const projectRoot = path.resolve(process.cwd(), ${JSON.stringify(relativeProjectRoot)});

export default withDocs({
  turbopack: {
    root: projectRoot,
  },
});
`;
}

function renderNextEnvDts(): string {
  return `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;
}

function renderRedirectPage(target: string): string {
  return `import { redirect } from "next/navigation";

export default function HomePage() {
  redirect(${JSON.stringify(target)});
}
`;
}

function renderEmptyHomePage(): string {
  return `export default function HomePage() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>No docs content found</h1>
      <p>Add markdown files to \`${DEFAULT_DOCS_ROOT}/\` or \`${DEFAULT_API_REFERENCE_ROOT}/\` and run the dev server again.</p>
    </main>
  );
}
`;
}

function renderDocsConfigFile(options: {
  entry: string;
  navTitle: string;
  navUrl: string;
  siteName: string;
  titleTemplate: string;
  description: string;
  theme: ManagedThemePreset;
  apiReference?: {
    path: string;
    specUrl: string;
  };
}): string {
  const apiReferenceBlock = options.apiReference
    ? `  apiReference: {
    enabled: true,
    path: ${JSON.stringify(options.apiReference.path)},
    renderer: "fumadocs",
    specUrl: ${JSON.stringify(options.apiReference.specUrl)},
  },
`
    : "";

  return `import { defineDocs } from "@farming-labs/docs";
import { ${options.theme.factory} } from "${options.theme.importPath}";

export default defineDocs({
  entry: "${options.entry}",
  theme: ${options.theme.factory}(),
  nav: {
    title: ${JSON.stringify(options.navTitle)},
    url: ${JSON.stringify(options.navUrl)},
  },
  sidebar: {
    flat: true,
  },
  metadata: {
    titleTemplate: ${JSON.stringify(options.titleTemplate)},
    description: ${JSON.stringify(options.description)},
  },
${apiReferenceBlock}});
`;
}

function renderManagedApiReferenceLayout(): string {
  return `import docsConfig from "@/docs.config";
import { createNextApiReferenceLayout } from "@farming-labs/next/api-reference";

const ApiReferenceLayout = createNextApiReferenceLayout(docsConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ApiReferenceLayout>{children}</ApiReferenceLayout>;
}
`;
}

function renderManagedApiReferencePage(): string {
  return `import docsConfig from "@/docs.config";
import { createNextApiReferencePage } from "@farming-labs/next/api-reference";

const ApiReferencePage = createNextApiReferencePage(docsConfig);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default ApiReferencePage;
`;
}

function renderManagedOpenApiRoute(project: ManagedDocsProject, spec: ManagedOpenApiSpec): string {
  const relativeProjectRoot = toPosixPath(
    path.relative(project.runtimeDir, project.projectRoot) || ".",
  );

  return `import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const projectRoot = path.resolve(process.cwd(), ${JSON.stringify(relativeProjectRoot)});
const specPath = path.resolve(projectRoot, ${JSON.stringify(spec.path)});

function parseOpenApiDocument(source: string, filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".yaml" || extension === ".yml") {
    return parse(source);
  }

  return JSON.parse(source) as Record<string, unknown>;
}

export async function GET() {
  try {
    const raw = await fs.readFile(specPath, "utf-8");
    return Response.json(parseOpenApiDocument(raw, specPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      {
        error: "Unable to load OpenAPI document",
        message,
        specPath,
      },
      {
        status: 500,
      },
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
`;
}

function resolveAppRouteDir(appDir: string, route: string): string {
  return path.join(appDir, ...normalizeManagedRoutePath(route).split("/"));
}

function createManagedOpenApiSyncResult(route: string): SyncResult {
  return {
    pageCount: 1,
    routes: [`/${normalizeManagedRoutePath(route)}`],
  };
}

function getManagedOpenApiTrackedPaths(project: ManagedDocsProject): string[] {
  if (project.apiReferenceSpec && !project.apiReferenceSpec.sourcePath) {
    return [];
  }

  if (project.apiReferenceSpec?.sourcePath) {
    return [project.apiReferenceSpec.sourcePath];
  }

  return MANAGED_OPENAPI_CONVENTION_CANDIDATES.map((candidate) =>
    path.join(project.projectRoot, candidate),
  );
}

function validateManagedOpenApiSpec(project: ManagedDocsProject): void {
  const sourcePath = project.apiReferenceSpec?.sourcePath;
  if (!sourcePath) return;

  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    const relativePath = path.relative(project.projectRoot, sourcePath) || sourcePath;
    throw new Error(
      `OpenAPI source not found at ${relativePath}. Update ${project.configFileName} or add the spec file and try again.`,
    );
  }
}

function renderAlternateSectionLayout(configImportPath: string): string {
  return `import docsConfig from "${configImportPath}";
import { createDocsLayout, createDocsMetadata } from "@farming-labs/theme";

export const metadata = createDocsMetadata(docsConfig);

const DocsLayout = createDocsLayout(docsConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>;
}
`;
}

function renderManagedPreviewProxy(): string {
  return `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOG_PREFIX = "[docs-page]";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const purpose = request.headers.get("purpose");
  const prefetch = request.headers.get("next-router-prefetch");

  if (purpose !== "prefetch" && prefetch === null) {
    console.log(\`\${LOG_PREFIX} \${pathname}\`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/docs/:path*", "/api-reference/:path*"],
};
`;
}

function writeFileIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (existing === content) return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function copyFile(sourcePath: string, destinationPath: string): void {
  if (normalizePathKey(sourcePath) === normalizePathKey(destinationPath)) return;

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function resolveGeneratedPagePath(destinationRoot: string, relativeSourcePath: string): string {
  const sourceDir = path.dirname(relativeSourcePath);
  const extension = path.extname(relativeSourcePath);
  const baseName = path.basename(relativeSourcePath, extension);

  if (baseName === "page" || baseName === "index") {
    return path.join(destinationRoot, sourceDir, "page.mdx");
  }

  return path.join(destinationRoot, sourceDir, baseName, "page.mdx");
}

function resolveGeneratedRoute(baseRoute: string, relativeSourcePath: string): string {
  const sourceDir = path.dirname(relativeSourcePath);
  const extension = path.extname(relativeSourcePath);
  const baseName = path.basename(relativeSourcePath, extension);
  const sourceDirPosix = sourceDir === "." ? "" : toPosixPath(sourceDir);

  if (baseName === "page" || baseName === "index") {
    return sourceDirPosix ? `/${baseRoute}/${sourceDirPosix}` : `/${baseRoute}`;
  }

  return sourceDirPosix
    ? `/${baseRoute}/${sourceDirPosix}/${baseName}`
    : `/${baseRoute}/${baseName}`;
}

function buildPageCandidates(basePath: string): string[] {
  return [
    basePath,
    `${basePath}.mdx`,
    `${basePath}.md`,
    path.join(basePath, "index.mdx"),
    path.join(basePath, "index.md"),
    path.join(basePath, "page.mdx"),
    path.join(basePath, "page.md"),
  ];
}

function splitReference(value: string): {
  pathPart: string;
  suffix: string;
} {
  const hashIndex = value.indexOf("#");
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : value.slice(hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const pathPart = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex);
  return {
    pathPart,
    suffix: `${query}${hash}`,
  };
}

function isExternalReference(value: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
}

function stripRelativeReferencePrefix(value: string): string {
  let stripped = value;
  while (stripped.startsWith("./")) {
    stripped = stripped.slice(2);
  }
  while (stripped.startsWith("../")) {
    stripped = stripped.slice(3);
  }
  return stripped;
}

function matchesContentRootHint(value: string, contentRootHints: string[]): boolean {
  const normalized = toPosixPath(value).replace(/^\/+/, "");
  return contentRootHints.some((hint) => normalized === hint || normalized.startsWith(`${hint}/`));
}

function resolveLinkedSourcePage(
  sourcePagePath: string,
  referencePath: string,
  pageMap: Map<string, string>,
  projectRoot: string,
  contentRootHints: string[],
): string | null {
  const basePath = path.resolve(path.dirname(sourcePagePath), referencePath);
  for (const candidate of buildPageCandidates(basePath)) {
    const normalized = normalizePathKey(candidate);
    if (pageMap.has(normalized)) return normalized;
  }

  const rootRelativeReference = stripRelativeReferencePrefix(referencePath);
  if (matchesContentRootHint(rootRelativeReference, contentRootHints)) {
    const rootRelativeBasePath = path.resolve(projectRoot, rootRelativeReference);
    for (const candidate of buildPageCandidates(rootRelativeBasePath)) {
      const normalized = normalizePathKey(candidate);
      if (pageMap.has(normalized)) return normalized;
    }
  }

  return null;
}

function rewriteReference(rawReference: string, context: RewriteContext): string {
  const trimmed = rawReference.trim();
  const wrapped = trimmed.startsWith("<") && trimmed.endsWith(">");
  const reference = wrapped ? trimmed.slice(1, -1) : trimmed;

  if (
    !reference ||
    reference.startsWith("#") ||
    path.isAbsolute(reference) ||
    isExternalReference(reference)
  ) {
    return rawReference;
  }

  const { pathPart, suffix } = splitReference(reference);
  if (!pathPart) return rawReference;

  const linkedSourcePage = resolveLinkedSourcePage(
    context.sourcePagePath,
    pathPart,
    context.pageMap,
    context.projectRoot,
    context.contentRootHints,
  );

  if (linkedSourcePage) {
    const destinationRoute = context.routeMap.get(linkedSourcePage)!;
    const rewritten = `${destinationRoute}${suffix}`;
    return wrapped ? `<${rewritten}>` : rewritten;
  }

  const assetSourcePath = path.resolve(path.dirname(context.sourcePagePath), pathPart);
  if (fs.existsSync(assetSourcePath) && fs.statSync(assetSourcePath).isFile()) {
    const assetDestinationPath = path.resolve(path.dirname(context.destinationPagePath), pathPart);
    context.assetCopies.set(normalizePathKey(assetDestinationPath), assetSourcePath);
  }

  return rawReference;
}

function rewritePageContent(content: string, context: RewriteContext): string {
  let output = content.replace(/(!?\[[^\]]*?\]\()([^)]+)(\))/g, (_match, prefix, url, suffix) => {
    return `${prefix}${rewriteReference(url, context)}${suffix}`;
  });

  output = output.replace(
    /\b(href|src)=("([^"]+)"|'([^']+)')/g,
    (match, attr, quoted, dbl, sgl) => {
      const raw = dbl ?? sgl;
      if (!raw || raw.includes("{")) return match;
      const rewritten = rewriteReference(raw, context);
      const quote = quoted.startsWith('"') ? '"' : "'";
      return `${attr}=${quote}${rewritten}${quote}`;
    },
  );

  return output;
}

function buildManagedPageMap(
  sections: Array<{
    sourceDir: string;
    destinationDir: string;
    baseRoute: string;
  }>,
): {
  pageMap: Map<string, string>;
  routeMap: Map<string, string>;
} {
  const pageMap = new Map<string, string>();
  const routeMap = new Map<string, string>();

  for (const section of sections) {
    const pageFiles = walkFiles(section.sourceDir).filter(isPageSourceFile);
    for (const pageFile of pageFiles) {
      const relativeSourcePath = path.relative(section.sourceDir, pageFile);
      const normalizedSource = normalizePathKey(pageFile);
      pageMap.set(
        normalizedSource,
        resolveGeneratedPagePath(section.destinationDir, relativeSourcePath),
      );
      routeMap.set(normalizedSource, resolveGeneratedRoute(section.baseRoute, relativeSourcePath));
    }
  }

  return {
    pageMap,
    routeMap,
  };
}

function syncManagedSection(options: {
  sourceDir: string;
  destinationDir: string;
  baseRoute: string;
  pageMap: Map<string, string>;
  routeMap: Map<string, string>;
  projectRoot: string;
  contentRootHints: string[];
}): SyncResult {
  fs.rmSync(options.destinationDir, { recursive: true, force: true });

  const sourceFiles = walkFiles(options.sourceDir);
  const pageFiles = sourceFiles.filter(isPageSourceFile);
  if (pageFiles.length === 0) {
    return {
      pageCount: 0,
      routes: [],
    };
  }

  const assetCopies = new Map<string, string>();
  const routes: string[] = [];

  for (const pageFile of pageFiles) {
    const normalizedSource = normalizePathKey(pageFile);
    const destinationPagePath = options.pageMap.get(normalizedSource)!;
    const relativeSourcePath = path.relative(options.sourceDir, pageFile);
    const content = fs.readFileSync(pageFile, "utf-8");
    const rewritten = rewritePageContent(content, {
      sourcePagePath: pageFile,
      destinationPagePath,
      pageMap: options.pageMap,
      routeMap: options.routeMap,
      assetCopies,
      projectRoot: options.projectRoot,
      contentRootHints: options.contentRootHints,
    });
    writeFileIfChanged(destinationPagePath, rewritten);
    routes.push(resolveGeneratedRoute(options.baseRoute, relativeSourcePath));
  }

  for (const filePath of sourceFiles) {
    const relativeSourcePath = path.relative(options.sourceDir, filePath);

    if (pageFiles.includes(filePath)) continue;

    const destinationPath = path.join(options.destinationDir, relativeSourcePath);
    copyFile(filePath, destinationPath);
  }

  for (const [destinationPath, sourcePath] of assetCopies.entries()) {
    copyFile(sourcePath, destinationPath);
  }

  return {
    pageCount: pageFiles.length,
    routes: routes.sort(),
  };
}

function pickHomeTarget(docs: SyncResult, apiReference: SyncResult): string {
  if (docs.routes.includes("/docs")) return "/docs";
  if (docs.routes.length > 0) return docs.routes[0];
  if (apiReference.routes.includes("/api-reference")) return "/api-reference";
  if (apiReference.routes.length > 0) return apiReference.routes[0];
  return "/docs";
}

export function computeManagedSourceStamp(projectRoot: string): string {
  const project = readManagedDocsProject(projectRoot);
  const trackedPaths = [project.configPath];

  for (const rootName of [project.docsRoot, project.apiReferenceRoot]) {
    trackedPaths.push(...walkFiles(path.join(project.projectRoot, rootName)));
  }

  trackedPaths.push(...getManagedOpenApiTrackedPaths(project));

  return trackedPaths
    .map((filePath) => {
      if (!fs.existsSync(filePath)) return `${filePath}:missing`;
      const stat = fs.statSync(filePath);
      return `${filePath}:${stat.mtimeMs}:${stat.size}`;
    })
    .join("|");
}

export function materializeManagedRuntime(projectRoot: string): MaterializedManagedRuntime {
  const project = readManagedDocsProject(projectRoot);
  const docsSourceDir = path.join(project.projectRoot, project.docsRoot);
  const apiReferenceSourceDir = path.join(project.projectRoot, project.apiReferenceRoot);
  const hasOpenApiSpec = Boolean(project.apiReferenceSpec);
  const hasDocsMarkdown = directoryHasMarkdown(docsSourceDir);
  const hasApiReferenceMarkdown = directoryHasMarkdown(apiReferenceSourceDir);

  validateManagedOpenApiSpec(project);

  if (!hasDocsMarkdown && !hasApiReferenceMarkdown && !hasOpenApiSpec) {
    throw new Error(
      `No docs content found. Add markdown files under ${project.docsRoot}/ or ${project.apiReferenceRoot}/, or point content.openapi at an OpenAPI file in ${project.configFileName}.`,
    );
  }

  const templateConfig: TemplateConfig = {
    entry: "docs",
    theme: project.theme.templateTheme,
    projectName: project.siteName,
    framework: project.runtimeFramework,
    useAlias: true,
    nextAppDir: "app",
    apiReference: {
      path: normalizeManagedRoutePath(project.apiReferenceSpec?.route),
      routeRoot: "api",
    },
  };

  const appDir = path.join(project.runtimeDir, "app");
  const docsDir = path.join(appDir, "docs");
  const apiReferenceRoute = project.apiReferenceSpec?.route ?? DEFAULT_API_REFERENCE_ROOT;
  const apiReferenceDir = resolveAppRouteDir(appDir, apiReferenceRoute);
  const managedOpenApiRouteDir = path.join(appDir, "api", "docs", "openapi");
  const legacyMiddlewarePath = path.join(project.runtimeDir, "middleware.ts");

  fs.mkdirSync(project.runtimeDir, { recursive: true });
  fs.rmSync(legacyMiddlewarePath, { force: true });

  writeFileIfChanged(
    path.join(project.runtimeDir, "package.json"),
    renderRuntimePackageJson(project),
  );
  writeFileIfChanged(path.join(project.runtimeDir, "next.config.ts"), renderNextConfig(project));
  writeFileIfChanged(path.join(project.runtimeDir, "next-env.d.ts"), renderNextEnvDts());
  writeFileIfChanged(path.join(project.runtimeDir, "proxy.ts"), renderManagedPreviewProxy());
  writeFileIfChanged(path.join(project.runtimeDir, "tsconfig.json"), tsconfigTemplate(true));
  writeFileIfChanged(path.join(project.runtimeDir, "postcss.config.mjs"), postcssConfigTemplate());
  writeFileIfChanged(path.join(project.runtimeDir, ".gitignore"), ".next\nnode_modules\n");
  writeFileIfChanged(
    path.join(project.runtimeDir, "docs.config.ts"),
    renderDocsConfigFile({
      entry: "docs",
      navTitle: project.siteName,
      navUrl: "/docs",
      siteName: project.siteName,
      titleTemplate: project.titleTemplate,
      description: project.description,
      theme: project.theme,
      apiReference: project.apiReferenceSpec
        ? {
            path: apiReferenceRoute,
            specUrl: project.apiReferenceSpec.specUrl,
          }
        : undefined,
    }),
  );
  if (!project.apiReferenceSpec) {
    writeFileIfChanged(
      path.join(project.runtimeDir, "api-reference.config.ts"),
      renderDocsConfigFile({
        entry: "api-reference",
        navTitle: `${project.siteName} API Reference`,
        navUrl: "/api-reference",
        siteName: project.siteName,
        titleTemplate: project.titleTemplate,
        description: project.description,
        theme: project.theme,
      }),
    );
  } else {
    fs.rmSync(path.join(project.runtimeDir, "api-reference.config.ts"), { force: true });
  }
  writeFileIfChanged(
    path.join(appDir, "layout.tsx"),
    rootLayoutTemplate(templateConfig, "app/global.css"),
  );
  writeFileIfChanged(
    path.join(appDir, "global.css"),
    globalCssTemplate(project.theme.templateTheme),
  );

  const { pageMap, routeMap } = buildManagedPageMap(
    [
      {
        sourceDir: docsSourceDir,
        destinationDir: docsDir,
        baseRoute: "docs",
      },
      !project.apiReferenceSpec
        ? {
            sourceDir: apiReferenceSourceDir,
            destinationDir: apiReferenceDir,
            baseRoute: "api-reference",
          }
        : null,
    ].filter(Boolean) as Array<{
      sourceDir: string;
      destinationDir: string;
      baseRoute: string;
    }>,
  );
  const contentRootHints = [
    toPosixPath(project.docsRoot).replace(/\/+$/, ""),
    toPosixPath(project.apiReferenceRoot).replace(/\/+$/, ""),
  ];

  const docs = syncManagedSection({
    sourceDir: docsSourceDir,
    destinationDir: docsDir,
    baseRoute: "docs",
    pageMap,
    routeMap,
    projectRoot: project.projectRoot,
    contentRootHints,
  });
  let apiReference: SyncResult;

  if (project.apiReferenceSpec) {
    fs.rmSync(apiReferenceDir, { recursive: true, force: true });
    writeFileIfChanged(path.join(apiReferenceDir, "layout.tsx"), renderManagedApiReferenceLayout());
    writeFileIfChanged(
      path.join(apiReferenceDir, "[[...slug]]", "page.tsx"),
      renderManagedApiReferencePage(),
    );

    if (project.apiReferenceSpec.sourcePath) {
      writeFileIfChanged(
        path.join(managedOpenApiRouteDir, "route.ts"),
        renderManagedOpenApiRoute(project, project.apiReferenceSpec),
      );
    } else {
      fs.rmSync(managedOpenApiRouteDir, { recursive: true, force: true });
    }

    apiReference = createManagedOpenApiSyncResult(project.apiReferenceSpec.route);
  } else {
    fs.rmSync(managedOpenApiRouteDir, { recursive: true, force: true });
    apiReference = syncManagedSection({
      sourceDir: apiReferenceSourceDir,
      destinationDir: apiReferenceDir,
      baseRoute: "api-reference",
      pageMap,
      routeMap,
      projectRoot: project.projectRoot,
      contentRootHints,
    });
  }

  writeFileIfChanged(path.join(docsDir, "layout.tsx"), docsLayoutTemplate(templateConfig));
  if (!project.apiReferenceSpec) {
    writeFileIfChanged(
      path.join(apiReferenceDir, "layout.tsx"),
      renderAlternateSectionLayout("@/api-reference.config"),
    );
  }

  const homeTarget = pickHomeTarget(docs, apiReference);
  writeFileIfChanged(
    path.join(appDir, "page.tsx"),
    docs.pageCount > 0 || apiReference.pageCount > 0
      ? renderRedirectPage(homeTarget)
      : renderEmptyHomePage(),
  );

  return {
    runtimeDir: project.runtimeDir,
    docs,
    apiReference,
    homeTarget,
  };
}

function getInstallCommand(packageManager: PackageManager): {
  command: string;
  args: string[];
} {
  if (packageManager === "pnpm") {
    return {
      command: "pnpm",
      args: ["install", "--ignore-workspace", "--prefer-offline"],
    };
  }

  if (packageManager === "yarn") {
    return {
      command: "yarn",
      args: ["install"],
    };
  }

  if (packageManager === "bun") {
    return {
      command: "bun",
      args: ["install"],
    };
  }

  return {
    command: "npm",
    args: ["install", "--prefer-offline"],
  };
}

function getRuntimeInstallStamp(project: ManagedDocsProject): string {
  return fs.readFileSync(path.join(project.runtimeDir, "package.json"), "utf-8");
}

async function runCapturedCommand(options: {
  label: DevLabel;
  command: string;
  args: string[];
  cwd: string;
  verbose?: boolean;
  failureMessage: string;
}): Promise<void> {
  const recentLines: string[] = [];
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  const rememberLine = (line: string) => {
    const normalized = normalizeLogLine(line);
    if (!normalized) return;
    recentLines.push(normalized);
    if (recentLines.length > 12) recentLines.shift();
  };

  const stdoutReader = createLineReader((line) => {
    rememberLine(line);
    if (options.verbose) {
      logLine(options.label, pc.dim(normalizeLogLine(line)));
    }
  });

  const stderrReader = createLineReader((line) => {
    rememberLine(line);
    if (options.verbose) {
      logLine(options.label, pc.dim(normalizeLogLine(line)));
    }
  });

  child.stdout?.on("data", (chunk) => stdoutReader.push(chunk));
  child.stderr?.on("data", (chunk) => stderrReader.push(chunk));

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      stdoutReader.flush();
      stderrReader.flush();

      if (code && code !== 0) {
        const details =
          recentLines.length > 0 ? `\n${recentLines.map((line) => `  ${line}`).join("\n")}` : "";
        reject(new Error(`${options.failureMessage}${details}`));
        return;
      }

      resolve();
    });
  });
}

function terminateChildProcessTree(child: ReturnType<typeof spawn>): void {
  if (child.exitCode !== null || child.killed) return;

  const childPid = child.pid;

  if (process.platform !== "win32" && typeof childPid === "number") {
    try {
      process.kill(-childPid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
      return;
    }

    const forceKillTimer = setTimeout(() => {
      if (child.exitCode !== null || child.killed) return;
      try {
        process.kill(-childPid, "SIGKILL");
      } catch {}
    }, 1500);
    forceKillTimer.unref();
    return;
  }

  child.kill("SIGTERM");
}

function getRunScriptCommand(
  packageManager: PackageManager,
  scriptName: string,
  scriptArgs: string[] = [],
): {
  command: string;
  args: string[];
} {
  if (packageManager === "yarn") {
    return {
      command: "yarn",
      args: [scriptName, ...scriptArgs],
    };
  }

  if (packageManager === "npm") {
    return {
      command: "npm",
      args: ["run", scriptName, ...(scriptArgs.length > 0 ? ["--", ...scriptArgs] : [])],
    };
  }

  return {
    command: packageManager,
    args: ["run", scriptName, ...scriptArgs],
  };
}

function getNextDevArgs(options: DevOptions): string[] {
  const args: string[] = [];

  if (options.port) {
    args.push("--port", options.port);
  }

  const requestedHost = resolveRequestedHost(options);
  if (requestedHost === true) {
    args.push("--hostname", "0.0.0.0");
  } else if (typeof requestedHost === "string") {
    args.push("--hostname", requestedHost);
  }

  return args;
}

function resolveLocalPreviewOrigin(options: DevOptions): string {
  const port = options.port ?? "3000";
  const requestedHost = resolveRequestedHost(options);
  const hostname =
    requestedHost === true || requestedHost === "0.0.0.0"
      ? "localhost"
      : typeof requestedHost === "string" && requestedHost.trim()
        ? requestedHost.trim()
        : "localhost";

  return `http://${hostname}:${port}`;
}

export async function dev(options: DevOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const project = readManagedDocsProject(projectRoot);
  const packageManager = detectNearestPackageManager(projectRoot);
  const initial = materializeManagedRuntime(projectRoot);
  const runtimeNodeModules = path.join(project.runtimeDir, "node_modules");
  const runtimeInstallMarker = path.join(project.runtimeDir, ".docs-runtime-install-stamp");
  const devLogger = createDevLogger();
  const version = normalizeVersionTag(getDocsPackageVersion());
  const runtimeInstallStamp = getRuntimeInstallStamp(project);

  console.log(pc.dim("Preparing local preview..."));
  if (options.verbose) {
    logLine(
      "source",
      `${pc.cyan(project.configFileName)} drives ${pc.cyan(`${project.docsRoot}/`)} and ${pc.cyan(`${project.apiReferenceRoot}/`)}`,
    );
    logLine(
      "runtime",
      `Generated runtime at ${pc.cyan(path.relative(projectRoot, project.runtimeDir) || project.runtimeDir)}`,
    );
    logLine(
      "watch",
      `Watching ${project.docsRoot}/, ${project.apiReferenceRoot}/, and ${project.configFileName}`,
    );
    logLine(
      "sync",
      `Loaded ${initial.docs.pageCount} docs page${initial.docs.pageCount === 1 ? "" : "s"} and ${initial.apiReference.pageCount} api-reference page${initial.apiReference.pageCount === 1 ? "" : "s"}`,
    );
  }

  if (
    !fs.existsSync(runtimeNodeModules) ||
    !fs.existsSync(runtimeInstallMarker) ||
    fs.readFileSync(runtimeInstallMarker, "utf-8") !== runtimeInstallStamp
  ) {
    if (options.verbose) {
      logLine("install", `Installing runtime dependencies with ${pc.cyan(packageManager)}`);
    }
    const install = getInstallCommand(packageManager);
    await runCapturedCommand({
      label: "install",
      command: install.command,
      args: install.args,
      cwd: project.runtimeDir,
      verbose: options.verbose,
      failureMessage: `Failed to install runtime dependencies with ${packageManager}.`,
    });
    writeFileIfChanged(runtimeInstallMarker, runtimeInstallStamp);
    if (options.verbose) {
      logLine("install", "Runtime dependencies ready");
    }
  }

  let lastStamp = computeManagedSourceStamp(projectRoot);
  const interval = setInterval(() => {
    try {
      const nextStamp = computeManagedSourceStamp(projectRoot);
      if (nextStamp === lastStamp) return;
      lastStamp = nextStamp;

      const updated = materializeManagedRuntime(projectRoot);
      if (options.verbose) {
        logLine(
          "sync",
          `Updated preview from ${updated.docs.pageCount} docs page${updated.docs.pageCount === 1 ? "" : "s"} and ${updated.apiReference.pageCount} api-reference page${updated.apiReference.pageCount === 1 ? "" : "s"}`,
        );
      } else {
        logLine("sync", "Preview updated");
      }
    } catch (error) {
      logErrorLine(
        error instanceof Error
          ? `Failed to sync frameworkless content: ${error.message}`
          : "Failed to sync frameworkless content.",
      );
    }
  }, DEFAULT_POLL_INTERVAL_MS);

  const serverStartTime = Date.now();
  const { command, args } = getRunScriptCommand(packageManager, "dev", getNextDevArgs(options));
  const child = spawn(command, args, {
    cwd: initial.runtimeDir,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      FARMING_LABS_DOCS_DEV_ORIGIN: resolveLocalPreviewOrigin(options),
    },
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  if (options.verbose) {
    logLine("server", "Starting local preview runtime");
  }

  const serverState = {
    localUrl: undefined as string | undefined,
    networkUrl: undefined as string | undefined,
    readyShown: false,
    startingShown: false,
  };

  const handleNextLine = (line: string, stream: "stdout" | "stderr") => {
    const normalized = normalizeLogLine(line);
    if (!normalized) return;

    const event = parseNextDevLine(normalized);
    if (event) {
      switch (event.type) {
        case "starting":
          if (options.verbose && !serverState.startingShown) {
            serverState.startingShown = true;
            logLine("server", "Booting Next.js preview engine");
          }
          return;
        case "local":
          serverState.localUrl = event.url;
          return;
        case "network":
          serverState.networkUrl = event.url;
          return;
        case "ready":
          if (serverState.readyShown) {
            return;
          }
          printDevBanner({
            name: "@farming-labs/docs",
            version,
            port: resolveBannerPort(serverState.localUrl, options.port),
            host: resolveRequestedHost(options),
            protocol: resolveBannerProtocol(serverState.localUrl),
            startTime: serverStartTime,
            localUrl: serverState.localUrl,
            networkUrl: serverState.networkUrl,
          });
          console.log(pc.dim("  press Ctrl+C to stop"));
          serverState.readyShown = true;
          return;
        case "page":
          logLine("PAGE", event.pathname);
          return;
        case "compiling":
          if (options.verbose) {
            logLine("compile", `Compiling ${pc.bold(event.target)}`);
          }
          return;
        case "compiled":
          if (options.verbose) {
            logLine(
              "compile",
              `Compiled ${pc.bold(event.target)}${event.duration ? ` in ${pc.bold(event.duration)}` : ""}`,
            );
          }
          return;
        case "warning":
          devLogger.warn(event.message);
          return;
        case "error":
          devLogger.error(event.message);
          return;
      }
    }

    if (stream === "stderr") {
      if (/\bwarn(?:ing)?\b/i.test(normalized)) {
        devLogger.warn(normalized);
      } else {
        devLogger.error(normalized);
      }
      return;
    }

    if (options.verbose) {
      logLine("next", pc.dim(normalized));
    }
  };

  const stdoutReader = createLineReader((line) => handleNextLine(line, "stdout"));
  const stderrReader = createLineReader((line) => handleNextLine(line, "stderr"));

  child.stdout?.on("data", (chunk) => stdoutReader.push(chunk));
  child.stderr?.on("data", (chunk) => stderrReader.push(chunk));

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(interval);
    process.off("SIGINT", cleanup);
    process.off("SIGTERM", cleanup);
    terminateChildProcessTree(child);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  await new Promise<void>((resolve, reject) => {
    child.on("error", (error) => {
      stdoutReader.flush();
      stderrReader.flush();
      cleanup();
      reject(error);
    });

    child.on("close", (code) => {
      stdoutReader.flush();
      stderrReader.flush();
      cleanup();
      if (code && code !== 0) {
        reject(new Error(`The frameworkless dev server exited with code ${code}.`));
        return;
      }
      resolve();
    });
  });
}

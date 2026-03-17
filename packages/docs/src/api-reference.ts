import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { getHtmlDocument } from "@scalar/core/libs/html-rendering";
import type { ApiReferenceConfig, DocsConfig, DocsTheme } from "./types.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export type ApiReferenceFramework = "next" | "tanstack-start" | "sveltekit" | "astro" | "nuxt";

export interface ApiReferenceRoute {
  title: string;
  summary: string;
  description?: string;
  routePath: string;
  sourceFile: string;
  methods: HttpMethod[];
  tag: string;
  parameters: Array<Record<string, unknown>>;
}

interface BuildApiReferenceOptions {
  framework: ApiReferenceFramework;
  rootDir?: string;
}

interface BuildApiReferenceHtmlOptions extends BuildApiReferenceOptions {
  title?: string;
}

const NEXT_ROUTE_FILE_RE = /^route\.(ts|tsx|js|jsx)$/;
const SVELTE_ROUTE_FILE_RE = /^\+server\.(ts|js)$/;
const ASTRO_ROUTE_FILE_RE = /^[^.].*\.(ts|js|mts|mjs)$/;
const NUXT_ROUTE_FILE_RE = /^[^.].*\.(ts|js|mts|mjs)$/;
const TANSTACK_ROUTE_FILE_RE = /\.(ts|tsx|js|jsx)$/;
const METHOD_RE =
  /export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ALL)\b/g;
const METHOD_NAMES: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function resolveApiReferenceConfig(
  value: DocsConfig["apiReference"],
): Required<ApiReferenceConfig> {
  if (value === true) {
    return {
      enabled: true,
      path: "api-reference",
      routeRoot: "api",
      exclude: [],
    };
  }

  if (!value) {
    return {
      enabled: false,
      path: "api-reference",
      routeRoot: "api",
      exclude: [],
    };
  }

  return {
    enabled: value.enabled !== false,
    path: normalizePathSegment(value.path ?? "api-reference"),
    routeRoot: normalizePathSegment(value.routeRoot ?? "api") || "api",
    exclude: normalizeApiReferenceExcludes(value.exclude),
  };
}

export function buildApiReferencePageTitle(config: DocsConfig, title = "API Reference"): string {
  const template = config.metadata?.titleTemplate;
  if (!template) return title;
  return template.replace("%s", title);
}

export function buildApiReferenceScalarCss(config: DocsConfig): string {
  const theme = resolveTheme(config);
  const colors = theme?.ui?.colors;
  const typography = theme?.ui?.typography?.font?.style;
  const layout = theme?.ui?.layout;
  const primary = colors?.primary ?? "#6366f1";
  const border = colors?.border ?? "#2a2a2a";
  const muted = colors?.muted ?? "#64748b";
  const background = colors?.background ?? "#ffffff";
  const card = colors?.card ?? background;
  const foreground = colors?.foreground ?? "#1b1b1b";
  const sidebarWidth = layout?.sidebarWidth ?? 280;
  const sans = typography?.sans ?? '"Geist", "Inter", "Segoe UI", sans-serif';
  const mono = typography?.mono ?? '"Geist Mono", "SFMono-Regular", "Menlo", monospace';

  return `
:root {
  --scalar-font: ${sans};
  --scalar-font-code: ${mono};
  --scalar-theme-primary: ${primary};
  --scalar-theme-border: ${border};
  --scalar-theme-muted: ${muted};
  --scalar-theme-background: ${background};
  --scalar-theme-card: ${card};
  --scalar-theme-foreground: ${foreground};
}

.dark-mode {
  --scalar-background-1: color-mix(in srgb, #0b0c0b 98%, var(--scalar-theme-primary) 2%);
  --scalar-background-2: color-mix(in srgb, #111311 96%, var(--scalar-theme-primary) 4%);
  --scalar-background-3: color-mix(in srgb, #171917 95%, var(--scalar-theme-primary) 5%);
  --scalar-color-1: rgba(255, 255, 255, 0.96);
  --scalar-color-2: rgba(255, 255, 255, 0.72);
  --scalar-color-3: rgba(255, 255, 255, 0.5);
  --scalar-color-accent: var(--scalar-theme-primary);
  --scalar-sidebar-color-active: var(--scalar-theme-primary);
  --scalar-sidebar-item-active-background: color-mix(
    in srgb,
    var(--scalar-theme-primary) 7%,
    transparent
  );
  --scalar-border-color: color-mix(
    in srgb,
    var(--scalar-theme-border) 22%,
    rgba(255, 255, 255, 0.032)
  );
  --scalar-button-1: var(--scalar-theme-primary);
  --scalar-button-1-color: #ffffff;
  --scalar-button-1-hover: color-mix(in srgb, var(--scalar-theme-primary) 88%, white 12%);
}

.light-mode {
  --scalar-background-1: var(--scalar-theme-background);
  --scalar-background-2: color-mix(in srgb, var(--scalar-theme-card) 92%, white 8%);
  --scalar-background-3: color-mix(in srgb, var(--scalar-theme-card) 84%, black 4%);
  --scalar-color-1: var(--scalar-theme-foreground);
  --scalar-color-2: var(--scalar-theme-muted);
  --scalar-color-3: color-mix(in srgb, var(--scalar-theme-muted) 78%, white 22%);
  --scalar-color-accent: var(--scalar-theme-primary);
  --scalar-sidebar-color-active: var(--scalar-theme-primary);
  --scalar-sidebar-item-active-background: color-mix(
    in srgb,
    var(--scalar-theme-primary) 5%,
    transparent
  );
  --scalar-border-color: color-mix(in srgb, var(--scalar-theme-border) 42%, white 58%);
  --scalar-button-1: var(--scalar-theme-primary);
  --scalar-button-1-color: #ffffff;
  --scalar-button-1-hover: color-mix(in srgb, var(--scalar-theme-primary) 88%, black 12%);
}

body {
  background: var(--scalar-background-1);
}

.t-doc__sidebar {
  width: min(${sidebarWidth}px, 100vw);
  border-right: 1px solid var(--scalar-border-color);
}

.scalar-card,
.t-doc__sidebar,
.references-layout .reference-layout__content .request-card,
.references-layout .reference-layout__content .response-card,
.references-layout .reference-layout__content .scalar-card-header,
.references-layout .reference-layout__content .scalar-card-footer,
.references-layout .reference-layout__content .section,
.references-layout .reference-layout__content .section-container {
  border-color: var(--scalar-border-color) !important;
}

.t-doc__sidebar,
.t-doc__sidebar * {
  font-family: var(--scalar-font);
}

.t-doc__sidebar .sidebar-search {
  margin: 0.5rem 0 1rem;
}

.t-doc__sidebar .sidebar-search input {
  border-radius: 14px;
}

.t-doc__sidebar .sidebar-item,
.t-doc__sidebar .sidebar-heading {
  border-radius: 14px;
}

.t-doc__sidebar .sidebar-group-label {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--scalar-color-3);
}

.t-doc__sidebar .sidebar-item--active {
  font-weight: 600;
}

.scalar-card,
.references-layout .reference-layout__content .request-card,
.references-layout .reference-layout__content .response-card {
  border-radius: 18px;
}

.references-layout .reference-layout__content {
  padding-top: 1.5rem;
}

.references-layout .section-content,
.references-layout .section-flare {
  background: transparent;
}

.references-layout .reference-layout__content,
.references-layout .reference-layout__content * {
  font-family: var(--scalar-font);
}

.references-layout code,
.references-layout pre,
.references-layout .scalar-codeblock {
  font-family: var(--scalar-font-code);
}
`;
}

export function buildApiReferenceOpenApiDocument(
  config: DocsConfig,
  options: BuildApiReferenceOptions,
): Record<string, unknown> {
  const routes = buildApiReferenceRoutes(config, options);
  const tags = Array.from(new Set(routes.map((route) => route.tag))).map((name) => ({
    name,
    description: `${name} endpoints`,
  }));

  return {
    openapi: "3.1.0",
    info: {
      title: "API Reference",
      description:
        config.metadata?.description ?? `Generated API reference for ${options.framework}.`,
      version: "0.0.0",
    },
    servers: [{ url: "/" }],
    tags,
    paths: buildOpenApiPaths(routes),
  };
}

export function buildApiReferenceHtmlDocument(
  config: DocsConfig,
  options: BuildApiReferenceHtmlOptions,
): string {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  const rootDir = options.rootDir ?? process.cwd();
  const title = options.title ?? "API Reference";

  return getHtmlDocument({
    pageTitle: buildApiReferencePageTitle(config, title),
    title,
    content: () =>
      buildApiReferenceOpenApiDocument(config, {
        framework: options.framework,
        rootDir,
      }),
    theme: "deepSpace",
    layout: "modern",
    customCss: buildApiReferenceScalarCss(config),
    pathRouting: {
      basePath: `/${apiReference.path}`,
    },
    showSidebar: true,
    defaultOpenFirstTag: true,
    tagsSorter: "alpha",
    operationsSorter: "alpha",
    operationTitleSource: "summary",
    defaultHttpClient: {
      targetKey: "shell",
      clientKey: "curl",
    },
    documentDownloadType: "json",
  });
}

function buildApiReferenceRoutes(
  config: DocsConfig,
  options: BuildApiReferenceOptions,
): ApiReferenceRoute[] {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return [];

  const rootDir = options.rootDir ?? process.cwd();

  switch (options.framework) {
    case "next":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, getNextAppDir(rootDir)),
        routePathBase: toRouteBase(apiReference.routeRoot, getNextAppDir(rootDir)),
        isRouteFile: (name) => NEXT_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) => relativeFile.split("/").slice(0, -1).filter(Boolean),
        config,
        exclude: apiReference.exclude,
      });
    case "sveltekit":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, "src/routes"),
        routePathBase: toRouteBase(apiReference.routeRoot, "src/routes"),
        isRouteFile: (name) => SVELTE_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) => relativeFile.split("/").slice(0, -1).filter(Boolean),
        config,
        exclude: apiReference.exclude,
      });
    case "astro":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, "src/pages"),
        routePathBase: toRouteBase(apiReference.routeRoot, "src/pages"),
        isRouteFile: (name) => ASTRO_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) => routeSegmentsFromEndpointFile(relativeFile),
        config,
        exclude: apiReference.exclude,
      });
    case "nuxt":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, "server"),
        routePathBase: toRouteBase(apiReference.routeRoot, "server"),
        isRouteFile: (name) => NUXT_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) =>
          routeSegmentsFromEndpointFile(stripNuxtMethodSuffix(relativeFile)),
        config,
        exclude: apiReference.exclude,
        getMethods: (source, file) => extractNuxtMethods(source, file),
      });
    case "tanstack-start":
      return buildTanstackRoutes(config, rootDir, apiReference);
  }
}

function buildFileConventionRoutes({
  rootDir,
  sourceDir,
  routePathBase,
  isRouteFile,
  toRouteSegments,
  config,
  exclude,
  getMethods = extractMethods,
}: {
  rootDir: string;
  sourceDir: string;
  routePathBase: string;
  isRouteFile: (name: string) => boolean;
  toRouteSegments: (relativeFile: string) => string[];
  config: DocsConfig;
  exclude: string[];
  getMethods?: (source: string, file: string) => HttpMethod[];
}): ApiReferenceRoute[] {
  const files = scanRouteFiles(sourceDir, isRouteFile);
  const routes: ApiReferenceRoute[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    const methods = getMethods(source, file);
    if (methods.length === 0) continue;

    const relativeFile = relative(sourceDir, file).replace(/\\/g, "/");
    const routeSegments = toRouteSegments(relativeFile);
    const routePath = buildRoutePath(routePathBase, routeSegments);
    if (shouldExcludeRoute(exclude, routePath, relativeFile, routeSegments.join("/"))) continue;

    routes.push(
      createApiReferenceRoute({
        rootDir,
        file,
        source,
        methods,
        routePath,
      }),
    );
  }

  return routes.sort((a, b) => a.routePath.localeCompare(b.routePath));
}

function buildTanstackRoutes(
  config: DocsConfig,
  rootDir: string,
  apiReference: Required<ApiReferenceConfig>,
): ApiReferenceRoute[] {
  const routesDir = join(rootDir, "src", "routes");
  const files = scanRouteFiles(routesDir, (name) => TANSTACK_ROUTE_FILE_RE.test(name));
  const routeBase = `/${normalizePathSegment(apiReference.routeRoot)}`;
  const routes: ApiReferenceRoute[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    if (!source.includes("createFileRoute(") || !source.includes("handlers")) continue;

    const pathMatch = source.match(/createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/);
    if (!pathMatch) continue;

    const routePath = normalizeTanstackRoutePath(pathMatch[1]);
    if (!routePath.startsWith(routeBase)) continue;

    const methods = extractTanstackMethods(source);
    if (methods.length === 0) continue;

    const relativeFile = relative(routesDir, file).replace(/\\/g, "/");
    if (shouldExcludeRoute(apiReference.exclude, routePath, relativeFile, relativeFile)) continue;

    routes.push(
      createApiReferenceRoute({
        rootDir,
        file,
        source,
        methods,
        routePath,
      }),
    );
  }

  return routes.sort((a, b) => a.routePath.localeCompare(b.routePath));
}

function createApiReferenceRoute({
  rootDir,
  file,
  source,
  methods,
  routePath,
}: {
  rootDir: string;
  file: string;
  source: string;
  methods: HttpMethod[];
  routePath: string;
}): ApiReferenceRoute {
  const docBlock = extractDocBlock(source);
  const pathSegments = routePath.split("/").filter(Boolean);
  const titleSegment = pathSegments[pathSegments.length - 1] ?? "overview";
  const tagSegment = pathSegments[0] ?? "general";
  const title = humanizeSegment(titleSegment);

  return {
    title,
    summary: docBlock.summary ?? `${title} endpoint`,
    description: docBlock.description,
    routePath,
    sourceFile: relative(rootDir, file).replace(/\\/g, "/"),
    methods,
    tag: humanizeSegment(tagSegment),
    parameters: buildPathParameters(routePath),
  };
}

function buildPathParameters(routePath: string): Array<Record<string, unknown>> {
  const parameters: Array<Record<string, unknown>> = [];

  for (const segment of routePath.split("/")) {
    const match = segment.match(/^\{(.+)\}$/);
    if (!match) continue;

    parameters.push({
      name: match[1],
      in: "path",
      required: true,
      description: `${humanizeSegment(match[1])} path parameter.`,
      schema: {
        type: "string",
      },
    });
  }

  return parameters;
}

function buildOpenApiPaths(routes: ApiReferenceRoute[]): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const pathItem: Record<string, unknown> = {};

    for (const method of route.methods) {
      pathItem[method.toLowerCase()] = {
        tags: [route.tag],
        summary: route.summary,
        description: route.description ?? route.summary,
        operationId: createOperationId(route, method),
        ...(route.parameters.length > 0 ? { parameters: route.parameters } : {}),
        ...(buildRequestBody(method) ? { requestBody: buildRequestBody(method) } : {}),
        responses: buildResponses(method),
        "x-farming-labs-source": route.sourceFile,
      };
    }

    paths[route.routePath] = pathItem;
  }

  return paths;
}

function buildRequestBody(method: HttpMethod): Record<string, unknown> | undefined {
  if (!["POST", "PUT", "PATCH"].includes(method)) return undefined;

  return {
    required: method === "POST",
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        example: {
          example: true,
        },
      },
    },
  };
}

function buildResponses(method: HttpMethod): Record<string, unknown> {
  return {
    "200": {
      description:
        method === "DELETE" ? "Resource removed successfully." : "Request completed successfully.",
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: true,
          },
          example: {
            ok: true,
          },
        },
      },
    },
  };
}

function createOperationId(route: ApiReferenceRoute, method: HttpMethod): string {
  return `${method.toLowerCase()}_${route.routePath.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

function resolveTheme(config: DocsConfig): DocsTheme | undefined {
  return config.theme;
}

function normalizeApiReferenceExcludes(values?: string[]): string[] {
  return (values ?? []).map(normalizeExcludeMatcher).filter(Boolean);
}

function normalizeExcludeMatcher(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.(ts|tsx|js|jsx|mjs|mts)$/i, "")
    .replace(/\/route$/i, "")
    .replace(/\/\+server$/i, "")
    .replace(/\/index$/i, "")
    .replace(/\.(get|post|put|patch|delete|options|head)$/i, "");
}

function shouldExcludeRoute(
  excludes: string[],
  routePath: string,
  relativeFile: string,
  relativeDir: string,
): boolean {
  if (excludes.length === 0) return false;

  const candidates = new Set([
    normalizeExcludeMatcher(routePath),
    normalizeExcludeMatcher(routePath.replace(/^\/+/, "")),
    normalizeExcludeMatcher(relativeFile),
    normalizeExcludeMatcher(relativeDir),
  ]);

  return excludes.some((entry) => candidates.has(entry));
}

function scanRouteFiles(dir: string, isRouteFile: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      results.push(...scanRouteFiles(full, isRouteFile));
      continue;
    }

    if (isRouteFile(name)) results.push(full);
  }

  return results;
}

function resolveRootedDir(rootDir: string, routeRoot: string, defaultRoot: string): string {
  const normalized = normalizePathSegment(routeRoot) || "api";
  if (normalized === defaultRoot || normalized.startsWith(`${defaultRoot}/`)) {
    return join(rootDir, ...normalized.split("/"));
  }

  return join(rootDir, ...defaultRoot.split("/"), ...normalized.split("/"));
}

function toRouteBase(routeRoot: string, defaultRoot: string): string {
  const normalized = normalizePathSegment(routeRoot) || "api";
  const base =
    normalized === defaultRoot || normalized.startsWith(`${defaultRoot}/`)
      ? normalized.slice(defaultRoot.length).replace(/^\/+/, "")
      : normalized;

  return `/${normalizePathSegment(base)}`;
}

function getNextAppDir(rootDir: string): string {
  if (existsSync(join(rootDir, "src", "app"))) return "src/app";
  return "app";
}

function routeSegmentsFromEndpointFile(relativeFile: string): string[] {
  const segments = relativeFile.split("/");
  const last = segments.pop() ?? "";
  const name = last.replace(/\.(ts|js|mts|mjs)$/i, "");

  if (name !== "index") segments.push(name);
  return segments.filter(Boolean);
}

function stripNuxtMethodSuffix(relativeFile: string): string {
  return relativeFile.replace(
    /\.(get|post|put|patch|delete|options|head)(?=\.(ts|js|mts|mjs)$)/i,
    "",
  );
}

function buildRoutePath(basePath: string, rawSegments: string[]): string {
  const segments = rawSegments
    .filter(Boolean)
    .map((segment) => endpointSegmentFromConvention(segment))
    .join("/");

  const normalizedBase = normalizePathSegment(basePath);
  const path = [normalizedBase, segments].filter(Boolean).join("/");
  return path ? `/${path}` : "/";
}

function endpointSegmentFromConvention(value: string): string {
  if (value.startsWith("[[...") && value.endsWith("]]")) return `{${value.slice(5, -2)}}`;
  if (value.startsWith("[...") && value.endsWith("]")) return `{${value.slice(4, -1)}}`;
  if (value.startsWith("[") && value.endsWith("]")) return `{${value.slice(1, -1)}}`;
  return value;
}

function normalizeTanstackRoutePath(value: string): string {
  return `/${value
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => (segment.startsWith("$") ? `{${segment.slice(1)}}` : segment))
    .filter(Boolean)
    .join("/")}`;
}

function extractDocBlock(source: string): { summary?: string; description?: string } {
  const match = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) return {};

  const lines = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("@"));

  if (lines.length === 0) return {};

  return {
    summary: lines[0],
    description: lines.slice(1).join(" "),
  };
}

function extractMethods(source: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();

  for (const match of source.matchAll(METHOD_RE)) {
    if (match[1] === "ALL") {
      METHOD_NAMES.forEach((method) => methods.add(method));
      continue;
    }

    methods.add(match[1] as HttpMethod);
  }

  return Array.from(methods);
}

function extractNuxtMethods(source: string, file: string): HttpMethod[] {
  const methods = extractMethods(source);
  if (methods.length > 0) return methods;

  const suffix = basename(file).match(
    /\.(get|post|put|patch|delete|options|head)\.(ts|js|mts|mjs)$/i,
  );
  if (suffix) return [suffix[1].toUpperCase() as HttpMethod];

  if (/defineEventHandler|eventHandler/.test(source)) return ["GET"];
  return [];
}

function extractTanstackMethods(source: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();
  const handlersMatch = source.match(/handlers\s*:\s*\{([\s\S]*?)\}/m);
  if (!handlersMatch) return [];

  for (const match of handlersMatch[1].matchAll(
    /\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*:/g,
  )) {
    methods.add(match[1] as HttpMethod);
  }

  return Array.from(methods);
}

function humanizeSegment(value: string): string {
  const normalized = value
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .replace(/^\[\[?\.{3}/, "")
    .replace(/^\[/, "")
    .replace(/\]\]?$/, "")
    .replace(/^\$/, "")
    .replace(/-/g, " ");

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

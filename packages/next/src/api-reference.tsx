import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ReactNode } from "react";
import { ApiReference } from "@scalar/nextjs-api-reference";
import type { ApiReferenceConfig, DocsConfig, DocsTheme } from "@farming-labs/docs";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

interface ApiReferenceRoute {
  title: string;
  summary: string;
  description?: string;
  routePath: string;
  sourceFile: string;
  methods: HttpMethod[];
  segments: string[];
  tag: string;
  parameters: Array<Record<string, unknown>>;
}

const ROUTE_FILE_RE = /^route\.(ts|tsx|js|jsx)$/;
const METHOD_RE =
  /export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;

function resolveTheme(config: DocsConfig): DocsTheme | undefined {
  return config.theme;
}

function buildScalarCustomCss(config: DocsConfig): string {
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

function getNextAppDir(root: string): string {
  if (existsSync(join(root, "src", "app"))) return "src/app";
  return "app";
}

export function resolveApiReferenceConfig(
  value: DocsConfig["apiReference"],
): Required<ApiReferenceConfig> {
  if (value === true) {
    return {
      enabled: true,
      path: "api-reference",
      routeRoot: "api",
    };
  }

  if (!value || value === false) {
    return {
      enabled: false,
      path: "api-reference",
      routeRoot: "api",
    };
  }

  return {
    enabled: value.enabled !== false,
    path: normalizePathSegment(value.path ?? "api-reference"),
    routeRoot: normalizeRouteRoot(value.routeRoot ?? "api"),
  };
}

function normalizePathSegment(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, "");
  return normalized || "api-reference";
}

function normalizeRouteRoot(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, "");
  return normalized || "api";
}

function resolveNextApiRouteRoot(root: string, config: Required<ApiReferenceConfig>): string {
  const routeRoot = normalizeRouteRoot(config.routeRoot);

  if (
    routeRoot === "app" ||
    routeRoot.startsWith("app/") ||
    routeRoot === "src/app" ||
    routeRoot.startsWith("src/app/")
  ) {
    return join(root, ...routeRoot.split("/"));
  }

  return join(root, getNextAppDir(root), ...routeRoot.split("/"));
}

function humanizeSegment(value: string): string {
  const normalized = value
    .replace(/^\[\[?\.{3}/, "")
    .replace(/^\[/, "")
    .replace(/\]\]?$/, "")
    .replace(/^\$/, "")
    .replace(/-/g, " ");

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function endpointSegmentFromFsSegment(value: string): string {
  if (value.startsWith("[[...") && value.endsWith("]]")) return `{${value.slice(5, -2)}}`;
  if (value.startsWith("[...") && value.endsWith("]")) return `{${value.slice(4, -1)}}`;
  if (value.startsWith("[") && value.endsWith("]")) return `{${value.slice(1, -1)}}`;
  return value;
}

function getPathParamName(value: string): string | undefined {
  if (value.startsWith("[[...") && value.endsWith("]]")) return value.slice(5, -2);
  if (value.startsWith("[...") && value.endsWith("]")) return value.slice(4, -1);
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1);
  return undefined;
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
  let match: RegExpExecArray | null = METHOD_RE.exec(source);

  while (match) {
    methods.add(match[1] as HttpMethod);
    match = METHOD_RE.exec(source);
  }

  return Array.from(methods);
}

function scanRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      results.push(...scanRouteFiles(full));
      continue;
    }

    if (ROUTE_FILE_RE.test(name)) {
      results.push(full);
    }
  }

  return results;
}

function getDocsUrl(config: DocsConfig): string {
  if (typeof config.nav?.url === "string") return config.nav.url;
  return `/${config.entry ?? "docs"}`;
}

function applyTitleTemplate(config: DocsConfig, title: string): string {
  const template = config.metadata?.titleTemplate;
  if (!template) return title;
  return template.replace("%s", title);
}

function getForcedMode(config: DocsConfig): "light" | "dark" | undefined {
  const toggle = config.themeToggle;
  if (!toggle || toggle === true || toggle === false || typeof toggle !== "object")
    return undefined;

  if (toggle.default === "dark") return "dark";
  if (toggle.default === "light") return "light";
  return undefined;
}

function isThemeToggleHidden(config: DocsConfig): boolean {
  if (config.themeToggle === false) return true;
  if (config.themeToggle && typeof config.themeToggle === "object") {
    return config.themeToggle.enabled === false;
  }

  return false;
}

function buildPathParameters(fsSegments: string[]): Array<Record<string, unknown>> {
  return fsSegments
    .map((segment) => {
      const name = getPathParamName(segment);
      if (!name) return undefined;

      const optional = segment.startsWith("[[...");

      return {
        name,
        in: "path",
        required: !optional,
        description: optional
          ? `${humanizeSegment(name)} catch-all parameter.`
          : `${humanizeSegment(name)} path parameter.`,
        schema: {
          type: "string",
        },
      } satisfies Record<string, unknown>;
    })
    .filter((value): value is Record<string, unknown> => Boolean(value));
}

function buildApiReferenceRoutes(config: DocsConfig): ApiReferenceRoute[] {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return [];

  const root = process.cwd();
  const apiDir = resolveNextApiRouteRoot(root, apiReference);
  const files = scanRouteFiles(apiDir);

  return files
    .map((file) => {
      const source = readFileSync(file, "utf-8");
      const methods = extractMethods(source);
      if (methods.length === 0) return undefined;

      const relativeDir = relative(apiDir, file).replace(/\\/g, "/");
      const fsSegments = relativeDir.split("/").slice(0, -1).filter(Boolean);
      const routeSegments = fsSegments.map(endpointSegmentFromFsSegment);
      const routePath = `/api${routeSegments.length > 0 ? `/${routeSegments.join("/")}` : ""}`;
      const docBlock = extractDocBlock(source);
      const title =
        fsSegments.length > 0 ? humanizeSegment(fsSegments[fsSegments.length - 1]) : "Overview";

      return {
        title,
        summary: docBlock.summary ?? `${title} endpoint`,
        description: docBlock.description,
        routePath,
        sourceFile: relative(root, file).replace(/\\/g, "/"),
        methods,
        segments: fsSegments,
        tag: fsSegments.length > 0 ? humanizeSegment(fsSegments[0]) : "General",
        parameters: buildPathParameters(fsSegments),
      } satisfies ApiReferenceRoute;
    })
    .filter((value): value is ApiReferenceRoute => Boolean(value))
    .sort((a, b) => a.routePath.localeCompare(b.routePath));
}

function createOperationId(route: ApiReferenceRoute, method: HttpMethod): string {
  return `${method.toLowerCase()}_${route.routePath.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
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

export function buildNextOpenApiDocument(config: DocsConfig): Record<string, unknown> {
  const routes = buildApiReferenceRoutes(config);
  const tags = Array.from(new Set(routes.map((route) => route.tag))).map((name) => ({
    name,
    description: `${name} endpoints`,
  }));

  return {
    openapi: "3.1.0",
    info: {
      title: "API Reference",
      description:
        config.metadata?.description ?? "Generated API reference from Next.js route handlers.",
      version: "0.0.0",
    },
    servers: [
      {
        url: "/",
      },
    ],
    tags,
    paths: buildOpenApiPaths(routes),
  };
}

function DropdownIcon({ current }: { current: "docs" | "api" }) {
  const label = current === "api" ? "</>" : "▣";

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: "1px solid color-mix(in srgb, var(--color-fd-border, #2a2a2a) 100%, transparent)",
        background: "color-mix(in srgb, var(--color-fd-card, #161616) 92%, transparent)",
        color: "var(--color-fd-primary, currentColor)",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-fd-border, #2a2a2a) 32%, transparent)",
        fontSize: 9,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function SwitcherOption({
  href,
  title,
  description,
  current,
}: {
  href: string;
  title: string;
  description: string;
  current: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr 14px",
        gap: 12,
        alignItems: "start",
        padding: "11px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: "inherit",
        background: current
          ? "color-mix(in srgb, var(--color-fd-primary, #3a7) 10%, transparent)"
          : "transparent",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          width: 20,
          height: 20,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: "1px solid color-mix(in srgb, var(--color-fd-border, #2a2a2a) 100%, transparent)",
          color: current
            ? "var(--color-fd-primary, currentColor)"
            : "var(--color-fd-muted-foreground, rgba(255,255,255,0.62))",
          background: "color-mix(in srgb, var(--color-fd-card, #161616) 92%, transparent)",
          boxShadow:
            "0 0 0 1px color-mix(in srgb, var(--color-fd-border, #2a2a2a) 32%, transparent)",
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        {title === "API Reference" ? "</>" : "▣"}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{title}</span>
        <span style={{ fontSize: 12, opacity: 0.62, lineHeight: 1.4 }}>{description}</span>
      </span>
      <span
        aria-hidden="true"
        style={{
          fontSize: 12,
          opacity: current ? 1 : 0,
          color: "var(--color-fd-primary, currentColor)",
          paddingTop: 2,
        }}
      >
        ✓
      </span>
    </a>
  );
}

function ApiReferenceSwitcher({
  docsUrl,
  apiUrl,
  current,
}: {
  docsUrl: string;
  apiUrl: string;
  current: "docs" | "api";
}) {
  const currentLabel = current === "api" ? "API Reference" : "Documentation";

  return (
    <details
      style={{
        position: "relative",
        marginBottom: 16,
        borderRadius: 14,
        border: "1px solid color-mix(in srgb, var(--color-fd-border, #2a2a2a) 100%, transparent)",
        background: "color-mix(in srgb, var(--color-fd-card, #141414) 94%, transparent)",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-fd-border, #2a2a2a) 32%, transparent)",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          padding: "11px 13px",
          background: "color-mix(in srgb, var(--color-fd-card, #202020) 96%, transparent)",
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-fd-border, #2a2a2a) 100%, transparent)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DropdownIcon current={current} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{currentLabel}</span>
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 11,
            opacity: 0.56,
            transform: "translateY(1px)",
          }}
        >
          ▿
        </span>
      </summary>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: 8,
          background: "color-mix(in srgb, var(--color-fd-card, #151515) 96%, transparent)",
        }}
      >
        <SwitcherOption
          href={docsUrl}
          title="Documentation"
          description="Markdown pages, guides, and concepts"
          current={current === "docs"}
        />
        <SwitcherOption
          href={apiUrl}
          title="API Reference"
          description="Scalar-powered route handler reference"
          current={current === "api"}
        />
      </div>
    </details>
  );
}

function mergeBanner(existing: unknown, next: ReactNode) {
  if (!existing) return next;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {existing as ReactNode}
      {next}
    </div>
  );
}

export function withNextApiReferenceBanner(config: DocsConfig): DocsConfig {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return config;

  const docsUrl = getDocsUrl(config);
  const apiUrl = `/${apiReference.path}`;
  const switcher = <ApiReferenceSwitcher docsUrl={docsUrl} apiUrl={apiUrl} current="docs" />;

  if (!config.sidebar || config.sidebar === true) {
    return {
      ...config,
      sidebar: {
        banner: switcher,
      },
    };
  }

  if (config.sidebar === false) return config;

  return {
    ...config,
    sidebar: {
      ...config.sidebar,
      banner: mergeBanner(config.sidebar.banner, switcher),
    },
  };
}

export function createNextApiReference(config: DocsConfig) {
  const apiReference = resolveApiReferenceConfig(config.apiReference);

  return ApiReference({
    pageTitle: applyTitleTemplate(config, "API Reference"),
    title: "API Reference",
    content: () => buildNextOpenApiDocument(config),
    theme: "deepSpace",
    layout: "modern",
    darkMode: getForcedMode(config) === "dark" ? true : undefined,
    forceDarkModeState: getForcedMode(config),
    hideDarkModeToggle: isThemeToggleHidden(config),
    customCss: buildScalarCustomCss(config),
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

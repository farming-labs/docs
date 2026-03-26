import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiReference } from "@scalar/nextjs-api-reference";
import type { DocsConfig } from "@farming-labs/docs";
import {
  buildApiReferenceOpenApiDocumentAsync,
  buildApiReferencePageTitle,
  buildApiReferenceScalarCss,
  resolveApiReferenceConfig,
} from "@farming-labs/docs/server";

export { resolveApiReferenceConfig };

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

function getNextAppDir(root: string): string {
  if (existsSync(join(root, "src", "app"))) return "src/app";
  return "app";
}

function normalizeRouteRoot(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, "");
  return normalized || "api";
}

function normalizeExcludeMatcher(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.(ts|tsx|js|jsx)$/i, "")
    .replace(/\/route$/i, "");
}

function getRoutePathBase(config: ReturnType<typeof resolveApiReferenceConfig>): string {
  const routeRoot = normalizeRouteRoot(config.routeRoot);

  if (routeRoot === "app" || routeRoot === "src/app") return "";
  if (routeRoot.startsWith("app/")) return `/${routeRoot.slice(4)}`;
  if (routeRoot.startsWith("src/app/")) return `/${routeRoot.slice(8)}`;

  return `/${routeRoot}`;
}

function resolveNextApiRouteRoot(
  root: string,
  config: ReturnType<typeof resolveApiReferenceConfig>,
) {
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

function shouldExcludeRoute(
  excludes: string[],
  routePath: string,
  relativeFile: string,
  relativeDir: string,
): boolean {
  if (excludes.length === 0) return false;

  const normalizedRoutePath = normalizeExcludeMatcher(routePath);
  const candidates = new Set([
    normalizedRoutePath,
    normalizeExcludeMatcher(routePath.replace(/^\/+/, "")),
    normalizeExcludeMatcher(relativeFile),
    normalizeExcludeMatcher(relativeDir),
  ]);

  return excludes.some((entry) => candidates.has(entry));
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
  for (const match of source.matchAll(METHOD_RE)) {
    methods.add(match[1] as HttpMethod);
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

function getForcedMode(config: DocsConfig): "light" | "dark" | undefined {
  const toggle = config.themeToggle;
  if (!toggle || typeof toggle !== "object") return undefined;

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
  const parameters: Array<Record<string, unknown>> = [];

  for (const segment of fsSegments) {
    const name = getPathParamName(segment);
    if (!name) continue;

    const optional = segment.startsWith("[[...");
    parameters.push({
      name,
      in: "path",
      required: !optional,
      description: optional
        ? `${humanizeSegment(name)} catch-all parameter.`
        : `${humanizeSegment(name)} path parameter.`,
      schema: {
        type: "string",
      },
    });
  }

  return parameters;
}

function buildApiReferenceRoutes(config: DocsConfig): ApiReferenceRoute[] {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return [];

  const root = process.cwd();
  const apiDir = resolveNextApiRouteRoot(root, apiReference);
  const routePathBase = getRoutePathBase(apiReference);
  const files = scanRouteFiles(apiDir);
  const excludes = apiReference.exclude;

  const routes: ApiReferenceRoute[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    const methods = extractMethods(source);
    if (methods.length === 0) continue;

    const relativeFile = relative(apiDir, file).replace(/\\/g, "/");
    const fsSegments = relativeFile.split("/").slice(0, -1).filter(Boolean);
    const relativeDir = fsSegments.join("/");
    const routeSegments = fsSegments.map(endpointSegmentFromFsSegment);
    const routePath =
      `${routePathBase}${routeSegments.length > 0 ? `/${routeSegments.join("/")}` : ""}` || "/";
    if (shouldExcludeRoute(excludes, routePath, relativeFile, relativeDir)) continue;

    const docBlock = extractDocBlock(source);
    const title =
      fsSegments.length > 0 ? humanizeSegment(fsSegments[fsSegments.length - 1]) : "Overview";

    routes.push({
      title,
      summary: docBlock.summary ?? `${title} endpoint`,
      description: docBlock.description,
      routePath,
      sourceFile: relative(root, file).replace(/\\/g, "/"),
      methods,
      segments: fsSegments,
      tag: fsSegments.length > 0 ? humanizeSegment(fsSegments[0]) : "General",
      parameters: buildPathParameters(fsSegments),
    });
  }

  return routes.sort((a, b) => a.routePath.localeCompare(b.routePath));
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
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (apiReference.specUrl) {
    return {
      openapi: "3.1.0",
      info: {
        title: "API Reference",
        description:
          "Remote OpenAPI specs are resolved at request time through createNextApiReference().",
        version: "0.0.0",
      },
      servers: [{ url: "/" }],
      tags: [],
      paths: {},
    };
  }

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

function DropdownIcon({ current, radius }: { current: "docs" | "api"; radius: string }) {
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
        borderRadius: radius,
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

function getApiReferenceSwitcherTheme(config: DocsConfig) {
  const themeName = config.theme?.name?.toLowerCase() ?? "";
  const isPixelBorder = themeName.includes("pixel-border");
  const isDarksharp = themeName.includes("darksharp");
  const isShiny = themeName.includes("shiny");
  const radius =
    config.theme?.ui?.radius ?? (isPixelBorder || isDarksharp ? "0px" : "var(--radius, 0.75rem)");

  return {
    cardRadius: radius,
    iconRadius: radius,
    backgroundImage: isPixelBorder
      ? "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--color-fd-border) 10%, transparent), color-mix(in srgb, var(--color-fd-border) 10%, transparent) 1px, transparent 1px, transparent 6px)"
      : undefined,
    boxShadow:
      isPixelBorder || isDarksharp
        ? "none"
        : isShiny
          ? "0 14px 40px color-mix(in srgb, var(--color-fd-border, #2a2a2a) 18%, transparent)"
          : "0 0 0 1px color-mix(in srgb, var(--color-fd-border, #2a2a2a) 32%, transparent)",
    titleStyle: {
      fontFamily: isPixelBorder
        ? "var(--fd-font-mono, var(--font-geist-mono, ui-monospace, monospace))"
        : undefined,
      textTransform: isPixelBorder ? ("uppercase" as const) : undefined,
      letterSpacing: isPixelBorder ? "0.08em" : undefined,
      fontSize: isPixelBorder ? 12 : 14,
    },
    descriptionStyle: {
      fontFamily: isPixelBorder
        ? "var(--fd-font-mono, var(--font-geist-mono, ui-monospace, monospace))"
        : undefined,
      textTransform: isPixelBorder ? ("uppercase" as const) : undefined,
      letterSpacing: isPixelBorder ? "0.04em" : undefined,
      fontSize: isPixelBorder ? 11 : 12,
      opacity: isPixelBorder ? 0.74 : 0.62,
    },
  };
}

function SwitcherOption({
  href,
  title,
  description,
  current,
  config,
}: {
  href: string;
  title: string;
  description: string;
  current: boolean;
  config: DocsConfig;
}) {
  const theme = getApiReferenceSwitcherTheme(config);

  return (
    <a
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr 14px",
        gap: 12,
        alignItems: "start",
        padding: "11px 12px",
        borderRadius: theme.cardRadius,
        textDecoration: "none",
        color: "inherit",
        background: current
          ? "color-mix(in srgb, var(--color-fd-primary, #3a7) 10%, transparent)"
          : "transparent",
        backgroundImage: !current ? theme.backgroundImage : undefined,
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
          borderRadius: theme.iconRadius,
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
        <span style={{ fontWeight: 600, lineHeight: 1.25, ...theme.titleStyle }}>{title}</span>
        <span style={{ lineHeight: 1.4, ...theme.descriptionStyle }}>{description}</span>
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
  config,
}: {
  docsUrl: string;
  apiUrl: string;
  current: "docs" | "api";
  config: DocsConfig;
}) {
  const currentLabel = current === "api" ? "API Reference" : "Documentation";
  const theme = getApiReferenceSwitcherTheme(config);
  const renderer = resolveApiReferenceConfig(config.apiReference).renderer;
  const apiDescription =
    renderer === "fumadocs"
      ? "Fumadocs OpenAPI explorer"
      : "Scalar-powered route handler reference";

  return (
    <details
      style={{
        position: "relative",
        marginBottom: 16,
        borderRadius: theme.cardRadius,
        border: "1px solid color-mix(in srgb, var(--color-fd-border, #2a2a2a) 100%, transparent)",
        background: "color-mix(in srgb, var(--color-fd-card, #141414) 94%, transparent)",
        boxShadow: theme.boxShadow,
        overflow: "hidden",
        backgroundImage: theme.backgroundImage,
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
          <DropdownIcon current={current} radius={theme.iconRadius} />
          <span style={{ fontWeight: 600, ...theme.titleStyle }}>{currentLabel}</span>
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
          config={config}
        />
        <SwitcherOption
          href={apiUrl}
          title="API Reference"
          description={apiDescription}
          current={current === "api"}
          config={config}
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
  if (config.sidebar === false) return config;

  const docsUrl = getDocsUrl(config);
  const apiUrl = `/${apiReference.path}`;
  const switcher = (
    <ApiReferenceSwitcher docsUrl={docsUrl} apiUrl={apiUrl} current="docs" config={config} />
  );

  if (!config.sidebar || config.sidebar === true) {
    return {
      ...config,
      sidebar: {
        banner: switcher,
      },
    };
  }

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

  return async () => {
    if (!apiReference.enabled || apiReference.renderer !== "scalar") {
      return new Response("Not Found", {
        status: 404,
      });
    }

    const document = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "next",
      rootDir: process.cwd(),
    });

    return ApiReference({
      pageTitle: buildApiReferencePageTitle(config, "API Reference"),
      title: "API Reference",
      content: document,
      theme: "deepSpace",
      layout: "modern",
      darkMode: getForcedMode(config) === "dark" ? true : undefined,
      forceDarkModeState: getForcedMode(config),
      hideDarkModeToggle: isThemeToggleHidden(config),
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
    })();
  };
}

export function createNextApiReferenceMetadata(config: DocsConfig): Metadata {
  return {
    title: buildApiReferencePageTitle(config, "API Reference"),
    description: config.metadata?.description ?? "Interactive API reference.",
  };
}

export function createNextApiReferencePage(config: DocsConfig) {
  const apiReference = resolveApiReferenceConfig(config.apiReference);

  return async function NextApiReferencePage() {
    if (!apiReference.enabled || apiReference.renderer !== "fumadocs") {
      notFound();
    }

    const [{ createOpenAPI }, { createAPIPage }] = await Promise.all([
      import("fumadocs-openapi/server"),
      import("fumadocs-openapi/ui"),
    ]);

    const server = createOpenAPI({
      disableCache: true,
      input: async () => ({
        "openapi.json": await buildApiReferenceOpenApiDocumentAsync(config, {
          framework: "next",
          rootDir: process.cwd(),
        }),
      }),
    });
    const ApiPage = createAPIPage(server);

    return <ApiPage document="openapi.json" />;
  };
}

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ApiReference } from "@scalar/nextjs-api-reference";
import type { DocsConfig } from "@farming-labs/docs";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  buildApiReferenceOpenApiDocumentAsync,
  buildApiReferencePageTitle,
  buildApiReferenceScalarCss,
  resolveApiReferenceConfig,
  resolveApiReferenceRenderer,
} from "@farming-labs/docs/server";
import DocsClientCallbacks from "./client-callbacks.js";

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

export interface NextApiReferenceSourceState {
  apiReference: ReturnType<typeof resolveApiReferenceConfig>;
  document: Record<string, unknown>;
  info: {
    title: string;
    description?: string;
  };
  pages: Array<{ url: string } & Record<string, any>>;
  server: any;
  source: {
    getPage: (slug?: string[]) => any;
    getPages: () => Array<any>;
    getPageTree: () => any;
  };
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

function slugifyApiReferencePageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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

function getOriginFromRequest(request?: Request): string | undefined {
  if (!request) return undefined;

  try {
    return new URL(request.url).origin;
  } catch {
    return undefined;
  }
}

function getForwardedHeaderValue(value: string | null): string | undefined {
  if (!value) return undefined;
  const first = value
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean);
  return first || undefined;
}

async function getOriginFromNextHeaders(): Promise<string | undefined> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const host =
    getForwardedHeaderValue(headerList.get("x-forwarded-host")) ??
    getForwardedHeaderValue(headerList.get("host"));

  if (!host) return undefined;

  const protocol = getForwardedHeaderValue(headerList.get("x-forwarded-proto")) ?? "https";
  return `${protocol}://${host}`;
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
          "Remote OpenAPI specs are resolved at request time through the Next.js API reference renderer.",
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
  const isApi = current === "api";

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
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {isApi ? "</>" : "▣"}
    </span>
  );
}

function ChevronStack() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        color: "var(--color-fd-muted-foreground, rgba(255,255,255,0.65))",
      }}
    >
      <svg width="11" height="7" viewBox="0 0 10 6" fill="none">
        <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <svg width="11" height="7" viewBox="0 0 10 6" fill="none">
        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
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
        : "var(--fd-font-sans, var(--font-geist-sans, system-ui, sans-serif))",
      textTransform: isPixelBorder ? ("uppercase" as const) : undefined,
      letterSpacing: isPixelBorder ? "0.08em" : undefined,
      fontSize: isPixelBorder ? 12 : 13,
    },
    descriptionStyle: {
      fontFamily: isPixelBorder
        ? "var(--fd-font-mono, var(--font-geist-mono, ui-monospace, monospace))"
        : "var(--fd-font-sans, var(--font-geist-sans, system-ui, sans-serif))",
      textTransform: isPixelBorder ? ("uppercase" as const) : undefined,
      letterSpacing: isPixelBorder ? "0.04em" : undefined,
      fontSize: isPixelBorder ? 11 : 11,
      opacity: isPixelBorder ? 0.74 : 0.72,
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
        gridTemplateColumns: "20px minmax(0, 1fr)",
        gap: 11,
        alignItems: "center",
        padding: "11px 12px",
        borderRadius: "0.625rem",
        textDecoration: "none",
        color: "inherit",
        background: current
          ? "linear-gradient(90deg, color-mix(in srgb, var(--color-fd-primary, #facc15) 20%, transparent), color-mix(in srgb, var(--color-fd-primary, #facc15) 14%, transparent))"
          : "transparent",
        backgroundImage: current ? theme.backgroundImage : undefined,
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
      <span style={{ display: "flex", minWidth: 0, flexDirection: "column", gap: 2.5 }}>
        <span style={{ fontWeight: 600, lineHeight: 1.2, ...theme.titleStyle }}>{title}</span>
        <span style={{ lineHeight: 1.4, ...theme.descriptionStyle }}>{description}</span>
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
          padding: "10px 13px",
          background: "color-mix(in srgb, var(--color-fd-card, #202020) 96%, transparent)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DropdownIcon current={current} radius={theme.iconRadius} />
          <span style={{ fontWeight: 600, ...theme.titleStyle }}>{currentLabel}</span>
        </span>
        <ChevronStack />
      </summary>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "8px 8px 9px",
          background: "color-mix(in srgb, var(--color-fd-card, #151515) 96%, transparent)",
        }}
      >
        <SwitcherOption
          href={docsUrl}
          title="Documentation"
          description="Guides, concepts, and MDX pages"
          current={current === "docs"}
          config={config}
        />
        <SwitcherOption
          href={apiUrl}
          title="API Reference"
          description="Endpoints, schemas, and examples"
          current={current === "api"}
          config={config}
        />
      </div>
    </details>
  );
}

function getExistingSidebarBanner(config: DocsConfig): unknown {
  if (!config.sidebar || config.sidebar === true) return undefined;
  return config.sidebar.banner;
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
  const existingBanner = getExistingSidebarBanner(config);
  const banner = mergeBanner(existingBanner, switcher);

  if (!config.sidebar || config.sidebar === true) {
    return {
      ...config,
      sidebar: {
        banner,
      },
    };
  }

  return {
    ...config,
    sidebar: {
      ...config.sidebar,
      banner,
    },
  };
}

export function createNextApiReference(config: DocsConfig) {
  const apiReference = resolveApiReferenceConfig(config.apiReference);

  return async (request?: Request) => {
    if (!apiReference.enabled) {
      return new Response("Not Found", {
        status: 404,
      });
    }

    const document = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "next",
      rootDir: process.cwd(),
      baseUrl: getOriginFromRequest(request),
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

function getOpenApiInfo(document: Record<string, unknown>): {
  title: string;
  description?: string;
} {
  const info =
    document.info && typeof document.info === "object" && !Array.isArray(document.info)
      ? (document.info as Record<string, unknown>)
      : {};

  return {
    title: typeof info.title === "string" && info.title.trim() ? info.title : "API Reference",
    description:
      typeof info.description === "string" && info.description.trim()
        ? info.description
        : undefined,
  };
}

export function createNextApiReferencePage(config: DocsConfig) {
  return async function NextApiReferencePage(props?: {
    params?: Promise<{ slug?: string[] }> | { slug?: string[] };
  }) {
    const [{ createAPIPage }, { DocsBody, DocsDescription, DocsPage, DocsTitle }] =
      await Promise.all([
        import("fumadocs-openapi/ui"),
        import("fumadocs-ui/layouts/notebook/page"),
      ]);
    const { info, pages, server, source } = await getNextApiReferenceSourceState(config);
    const resolvedParams = props?.params ? await props.params : undefined;
    const slug = resolvedParams?.slug ?? [];

    if (pages.length === 0) {
      return (
        <DocsPage full>
          <DocsTitle>{info.title}</DocsTitle>
          <DocsDescription>{info.description}</DocsDescription>
          <DocsBody>
            <div className="rounded-xl border border-fd-border bg-fd-card p-6 text-sm text-fd-muted-foreground">
              No operations were found in the OpenAPI document.
            </div>
          </DocsBody>
        </DocsPage>
      );
    }

    if (slug.length === 0) {
      redirect(pages[0].url);
    }

    const page = source.getPage(slug);
    if (!page || typeof page.data.getAPIPageProps !== "function") {
      notFound();
    }
    const APIPage = createAPIPage(server);
    const currentPageIndex = pages.findIndex((entry) => entry.url === page.url);
    const previousPage = currentPageIndex > 0 ? pages[currentPageIndex - 1] : undefined;
    const nextPage =
      currentPageIndex >= 0 && currentPageIndex < pages.length - 1
        ? pages[currentPageIndex + 1]
        : undefined;

    return (
      <DocsPage
        toc={page.data.toc}
        full
        footer={{ enabled: false }}
        className="fd-api-reference-page"
      >
        <DocsTitle>{page.data.title ?? info.title}</DocsTitle>
        <DocsDescription>
          {typeof page.data.description === "string" && page.data.description.trim()
            ? page.data.description
            : info.description}
        </DocsDescription>
        <DocsBody>
          <APIPage {...page.data.getAPIPageProps()} />
        </DocsBody>
        {previousPage || nextPage ? (
          <nav className="fd-api-reference-pagination" aria-label="API reference pagination">
            {previousPage ? (
              <a
                href={previousPage.url}
                className="fd-api-reference-pagination-item"
                data-direction="previous"
              >
                <span className="fd-api-reference-pagination-label">Previous</span>
                <span className="fd-api-reference-pagination-title">
                  {previousPage.data?.title ?? previousPage.url}
                </span>
                <span className="fd-api-reference-pagination-description">
                  {previousPage.data?.description ?? "Previous API operation"}
                </span>
              </a>
            ) : (
              <div className="fd-api-reference-pagination-spacer" aria-hidden="true" />
            )}
            {nextPage ? (
              <a
                href={nextPage.url}
                className="fd-api-reference-pagination-item"
                data-direction="next"
              >
                <span className="fd-api-reference-pagination-label">Next</span>
                <span className="fd-api-reference-pagination-title">
                  {nextPage.data?.title ?? nextPage.url}
                </span>
                <span className="fd-api-reference-pagination-description">
                  {nextPage.data?.description ?? "Next API operation"}
                </span>
              </a>
            ) : (
              <div className="fd-api-reference-pagination-spacer" aria-hidden="true" />
            )}
          </nav>
        ) : null}
      </DocsPage>
    );
  };
}

export function createNextApiReferenceLayout(config: DocsConfig) {
  return async function NextApiReferenceLayout(props: { children: React.ReactNode }) {
    const { DocsLayout } = await import("fumadocs-ui/layouts/notebook");
    const { apiReference, source } = await getNextApiReferenceSourceState(config);
    const docsUrl = getDocsUrl(config);
    const apiUrl = `/${apiReference.path}`;
    const banner = mergeBanner(
      getExistingSidebarBanner(config),
      <ApiReferenceSwitcher docsUrl={docsUrl} apiUrl={apiUrl} current="api" config={config} />,
    );

    return (
      <div className="fd-api-reference-route">
        <DocsClientCallbacks />
        <DocsLayout
          tree={source.getPageTree()}
          sidebar={{ banner }}
          nav={{
            title: (config.nav?.title as ReactNode | undefined) ?? "Docs",
            url: getDocsUrl(config),
          }}
        >
          {props.children}
        </DocsLayout>
      </div>
    );
  };
}

export async function getNextApiReferenceSourceState(
  config: DocsConfig,
): Promise<NextApiReferenceSourceState> {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  const [{ createOpenAPI, openapiPlugin, openapiSource }, { loader }] = await Promise.all([
    import("fumadocs-openapi/server"),
    import("fumadocs-core/source"),
  ]);
  const baseUrl = await getOriginFromNextHeaders();
  const document = await buildApiReferenceOpenApiDocumentAsync(config, {
    framework: "next",
    rootDir: process.cwd(),
    baseUrl,
  });

  const server = createOpenAPI({
    input: async () => ({
      main: document as any,
    }),
  });
  const info = getOpenApiInfo(document);
  const source = loader(
    await openapiSource(server, {
      per: "operation",
      groupBy: "tag",
      name(output, dereferenced) {
        if (output.type !== "operation") {
          return slugifyApiReferencePageName(output.item.name);
        }

        const pathItem = dereferenced.paths?.[output.item.path];
        const operation = pathItem?.[output.item.method];
        const summary =
          typeof operation?.summary === "string" && operation.summary.trim()
            ? operation.summary
            : typeof operation?.operationId === "string" && operation.operationId.trim()
              ? operation.operationId
              : `${output.item.method} ${output.item.path}`;

        return slugifyApiReferencePageName(summary);
      },
    }),
    {
      baseUrl: `/${apiReference.path}`,
      plugins: [openapiPlugin()],
    },
  );

  return {
    apiReference,
    document,
    info,
    pages: source.getPages(),
    server,
    source,
  };
}

export function getNextApiReferenceMode(config: DocsConfig): "fumadocs" | "scalar" {
  return resolveApiReferenceRenderer(config.apiReference, "next");
}

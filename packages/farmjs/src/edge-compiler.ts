import path from "node:path";
import { pathToFileURL } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import type {
  DocsConfig,
  DocsSearchSourcePage,
  PerformDocsSearchOptions,
} from "@farming-labs/docs";
import { createElement, type ComponentType } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { loadDocsContent } from "./content.js";
import { FarmDocsPageRenderer } from "./page.js";
import { FARM_DOCS_NAVIGATION_HEADER } from "./runtime.js";
import { createFarmDocsRuntimeHandler } from "./server.js";
import { createFarmDocsMdxCompileOptions } from "./vite.js";

const FARM_DOCS_COMPILED_ORIGIN = "https://farm-docs-build.invalid";
const FARM_DOCS_BROWSER_CSS_PATH = "/__farm_docs/browser.css";

interface FarmDocsCompiledResponse {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
}

interface FarmDocsCompiledManifest {
  protocol: 1;
  originPlaceholder: string;
  entry: string;
  apiPath: string;
  routes: Record<string, FarmDocsCompiledResponse>;
  navigation: Record<string, FarmDocsCompiledResponse>;
  api: {
    static: Record<string, FarmDocsCompiledResponse>;
    markdown: Record<string, FarmDocsCompiledResponse>;
    empty: FarmDocsCompiledResponse;
    post: FarmDocsCompiledResponse;
    search: {
      pages: DocsSearchSourcePage[];
      search: PerformDocsSearchOptions["search"];
      siteTitle: string;
      limit?: number;
    };
  };
}

export interface CompileFarmDocsEdgeManifestOptions {
  rootDir: string;
  clientEntry: string;
  stylesheets: string[];
}

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/g, "") || "/";
}

function normalizePublicPath(value: unknown, fallback: string): string {
  const resolved = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (resolved === "/") return resolved;
  return `/${resolved.replace(/^\/+|\/+$/g, "")}`;
}

function sanitizeCompiledValue(value: string, absolutePaths: readonly string[]): string {
  let sanitized = value;
  for (const absolutePath of absolutePaths) {
    if (!absolutePath) continue;
    sanitized = sanitized.split(absolutePath).join(".");
    sanitized = sanitized.split(absolutePath.replace(/\\/g, "/")).join(".");
    sanitized = sanitized.split(absolutePath.replace(/\//g, "\\")).join(".");
  }
  return sanitized;
}

async function compileResponse(
  response: Response,
  absolutePaths: readonly string[],
): Promise<FarmDocsCompiledResponse> {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()).map(([key, value]) => [
      key,
      sanitizeCompiledValue(value, absolutePaths),
    ]),
    body: sanitizeCompiledValue(await response.text(), absolutePaths),
  };
}

async function compileRoute(
  routes: Record<string, FarmDocsCompiledResponse>,
  pathname: string,
  handler: (request: Request) => Promise<Response | null>,
  absolutePaths: readonly string[],
  init?: RequestInit,
): Promise<Response | null> {
  const request = new Request(`${FARM_DOCS_COMPILED_ORIGIN}${pathname}`, init);
  const response = await handler(request);
  if (!response) return null;
  routes[normalizePathname(pathname)] = await compileResponse(response.clone(), absolutePaths);
  return response;
}

function getSiteTitle(config: Record<string, unknown>): string {
  const nav = config.nav;
  return nav && typeof nav === "object" && "title" in nav
    ? String((nav as { title?: unknown }).title || "Documentation")
    : "Documentation";
}

function getSearchLimit(search: DocsConfig["search"]): number | undefined {
  if (!search || typeof search !== "object" || !("maxResults" in search)) return undefined;
  const limit = Number((search as { maxResults?: unknown }).maxResults);
  return Number.isFinite(limit) ? limit : undefined;
}

function isConfigFeatureEnabled(value: unknown, defaultEnabled = false): boolean {
  if (value === false) return false;
  if (value === true) return true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const enabled = (value as { enabled?: unknown }).enabled;
    return enabled === false ? false : defaultEnabled || enabled === true;
  }
  return defaultEnabled;
}

function assertSerializableEdgeConfig(config: DocsConfig & Record<string, unknown>): void {
  const search = config.search;
  if (
    search &&
    typeof search === "object" &&
    "provider" in search &&
    search.provider === "custom"
  ) {
    throw new Error(
      "@farming-labs/farmjs cannot serialize a custom docs search adapter into an edge deployment. " +
        'Use the built-in "simple" provider, a serializable hosted provider, or a Node target.',
    );
  }

  const runtimeOnlyFeatures = [
    isConfigFeatureEnabled(config.ai) ? "ai" : null,
    isConfigFeatureEnabled(config.mcp, true) ? "mcp" : null,
    isConfigFeatureEnabled(config.feedback) ? "feedback" : null,
    isConfigFeatureEnabled(config.analytics) ? "analytics" : null,
    isConfigFeatureEnabled(config.telemetry, true) ? "telemetry" : null,
    isConfigFeatureEnabled(config.observability) ? "observability" : null,
    config.i18n ? "i18n" : null,
  ].filter((value): value is string => Boolean(value));

  if (runtimeOnlyFeatures.length > 0) {
    throw new Error(
      `@farming-labs/farmjs cannot precompile runtime-only docs features for an edge deployment: ${runtimeOnlyFeatures.join(
        ", ",
      )}. Use a Node target or disable those features for the edge build.`,
    );
  }
}

/**
 * Compile the official Farm adapter into Farm core's renderer-neutral edge
 * manifest. This module runs during the Node build and is never imported by
 * the generated Worker.
 */
export async function compileFarmDocsEdgeManifest(
  config: Record<string, unknown>,
  options: CompileFarmDocsEdgeManifestOptions,
): Promise<FarmDocsCompiledManifest> {
  const docsConfig = config as DocsConfig & Record<string, unknown>;
  assertSerializableEdgeConfig(docsConfig);

  const entry = String(config.entry || "docs").replace(/^\/+|\/+$/g, "") || "docs";
  const docsPath = normalizePublicPath(config.docsPath, `/${entry}`);
  const cloud = config.cloud;
  const apiPath = normalizePublicPath(
    cloud && typeof cloud === "object" && "apiRoute" in cloud
      ? (cloud as { apiRoute?: unknown }).apiRoute
      : undefined,
    "/api/docs",
  );
  const rawContentDir = String(config.contentDir || entry);
  const contentDir = path.isAbsolute(rawContentDir)
    ? rawContentDir
    : path.resolve(options.rootDir, rawContentDir);
  const absolutePaths = [path.resolve(options.rootDir), path.resolve(contentDir)];
  const pages = loadDocsContent(contentDir, entry).sort((left, right) =>
    left.url.localeCompare(right.url),
  );
  const pageComponents = new Map<string, ComponentType<any>>();
  const compileOptions = createFarmDocsMdxCompileOptions();
  for (const page of pages) {
    if (!page.sourcePath) {
      throw new Error(
        `@farming-labs/farmjs could not resolve the source for docs page ${page.url}.`,
      );
    }
    const module = await evaluate(
      { value: page.rawContent, path: page.sourcePath },
      {
        ...jsxRuntime,
        ...compileOptions,
        baseUrl: pathToFileURL(page.sourcePath),
      },
    );
    pageComponents.set(page.slug, module.default as ComponentType<any>);
  }
  const handler = createFarmDocsRuntimeHandler(docsConfig, {
    rootDir: options.rootDir,
    clientEntry: options.clientEntry,
    stylesheets: options.stylesheets,
    loadReactModule: async () => ({
      FarmDocsPage: ({ config: pageConfig, data }: { config: DocsConfig; data: any }) =>
        createElement(FarmDocsPageRenderer, {
          config: pageConfig,
          data,
          Content: pageComponents.get(String(data.slug || "")),
        }),
    }),
  });
  const routes: Record<string, FarmDocsCompiledResponse> = {};
  const navigation: Record<string, FarmDocsCompiledResponse> = {};
  const markdown: Record<string, FarmDocsCompiledResponse> = {};

  for (const page of pages) {
    const pathname = page.slug ? `${docsPath}/${page.slug}` : docsPath;
    await compileRoute(routes, pathname, handler, absolutePaths);
    await compileRoute(navigation, pathname, handler, absolutePaths, {
      headers: { [FARM_DOCS_NAVIGATION_HEADER]: "1" },
    });
    await compileRoute(routes, `${pathname}.md`, handler, absolutePaths);

    const response = await handler(
      new Request(
        `${FARM_DOCS_COMPILED_ORIGIN}${apiPath}?format=markdown&path=${encodeURIComponent(page.slug)}`,
      ),
    );
    if (response) markdown[page.slug] = await compileResponse(response, absolutePaths);
  }

  await compileRoute(routes, FARM_DOCS_BROWSER_CSS_PATH, handler, absolutePaths);

  const publicCandidates = [
    "/llms.txt",
    "/llms-full.txt",
    "/.well-known/llms.txt",
    "/.well-known/llms-full.txt",
    "/AGENTS.md",
    "/agent.md",
    "/.well-known/AGENTS.md",
    "/SKILL.md",
    "/skill.md",
    "/.well-known/SKILL.md",
    "/.well-known/skill.md",
    "/.well-known/agent.json",
    "/.well-known/agent",
    "/.well-known/agent-card.json",
    "/.well-known/api-catalog",
    "/sitemap.xml",
    "/sitemap.md",
    "/robots.txt",
    `${docsPath}/sitemap.md`,
  ];
  for (const pathname of publicCandidates) {
    if (!routes[normalizePathname(pathname)]) {
      await compileRoute(routes, pathname, handler, absolutePaths);
    }
  }

  const staticFormats = [
    "config",
    "skill",
    "agents",
    "agent-spec",
    "diagnostics",
    "llms",
    "llms-full",
    "sitemap-md",
    "sitemap-xml",
    "robots",
  ];
  const staticResponses: Record<string, FarmDocsCompiledResponse> = {};
  for (const format of staticFormats) {
    const response = await handler(
      new Request(`${FARM_DOCS_COMPILED_ORIGIN}${apiPath}?format=${format}`),
    );
    if (response) staticResponses[format] = await compileResponse(response, absolutePaths);
  }

  const emptyResponse = await handler(new Request(`${FARM_DOCS_COMPILED_ORIGIN}${apiPath}`));
  const postResponse =
    (await handler(new Request(`${FARM_DOCS_COMPILED_ORIGIN}${apiPath}`, { method: "POST" }))) ??
    new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  if (!emptyResponse) {
    throw new Error("@farming-labs/farmjs could not compile its docs API responses.");
  }

  const search = docsConfig.search ?? true;
  const limit = getSearchLimit(docsConfig.search);
  return {
    protocol: 1,
    originPlaceholder: FARM_DOCS_COMPILED_ORIGIN,
    entry: docsPath,
    apiPath,
    routes,
    navigation,
    api: {
      static: staticResponses,
      markdown,
      empty: await compileResponse(emptyResponse, absolutePaths),
      post: await compileResponse(postResponse, absolutePaths),
      search: {
        pages: pages.map((page) => ({
          ...page,
          sourcePath: `farm-docs:${page.slug || "index"}`,
        })),
        search,
        siteTitle: getSiteTitle(config),
        ...(limit === undefined ? {} : { limit }),
      },
    },
  };
}

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import { performDocsSearch } from "./search.js";
import type {
  DocsMcpConfig,
  DocsSearchConfig,
  DocsSearchSourcePage,
  McpDocsSearchConfig,
  OrderingItem,
} from "./types.js";

export interface DocsMcpPage {
  slug: string;
  url: string;
  title: string;
  description?: string;
  icon?: string;
  content: string;
  rawContent?: string;
}

export interface DocsMcpPageNode {
  type: "page";
  name: string;
  url: string;
  icon?: string;
  description?: string;
}

export interface DocsMcpFolderNode {
  type: "folder";
  name: string;
  icon?: string;
  index?: DocsMcpPageNode;
  children: DocsMcpNavigationNode[];
}

export type DocsMcpNavigationNode = DocsMcpPageNode | DocsMcpFolderNode;

export interface DocsMcpNavigationTree {
  name: string;
  children: DocsMcpNavigationNode[];
}

export interface DocsMcpSource {
  entry?: string;
  siteTitle?: string;
  getPages(locale?: string): DocsMcpPage[] | Promise<DocsMcpPage[]>;
  getNavigation(locale?: string): DocsMcpNavigationTree | Promise<DocsMcpNavigationTree>;
}

export interface DocsMcpResolvedConfig {
  enabled: boolean;
  route: string;
  name: string;
  version: string;
  tools: {
    listPages: boolean;
    readPage: boolean;
    searchDocs: boolean;
    getNavigation: boolean;
  };
}

export interface DocsMcpHttpHandlers {
  GET: (context: { request: Request }) => Promise<Response>;
  POST: (context: { request: Request }) => Promise<Response>;
  DELETE: (context: { request: Request }) => Promise<Response>;
}

interface CreateDocsMcpServerOptions {
  source: DocsMcpSource;
  mcp?: boolean | DocsMcpConfig;
  search?: boolean | DocsSearchConfig;
  defaultName?: string;
  defaultVersion?: string;
}

interface CreateFilesystemDocsMcpSourceOptions {
  rootDir?: string;
  entry?: string;
  contentDir?: string;
  siteTitle?: string;
  ordering?: "alphabetical" | "numeric" | OrderingItem[];
}

interface ScannedDocsMcpPage extends DocsMcpPage {
  order: number;
}

const DEFAULT_MCP_ROUTE = "/api/docs/mcp";
const DEFAULT_MCP_VERSION = "0.0.0";
const DEFAULT_MCP_NAME = "@farming-labs/docs";

const searchDocsInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(25).optional(),
  locale: z.string().min(1).optional(),
});

const readPageInputSchema = z.object({
  path: z.string().min(1),
  locale: z.string().min(1).optional(),
});

const listPagesInputSchema = z.object({
  locale: z.string().min(1).optional(),
});

const getNavigationInputSchema = z.object({
  locale: z.string().min(1).optional(),
});

export function normalizeDocsMcpRoute(route?: string): string {
  if (!route || route.trim().length === 0) return DEFAULT_MCP_ROUTE;

  const normalized = `/${route}`.replace(/\/+/g, "/");
  return normalized !== "/" ? normalized.replace(/\/+$/, "") : DEFAULT_MCP_ROUTE;
}

export function resolveDocsMcpConfig(
  mcp?: boolean | DocsMcpConfig,
  defaults: {
    defaultName?: string;
    defaultVersion?: string;
    defaultRoute?: string;
  } = {},
): DocsMcpResolvedConfig {
  if (!mcp) {
    return {
      enabled: false,
      route: normalizeDocsMcpRoute(defaults.defaultRoute),
      name: defaults.defaultName ?? DEFAULT_MCP_NAME,
      version: defaults.defaultVersion ?? DEFAULT_MCP_VERSION,
      tools: {
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
      },
    };
  }

  const config = typeof mcp === "object" ? mcp : {};

  return {
    enabled: typeof mcp === "boolean" ? mcp : (config.enabled ?? true),
    route: normalizeDocsMcpRoute(config.route ?? defaults.defaultRoute),
    name: config.name ?? defaults.defaultName ?? DEFAULT_MCP_NAME,
    version: config.version ?? defaults.defaultVersion ?? DEFAULT_MCP_VERSION,
    tools: {
      listPages: config.tools?.listPages ?? true,
      readPage: config.tools?.readPage ?? true,
      searchDocs: config.tools?.searchDocs ?? true,
      getNavigation: config.tools?.getNavigation ?? true,
    },
  };
}

export function createFilesystemDocsMcpSource(
  options: CreateFilesystemDocsMcpSourceOptions = {},
): DocsMcpSource {
  const rootDir = options.rootDir ?? process.cwd();
  const entry = normalizePathSegment(options.entry ?? "docs") || "docs";
  const contentDir = options.contentDir ?? entry;
  const contentDirAbs = path.resolve(rootDir, contentDir);
  const cache = new Map<string, ScannedDocsMcpPage[]>();
  const navigationCache = new Map<string, DocsMcpNavigationTree>();

  function getPages(): ScannedDocsMcpPage[] {
    const cached = cache.get("__default__");
    if (cached) return cached;

    const pages = scanFilesystemDocsPages(contentDirAbs, entry);
    cache.set("__default__", pages);
    return pages;
  }

  function getNavigation(): DocsMcpNavigationTree {
    const cached = navigationCache.get("__default__");
    if (cached) return cached;

    const tree = buildNavigationTreeFromPages(
      getPages(),
      options.siteTitle ?? "Documentation",
      options.ordering,
    );
    navigationCache.set("__default__", tree);
    return tree;
  }

  return {
    entry,
    siteTitle: options.siteTitle ?? "Documentation",
    getPages,
    getNavigation,
  };
}

export async function createDocsMcpServer(options: CreateDocsMcpServerOptions): Promise<McpServer> {
  const resolved = resolveDocsMcpConfig(options.mcp, {
    defaultName: options.defaultName ?? options.source.siteTitle ?? DEFAULT_MCP_NAME,
    defaultVersion: options.defaultVersion,
  });
  const toolSearchConfig = resolveMcpToolSearchConfig(options.search, resolved.route);

  const server = new McpServer({
    name: resolved.name,
    version: resolved.version,
  });

  const defaultPages = dedupePages(await options.source.getPages());
  const defaultTree = await options.source.getNavigation();

  server.registerResource(
    "docs-navigation",
    "docs://navigation",
    {
      title: "Docs Navigation",
      description: "Structured navigation tree for the documentation site.",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [
        {
          uri: "docs://navigation",
          mimeType: "text/plain",
          text: renderNavigationTree(defaultTree),
        },
      ],
    }),
  );

  for (const page of defaultPages) {
    const resourceUri = toPageResourceUri(page.url);
    server.registerResource(
      `page-${slugToKey(page.slug)}`,
      resourceUri,
      {
        title: page.title,
        description: page.description,
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri: resourceUri,
            mimeType: "text/markdown",
            text: renderPageDocument(page),
          },
        ],
      }),
    );
  }

  if (resolved.tools.listPages) {
    server.registerTool(
      "list_pages",
      {
        title: "List docs pages",
        description: "List the known documentation pages with titles, slugs, and URLs.",
        inputSchema: listPagesInputSchema,
        annotations: { readOnlyHint: true },
      },
      async ({ locale }) => {
        const pages = toPageSummaries(dedupePages(await options.source.getPages(locale)));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ pages }, null, 2),
            },
          ],
        };
      },
    );
  }

  if (resolved.tools.getNavigation) {
    server.registerTool(
      "get_navigation",
      {
        title: "Get docs navigation",
        description: "Return the documentation navigation tree for the current docs site.",
        inputSchema: getNavigationInputSchema,
        annotations: { readOnlyHint: true },
      },
      async ({ locale }) => {
        const tree = await options.source.getNavigation(locale);
        return {
          content: [
            {
              type: "text",
              text: renderNavigationTree(tree),
            },
          ],
        };
      },
    );
  }

  if (resolved.tools.searchDocs) {
    server.registerTool(
      "search_docs",
      {
        title: "Search documentation",
        description: "Search the docs by keyword across titles, descriptions, and page content.",
        inputSchema: searchDocsInputSchema,
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit, locale }) => {
        const pages = dedupePages(await options.source.getPages(locale));
        const results = await performDocsSearch({
          pages: toSearchSourcePages(pages),
          query,
          search: toolSearchConfig ?? true,
          locale,
          siteTitle: options.source.siteTitle,
          limit: limit ?? 10,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ results }, null, 2),
            },
          ],
        };
      },
    );
  }

  if (resolved.tools.readPage) {
    server.registerTool(
      "read_page",
      {
        title: "Read a docs page",
        description: "Read a documentation page by slug or URL path.",
        inputSchema: readPageInputSchema,
        annotations: { readOnlyHint: true },
      },
      async ({ path: requestedPath, locale }) => {
        const pages = dedupePages(await options.source.getPages(locale));
        const page = findDocsPage(pages, requestedPath, options.source.entry);

        if (!page) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: `No docs page matched "${requestedPath}".`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: renderPageDocument(page),
            },
          ],
        };
      },
    );
  }

  return server;
}

export function createDocsMcpHttpHandler(options: CreateDocsMcpServerOptions): DocsMcpHttpHandlers {
  const resolved = resolveDocsMcpConfig(options.mcp, {
    defaultName: options.defaultName ?? options.source.siteTitle ?? DEFAULT_MCP_NAME,
    defaultVersion: options.defaultVersion,
  });

  if (!resolved.enabled) {
    return {
      GET: async () =>
        createJsonErrorResponse(
          404,
          "MCP is not enabled. Set `mcp: { enabled: true }` in docs.config to enable it.",
        ),
      POST: async () =>
        createJsonErrorResponse(
          404,
          "MCP is not enabled. Set `mcp: { enabled: true }` in docs.config to enable it.",
        ),
      DELETE: async () =>
        createJsonErrorResponse(
          404,
          "MCP is not enabled. Set `mcp: { enabled: true }` in docs.config to enable it.",
        ),
    };
  }

  const sessions = new Map<
    string,
    {
      server: McpServer;
      transport: WebStandardStreamableHTTPServerTransport;
    }
  >();

  async function createSession() {
    const server = await createDocsMcpServer(options);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized(sessionId) {
        sessions.set(sessionId, { server, transport });
      },
      async onsessionclosed(sessionId) {
        const session = sessions.get(sessionId);
        sessions.delete(sessionId);
        await session?.server.close().catch(() => undefined);
      },
    });

    await server.connect(transport);
    return { server, transport };
  }

  async function handle(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();
    const sessionId =
      request.headers.get("mcp-session-id") ?? request.headers.get("Mcp-Session-Id");
    const existing = sessionId ? sessions.get(sessionId) : undefined;

    let parsedBody: unknown;
    if (method === "POST") {
      try {
        parsedBody = await request.clone().json();
      } catch {
        parsedBody = undefined;
      }
    }

    const initializeRequest = method === "POST" && parsedBody && isInitializeRequest(parsedBody);

    if (!existing) {
      if (!initializeRequest) {
        const status = method === "DELETE" ? 404 : 400;
        return createJsonErrorResponse(
          status,
          "MCP session not initialized. Start with an initialize request against this endpoint.",
        );
      }

      const created = await createSession();
      return created.transport.handleRequest(
        request,
        parsedBody === undefined ? undefined : { parsedBody },
      );
    }

    return existing.transport.handleRequest(
      request,
      parsedBody === undefined ? undefined : { parsedBody },
    );
  }

  return {
    GET: async ({ request }) => handle(request),
    POST: async ({ request }) => handle(request),
    DELETE: async ({ request }) => handle(request),
  };
}

export async function runDocsMcpStdio(options: CreateDocsMcpServerOptions): Promise<void> {
  const server = await createDocsMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function createJsonErrorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function titleize(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripMarkdownForMcp(content: string): string {
  return content
    .replace(/^(import|export)\s.*$/gm, "")
    .replace(/<[^>]+\/>/g, "")
    .replace(/<\/?[A-Z][^>]*>/g, "")
    .replace(/<\/?[a-z][^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scanFilesystemDocsPages(contentDirAbs: string, entry: string): ScannedDocsMcpPage[] {
  const pages: ScannedDocsMcpPage[] = [];

  function scan(dir: string, slugParts: string[]) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir).sort();
    for (const name of entries) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        scan(full, [...slugParts, name]);
        continue;
      }

      if (!name.endsWith(".md") && !name.endsWith(".mdx") && !name.endsWith(".svx")) continue;

      const raw = fs.readFileSync(full, "utf-8");
      const { data, content } = matter(raw);

      const baseName = name.replace(/\.(md|mdx|svx)$/, "");
      const isIndex = baseName === "index" || baseName === "page" || baseName === "+page";
      const slug = isIndex ? slugParts.join("/") : [...slugParts, baseName].join("/");
      const url = slug ? `/${entry}/${slug}` : `/${entry}`;
      const title =
        (data.title as string | undefined) ??
        (isIndex
          ? slugParts.length > 0
            ? titleize(slugParts[slugParts.length - 1])
            : "Documentation"
          : titleize(baseName));

      pages.push({
        slug,
        url,
        title,
        description: data.description as string | undefined,
        icon: data.icon as string | undefined,
        content: stripMarkdownForMcp(content),
        rawContent: content,
        order: typeof data.order === "number" ? data.order : Number.POSITIVE_INFINITY,
      });
    }
  }

  scan(contentDirAbs, []);
  return pages;
}

function buildNavigationTreeFromPages(
  pages: ScannedDocsMcpPage[],
  siteTitle: string,
  ordering: "alphabetical" | "numeric" | OrderingItem[] | undefined,
): DocsMcpNavigationTree {
  const bySlug = new Map(pages.map((page) => [page.slug, page] as const));
  const rootPage = bySlug.get("");

  function childOrderFor(parentSlug: string): OrderingItem[] | undefined {
    if (!Array.isArray(ordering)) return undefined;
    if (!parentSlug) return ordering;

    let items: OrderingItem[] | undefined = ordering;
    for (const segment of parentSlug.split("/")) {
      const matchedItem: OrderingItem | undefined = items?.find((item) => item.slug === segment);
      items = matchedItem?.children;
      if (!items) return undefined;
    }

    return items;
  }

  function sortChildSlugs(childSlugs: string[], parentSlug: string): string[] {
    const explicitOrder = childOrderFor(parentSlug);
    if (explicitOrder) {
      const explicit = new Set(explicitOrder.map((item) => item.slug));
      const ordered: string[] = [];

      for (const item of explicitOrder) {
        const childSlug = parentSlug ? `${parentSlug}/${item.slug}` : item.slug;
        if (childSlugs.includes(childSlug)) ordered.push(childSlug);
      }

      for (const childSlug of childSlugs) {
        const segment = childSlug.split("/").pop() ?? childSlug;
        if (!explicit.has(segment)) ordered.push(childSlug);
      }

      return ordered;
    }

    if (ordering === "numeric") {
      return [...childSlugs].sort((left, right) => {
        const leftPage = bySlug.get(left);
        const rightPage = bySlug.get(right);
        const leftOrder = leftPage?.order ?? Number.POSITIVE_INFINITY;
        const rightOrder = rightPage?.order ?? Number.POSITIVE_INFINITY;

        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.localeCompare(right);
      });
    }

    return [...childSlugs].sort((left, right) => left.localeCompare(right));
  }

  function buildLevel(parentSlug: string): DocsMcpNavigationNode[] {
    const prefix = parentSlug ? `${parentSlug}/` : "";
    const childSet = new Set<string>();

    for (const page of pages) {
      if (!page.slug.startsWith(prefix) || page.slug === parentSlug) continue;
      const remainder = page.slug.slice(prefix.length);
      if (!remainder) continue;
      const [firstSegment] = remainder.split("/");
      childSet.add(parentSlug ? `${parentSlug}/${firstSegment}` : firstSegment);
    }

    const childSlugs = sortChildSlugs([...childSet], parentSlug);

    const nodes: DocsMcpNavigationNode[] = [];

    for (const childSlug of childSlugs) {
      const page = bySlug.get(childSlug);
      const hasChildren = pages.some((candidate) => candidate.slug.startsWith(`${childSlug}/`));
      const segment = childSlug.split("/").pop() ?? childSlug;
      const name = page?.title ?? titleize(segment);
      const icon = page?.icon;
      const description = page?.description;

      if (hasChildren) {
        nodes.push({
          type: "folder",
          name,
          icon,
          index: page
            ? {
                type: "page",
                name: page.title,
                url: page.url,
                icon: page.icon,
                description: page.description,
              }
            : undefined,
          children: buildLevel(childSlug),
        });
        continue;
      }

      if (!page) continue;

      nodes.push({
        type: "page",
        name,
        url: page.url,
        icon,
        description,
      });
    }

    return nodes;
  }

  const children: DocsMcpNavigationNode[] = [];
  if (rootPage) {
    children.push({
      type: "page",
      name: rootPage.title,
      url: rootPage.url,
      icon: rootPage.icon,
      description: rootPage.description,
    });
  }

  children.push(...buildLevel(""));

  return { name: siteTitle, children };
}

function dedupePages(pages: DocsMcpPage[]): DocsMcpPage[] {
  const seen = new Map<string, DocsMcpPage>();
  for (const page of pages) {
    seen.set(page.url, page);
  }
  return [...seen.values()];
}

function toSearchSourcePages(pages: DocsMcpPage[]): DocsSearchSourcePage[] {
  return pages.map((page) => ({
    title: page.title,
    url: page.url,
    content: page.content,
    rawContent: page.rawContent,
    description: page.description,
  }));
}

function isSelfMcpSearchEndpoint(search?: boolean | DocsSearchConfig, route?: string): boolean {
  if (!search || search === true || typeof search !== "object" || search.provider !== "mcp") {
    return false;
  }

  const endpoint = (search as McpDocsSearchConfig).endpoint.trim();
  if (!endpoint.startsWith("/")) return false;

  return normalizeDocsMcpRoute(endpoint) === normalizeDocsMcpRoute(route);
}

function resolveMcpToolSearchConfig(
  search: boolean | DocsSearchConfig | undefined,
  route: string,
): boolean | DocsSearchConfig | undefined {
  if (!isSelfMcpSearchEndpoint(search, route)) return search;

  const config = search as McpDocsSearchConfig;
  return {
    provider: "simple",
    enabled: config.enabled,
    maxResults: config.maxResults,
    chunking: config.chunking,
  };
}

function toPageSummaries(pages: DocsMcpPage[]) {
  return pages.map((page) => ({
    slug: page.slug,
    url: page.url,
    title: page.title,
    description: page.description,
    icon: page.icon,
  }));
}

function findDocsPage(
  pages: DocsMcpPage[],
  requestedPath: string,
  entry?: string,
): DocsMcpPage | null {
  const normalizedRequest = normalizeRequestedPath(requestedPath, entry);

  for (const page of pages) {
    const normalizedPageUrl = normalizeUrlPath(page.url);
    if (normalizedPageUrl === normalizedRequest) return page;
  }

  const normalizedSlug = normalizePathSegment(requestedPath.replace(/^\//, ""));
  for (const page of pages) {
    if (normalizePathSegment(page.slug) === normalizedSlug) return page;
  }

  return null;
}

function normalizeRequestedPath(requestedPath: string, entry?: string): string {
  const trimmed = requestedPath.trim();
  if (!trimmed) return "/";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return normalizeUrlPath(new URL(trimmed).pathname);
    } catch {
      return "/";
    }
  }

  const normalized = normalizeUrlPath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
  if (!entry) return normalized;

  const normalizedEntry = `/${normalizePathSegment(entry)}`;
  if (normalized === normalizedEntry || normalized.startsWith(`${normalizedEntry}/`)) {
    return normalized;
  }

  const slug = normalizePathSegment(trimmed);
  return slug ? normalizeUrlPath(`${normalizedEntry}/${slug}`) : normalizedEntry;
}

function normalizeUrlPath(value: string): string {
  const normalized = value.replace(/\/+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

function renderPageDocument(page: DocsMcpPage): string {
  const lines = [`# ${page.title}`, `URL: ${page.url}`];
  if (page.description) lines.push(`Description: ${page.description}`);
  lines.push("", page.rawContent ?? page.content);
  return lines.join("\n");
}

function renderNavigationTree(tree: DocsMcpNavigationTree): string {
  const lines = [`# ${tree.name}`, ""];

  function visit(nodes: DocsMcpNavigationNode[], depth: number) {
    const prefix = "  ".repeat(depth);
    for (const node of nodes) {
      if (node.type === "page") {
        lines.push(`${prefix}- ${node.name} (${node.url})`);
        continue;
      }

      lines.push(`${prefix}- ${node.name}`);
      if (node.index) {
        lines.push(`${prefix}  - Overview (${node.index.url})`);
      }
      visit(node.children, depth + 1);
    }
  }

  visit(tree.children, 0);
  return lines.join("\n");
}

function slugToKey(slug: string): string {
  const normalized = normalizePathSegment(slug);
  return normalized.length > 0 ? normalized.replace(/\//g, "-") : "index";
}

function toPageResourceUri(url: string): string {
  const normalized = normalizePathSegment(url.replace(/^\//, ""));
  return `docs://${normalized || "docs"}`;
}

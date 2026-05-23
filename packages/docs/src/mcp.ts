import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import { stripGeneratedAgentProvenance } from "./agent-provenance.js";
import { normalizeDocsRelated, renderDocsRelatedMarkdownLines } from "./related.js";
import { performDocsSearch } from "./search.js";
import { resolvePageSidebarFolderIndexBehavior } from "./sidebar.js";
import {
  createDocsAgentTraceContext,
  createDocsAgentTraceId,
  emitDocsAgentTraceEvent,
  emitDocsAnalyticsEvent,
} from "./analytics.js";
import type {
  DocsAnalyticsConfig,
  DocsMcpConfig,
  DocsObservabilityConfig,
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
  related?: DocsSearchSourcePage["related"];
  icon?: string;
  sourcePath?: string;
  lastModified?: string;
  content: string;
  rawContent?: string;
  agentContent?: string;
  agentRawContent?: string;
  agentFallbackContent?: string;
  agentFallbackRawContent?: string;
}

export interface DocsMcpCodeExample {
  id: string;
  page: {
    slug: string;
    url: string;
    title: string;
    description?: string;
    sourcePath?: string;
    lastModified?: string;
  };
  language?: string;
  title?: string;
  framework?: string;
  packageManager?: string;
  runnable: boolean;
  meta: Record<string, string | boolean>;
  code: string;
}

export interface DocsMcpDocsPageSummary {
  slug: string;
  url: string;
  title: string;
  description?: string;
  icon?: string;
  sourcePath?: string;
  lastModified?: string;
}

export interface DocsMcpDocsSection {
  slug: string;
  title: string;
  url?: string;
  description?: string;
  icon?: string;
  pageCount: number;
  pages: DocsMcpDocsPageSummary[];
  sections: DocsMcpDocsSection[];
}

export interface DocsMcpDocsList {
  section?: string;
  resultCount: number;
  sectionCount: number;
  pages: DocsMcpDocsPageSummary[];
  rootPages: DocsMcpDocsPageSummary[];
  sections: DocsMcpDocsSection[];
}

export interface DocsMcpConfigSchemaOption {
  path: string;
  name: string;
  type: string;
  default?: string | boolean | number | null;
  description: string;
  docs?: string;
  values?: string[];
  children?: DocsMcpConfigSchemaOption[];
}

export interface DocsMcpConfigSchema {
  schemaVersion: 1;
  configFile: "docs.config.ts";
  description: string;
  filters?: {
    option?: string;
    query?: string;
  };
  resultCount: number;
  options: DocsMcpConfigSchemaOption[];
  examples: Array<{
    title: string;
    code: string;
  }>;
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
    listDocs: boolean;
    listPages: boolean;
    readPage: boolean;
    searchDocs: boolean;
    getNavigation: boolean;
    getCodeExamples: boolean;
    getConfigSchema: boolean;
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
  analytics?: boolean | DocsAnalyticsConfig;
  observability?: boolean | DocsObservabilityConfig;
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

const DOCS_CONFIG_SCHEMA_OPTIONS: DocsMcpConfigSchemaOption[] = [
  {
    path: "entry",
    name: "entry",
    type: "string",
    default: "docs",
    description: 'URL path prefix for documentation routes, for example "docs" creates /docs.',
    docs: "/docs/overview",
  },
  {
    path: "contentDir",
    name: "contentDir",
    type: "string",
    default: "same as entry",
    description:
      "Path to markdown content files. Adapters outside Next.js usually need this when content does not live under the route prefix.",
    docs: "/docs/overview",
  },
  {
    path: "staticExport",
    name: "staticExport",
    type: "boolean",
    default: false,
    description: "Enable full static builds. Search, AI, and runtime API routes are hidden.",
    docs: "/docs/overview",
  },
  {
    path: "theme",
    name: "theme",
    type: "DocsTheme",
    description: "Theme instance from a theme factory such as fumadocs() or pixelBorder().",
    docs: "/docs/customization/themes",
  },
  {
    path: "nav",
    name: "nav",
    type: "{ title?: string; url?: string }",
    description:
      "Sidebar and discovery metadata for the docs site. Non-Next.js adapters usually require it.",
    children: [
      {
        path: "nav.title",
        name: "title",
        type: "string",
        description: "Human-readable docs site title.",
      },
      {
        path: "nav.url",
        name: "url",
        type: "string",
        description: "Public base URL for generated absolute links and metadata.",
      },
    ],
  },
  {
    path: "github",
    name: "github",
    type: "string | GithubConfig",
    description:
      'GitHub repository metadata for "Edit on GitHub" links and page action prompt templates.',
    docs: "/docs/customization/page-actions",
  },
  {
    path: "themeToggle",
    name: "themeToggle",
    type: "boolean | ThemeToggleConfig",
    default: true,
    description: "Enable or customize the light/dark mode toggle.",
  },
  {
    path: "breadcrumb",
    name: "breadcrumb",
    type: "boolean | BreadcrumbConfig",
    default: true,
    description: "Enable or customize breadcrumb navigation.",
  },
  {
    path: "sidebar",
    name: "sidebar",
    type: "boolean | SidebarConfig",
    default: true,
    description: "Enable or customize the docs sidebar.",
    children: [
      {
        path: "sidebar.style",
        name: "style",
        type: "string",
        description: "Theme-specific sidebar style variant when supported.",
      },
      {
        path: "sidebar.defaultOpen",
        name: "defaultOpen",
        type: "boolean",
        description: "Whether collapsible sidebar groups start open by default.",
      },
    ],
  },
  {
    path: "icons",
    name: "icons",
    type: "Record<string, Component>",
    description: "Shared icon registry for frontmatter icon fields and built-in MDX components.",
  },
  {
    path: "components",
    name: "components",
    type: "Record<string, Component>",
    description: "Custom MDX component registry and built-in component overrides.",
  },
  {
    path: "onCopyClick",
    name: "onCopyClick",
    type: "(data: CodeBlockCopyData) => void",
    description:
      "Callback fired when a visitor copies a code block, including title, content, url, and language.",
  },
  {
    path: "feedback",
    name: "feedback",
    type: "boolean | FeedbackConfig",
    default: false,
    description:
      "Human page feedback UI. Agent feedback endpoints remain default-on unless opted out.",
    docs: "/docs/customization/feedback",
  },
  {
    path: "readingTime",
    name: "readingTime",
    type: "boolean | ReadingTimeConfig",
    default: false,
    description: "Opt-in estimated reading time label with per-page overrides.",
  },
  {
    path: "agent",
    name: "agent",
    type: "DocsAgentConfig",
    description: "Defaults for docs agent compact and generated agent-facing files.",
    docs: "/docs/getting-started/agent-ready-docs",
  },
  {
    path: "pageActions",
    name: "pageActions",
    type: "PageActionsConfig",
    description: "Copy Markdown and Open in LLM actions for docs pages.",
    docs: "/docs/customization/page-actions",
    children: [
      {
        path: "pageActions.copyMarkdown",
        name: "copyMarkdown",
        type: "boolean | PageActionConfig",
        description: "Show a Copy Markdown action for the current page.",
      },
      {
        path: "pageActions.openDocs",
        name: "openDocs",
        type: "boolean | OpenDocsActionConfig",
        description: "Show provider actions that open the current docs page in an LLM.",
        children: [
          {
            path: "pageActions.openDocs.target",
            name: "target",
            type: '"page" | "markdown"',
            default: "page",
            description:
              "Whether provider URLs receive the rendered page URL or the .md markdown route.",
          },
          {
            path: "pageActions.openDocs.providers",
            name: "providers",
            type: "Array<string | PromptProviderConfig>",
            description:
              "Provider IDs or provider objects. Built-ins include chatgpt, claude, cursor, and t3.",
          },
          {
            path: "pageActions.openDocs.prompt",
            name: "prompt",
            type: "string",
            description: "Prompt text prepended to the provider URL when opening docs.",
          },
        ],
      },
    ],
  },
  {
    path: "ai",
    name: "ai",
    type: "AIConfig",
    description: "RAG-powered Ask AI configuration.",
    docs: "/docs/customization/ask-ai",
    children: [
      {
        path: "ai.enabled",
        name: "enabled",
        type: "boolean",
        description: "Enable or disable Ask AI.",
      },
      {
        path: "ai.model",
        name: "model",
        type: "string | AIModelConfig",
        description: "Model ID or model routing config.",
      },
      {
        path: "ai.providers",
        name: "providers",
        type: "Record<string, AIProviderConfig>",
        description: "Provider base URLs and optional API keys.",
      },
      {
        path: "ai.systemPrompt",
        name: "systemPrompt",
        type: "string",
        description: "Additional instruction text for generated answers.",
      },
      {
        path: "ai.useMcp",
        name: "useMcp",
        type: "boolean | DocsAskAIMcpConfig",
        description: "Use the built-in MCP search tool as Ask AI's retrieval provider.",
      },
    ],
  },
  {
    path: "search",
    name: "search",
    type: "boolean | DocsSearchConfig",
    default: true,
    description: "Built-in simple search, Typesense, Algolia, MCP, or a custom adapter.",
    docs: "/docs/customization/search",
    children: [
      {
        path: "search.provider",
        name: "provider",
        type: '"simple" | "typesense" | "algolia" | "mcp" | "custom"',
        default: "simple",
        description: "Search backend used by the docs UI and MCP search tool.",
      },
      {
        path: "search.maxResults",
        name: "maxResults",
        type: "number",
        description: "Maximum result count returned by search requests.",
      },
    ],
  },
  {
    path: "llmsTxt",
    name: "llmsTxt",
    type: "boolean | LlmsTxtConfig",
    default: true,
    description:
      "Generated /llms.txt, /llms-full.txt, optional section files, and basePath-aware aliases.",
    docs: "/docs/getting-started/agent-ready-docs",
  },
  {
    path: "changelog",
    name: "changelog",
    type: "boolean | ChangelogConfig",
    default: false,
    description: "Generate changelog feed and entry pages from dated MDX entries.",
    docs: "/docs/customization/changelog",
  },
  {
    path: "mcp",
    name: "mcp",
    type: "boolean | DocsMcpConfig",
    default: true,
    description:
      "Built-in MCP server over stdio plus HTTP routes at /mcp and /.well-known/mcp, backed by /api/docs/mcp.",
    docs: "/docs/customization/mcp",
    children: [
      {
        path: "mcp.enabled",
        name: "enabled",
        type: "boolean",
        default: true,
        description: "Enable the built-in MCP server.",
      },
      {
        path: "mcp.route",
        name: "route",
        type: "string",
        default: "/api/docs/mcp",
        description: "Canonical Streamable HTTP route used by the MCP endpoint.",
      },
      {
        path: "mcp.name",
        name: "name",
        type: "string",
        default: "nav.title or @farming-labs/docs",
        description: "Human-readable MCP server name reported to clients.",
      },
      {
        path: "mcp.version",
        name: "version",
        type: "string",
        default: "0.0.0",
        description: "Version string reported to MCP clients.",
      },
      {
        path: "mcp.tools",
        name: "tools",
        type: "DocsMcpToolsConfig",
        default: "all enabled",
        description: "Fine-grained built-in MCP tool toggles.",
        children: [
          {
            path: "mcp.tools.listDocs",
            name: "listDocs",
            type: "boolean",
            default: true,
            description: "Expose the list_docs tool.",
          },
          {
            path: "mcp.tools.listPages",
            name: "listPages",
            type: "boolean",
            default: true,
            description: "Expose the list_pages tool.",
          },
          {
            path: "mcp.tools.getNavigation",
            name: "getNavigation",
            type: "boolean",
            default: true,
            description: "Expose the get_navigation tool.",
          },
          {
            path: "mcp.tools.searchDocs",
            name: "searchDocs",
            type: "boolean",
            default: true,
            description: "Expose the search_docs tool.",
          },
          {
            path: "mcp.tools.readPage",
            name: "readPage",
            type: "boolean",
            default: true,
            description: "Expose the read_page tool.",
          },
          {
            path: "mcp.tools.getCodeExamples",
            name: "getCodeExamples",
            type: "boolean",
            default: true,
            description: "Expose the get_code_examples tool.",
          },
          {
            path: "mcp.tools.getConfigSchema",
            name: "getConfigSchema",
            type: "boolean",
            default: true,
            description: "Expose the get_config_schema tool.",
          },
        ],
      },
    ],
  },
  {
    path: "apiReference",
    name: "apiReference",
    type: "boolean | ApiReferenceConfig",
    default: false,
    description:
      "Generated API reference pages from framework route conventions or a hosted OpenAPI document.",
    docs: "/docs/customization/api-reference",
    children: [
      {
        path: "apiReference.specUrl",
        name: "specUrl",
        type: "string",
        description: "Remote OpenAPI JSON URL when the backend owns the schema.",
      },
      {
        path: "apiReference.path",
        name: "path",
        type: "string",
        description: "Docs route where the API reference is rendered.",
      },
    ],
  },
  {
    path: "sitemap",
    name: "sitemap",
    type: "boolean | DocsSitemapConfig",
    default: true,
    description: "Generated sitemap.xml, sitemap.md, and /.well-known/sitemap.md.",
  },
  {
    path: "robots",
    name: "robots",
    type: "boolean | DocsRobotsConfig",
    default: true,
    description:
      "Runtime or generated robots.txt policy for docs routes, agent-readable files, and AI crawler user agents.",
  },
  {
    path: "metadata",
    name: "metadata",
    type: "DocsMetadata",
    description: "SEO and JSON-LD inputs such as titleTemplate and description.",
  },
  {
    path: "og",
    name: "og",
    type: "OGConfig",
    description: "Dynamic Open Graph image configuration.",
  },
];

const DOCS_CONFIG_SCHEMA_EXAMPLES: DocsMcpConfigSchema["examples"] = [
  {
    title: "Minimal config",
    code: `import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
});`,
  },
  {
    title: "MCP tool toggles",
    code: `export default defineDocs({
  entry: "docs",
  mcp: {
    tools: {
      listDocs: true,
      getConfigSchema: true,
      getCodeExamples: true,
    },
  },
});`,
  },
];

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

const listDocsInputSchema = z.object({
  section: z.string().trim().min(1).optional(),
  locale: z.string().min(1).optional(),
});

const getNavigationInputSchema = z.object({
  locale: z.string().min(1).optional(),
});

const getConfigSchemaInputSchema = z.object({
  option: z.string().trim().min(1).optional(),
  query: z.string().trim().min(1).optional(),
});

const getCodeExamplesInputSchema = z.object({
  query: z.string().trim().min(1).optional(),
  path: z.string().min(1).optional(),
  framework: z.string().trim().min(1).optional(),
  packageManager: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  runnable: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
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
  if (mcp === false) {
    return {
      enabled: false,
      route: normalizeDocsMcpRoute(defaults.defaultRoute),
      name: defaults.defaultName ?? DEFAULT_MCP_NAME,
      version: defaults.defaultVersion ?? DEFAULT_MCP_VERSION,
      tools: {
        listDocs: true,
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
      },
    };
  }

  const config = mcp && typeof mcp === "object" ? mcp : {};

  return {
    enabled: typeof mcp === "boolean" ? mcp : (config.enabled ?? true),
    route: normalizeDocsMcpRoute(config.route ?? defaults.defaultRoute),
    name: config.name ?? defaults.defaultName ?? DEFAULT_MCP_NAME,
    version: config.version ?? defaults.defaultVersion ?? DEFAULT_MCP_VERSION,
    tools: {
      listDocs: config.tools?.listDocs ?? true,
      listPages: config.tools?.listPages ?? true,
      readPage: config.tools?.readPage ?? true,
      searchDocs: config.tools?.searchDocs ?? true,
      getNavigation: config.tools?.getNavigation ?? true,
      getCodeExamples: config.tools?.getCodeExamples ?? true,
      getConfigSchema: config.tools?.getConfigSchema ?? true,
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

    const pages = scanFilesystemDocsPages(contentDirAbs, entry, rootDir);
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

function nowMs() {
  return Date.now();
}

function durationMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
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
        const startedAt = nowMs();
        const trace = createDocsAgentTraceContext("mcp.tool.list_pages");
        const callSpanId = createDocsAgentTraceId("span");
        await emitDocsAgentTraceEvent(options.observability, {
          type: "tool.call",
          source: "mcp",
          traceId: trace.traceId,
          spanId: callSpanId,
          name: "list_pages",
          startedAt: trace.startedAt,
          status: "started",
          locale,
          inputPreview: { locale },
          metadata: { tool: "list_pages" },
        });

        try {
          const pages = toPageSummaries(dedupePages(await options.source.getPages(locale)));
          const elapsed = durationMs(startedAt);
          await emitDocsAnalyticsEvent(options.analytics, {
            type: "mcp_tool",
            source: "mcp",
            locale,
            properties: {
              tool: "list_pages",
              resultCount: pages.length,
              durationMs: elapsed,
            },
          });
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.result",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "list_pages",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "success",
            locale,
            outputPreview: { resultCount: pages.length },
            metadata: { tool: "list_pages" },
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ pages }, null, 2),
              },
            ],
          };
        } catch (error) {
          const elapsed = durationMs(startedAt);
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.error",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "list_pages",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "error",
            locale,
            outputPreview: { message: error instanceof Error ? error.message : "Unknown error" },
            metadata: { tool: "list_pages" },
          });
          throw error;
        }
      },
    );
  }

  if (resolved.tools.listDocs) {
    server.registerTool(
      "list_docs",
      {
        title: "List docs by section",
        description:
          "List documentation pages grouped by section, optionally narrowed to one section.",
        inputSchema: listDocsInputSchema,
        annotations: { readOnlyHint: true },
      },
      async ({ section, locale }) => {
        const startedAt = nowMs();
        const trace = createDocsAgentTraceContext("mcp.tool.list_docs");
        const callSpanId = createDocsAgentTraceId("span");
        await emitDocsAgentTraceEvent(options.observability, {
          type: "tool.call",
          source: "mcp",
          traceId: trace.traceId,
          spanId: callSpanId,
          name: "list_docs",
          startedAt: trace.startedAt,
          status: "started",
          locale,
          inputPreview: { section, locale },
          metadata: { tool: "list_docs" },
        });

        try {
          const docs = listDocsBySection(dedupePages(await options.source.getPages(locale)), {
            section,
            entry: options.source.entry,
          });
          const elapsed = durationMs(startedAt);
          await emitDocsAnalyticsEvent(options.analytics, {
            type: "mcp_tool",
            source: "mcp",
            locale,
            properties: {
              tool: "list_docs",
              section,
              resultCount: docs.resultCount,
              sectionCount: docs.sectionCount,
              durationMs: elapsed,
            },
          });
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.result",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "list_docs",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "success",
            locale,
            outputPreview: { resultCount: docs.resultCount, sectionCount: docs.sectionCount },
            metadata: { tool: "list_docs" },
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(docs, null, 2),
              },
            ],
          };
        } catch (error) {
          const elapsed = durationMs(startedAt);
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.error",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "list_docs",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "error",
            locale,
            outputPreview: { message: error instanceof Error ? error.message : "Unknown error" },
            metadata: { tool: "list_docs" },
          });
          throw error;
        }
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
        const startedAt = nowMs();
        const trace = createDocsAgentTraceContext("mcp.tool.get_navigation");
        const callSpanId = createDocsAgentTraceId("span");
        await emitDocsAgentTraceEvent(options.observability, {
          type: "tool.call",
          source: "mcp",
          traceId: trace.traceId,
          spanId: callSpanId,
          name: "get_navigation",
          startedAt: trace.startedAt,
          status: "started",
          locale,
          inputPreview: { locale },
          metadata: { tool: "get_navigation" },
        });

        try {
          const tree = await options.source.getNavigation(locale);
          const text = renderNavigationTree(tree);
          const elapsed = durationMs(startedAt);
          await emitDocsAnalyticsEvent(options.analytics, {
            type: "mcp_tool",
            source: "mcp",
            locale,
            properties: {
              tool: "get_navigation",
              durationMs: elapsed,
            },
          });
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.result",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "get_navigation",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "success",
            locale,
            outputPreview: { chars: text.length },
            metadata: { tool: "get_navigation" },
          });
          return {
            content: [
              {
                type: "text",
                text,
              },
            ],
          };
        } catch (error) {
          const elapsed = durationMs(startedAt);
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.error",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "get_navigation",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "error",
            locale,
            outputPreview: { message: error instanceof Error ? error.message : "Unknown error" },
            metadata: { tool: "get_navigation" },
          });
          throw error;
        }
      },
    );
  }

  if (resolved.tools.getConfigSchema) {
    server.registerTool(
      "get_config_schema",
      {
        title: "Get docs config schema",
        description:
          "Return structured docs.config.ts option metadata, optionally filtered by option path or query.",
        inputSchema: getConfigSchemaInputSchema,
        annotations: { readOnlyHint: true },
      },
      async ({ option, query }) => {
        const startedAt = nowMs();
        const trace = createDocsAgentTraceContext("mcp.tool.get_config_schema");
        const callSpanId = createDocsAgentTraceId("span");
        await emitDocsAgentTraceEvent(options.observability, {
          type: "tool.call",
          source: "mcp",
          traceId: trace.traceId,
          spanId: callSpanId,
          name: "get_config_schema",
          startedAt: trace.startedAt,
          status: "started",
          inputPreview: { option, queryLength: query?.length },
          metadata: { tool: "get_config_schema" },
        });

        try {
          const schema = getDocsConfigSchema({ option, query });
          const elapsed = durationMs(startedAt);
          await emitDocsAnalyticsEvent(options.analytics, {
            type: "mcp_tool",
            source: "mcp",
            input: query ? { query } : undefined,
            properties: {
              tool: "get_config_schema",
              option,
              queryLength: query?.length,
              resultCount: schema.resultCount,
              durationMs: elapsed,
            },
          });
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.result",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "get_config_schema",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "success",
            outputPreview: { resultCount: schema.resultCount },
            metadata: { tool: "get_config_schema" },
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(schema, null, 2),
              },
            ],
          };
        } catch (error) {
          const elapsed = durationMs(startedAt);
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.error",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "get_config_schema",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "error",
            outputPreview: { message: error instanceof Error ? error.message : "Unknown error" },
            metadata: { tool: "get_config_schema" },
          });
          throw error;
        }
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
        const startedAt = nowMs();
        const resolvedLimit = limit ?? 10;
        const trace = createDocsAgentTraceContext("mcp.tool.search_docs");
        const callSpanId = createDocsAgentTraceId("span");
        await emitDocsAgentTraceEvent(options.observability, {
          type: "tool.call",
          source: "mcp",
          traceId: trace.traceId,
          spanId: callSpanId,
          name: "search_docs",
          startedAt: trace.startedAt,
          status: "started",
          locale,
          inputPreview: { queryLength: query.length, limit: resolvedLimit, locale },
          metadata: { tool: "search_docs" },
        });

        try {
          const pages = dedupePages(await options.source.getPages(locale));
          const results = await performDocsSearch({
            pages: toSearchSourcePages(pages),
            query,
            search: toolSearchConfig ?? true,
            locale,
            siteTitle: options.source.siteTitle,
            limit: resolvedLimit,
          });
          const elapsed = durationMs(startedAt);
          await emitDocsAnalyticsEvent(options.analytics, {
            type: "mcp_tool",
            source: "mcp",
            locale,
            input: { query },
            properties: {
              tool: "search_docs",
              queryLength: query.length,
              limit: resolvedLimit,
              resultCount: results.length,
              durationMs: elapsed,
            },
          });
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.result",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "search_docs",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "success",
            locale,
            outputPreview: { resultCount: results.length },
            metadata: { tool: "search_docs" },
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ results }, null, 2),
              },
            ],
          };
        } catch (error) {
          const elapsed = durationMs(startedAt);
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.error",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "search_docs",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "error",
            locale,
            outputPreview: { message: error instanceof Error ? error.message : "Unknown error" },
            metadata: { tool: "search_docs" },
          });
          throw error;
        }
      },
    );
  }

  if (resolved.tools.getCodeExamples) {
    server.registerTool(
      "get_code_examples",
      {
        title: "Get docs code examples",
        description:
          "Return fenced code examples from the docs with parsed metadata such as title, framework, packageManager, and runnable.",
        inputSchema: getCodeExamplesInputSchema,
        annotations: { readOnlyHint: true },
      },
      async ({
        query,
        path: requestedPath,
        framework,
        packageManager,
        language,
        runnable,
        limit,
        locale,
      }) => {
        const startedAt = nowMs();
        const resolvedLimit = limit ?? 25;
        const trace = createDocsAgentTraceContext("mcp.tool.get_code_examples");
        const callSpanId = createDocsAgentTraceId("span");
        await emitDocsAgentTraceEvent(options.observability, {
          type: "tool.call",
          source: "mcp",
          traceId: trace.traceId,
          spanId: callSpanId,
          name: "get_code_examples",
          startedAt: trace.startedAt,
          status: "started",
          locale,
          inputPreview: {
            queryLength: query?.length,
            path: requestedPath,
            framework,
            packageManager,
            language,
            runnable,
            limit: resolvedLimit,
          },
          metadata: { tool: "get_code_examples" },
        });

        try {
          const pages = dedupePages(await options.source.getPages(locale));
          const matchedPage = requestedPath
            ? findDocsPage(pages, requestedPath, options.source.entry)
            : null;
          const scopedPages = requestedPath ? (matchedPage ? [matchedPage] : []) : pages;
          const examples = filterDocsCodeExamples(
            scopedPages.flatMap((page) => extractDocsMcpCodeExamples(page)),
            {
              query,
              framework,
              packageManager,
              language,
              runnable,
              limit: resolvedLimit,
            },
          );
          const elapsed = durationMs(startedAt);
          await emitDocsAnalyticsEvent(options.analytics, {
            type: "mcp_tool",
            source: "mcp",
            locale,
            input: query ? { query } : undefined,
            properties: {
              tool: "get_code_examples",
              queryLength: query?.length,
              path: requestedPath,
              framework,
              packageManager,
              language,
              runnable,
              limit: resolvedLimit,
              resultCount: examples.length,
              durationMs: elapsed,
            },
          });
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.result",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "get_code_examples",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "success",
            locale,
            outputPreview: { resultCount: examples.length },
            metadata: { tool: "get_code_examples" },
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ examples }, null, 2),
              },
            ],
          };
        } catch (error) {
          const elapsed = durationMs(startedAt);
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.error",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "get_code_examples",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "error",
            locale,
            outputPreview: { message: error instanceof Error ? error.message : "Unknown error" },
            metadata: { tool: "get_code_examples" },
          });
          throw error;
        }
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
        const startedAt = nowMs();
        const trace = createDocsAgentTraceContext("mcp.tool.read_page");
        const callSpanId = createDocsAgentTraceId("span");
        await emitDocsAgentTraceEvent(options.observability, {
          type: "tool.call",
          source: "mcp",
          traceId: trace.traceId,
          spanId: callSpanId,
          name: "read_page",
          startedAt: trace.startedAt,
          status: "started",
          locale,
          inputPreview: { path: requestedPath, locale },
          metadata: { tool: "read_page" },
        });

        try {
          const pages = dedupePages(await options.source.getPages(locale));
          const page = findDocsPage(pages, requestedPath, options.source.entry);

          if (!page) {
            const elapsed = durationMs(startedAt);
            await emitDocsAnalyticsEvent(options.analytics, {
              type: "agent_read",
              source: "mcp",
              locale,
              properties: {
                delivery: "mcp_tool",
                tool: "read_page",
                requestedPath,
                found: false,
                durationMs: elapsed,
              },
            });
            await emitDocsAnalyticsEvent(options.analytics, {
              type: "mcp_tool",
              source: "mcp",
              locale,
              properties: {
                tool: "read_page",
                path: requestedPath,
                found: false,
                durationMs: elapsed,
              },
            });
            await emitDocsAgentTraceEvent(options.observability, {
              type: "tool.error",
              source: "mcp",
              traceId: trace.traceId,
              parentSpanId: callSpanId,
              name: "read_page",
              startedAt: trace.startedAt,
              endedAt: new Date().toISOString(),
              durationMs: elapsed,
              status: "error",
              locale,
              outputPreview: { found: false, path: requestedPath },
              metadata: { tool: "read_page", reason: "not_found" },
            });
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

          const document = renderPageDocument(page);
          const elapsed = durationMs(startedAt);

          await emitDocsAnalyticsEvent(options.analytics, {
            type: "agent_read",
            source: "mcp",
            locale,
            path: page.url,
            properties: {
              delivery: "mcp_tool",
              tool: "read_page",
              requestedPath,
              slug: page.slug,
              found: true,
              contentLength: document.length,
              durationMs: elapsed,
            },
          });
          await emitDocsAnalyticsEvent(options.analytics, {
            type: "mcp_tool",
            source: "mcp",
            locale,
            path: page.url,
            properties: {
              tool: "read_page",
              requestedPath,
              slug: page.slug,
              found: true,
              contentLength: document.length,
              durationMs: elapsed,
            },
          });
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.result",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "read_page",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "success",
            locale,
            path: page.url,
            outputPreview: { found: true, chars: document.length, slug: page.slug },
            metadata: { tool: "read_page" },
          });

          return {
            content: [
              {
                type: "text",
                text: document,
              },
            ],
          };
        } catch (error) {
          const elapsed = durationMs(startedAt);
          await emitDocsAgentTraceEvent(options.observability, {
            type: "tool.error",
            source: "mcp",
            traceId: trace.traceId,
            parentSpanId: callSpanId,
            name: "read_page",
            startedAt: trace.startedAt,
            endedAt: new Date().toISOString(),
            durationMs: elapsed,
            status: "error",
            locale,
            outputPreview: { message: error instanceof Error ? error.message : "Unknown error" },
            metadata: { tool: "read_page" },
          });
          throw error;
        }
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

  const disabledMessage =
    "MCP is disabled. Remove `mcp: false` or set `mcp: { enabled: true }` in docs.config to enable it again.";

  if (!resolved.enabled) {
    return {
      GET: async () => createJsonErrorResponse(404, disabledMessage),
      POST: async ({ request }) =>
        createJsonRpcErrorResponse({
          status: 404,
          code: -32000,
          message: disabledMessage,
          id: readJsonRpcId(await parseJsonBody(request)),
          data: { reason: "mcp_disabled" },
        }),
      DELETE: async () => createJsonErrorResponse(404, disabledMessage),
    };
  }

  async function createStatelessTransport() {
    const server = await createDocsMcpServer(options);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return { server, transport };
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const sessionId =
      request.headers.get("mcp-session-id") ?? request.headers.get("Mcp-Session-Id");

    let parsedBody: unknown;
    let bodyParseFailed = false;
    if (method === "POST") {
      try {
        parsedBody = await request.clone().json();
      } catch {
        bodyParseFailed = true;
        parsedBody = undefined;
      }
    }

    const initializeRequest = method === "POST" && parsedBody && isInitializeRequest(parsedBody);

    await emitDocsAnalyticsEvent(options.analytics, {
      type: "mcp_request",
      source: "mcp",
      url: request.url,
      path: url.pathname,
      properties: {
        method,
        hasSession: Boolean(sessionId),
        stateless: true,
        initialize: Boolean(initializeRequest),
      },
    });

    if (method === "POST" && bodyParseFailed) {
      return createJsonRpcErrorResponse({
        status: 400,
        code: -32700,
        message: "Parse error: Invalid JSON",
      });
    }

    const created = await createStatelessTransport();
    return created.transport.handleRequest(
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

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
}

function readJsonRpcId(value: unknown): string | number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

function createJsonRpcErrorResponse({
  status,
  code,
  message,
  id = null,
  data,
}: {
  status: number;
  code: number;
  message: string;
  id?: string | number | null;
  data?: Record<string, unknown>;
}): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: data ? { code, message, data } : { code, message },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function titleize(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveAgentMdxContent(content: string, audience: "human" | "agent"): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let fenceMarker: string | null = null;
  let agentDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      if (!fenceMarker) {
        fenceMarker = fenceMatch[1];
      } else if (trimmed.startsWith(fenceMarker)) {
        fenceMarker = null;
      }

      if (audience === "agent" || agentDepth === 0) {
        output.push(line);
      }
      continue;
    }

    if (!fenceMarker) {
      if (/^<Agent(?:\s[^>]*)?\/>$/.test(trimmed)) {
        continue;
      }

      const singleLineMatch = line.match(/^(\s*)<Agent(?:\s[^>]*)?>([\s\S]*?)<\/Agent>\s*$/);
      if (singleLineMatch) {
        if (audience === "agent" && singleLineMatch[2]) {
          output.push(`${singleLineMatch[1]}${singleLineMatch[2]}`);
        }
        continue;
      }

      const openMatch = line.match(/^(\s*)<Agent(?:\s[^>]*)?>\s*$/);
      if (openMatch) {
        agentDepth += 1;
        continue;
      }

      const openWithContentMatch = line.match(/^(\s*)<Agent(?:\s[^>]*)?>(.*)$/);
      if (openWithContentMatch) {
        agentDepth += 1;
        if (audience === "agent" && openWithContentMatch[2]) {
          output.push(`${openWithContentMatch[1]}${openWithContentMatch[2]}`);
        }
        continue;
      }

      const closeWithContentMatch = line.match(/^(.*)<\/Agent>\s*$/);
      if (closeWithContentMatch && agentDepth > 0) {
        if (audience === "agent" && closeWithContentMatch[1]) {
          output.push(closeWithContentMatch[1]);
        }
        agentDepth = Math.max(0, agentDepth - 1);
        continue;
      }

      if (/^<\/Agent>\s*$/.test(trimmed) && agentDepth > 0) {
        agentDepth = Math.max(0, agentDepth - 1);
        continue;
      }
    }

    if (agentDepth > 0 && audience === "human") {
      continue;
    }

    output.push(line);
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function resolveFilesystemDocsPageSource(dir: string): string | undefined {
  return ["page.mdx", "page.md", "page.svx"]
    .map((fileName) => path.join(dir, fileName))
    .find((candidate) => fs.existsSync(candidate));
}

function hasVisibleDescendantFilesystemDocsPage(dir: string): boolean {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return false;
  }

  for (const name of entries.sort()) {
    const full = path.join(dir, name);
    try {
      if (!fs.statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }

    const pageSource = resolveFilesystemDocsPageSource(full);
    if (pageSource) {
      try {
        const data = matter(fs.readFileSync(pageSource, "utf-8")).data;
        const hiddenFolderIndex = resolvePageSidebarFolderIndexBehavior(data.sidebar) === "hidden";
        if (data.hidden !== true && !hiddenFolderIndex) return true;
      } catch {
        return true;
      }
    }

    if (hasVisibleDescendantFilesystemDocsPage(full)) return true;
  }

  return false;
}

function scanFilesystemDocsPages(
  contentDirAbs: string,
  entry: string,
  rootDir: string,
): ScannedDocsMcpPage[] {
  const pages: Array<ScannedDocsMcpPage & { relatedInput?: unknown }> = [];

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

      if (name === "agent.md") continue;
      if (!name.endsWith(".md") && !name.endsWith(".mdx") && !name.endsWith(".svx")) continue;

      const raw = fs.readFileSync(full, "utf-8");
      const { data, content } = matter(raw);
      const baseName = name.replace(/\.(md|mdx|svx)$/, "");
      const isIndex = baseName === "index" || baseName === "page" || baseName === "+page";
      const hiddenFolderIndex =
        isIndex &&
        resolvePageSidebarFolderIndexBehavior(data.sidebar) === "hidden" &&
        hasVisibleDescendantFilesystemDocsPage(dir);
      if (hiddenFolderIndex) continue;

      const humanRawContent = resolveAgentMdxContent(content, "human");
      const pageAgentRawContent = resolveAgentMdxContent(content, "agent");
      const pageAgentContent =
        pageAgentRawContent !== humanRawContent
          ? stripMarkdownForMcp(pageAgentRawContent)
          : undefined;

      const slug = isIndex ? slugParts.join("/") : [...slugParts, baseName].join("/");
      const url = slug ? `/${entry}/${slug}` : `/${entry}`;
      const agentDoc = isIndex ? readFilesystemAgentDoc(dir) : undefined;
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
        relatedInput: data.related,
        icon: data.icon as string | undefined,
        sourcePath: path.relative(rootDir, full).replace(/\\/g, "/"),
        lastModified: stat.mtime.toISOString(),
        content: stripMarkdownForMcp(humanRawContent),
        rawContent: humanRawContent,
        agentFallbackContent: pageAgentContent,
        agentFallbackRawContent:
          pageAgentRawContent !== humanRawContent ? pageAgentRawContent : undefined,
        order: typeof data.order === "number" ? data.order : Number.POSITIVE_INFINITY,
        ...agentDoc,
      });
    }
  }

  scan(contentDirAbs, []);
  return resolveRelatedForMcpPages(pages);
}

function readFilesystemAgentDoc(dir: string) {
  const agentPath = path.join(dir, "agent.md");
  if (!fs.existsSync(agentPath)) return undefined;

  const raw = stripGeneratedAgentProvenance(fs.readFileSync(agentPath, "utf-8"));
  const { content } = matter(raw);
  return {
    agentContent: stripMarkdownForMcp(content),
    agentRawContent: content,
  };
}

function resolveRelatedForMcpPages(
  pages: Array<ScannedDocsMcpPage & { relatedInput?: unknown }>,
): ScannedDocsMcpPage[] {
  return pages.map(({ relatedInput, ...page }) => {
    const related = normalizeDocsRelated(relatedInput);
    return related.length > 0 ? { ...page, related } : page;
  });
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
    content: page.agentContent ?? page.agentFallbackContent ?? page.content,
    rawContent: page.agentRawContent ?? page.agentFallbackRawContent ?? page.rawContent,
    sourcePath: page.sourcePath,
    lastModified: page.lastModified,
    agentContent: page.agentContent,
    agentRawContent: page.agentRawContent,
    agentFallbackContent: page.agentFallbackContent,
    agentFallbackRawContent: page.agentFallbackRawContent,
    description: page.description,
    related: page.related,
  }));
}

function getDocsConfigSchema(filters: { option?: string; query?: string }): DocsMcpConfigSchema {
  const option = filters.option?.trim();
  const query = filters.query?.trim();
  let options = DOCS_CONFIG_SCHEMA_OPTIONS.map(cloneConfigSchemaOption);

  if (option) {
    options = selectConfigSchemaOptions(option);
  }

  if (query) {
    options = filterConfigSchemaOptionsByQuery(options, query);
  }

  return {
    schemaVersion: 1,
    configFile: "docs.config.ts",
    description:
      "Configuration schema for @farming-labs/docs defineDocs(). Use option for an exact top-level or nested path, or query for keyword filtering.",
    filters:
      option || query
        ? {
            ...(option ? { option } : {}),
            ...(query ? { query } : {}),
          }
        : undefined,
    resultCount: countConfigSchemaOptions(options),
    options,
    examples: DOCS_CONFIG_SCHEMA_EXAMPLES,
  };
}

function cloneConfigSchemaOption(option: DocsMcpConfigSchemaOption): DocsMcpConfigSchemaOption {
  return {
    ...option,
    children: option.children?.map(cloneConfigSchemaOption),
  };
}

function selectConfigSchemaOptions(optionPath: string): DocsMcpConfigSchemaOption[] {
  const needle = normalizeConfigSchemaToken(optionPath);
  return flattenConfigSchemaOptions(DOCS_CONFIG_SCHEMA_OPTIONS)
    .filter((option) => {
      const normalizedPath = normalizeConfigSchemaToken(option.path);
      return normalizedPath === needle;
    })
    .map(cloneConfigSchemaOption);
}

function filterConfigSchemaOptionsByQuery(
  options: DocsMcpConfigSchemaOption[],
  query: string,
): DocsMcpConfigSchemaOption[] {
  return options.flatMap((option) => {
    if (configSchemaOptionMatchesQuery(option, query)) {
      return [cloneConfigSchemaOption(option)];
    }

    const children = option.children
      ? filterConfigSchemaOptionsByQuery(option.children, query)
      : [];
    if (children.length === 0) return [];

    return [
      {
        ...cloneConfigSchemaOption(option),
        children,
      },
    ];
  });
}

function configSchemaOptionMatchesQuery(option: DocsMcpConfigSchemaOption, query: string): boolean {
  const searchText = [
    option.path,
    option.name,
    option.type,
    option.default,
    option.description,
    option.docs,
    option.values?.join(" "),
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ");
  const lowerSearchText = searchText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  return (
    lowerSearchText.includes(lowerQuery) ||
    normalizeConfigSchemaToken(searchText).includes(normalizeConfigSchemaToken(query))
  );
}

function flattenConfigSchemaOptions(
  options: DocsMcpConfigSchemaOption[],
): DocsMcpConfigSchemaOption[] {
  return options.flatMap((option) => [
    option,
    ...(option.children ? flattenConfigSchemaOptions(option.children) : []),
  ]);
}

function countConfigSchemaOptions(options: DocsMcpConfigSchemaOption[]): number {
  return flattenConfigSchemaOptions(options).length;
}

function normalizeConfigSchemaToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^docs\.config\.?/, "")
    .replace(/[`'"]/g, "")
    .replace(/[_\-\s]+/g, "");
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

function toDocsListPageSummary(page: DocsMcpPage): DocsMcpDocsPageSummary {
  return {
    slug: page.slug,
    url: page.url,
    title: page.title,
    description: page.description,
    icon: page.icon,
    sourcePath: page.sourcePath,
    lastModified: page.lastModified,
  };
}

function listDocsBySection(
  pages: DocsMcpPage[],
  filters: { section?: string; entry?: string },
): DocsMcpDocsList {
  const allPages = pages.map(toDocsListPageSummary);
  const tree = buildDocsSectionTree(pages);
  const requestedSection = filters.section?.trim();

  if (!requestedSection) {
    return {
      resultCount: allPages.length,
      sectionCount: countDocsSections(tree.sections),
      pages: allPages,
      rootPages: tree.rootPages,
      sections: tree.sections,
    };
  }

  const section = findDocsSection(tree.sections, requestedSection, filters.entry);
  if (section) {
    const sections = [cloneDocsSection(section)];
    const matchedPages = flattenDocsSectionPages(sections[0]);
    return {
      section: requestedSection,
      resultCount: matchedPages.length,
      sectionCount: countDocsSections(sections),
      pages: matchedPages,
      rootPages: [],
      sections,
    };
  }

  const page = allPages.find((candidate) =>
    docsListPageMatches(candidate, requestedSection, filters.entry),
  );
  if (page) {
    return {
      section: requestedSection,
      resultCount: 1,
      sectionCount: 0,
      pages: [page],
      rootPages: [page],
      sections: [],
    };
  }

  return {
    section: requestedSection,
    resultCount: 0,
    sectionCount: 0,
    pages: [],
    rootPages: [],
    sections: [],
  };
}

function buildDocsSectionTree(pages: DocsMcpPage[]): {
  rootPages: DocsMcpDocsPageSummary[];
  sections: DocsMcpDocsSection[];
} {
  const sectionSlugs = new Set<string>();
  for (const page of pages) {
    const parts = page.slug.split("/").filter(Boolean);
    for (let index = 1; index < parts.length; index += 1) {
      sectionSlugs.add(parts.slice(0, index).join("/"));
    }
  }

  const rootPages: DocsMcpDocsPageSummary[] = [];
  const sections: DocsMcpDocsSection[] = [];
  const sectionBySlug = new Map<string, DocsMcpDocsSection>();

  function getOrCreateSection(slug: string): DocsMcpDocsSection {
    const existing = sectionBySlug.get(slug);
    if (existing) return existing;

    const parts = slug.split("/").filter(Boolean);
    const section: DocsMcpDocsSection = {
      slug,
      title: titleize(parts.at(-1) ?? slug),
      pageCount: 0,
      pages: [],
      sections: [],
    };
    sectionBySlug.set(slug, section);

    if (parts.length <= 1) {
      sections.push(section);
    } else {
      getOrCreateSection(parts.slice(0, -1).join("/")).sections.push(section);
    }

    return section;
  }

  for (const page of pages) {
    const summary = toDocsListPageSummary(page);
    const parts = page.slug.split("/").filter(Boolean);

    if (parts.length === 0) {
      rootPages.push(summary);
      continue;
    }

    const isSectionIndex = sectionSlugs.has(page.slug);
    if (parts.length === 1 && !isSectionIndex) {
      rootPages.push(summary);
      continue;
    }

    if (isSectionIndex) {
      const section = getOrCreateSection(page.slug);
      hydrateDocsSection(section, summary);
      pushUniqueDocsPage(section.pages, summary, "start");
      continue;
    }

    const parentSlug = parts.slice(0, -1).join("/");
    const parent = getOrCreateSection(parentSlug);
    pushUniqueDocsPage(parent.pages, summary, "end");
  }

  updateDocsSectionPageCounts(sections);
  return { rootPages, sections };
}

function hydrateDocsSection(section: DocsMcpDocsSection, page: DocsMcpDocsPageSummary): void {
  section.title = page.title;
  section.url = page.url;
  section.description = page.description;
  section.icon = page.icon;
}

function pushUniqueDocsPage(
  pages: DocsMcpDocsPageSummary[],
  page: DocsMcpDocsPageSummary,
  position: "start" | "end",
): void {
  if (pages.some((candidate) => candidate.url === page.url)) return;
  if (position === "start") {
    pages.unshift(page);
    return;
  }
  pages.push(page);
}

function updateDocsSectionPageCounts(sections: DocsMcpDocsSection[]): number {
  let total = 0;
  for (const section of sections) {
    section.pageCount = section.pages.length + updateDocsSectionPageCounts(section.sections);
    total += section.pageCount;
  }
  return total;
}

function findDocsSection(
  sections: DocsMcpDocsSection[],
  section: string,
  entry?: string,
): DocsMcpDocsSection | undefined {
  for (const candidate of sections) {
    if (docsListSectionMatches(candidate, section, entry)) return candidate;
    const child = findDocsSection(candidate.sections, section, entry);
    if (child) return child;
  }
  return undefined;
}

function docsListSectionMatches(
  section: DocsMcpDocsSection,
  value: string,
  entry?: string,
): boolean {
  return docsListCandidates(section, entry).includes(normalizeDocsListMatchValue(value));
}

function docsListPageMatches(page: DocsMcpDocsPageSummary, value: string, entry?: string): boolean {
  return docsListCandidates(page, entry).includes(normalizeDocsListMatchValue(value));
}

function docsListCandidates(
  value: { slug: string; title: string; url?: string },
  entry?: string,
): string[] {
  return [
    value.slug,
    value.url,
    value.title,
    value.url ? stripDocsEntryFromPath(value.url, entry) : undefined,
    stripDocsEntryFromPath(value.slug, entry),
  ]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map(normalizeDocsListMatchValue);
}

function stripDocsEntryFromPath(value: string, entry?: string): string {
  const normalized = normalizePathSegment(value.replace(/\.md$/i, ""));
  const normalizedEntry = normalizePathSegment(entry ?? "");
  if (!normalizedEntry) return normalized;
  if (normalized === normalizedEntry) return "";
  if (normalized.startsWith(`${normalizedEntry}/`)) {
    return normalized.slice(normalizedEntry.length + 1);
  }
  return normalized;
}

function normalizeDocsListMatchValue(value: string): string {
  const withoutOrigin = value.replace(/^https?:\/\/[^/]+/i, "");
  return normalizePathSegment(withoutOrigin.replace(/\.md$/i, ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function cloneDocsSection(section: DocsMcpDocsSection): DocsMcpDocsSection {
  return {
    ...section,
    pages: section.pages.map((page) => ({ ...page })),
    sections: section.sections.map(cloneDocsSection),
  };
}

function flattenDocsSectionPages(section: DocsMcpDocsSection): DocsMcpDocsPageSummary[] {
  const seen = new Set<string>();
  const pages: DocsMcpDocsPageSummary[] = [];

  function add(page: DocsMcpDocsPageSummary) {
    if (seen.has(page.url)) return;
    seen.add(page.url);
    pages.push({ ...page });
  }

  function visit(current: DocsMcpDocsSection) {
    current.pages.forEach(add);
    current.sections.forEach(visit);
  }

  visit(section);
  return pages;
}

function countDocsSections(sections: DocsMcpDocsSection[]): number {
  return sections.reduce((total, section) => total + 1 + countDocsSections(section.sections), 0);
}

function extractDocsMcpCodeExamples(page: DocsMcpPage): DocsMcpCodeExample[] {
  const source = page.agentRawContent ?? page.agentFallbackRawContent ?? page.rawContent;
  if (!source) return [];

  const examples: DocsMcpCodeExample[] = [];
  const lines = source.split("\n");
  let index = 0;
  let openFence: { marker: string; info: string; code: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!openFence) {
      const openMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
      if (!openMatch) continue;

      openFence = {
        marker: openMatch[1],
        info: openMatch[2]?.trim() ?? "",
        code: [],
      };
      continue;
    }

    if (isClosingFence(trimmed, openFence.marker)) {
      const parsed = parseCodeFenceInfo(openFence.info);
      const meta = parsed.meta;
      const title = readStringMeta(meta, "title");
      const framework = readStringMeta(meta, "framework");
      const packageManager = readStringMeta(meta, "packageManager");
      const runnable = readBooleanMeta(meta, "runnable") ?? false;

      index += 1;
      examples.push({
        id: `${page.url}#code-${index}`,
        page: {
          slug: page.slug,
          url: page.url,
          title: page.title,
          description: page.description,
          sourcePath: page.sourcePath,
          lastModified: page.lastModified,
        },
        language: parsed.language,
        title,
        framework,
        packageManager,
        runnable,
        meta,
        code: openFence.code.join("\n"),
      });
      openFence = null;
      continue;
    }

    openFence.code.push(line);
  }

  return examples;
}

function filterDocsCodeExamples(
  examples: DocsMcpCodeExample[],
  filters: {
    query?: string;
    framework?: string;
    packageManager?: string;
    language?: string;
    runnable?: boolean;
    limit: number;
  },
): DocsMcpCodeExample[] {
  const query = filters.query?.toLowerCase();
  const framework = filters.framework?.toLowerCase();
  const packageManager = filters.packageManager?.toLowerCase();
  const language = filters.language?.toLowerCase();

  return examples
    .filter((example) => {
      if (framework && example.framework?.toLowerCase() !== framework) return false;
      if (packageManager && example.packageManager?.toLowerCase() !== packageManager) return false;
      if (language && example.language?.toLowerCase() !== language) return false;
      if (filters.runnable !== undefined && example.runnable !== filters.runnable) return false;
      if (!query) return true;
      return getCodeExampleSearchText(example).toLowerCase().includes(query);
    })
    .slice(0, filters.limit);
}

function isClosingFence(trimmedLine: string, marker: string): boolean {
  if (!trimmedLine.startsWith(marker)) return false;
  return trimmedLine.slice(marker.length).trim().length === 0;
}

function parseCodeFenceInfo(info: string): {
  language?: string;
  meta: Record<string, string | boolean>;
} {
  const trimmed = info.trim();
  if (!trimmed) return { meta: {} };

  const firstTokenMatch = trimmed.match(/^(\S+)/);
  const firstToken = firstTokenMatch?.[1] ?? "";
  const language = firstToken && !firstToken.includes("=") ? firstToken : undefined;
  const attributeSource = language ? trimmed.slice(firstToken.length).trim() : trimmed;
  const meta: Record<string, string | boolean> = {};
  const attributePattern = /([A-Za-z_:][\w:.-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(attributeSource))) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    meta[key] = value ?? true;
  }

  return { language, meta };
}

function readStringMeta(meta: Record<string, string | boolean>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readBooleanMeta(meta: Record<string, string | boolean>, key: string): boolean | undefined {
  const value = meta[key];
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return true;
}

function getCodeExampleSearchText(example: DocsMcpCodeExample): string {
  return [
    example.id,
    example.page.slug,
    example.page.url,
    example.page.title,
    example.page.description,
    example.page.sourcePath,
    example.language,
    example.title,
    example.framework,
    example.packageManager,
    ...Object.entries(example.meta).map(([key, value]) => `${key} ${String(value)}`),
    example.code,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
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
  if (page.agentRawContent !== undefined) return page.agentRawContent;

  const relatedLines = renderDocsRelatedMarkdownLines(page.related);

  const lines = [`# ${page.title}`, `URL: ${page.url}`];
  if (page.description) lines.push(`Description: ${page.description}`);
  lines.push(...relatedLines);
  lines.push("", page.agentFallbackRawContent ?? page.rawContent ?? page.content);
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

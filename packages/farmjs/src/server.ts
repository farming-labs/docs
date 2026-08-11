import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import matter from "gray-matter";
import { createElement, type ComponentType, type ReactElement } from "react";
import * as ReactDOMServer from "react-dom/server";
import {
  applySidebarFolderIndexBehavior,
  buildDocsAskAIContext,
  buildDocsSearchFacets,
  buildDocsAgentDiscoverySpec,
  buildDocsConfigMap,
  buildDocsDiagnostics,
  createDocsContentChangeFeed,
  createDocsContentChangesHttpResponse,
  createDocsCacheableResponse,
  createDocsStandardsDiscoveryResponse,
  createDocsMarkdownResponse,
  createDocsRobotsResponse,
  createDocsSitemapResponse,
  createDocsAgentTraceContext,
  createDocsAgentTraceId,
  emitDocsAgentTraceEvent,
  emitDocsAnalyticsEvent,
  emitDocsTelemetryAgentSurfaceEvent,
  emitDocsTelemetryProjectEvent,
  formatDocsAskAIPackageHints,
  findDocsMarkdownPage,
  getDocsLlmsTxtMaxCharsIssue,
  getDocsAgentManifestLinkHeader,
  getDocsDiscoveryLinkHeader,
  isDocsAgentDiscoveryRequest,
  isDocsContentChangesRequest,
  isDocsAgentsRequest,
  isDocsConfigRequest,
  isDocsDiagnosticsRequest,
  isDocsSkillRequest,
  normalizeDocsRelated,
  normalizePageAgentFrontmatter,
  normalizeDocsOkfTrustMetadataInput,
  parseDocsAgentFeedbackData,
  performDocsSearch,
  performDocsSearchWithMetadata,
  renderDocsMarkdownDocument,
  renderDocsLlmsTxt,
  renderDocsAgentsDocument,
  renderDocsSkillDocument,
  readDocsSitemapManifestFromContentMap,
  stripGeneratedAgentProvenance,
  resolveDocsAudienceMdxContent,
  resolveDocsAgentFeedbackConfig,
  resolveDocsAgentFeedbackRequest,
  resolvePageSidebarFolderIndexBehavior,
  resolveAskAISearchRequestConfig,
  resolveDocsSearchAudience,
  resolveDocsSearchError,
  resolveDocsSearchRequest,
  resolveSearchRequestConfig,
  resolveDocsI18n,
  resolveDocsLlmsTxtRequest,
  resolveDocsLocale,
  resolveDocsMarkdownRequest,
  resolveDocsMetadataBaseUrl,
  resolveDocsContentChangesConfig,
  resolveDocsRequestApiRoute,
  resolveDocsRetrievalLastModified,
  resolveDocsPublishedAgentSkill,
  resolveDocsStandardsDiscoveryRequest,
  resolveDocsPath,
  resolvePageReadingTime,
  resolveReadingTimeOptions,
  resolveDocsSitemapPageLastmod,
  resolveDocsAgentsFormat,
  resolveDocsSkillFormat,
  inferDocsTelemetryAgentSurface,
  renderDocsPageStructuredDataJson,
  selectDocsLlmsTxtContent,
  validateDocsAgentFeedbackPayload,
} from "@farming-labs/docs";
import type { DocsAgentTraceEventInput, DocsAskAIMcpConfig, DocsConfig } from "@farming-labs/docs";
import {
  buildApiReferenceOpenApiDocumentAsync,
  createDocsMcpHttpHandler,
  readDocsSitemapManifest,
  resolveApiReferenceConfig,
  resolveApiReferenceOpenApiDiscovery,
  resolveDocsMcpConfig,
  resolveConfiguredAgentSkills,
} from "@farming-labs/docs/server";

import type { DocsMcpHttpHandlers } from "@farming-labs/docs/server";
import {
  loadDocsNavTree,
  loadDocsContent,
  flattenNavTree,
  normalizeDocsFrontmatterLastmod,
  readFarmDocsLastModifiedManifest,
  resolveFarmDocsLastModified,
} from "./content.js";
import type { PageNode, NavNode, NavTree, ContentPage } from "./content.js";
import farmDocsBrowserCss from "./browser-css.generated.js";
export { createFarmjsApiReference } from "./api-reference.js";

const FARM_DOCS_BROWSER_CSS_PATH = "/__farm_docs/browser.css";

function loadFarmDocsBrowserCss(): string {
  return farmDocsBrowserCss;
}

async function renderFarmDocsMarkup(element: ReactElement): Promise<string> {
  const server = ReactDOMServer as typeof ReactDOMServer & {
    renderToReadableStream?: (
      children: ReactElement,
      options?: { onError?: (error: unknown) => void },
    ) => Promise<ReadableStream<Uint8Array> & { allReady?: Promise<void> }>;
  };

  if (server.renderToReadableStream) {
    const stream = await server.renderToReadableStream(element);
    await stream.allReady;
    return new Response(stream).text();
  }

  return new Promise<string>((resolve, reject) => {
    const destination = new PassThrough();
    const chunks: Buffer[] = [];
    destination.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    destination.on("error", reject);
    destination.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));

    const renderer = server.renderToPipeableStream(element, {
      onAllReady() {
        renderer.pipe(destination);
      },
      onShellError(error) {
        reject(error);
      },
      onError(error) {
        if (!destination.readableEnded) destination.destroy(error as Error);
      },
    });
  });
}

function isApiReferenceOpenApiRequest(url: URL): boolean {
  return url.searchParams.get("format")?.trim() === "openapi";
}

interface GithubConfigObj {
  url: string;
  branch?: string;
  directory?: string;
}

interface AIProviderConfig {
  baseUrl: string;
  apiKey?: string;
}

interface AIModelEntry {
  id: string;
  label: string;
  provider?: string;
}

interface AIConfigObj {
  enabled?: boolean;
  model?: string | { models?: AIModelEntry[]; defaultModel?: string };
  providers?: Record<string, AIProviderConfig>;
  systemPrompt?: string;
  baseUrl?: string;
  apiKey?: string;
  maxResults?: number;
  useMcp?: boolean | DocsAskAIMcpConfig;
  suggestedQuestions?: string[];
  aiLabel?: string;
  packageName?: string;
  docsUrl?: string;
}

function resolveAIModelAndProvider(
  aiConfig: AIConfigObj,
  requestedModelId?: string,
): { model: string; baseUrl: string; apiKey: string | undefined } {
  const raw = aiConfig.model;
  const modelList: AIModelEntry[] = (typeof raw === "object" && raw?.models) || [];

  let modelId = requestedModelId;
  if (!modelId) {
    if (typeof raw === "string") modelId = raw;
    else if (typeof raw === "object") modelId = raw.defaultModel ?? raw.models?.[0]?.id;
    if (!modelId) modelId = "gpt-4o-mini";
  }

  const entry = modelList.find((model) => model.id === modelId);
  const providerKey = entry?.provider;
  const providerConfig = providerKey && aiConfig.providers?.[providerKey];

  const baseUrl = (
    (providerConfig && providerConfig.baseUrl) ||
    aiConfig.baseUrl ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const apiKey =
    (providerConfig && providerConfig.apiKey) || aiConfig.apiKey || process.env?.OPENAI_API_KEY;

  return { model: modelId, baseUrl, apiKey };
}

function safeUrlOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export interface DocsServerLoadResult {
  tree: ReturnType<typeof loadDocsNavTree>;
  flatPages: PageNode[];
  url: string;
  title: string;
  description?: string;
  /** Whether the rendered MDX body already opens with the frontmatter description. */
  descriptionInBody?: boolean;
  rawContent: string;
  readingTime?: number | null;
  readingTimeFormat?: "long" | "short";
  sourcePath: string;
  entry?: string;
  locale?: string;
  slug?: string;
  previousPage: PageNode | null;
  nextPage: PageNode | null;
  editOnGithub?: string;
  lastModified: string;
  structuredData: string;
}

export interface DocsServer {
  load: (input: { pathname: string; locale?: string }) => Promise<DocsServerLoadResult>;
  GET: (context: { request: Request }) => Promise<Response>;
  HEAD: (context: { request: Request }) => Promise<Response>;
  POST: (context: { request: Request }) => Promise<Response>;
  MCP: DocsMcpHttpHandlers;
  /** Handle a Farm Web Request, or return null when it is not a docs route. */
  handle: (request: Request) => Promise<Response | null>;
}

interface FarmDocsRuntimeFont {
  className?: string;
  variable?: string;
  style?: {
    fontFamily?: string;
  };
  preloads?: readonly { href: string; type: string }[];
}

interface FarmDocsRuntimeFonts {
  body?: FarmDocsRuntimeFont;
  code?: FarmDocsRuntimeFont;
}

interface FarmDocsReactModule {
  FarmDocsPage: ComponentType<{ config: DocsConfig; data: DocsServerLoadResult }>;
}

export interface FarmDocsRuntimeHandlerOptions {
  /** Application root used to resolve the configured content directory. */
  rootDir?: string;
  /** Browser entry that hydrates the adapter-rendered page. */
  clientEntry?: string;
  /** Stylesheets owned by the host application. */
  stylesheets?: readonly string[];
  /** Resolve the semantic fonts exported by the host application's layouts. */
  resolveLayoutFonts?: (
    pathname: string,
  ) => FarmDocsRuntimeFonts | undefined | Promise<FarmDocsRuntimeFonts | undefined>;
  /** Development hook used by Farm to load the React entry through Vite SSR. */
  loadReactModule?: () => Promise<FarmDocsReactModule>;
}

type ContentFileMap = Record<string, string>;

interface FarmDocsNavigationItem {
  label?: string;
  title?: string;
  slug?: string;
  href?: string;
  icon?: string;
  children?: FarmDocsNavigationItem[];
  items?: FarmDocsNavigationItem[];
}

function navigationItemName(item: FarmDocsNavigationItem): string {
  return item.label?.trim() || item.title?.trim() || item.slug?.trim() || "Documentation";
}

function navigationItemUrl(item: FarmDocsNavigationItem, entry: string): string | undefined {
  if (item.href?.trim()) return item.href.trim();
  if (typeof item.slug !== "string") return undefined;
  const slug = item.slug.replace(/^\/+|\/+$/g, "");
  return slug ? `/${entry}/${slug}` : `/${entry}`;
}

function navTreeFromNavigation(config: Record<string, any>, entry: string): NavTree | null {
  const configured = config.navigation?.sidebar;
  if (!Array.isArray(configured) || configured.length === 0) return null;
  const defaultOpen = config.theme?.name === "fumadocs-pixel-border";

  function toNode(item: FarmDocsNavigationItem): NavNode | null {
    const children = item.children ?? item.items ?? [];
    const name = navigationItemName(item);
    const url = navigationItemUrl(item, entry);

    if (children.length > 0) {
      const mappedChildren = children.map(toNode).filter((node): node is NavNode => node !== null);
      return {
        type: "folder",
        name,
        ...(defaultOpen ? { defaultOpen: true } : {}),
        ...(item.icon ? { icon: item.icon } : {}),
        ...(url
          ? {
              index: {
                type: "page" as const,
                name,
                url,
                ...(item.icon ? { icon: item.icon } : {}),
              },
            }
          : {}),
        children: mappedChildren,
      };
    }

    if (!url) return null;
    return {
      type: "page",
      name,
      url,
      ...(item.icon ? { icon: item.icon } : {}),
    };
  }

  return {
    name:
      typeof config.nav?.title === "string" && config.nav.title.trim()
        ? config.nav.title.trim()
        : "Docs",
    children: configured
      .map((item: FarmDocsNavigationItem) => toNode(item))
      .filter((node: NavNode | null): node is NavNode => node !== null),
  };
}

function resolvePreloadedContent(value: unknown): ContentFileMap | null {
  if (!value || typeof value !== "object") return null;

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: ContentFileMap = {};

  for (const [key, entryValue] of entries) {
    if (typeof entryValue === "string") {
      normalized[key] = entryValue;
      continue;
    }

    if (
      entryValue &&
      typeof entryValue === "object" &&
      typeof (entryValue as { default?: unknown }).default === "string"
    ) {
      normalized[key] = (entryValue as { default: string }).default;
      continue;
    }

    return null;
  }

  return normalized;
}

function stripMarkdownText(content: string): string {
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

function markdownStartsWithDescription(content: string, description?: string): boolean {
  if (!description?.trim()) return false;

  const withoutLeadingTitle = content
    .trimStart()
    .replace(/^#\s+[^\r\n]+(?:\r?\n|$)/, "")
    .trimStart();
  const firstBlock = withoutLeadingTitle.split(/\r?\n\s*\r?\n/, 1)[0] ?? "";
  const normalize = (value: string) => stripMarkdownText(value).replace(/\s+/g, " ").trim();

  return normalize(firstBlock) === normalize(description);
}

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function joinPathParts(...parts: string[]): string {
  return parts
    .map((part) => normalizePathSegment(part))
    .filter(Boolean)
    .join("/");
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function buildDirPrefix(contentDir: string, rootDir: string): string {
  const rel = path.isAbsolute(contentDir)
    ? toPosixPath(path.relative(rootDir, contentDir))
    : toPosixPath(contentDir);
  const normalized = normalizePathSegment(rel);
  return normalized ? `/${normalized}/` : "/";
}

function toSourcePath(contentDir: string, relPath: string, rootDir: string): string {
  const base = path.isAbsolute(contentDir)
    ? toPosixPath(path.relative(rootDir, contentDir))
    : toPosixPath(contentDir);
  return `/${joinPathParts(base, toPosixPath(relPath))}`;
}

function navTreeFromMap(
  contentMap: ContentFileMap,
  dirPrefix: string,
  entry: string,
  ordering?: "alphabetical" | "numeric" | Array<{ slug: string; children?: any[] }>,
): NavTree {
  interface DirInfo {
    parts: string[];
    title: string;
    url: string;
    icon?: string;
    folderIndexBehavior?: "link" | "toggle" | "hidden";
    order: number;
  }

  const dirs: DirInfo[] = [];

  for (const key of Object.keys(contentMap)) {
    if (!key.startsWith(dirPrefix)) continue;

    const rel = key.slice(dirPrefix.length);
    const segments = rel.split("/");
    const fileName = segments.pop()!;
    const base = fileName.replace(/\.(md|mdx)$/, "");
    if (base !== "page" && base !== "index") continue;

    const { data } = matter(contentMap[key]);
    const dirParts = segments;
    const slug = dirParts.join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;
    const fallbackTitle =
      dirParts.length > 0
        ? dirParts[dirParts.length - 1]
            .replace(/-/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
        : "Documentation";

    dirs.push({
      parts: dirParts,
      title: (data.title as string) ?? fallbackTitle,
      url,
      icon: data.icon as string | undefined,
      folderIndexBehavior: resolvePageSidebarFolderIndexBehavior(data.sidebar),
      order: typeof data.order === "number" ? data.order : Infinity,
    });
  }

  dirs.sort((a, b) => {
    if (a.parts.length !== b.parts.length) return a.parts.length - b.parts.length;
    return a.parts.join("/").localeCompare(b.parts.join("/"));
  });

  const children: NavNode[] = [];
  const rootInfo = dirs.find((dir) => dir.parts.length === 0);
  if (rootInfo) {
    children.push({
      type: "page",
      name: rootInfo.title,
      url: rootInfo.url,
      icon: rootInfo.icon,
    });
  }

  function findSlugOrder(
    parentParts: string[],
  ): Array<{ slug: string; children?: any[] }> | undefined {
    if (!Array.isArray(ordering)) return undefined;
    let items: Array<{ slug: string; children?: any[] }> = ordering;
    for (const part of parentParts) {
      const found = items.find((item) => item.slug === part);
      if (!found?.children) return undefined;
      items = found.children;
    }
    return items;
  }

  function buildLevel(parentParts: string[]): NavNode[] {
    const depth = parentParts.length;

    const directChildren = dirs.filter((dir) => {
      if (dir.parts.length !== depth + 1) return false;
      for (let index = 0; index < depth; index++) {
        if (dir.parts[index] !== parentParts[index]) return false;
      }
      return true;
    });

    const slugOrder = findSlugOrder(parentParts);

    if (slugOrder) {
      const slugMap = new Set(slugOrder.map((item) => item.slug));
      const ordered: DirInfo[] = [];
      for (const item of slugOrder) {
        const match = directChildren.find((child) => child.parts[depth] === item.slug);
        if (match) ordered.push(match);
      }
      for (const child of directChildren) {
        if (!slugMap.has(child.parts[depth])) ordered.push(child);
      }

      return ordered.map((child) => {
        const hasGrandChildren = dirs.some((dir) => {
          if (dir.parts.length <= child.parts.length) return false;
          return child.parts.every((part, index) => dir.parts[index] === part);
        });

        if (hasGrandChildren) {
          return {
            type: "folder",
            name: child.title,
            icon: child.icon,
            index: { type: "page", name: child.title, url: child.url, icon: child.icon },
            folderIndexBehavior: child.folderIndexBehavior,
            children: buildLevel(child.parts),
          } satisfies NavNode;
        }

        return {
          type: "page",
          name: child.title,
          url: child.url,
          icon: child.icon,
        } satisfies NavNode;
      });
    }

    if (ordering === "numeric") {
      directChildren.sort((a, b) => a.order - b.order);
    }

    return directChildren.map((child) => {
      const hasGrandChildren = dirs.some((dir) => {
        if (dir.parts.length <= child.parts.length) return false;
        return child.parts.every((part, index) => dir.parts[index] === part);
      });

      if (hasGrandChildren) {
        return {
          type: "folder",
          name: child.title,
          icon: child.icon,
          index: { type: "page", name: child.title, url: child.url, icon: child.icon },
          folderIndexBehavior: child.folderIndexBehavior,
          children: buildLevel(child.parts),
        } satisfies NavNode;
      }

      return {
        type: "page",
        name: child.title,
        url: child.url,
        icon: child.icon,
      } satisfies NavNode;
    });
  }

  children.push(...buildLevel([]));
  return { name: "Docs", children };
}

function searchIndexFromMap(
  contentMap: ContentFileMap,
  dirPrefix: string,
  entry: string,
  locale?: string,
  sitemapManifest?: ReturnType<typeof readDocsSitemapManifestFromContentMap>,
): ContentPage[] {
  const pages: ContentPage[] = [];

  for (const key of Object.keys(contentMap)) {
    if (!key.startsWith(dirPrefix)) continue;

    const rel = key.slice(dirPrefix.length);
    const segments = rel.split("/");
    const fileName = segments.pop()!;
    if (fileName === "agent.md") continue;
    const base = fileName.replace(/\.(md|mdx)$/, "");
    const isIdx = base === "page" || base === "index";

    const raw = contentMap[key];
    const { data, content } = matter(raw);
    const humanRawContent = resolveDocsAudienceMdxContent(content, "human");
    const pageAgentRawContent = resolveDocsAudienceMdxContent(content, "agent");
    const related = normalizeDocsRelated(data.related);
    const slug = isIdx ? segments.join("/") : [...segments, base].join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;
    const manifestLastmod =
      (locale
        ? resolveDocsSitemapPageLastmod(
            sitemapManifest,
            `${url}?lang=${encodeURIComponent(locale)}`,
          )
        : undefined) ?? resolveDocsSitemapPageLastmod(sitemapManifest, url);
    const agentDoc = isIdx ? readAgentDocFromMap(contentMap, dirPrefix, slug) : undefined;
    const fallbackTitle = isIdx
      ? segments.length > 0
        ? segments[segments.length - 1]
            .replace(/-/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
        : "Documentation"
      : base.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

    pages.push({
      slug,
      url,
      title: (data.title as string) ?? fallbackTitle,
      description: data.description as string | undefined,
      ...(related.length > 0 ? { related } : {}),
      agent: normalizePageAgentFrontmatter(data.agent),
      okf: normalizeDocsOkfTrustMetadataInput(data.okf),
      icon: data.icon as string | undefined,
      lastmod: normalizeDocsFrontmatterLastmod(data.lastmod),
      locale: typeof data.locale === "string" ? data.locale : undefined,
      framework: typeof data.framework === "string" ? data.framework : undefined,
      version: typeof data.version === "string" ? data.version : undefined,
      tags: Array.isArray(data.tags)
        ? data.tags.filter((tag): tag is string => typeof tag === "string")
        : undefined,
      content: stripMarkdownText(humanRawContent),
      rawContent: humanRawContent,
      ...(manifestLastmod ? { lastModified: `${manifestLastmod}T00:00:00.000Z` } : {}),
      ...(pageAgentRawContent !== humanRawContent
        ? {
            agentFallbackContent: stripMarkdownText(pageAgentRawContent),
            agentFallbackRawContent: pageAgentRawContent,
          }
        : {}),
      ...agentDoc,
    });
  }

  return pages;
}

function readAgentDocFromMap(contentMap: ContentFileMap, dirPrefix: string, slug: string) {
  const key = slug ? `${dirPrefix}${slug}/agent.md` : `${dirPrefix}agent.md`;
  const raw = contentMap[key];
  if (!raw) return undefined;

  const { content } = matter(stripGeneratedAgentProvenance(raw));
  const agentRawContent = resolveDocsAudienceMdxContent(content, "agent");
  return {
    agentContent: stripMarkdownText(agentRawContent),
    agentRawContent,
  };
}

function findPageInMap(contentMap: ContentFileMap, dirPrefix: string, slug: string) {
  const candidates = slug
    ? [
        `${dirPrefix}${slug}.md`,
        `${dirPrefix}${slug}.mdx`,
        `${dirPrefix}${slug}/page.md`,
        `${dirPrefix}${slug}/page.mdx`,
        `${dirPrefix}${slug}/index.md`,
        `${dirPrefix}${slug}/index.mdx`,
      ]
    : [
        `${dirPrefix}page.md`,
        `${dirPrefix}page.mdx`,
        `${dirPrefix}index.md`,
        `${dirPrefix}index.mdx`,
      ];

  for (const key of candidates) {
    const raw = contentMap[key];
    if (raw) {
      return {
        raw,
        relPath: key.slice(dirPrefix.length),
      };
    }
  }

  return null;
}

function readRootSkillDocument(contentMap: ContentFileMap | null, rootDir: string): string | null {
  if (contentMap) {
    for (const key of ["/skill.md", "skill.md", "./skill.md"]) {
      const raw = contentMap[key];
      if (typeof raw === "string") return raw;
    }
  }

  const candidate = path.join(rootDir, "skill.md");
  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.readFileSync(candidate, "utf-8");
    }
  } catch {
    return null;
  }

  return null;
}

function readRootAgentsDocument(contentMap: ContentFileMap | null, rootDir: string): string | null {
  if (contentMap) {
    for (const key of [
      "/AGENTS.md",
      "AGENTS.md",
      "./AGENTS.md",
      "/AGENT.md",
      "AGENT.md",
      "./AGENT.md",
    ]) {
      const raw = contentMap[key];
      if (typeof raw === "string") return raw;
    }
  }

  for (const fileName of ["AGENTS.md", "AGENT.md"]) {
    const candidate = path.join(rootDir, fileName);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return fs.readFileSync(candidate, "utf-8");
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function createDocsServer(config: Record<string, any>): DocsServer {
  const entry = config.entry ?? "docs";
  const analytics = config.analytics;
  const observability = config.observability;
  const ordering = config.ordering;
  const contentDirBase = config.contentDir ?? entry;
  const rootDir = path.resolve((config.rootDir as string | undefined) ?? process.cwd());
  let publishedAgentSkills: ReturnType<typeof resolveConfiguredAgentSkills> | undefined;
  function getPublishedAgentSkills() {
    publishedAgentSkills ??= Array.isArray(config._preloadedAgentSkills)
      ? Promise.resolve(config._preloadedAgentSkills)
      : resolveConfiguredAgentSkills(config.agent?.skills, { rootDir });
    return publishedAgentSkills;
  }
  const preloaded = resolvePreloadedContent(config._preloadedContent);
  const preloadedSitemapManifest = readDocsSitemapManifestFromContentMap(preloaded);
  const i18n = resolveDocsI18n(config.i18n);

  const githubRaw = config.github as string | GithubConfigObj | undefined;
  const githubRepo =
    typeof githubRaw === "string"
      ? githubRaw.replace(/\/$/, "")
      : githubRaw?.url.replace(/\/$/, "");
  const githubBranch = typeof githubRaw === "object" ? (githubRaw.branch ?? "main") : "main";
  const githubDirectory =
    typeof githubRaw === "object" ? githubRaw.directory?.replace(/^\/|\/$/g, "") : undefined;
  const readingTimeOptions = resolveReadingTimeOptions(config.readingTime);

  const aiConfig: AIConfigObj = { enabled: false, ...config.ai };
  if (config.apiKey && !aiConfig.apiKey) {
    aiConfig.apiKey = config.apiKey as string;
  }

  function normalizePathname(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, "");
    return trimmed || "/";
  }

  function resolveContentDirRel(locale?: string | null): string {
    if (!locale) return contentDirBase;
    if (path.isAbsolute(contentDirBase)) return path.join(contentDirBase, locale);
    return joinPathParts(contentDirBase, locale);
  }

  function resolveContextFromPath(pathname: string, locale?: string) {
    const match = resolveDocsPath(normalizePathname(pathname), entry);
    const contentDirRel = resolveContentDirRel(locale);
    return {
      ...match,
      locale,
      contentDirRel,
      contentDirAbs: path.isAbsolute(contentDirRel)
        ? contentDirRel
        : path.resolve(rootDir, contentDirRel),
      dirPrefix: buildDirPrefix(contentDirRel, rootDir),
    };
  }

  function resolveLocaleFromRequest(request: Request): string | undefined {
    if (!i18n) return undefined;
    const url = new URL(request.url);
    const direct = resolveDocsLocale(url.searchParams, i18n);
    if (direct) return direct;

    const referrer = request.headers.get("referer") ?? request.headers.get("referrer");
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        const fromRef = resolveDocsLocale(refUrl.searchParams, i18n);
        if (fromRef) return fromRef;
      } catch {
        // ignore malformed referrer URLs
      }
    }

    return i18n.defaultLocale;
  }

  function resolveContextFromRequest(request: Request) {
    const locale = resolveLocaleFromRequest(request);
    const url = new URL(request.url);
    const pathnameParam = url.searchParams.get("pathname");
    const referrer = request.headers.get("referer") ?? request.headers.get("referrer");
    let refPath: string | undefined;
    if (referrer) {
      try {
        refPath = new URL(referrer).pathname;
      } catch {
        refPath = undefined;
      }
    }
    const pathname = pathnameParam ?? refPath ?? `/${entry}`;
    return resolveContextFromPath(pathname, locale);
  }

  async function load({ pathname, locale }: { pathname: string; locale?: string }) {
    const resolvedLocale =
      (i18n && locale && i18n.locales.includes(locale) ? locale : undefined) ?? i18n?.defaultLocale;
    const ctx = resolveContextFromPath(pathname, resolvedLocale);
    const configuredNavigation = navTreeFromNavigation(config, entry);
    const tree = applySidebarFolderIndexBehavior(
      configuredNavigation ??
        (preloaded
          ? navTreeFromMap(preloaded, ctx.dirPrefix, entry, ordering)
          : loadDocsNavTree(ctx.contentDirAbs, entry, ordering)),
      {
        sidebar: config.sidebar,
        defaultBehavior: "link",
      },
    );
    const flatPages = flattenNavTree(tree);

    const slug = ctx.slug;
    const isIndex = slug === "";
    const currentUrl = isIndex ? `/${entry}` : `/${entry}/${slug}`;

    let raw: string;
    let relPath: string;
    let lastModified: string;
    let lastModifiedIso: string | undefined;

    if (preloaded) {
      const result = findPageInMap(preloaded, ctx.dirPrefix, slug);
      if (!result) {
        const error = new Error(`Page not found: /${entry}/${slug}`) as Error & { status?: number };
        error.status = 404;
        throw error;
      }

      raw = result.raw;
      relPath = result.relPath;
      const manifestLastmod = resolveDocsSitemapPageLastmod(preloadedSitemapManifest, currentUrl);
      const lastModifiedDate = manifestLastmod
        ? new Date(`${manifestLastmod}T00:00:00`)
        : new Date();
      lastModified = lastModifiedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      lastModifiedIso = manifestLastmod ? `${manifestLastmod}T00:00:00.000Z` : undefined;
    } else {
      let filePath: string | null = null;
      relPath = "";

      if (isIndex) {
        for (const name of ["page.md", "page.mdx", "index.md", "index.mdx"]) {
          const candidate = path.join(ctx.contentDirAbs, name);
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            relPath = name;
            break;
          }
        }
      } else {
        const candidates = [
          path.join(ctx.contentDirAbs, `${slug}.md`),
          path.join(ctx.contentDirAbs, `${slug}.mdx`),
          path.join(ctx.contentDirAbs, slug, "page.md"),
          path.join(ctx.contentDirAbs, slug, "page.mdx"),
          path.join(ctx.contentDirAbs, slug, "index.md"),
          path.join(ctx.contentDirAbs, slug, "index.mdx"),
        ];

        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            relPath = path.relative(ctx.contentDirAbs, candidate);
            break;
          }
        }
      }

      if (!filePath) {
        const error = new Error(`Page not found: /${entry}/${slug}`) as Error & { status?: number };
        error.status = 404;
        throw error;
      }

      raw = fs.readFileSync(filePath, "utf-8");
      const stat = fs.statSync(filePath);
      lastModifiedIso =
        resolveFarmDocsLastModified(
          ctx.contentDirAbs,
          filePath,
          readFarmDocsLastModifiedManifest(ctx.contentDirAbs),
        ) ?? stat.mtime.toISOString();
      lastModified = new Date(lastModifiedIso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    const { data, content } = matter(raw);
    const humanRawContent = resolveDocsAudienceMdxContent(content, "human");
    const readingTime = resolvePageReadingTime(data, humanRawContent, {
      enabledByDefault: readingTimeOptions.enabled,
      wordsPerMinute: readingTimeOptions.wordsPerMinute,
      includeCode: readingTimeOptions.includeCode,
    });

    const currentIndex = flatPages.findIndex((page) => page.url === currentUrl);
    const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
    const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

    let editOnGithub: string | undefined;
    if (githubRepo) {
      const contentPath = normalizePathSegment(
        path.isAbsolute(ctx.contentDirRel)
          ? toPosixPath(path.relative(rootDir, ctx.contentDirRel))
          : toPosixPath(ctx.contentDirRel),
      );
      const configuredDirectory = normalizePathSegment(githubDirectory ?? "");
      const sourceDirectory =
        configuredDirectory &&
        (contentPath === configuredDirectory || contentPath.startsWith(`${configuredDirectory}/`))
          ? contentPath
          : joinPathParts(configuredDirectory, contentPath);
      const sourcePath = joinPathParts(sourceDirectory, toPosixPath(relPath));
      editOnGithub = `${githubRepo}/edit/${githubBranch}/${sourcePath}`;
    }

    const fallbackTitle = isIndex
      ? "Documentation"
      : (slug.split("/").pop()?.replace(/-/g, " ") ?? "Documentation");

    const title = (data.title as string) ?? fallbackTitle;
    const description = data.description as string | undefined;
    const descriptionInBody = markdownStartsWithDescription(humanRawContent, description);
    const structuredData = renderDocsPageStructuredDataJson({
      title,
      description,
      url: currentUrl,
      baseUrl: resolveDocsMetadataBaseUrl(config as any),
      entry,
      dateModified: lastModifiedIso,
      agent: normalizePageAgentFrontmatter(data.agent),
    });

    return {
      tree,
      flatPages,
      url: currentUrl,
      title,
      description,
      descriptionInBody,
      rawContent: humanRawContent,
      readingTime,
      readingTimeFormat: readingTimeOptions.format,
      sourcePath: toSourcePath(ctx.contentDirRel, relPath, rootDir),
      entry,
      locale: ctx.locale,
      ...(isIndex ? {} : { slug }),
      previousPage,
      nextPage,
      editOnGithub,
      lastModified,
      structuredData,
    };
  }

  const searchIndexByEntry = new Map<string, ContentPage[]>();

  function getSearchIndex(ctx: ReturnType<typeof resolveContextFromPath>) {
    const key = ctx.locale ?? "__default__";
    const cached = searchIndexByEntry.get(key);
    if (cached) return cached;
    const index = preloaded
      ? searchIndexFromMap(preloaded, ctx.dirPrefix, entry, ctx.locale, preloadedSitemapManifest)
      : loadDocsContent(ctx.contentDirAbs, entry);
    searchIndexByEntry.set(key, index);
    return index;
  }

  const llmsSiteTitle =
    typeof config.nav === "object" && typeof config.nav?.title === "string"
      ? config.nav.title
      : "Documentation";

  const llmsTxtConfig = config.llmsTxt as
    | boolean
    | {
        enabled?: boolean;
        apiCatalog?: boolean;
        baseUrl?: string;
        siteTitle?: string;
        siteDescription?: string;
        maxChars?: { mode?: "warn" | "error" | "off"; chars?: number };
        sections?: Array<{
          title: string;
          description?: string;
          match: string | string[];
          maxChars?: { mode?: "warn" | "error" | "off"; chars?: number };
        }>;
      }
    | undefined;

  const llmsBaseUrl = typeof llmsTxtConfig === "object" ? (llmsTxtConfig.baseUrl ?? "") : "";
  const markdownMetadataBaseUrl = resolveDocsMetadataBaseUrl(config as any);
  const contentChangesConfig = resolveDocsContentChangesConfig(config.agent?.contentChanges, {
    staticExport: config.staticExport === true,
  });
  const contentChangeFeed = createDocsContentChangeFeed(config.agent?.contentChanges);
  const llmsTitle =
    typeof llmsTxtConfig === "object" ? (llmsTxtConfig.siteTitle ?? llmsSiteTitle) : llmsSiteTitle;
  const llmsDesc = typeof llmsTxtConfig === "object" ? llmsTxtConfig.siteDescription : undefined;
  const llmsEnabled =
    llmsTxtConfig !== false &&
    !(llmsTxtConfig && typeof llmsTxtConfig === "object" && llmsTxtConfig.enabled === false);
  const apiCatalogEnabled = typeof llmsTxtConfig !== "object" || llmsTxtConfig.apiCatalog !== false;
  const configuredApiRoute =
    typeof config.cloud?.apiRoute === "string" && config.cloud.apiRoute.trim()
      ? config.cloud.apiRoute
      : undefined;
  const discoveryLinkHeader = getDocsDiscoveryLinkHeader({
    includeApiCatalog: apiCatalogEnabled,
    includeAgentCard: Boolean(config.agent?.a2a),
  });
  const agentManifestLinkHeader = getDocsAgentManifestLinkHeader(discoveryLinkHeader);
  const openapiDiscovery = resolveApiReferenceOpenApiDiscovery(config.apiReference);
  const mcpConfig = resolveDocsMcpConfig(config.mcp, {
    defaultName: llmsTitle,
  });
  const agentFeedbackConfig = resolveDocsAgentFeedbackConfig(config.feedback);
  const agentFeedbackDiscovery = {
    enabled: agentFeedbackConfig.enabled,
    route: "/api/docs?feedback=agent",
    schemaRoute: "/api/docs?feedback=agent&schema=1",
  };

  const llmsCache = new Map<
    string | undefined,
    { apiRoute: string; content: ReturnType<typeof renderDocsLlmsTxt> }
  >();

  function trackTelemetryRequest(request: Request) {
    emitDocsTelemetryProjectEvent(config, {
      framework: "farmjs",
      request,
    });

    const surface = inferDocsTelemetryAgentSurface(request, {
      entry,
      llmsTxt: config.llmsTxt,
      feedback: config.feedback,
    });

    if (!surface) return;

    emitDocsTelemetryAgentSurfaceEvent(config, {
      framework: "farmjs",
      request,
      surface,
    });
  }

  function getLlmsContent(ctx: ReturnType<typeof resolveContextFromPath>, apiRoute: string) {
    const cached = llmsCache.get(ctx.locale);
    if (cached?.apiRoute === apiRoute) return cached.content;

    const next = renderDocsLlmsTxt(getSearchIndex(ctx), {
      siteTitle: llmsTitle,
      siteDescription: llmsDesc,
      baseUrl: llmsBaseUrl,
      apiRoute,
      maxChars: typeof llmsTxtConfig === "object" ? llmsTxtConfig.maxChars : undefined,
      sections: typeof llmsTxtConfig === "object" ? llmsTxtConfig.sections : undefined,
      openapi: openapiDiscovery,
      apiCatalog: apiCatalogEnabled,
    } as any);
    llmsCache.set(ctx.locale, { apiRoute, content: next });
    return next;
  }

  function resolveLocaleForMcp(locale?: string): string | undefined {
    if (!i18n) return undefined;
    if (locale && i18n.locales.includes(locale)) return locale;
    return i18n.defaultLocale;
  }

  function getMarkdownRepresentation(
    ctx: ReturnType<typeof resolveContextFromPath>,
    requestedPath: string,
    origin?: string,
  ) {
    const page = findDocsMarkdownPage(entry, getSearchIndex(ctx), requestedPath);
    return page
      ? {
          document: renderDocsMarkdownDocument(page, {
            origin,
            sitemap: config.sitemap,
            okf: config.agent?.okf,
          }),
          lastModified: resolveDocsRetrievalLastModified(page, "agent"),
          access: page.agent?.access,
        }
      : null;
  }

  function createDiscoveryOptions(origin: string, apiRoute: string) {
    return {
      origin,
      entry,
      apiRoute,
      docsPath: config.docsPath,
      apiCatalog: apiCatalogEnabled,
      i18n,
      search: config.search,
      contentChanges: contentChangesConfig.enabled,
      mcp: mcpConfig,
      feedback: agentFeedbackDiscovery,
      llms: {
        enabled: llmsEnabled,
        apiCatalog: apiCatalogEnabled,
        baseUrl: llmsBaseUrl || undefined,
        siteTitle: llmsTitle,
        siteDescription: llmsDesc,
        maxChars: typeof llmsTxtConfig === "object" ? llmsTxtConfig.maxChars : undefined,
        sections: typeof llmsTxtConfig === "object" ? llmsTxtConfig.sections : undefined,
      },
      sitemap: config.sitemap,
      robots: config.robots,
      openapi: openapiDiscovery,
      markdown: {
        acceptHeader: true,
      },
    } as any;
  }

  async function resolveStandardsResponse(
    request: Request,
    url: URL,
    discoveryOptions: ReturnType<typeof createDiscoveryOptions>,
  ): Promise<Response | null> {
    const resolved = resolveDocsStandardsDiscoveryRequest(url, {
      apiRoute: discoveryOptions.apiRoute,
    });
    if (!resolved) return null;
    const method = request.method.toUpperCase();
    const needsSkill = (method === "GET" || method === "HEAD") && resolved.kind !== "api-catalog";

    return createDocsStandardsDiscoveryResponse({
      request,
      ...discoveryOptions,
      preferredSkillDocument: needsSkill ? readRootSkillDocument(preloaded, rootDir) : null,
      fallbackSkillDocument: needsSkill ? renderDocsSkillDocument(discoveryOptions) : "",
      publishedSkills: needsSkill ? await getPublishedAgentSkills() : [],
      agentCard: config.agent?.a2a,
    });
  }

  async function GET(event: { request: Request }): Promise<Response> {
    trackTelemetryRequest(event.request);
    const ctx = resolveContextFromRequest(event.request);
    const url = new URL(event.request.url);
    const isHeadRequest = event.request.method.toUpperCase() === "HEAD";
    const requestApiRoute = resolveDocsRequestApiRoute(url, configuredApiRoute);

    if (isDocsConfigRequest(url)) {
      return new Response(JSON.stringify(buildDocsConfigMap(config as any), null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600",
          "X-Robots-Tag": "noindex",
        },
      });
    }

    if (isDocsDiagnosticsRequest(url)) {
      return new Response(
        JSON.stringify(
          buildDocsDiagnostics(config as any, {
            adapter: "farmjs",
            entry,
            apiRoute: requestApiRoute,
            i18n,
            mcp: mcpConfig,
            feedback: agentFeedbackDiscovery,
            openapi: openapiDiscovery,
          }),
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=3600",
            "X-Robots-Tag": "noindex",
          },
        },
      );
    }

    const discoveryApiRoute = requestApiRoute;
    const discoveryOptions = createDiscoveryOptions(url.origin, discoveryApiRoute);
    const standardsDiscoveryResponse = await resolveStandardsResponse(
      event.request,
      url,
      discoveryOptions,
    );
    if (standardsDiscoveryResponse) return standardsDiscoveryResponse;

    if (isDocsAgentDiscoveryRequest(url, { apiRoute: discoveryApiRoute })) {
      const content = `${JSON.stringify(
        buildDocsAgentDiscoverySpec({
          ...discoveryOptions,
          publishedSkills: [
            await resolveDocsPublishedAgentSkill({
              preferredDocument: readRootSkillDocument(preloaded, rootDir),
              fallbackDocument: renderDocsSkillDocument(discoveryOptions),
            }),
            ...(await getPublishedAgentSkills()),
          ],
          agentCard: config.agent?.a2a,
        }),
        null,
        2,
      )}\n`;
      return createDocsCacheableResponse({
        request: event.request,
        content,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600",
          "X-Robots-Tag": "noindex",
          Link: agentManifestLinkHeader,
        },
      });
    }

    if (isDocsContentChangesRequest(url)) {
      if (!contentChangesConfig.enabled) {
        return new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
        });
      }
      return createDocsContentChangesHttpResponse({
        request: event.request,
        feed: contentChangeFeed,
        pages: getSearchIndex(ctx),
        search: config.search,
        locale: ctx.locale,
        baseUrl: markdownMetadataBaseUrl || url.origin,
      });
    }

    if (isApiReferenceOpenApiRequest(url)) {
      if (!openapiDiscovery.enabled) {
        return new Response("Not Found", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
          },
        });
      }

      if (isHeadRequest) {
        return new Response(null, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=3600",
            "X-Robots-Tag": "noindex",
          },
        });
      }

      const document = await buildApiReferenceOpenApiDocumentAsync(config as any, {
        framework: "farmjs",
        rootDir,
        baseUrl: url.origin,
      });

      return new Response(JSON.stringify(document, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600",
          "X-Robots-Tag": "noindex",
        },
      });
    }

    const agentFeedbackRequest = resolveDocsAgentFeedbackRequest(url, agentFeedbackConfig);
    if (agentFeedbackRequest) {
      if (agentFeedbackRequest.kind === "submit") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: {
            Allow: "POST",
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }

      return new Response(
        isHeadRequest ? null : JSON.stringify(agentFeedbackConfig.schema, null, 2),
        {
          headers: {
            "Content-Type": "application/schema+json; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=3600",
            "X-Robots-Tag": "noindex",
          },
        },
      );
    }

    if (
      isDocsAgentsRequest(url, { apiRoute: discoveryApiRoute }) ||
      resolveDocsAgentsFormat(url) === "agents"
    ) {
      const content =
        readRootAgentsDocument(preloaded, rootDir) ?? renderDocsAgentsDocument(discoveryOptions);
      return createDocsCacheableResponse({
        request: event.request,
        content,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600",
          "X-Robots-Tag": "noindex",
          Link: discoveryLinkHeader,
        },
      });
    }

    if (
      isDocsSkillRequest(url, { apiRoute: discoveryApiRoute }) ||
      resolveDocsSkillFormat(url) === "skill"
    ) {
      const content =
        readRootSkillDocument(preloaded, rootDir) ?? renderDocsSkillDocument(discoveryOptions);
      return createDocsCacheableResponse({
        request: event.request,
        content,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600",
          "X-Robots-Tag": "noindex",
          Link: discoveryLinkHeader,
        },
      });
    }

    const sitemapResponse = createDocsSitemapResponse({
      request: event.request,
      apiRoute: discoveryApiRoute,
      sitemap: config.sitemap,
      entry,
      siteTitle: llmsTitle,
      baseUrl: llmsBaseUrl || url.origin,
      pages: getSearchIndex(ctx),
      manifest: preloadedSitemapManifest ?? readDocsSitemapManifest(rootDir, config.sitemap),
    });
    if (sitemapResponse) return sitemapResponse;

    const robotsResponse = createDocsRobotsResponse({
      agentCard: Boolean(config.agent?.a2a),
      request: event.request,
      entry,
      apiCatalog: apiCatalogEnabled,
      sitemap: config.sitemap,
      baseUrl: llmsBaseUrl || url.origin,
      robots: config.robots,
    });
    if (robotsResponse) return robotsResponse;

    const markdownRequest = resolveDocsMarkdownRequest(entry, url, event.request, {
      apiRoute: discoveryApiRoute,
    });
    if (markdownRequest) {
      const markdownOrigin = markdownMetadataBaseUrl || url.origin;
      const representation = getMarkdownRepresentation(
        ctx,
        markdownRequest.requestedPath,
        markdownOrigin,
      );
      return createDocsMarkdownResponse({
        request: event.request,
        apiRoute: discoveryApiRoute,
        document: representation?.document ?? null,
        entry,
        requestedPath: markdownRequest.requestedPath,
        origin: markdownOrigin,
        locale: ctx.locale,
        lastModified: representation?.lastModified,
        access: representation?.access,
        pages: getSearchIndex(ctx),
        sitemap: config.sitemap,
      });
    }

    const llmsRequest = resolveDocsLlmsTxtRequest(url, llmsTxtConfig, entry, {
      apiRoute: discoveryApiRoute,
    });
    if (llmsRequest) {
      if (!llmsEnabled) {
        return new Response("Not Found", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
          },
        });
      }

      const selected = selectDocsLlmsTxtContent(getLlmsContent(ctx, requestApiRoute), llmsRequest);
      if (!selected) {
        return new Response("Not Found", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
          },
        });
      }

      const budgetIssue = getDocsLlmsTxtMaxCharsIssue(
        selected.label,
        selected.content,
        selected.maxChars,
      );
      if (budgetIssue?.mode === "error") {
        return new Response(budgetIssue.message, {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
          },
        });
      }
      if (budgetIssue?.mode === "warn") {
        console.warn(`[docs] ${budgetIssue.message}`);
      }

      return createDocsCacheableResponse({
        request: event.request,
        content: selected.content,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const query = url.searchParams.get("query")?.trim();
    const audience = resolveDocsSearchAudience(url.searchParams.get("audience"));
    let searchRequest;
    try {
      searchRequest = resolveDocsSearchRequest(url.searchParams);
    } catch (error) {
      const searchError = resolveDocsSearchError(error);
      if (!searchError) throw error;
      return Response.json({ error: searchError }, { status: 400 });
    }
    const { filters, structured, explain, facets, facet, cursor, limit } = searchRequest;
    if (!query && !structured && !facets) {
      return new Response("[]", {
        headers: { "Content-Type": "application/json" },
      });
    }
    const searchOptions = {
      pages: getSearchIndex(ctx),
      query: query ?? "",
      search: resolveSearchRequestConfig(config.search, event.request.url, {
        localMcp: config.mcp,
      }),
      audience,
      filters,
      explain,
      locale: ctx.locale,
      pathname: url.searchParams.get("pathname") ?? undefined,
      siteTitle: llmsTitle,
      baseUrl: markdownMetadataBaseUrl || url.origin,
      syncBaseUrl: markdownMetadataBaseUrl ?? null,
      facet,
      cursor,
      limit,
    };
    const searchStartedAt = Date.now();
    let searchResponse;
    try {
      searchResponse = facets
        ? await buildDocsSearchFacets(searchOptions)
        : structured
          ? await performDocsSearchWithMetadata(searchOptions)
          : query
            ? await performDocsSearch(searchOptions)
            : [];
    } catch (error) {
      const searchError = resolveDocsSearchError(error);
      if (!searchError) throw error;
      return Response.json({ error: searchError }, { status: 400 });
    }
    if (facets) {
      return Response.json(searchResponse, {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      });
    }
    if (!query) {
      return Response.json(searchResponse);
    }

    const resultCount = Array.isArray(searchResponse)
      ? searchResponse.length
      : "resultCount" in searchResponse
        ? searchResponse.resultCount
        : searchResponse.matchedPageCount;
    await emitDocsAnalyticsEvent(analytics, {
      type: "api_search",
      source: "server",
      url: `${url.origin}${url.pathname}`,
      path: url.pathname,
      locale: ctx.locale,
      input: { query },
      properties: {
        queryLength: query.length,
        audience,
        resultCount,
        pathname: url.searchParams.get("pathname") ?? undefined,
        durationMs: Math.max(0, Date.now() - searchStartedAt),
      },
    });

    return new Response(JSON.stringify(searchResponse), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectName = typeof config.nav?.title === "string" ? (config.nav.title as string) : null;
  const packageName = aiConfig.packageName;
  const docsUrl = aiConfig.docsUrl;

  function buildDefaultSystemPrompt(): string {
    const lines = [
      `You are a helpful documentation assistant${projectName ? ` for ${projectName}` : ""}.`,
      "Answer only from the provided documentation context.",
      "Prefer exact code/config snippets from the context when the question asks how to implement something.",
      "Cite the relevant documentation URL when you use a source.",
      "Use only URLs exactly as they appear in the context; do not invent placeholder domains.",
      'Never use placeholder package names or imports such as "your-auth-library", "your-package", "your-sdk", "replace-me", or "example-library". If the exact package or import is not in the context, do not include an import snippet.',
      "Be concise and accurate. If the answer is not in the context, say so honestly.",
      "Use markdown formatting for code examples and links.",
    ];
    if (packageName) {
      lines.push(
        `When showing import examples, use "${packageName}" as the package name and prefer exact imports copied from the documentation context.`,
      );
    }
    if (docsUrl) {
      lines.push(
        `When linking to documentation pages, use "${docsUrl}" as the base URL (e.g. ${docsUrl}/docs/get-started).`,
      );
    }
    return lines.join(" ");
  }

  const DEFAULT_SYSTEM_PROMPT = buildDefaultSystemPrompt();

  interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
  }

  async function POST(event: { request: Request }): Promise<Response> {
    trackTelemetryRequest(event.request);
    const requestUrl = new URL(event.request.url);
    const standardsDiscoveryResponse = await resolveStandardsResponse(
      event.request,
      requestUrl,
      createDiscoveryOptions(
        requestUrl.origin,
        resolveDocsRequestApiRoute(requestUrl, configuredApiRoute),
      ),
    );
    if (standardsDiscoveryResponse) return standardsDiscoveryResponse;

    const agentFeedbackRequest = resolveDocsAgentFeedbackRequest(requestUrl, agentFeedbackConfig);
    if (agentFeedbackRequest) {
      if (agentFeedbackRequest.kind === "schema") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: {
            Allow: "GET",
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }

      const parsed = await parseDocsAgentFeedbackData(event.request);
      if (!parsed.ok) return parsed.response;

      const payloadError = validateDocsAgentFeedbackPayload(
        parsed.data.payload,
        agentFeedbackConfig.payloadSchema,
      );
      if (payloadError) return Response.json({ error: payloadError }, { status: 400 });

      if (!agentFeedbackConfig.onFeedback) {
        return Response.json({ ok: true, handled: false }, { status: 202 });
      }

      await agentFeedbackConfig.onFeedback(parsed.data);
      return Response.json({ ok: true, handled: true }, { status: 201 });
    }

    const requestStartedAt = Date.now();
    const trace = createDocsAgentTraceContext("ask-ai");
    const runSpanId = createDocsAgentTraceId("span");
    const traceBase = {
      source: "server" as const,
      traceId: trace.traceId,
      url: event.request.url,
      path: requestUrl.pathname,
    };

    async function emitTrace(traceEvent: DocsAgentTraceEventInput): Promise<void> {
      await emitDocsAgentTraceEvent(observability, {
        ...traceBase,
        ...traceEvent,
      });
    }

    async function emitRunError(
      reason: string,
      outputPreview: Record<string, unknown> = {},
    ): Promise<void> {
      const endedAt = new Date().toISOString();
      const elapsed = Math.max(0, Date.now() - requestStartedAt);
      const common = {
        name: "ask-ai",
        startedAt: trace.startedAt,
        endedAt,
        durationMs: elapsed,
        status: "error" as const,
        outputPreview: {
          reason,
          ...outputPreview,
        },
        metadata: { reason },
      };

      await emitTrace({ ...common, type: "error", parentSpanId: runSpanId });
      await emitTrace({ ...common, type: "run.error", spanId: runSpanId });
      await emitTrace({ ...common, type: "run.end", spanId: runSpanId });
    }

    await emitTrace({
      type: "run.start",
      name: "ask-ai",
      spanId: runSpanId,
      startedAt: trace.startedAt,
      durationMs: 0,
      status: "started",
      inputPreview: {
        method: event.request.method,
        path: requestUrl.pathname,
      },
    });

    if (!aiConfig.enabled) {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: event.request.url,
        path: requestUrl.pathname,
        properties: {
          reason: "disabled",
        },
      });
      await emitRunError("disabled", { status: 404 });
      return new Response(
        JSON.stringify({
          error: "AI is not enabled. Set `ai: { enabled: true }` in your docs config to enable it.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const resolvedKey = aiConfig.apiKey ?? process.env?.OPENAI_API_KEY;

    if (!resolvedKey) {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: event.request.url,
        path: requestUrl.pathname,
        properties: {
          reason: "missing_api_key",
          durationMs: Math.max(0, Date.now() - requestStartedAt),
        },
      });
      await emitRunError("missing_api_key", { status: 500 });
      return new Response(
        JSON.stringify({
          error:
            "AI is enabled but no API key was found. Set `apiKey` in your docs config `ai` section or add OPENAI_API_KEY to your environment.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const ctx = resolveContextFromRequest(event.request);

    let body: { messages?: ChatMessage[]; model?: string };
    try {
      body = await event.request.json();
    } catch {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: event.request.url,
        path: requestUrl.pathname,
        locale: ctx.locale,
        properties: {
          reason: "invalid_json",
          durationMs: Math.max(0, Date.now() - requestStartedAt),
        },
      });
      await emitRunError("invalid_json", { status: 400, locale: ctx.locale });
      return new Response(
        JSON.stringify({ error: "Invalid JSON body. Expected { messages: [...] }" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: event.request.url,
        path: requestUrl.pathname,
        locale: ctx.locale,
        properties: {
          reason: "missing_messages",
          durationMs: Math.max(0, Date.now() - requestStartedAt),
        },
      });
      await emitRunError("missing_messages", { status: 400, locale: ctx.locale });
      return new Response(
        JSON.stringify({ error: "messages array is required and must not be empty." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: event.request.url,
        path: requestUrl.pathname,
        locale: ctx.locale,
        properties: {
          reason: "missing_user_message",
          messageCount: messages.length,
          durationMs: Math.max(0, Date.now() - requestStartedAt),
        },
      });
      await emitRunError("missing_user_message", {
        status: 400,
        locale: ctx.locale,
        messageCount: messages.length,
      });
      return new Response(JSON.stringify({ error: "At least one user message is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxResults = aiConfig.maxResults ?? 5;
    await emitTrace({
      type: "user.input",
      name: "ask-ai",
      parentSpanId: runSpanId,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: 0,
      status: "success",
      locale: ctx.locale,
      inputPreview: {
        messageCount: messages.length,
        questionLength: lastUserMessage.content.length,
        requestedModel:
          typeof body.model === "string" && body.model.trim().length > 0
            ? body.model.trim()
            : undefined,
      },
    });
    const retrievalStartedAt = Date.now();
    const retrievalStartedAtIso = new Date().toISOString();
    const retrievalSpanId = createDocsAgentTraceId("span");
    await emitTrace({
      type: "retrieval.query",
      name: "docs-index",
      spanId: retrievalSpanId,
      parentSpanId: runSpanId,
      startedAt: retrievalStartedAtIso,
      status: "started",
      locale: ctx.locale,
      inputPreview: {
        queryLength: lastUserMessage.content.length,
        maxResults,
      },
    });
    const retrieval = await buildDocsAskAIContext({
      pages: getSearchIndex(ctx),
      query: lastUserMessage.content,
      search: resolveAskAISearchRequestConfig({
        search: config.search,
        useMcp: aiConfig.useMcp,
        mcpEndpoint: mcpConfig.route,
        mcpEnabled: mcpConfig.enabled,
        mcpSearchEnabled: mcpConfig.tools.searchDocs,
        requestUrl: event.request.url,
      }),
      locale: ctx.locale,
      pathname: requestUrl.searchParams.get("pathname") ?? undefined,
      siteTitle: llmsTitle,
      baseUrl: markdownMetadataBaseUrl || requestUrl.origin,
      syncBaseUrl: markdownMetadataBaseUrl ?? null,
      limit: maxResults,
    });
    const scored = retrieval.results;
    await emitTrace({
      type: "retrieval.result",
      name: "docs-index",
      parentSpanId: retrievalSpanId,
      startedAt: retrievalStartedAtIso,
      endedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - retrievalStartedAt),
      status: "success",
      locale: ctx.locale,
      outputPreview: {
        resultCount: scored.length,
        urls: scored.slice(0, 5).map((doc) => doc.url),
      },
      metadata: { maxResults },
    });

    const promptStartedAt = Date.now();
    const promptStartedAtIso = new Date().toISOString();
    const promptSpanId = createDocsAgentTraceId("span");
    const context = retrieval.context;

    const systemPrompt = aiConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const packageHintsPrompt = formatDocsAskAIPackageHints(retrieval.packageHints, packageName);
    const fullSystemPrompt = [systemPrompt, packageHintsPrompt].filter(Boolean).join("\n\n");
    const systemMessage: ChatMessage = {
      role: "system",
      content: context
        ? `${fullSystemPrompt}\n\n---\n\nDocumentation context:\n\n${context}`
        : fullSystemPrompt,
    };

    const llmMessages: ChatMessage[] = [
      systemMessage,
      ...messages.filter((message) => message.role !== "system"),
    ];
    await emitTrace({
      type: "prompt.build",
      name: "ask-ai.prompt",
      spanId: promptSpanId,
      parentSpanId: runSpanId,
      startedAt: promptStartedAtIso,
      endedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - promptStartedAt),
      status: "success",
      locale: ctx.locale,
      inputPreview: {
        messageCount: messages.length,
        retrievedCount: scored.length,
      },
      outputPreview: {
        llmMessageCount: llmMessages.length,
        contextChars: context.length,
        systemMessageChars: systemMessage.content.length,
      },
    });

    const requestedModel =
      typeof body.model === "string" && body.model.trim().length > 0
        ? body.model.trim()
        : undefined;
    const resolved = resolveAIModelAndProvider(aiConfig, requestedModel);
    const finalKey = resolved.apiKey ?? resolvedKey;

    await emitDocsAnalyticsEvent(analytics, {
      type: "api_ai_request",
      source: "server",
      url: event.request.url,
      path: requestUrl.pathname,
      locale: ctx.locale,
      input: { question: lastUserMessage.content },
      properties: {
        messageCount: messages.length,
        questionLength: lastUserMessage.content.length,
        retrievedCount: scored.length,
        model: resolved.model,
      },
    });

    const modelStartedAt = Date.now();
    const modelStartedAtIso = new Date().toISOString();
    const modelSpanId = createDocsAgentTraceId("span");
    const providerOrigin = safeUrlOrigin(resolved.baseUrl);
    await emitTrace({
      type: "model.call",
      name: resolved.model,
      spanId: modelSpanId,
      parentSpanId: runSpanId,
      startedAt: modelStartedAtIso,
      status: "started",
      locale: ctx.locale,
      inputPreview: {
        messageCount: llmMessages.length,
        stream: true,
        providerOrigin,
      },
      metadata: { model: resolved.model },
    });

    let llmResponse: Response;
    try {
      llmResponse = await fetch(`${resolved.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${finalKey}`,
        },
        body: JSON.stringify({ model: resolved.model, stream: true, messages: llmMessages }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await emitTrace({
        type: "model.error",
        name: resolved.model,
        parentSpanId: modelSpanId,
        startedAt: modelStartedAtIso,
        endedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - modelStartedAt),
        status: "error",
        locale: ctx.locale,
        outputPreview: { message },
        metadata: { model: resolved.model, providerOrigin },
      });
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: event.request.url,
        path: requestUrl.pathname,
        locale: ctx.locale,
        input: { question: lastUserMessage.content },
        properties: {
          reason: "llm_fetch_error",
          messageCount: messages.length,
          questionLength: lastUserMessage.content.length,
          retrievedCount: scored.length,
          model: resolved.model,
          durationMs: Math.max(0, Date.now() - requestStartedAt),
        },
      });
      await emitRunError("llm_fetch_error", {
        status: 502,
        locale: ctx.locale,
        messageCount: messages.length,
        questionLength: lastUserMessage.content.length,
        retrievedCount: scored.length,
        model: resolved.model,
      });
      return new Response(JSON.stringify({ error: "LLM API request failed." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => "Unknown error");
      await emitTrace({
        type: "model.error",
        name: resolved.model,
        parentSpanId: modelSpanId,
        startedAt: modelStartedAtIso,
        endedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - modelStartedAt),
        status: "error",
        locale: ctx.locale,
        outputPreview: {
          status: llmResponse.status,
          errorChars: errText.length,
        },
        metadata: { model: resolved.model, providerOrigin },
      });
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: event.request.url,
        path: requestUrl.pathname,
        locale: ctx.locale,
        input: { question: lastUserMessage.content },
        properties: {
          reason: "llm_error",
          status: llmResponse.status,
          messageCount: messages.length,
          questionLength: lastUserMessage.content.length,
          retrievedCount: scored.length,
          model: resolved.model,
          durationMs: Math.max(0, Date.now() - requestStartedAt),
        },
      });
      await emitRunError("llm_error", {
        status: 502,
        modelStatus: llmResponse.status,
        locale: ctx.locale,
        messageCount: messages.length,
        questionLength: lastUserMessage.content.length,
        retrievedCount: scored.length,
        model: resolved.model,
      });
      return new Response(
        JSON.stringify({ error: `LLM API error (${llmResponse.status}): ${errText}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    await emitDocsAnalyticsEvent(analytics, {
      type: "api_ai_response",
      source: "server",
      url: event.request.url,
      path: requestUrl.pathname,
      locale: ctx.locale,
      input: { question: lastUserMessage.content },
      properties: {
        messageCount: messages.length,
        questionLength: lastUserMessage.content.length,
        retrievedCount: scored.length,
        model: resolved.model,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      },
    });
    const responseEndedAt = new Date().toISOString();
    const modelDurationMs = Math.max(0, Date.now() - modelStartedAt);
    await emitTrace({
      type: "model.response",
      name: resolved.model,
      parentSpanId: modelSpanId,
      startedAt: modelStartedAtIso,
      endedAt: responseEndedAt,
      durationMs: modelDurationMs,
      status: "success",
      locale: ctx.locale,
      outputPreview: {
        status: llmResponse.status,
        stream: true,
        contentType: llmResponse.headers.get("content-type") ?? undefined,
      },
      metadata: { model: resolved.model, providerOrigin },
    });
    await emitTrace({
      type: "model.stream",
      name: resolved.model,
      parentSpanId: modelSpanId,
      startedAt: modelStartedAtIso,
      endedAt: responseEndedAt,
      durationMs: modelDurationMs,
      status: "success",
      locale: ctx.locale,
      outputPreview: { stream: true },
      metadata: { model: resolved.model },
    });
    const runDurationMs = Math.max(0, Date.now() - requestStartedAt);
    await emitTrace({
      type: "agent.final",
      name: "ask-ai",
      parentSpanId: runSpanId,
      startedAt: trace.startedAt,
      endedAt: new Date().toISOString(),
      durationMs: runDurationMs,
      status: "success",
      locale: ctx.locale,
      outputPreview: {
        stream: true,
        retrievedCount: scored.length,
      },
      metadata: { model: resolved.model },
    });
    await emitTrace({
      type: "run.end",
      name: "ask-ai",
      spanId: runSpanId,
      startedAt: trace.startedAt,
      endedAt: new Date().toISOString(),
      durationMs: runDurationMs,
      status: "success",
      locale: ctx.locale,
      outputPreview: {
        stream: true,
        retrievedCount: scored.length,
      },
      metadata: { model: resolved.model },
    });

    return new Response(llmResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const mcpSiteTitle = typeof config.nav?.title === "string" ? config.nav.title : "Documentation";
  const mcpApiReference = resolveApiReferenceConfig(config.apiReference).mcp;
  const MCP = createDocsMcpHttpHandler({
    source: {
      entry,
      siteTitle: mcpSiteTitle,
      baseUrl: markdownMetadataBaseUrl || undefined,
      resolveLocale: resolveLocaleForMcp,
      getPages(locale) {
        const ctx = resolveContextFromPath(`/${entry}`, resolveLocaleForMcp(locale));
        return getSearchIndex(ctx);
      },
      getNavigation(locale) {
        const ctx = resolveContextFromPath(`/${entry}`, resolveLocaleForMcp(locale));
        return applySidebarFolderIndexBehavior(
          navTreeFromNavigation(config, entry) ??
            (preloaded
              ? navTreeFromMap(preloaded, ctx.dirPrefix, entry, ordering)
              : loadDocsNavTree(ctx.contentDirAbs, entry, ordering)),
          {
            sidebar: config.sidebar,
            defaultBehavior: "link",
          },
        );
      },
      async getSkills(context) {
        const origin = context?.request
          ? new URL(context.request.url).origin
          : llmsBaseUrl || "http://localhost";
        const skillOptions = {
          origin,
          entry,
          apiRoute: configuredApiRoute,
          docsPath: config.docsPath,
          apiCatalog: apiCatalogEnabled,
          i18n,
          search: config.search,
          mcp: mcpConfig,
          feedback: agentFeedbackDiscovery,
          llms: {
            enabled: llmsEnabled,
            apiCatalog: apiCatalogEnabled,
            baseUrl: llmsBaseUrl || undefined,
            siteTitle: llmsTitle,
            siteDescription: llmsDesc,
          },
          sitemap: config.sitemap,
          robots: config.robots,
          openapi: openapiDiscovery,
        } as any;
        const rootSkill = await resolveDocsPublishedAgentSkill({
          preferredDocument: readRootSkillDocument(preloaded, rootDir),
          fallbackDocument: renderDocsSkillDocument(skillOptions),
        });
        return [rootSkill, ...(await getPublishedAgentSkills())];
      },
    },
    mcp: config.mcp,
    okf: config.agent?.okf,
    openapi: mcpApiReference
      ? {
          config: mcpApiReference,
          document: () =>
            buildApiReferenceOpenApiDocumentAsync(config as any, {
              framework: "farmjs",
              rootDir,
              baseUrl: markdownMetadataBaseUrl || undefined,
            }),
        }
      : undefined,
    contentChanges: config.agent?.contentChanges,
    evaluations: config.agent?.evaluations,
    feedback: config.feedback,
    contentChangeFeed,
    analytics,
    telemetry: config.telemetry,
    telemetryFramework: "farmjs",
    observability,
    defaultName: mcpSiteTitle,
  });

  async function HEAD(event: { request: Request }): Promise<Response> {
    const response = await GET(event);
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  async function handle(request: Request): Promise<Response | null> {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
    const mcpRoutes = new Set(
      [mcpConfig.route, "/mcp", "/.well-known/mcp"].map((route) =>
        route === "/" ? route : route.replace(/\/+$/, ""),
      ),
    );
    const docsPath = `/${String(entry).replace(/^\/+|\/+$/g, "")}`;
    const apiPath = `/${String(configuredApiRoute ?? "api/docs").replace(/^\/+|\/+$/g, "")}`;
    const configuredApiReferencePath =
      config.apiReference &&
      typeof config.apiReference === "object" &&
      typeof config.apiReference.path === "string"
        ? config.apiReference.path
        : "api-reference";
    const apiReferencePath = `/${configuredApiReferencePath.replace(/^\/+|\/+$/g, "")}`;
    const publicDocsPaths = new Set([
      "/llms.txt",
      "/llms-full.txt",
      "/sitemap.xml",
      "/sitemap.md",
      "/robots.txt",
      "/skill.md",
      "/AGENTS.md",
      "/agent.md",
      "/.well-known/api-catalog",
      "/.well-known/agent.json",
      "/.well-known/agent",
      "/.well-known/agent-card.json",
      "/.well-known/agent-skills/index.json",
      "/.well-known/skills/index.json",
      "/.well-known/skill.md",
      "/.well-known/sitemap.md",
      "/.well-known/AGENTS.md",
    ]);
    const isDocsRequest =
      pathname === docsPath ||
      pathname === `${docsPath}.md` ||
      pathname.startsWith(`${docsPath}/`) ||
      pathname === apiPath ||
      pathname.startsWith(`${apiPath}/`) ||
      pathname === apiReferencePath ||
      publicDocsPaths.has(pathname) ||
      pathname.startsWith("/.well-known/agent-skills/");

    if (mcpConfig.enabled && mcpRoutes.has(pathname)) {
      if (method === "GET" || method === "POST" || method === "DELETE" || method === "OPTIONS") {
        return MCP[method]({ request });
      }
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, POST, DELETE, OPTIONS" },
      });
    }

    if (!isDocsRequest) return null;

    if (method === "GET") {
      const response = await GET({ request });
      return response.status === 404 ? null : response;
    }
    if (method === "HEAD") {
      const response = await HEAD({ request });
      return response.status === 404 ? null : response;
    }
    if (method === "POST") {
      const response = await POST({ request });
      return response.status === 404 ? null : response;
    }

    return null;
  }

  return { load, GET, HEAD, POST, MCP, handle };
}

function escapeDocumentText(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createClientDocsConfig(config: DocsConfig & Record<string, any>): Record<string, unknown> {
  const {
    apiKey: _apiKey,
    rootDir: _rootDir,
    contentDir: _contentDir,
    _preloadedContent,
    _preloadedAgentSkills,
    socialImage,
    ...clientConfig
  } = config;
  const ai =
    clientConfig.ai && typeof clientConfig.ai === "object"
      ? {
          ...clientConfig.ai,
          apiKey: undefined,
          providers:
            clientConfig.ai.providers && typeof clientConfig.ai.providers === "object"
              ? Object.fromEntries(
                  Object.entries(clientConfig.ai.providers).map(([name, provider]) => [
                    name,
                    provider && typeof provider === "object"
                      ? { ...(provider as Record<string, unknown>), apiKey: undefined }
                      : provider,
                  ]),
                )
              : clientConfig.ai.providers,
        }
      : clientConfig.ai;

  return {
    ...clientConfig,
    ...(ai ? { ai } : {}),
    ...(socialImage === false ? { socialImage: false } : {}),
  };
}

function normalizedPublicRoute(value: unknown, fallback: string): string {
  const normalized = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (normalized === "/") return "/";
  return `/${normalized.replace(/^\/+|\/+$/g, "")}`;
}

function isHtmlDocsPageRequest(config: Record<string, any>, request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  const url = new URL(request.url);
  const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  const docsPath = normalizedPublicRoute(config.docsPath, `/${config.entry ?? "docs"}`);
  const isPagePath =
    docsPath === "/"
      ? !pathname.endsWith(".md")
      : pathname === docsPath || pathname.startsWith(`${docsPath}/`);
  if (!isPagePath || pathname.endsWith(".md")) return false;

  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  return !accept.includes("text/markdown");
}

function runtimeFontClasses(fonts: FarmDocsRuntimeFonts | undefined): string {
  return Array.from(
    new Set(
      [fonts?.body?.className, fonts?.body?.variable, fonts?.code?.variable].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  ).join(" ");
}

function runtimeFontStyle(fonts: FarmDocsRuntimeFonts | undefined): string {
  const declarations: string[] = [];
  const bodyFontFamily = fonts?.body?.style?.fontFamily?.trim();
  const codeFontFamily = fonts?.code?.style?.fontFamily?.trim();

  if (bodyFontFamily) {
    declarations.push(`--font-sans:${bodyFontFamily}`, `--fd-font-sans:${bodyFontFamily}`);
  }
  if (codeFontFamily) {
    declarations.push(`--font-mono:${codeFontFamily}`, `--fd-font-mono:${codeFontFamily}`);
  }

  return declarations.join(";");
}

function runtimeFontPreloads(fonts: FarmDocsRuntimeFonts | undefined): {
  markup: string;
  header: string;
} {
  const seen = new Set<string>();
  const values = [fonts?.body, fonts?.code].flatMap((font) => font?.preloads ?? []);
  const unique = values.filter(({ href }) => {
    if (seen.has(href)) return false;
    seen.add(href);
    return true;
  });

  return {
    markup: unique
      .map(
        ({ href, type }) =>
          `<link rel="preload" href="${escapeDocumentText(href)}" as="font" type="${escapeDocumentText(type)}" crossorigin>`,
      )
      .join("\n  "),
    header: unique
      .map(({ href, type }) => `<${href}>; rel=preload; as=font; type=${type}; crossorigin`)
      .join(", "),
  };
}

function renderFarmDocsDocument(input: {
  config: DocsConfig & Record<string, any>;
  data: DocsServerLoadResult;
  markup: string;
  clientEntry: string;
  stylesheets: readonly string[];
  fonts?: FarmDocsRuntimeFonts;
}): string {
  const { config, data } = input;
  const description = data.description ?? config.metadata?.description;
  const themeName = config.theme?.name ?? "default";
  const favicon = typeof config.favicon === "string" ? config.favicon : undefined;
  const rootClasses = runtimeFontClasses(input.fonts);
  const rootStyle = runtimeFontStyle(input.fonts);
  const fontPreloads = runtimeFontPreloads(input.fonts).markup;

  return `<!doctype html>
<html class="dark" lang="${escapeDocumentText(data.locale ?? "en")}" data-docs-theme="${escapeDocumentText(themeName)}" data-farm-docs-runtime="true">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="@farming-labs/farmjs">
  <title>${escapeDocumentText(data.title)}</title>
  ${description ? `<meta name="description" content="${escapeDocumentText(description)}">` : ""}
  ${favicon ? `<link rel="icon" href="${escapeDocumentText(favicon)}">` : ""}
  ${fontPreloads}
  <link rel="stylesheet" href="${FARM_DOCS_BROWSER_CSS_PATH}">
  ${input.stylesheets
    .map((href) => `<link rel="stylesheet" href="${escapeDocumentText(href)}">`)
    .join("\n  ")}
</head>
<body>
  <div id="root"><div id="farm-docs-root"${rootClasses ? ` class="${escapeDocumentText(rootClasses)}"` : ""}${rootStyle ? ` style="${escapeDocumentText(rootStyle)}"` : ""}>${input.markup}</div></div>
  <script>window.__FARM_DOCS_ADAPTER__={config:${serializeInlineJson(createClientDocsConfig(config))},data:${serializeInlineJson(data)}};</script>
  <script type="module" src="${escapeDocumentText(input.clientEntry)}"></script>
</body>
</html>`;
}

/**
 * Create the complete Farm docs runtime owned by this adapter.
 *
 * Farm core supplies host assets and module loading; this adapter owns route
 * classification, docs APIs, content loading, React rendering, and hydration
 * state for every documentation request.
 */
export function createFarmDocsRuntimeHandler(
  config: DocsConfig & Record<string, any>,
  options: FarmDocsRuntimeHandlerOptions = {},
) {
  const runtimeConfig = {
    ...config,
    rootDir: options.rootDir ?? config.rootDir ?? process.cwd(),
  };
  const docsServer = createDocsServer(runtimeConfig);

  return async function handleFarmDocsRuntimeRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname === FARM_DOCS_BROWSER_CSS_PATH) {
      return new Response(
        request.method.toUpperCase() === "HEAD" ? null : loadFarmDocsBrowserCss(),
        {
          status: 200,
          headers: {
            "Content-Type": "text/css; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        },
      );
    }

    if (!isHtmlDocsPageRequest(runtimeConfig, request)) {
      return docsServer.handle(request);
    }

    let data: DocsServerLoadResult;
    try {
      data = await docsServer.load({ pathname: url.pathname });
    } catch (error) {
      const status =
        error &&
        typeof error === "object" &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : 500;
      if (status === 404) return null;
      throw error;
    }

    const reactModule = options.loadReactModule
      ? await options.loadReactModule()
      : ((await import("./react.js")) as FarmDocsReactModule);
    const markup = await renderFarmDocsMarkup(
      createElement(reactModule.FarmDocsPage, {
        config: runtimeConfig,
        data,
      }),
    );
    const fonts = await options.resolveLayoutFonts?.(url.pathname);
    const fontPreloadHeader = runtimeFontPreloads(fonts).header;
    const html = renderFarmDocsDocument({
      config: runtimeConfig,
      data,
      markup,
      clientEntry: options.clientEntry ?? "/farm-client.js",
      stylesheets: options.stylesheets ?? [],
      fonts,
    });

    return new Response(request.method.toUpperCase() === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-Farm-Docs-Adapter": "@farming-labs/farmjs",
        ...(fontPreloadHeader ? { Link: fontPreloadHeader } : {}),
      },
    });
  };
}

/**
 * Server-side helpers for Nuxt docs routes.
 *
 * The simplest setup is a single file:
 *
 * @example
 * ```ts
 * // server/api/docs.ts
 * import { defineDocsHandler } from "@farming-labs/nuxt/server";
 * import config from "../../docs.config";
 * export default defineDocsHandler(config);
 * ```
 *
 * That one handler serves page loads, search, and AI chat.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { eventHandler, getRequestURL, toWebRequest } from "h3";
import {
  applySidebarFolderIndexBehavior,
  buildDocsAskAIContext,
  buildDocsAgentDiscoverySpec,
  buildDocsConfigMap,
  buildDocsDiagnostics,
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
  getDocsMarkdownCanonicalLinkHeader,
  getDocsMarkdownVaryHeader,
  isDocsAgentDiscoveryRequest,
  isDocsConfigRequest,
  isDocsLlmsTxtPublicRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsAgentsRequest,
  isDocsDiagnosticsRequest,
  isDocsSkillRequest,
  normalizeDocsRelated,
  parseDocsAgentFeedbackData,
  performDocsSearch,
  renderDocsMarkdownDocument,
  renderDocsMarkdownNotFound,
  resolveDocsMarkdownRecovery,
  renderDocsLlmsTxt,
  renderDocsAgentsDocument,
  renderDocsSkillDocument,
  readDocsSitemapManifestFromContentMap,
  stripGeneratedAgentProvenance,
  resolveDocsAgentMdxContent,
  resolveDocsAgentFeedbackConfig,
  resolveDocsAgentFeedbackRequest,
  resolvePageSidebarFolderIndexBehavior,
  resolveAskAISearchRequestConfig,
  resolveSearchRequestConfig,
  resolveDocsI18n,
  resolveDocsLlmsTxtRequest,
  resolveDocsLocale,
  resolveDocsMarkdownRequest,
  resolveDocsMetadataBaseUrl,
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
import type { DocsAgentTraceEventInput, DocsAskAIMcpConfig } from "@farming-labs/docs";
import {
  buildApiReferenceOpenApiDocumentAsync,
  createDocsMcpHttpHandler,
  readDocsSitemapManifest,
  resolveApiReferenceConfig,
  resolveDocsMcpConfig,
  serializeDocsIconRegistry,
  serializeOpenDocsProviders,
} from "@farming-labs/docs/server";
import type { DocsMcpHttpHandlers } from "@farming-labs/docs/server";
import { loadDocsNavTree, loadDocsContent, flattenNavTree } from "./content.js";
import { renderMarkdown } from "./markdown.js";
import type { PageNode, NavNode, NavTree, ContentPage } from "./content.js";
export { defineApiReferenceHandler } from "./api-reference.js";

function isApiReferenceOpenApiRequest(url: URL): boolean {
  return url.searchParams.get("format")?.trim() === "openapi";
}

function resolveApiReferenceOpenApiDiscovery(value: unknown) {
  const apiReference = resolveApiReferenceConfig(value as any);
  if (!apiReference.enabled) return { enabled: false };

  return {
    enabled: true,
    url: "/api/docs?format=openapi",
    source: apiReference.specUrl ? ("configured" as const) : ("generated" as const),
    specUrl: apiReference.specUrl,
    apiReferencePath: `/${apiReference.path}`,
  };
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

  const entry = modelList.find((m) => m.id === modelId);
  const providerKey = entry?.provider;
  const providerConfig = providerKey && aiConfig.providers?.[providerKey];

  const baseUrl = (
    (providerConfig && providerConfig.baseUrl) ||
    aiConfig.baseUrl ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const apiKey =
    (providerConfig && providerConfig.apiKey) ||
    aiConfig.apiKey ||
    (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : undefined);

  return { model: modelId, baseUrl, apiKey };
}

function safeUrlOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export interface DocsServer {
  load: (pathname: string) => Promise<{
    tree: ReturnType<typeof loadDocsNavTree>;
    flatPages: PageNode[];
    url: string;
    title: string;
    description?: string;
    html: string;
    readingTime?: number | null;
    readingTimeFormat?: "long" | "short";
    entry?: string;
    locale?: string;
    slug?: string;
    previousPage: PageNode | null;
    nextPage: PageNode | null;
    editOnGithub?: string;
    lastModified: string;
    structuredData: string;
  }>;
  GET: (context: { request: Request }) => Promise<Response>;
  POST: (context: { request: Request }) => Promise<Response>;
  MCP: DocsMcpHttpHandlers;
}

type ContentFileMap = Record<string, string>;

function stripMarkdownText(content: string): string {
  return content
    .replace(/^(import|export)\s.*$/gm, "")
    .replace(/<[^>]+\/>/g, "")
    .replace(/<\/?[A-Z][^>]*>/g, "")
    .replace(/<\/?[a-z][^>]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  return value.replace(/\\\\/g, "/");
}

function buildDirPrefix(contentDir: string): string {
  const rel = path.isAbsolute(contentDir)
    ? toPosixPath(path.relative(process.cwd(), contentDir))
    : toPosixPath(contentDir);
  const normalized = normalizePathSegment(rel);
  return normalized ? `/${normalized}/` : "/";
}

function readRootSkillDocument(
  contentMap: ContentFileMap | undefined,
  rootDir: string,
): string | null {
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

function readRootAgentsDocument(
  contentMap: ContentFileMap | undefined,
  rootDir: string,
): string | null {
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
    const base = fileName.replace(/\.(md|mdx|svx)$/, "");
    if (base !== "page" && base !== "index" && base !== "+page") continue;

    const { data } = matter(contentMap[key]);
    const dirParts = segments;
    const slug = dirParts.join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;
    const fallbackTitle =
      dirParts.length > 0
        ? dirParts[dirParts.length - 1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
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
  const rootInfo = dirs.find((d) => d.parts.length === 0);
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
      const found = items.find((i) => i.slug === part);
      if (!found?.children) return undefined;
      items = found.children;
    }
    return items;
  }

  function buildLevel(parentParts: string[]): NavNode[] {
    const depth = parentParts.length;

    const directChildren = dirs.filter((d) => {
      if (d.parts.length !== depth + 1) return false;
      for (let i = 0; i < depth; i++) {
        if (d.parts[i] !== parentParts[i]) return false;
      }
      return true;
    });

    const slugOrder = findSlugOrder(parentParts);

    if (slugOrder) {
      const slugMap = new Set(slugOrder.map((i) => i.slug));
      const ordered: DirInfo[] = [];
      for (const item of slugOrder) {
        const match = directChildren.find((d) => d.parts[depth] === item.slug);
        if (match) ordered.push(match);
      }
      for (const child of directChildren) {
        if (!slugMap.has(child.parts[depth])) ordered.push(child);
      }
      const nodes: NavNode[] = [];
      for (const child of ordered) {
        const hasGrandChildren = dirs.some((d) => {
          if (d.parts.length <= child.parts.length) return false;
          return child.parts.every((p, i) => d.parts[i] === p);
        });
        if (hasGrandChildren) {
          nodes.push({
            type: "folder",
            name: child.title,
            icon: child.icon,
            index: { type: "page", name: child.title, url: child.url, icon: child.icon },
            folderIndexBehavior: child.folderIndexBehavior,
            children: buildLevel(child.parts),
          });
        } else {
          nodes.push({ type: "page", name: child.title, url: child.url, icon: child.icon });
        }
      }
      return nodes;
    }

    if (ordering === "numeric") {
      directChildren.sort((a, b) => {
        if (a.order === b.order) return 0;
        return a.order - b.order;
      });
    }

    const nodes: NavNode[] = [];

    for (const child of directChildren) {
      const hasGrandChildren = dirs.some((d) => {
        if (d.parts.length <= child.parts.length) return false;
        return child.parts.every((p, i) => d.parts[i] === p);
      });

      if (hasGrandChildren) {
        nodes.push({
          type: "folder",
          name: child.title,
          icon: child.icon,
          index: {
            type: "page",
            name: child.title,
            url: child.url,
            icon: child.icon,
          },
          folderIndexBehavior: child.folderIndexBehavior,
          children: buildLevel(child.parts),
        });
      } else {
        nodes.push({
          type: "page",
          name: child.title,
          url: child.url,
          icon: child.icon,
        });
      }
    }

    return nodes;
  }

  children.push(...buildLevel([]));
  return { name: "Docs", children };
}

function searchIndexFromMap(
  contentMap: ContentFileMap,
  dirPrefix: string,
  entry: string,
): ContentPage[] {
  const pages: ContentPage[] = [];

  for (const [key, raw] of Object.entries(contentMap)) {
    if (!key.startsWith(dirPrefix)) continue;

    const rel = key.slice(dirPrefix.length);
    const segments = rel.split("/");
    const fileName = segments.pop()!;
    if (fileName === "agent.md") continue;
    const base = fileName.replace(/\.(md|mdx|svx)$/, "");
    const isIdx = base === "page" || base === "index" || base === "+page";
    const slug = isIdx ? segments.join("/") : [...segments, base].join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;

    const { data, content } = matter(raw);
    const humanRawContent = resolveDocsAgentMdxContent(content, "human");
    const pageAgentRawContent = resolveDocsAgentMdxContent(content, "agent");
    const related = normalizeDocsRelated(data.related);
    const agentDoc = isIdx ? readAgentDocFromMap(contentMap, dirPrefix, slug) : undefined;
    const title =
      (data.title as string) ?? base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    pages.push({
      slug,
      url,
      title,
      description: data.description as string | undefined,
      ...(related.length > 0 ? { related } : {}),
      icon: data.icon as string | undefined,
      content: stripMarkdownText(humanRawContent),
      rawContent: humanRawContent,
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
  return {
    agentContent: stripMarkdownText(content),
    agentRawContent: content,
  };
}

function findPageInMap(
  contentMap: ContentFileMap,
  dirPrefix: string,
  slug: string,
): { raw: string; relPath: string } | null {
  const isIndex = slug === "";

  const candidates = isIndex
    ? ["page.md", "page.mdx", "index.md"]
    : [
        `${slug}/page.md`,
        `${slug}/page.mdx`,
        `${slug}/index.md`,
        `${slug}/index.svx`,
        `${slug}.md`,
        `${slug}.svx`,
      ];

  for (const candidate of candidates) {
    const key = `${dirPrefix}${candidate}`;
    if (key in contentMap) {
      return { raw: contentMap[key], relPath: candidate };
    }
  }

  return null;
}

/**
 * Create all server-side functions needed for a Nuxt docs site.
 *
 * @param config - The `DocsConfig` object (from `defineDocs()` in `docs.config.ts`).
 *
 * Pass `_preloadedContent` (from `import.meta.glob`) to bundle markdown files
 * at build time — required for serverless deployments (Vercel, Netlify, etc.)
 * where the filesystem is not available at runtime.
 */
export function createDocsServer(config: Record<string, any> = {}): DocsServer {
  const entry = (config.entry as string) ?? "docs";
  const analytics = config.analytics;
  const observability = config.observability;
  const contentDirBase =
    ((config as Record<string, unknown>).contentDir as string | undefined) ?? entry;
  const rootDir = path.resolve(
    ((config as Record<string, unknown>).rootDir as string | undefined) ?? process.cwd(),
  );
  const i18n = resolveDocsI18n((config as Record<string, unknown>).i18n as any);

  const githubRaw = config.github;
  const github: GithubConfigObj | null =
    typeof githubRaw === "string" ? { url: githubRaw } : ((githubRaw as GithubConfigObj) ?? null);

  const githubRepo = github?.url;
  const githubBranch = github?.branch ?? "main";
  const githubContentPath = github?.directory;
  const readingTimeOptions = resolveReadingTimeOptions(config.readingTime);

  const preloaded = config._preloadedContent as ContentFileMap | undefined;
  const preloadedSitemapManifest = readDocsSitemapManifestFromContentMap(preloaded);

  const ordering = config.ordering as
    | "alphabetical"
    | "numeric"
    | Array<{ slug: string; children?: any[] }>
    | undefined;

  const aiConfig: AIConfigObj = (config.ai as AIConfigObj) ?? {};

  if (config.apiKey && !aiConfig.apiKey) {
    aiConfig.apiKey = config.apiKey as string;
  }

  function resolveContentDirRel(locale?: string | null): string {
    if (!locale) return contentDirBase;
    if (path.isAbsolute(contentDirBase)) return path.join(contentDirBase, locale);
    return joinPathParts(contentDirBase, locale);
  }

  function resolveContextFromPath(pathname: string, locale?: string) {
    const match = resolveDocsPath(pathname, entry);
    const contentDirRel = resolveContentDirRel(locale);
    const contentDirAbs = path.isAbsolute(contentDirRel)
      ? contentDirRel
      : path.resolve(rootDir, contentDirRel);
    return {
      ...match,
      locale,
      contentDirRel,
      contentDirAbs,
      dirPrefix: buildDirPrefix(contentDirRel),
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
        // ignore
      }
    }

    return i18n.defaultLocale;
  }

  function resolveContextFromRequest(request: Request) {
    const locale = resolveLocaleFromRequest(request);
    const url = new URL(request.url);
    const pathnameParam = url.searchParams.get("pathname");
    const referrer = request.headers.get("referer") ?? request.headers.get("referrer");
    const refPath = referrer ? new URL(referrer).pathname : undefined;
    const pathname = pathnameParam ?? refPath ?? `/${entry}`;
    return resolveContextFromPath(pathname, locale);
  }

  // ─── Unified load (tree + page content in one call) ────────
  async function load(pathname: string) {
    let url: URL;
    try {
      url = new URL(pathname);
    } catch {
      url = new URL(pathname, "http://localhost");
    }
    const locale = resolveDocsLocale(url.searchParams, i18n) ?? i18n?.defaultLocale;
    const ctx = resolveContextFromPath(url.pathname, locale);
    const tree = applySidebarFolderIndexBehavior(
      preloaded
        ? navTreeFromMap(preloaded, ctx.dirPrefix, entry, ordering)
        : loadDocsNavTree(ctx.contentDirAbs, entry, ordering),
      {
        sidebar: config.sidebar,
        defaultBehavior: "toggle",
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
        const err = new Error(`Page not found: /${entry}/${slug}`) as Error & {
          status?: number;
        };
        err.status = 404;
        throw err;
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
        for (const name of ["page.md", "page.mdx", "index.md"]) {
          const candidate = path.join(ctx.contentDirAbs, name);
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            relPath = name;
            break;
          }
        }
      } else {
        const candidates = [
          path.join(ctx.contentDirAbs, slug, "page.md"),
          path.join(ctx.contentDirAbs, slug, "page.mdx"),
          path.join(ctx.contentDirAbs, slug, "index.md"),
          path.join(ctx.contentDirAbs, slug, "index.svx"),
          path.join(ctx.contentDirAbs, `${slug}.md`),
          path.join(ctx.contentDirAbs, `${slug}.svx`),
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
        const err = new Error(`Page not found: /${entry}/${slug}`) as Error & {
          status?: number;
        };
        err.status = 404;
        throw err;
      }

      raw = fs.readFileSync(filePath, "utf-8");
      const stat = fs.statSync(filePath);
      lastModifiedIso = stat.mtime.toISOString();
      lastModified = stat.mtime.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    const { data, content } = matter(raw);
    const humanRawContent = resolveDocsAgentMdxContent(content, "human");
    const readingTime = resolvePageReadingTime(data, humanRawContent, {
      enabledByDefault: readingTimeOptions.enabled,
      wordsPerMinute: readingTimeOptions.wordsPerMinute,
      includeCode: readingTimeOptions.includeCode,
    });
    const html = await renderMarkdown(humanRawContent, {
      theme: config.theme,
      icons: serializeDocsIconRegistry(config.icons),
      openDocsProviders: serializeOpenDocsProviders(
        config.pageActions?.openDocs && typeof config.pageActions.openDocs === "object"
          ? config.pageActions.openDocs.providers
          : undefined,
        config.pageActions?.openDocs && typeof config.pageActions.openDocs === "object"
          ? {
              target: config.pageActions.openDocs.target,
              prompt: config.pageActions.openDocs.prompt,
            }
          : undefined,
      ),
    });

    const currentIndex = flatPages.findIndex((p) => p.url === currentUrl);
    const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
    const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

    let editOnGithub: string | undefined;
    if (githubRepo && githubContentPath) {
      const trimmed = githubContentPath.replace(/\/+$/, "");
      const localePrefix = ctx.locale ? `${ctx.locale}/` : "";
      editOnGithub = `${githubRepo}/blob/${githubBranch}/${trimmed}/${localePrefix}${relPath}`;
    }

    const fallbackTitle = isIndex
      ? "Documentation"
      : (slug.split("/").pop()?.replace(/-/g, " ") ?? "Documentation");
    const title = (data.title as string) ?? fallbackTitle;
    const description = data.description as string | undefined;
    const structuredData = renderDocsPageStructuredDataJson({
      title,
      description,
      url: currentUrl,
      baseUrl: resolveDocsMetadataBaseUrl(config as any),
      entry,
      dateModified: lastModifiedIso,
    });

    return {
      tree,
      flatPages,
      url: currentUrl,
      title,
      description,
      html,
      readingTime,
      readingTimeFormat: readingTimeOptions.format,
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

  // ─── Search index ──────────────────────────────────────────
  const searchIndexByEntry = new Map<string, ContentPage[]>();

  function getSearchIndex(ctx: ReturnType<typeof resolveContextFromPath>) {
    const key = ctx.locale ?? "__default__";
    const cached = searchIndexByEntry.get(key);
    if (cached) return cached;
    const index = preloaded
      ? searchIndexFromMap(preloaded, ctx.dirPrefix, entry)
      : loadDocsContent(ctx.contentDirAbs, entry);
    searchIndexByEntry.set(key, index);
    return index;
  }

  // ─── llms.txt content builder ────────────────────────────────
  const llmsSiteTitle =
    typeof (config as Record<string, unknown>).nav === "object" &&
    typeof ((config as Record<string, unknown>).nav as Record<string, unknown>)?.title === "string"
      ? ((config as Record<string, unknown>).nav as Record<string, string>).title
      : "Documentation";

  const llmsTxtConfig = (config as Record<string, unknown>).llmsTxt as
    | boolean
    | {
        enabled?: boolean;
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
  const llmsTitle =
    typeof llmsTxtConfig === "object" ? (llmsTxtConfig.siteTitle ?? llmsSiteTitle) : llmsSiteTitle;
  const llmsDesc = typeof llmsTxtConfig === "object" ? llmsTxtConfig.siteDescription : undefined;
  const llmsEnabled =
    llmsTxtConfig !== false &&
    !(llmsTxtConfig && typeof llmsTxtConfig === "object" && llmsTxtConfig.enabled === false);
  const openapiDiscovery = resolveApiReferenceOpenApiDiscovery(
    (config as Record<string, unknown>).apiReference as any,
  );
  const mcpConfig = resolveDocsMcpConfig(
    (config as Record<string, unknown>).mcp as Record<string, unknown> | boolean | undefined,
    {
      defaultName: llmsTitle,
    },
  );
  const agentFeedbackConfig = resolveDocsAgentFeedbackConfig(
    (config as Record<string, unknown>).feedback as Record<string, unknown> | boolean | undefined,
  );
  const agentFeedbackDiscovery = {
    enabled: agentFeedbackConfig.enabled,
    route: "/api/docs?feedback=agent",
    schemaRoute: "/api/docs?feedback=agent&schema=1",
  };

  const llmsCache = new Map<string, ReturnType<typeof renderDocsLlmsTxt>>();

  function trackTelemetryRequest(request: Request) {
    emitDocsTelemetryProjectEvent(config, {
      framework: "nuxt",
      request,
    });

    const surface = inferDocsTelemetryAgentSurface(request, {
      entry,
      llmsTxt: config.llmsTxt,
      feedback: config.feedback,
    });

    if (!surface) return;

    emitDocsTelemetryAgentSurfaceEvent(config, {
      framework: "nuxt",
      request,
      surface,
    });
  }

  function getLlmsContent(ctx: ReturnType<typeof resolveContextFromPath>) {
    const key = ctx.locale ?? "__default__";
    const cached = llmsCache.get(key);
    if (cached) return cached;

    const next = renderDocsLlmsTxt(getSearchIndex(ctx), {
      siteTitle: llmsTitle,
      siteDescription: llmsDesc,
      baseUrl: llmsBaseUrl,
      maxChars: typeof llmsTxtConfig === "object" ? llmsTxtConfig.maxChars : undefined,
      sections: typeof llmsTxtConfig === "object" ? llmsTxtConfig.sections : undefined,
      openapi: openapiDiscovery,
    } as any);
    llmsCache.set(key, next);
    return next;
  }

  function resolveLocaleForMcp(locale?: string): string | undefined {
    if (!i18n) return undefined;
    if (locale && i18n.locales.includes(locale)) return locale;
    return i18n.defaultLocale;
  }

  function getMarkdownDocument(
    ctx: ReturnType<typeof resolveContextFromPath>,
    requestedPath: string,
    origin?: string,
  ) {
    const page = findDocsMarkdownPage(entry, getSearchIndex(ctx), requestedPath);
    return page ? renderDocsMarkdownDocument(page, { origin, sitemap: config.sitemap }) : null;
  }

  // ─── GET /api/docs?query=… | ?format=llms | ?format=llms-full ──
  async function GET(context: { request: Request }): Promise<Response> {
    trackTelemetryRequest(context.request);
    const ctx = resolveContextFromRequest(context.request);
    const url = new URL(context.request.url);

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
            adapter: "nuxt",
            entry,
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

    if (isDocsAgentDiscoveryRequest(url)) {
      return new Response(
        JSON.stringify(
          buildDocsAgentDiscoverySpec({
            origin: url.origin,
            entry,
            i18n,
            search: config.search,
            mcp: mcpConfig,
            feedback: agentFeedbackDiscovery,
            llms: {
              enabled: llmsEnabled,
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
              acceptHeader: false,
            },
          } as any),
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

      const document = await buildApiReferenceOpenApiDocumentAsync(config as any, {
        framework: "nuxt",
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

      return new Response(JSON.stringify(agentFeedbackConfig.schema, null, 2), {
        headers: {
          "Content-Type": "application/schema+json; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600",
          "X-Robots-Tag": "noindex",
        },
      });
    }

    if (isDocsAgentsRequest(url) || resolveDocsAgentsFormat(url) === "agents") {
      return new Response(
        readRootAgentsDocument(preloaded, rootDir) ??
          renderDocsAgentsDocument({
            origin: url.origin,
            entry,
            search: config.search,
            mcp: mcpConfig,
            feedback: agentFeedbackDiscovery,
            llms: {
              enabled: llmsEnabled,
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
              acceptHeader: false,
            },
          } as any),
        {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=3600",
            "X-Robots-Tag": "noindex",
          },
        },
      );
    }

    if (isDocsSkillRequest(url) || resolveDocsSkillFormat(url) === "skill") {
      return new Response(
        readRootSkillDocument(preloaded, rootDir) ??
          renderDocsSkillDocument({
            origin: url.origin,
            entry,
            search: config.search,
            mcp: mcpConfig,
            feedback: agentFeedbackDiscovery,
            llms: {
              enabled: llmsEnabled,
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
              acceptHeader: false,
            },
          } as any),
        {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=3600",
            "X-Robots-Tag": "noindex",
          },
        },
      );
    }

    const sitemapResponse = createDocsSitemapResponse({
      request: context.request,
      sitemap: config.sitemap,
      entry,
      siteTitle: llmsTitle,
      baseUrl: llmsBaseUrl || url.origin,
      pages: getSearchIndex(ctx),
      manifest: preloadedSitemapManifest ?? readDocsSitemapManifest(rootDir, config.sitemap),
    });
    if (sitemapResponse) return sitemapResponse;

    const robotsResponse = createDocsRobotsResponse({
      request: context.request,
      entry,
      sitemap: config.sitemap,
      baseUrl: llmsBaseUrl || url.origin,
      robots: config.robots,
    });
    if (robotsResponse) return robotsResponse;

    const markdownRequest = resolveDocsMarkdownRequest(entry, url, context.request);
    if (markdownRequest) {
      const markdownOrigin = markdownMetadataBaseUrl || url.origin;
      const document = getMarkdownDocument(ctx, markdownRequest.requestedPath, markdownOrigin);
      const varyHeader = getDocsMarkdownVaryHeader(context.request);
      const canonicalLinkHeader = getDocsMarkdownCanonicalLinkHeader({
        origin: markdownOrigin,
        entry,
        requestedPath: markdownRequest.requestedPath,
        locale: ctx.locale,
      });

      if (!document) {
        const recovery = resolveDocsMarkdownRecovery({
          entry,
          requestedPath: markdownRequest.requestedPath,
          pages: getSearchIndex(ctx),
          sitemap: config.sitemap,
        });

        if (recovery.redirect) {
          return new Response(null, {
            status: 307,
            headers: {
              Location: new URL(recovery.redirect.markdownUrl, url.origin).toString(),
              ...(varyHeader ? { Vary: varyHeader } : {}),
              "X-Robots-Tag": "noindex",
            },
          });
        }

        return new Response(
          renderDocsMarkdownNotFound({
            entry,
            requestedPath: markdownRequest.requestedPath,
            origin: markdownOrigin,
            pages: getSearchIndex(ctx),
            sitemap: config.sitemap,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              ...(varyHeader ? { Vary: varyHeader } : {}),
              "X-Robots-Tag": "noindex",
            },
          },
        );
      }

      return new Response(document, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600",
          Link: canonicalLinkHeader,
          ...(varyHeader ? { Vary: varyHeader } : {}),
          "X-Robots-Tag": "noindex",
        },
      });
    }

    const llmsRequest = resolveDocsLlmsTxtRequest(url, llmsTxtConfig, entry);
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

      const selected = selectDocsLlmsTxtContent(getLlmsContent(ctx), llmsRequest);
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

      return new Response(selected.content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const query = url.searchParams.get("query")?.trim();
    if (!query) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const searchStartedAt = Date.now();
    const results = await performDocsSearch({
      pages: getSearchIndex(ctx),
      query,
      search: resolveSearchRequestConfig(config.search, context.request.url),
      locale: ctx.locale,
      pathname: url.searchParams.get("pathname") ?? undefined,
      siteTitle: llmsTitle,
    });
    await emitDocsAnalyticsEvent(analytics, {
      type: "api_search",
      source: "server",
      url: context.request.url,
      path: url.pathname,
      locale: ctx.locale,
      input: { query },
      properties: {
        queryLength: query.length,
        resultCount: results.length,
        pathname: url.searchParams.get("pathname") ?? undefined,
        durationMs: Math.max(0, Date.now() - searchStartedAt),
      },
    });

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── POST /api/docs — AI chat with RAG ────────────────────
  const projectName = (
    typeof (config.nav as Record<string, unknown>)?.title === "string"
      ? (config.nav as Record<string, unknown>).title
      : null
  ) as string | null;
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

  async function POST(context: { request: Request }): Promise<Response> {
    trackTelemetryRequest(context.request);
    const requestUrl = new URL(context.request.url);
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

      const parsed = await parseDocsAgentFeedbackData(context.request);
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
      url: context.request.url,
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
        method: context.request.method,
        path: requestUrl.pathname,
      },
    });

    if (!aiConfig.enabled) {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: context.request.url,
        path: requestUrl.pathname,
        properties: { reason: "disabled" },
      });
      await emitRunError("disabled", { status: 404 });
      return new Response(
        JSON.stringify({
          error: "AI is not enabled. Set `ai: { enabled: true }` in your docs config to enable it.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const resolvedKey =
      aiConfig.apiKey ?? (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : undefined);

    if (!resolvedKey) {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: context.request.url,
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

    const ctx = resolveContextFromRequest(context.request);

    let body: { messages?: ChatMessage[]; model?: string };
    try {
      body = await context.request.json();
    } catch {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: context.request.url,
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
        url: context.request.url,
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

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      await emitDocsAnalyticsEvent(analytics, {
        type: "api_ai_error",
        source: "server",
        url: context.request.url,
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
        requestUrl: context.request.url,
      }),
      locale: ctx.locale,
      pathname: requestUrl.searchParams.get("pathname") ?? undefined,
      siteTitle: llmsTitle,
      baseUrl: requestUrl.origin,
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
    const ragContext = retrieval.context;

    const systemPrompt = aiConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const packageHintsPrompt = formatDocsAskAIPackageHints(retrieval.packageHints, packageName);
    const fullSystemPrompt = [systemPrompt, packageHintsPrompt].filter(Boolean).join("\n\n");
    const systemMessage: ChatMessage = {
      role: "system",
      content: ragContext
        ? `${fullSystemPrompt}\n\n---\n\nDocumentation context:\n\n${ragContext}`
        : fullSystemPrompt,
    };

    const llmMessages: ChatMessage[] = [
      systemMessage,
      ...messages.filter((m) => m.role !== "system"),
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
        contextChars: ragContext.length,
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
      url: context.request.url,
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
        url: context.request.url,
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
        url: context.request.url,
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
      url: context.request.url,
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

  const mcpSiteTitle =
    typeof (config.nav as Record<string, unknown>)?.title === "string"
      ? ((config.nav as Record<string, unknown>).title as string)
      : "Documentation";

  const MCP = createDocsMcpHttpHandler({
    source: {
      entry,
      siteTitle: mcpSiteTitle,
      getPages(locale) {
        const ctx = resolveContextFromPath(`/${entry}`, resolveLocaleForMcp(locale));
        return getSearchIndex(ctx);
      },
      getNavigation(locale) {
        const ctx = resolveContextFromPath(`/${entry}`, resolveLocaleForMcp(locale));
        return applySidebarFolderIndexBehavior(
          preloaded
            ? navTreeFromMap(preloaded, ctx.dirPrefix, entry, ordering)
            : loadDocsNavTree(ctx.contentDirAbs, entry, ordering),
          {
            sidebar: config.sidebar,
            defaultBehavior: "toggle",
          },
        );
      },
    },
    mcp: (config as Record<string, unknown>).mcp as Record<string, unknown> | boolean | undefined,
    analytics,
    telemetry: config.telemetry,
    telemetryFramework: "nuxt",
    observability,
    defaultName: mcpSiteTitle,
  });

  return { load, GET, POST, MCP };
}

// ─── Nuxt event handler helper ───────────────────────────────

/**
 * Create a single Nuxt event handler that serves docs pages, search, and AI chat.
 *
 * Pass `useStorage` from the Nitro auto-import so the handler can read
 * docs bundled via `serverAssets`.
 *
 * @example
 * ```ts
 * // server/api/docs.ts
 * import { defineDocsHandler } from "@farming-labs/nuxt/server";
 * import config from "../../docs.config";
 * export default defineDocsHandler(config, useStorage);
 * ```
 *
 * The handler responds to:
 * - `GET /api/docs?pathname=/docs/page` → page load
 * - `GET /api/docs?query=search+term`  → search
 * - `POST /api/docs`                   → AI chat
 */
type DocsStorageAccessor = (base: string) => {
  getKeys(): Promise<string[]>;
  getItem(key: string): Promise<unknown>;
};

export function defineDocsHandler(config: Record<string, any>, storage: DocsStorageAccessor) {
  const getServer = createStorageBackedDocsServerGetter(config, storage);

  return eventHandler(async (event: any) => {
    const server = await getServer();

    const method = event.method ?? event.node?.req?.method ?? "GET";
    const headers = event.headers ?? event.node?.req?.headers ?? {};

    if (method === "POST") {
      const url = new URL(event.node.req.url ?? "/", "http://localhost");
      let body: string | undefined;
      try {
        body = await new Promise<string>((resolve, reject) => {
          let data = "";
          event.node.req.on("data", (chunk: any) => (data += chunk));
          event.node.req.on("end", () => resolve(data));
          event.node.req.on("error", reject);
        });
      } catch {
        /* empty */
      }
      return server.POST({
        request: new Request(url.href, { method: "POST", headers, body }),
      });
    }

    const reqUrl = new URL(event.node.req.url ?? "/", "http://localhost");
    const pathname = reqUrl.searchParams.get("pathname");
    if (pathname) {
      return server.load(pathname);
    }

    return server.GET({
      request: new Request(reqUrl.href, { method: "GET", headers }),
    });
  });
}

/**
 * Create a Nuxt event handler for the built-in docs MCP endpoint.
 *
 * @example
 * ```ts
 * // server/api/docs/mcp.ts
 * import { defineDocsMcpHandler } from "@farming-labs/nuxt/server";
 * import config from "../../docs.config";
 * export default defineDocsMcpHandler(config, useStorage);
 * ```
 */
export function defineDocsMcpHandler(config: Record<string, any>, storage: DocsStorageAccessor) {
  const getServer = createStorageBackedDocsServerGetter(config, storage);

  return eventHandler(async (event: any) => {
    const server = await getServer();
    const request = toWebRequest(event);
    const method = request.method.toUpperCase();

    if (method === "POST") {
      return server.MCP.POST({ request });
    }

    if (method === "DELETE") {
      return server.MCP.DELETE({ request });
    }

    if (method === "OPTIONS") {
      return server.MCP.OPTIONS({ request });
    }

    if (method === "GET" || method === "HEAD") {
      return server.MCP.GET({ request });
    }

    return methodNotAllowedResponse();
  });
}

/**
 * Create a Nuxt middleware handler for public docs discovery endpoints.
 *
 * Intended for `server/middleware/docs-public.ts`; unmatched routes pass
 * through to Nuxt.
 */
export function defineDocsPublicHandler(config: Record<string, any>, storage: DocsStorageAccessor) {
  const getServer = createStorageBackedDocsServerGetter(config, storage);
  const entry = normalizePathSegment((config.entry as string | undefined) ?? "docs") || "docs";

  return eventHandler(async (event: any) => {
    const method = (event.method ?? event.node?.req?.method ?? "GET").toUpperCase();
    const url = resolveEventUrl(event);
    const headers = event.headers ?? event.node?.req?.headers ?? {};

    if (isDocsMcpRequest(url)) {
      const server = await getServer();
      const request = toWebRequest(event);

      if (method === "POST") {
        return server.MCP.POST({ request });
      }

      if (method === "DELETE") {
        return server.MCP.DELETE({ request });
      }

      if (method === "OPTIONS") {
        return server.MCP.OPTIONS({ request });
      }

      if (method === "GET" || method === "HEAD") {
        return server.MCP.GET({ request });
      }

      return methodNotAllowedResponse();
    }

    if (method === "GET" || method === "HEAD") {
      const request = new Request(url.href, { method, headers });
      if (
        isDocsLlmsTxtPublicRequest(url, config.llmsTxt, entry) &&
        hasNativeNuxtPublicFile(url.pathname)
      ) {
        return undefined;
      }

      if (
        !isDocsPublicGetRequest(entry, url, request, {
          sitemap: config.sitemap,
          llms: config.llmsTxt,
          robots: config.robots,
        })
      ) {
        return undefined;
      }

      const server = await getServer();
      return server.GET({
        request,
      });
    }
  });
}

function hasNativeNuxtPublicFile(pathname: string): boolean {
  const relativePath = pathname.replace(/^\/+/, "");
  if (!relativePath || relativePath.split("/").some((part) => part === ".." || part === "")) {
    return false;
  }

  const candidates = [
    path.join(process.cwd(), "public", relativePath),
    path.join(process.cwd(), ".output", "public", relativePath),
    path.join(process.cwd(), "..", "public", relativePath),
  ];

  return candidates.some((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

function methodNotAllowedResponse() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "GET, HEAD, POST, DELETE, OPTIONS",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function resolveEventUrl(event: any): URL {
  try {
    return getRequestURL(event);
  } catch {
    return new URL(event.node?.req?.url ?? "/", "http://localhost");
  }
}

function createStorageBackedDocsServerGetter(
  config: Record<string, any>,
  storage: DocsStorageAccessor,
) {
  let _server: DocsServer | null = null;
  let _initPromise: Promise<DocsServer> | null = null;

  async function getServer(): Promise<DocsServer> {
    if (_server) return _server;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      const entry = (config.entry as string) ?? (config.contentDir as string) ?? "docs";
      const contentDirRel = (config.contentDir as string) ?? entry;

      const store = storage(`assets:${contentDirRel}`);
      const keys: string[] = await store.getKeys();
      const contentFiles: Record<string, string> = {};

      for (const key of keys) {
        if (!key.endsWith(".md") && !key.endsWith(".mdx")) continue;
        const raw = await store.getItem(key);
        if (typeof raw === "string") {
          const filePath = `/${entry}/${key.replace(/:/g, "/")}`;
          contentFiles[filePath] = raw;
        }
      }

      _server = createDocsServer({
        ...config,
        ...(Object.keys(contentFiles).length > 0 ? { _preloadedContent: contentFiles } : {}),
      });
      return _server;
    })();

    return _initPromise;
  }

  return getServer;
}

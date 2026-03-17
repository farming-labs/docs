import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveDocsI18n, resolveDocsLocale, resolveDocsPath } from "@farming-labs/docs";
import { loadDocsNavTree, loadDocsContent, flattenNavTree } from "./content.js";
import type { PageNode, NavNode, NavTree, ContentPage } from "./content.js";
export { createTanstackApiReference } from "./api-reference.js";

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

export interface DocsServerLoadResult {
  tree: ReturnType<typeof loadDocsNavTree>;
  flatPages: PageNode[];
  title: string;
  description?: string;
  rawContent: string;
  sourcePath: string;
  entry?: string;
  locale?: string;
  slug?: string;
  previousPage: PageNode | null;
  nextPage: PageNode | null;
  editOnGithub?: string;
  lastModified: string;
}

export interface DocsServer {
  load: (input: { pathname: string; locale?: string }) => Promise<DocsServerLoadResult>;
  GET: (context: { request: Request }) => Response;
  POST: (context: { request: Request }) => Promise<Response>;
}

type ContentFileMap = Record<string, string>;

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
): ContentPage[] {
  const pages: ContentPage[] = [];

  for (const key of Object.keys(contentMap)) {
    if (!key.startsWith(dirPrefix)) continue;

    const rel = key.slice(dirPrefix.length);
    const segments = rel.split("/");
    const fileName = segments.pop()!;
    const base = fileName.replace(/\.(md|mdx)$/, "");
    if (base !== "page" && base !== "index") continue;

    const raw = contentMap[key];
    const { data, content } = matter(raw);
    const slug = segments.join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;
    const fallbackTitle =
      segments.length > 0
        ? segments[segments.length - 1]
            .replace(/-/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
        : "Documentation";

    pages.push({
      slug,
      url,
      title: (data.title as string) ?? fallbackTitle,
      description: data.description as string | undefined,
      icon: data.icon as string | undefined,
      content: stripMarkdownText(content),
      rawContent: content,
    });
  }

  return pages;
}

function findPageInMap(contentMap: ContentFileMap, dirPrefix: string, slug: string) {
  const candidates = slug
    ? [
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

export function createDocsServer(config: Record<string, any>): DocsServer {
  const entry = config.entry ?? "docs";
  const ordering = config.ordering;
  const contentDirBase = config.contentDir ?? entry;
  const rootDir = path.resolve((config.rootDir as string | undefined) ?? process.cwd());
  const preloaded = resolvePreloadedContent(config._preloadedContent);
  const i18n = resolveDocsI18n(config.i18n);

  const githubRaw = config.github as string | GithubConfigObj | undefined;
  const githubRepo =
    typeof githubRaw === "string"
      ? githubRaw.replace(/\/$/, "")
      : githubRaw?.url.replace(/\/$/, "");
  const githubBranch = typeof githubRaw === "object" ? (githubRaw.branch ?? "main") : "main";
  const githubContentPath =
    typeof githubRaw === "object" ? githubRaw.directory?.replace(/^\/|\/$/g, "") : undefined;

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
    const tree = preloaded
      ? navTreeFromMap(preloaded, ctx.dirPrefix, entry, ordering)
      : loadDocsNavTree(ctx.contentDirAbs, entry, ordering);
    const flatPages = flattenNavTree(tree);

    const slug = ctx.slug;
    const isIndex = slug === "";

    let raw: string;
    let relPath: string;
    let lastModified: string;

    if (preloaded) {
      const result = findPageInMap(preloaded, ctx.dirPrefix, slug);
      if (!result) {
        const error = new Error(`Page not found: /${entry}/${slug}`) as Error & { status?: number };
        error.status = 404;
        throw error;
      }

      raw = result.raw;
      relPath = result.relPath;
      lastModified = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
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
      lastModified = stat.mtime.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    const { data, content } = matter(raw);

    const currentUrl = isIndex ? `/${entry}` : `/${entry}/${slug}`;
    const currentIndex = flatPages.findIndex((page) => page.url === currentUrl);
    const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
    const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

    let editOnGithub: string | undefined;
    if (githubRepo && githubContentPath) {
      const trimmed = githubContentPath.replace(/\/+$/, "");
      const localePrefix = ctx.locale ? `${ctx.locale}/` : "";
      editOnGithub = `${githubRepo}/blob/${githubBranch}/${trimmed}/${localePrefix}${toPosixPath(relPath)}`;
    }

    const fallbackTitle = isIndex
      ? "Documentation"
      : (slug.split("/").pop()?.replace(/-/g, " ") ?? "Documentation");

    return {
      tree,
      flatPages,
      title: (data.title as string) ?? fallbackTitle,
      description: data.description as string | undefined,
      rawContent: content,
      sourcePath: toSourcePath(ctx.contentDirRel, relPath, rootDir),
      entry,
      locale: ctx.locale,
      ...(isIndex ? {} : { slug }),
      previousPage,
      nextPage,
      editOnGithub,
      lastModified,
    };
  }

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

  function searchByQuery(query: string, ctx: ReturnType<typeof resolveContextFromPath>) {
    const index = getSearchIndex(ctx);
    return index
      .map((page) => {
        const titleMatch = page.title.toLowerCase().includes(query) ? 10 : 0;
        const words = query.split(/\s+/);
        const contentMatch = words.reduce((score, word) => {
          return score + (page.content.toLowerCase().includes(word) ? 1 : 0);
        }, 0);
        return { ...page, score: titleMatch + contentMatch };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  const llmsSiteTitle =
    typeof config.nav === "object" && typeof config.nav?.title === "string"
      ? config.nav.title
      : "Documentation";

  const llmsTxtConfig = config.llmsTxt as
    | boolean
    | { baseUrl?: string; siteTitle?: string; siteDescription?: string }
    | undefined;

  const llmsBaseUrl = typeof llmsTxtConfig === "object" ? (llmsTxtConfig.baseUrl ?? "") : "";
  const llmsTitle =
    typeof llmsTxtConfig === "object" ? (llmsTxtConfig.siteTitle ?? llmsSiteTitle) : llmsSiteTitle;
  const llmsDesc = typeof llmsTxtConfig === "object" ? llmsTxtConfig.siteDescription : undefined;

  const llmsCache = new Map<string, { llmsTxt: string; llmsFullTxt: string }>();

  function getLlmsContent(ctx: ReturnType<typeof resolveContextFromPath>) {
    const key = ctx.locale ?? "__default__";
    const cached = llmsCache.get(key);
    if (cached) return cached;

    const pages = getSearchIndex(ctx);
    let llmsTxt = `# ${llmsTitle}\n\n`;
    let llmsFullTxt = `# ${llmsTitle}\n\n`;

    if (llmsDesc) {
      llmsTxt += `> ${llmsDesc}\n\n`;
      llmsFullTxt += `> ${llmsDesc}\n\n`;
    }

    llmsTxt += "## Pages\n\n";
    for (const page of pages) {
      llmsTxt += `- [${page.title}](${llmsBaseUrl}${page.url})`;
      if (page.description) llmsTxt += `: ${page.description}`;
      llmsTxt += "\n";

      llmsFullTxt += `## ${page.title}\n\n`;
      llmsFullTxt += `URL: ${llmsBaseUrl}${page.url}\n\n`;
      if (page.description) llmsFullTxt += `${page.description}\n\n`;
      llmsFullTxt += `${page.content}\n\n---\n\n`;
    }

    const next = { llmsTxt, llmsFullTxt };
    llmsCache.set(key, next);
    return next;
  }

  function GET(event: { request: Request }): Response {
    const ctx = resolveContextFromRequest(event.request);
    const url = new URL(event.request.url);
    const format = url.searchParams.get("format");

    if (format === "llms" || format === "llms-full") {
      const llmsContent = getLlmsContent(ctx);
      return new Response(format === "llms-full" ? llmsContent.llmsFullTxt : llmsContent.llmsTxt, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const query = url.searchParams.get("query")?.toLowerCase().trim();
    if (!query) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = searchByQuery(query, ctx)
      .slice(0, 10)
      .map(({ title, url: pageUrl, description }) => ({
        content: title,
        url: pageUrl,
        description,
      }));

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectName = typeof config.nav?.title === "string" ? (config.nav.title as string) : null;
  const packageName = aiConfig.packageName;
  const docsUrl = aiConfig.docsUrl;

  function buildDefaultSystemPrompt(): string {
    const lines = [
      `You are a helpful documentation assistant${projectName ? ` for ${projectName}` : ""}.`,
      "Answer questions based on the provided documentation context.",
      "Be concise and accurate. If the answer is not in the context, say so honestly.",
      "Use markdown formatting for code examples and links.",
    ];
    if (packageName) {
      lines.push(`When showing import examples, always use "${packageName}" as the package name.`);
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
    if (!aiConfig.enabled) {
      return new Response(
        JSON.stringify({
          error: "AI is not enabled. Set `ai: { enabled: true }` in your docs config to enable it.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const resolvedKey = aiConfig.apiKey ?? process.env?.OPENAI_API_KEY;

    if (!resolvedKey) {
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
      return new Response(
        JSON.stringify({ error: "Invalid JSON body. Expected { messages: [...] }" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required and must not be empty." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) {
      return new Response(JSON.stringify({ error: "At least one user message is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxResults = aiConfig.maxResults ?? 5;
    const scored = searchByQuery(lastUserMessage.content.toLowerCase(), ctx).slice(0, maxResults);

    const contextParts = scored.map(
      (doc) =>
        `## ${doc.title}\nURL: ${doc.url}\n${doc.description ? `Description: ${doc.description}\n` : ""}\n${doc.content}`,
    );
    const context = contextParts.join("\n\n---\n\n");

    const systemPrompt = aiConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const systemMessage: ChatMessage = {
      role: "system",
      content: context
        ? `${systemPrompt}\n\n---\n\nDocumentation context:\n\n${context}`
        : systemPrompt,
    };

    const llmMessages: ChatMessage[] = [
      systemMessage,
      ...messages.filter((message) => message.role !== "system"),
    ];

    const requestedModel =
      typeof body.model === "string" && body.model.trim().length > 0
        ? body.model.trim()
        : undefined;
    const resolved = resolveAIModelAndProvider(aiConfig, requestedModel);
    const finalKey = resolved.apiKey ?? resolvedKey;

    const llmResponse = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finalKey}`,
      },
      body: JSON.stringify({ model: resolved.model, stream: true, messages: llmMessages }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => "Unknown error");
      return new Response(
        JSON.stringify({ error: `LLM API error (${llmResponse.status}): ${errText}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(llmResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  return { load, GET, POST };
}

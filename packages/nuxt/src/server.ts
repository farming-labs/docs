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
import { loadDocsNavTree, loadDocsContent, flattenNavTree } from "./content.js";
import { renderMarkdown } from "./markdown.js";
import type { PageNode, NavNode, NavTree, ContentPage } from "./content.js";

interface GithubConfigObj {
  url: string;
  branch?: string;
  directory?: string;
}

interface AIConfigObj {
  enabled?: boolean;
  model?: string;
  systemPrompt?: string;
  baseUrl?: string;
  apiKey?: string;
  maxResults?: number;
  suggestedQuestions?: string[];
  aiLabel?: string;
  packageName?: string;
  docsUrl?: string;
}

export interface DocsServer {
  load: (pathname: string) => Promise<{
    tree: ReturnType<typeof loadDocsNavTree>;
    flatPages: PageNode[];
    title: string;
    description?: string;
    html: string;
    slug?: string;
    previousPage: PageNode | null;
    nextPage: PageNode | null;
    editOnGithub?: string;
    lastModified: string;
  }>;
  GET: (context: { request: Request }) => Response;
  POST: (context: { request: Request }) => Promise<Response>;
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
    const base = fileName.replace(/\.(md|mdx|svx)$/, "");
    const isIdx = base === "page" || base === "index" || base === "+page";
    const slug = isIdx ? segments.join("/") : [...segments, base].join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;

    const { data, content } = matter(raw);
    const title =
      (data.title as string) ?? base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    pages.push({
      slug,
      url,
      title,
      description: data.description as string | undefined,
      icon: data.icon as string | undefined,
      content: stripMarkdownText(content),
      rawContent: content,
    });
  }

  return pages;
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

  const githubRaw = config.github;
  const github: GithubConfigObj | null =
    typeof githubRaw === "string" ? { url: githubRaw } : ((githubRaw as GithubConfigObj) ?? null);

  const githubRepo = github?.url;
  const githubBranch = github?.branch ?? "main";
  const githubContentPath = github?.directory;

  const contentDirCfg =
    ((config as Record<string, unknown>).contentDir as string | undefined) ?? entry;
  // If contentDir is absolute, use it as-is; otherwise resolve from cwd.
  const contentDir = path.isAbsolute(contentDirCfg)
    ? contentDirCfg
    : path.resolve(process.cwd(), contentDirCfg);

  const preloaded = config._preloadedContent as ContentFileMap | undefined;
  const contentDirRel =
    ((config as Record<string, unknown>).contentDir as string | undefined) ?? entry;
  const dirPrefix = `/${contentDirRel}/`;

  const ordering = config.ordering as
    | "alphabetical"
    | "numeric"
    | Array<{ slug: string; children?: any[] }>
    | undefined;

  const aiConfig: AIConfigObj = (config.ai as AIConfigObj) ?? {};

  if (config.apiKey && !aiConfig.apiKey) {
    aiConfig.apiKey = config.apiKey as string;
  }

  // ─── Unified load (tree + page content in one call) ────────
  async function load(pathname: string) {
    const tree = preloaded
      ? navTreeFromMap(preloaded, dirPrefix, entry, ordering)
      : loadDocsNavTree(contentDir, entry, ordering);
    const flatPages = flattenNavTree(tree);

    const urlPrefix = new RegExp(`^/${entry}/?`);
    const slug = pathname.replace(urlPrefix, "");
    const isIndex = slug === "";

    let raw: string;
    let relPath: string;
    let lastModified: string;

    if (preloaded) {
      const result = findPageInMap(preloaded, dirPrefix, slug);
      if (!result) {
        const err = new Error(`Page not found: /${entry}/${slug}`) as Error & { status?: number };
        err.status = 404;
        throw err;
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
        for (const name of ["page.md", "page.mdx", "index.md"]) {
          const candidate = path.join(contentDir, name);
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            relPath = name;
            break;
          }
        }
      } else {
        const candidates = [
          path.join(contentDir, slug, "page.md"),
          path.join(contentDir, slug, "page.mdx"),
          path.join(contentDir, slug, "index.md"),
          path.join(contentDir, slug, "index.svx"),
          path.join(contentDir, `${slug}.md`),
          path.join(contentDir, `${slug}.svx`),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            relPath = path.relative(contentDir, candidate);
            break;
          }
        }
      }

      if (!filePath) {
        const err = new Error(`Page not found: /${entry}/${slug}`) as Error & { status?: number };
        err.status = 404;
        throw err;
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
    const html = await renderMarkdown(content);

    const currentUrl = isIndex ? `/${entry}` : `/${entry}/${slug}`;
    const currentIndex = flatPages.findIndex((p) => p.url === currentUrl);
    const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
    const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

    let editOnGithub: string | undefined;
    if (githubRepo && githubContentPath) {
      editOnGithub = `${githubRepo}/blob/${githubBranch}/${githubContentPath}/${relPath}`;
    }

    const fallbackTitle = isIndex
      ? "Documentation"
      : (slug.split("/").pop()?.replace(/-/g, " ") ?? "Documentation");

    return {
      tree,
      flatPages,
      title: (data.title as string) ?? fallbackTitle,
      description: data.description as string | undefined,
      html,
      ...(isIndex ? {} : { slug }),
      previousPage,
      nextPage,
      editOnGithub,
      lastModified,
    };
  }

  // ─── Search index ──────────────────────────────────────────
  let searchIndex: ContentPage[] | null = null;

  function getSearchIndex() {
    if (!searchIndex) {
      searchIndex = preloaded
        ? searchIndexFromMap(preloaded, dirPrefix, entry)
        : loadDocsContent(contentDir, entry);
    }
    return searchIndex;
  }

  function searchByQuery(query: string) {
    const index = getSearchIndex();
    return index
      .map((page) => {
        const titleMatch = page.title.toLowerCase().includes(query) ? 10 : 0;
        const words = query.split(/\s+/);
        const contentMatch = words.reduce((score, word) => {
          return score + (page.content.toLowerCase().includes(word) ? 1 : 0);
        }, 0);
        return { ...page, score: titleMatch + contentMatch };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  // ─── GET /api/docs?query=… — full-text search ────────────
  function GET(context: { request: Request }): Response {
    const url = new URL(context.request.url);
    const query = url.searchParams.get("query")?.toLowerCase().trim();
    if (!query) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = searchByQuery(query)
      .slice(0, 10)
      .map(({ title, url, description }) => ({
        content: title,
        url,
        description,
      }));

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

  async function POST(context: { request: Request }): Promise<Response> {
    if (!aiConfig.enabled) {
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
      return new Response(
        JSON.stringify({
          error:
            "AI is enabled but no API key was found. Set `apiKey` in your docs config `ai` section or add OPENAI_API_KEY to your environment.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    let body: { messages?: ChatMessage[] };
    try {
      body = await context.request.json();
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

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return new Response(JSON.stringify({ error: "At least one user message is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxResults = aiConfig.maxResults ?? 5;
    const scored = searchByQuery(lastUserMessage.content.toLowerCase()).slice(0, maxResults);

    const contextParts = scored.map(
      (doc) =>
        `## ${doc.title}\nURL: ${doc.url}\n${doc.description ? `Description: ${doc.description}\n` : ""}\n${doc.content}`,
    );
    const ragContext = contextParts.join("\n\n---\n\n");

    const systemPrompt = aiConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const systemMessage: ChatMessage = {
      role: "system",
      content: ragContext
        ? `${systemPrompt}\n\n---\n\nDocumentation context:\n\n${ragContext}`
        : systemPrompt,
    };

    const llmMessages: ChatMessage[] = [
      systemMessage,
      ...messages.filter((m) => m.role !== "system"),
    ];

    const baseUrl = (aiConfig.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = aiConfig.model ?? "gpt-4o-mini";

    const llmResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedKey}`,
      },
      body: JSON.stringify({ model, stream: true, messages: llmMessages }),
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
export function defineDocsHandler(
  config: Record<string, any>,
  storage: (base: string) => {
    getKeys(): Promise<string[]>;
    getItem(key: string): Promise<unknown>;
  },
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

  return async (event: any) => {
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
  };
}

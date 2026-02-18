/**
 * Server-side helpers for SvelteKit docs routes.
 *
 * `createDocsServer(config)` returns all the load functions and
 * handlers needed for a complete docs site.  Each route file becomes
 * a one-line re-export.
 *
 * @example
 * ```ts
 * // src/lib/docs.server.ts
 * import { createDocsServer } from "@farming-labs/svelte/server";
 * import config from "../../docs.config.js";
 *
 * export const { load, GET, POST } = createDocsServer(config);
 * ```
 *
 * ```ts
 * // routes/docs/+layout.server.js
 * export { load } from "$lib/docs.server";
 * ```
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { loadDocsNavTree, loadDocsContent, flattenNavTree } from "./content.js";
import { renderMarkdown } from "./markdown.js";
import type { PageNode } from "./content.js";


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

interface UnifiedLoadEvent {
  url: URL;
}

interface RequestEvent {
  url: URL;
  request: Request;
}

export interface DocsServer {
  load: (event: UnifiedLoadEvent) => Promise<{
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
  GET: (event: RequestEvent) => Response;
  POST: (event: RequestEvent) => Promise<Response>;
}

/**
 * Create all server-side functions needed for a SvelteKit docs site.
 *
 * @param config - The `DocsConfig` object (from `defineDocs()` in `docs.config.ts`).
 */
export function createDocsServer(
  config: Record<string, any> = {},
): DocsServer {
  const entry = (config.entry as string) ?? "docs";

  const githubRaw = config.github;
  const github: GithubConfigObj | null =
    typeof githubRaw === "string"
      ? { url: githubRaw }
      : (githubRaw as GithubConfigObj) ?? null;

  const githubRepo = github?.url;
  const githubBranch = github?.branch ?? "main";
  const githubContentPath = github?.directory;

  const contentDir = path.resolve(
    (config as Record<string, unknown>).contentDir as string | undefined ?? entry,
  );

  const aiConfig: AIConfigObj = (config.ai as AIConfigObj) ?? {};

  // Allow top-level apiKey as a shorthand
  if (config.apiKey && !aiConfig.apiKey) {
    aiConfig.apiKey = config.apiKey as string;
  }

  // ─── Unified load (tree + page content in one call) ────────
  async function load(event: UnifiedLoadEvent) {
    const tree = loadDocsNavTree(contentDir, entry);
    const flatPages = flattenNavTree(tree);

    const prefix = new RegExp(`^/${entry}/?`);
    const slug = event.url.pathname.replace(prefix, "");
    const isIndex = slug === "";

    let filePath: string | null = null;
    let relPath = "";

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

    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const html = await renderMarkdown(content);

    const currentUrl = isIndex ? `/${entry}` : `/${entry}/${slug}`;
    const currentIndex = flatPages.findIndex((p) => p.url === currentUrl);
    const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
    const nextPage =
      currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

    let editOnGithub: string | undefined;
    if (githubRepo && githubContentPath) {
      editOnGithub = `${githubRepo}/blob/${githubBranch}/${githubContentPath}/${relPath}`;
    }

    const stat = fs.statSync(filePath);
    const lastModified = stat.mtime.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const fallbackTitle = isIndex
      ? "Documentation"
      : slug.split("/").pop()?.replace(/-/g, " ") ?? "Documentation";

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
  let searchIndex: ReturnType<typeof loadDocsContent> | null = null;

  function getSearchIndex() {
    if (!searchIndex) {
      searchIndex = loadDocsContent(contentDir, entry);
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
  function GET(event: RequestEvent): Response {
    const query = event.url.searchParams.get("query")?.toLowerCase().trim();
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
  const projectName =
    (typeof (config.nav as Record<string, unknown>)?.title === "string"
      ? (config.nav as Record<string, unknown>).title
      : null) as string | null;
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
      lines.push(`When linking to documentation pages, use "${docsUrl}" as the base URL (e.g. ${docsUrl}/docs/get-started).`);
    }
    return lines.join(" ");
  }

  const DEFAULT_SYSTEM_PROMPT = buildDefaultSystemPrompt();

  interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
  }

  async function POST(event: RequestEvent): Promise<Response> {
    if (!aiConfig.enabled) {
      return new Response(
        JSON.stringify({
          error:
            "AI is not enabled. Set `ai: { enabled: true }` in your docs config to enable it.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const resolvedKey =
      aiConfig.apiKey ??
      (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : undefined);

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

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: "At least one user message is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const maxResults = aiConfig.maxResults ?? 5;
    const scored = searchByQuery(lastUserMessage.content.toLowerCase()).slice(0, maxResults);

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

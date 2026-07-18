import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types";
import type { DocsAnalyticsEvent, DocsObservabilityEvent } from "./types.js";
import type { DocsMcpPage } from "./mcp.js";
import {
  createDocsMcpHttpHandler,
  createFilesystemDocsMcpSource,
  normalizeDocsMcpRoute,
  resolveDocsMcpConfig,
} from "./mcp.js";

async function parseMcpPayload<T>(response: Response): Promise<T> {
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return JSON.parse(body) as T;
  }

  const dataLines = body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length).trim())
    .filter(Boolean);

  const payload = dataLines.at(-1);
  if (!payload) {
    throw new Error(`Expected MCP response payload, got: ${body}`);
  }

  return JSON.parse(payload) as T;
}

async function callMcpTool(
  handlers: ReturnType<typeof createDocsMcpHttpHandler>,
  name: string,
  args: Record<string, unknown>,
) {
  return handlers.POST({
    request: new Request("http://localhost/api/docs/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        "mcp-session-id": "stale-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `call-${name}`,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  });
}

function expectSuccessfulStructuredTextResult(payload: {
  result?: {
    content?: Array<{ text?: string }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
}) {
  expect(payload.result?.isError).not.toBe(true);
  expect(payload.result?.structuredContent).toEqual(expect.any(Object));
  expect(payload.result?.content?.[0]?.text?.trim().length).toBeGreaterThan(0);
}

describe("resolveDocsMcpConfig", () => {
  it("enables MCP by default when config is omitted", () => {
    expect(resolveDocsMcpConfig()).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      name: "@farming-labs/docs",
      version: "0.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
    });
  });

  it("treats null config like an omitted config", () => {
    expect(resolveDocsMcpConfig(null as never)).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      name: "@farming-labs/docs",
      version: "0.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
    });
  });

  it("normalizes defaults for enabled object configs", () => {
    expect(
      resolveDocsMcpConfig({
        enabled: true,
      }),
    ).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      name: "@farming-labs/docs",
      version: "0.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
    });
  });

  it("normalizes custom routes", () => {
    expect(normalizeDocsMcpRoute("api/internal/docs/mcp/")).toBe("/api/internal/docs/mcp");
  });
});

describe("createFilesystemDocsMcpSource", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDocsProject() {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-test-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "docs", "installation"), { recursive: true });
    mkdirSync(join(rootDir, "docs", "guides"), { recursive: true });

    writeFileSync(
      join(rootDir, "docs", "page.mdx"),
      `---
title: "Introduction"
description: "Start here"
---

# Introduction

Welcome to the docs.
`,
    );

    writeFileSync(
      join(rootDir, "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install everything"
related:
  - /docs/guides/quickstart
---

# Installation

Run pnpm install.
`,
    );

    writeFileSync(
      join(rootDir, "docs", "installation", "agent.md"),
      `Use \`pnpm install --frozen-lockfile\`.
`,
    );

    writeFileSync(
      join(rootDir, "docs", "guides", "quickstart.mdx"),
      `---
title: "Quickstart"
framework: "nextjs"
version: "16"
tags:
  - setup
related:
  - /docs/installation
  - /docs
---

# Quickstart

Build your first app.

\`\`\`ts title="docs.config.ts" framework="nextjs" packageManager="pnpm" runnable
import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
});
\`\`\`

## Verify generated paths

<Agent>
Validate the generated example paths before editing this guide.
</Agent>
`,
    );

    return rootDir;
  }

  it("builds pages and navigation from a filesystem docs tree", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const pages = await source.getPages();
    const tree = await source.getNavigation();

    expect(pages.map((page) => page.url).sort()).toEqual([
      "/docs",
      "/docs/guides/quickstart",
      "/docs/installation",
    ]);
    expect(pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "/docs/installation",
          agentRawContent: "Use `pnpm install --frozen-lockfile`.\n",
        }),
        expect.objectContaining({
          url: "/docs/guides/quickstart",
          framework: "nextjs",
          version: "16",
          tags: ["setup"],
          agentFallbackRawContent: expect.stringContaining(
            "Validate the generated example paths before editing this guide.",
          ),
        }),
      ]),
    );
    expect(tree.name).toBe("Example Docs");
    expect(tree.children[0]).toMatchObject({
      type: "page",
      name: "Introduction",
      url: "/docs",
    });
  });

  it("uses the current file name for non-index fallback titles", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-fallback-title-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "docs", "guides"), { recursive: true });
    writeFileSync(
      join(rootDir, "docs", "guides", "quickstart.mdx"),
      `# Quickstart

No frontmatter title here.
`,
    );

    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
    });

    const pages = await source.getPages();
    expect(pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "guides/quickstart",
          title: "Quickstart",
        }),
      ]),
    );
  });

  it("omits hidden folder index pages from MCP pages while keeping their children", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-hidden-folder-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "docs", "overview", "what-is-surge"), { recursive: true });
    writeFileSync(join(rootDir, "docs", "page.mdx"), "# Home\n");
    writeFileSync(
      join(rootDir, "docs", "overview", "page.mdx"),
      `---
title: "Overview"
sidebar:
  folderIndexBehavior: hidden
---

# Overview
`,
    );
    writeFileSync(
      join(rootDir, "docs", "overview", "what-is-surge", "page.mdx"),
      "# What is Surge\n",
    );

    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
    });

    const pages = await source.getPages();

    expect(pages.some((page) => page.url === "/docs/overview")).toBe(false);
    expect(pages.some((page) => page.url === "/docs/overview/what-is-surge")).toBe(true);
  });

  it("serves a working MCP transport with the built-in tools", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    expect(initializeResponse.status).toBe(200);
    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const toolsListResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
    });

    const toolsList = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string; outputSchema?: { type?: string } }> };
    }>(toolsListResponse);

    expect(toolsList.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_docs",
        "list_pages",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
        "get_context",
      ]),
    );
    expect(toolsList.result?.tools).toEqual(
      expect.arrayContaining(
        [
          "list_docs",
          "list_pages",
          "get_navigation",
          "search_docs",
          "read_page",
          "get_code_examples",
          "get_config_schema",
          "get_context",
        ].map((name) =>
          expect.objectContaining({
            name,
            outputSchema: expect.objectContaining({ type: "object" }),
          }),
        ),
      ),
    );

    const listDocsResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "list-docs",
          method: "tools/call",
          params: {
            name: "list_docs",
            arguments: {
              section: "guides",
            },
          },
        }),
      }),
    });

    const listDocsPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: Record<string, unknown>;
      };
    }>(listDocsResponse);
    expectSuccessfulStructuredTextResult(listDocsPayload);
    const listDocsText = listDocsPayload.result?.content?.[0]?.text ?? "{}";
    const docsList = JSON.parse(listDocsText) as {
      section?: string;
      resultCount?: number;
      sectionCount?: number;
      pages?: Array<{ slug?: string; url?: string; sourcePath?: string }>;
      sections?: Array<{
        slug?: string;
        title?: string;
        pageCount?: number;
        pages?: Array<{ slug?: string; url?: string }>;
      }>;
    };

    expect(docsList).toMatchObject({
      section: "guides",
      resultCount: 1,
      sectionCount: 1,
      pages: [
        expect.objectContaining({
          slug: "guides/quickstart",
          url: "/docs/guides/quickstart",
          sourcePath: "docs/guides/quickstart.mdx",
        }),
      ],
      sections: [
        expect.objectContaining({
          slug: "guides",
          title: "Guides",
          pageCount: 1,
          pages: [
            expect.objectContaining({
              slug: "guides/quickstart",
              url: "/docs/guides/quickstart",
            }),
          ],
        }),
      ],
    });
    expect(listDocsPayload.result?.structuredContent).toEqual(docsList);

    const searchResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "generated example paths",
            },
          },
        }),
      }),
    });

    const searchPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { results?: Array<{ url?: string }> };
      };
    }>(searchResponse);
    expectSuccessfulStructuredTextResult(searchPayload);

    expect(searchPayload.result?.content?.[0]?.text).toContain("/docs/guides/quickstart");
    expect(searchPayload.result?.structuredContent?.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: "/docs/guides/quickstart" })]),
    );

    const readPageResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "read_page",
            arguments: {
              path: "installation",
            },
          },
        }),
      }),
    });

    const readPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          page?: { url?: string };
          document?: string;
          chars?: number;
          truncated?: boolean;
        };
      };
    }>(readPageResponse);
    expectSuccessfulStructuredTextResult(readPayload);

    expect(readPayload.result?.content?.[0]?.text).toContain(
      "Use `pnpm install --frozen-lockfile`.",
    );
    expect(readPayload.result?.content?.[0]?.text).not.toContain("# Installation");
    expect(readPayload.result?.content?.[0]?.text).not.toContain("URL: /docs/installation");
    expect(readPayload.result?.structuredContent).toMatchObject({
      page: { url: "/docs/installation" },
      document: "Use `pnpm install --frozen-lockfile`.\n",
      chars: "Use `pnpm install --frozen-lockfile`.\n".length,
      truncated: false,
    });

    const quickstartReadResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "read_page",
            arguments: {
              path: "guides/quickstart",
            },
          },
        }),
      }),
    });

    const quickstartPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { page?: { framework?: string; version?: string } };
      };
    }>(quickstartReadResponse);

    expect(quickstartPayload.result?.content?.[0]?.text).toContain(
      "Validate the generated example paths before editing this guide.",
    );
    expect(quickstartPayload.result?.content?.[0]?.text).toContain(
      "Related: /docs/installation, /docs",
    );
    expect(quickstartPayload.result?.content?.[0]?.text).not.toContain("<Agent>");
    expect(quickstartPayload.result?.structuredContent?.page).toMatchObject({
      framework: "nextjs",
      version: "16",
    });

    const codeExamplesResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: {
            name: "get_code_examples",
            arguments: {
              path: "guides/quickstart",
              framework: "nextjs",
              packageManager: "pnpm",
              runnable: true,
            },
          },
        }),
      }),
    });

    const codeExamplesPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { examples?: unknown[] };
      };
    }>(codeExamplesResponse);
    expectSuccessfulStructuredTextResult(codeExamplesPayload);
    const codeExamplesText = codeExamplesPayload.result?.content?.[0]?.text ?? "{}";
    const codeExamples = JSON.parse(codeExamplesText) as {
      examples?: Array<{
        language?: string;
        title?: string;
        framework?: string;
        packageManager?: string;
        runnable?: boolean;
        meta?: Record<string, unknown>;
        code?: string;
        page?: { url?: string };
      }>;
    };

    expect(codeExamples.examples).toEqual([
      expect.objectContaining({
        language: "ts",
        title: "docs.config.ts",
        framework: "nextjs",
        packageManager: "pnpm",
        runnable: true,
        page: expect.objectContaining({ url: "/docs/guides/quickstart" }),
        meta: expect.objectContaining({
          title: "docs.config.ts",
          framework: "nextjs",
          packageManager: "pnpm",
          runnable: true,
        }),
        code: expect.stringContaining("defineDocs"),
      }),
    ]);
    expect(codeExamplesPayload.result?.structuredContent).toEqual(codeExamples);

    const configSchemaResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: {
            name: "get_config_schema",
            arguments: {
              option: "mcp.tools.getConfigSchema",
            },
          },
        }),
      }),
    });

    const configSchemaPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: Record<string, unknown>;
      };
    }>(configSchemaResponse);
    expectSuccessfulStructuredTextResult(configSchemaPayload);
    const configSchemaText = configSchemaPayload.result?.content?.[0]?.text ?? "{}";
    const configSchema = JSON.parse(configSchemaText) as {
      resultCount?: number;
      options?: Array<{
        path?: string;
        name?: string;
        type?: string;
        default?: boolean;
        description?: string;
      }>;
    };

    expect(configSchema.resultCount).toBe(1);
    expect(configSchema.options).toEqual([
      expect.objectContaining({
        path: "mcp.tools.getConfigSchema",
        name: "getConfigSchema",
        type: "boolean",
        default: true,
        description: expect.stringContaining("get_config_schema"),
      }),
    ]);
    expect(configSchemaPayload.result?.structuredContent).toEqual(configSchema);

    const ambiguousConfigSchemaResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: {
            name: "get_config_schema",
            arguments: {
              option: "enabled",
            },
          },
        }),
      }),
    });

    const ambiguousConfigSchemaPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(ambiguousConfigSchemaResponse);
    const ambiguousConfigSchemaText =
      ambiguousConfigSchemaPayload.result?.content?.[0]?.text ?? "{}";
    const ambiguousConfigSchema = JSON.parse(ambiguousConfigSchemaText) as {
      resultCount?: number;
      options?: unknown[];
    };

    expect(ambiguousConfigSchema.resultCount).toBe(0);
    expect(ambiguousConfigSchema.options).toEqual([]);

    const listPagesPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { pages?: Array<{ url?: string }> };
      };
    }>(await callMcpTool(handlers, "list_pages", {}));
    expectSuccessfulStructuredTextResult(listPagesPayload);
    expect(listPagesPayload.result?.structuredContent?.pages).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: "/docs/installation" })]),
    );
    expect(JSON.parse(listPagesPayload.result?.content?.[0]?.text ?? "{}")).toEqual(
      listPagesPayload.result?.structuredContent,
    );

    const navigationPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          navigation?: { name?: string; children?: unknown[] };
          markdown?: string;
        };
      };
    }>(await callMcpTool(handlers, "get_navigation", {}));
    expectSuccessfulStructuredTextResult(navigationPayload);
    expect(navigationPayload.result?.structuredContent?.navigation).toMatchObject({
      name: "Example Docs",
      children: expect.any(Array),
    });
    expect(navigationPayload.result?.content?.[0]?.text).toBe(
      navigationPayload.result?.structuredContent?.markdown,
    );

    const sectionPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          document?: string;
          section?: string;
          anchor?: string;
          chars?: number;
          truncated?: boolean;
        };
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "guides/quickstart",
        section: "verify-generated-paths",
        maxChars: 256,
      }),
    );
    expect(sectionPayload.result?.content?.[0]?.text).toContain("## Verify generated paths");
    expect(sectionPayload.result?.content?.[0]?.text).not.toContain("# Quickstart");
    expect(sectionPayload.result?.structuredContent).toMatchObject({
      section: "Verify generated paths",
      anchor: "verify-generated-paths",
      truncated: false,
    });
    expect(sectionPayload.result?.structuredContent?.document).toBe(
      sectionPayload.result?.content?.[0]?.text,
    );

    const pageHeadingPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { document?: string; section?: string; anchor?: string };
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "guides/quickstart",
        section: "quickstart",
      }),
    );
    expect(pageHeadingPayload.result?.structuredContent).toMatchObject({
      section: "Quickstart",
      anchor: "quickstart",
      document: expect.stringContaining("Build your first app."),
    });

    const contextArguments = {
      query: "generated example paths",
      framework: "next",
      version: "v16",
      tokenBudget: 256,
    };
    const contextPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context?: string;
          resultCount?: number;
          candidateCount?: number;
          budget?: {
            requestedTokens?: number;
            strategy?: string;
            maxUtf8Bytes?: number;
            usedUtf8Bytes?: number;
            conservativeTokenUpperBound?: number;
          };
          sources?: Array<{
            url?: string;
            pageUrl?: string;
            section?: string;
            anchor?: string;
            framework?: string;
            version?: string;
          }>;
        };
      };
    }>(await callMcpTool(handlers, "get_context", contextArguments));
    expectSuccessfulStructuredTextResult(contextPayload);
    const context = contextPayload.result?.structuredContent;
    expect(contextPayload.result?.content?.[0]?.text).toBe(context?.context);
    expect(context?.budget).toMatchObject({
      requestedTokens: 256,
      strategy: "utf8-bytes",
      maxUtf8Bytes: 256,
    });
    const contextUtf8Bytes = new TextEncoder().encode(context?.context ?? "").byteLength;
    expect(context?.budget?.usedUtf8Bytes).toBe(contextUtf8Bytes);
    expect(context?.budget?.conservativeTokenUpperBound).toBe(contextUtf8Bytes);
    expect(contextUtf8Bytes).toBeLessThanOrEqual(256);
    expect(context?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "/docs/guides/quickstart#verify-generated-paths",
          pageUrl: "/docs/guides/quickstart",
          section: "Verify generated paths",
          anchor: "verify-generated-paths",
          framework: "nextjs",
          version: "16",
        }),
      ]),
    );

    const repeatedContextPayload = await parseMcpPayload<{
      result?: { structuredContent?: Record<string, unknown> };
    }>(await callMcpTool(handlers, "get_context", contextArguments));
    expect(repeatedContextPayload.result?.structuredContent).toEqual(context);

    const pageHeadingContextPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          sources?: Array<{ url?: string; content?: string }>;
        };
      };
    }>(
      await callMcpTool(handlers, "get_context", {
        query: "Build your first app",
        tokenBudget: 256,
      }),
    );
    expect(pageHeadingContextPayload.result?.structuredContent?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "/docs/guides/quickstart#quickstart",
          content: expect.stringContaining("Build your first app."),
        }),
      ]),
    );

    const deleteResponse = await handlers.DELETE({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "DELETE",
        headers: {
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
      }),
    });

    expect(deleteResponse.status).toBe(200);
  });

  it("keeps general docs in scoped context, excludes mismatches, and orders sources deterministically within hard budgets", async () => {
    const sharedContent = `# Runtime configuration

Shared runtime configuration guidance.

${"Detailed runtime configuration guidance. ".repeat(60)}`;
    const pages: DocsMcpPage[] = [
      {
        slug: "a-general",
        url: "/docs/a-general",
        title: "Alpha",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "b-general",
        url: "/docs/b-general",
        title: "Beta",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "c-next",
        url: "/docs/c-next",
        title: "Gamma",
        locale: "en",
        framework: "nextjs",
        version: "16",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "c-next-fr",
        url: "/docs/c-next-fr",
        title: "Gamma French",
        locale: "fr",
        framework: "nextjs",
        version: "16",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "c-next-old",
        url: "/docs/c-next-old",
        title: "Gamma old",
        framework: "nextjs",
        version: "15",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "d-astro",
        url: "/docs/d-astro",
        title: "Delta",
        framework: "astro",
        version: "5",
        content: sharedContent,
        rawContent: sharedContent,
      },
    ];

    function createHandlers(sourcePages: DocsMcpPage[]) {
      return createDocsMcpHttpHandler({
        source: {
          entry: "docs",
          siteTitle: "Scoped docs",
          getPages: () => sourcePages,
          getNavigation: () => ({ name: "Scoped docs", children: [] }),
        },
      });
    }

    const contextArguments = {
      query: "runtime configuration",
      framework: "next",
      version: "v16",
      locale: "en",
      tokenBudget: 8_000,
    };
    const forwardPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context: string;
          candidateCount: number;
          resultCount: number;
          budget: {
            requestedTokens: number;
            strategy: string;
            maxUtf8Bytes: number;
          };
          sources: Array<{
            pageUrl: string;
            locale?: string;
            framework?: string;
            version?: string;
          }>;
        };
      };
    }>(await callMcpTool(createHandlers(pages), "get_context", contextArguments));
    const reversePayload = await parseMcpPayload<{
      result?: { structuredContent?: Record<string, unknown> };
    }>(await callMcpTool(createHandlers([...pages].reverse()), "get_context", contextArguments));
    const context = forwardPayload.result?.structuredContent;

    expectSuccessfulStructuredTextResult(forwardPayload);
    expect(context).toMatchObject({
      candidateCount: 3,
      resultCount: 3,
      budget: { requestedTokens: 8_000, strategy: "utf8-bytes", maxUtf8Bytes: 8_000 },
    });
    expect(context?.sources.map((source) => source.pageUrl)).toEqual([
      "/docs/a-general",
      "/docs/b-general",
      "/docs/c-next",
    ]);
    expect(context?.sources.slice(0, 2)).toEqual([
      expect.not.objectContaining({ framework: expect.any(String) }),
      expect.not.objectContaining({ framework: expect.any(String) }),
    ]);
    expect(context?.sources[2]).toMatchObject({
      locale: "en",
      framework: "nextjs",
      version: "16",
    });
    expect(reversePayload.result?.structuredContent).toEqual(context);

    const tightPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context: string;
          budget: {
            requestedTokens: number;
            strategy: string;
            maxUtf8Bytes: number;
            usedUtf8Bytes: number;
            conservativeTokenUpperBound: number;
            remainingUtf8Bytes: number;
            truncated: boolean;
          };
          sources: Array<{ truncated: boolean }>;
        };
      };
    }>(
      await callMcpTool(createHandlers(pages), "get_context", {
        ...contextArguments,
        tokenBudget: 256,
      }),
    );
    const tight = tightPayload.result?.structuredContent;

    expectSuccessfulStructuredTextResult(tightPayload);
    expect(tightPayload.result?.content?.[0]?.text).toBe(tight?.context);
    expect(tight?.budget).toMatchObject({
      requestedTokens: 256,
      strategy: "utf8-bytes",
      maxUtf8Bytes: 256,
      truncated: true,
    });
    const tightUtf8Bytes = new TextEncoder().encode(tight?.context ?? "").byteLength;
    expect(tight?.budget.usedUtf8Bytes).toBe(tightUtf8Bytes);
    expect(tight?.budget.conservativeTokenUpperBound).toBe(tightUtf8Bytes);
    expect(tight?.budget.remainingUtf8Bytes).toBe(256 - tightUtf8Bytes);
    expect(tightUtf8Bytes).toBeLessThanOrEqual(256);
    expect(tight?.sources.at(-1)?.truncated).toBe(true);
  });

  it("bounds the complete assembled context by UTF-8 bytes for Unicode and code", async () => {
    const rawContent = `# Unicode budget

## Byte ceiling

你好🙂 ${"多语言内容🙂 ".repeat(80)}

\`\`\`ts
${'export const value = "你好🙂";\n'.repeat(40)}
\`\`\`
`;
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "unicode-budget",
            url: "/docs/unicode-budget",
            title: "Unicode budget",
            content: rawContent,
            rawContent,
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context: string;
          budget: {
            requestedTokens: number;
            strategy: string;
            maxUtf8Bytes: number;
            usedUtf8Bytes: number;
            conservativeTokenUpperBound: number;
            remainingUtf8Bytes: number;
          };
          sources: Array<{ content: string; utf8Bytes: number }>;
        };
      };
    }>(
      await callMcpTool(handlers, "get_context", {
        query: "byte ceiling",
        tokenBudget: 256,
      }),
    );
    const result = payload.result?.structuredContent;
    const contextBytes = new TextEncoder().encode(result?.context ?? "").byteLength;

    expectSuccessfulStructuredTextResult(payload);
    expect(result?.budget).toMatchObject({
      requestedTokens: 256,
      strategy: "utf8-bytes",
      maxUtf8Bytes: 256,
      usedUtf8Bytes: contextBytes,
      conservativeTokenUpperBound: contextBytes,
      remainingUtf8Bytes: 256 - contextBytes,
    });
    expect(contextBytes).toBeLessThanOrEqual(256);
    expect(result?.context).not.toContain("�");
    expect(result?.sources[0]?.utf8Bytes).toBe(
      new TextEncoder().encode(result?.sources[0]?.content ?? "").byteLength,
    );

    const defaultPayload = await parseMcpPayload<{
      result?: { structuredContent?: { budget?: Record<string, unknown> } };
    }>(await callMcpTool(handlers, "get_context", { query: "byte ceiling" }));
    expect(defaultPayload.result?.structuredContent?.budget).toMatchObject({
      requestedTokens: 4_000,
      maxUtf8Bytes: 4_000,
    });
  });

  it("caps section-not-found errors and includes only headings that fit", async () => {
    const rawContent = Array.from(
      { length: 20 },
      (_, index) => `## Available heading ${index + 1}\n\nDetails ${index + 1}.`,
    ).join("\n\n");
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "sections",
            url: "/docs/sections",
            title: "Sections",
            content: rawContent,
            rawContent,
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        isError?: boolean;
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "/docs/sections",
        section: "missing-heading",
        maxChars: 256,
      }),
    );
    const text = payload.result?.content?.[0]?.text ?? "";
    const error = JSON.parse(text) as {
      error?: string;
      availableSections?: Array<{ title?: string; anchor?: string }>;
      truncated?: boolean;
    };

    expect(payload.result?.isError).toBe(true);
    expect(text.length).toBeLessThanOrEqual(256);
    expect(error).toMatchObject({ error: "section_not_found", truncated: true });
    expect(error.availableSections?.length).toBeGreaterThan(0);
    expect(error.availableSections?.[0]).toEqual({
      title: "Available heading 1",
      anchor: "available-heading-1",
    });
  });

  it("serves stateless MCP requests without requiring sticky sessions", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
    });

    const missingSessionResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools-without-session",
          method: "tools/list",
          params: {},
        }),
      }),
    });

    expect(missingSessionResponse.status).toBe(200);
    const missingSessionPayload = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string }> };
    }>(missingSessionResponse);
    expect(missingSessionPayload.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_docs",
        "list_pages",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
        "get_context",
      ]),
    );

    const expiredSessionResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "expired-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools-expired-session",
          method: "tools/list",
          params: {},
        }),
      }),
    });

    expect(expiredSessionResponse.status).toBe(200);
    const expiredSessionPayload = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string }> };
    }>(expiredSessionResponse);
    expect(expiredSessionPayload.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_docs",
        "list_pages",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
        "get_context",
      ]),
    );
  });

  it("emits analytics and observability separately for MCP requests, tools, and agent page reads", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });
    const analyticsEvents: DocsAnalyticsEvent[] = [];
    const traceEvents: DocsObservabilityEvent[] = [];

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
      analytics: {
        console: false,
        onEvent(event) {
          analyticsEvents.push(event);
        },
      },
      observability: {
        console: false,
        onEvent(event) {
          traceEvents.push(event);
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    let requestId = 2;
    async function callTool(name: string, args: Record<string, unknown>) {
      const response = await handlers.POST({
        request: new Request("http://localhost/api/docs/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
            "mcp-session-id": "stale-session",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: requestId++,
            method: "tools/call",
            params: {
              name,
              arguments: args,
            },
          }),
        }),
      });

      return parseMcpPayload<{ result?: unknown }>(response);
    }

    await callTool("list_pages", {});
    await callTool("get_navigation", {});
    await callTool("search_docs", { query: "generated example paths" });
    await callTool("read_page", { path: "guides/quickstart" });
    await callTool("read_page", { path: "missing" });

    expect(analyticsEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["mcp_request", "mcp_tool", "agent_read"]),
    );
    expect(analyticsEvents.map((event) => event.type)).not.toEqual(
      expect.arrayContaining(["tool.call", "tool.result", "tool.error"]),
    );
    expect(analyticsEvents.filter((event) => event.type === "mcp_request")).toHaveLength(6);
    expect(traceEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["tool.call", "tool.result", "tool.error"]),
    );
    expect(traceEvents.filter((event) => event.type === "tool.call")).toHaveLength(5);
    expect(traceEvents.filter((event) => event.type === "tool.result")).toHaveLength(4);
    expect(traceEvents.filter((event) => event.type === "tool.error")).toHaveLength(1);
    expect(
      traceEvents.filter((event) => event.type === "tool.call").map((event) => event.name),
    ).toEqual(["list_pages", "get_navigation", "search_docs", "read_page", "read_page"]);
    expect(
      traceEvents
        .filter((event) => event.type === "tool.result")
        .map((event) => event.outputPreview),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resultCount: 3 }),
        expect.objectContaining({ chars: expect.any(Number) }),
        expect.objectContaining({ resultCount: expect.any(Number) }),
        expect.objectContaining({ found: true, chars: expect.any(Number) }),
      ]),
    );
    expect(traceEvents.find((event) => event.type === "tool.error")).toMatchObject({
      name: "read_page",
      status: "error",
      durationMs: expect.any(Number),
      outputPreview: expect.objectContaining({ found: false, path: "missing" }),
      metadata: expect.objectContaining({ reason: "not_found" }),
    });
    expect(
      analyticsEvents.filter((event) => event.type === "mcp_tool").map((event) => event.properties),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: "list_pages", resultCount: 3 }),
        expect.objectContaining({ tool: "get_navigation" }),
        expect.objectContaining({ tool: "search_docs", queryLength: 23 }),
        expect.objectContaining({ tool: "read_page", found: true }),
        expect.objectContaining({ tool: "read_page", found: false }),
      ]),
    );
    expect(
      analyticsEvents
        .filter((event) => event.type === "agent_read")
        .map((event) => event.properties),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          delivery: "mcp_tool",
          tool: "read_page",
          requestedPath: "guides/quickstart",
          found: true,
        }),
        expect.objectContaining({
          delivery: "mcp_tool",
          tool: "read_page",
          requestedPath: "missing",
          found: false,
        }),
      ]),
    );
  });

  it("uses the shared search adapter pipeline for search_docs", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
      search: {
        provider: "custom",
        adapter: {
          name: "custom-search",
          async search() {
            return [
              {
                id: "custom-hit",
                url: "/docs/custom-hit",
                content: "Custom search result",
                description: "Resolved through the shared adapter pipeline.",
                type: "page",
              },
            ];
          },
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const searchResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "install",
            },
          },
        }),
      }),
    });

    const searchPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(searchResponse);

    expect(searchPayload.result?.content?.[0]?.text).toContain("/docs/custom-hit");
    expect(searchPayload.result?.content?.[0]?.text).toContain("Custom search result");
  });

  it("falls back to simple search for self-referential MCP search configs", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs", route: "/api/docs/mcp" },
      search: {
        provider: "mcp",
        endpoint: "/api/docs/mcp",
        chunking: {
          strategy: "page",
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const searchResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "install",
            },
          },
        }),
      }),
    });

    const searchPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(searchResponse);

    expect(searchPayload.result?.content?.[0]?.text).toContain("/docs/installation");
    expect(searchPayload.result?.content?.[0]?.text).not.toContain("#quickstart");
  });

  it("returns JSON-RPC 404 responses when MCP is disabled", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: false,
    });

    const response = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {},
        }),
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32000,
        message: expect.stringContaining("MCP is disabled"),
        data: {
          reason: "mcp_disabled",
        },
      },
    });
  });

  it("respects tool toggles in the MCP config", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        enabled: true,
        tools: {
          listDocs: false,
          searchDocs: false,
          readPage: false,
          getConfigSchema: false,
          getContext: false,
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const toolsListResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
    });

    const toolsList = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string }> };
    }>(toolsListResponse);

    expect(toolsList.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["list_pages", "get_navigation", "get_code_examples"]),
    );
    expect(toolsList.result?.tools?.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "list_docs",
        "search_docs",
        "read_page",
        "get_config_schema",
        "get_context",
      ]),
    );
  });

  it("rejects whitespace-only search queries", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const searchResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "   ",
            },
          },
        }),
      }),
    });

    const body = await searchResponse.text();
    expect(body).toContain("Input validation error");
  });
});

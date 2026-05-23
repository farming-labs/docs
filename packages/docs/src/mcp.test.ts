import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types";
import type { DocsAnalyticsEvent, DocsObservabilityEvent } from "./types.js";
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

describe("resolveDocsMcpConfig", () => {
  it("enables MCP by default when config is omitted", () => {
    expect(resolveDocsMcpConfig()).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      name: "@farming-labs/docs",
      version: "0.0.0",
      tools: {
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
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
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
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
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
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
      result?: { tools?: Array<{ name: string }> };
    }>(toolsListResponse);

    expect(toolsList.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_pages",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
      ]),
    );

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
      result?: { content?: Array<{ text?: string }> };
    }>(searchResponse);

    expect(searchPayload.result?.content?.[0]?.text).toContain("/docs/guides/quickstart");

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
      result?: { content?: Array<{ text?: string }> };
    }>(readPageResponse);

    expect(readPayload.result?.content?.[0]?.text).toContain(
      "Use `pnpm install --frozen-lockfile`.",
    );
    expect(readPayload.result?.content?.[0]?.text).not.toContain("# Installation");
    expect(readPayload.result?.content?.[0]?.text).not.toContain("URL: /docs/installation");

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
      result?: { content?: Array<{ text?: string }> };
    }>(quickstartReadResponse);

    expect(quickstartPayload.result?.content?.[0]?.text).toContain(
      "Validate the generated example paths before editing this guide.",
    );
    expect(quickstartPayload.result?.content?.[0]?.text).toContain(
      "Related: /docs/installation, /docs",
    );
    expect(quickstartPayload.result?.content?.[0]?.text).not.toContain("<Agent>");

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
      result?: { content?: Array<{ text?: string }> };
    }>(codeExamplesResponse);
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
      result?: { content?: Array<{ text?: string }> };
    }>(configSchemaResponse);
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
        "list_pages",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
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
        "list_pages",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
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
          searchDocs: false,
          readPage: false,
          getConfigSchema: false,
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
      expect.arrayContaining(["search_docs", "read_page", "get_config_schema"]),
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

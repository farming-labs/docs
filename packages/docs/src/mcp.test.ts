import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types";
import type { DocsAnalyticsEvent, DocsObservabilityEvent } from "./types.js";
import type { DocsMcpDocsPageSummary, DocsMcpPage, DocsMcpResolvedConfig } from "./mcp.js";
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

const DEFAULT_RESOLVED_MCP_CORS = {
  enabled: true,
  allowedHeaders: [
    "Accept",
    "Authorization",
    "Content-Type",
    "Last-Event-ID",
    "MCP-Protocol-Version",
    "MCP-Session-Id",
  ],
  exposedHeaders: ["MCP-Protocol-Version", "MCP-Session-Id", "WWW-Authenticate"],
  allowCredentials: false,
  maxAgeSeconds: 600,
};

describe("resolveDocsMcpConfig", () => {
  it("keeps the new task metadata fields additive for existing consumers", () => {
    const legacySummary: DocsMcpDocsPageSummary = {
      slug: "overview",
      url: "/docs/overview",
      title: "Overview",
    };
    const legacyResolvedConfig: DocsMcpResolvedConfig = {
      enabled: true,
      route: "/api/docs/mcp",
      name: "docs",
      version: "1.0.0",
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
    };

    expect(legacySummary.agent).toBeUndefined();
    expect(legacyResolvedConfig.tools.listTasks).toBeUndefined();
    expect(resolveDocsMcpConfig().tools).toMatchObject({ listTasks: true, readTask: true });
  });

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
        listTasks: true,
        readTask: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
      security: {
        allowedOrigins: "same-origin",
        authenticate: undefined,
        maxBodyBytes: 1_048_576,
        cors: DEFAULT_RESOLVED_MCP_CORS,
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
        listTasks: true,
        readTask: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
      security: {
        allowedOrigins: "same-origin",
        authenticate: undefined,
        maxBodyBytes: 1_048_576,
        cors: DEFAULT_RESOLVED_MCP_CORS,
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
        listTasks: true,
        readTask: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
      security: {
        allowedOrigins: "same-origin",
        authenticate: undefined,
        maxBodyBytes: 1_048_576,
        cors: DEFAULT_RESOLVED_MCP_CORS,
      },
    });
  });

  it("resolves custom HTTP security without enabling authentication by default", () => {
    const authenticate = async () => ({ id: "docs-user" });

    expect(
      resolveDocsMcpConfig({
        security: {
          allowedOrigins: ["https://app.example.com"],
          authenticate,
          maxBodyBytes: 4096.9,
        },
      }).security,
    ).toEqual({
      allowedOrigins: ["https://app.example.com"],
      authenticate,
      maxBodyBytes: 4096,
      cors: DEFAULT_RESOLVED_MCP_CORS,
    });

    expect(resolveDocsMcpConfig({ security: { maxBodyBytes: 0 } }).security).toMatchObject({
      allowedOrigins: "same-origin",
      authenticate: undefined,
      maxBodyBytes: 1_048_576,
      cors: DEFAULT_RESOLVED_MCP_CORS,
    });

    expect(
      resolveDocsMcpConfig({
        security: {
          cors: {
            allowedHeaders: ["X-API-Key", "content-type", "bad\nheader"],
            exposedHeaders: ["X-Docs-Version"],
            allowCredentials: true,
            maxAgeSeconds: 12.9,
          },
        },
      }).security?.cors,
    ).toMatchObject({
      enabled: true,
      allowedHeaders: expect.arrayContaining(["Content-Type", "X-API-Key"]),
      exposedHeaders: expect.arrayContaining(["MCP-Session-Id", "X-Docs-Version"]),
      allowCredentials: true,
      maxAgeSeconds: 12,
    });
    expect(resolveDocsMcpConfig({ security: { cors: false } }).security?.cors.enabled).toBe(false);
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
agent:
  task: Install the framework
  outcome: Dependencies are installed from the lockfile.
  appliesTo:
    framework: nextjs
    package: "@farming-labs/next"
  files:
    - package.json
    - pnpm-lock.yaml
  commands:
    - run: pnpm install --frozen-lockfile
      description: Install exact dependency versions
  verification:
    - run: pnpm test
      expect: Tests pass
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
agent:
  task: Create the first docs page
  outcome: The quickstart route renders.
  files:
    - docs.config.ts
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
          agent: {
            task: "Install the framework",
            outcome: "Dependencies are installed from the lockfile.",
            appliesTo: {
              framework: ["nextjs"],
              package: ["@farming-labs/next"],
            },
            files: ["package.json", "pnpm-lock.yaml"],
            commands: [
              {
                run: "pnpm install --frozen-lockfile",
                description: "Install exact dependency versions",
              },
            ],
            verification: [{ run: "pnpm test", expect: "Tests pass" }],
          },
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
        "list_tasks",
        "read_task",
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
          "list_tasks",
          "read_task",
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
    for (const toolName of ["list_pages", "list_docs"]) {
      expect(
        toolsList.result?.tools?.find((tool) => tool.name === toolName)?.outputSchema,
      ).toMatchObject({
        properties: {
          pages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                agent: {
                  type: "object",
                  properties: { hasContract: { type: "boolean" } },
                },
              },
            },
          },
        },
      });
    }

    const listPagesResponse = await handlers.POST({
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
          id: "list-pages",
          method: "tools/call",
          params: { name: "list_pages", arguments: {} },
        }),
      }),
    });
    const listPagesPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(listPagesResponse);
    const listedPages = JSON.parse(listPagesPayload.result?.content?.[0]?.text ?? "{}") as {
      pages?: Array<{
        url?: string;
        agent?: {
          hasContract?: boolean;
          task?: string;
          outcome?: string;
          files?: string[];
          commands?: unknown[];
        };
      }>;
    };
    expect(listedPages.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "/docs/installation",
          agent: expect.objectContaining({
            hasContract: true,
            task: "Install the framework",
            outcome: "Dependencies are installed from the lockfile.",
          }),
        }),
      ]),
    );
    const installationSummary = listedPages.pages?.find(
      (page) => page.url === "/docs/installation",
    );
    expect(installationSummary?.agent).not.toHaveProperty("files");
    expect(installationSummary?.agent).not.toHaveProperty("commands");

    const listTasksResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "list-tasks",
          method: "tools/call",
          params: {
            name: "list_tasks",
            arguments: { query: "lockfile", framework: "nextjs" },
          },
        }),
      }),
    });
    const listTasksPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          resultCount?: number;
          tasks?: Array<{ url?: string; task?: string; appliesTo?: unknown }>;
        };
        content?: Array<{ text?: string }>;
      };
    }>(listTasksResponse);
    expect(listTasksPayload.result?.structuredContent).toMatchObject({
      resultCount: 1,
      tasks: [
        {
          url: "/docs/installation",
          task: "Install the framework",
          appliesTo: {
            framework: ["nextjs"],
            package: ["@farming-labs/next"],
          },
        },
      ],
    });
    expect(JSON.parse(listTasksPayload.result?.content?.[0]?.text ?? "{}")).toEqual(
      listTasksPayload.result?.structuredContent,
    );

    const readTaskResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "read-task",
          method: "tools/call",
          params: { name: "read_task", arguments: { path: "installation" } },
        }),
      }),
    });
    const readTaskPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          page?: { url?: string };
          contract?: { files?: string[]; commands?: unknown[]; verification?: unknown[] };
        };
        content?: Array<{ text?: string }>;
      };
    }>(readTaskResponse);
    expect(readTaskPayload.result?.structuredContent).toMatchObject({
      page: { url: "/docs/installation" },
      contract: {
        files: ["package.json", "pnpm-lock.yaml"],
        commands: [
          {
            run: "pnpm install --frozen-lockfile",
            description: "Install exact dependency versions",
          },
        ],
        verification: [{ run: "pnpm test", expect: "Tests pass" }],
      },
    });
    expect(JSON.parse(readTaskPayload.result?.content?.[0]?.text ?? "{}")).toEqual(
      readTaskPayload.result?.structuredContent,
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
      pages?: Array<{
        slug?: string;
        url?: string;
        sourcePath?: string;
        agent?: { hasContract?: boolean; task?: string; outcome?: string; files?: string[] };
      }>;
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
          agent: {
            hasContract: true,
            task: "Create the first docs page",
            outcome: "The quickstart route renders.",
          },
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
    expect(docsList.pages?.[0]?.agent).not.toHaveProperty("files");
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
    expect(readPayload.result?.content?.[0]?.text).toContain("## Agent Contract");
    expect(readPayload.result?.content?.[0]?.text).toContain("Task: Install the framework");
    expect(readPayload.result?.content?.[0]?.text).toContain("- Package: `@farming-labs/next`");
    expect(readPayload.result?.content?.[0]?.text).not.toContain("# Installation");
    expect(readPayload.result?.content?.[0]?.text).not.toContain("URL: /docs/installation");
    const readDocument = readPayload.result?.content?.[0]?.text ?? "";
    expect(readPayload.result?.structuredContent).toMatchObject({
      page: { url: "/docs/installation" },
      document: readDocument,
      chars: readDocument.length,
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

    const structuredListPagesPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { pages?: Array<{ url?: string }> };
      };
    }>(await callMcpTool(handlers, "list_pages", {}));
    expectSuccessfulStructuredTextResult(structuredListPagesPayload);
    expect(structuredListPagesPayload.result?.structuredContent?.pages).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: "/docs/installation" })]),
    );
    expect(JSON.parse(structuredListPagesPayload.result?.content?.[0]?.text ?? "{}")).toEqual(
      structuredListPagesPayload.result?.structuredContent,
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

  it("hydrates contract-only context matches with the structured agent contract", async () => {
    const rawContent = `# Operations

General operational guidance.
`;
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "credential-rotation",
            url: "/docs/credential-rotation",
            title: "Operations",
            content: rawContent,
            rawContent,
            agent: {
              task: "Rotate quasar production credentials",
              outcome: "Production uses the replacement credential without downtime.",
              commands: [{ run: "pnpm credentials:rotate", description: "Rotate credentials" }],
            },
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context?: string;
          resultCount?: number;
          sources?: Array<{ url?: string; section?: string; content?: string }>;
        };
      };
    }>(
      await callMcpTool(handlers, "get_context", {
        query: "quasar production credentials",
        tokenBudget: 4_000,
      }),
    );

    expectSuccessfulStructuredTextResult(payload);
    expect(payload.result?.structuredContent).toMatchObject({
      resultCount: 1,
      sources: [
        expect.objectContaining({
          url: "/docs/credential-rotation",
          content: expect.stringContaining("Task: Rotate quasar production credentials"),
        }),
      ],
    });
    expect(payload.result?.structuredContent?.context).toContain(
      "Task: Rotate quasar production credentials",
    );
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

  it("rejects invalid supplied Origins before authentication", async () => {
    const rootDir = createTempDocsProject();
    const authenticate = vi.fn(async () => ({ id: "docs-user" }));
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: { authenticate },
      },
    });

    const response = await handlers.POST({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "POST",
        headers: {
          origin: "https://malicious.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Forbidden Origin" });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("accepts same-origin and explicitly allowed Origins", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({ rootDir });
    const initializeBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });
    const requestHeaders = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
    };

    const sameOriginHandlers = createDocsMcpHttpHandler({ source });
    const sameOriginResponse = await sameOriginHandlers.POST({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "POST",
        headers: { ...requestHeaders, origin: "https://docs.example.com" },
        body: initializeBody,
      }),
    });
    expect(sameOriginResponse.status).toBe(200);
    expect(sameOriginResponse.headers.get("access-control-allow-origin")).toBe(
      "https://docs.example.com",
    );
    expect(sameOriginResponse.headers.get("access-control-allow-credentials")).toBeNull();

    const allowedOriginHandlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        security: { allowedOrigins: ["https://app.example.com/"] },
      },
    });
    const allowedOriginResponse = await allowedOriginHandlers.POST({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "POST",
        headers: { ...requestHeaders, origin: "https://app.example.com" },
        body: initializeBody,
      }),
    });
    expect(allowedOriginResponse.status).toBe(200);
    expect(allowedOriginResponse.headers.get("access-control-allow-origin")).toBe(
      "https://app.example.com",
    );
  });

  it("keeps HTTP MCP public until an authentication callback is configured", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({ rootDir });
    const handlers = createDocsMcpHttpHandler({ source });

    const response = await handlers.POST({
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
            clientInfo: { name: "vitest", version: "1.0.0" },
          },
        }),
      }),
    });

    expect(response.status).toBe(200);
  });

  it("requires opt-in authentication and exposes the principal to custom sources", async () => {
    const rootDir = createTempDocsProject();
    const filesystemSource = createFilesystemDocsMcpSource({ rootDir });
    const seenContexts: unknown[] = [];
    const originPolicyBodies: string[] = [];
    const authenticatedBodies: string[] = [];
    const allowedOrigins = vi.fn(async ({ request }) => {
      originPolicyBodies.push(await request.text());
      return true;
    });
    const authenticate = vi.fn(async ({ request, pathname }) => {
      authenticatedBodies.push(await request.text());
      if (request.headers.get("authorization") !== "Bearer valid") return null;
      return {
        id: "user-123",
        scopes: ["docs:read"],
        claims: { pathname },
      };
    });
    const handlers = createDocsMcpHttpHandler({
      source: {
        ...filesystemSource,
        getPages(locale, context) {
          seenContexts.push(context);
          return filesystemSource.getPages(locale);
        },
        getNavigation(locale, context) {
          seenContexts.push(context);
          return filesystemSource.getNavigation(locale);
        },
      },
      mcp: {
        security: {
          allowedOrigins,
          authenticate,
          cors: { allowCredentials: true },
        },
      },
    });
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
      origin: "https://app.example.com",
    };

    const unauthorized = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers,
        body,
      }),
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(unauthorized.headers.get("access-control-allow-credentials")).toBe("true");
    await expect(unauthorized.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(seenContexts).toHaveLength(0);

    const authorized = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: { ...headers, authorization: "Bearer valid" },
        body,
      }),
    });
    expect(authorized.status).toBe(200);
    expect(originPolicyBodies).toEqual([body, body]);
    expect(authenticatedBodies).toEqual([body, body]);
    expect(authorized.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(authorized.headers.get("access-control-allow-credentials")).toBe("true");
    expect(authorized.headers.get("access-control-expose-headers")).toContain("MCP-Session-Id");
    expect(authorized.headers.get("vary")).toContain("Origin");
    expect(authenticate).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: "/api/docs/mcp" }),
    );
    expect(seenContexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transport: "http",
          auth: {
            id: "user-123",
            scopes: ["docs:read"],
            claims: { pathname: "/api/docs/mcp" },
          },
        }),
      ]),
    );

    seenContexts.length = 0;
    const contextBody = JSON.stringify({
      jsonrpc: "2.0",
      id: "authenticated-context",
      method: "tools/call",
      params: {
        name: "get_context",
        arguments: { query: "getting started", locale: "en" },
      },
    });
    const contextResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          ...headers,
          authorization: "Bearer valid",
          "mcp-session-id": "stale-session",
        },
        body: contextBody,
      }),
    });
    const contextPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: unknown;
        isError?: boolean;
      };
    }>(contextResponse);

    expect(contextResponse.status).toBe(200);
    expectSuccessfulStructuredTextResult(contextPayload);
    expect(seenContexts.length).toBeGreaterThanOrEqual(3);
    for (const context of seenContexts) {
      expect(context).toMatchObject({
        transport: "http",
        auth: {
          id: "user-123",
          scopes: ["docs:read"],
          claims: { pathname: "/api/docs/mcp" },
        },
      });
    }

    for (const toolCall of [
      { name: "list_tasks", arguments: { query: "Install", locale: "en" } },
      { name: "read_task", arguments: { path: "installation", locale: "en" } },
    ]) {
      seenContexts.length = 0;
      const toolResponse = await handlers.POST({
        request: new Request("http://localhost/api/docs/mcp", {
          method: "POST",
          headers: {
            ...headers,
            authorization: "Bearer valid",
            "mcp-session-id": "stale-session",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `authenticated-${toolCall.name}`,
            method: "tools/call",
            params: toolCall,
          }),
        }),
      });
      const toolPayload = await parseMcpPayload<{
        result?: {
          content?: Array<{ text?: string }>;
          structuredContent?: unknown;
          isError?: boolean;
        };
      }>(toolResponse);

      expect(toolResponse.status).toBe(200);
      expectSuccessfulStructuredTextResult(toolPayload);
      expect(seenContexts.length).toBeGreaterThanOrEqual(3);
      for (const context of seenContexts) {
        expect(context).toMatchObject({
          transport: "http",
          auth: {
            id: "user-123",
            scopes: ["docs:read"],
            claims: { pathname: "/api/docs/mcp" },
          },
        });
      }
    }
  });

  it("passes through custom authentication Responses and sanitizes thrown errors", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({ rootDir });
    const customHandlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        security: {
          authenticate: async () =>
            new Response("Use the organization login", {
              status: 403,
              headers: { "x-auth-provider": "example" },
            }),
        },
      },
    });
    const customResponse = await customHandlers.GET({
      request: new Request("http://localhost/api/docs/mcp"),
    });
    expect(customResponse.status).toBe(403);
    expect(customResponse.headers.get("x-auth-provider")).toBe("example");
    await expect(customResponse.text()).resolves.toBe("Use the organization login");

    const failingHandlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        security: {
          authenticate: async () => {
            throw new Error("secret provider detail");
          },
        },
      },
    });
    const failingResponse = await failingHandlers.GET({
      request: new Request("http://localhost/api/docs/mcp"),
    });
    expect(failingResponse.status).toBe(500);
    expect(await failingResponse.text()).not.toContain("secret provider detail");
  });

  it("rejects POST bodies over the configured byte limit", async () => {
    const rootDir = createTempDocsProject();
    const allowedOrigins = vi.fn(async ({ request }) => {
      await request.text();
      return true;
    });
    const authenticate = vi.fn(async ({ request }) => {
      await request.text();
      return { id: "should-not-run" };
    });
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: {
          maxBodyBytes: 32,
          allowedOrigins,
          authenticate,
        },
      },
    });

    const request = new Request("http://localhost/api/docs/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.example.com",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    expect(request.headers.has("content-length")).toBe(false);

    const response = await handlers.POST({
      request,
    });

    expect(response.status).toBe(413);
    expect(allowedOrigins).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        data: { reason: "request_too_large", maxBodyBytes: 32 },
      },
    });
  });

  it("handles browser CORS preflight without authenticating", async () => {
    const rootDir = createTempDocsProject();
    const authenticate = vi.fn(async () => null);
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: {
          allowedOrigins: ["https://app.example.com"],
          authenticate,
          cors: {
            allowedHeaders: ["X-API-Key"],
            exposedHeaders: ["X-Docs-Version"],
            allowCredentials: true,
            maxAgeSeconds: 120,
          },
        },
      },
    });

    const response = await handlers.OPTIONS({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization, content-type, x-api-key",
        },
      }),
    });

    expect(response.status).toBe(204);
    expect(authenticate).not.toHaveBeenCalled();
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, DELETE, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toContain("X-API-Key");
    expect(response.headers.get("access-control-max-age")).toBe("120");
    expect(response.headers.get("vary")).toContain("Origin");
    expect(response.headers.get("vary")).toContain("Access-Control-Request-Method");
    expect(response.headers.get("vary")).toContain("Access-Control-Request-Headers");

    const rejected = await handlers.OPTIONS({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "x-not-allowed",
        },
      }),
    });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(authenticate).not.toHaveBeenCalled();

    const corsDisabledHandlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: {
          allowedOrigins: ["https://app.example.com"],
          cors: false,
        },
      },
    });
    const corsDisabled = await corsDisabledHandlers.OPTIONS({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
        },
      }),
    });
    expect(corsDisabled.status).toBe(204);
    expect(corsDisabled.headers.get("access-control-allow-origin")).toBeNull();
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
          listTasks: false,
          readTask: false,
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
        "list_tasks",
        "read_task",
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

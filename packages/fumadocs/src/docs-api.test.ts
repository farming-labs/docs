import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs, { chmodSync, mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DocsAnalyticsEvent, DocsObservabilityEvent } from "@farming-labs/docs";
import { createDocsAPI, createDocsMCPAPI } from "./docs-api.js";

function createDeferredPromise<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function parseMcpPayload<T>(response: Response): Promise<T> {
  const body = await response.text();

  try {
    return JSON.parse(body) as T;
  } catch {
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
}

describe("createDocsMCPAPI", () => {
  const tempDirs: string[] = [];
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns Next-compatible route handlers for the default MCP endpoint", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    const { POST, OPTIONS } = createDocsMCPAPI({
      rootDir,
      entry: "docs",
      nav: { title: "Example Docs" },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-05",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-05",
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    const initializePayload = await parseMcpPayload<{
      result?: { serverInfo?: { name?: string } };
    }>(response);
    expect(initializePayload.result?.serverInfo?.name).toBe("Example Docs");

    const listPagesResponse = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "list_pages",
            arguments: {},
          },
        }),
      }),
    );

    const payload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(listPagesResponse);

    expect(payload.result?.content?.[0]?.text).toContain("/docs");

    const preflight = await OPTIONS(
      new Request("http://localhost/api/docs/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type, mcp-protocol-version",
        },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://localhost");
  });

  it("fails closed when the legacy constructor would drop source-configured MCP security", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-secure-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  mcp: {
    security: {
      async authenticate({ request }) {
        return request.headers.has("authorization") ? { id: "docs-user" } : null;
      },
    },
  },
};
`,
    );

    expect(() => createDocsMCPAPI({ rootDir })).toThrowError(
      /Import the live config and call createDocsMCPAPI\(docsConfig\)/,
    );

    process.chdir(rootDir);
    expect(() => createDocsMCPAPI()).toThrowError(/Refusing to create a public MCP endpoint/);
  });

  it("uses an explicitly provided live MCP authentication callback", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-live-security-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );

    const authenticate = vi.fn(async ({ request }: { request: Request }) =>
      request.headers.get("authorization") === "Bearer secret" ? { id: "docs-user" } : null,
    );
    const { POST } = createDocsMCPAPI({
      rootDir,
      entry: "docs",
      mcp: {
        security: { authenticate },
      },
    });
    const createRequest = (authorization?: string) =>
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          ...(authorization ? { authorization } : {}),
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "vitest", version: "1.0.0" },
          },
        }),
      });

    expect((await POST(createRequest())).status).toBe(401);
    expect((await POST(createRequest("Bearer secret"))).status).toBe(200);
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it("ignores commented or quoted mcp flags when real config enables MCP", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );

    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  note: "mcp: false; security: { authenticate() {} }",
  // mcp: false
  mcp: {
    enabled: true,
    // security: { authenticate() { return null; } },
    tools: {
      note: "authenticate: callback",
      security: {
        authenticate: false,
      },
    },
  },
};
`,
    );

    const { POST } = createDocsMCPAPI({
      rootDir,
      entry: "docs",
      nav: { title: "Example Docs" },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    const payload = await parseMcpPayload<{
      result?: { serverInfo?: { name?: string } };
    }>(response);
    expect(payload.result?.serverInfo?.name).toBe("Example Docs");
  });

  it("honors task and context tool opt-outs from the source docs config", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-tool-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Introduction\n");
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  mcp: {
    enabled: true,
    tools: {
      listTasks: false,
      readTask: false,
      getContext: false,
    },
  },
};
`,
    );

    const { POST } = createDocsMCPAPI({ rootDir });
    const response = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
    );
    const payload = await parseMcpPayload<{
      result?: { tools?: Array<{ name?: string }> };
    }>(response);
    const toolNames = payload.result?.tools?.map((tool) => tool.name) ?? [];

    expect(response.status).toBe(200);
    expect(toolNames).toContain("list_pages");
    expect(toolNames).not.toEqual(
      expect.arrayContaining(["list_tasks", "read_task", "get_context"]),
    );
  });

  it("ignores nested mcp booleans outside the root config property", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-nested-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );

    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  theme: someTheme({
    mcp: false,
  }),
  mcp: true,
});
`,
    );

    const { POST } = createDocsMCPAPI({
      rootDir,
      entry: "docs",
      nav: { title: "Example Docs" },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    const payload = await parseMcpPayload<{
      result?: { serverInfo?: { name?: string } };
    }>(response);
    expect(payload.result?.serverInfo?.name).toBe("Example Docs");
  });

  it("uses the provided custom search adapter for GET search requests", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      entry: "docs",
      search: {
        provider: "custom",
        adapter: {
          name: "custom",
          async search() {
            return [
              {
                id: "custom-1",
                url: "/docs/installation",
                content: "Custom search result",
                description: "Returned from the custom adapter",
                type: "page",
              },
            ];
          },
        },
      },
    });

    const response = await GET(new Request("http://localhost/api/docs?query=install"));
    const payload = (await response.json()) as Array<{
      id: string;
      content: string;
      description?: string;
    }>;

    expect(payload).toEqual([
      {
        id: "custom-1",
        url: "/docs/installation",
        content: "Custom search result",
        description: "Returned from the custom adapter",
        type: "page",
      },
    ]);
  });

  it("uses built-in simple search when no search config is provided", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-default-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
description: "Start here"
---

# Introduction

Welcome to the docs.

## Quickstart

Install and configure the docs framework.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/api/docs?query=quickstart"));
    const payload = (await response.json()) as Array<{
      url: string;
      content: string;
      description?: string;
      type: string;
    }>;

    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]).toMatchObject({
      url: "/docs#quickstart",
      type: "heading",
    });
    expect(payload[0]?.content).toContain("Quickstart");
  });

  it("omits hidden folder index pages from search and markdown lookups", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-hidden-folder-index-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "overview", "what-is-surge"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    writeFileSync(
      join(rootDir, "app", "docs", "overview", "page.mdx"),
      `---
title: "Overview"
sidebar:
  folderIndexBehavior: hidden
---

# Overview

This page should not be indexed as a standalone doc.
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "overview", "what-is-surge", "page.mdx"),
      `---
title: "What is Surge"
---

# What is Surge

Surge overview child.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      entry: "docs",
    });

    const searchResponse = await GET(new Request("http://localhost/api/docs?query=standalone"));
    const searchPayload = (await searchResponse.json()) as Array<{ url: string }>;
    expect(searchPayload.some((entry) => entry.url === "/docs/overview")).toBe(false);

    const markdownResponse = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=overview"),
    );
    expect(markdownResponse.status).toBe(404);
    expect(await markdownResponse.text()).toContain("# Docs Page Not Found");
  });

  it("serves llms.txt aliases through the shared docs api handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-llms-alias-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
description: "Start here"
---

# Introduction

Welcome to the docs.

<Human>Use the visual coral walkthrough.</Human>

<Audience only="agent">Use the scripted indigo workflow.</Audience>
`,
    );
    mkdirSync(join(rootDir, "app", "docs", "installation"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "How to install"
---

# Installation

Install the package.
`,
    );
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `import { createTheme, defineDocs } from "@farming-labs/docs";

const theme = createTheme({
  colors: {
    primary: "indigo",
  },
});

export default defineDocs({
  theme,
  llmsTxt: {
    enabled: true,
    siteTitle: "Alias Docs",
    baseUrl: "https://docs.example.com",
  },
});`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const llmsApi = await GET(new Request("http://localhost/api/docs?format=llms"));
    const llmsApiText = await llmsApi.text();
    expect(llmsApi.status).toBe(200);
    expect(llmsApi.headers.get("content-type")).toContain("text/plain");
    expect(llmsApiText).toContain("# Alias Docs");
    expect(llmsApiText).toContain("- [Introduction](https://docs.example.com/docs.md): Start here");
    expect(llmsApiText).toContain(
      "- [Installation](https://docs.example.com/docs/installation.md): How to install",
    );
    expect(llmsApiText).not.toContain("(https://docs.example.com/docs/installation):");

    for (const path of ["/llms.txt", "/.well-known/llms.txt", "/docs/llms.txt"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).toBe(llmsApiText);
    }

    const customLlms = await GET(new Request("http://localhost/api/internal/docs?format=llms"));
    expect(customLlms.status).toBe(200);
    expect(await customLlms.text()).toBe(llmsApiText);

    const llmsFullApi = await GET(new Request("http://localhost/api/docs?format=llms-full"));
    const llmsFullApiText = await llmsFullApi.text();
    expect(llmsFullApi.status).toBe(200);
    expect(llmsFullApiText).toContain("Welcome to the docs.");
    expect(llmsFullApiText).toContain("scripted indigo workflow");
    expect(llmsFullApiText).not.toContain("visual coral walkthrough");

    for (const path of ["/llms-full.txt", "/.well-known/llms-full.txt", "/docs/llms-full.txt"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).toBe(llmsFullApiText);
    }

    for (const path of ["/sitemap.xml", "/docs/sitemap.md"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      const sitemap = await response.text();
      expect(response.status).toBe(200);
      expect(sitemap).toContain("/docs");
      expect(sitemap).not.toContain("visual coral walkthrough");
      expect(sitemap).not.toContain("scripted indigo workflow");
    }

    const customSitemap = await GET(
      new Request("http://localhost/api/internal/docs?format=sitemap-md"),
    );
    expect(customSitemap.status).toBe(200);
    expect(await customSitemap.text()).toContain("/docs/installation.md");

    const customMarkdown = await GET(
      new Request("http://localhost/api/internal/docs?format=markdown&path=installation"),
    );
    expect(customMarkdown.status).toBe(200);
    expect(customMarkdown.headers.get("content-type")).toContain("text/markdown");
    expect(await customMarkdown.text()).toContain("Install the package.");

    const customMissingMarkdown = await GET(
      new Request("http://localhost/api/internal/docs?format=markdown&path=zzzzzzzz"),
    );
    const customMissingMarkdownText = await customMissingMarkdown.text();
    expect(customMissingMarkdown.status).toBe(404);
    expect(customMissingMarkdownText).toContain("/api/internal/docs?agent=spec");
    expect(customMissingMarkdownText).toContain("/api/internal/docs?query={query}");
    expect(customMissingMarkdownText).not.toContain("/api/docs?query={query}");

    const skillApi = await GET(new Request("http://localhost/api/docs?format=skill"));
    const skillApiText = await skillApi.text();
    expect(skillApi.status).toBe(200);
    expect(skillApi.headers.get("content-type")).toContain("text/markdown");
    expect(skillApiText).toContain("name: docs");
    expect(skillApiText).toContain("# Alias Docs Skill");
    expect(skillApiText).toContain("/docs.md");
    expect(skillApiText).toContain("/.well-known/agent.json");

    for (const path of ["/skill.md", "/.well-known/skill.md"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/markdown");
      expect(await response.text()).toBe(skillApiText);
    }

    const customSkill = await GET(new Request("http://localhost/api/internal/docs?format=skill"));
    const customSkillText = await customSkill.text();
    expect(customSkill.status).toBe(200);
    expect(customSkillText).toContain("/api/internal/docs?format=skill");
    expect(customSkillText).not.toContain("/api/docs?format=skill");

    const agentsApi = await GET(new Request("http://localhost/api/docs?format=agents"));
    const agentsApiText = await agentsApi.text();
    expect(agentsApi.status).toBe(200);
    expect(agentsApi.headers.get("content-type")).toContain("text/markdown");
    expect(agentsApiText).toContain("# Agent Instructions");
    expect(agentsApiText).toContain("Site: Alias Docs");
    expect(agentsApiText).toContain("/AGENTS.md");
    expect(agentsApiText).toContain("/api/docs?format=agents");

    for (const path of [
      "/AGENTS.md",
      "/.well-known/AGENTS.md",
      "/AGENT.md",
      "/.well-known/AGENT.md",
    ]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/markdown");
      expect(await response.text()).toBe(agentsApiText);
    }

    const customAgents = await GET(new Request("http://localhost/api/internal/docs?format=agents"));
    const customAgentsText = await customAgents.text();
    expect(customAgents.status).toBe(200);
    expect(customAgentsText).toContain("/api/internal/docs?format=agents");
    expect(customAgentsText).not.toContain("/api/docs?format=agents");
  });

  it("serves opt-in section-level llms.txt routes", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-llms-sections-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "api", "users"), { recursive: true });
    mkdirSync(join(rootDir, "app", "docs", "guides", "auth"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Start here"
---

# Overview

Welcome.
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "api", "users", "page.mdx"),
      `---
title: "Users API"
description: "User endpoints"
---

# Users API

Use the Users API.
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "guides", "auth", "page.mdx"),
      `---
title: "Auth Guide"
---

# Auth Guide

Set up auth.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      llmsTxt: {
        enabled: true,
        siteTitle: "Section Docs",
        baseUrl: "https://docs.example.com",
        maxChars: { mode: "warn", chars: 50_000 },
        sections: [
          {
            title: "API",
            description: "Endpoint reference",
            match: "/docs/api/**",
          },
        ],
      },
    });

    const rootResponse = await GET(new Request("http://localhost/llms.txt"));
    const rootText = await rootResponse.text();
    expect(rootResponse.status).toBe(200);
    expect(rootText).toContain("## Sections");
    expect(rootText).toContain(
      "- [API](https://docs.example.com/docs/api/llms.txt): Endpoint reference",
    );
    expect(rootText).toContain("- [Overview](https://docs.example.com/docs.md): Start here");
    expect(rootText).not.toContain("Users API");

    const sectionResponse = await GET(new Request("http://localhost/docs/api/llms.txt"));
    const sectionText = await sectionResponse.text();
    expect(sectionResponse.status).toBe(200);
    expect(sectionText).toContain("# Section Docs - API");
    expect(sectionText).toContain(
      "- [Users API](https://docs.example.com/docs/api/users.md): User endpoints",
    );
    expect(sectionText).not.toContain("Overview");

    const sectionFullResponse = await GET(new Request("http://localhost/docs/api/llms-full.txt"));
    const sectionFullText = await sectionFullResponse.text();
    expect(sectionFullResponse.status).toBe(200);
    expect(sectionFullText).toContain("Use the Users API.");
    expect(sectionFullText).not.toContain("Welcome.");

    const apiResponse = await GET(
      new Request("http://localhost/api/docs?format=llms&section=/docs/api/llms.txt"),
    );
    expect(await apiResponse.text()).toBe(sectionText);
  });

  it("serves llms.txt by default when llmsTxt is omitted", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-llms-default-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "getting-started"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "getting-started", "page.mdx"),
      `---
title: "Getting Started"
description: "First steps"
---

# Getting Started

Start here.
`,
    );
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  nav: {
    title: "Default Docs",
  },
};`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/docs/llms.txt"));
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("# Default Docs");
    expect(text).toContain("- [Getting Started](/docs/getting-started.md): First steps");
  });

  it("serves llms.txt through a custom public docsPath", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-llms-docspath-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "api"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "api", "page.mdx"),
      `---
title: "API"
description: "Endpoint docs"
---

# API

Use the API.
`,
    );
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  docsPath: "/guides",
  llmsTxt: {
    enabled: true,
    siteTitle: "Guide Docs",
  },
};`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/guides/llms.txt"));
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("# Guide Docs");
    expect(text).toContain("- [API](/guides/api.md): Endpoint docs");

    const rootResponse = await GET(new Request("http://localhost/llms.txt"));
    expect(await rootResponse.text()).toBe(text);
  });

  it("serves an OpenAPI schema through the shared docs api handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-openapi-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    mkdirSync(join(rootDir, "app", "api", "hello"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "api", "hello", "route.ts"),
      `/** Hello endpoint */
export async function GET() {
  return Response.json({ ok: true });
}
`,
      "utf-8",
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      apiReference: {
        enabled: true,
        path: "api-reference",
      },
    });

    const response = await GET(new Request("http://localhost/api/docs?format=openapi"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
    };
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths).toMatchObject({
      "/api/hello": {
        get: {
          summary: "Hello endpoint",
        },
      },
    });
  });

  it("serves robots.txt by default through the shared docs api handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-robots-default-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    for (const path of ["/robots.txt", "/api/docs?format=robots"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      const content = await response.text();
      expect(content).toContain("Allow: /llms.txt");
      expect(content).toContain("Allow: /sitemap.xml");
      expect(content).toContain("Allow: /docs/sitemap.md");
      expect(content).toContain("User-agent: GPTBot");
    }
  });

  it("honors llmsTxt opt-out in the shared docs api handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-llms-disabled-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  llmsTxt: false,
};`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/llms.txt"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("keeps Agent Skills available when the API catalog is opted out", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-api-catalog-disabled-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  llmsTxt: { apiCatalog: false },
};`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({ rootDir, entry: "docs" });
    for (const path of ["/.well-known/api-catalog", "/api/internal/docs?format=api-catalog"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("link")).not.toContain('rel="api-catalog"');
    }

    for (const path of [
      "/.well-known/agent-skills/index.json",
      "/api/internal/docs?format=agent-skills",
    ]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("link")).not.toContain('rel="api-catalog"');
      expect((await response.json()).skills).toHaveLength(1);
    }

    const manifestResponse = await GET(new Request("http://localhost/.well-known/agent.json"));
    const manifest = (await manifestResponse.json()) as {
      capabilities: { apiCatalog: boolean };
      api: Record<string, unknown>;
      apiCatalog: { enabled: boolean; route: string | null };
    };
    expect(manifest.capabilities.apiCatalog).toBe(false);
    expect(manifest.api).not.toHaveProperty("apiCatalog");
    expect(manifest.apiCatalog).toMatchObject({ enabled: false, route: null });
    expect(manifestResponse.headers.get("link")).not.toContain('rel="api-catalog"');

    for (const path of ["/skill.md", "/AGENTS.md", "/llms.txt"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      const content = await response.text();
      expect(content).not.toContain("/.well-known/api-catalog");
      expect(content).toContain("/.well-known/agent-skills/index.json");
    }

    const robotsResponse = await GET(new Request("http://localhost/robots.txt"));
    const robots = await robotsResponse.text();
    expect(robots).not.toContain("/.well-known/api-catalog");
    expect(robots).toContain("/.well-known/agent-skills/index.json");

    const explicitlyEnabled = createDocsAPI({
      rootDir,
      entry: "docs",
      apiCatalog: true,
    });
    const enabledCatalog = await explicitlyEnabled.GET(
      new Request("http://localhost/.well-known/api-catalog"),
    );
    expect(enabledCatalog.status).toBe(200);
  });

  it("reads llmsTxt properties after nested config objects", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-nested-llms-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `import { createTheme, defineDocs } from "@farming-labs/docs";

const theme = createTheme({
  colors: {
    primary: "indigo",
  },
});

export default defineDocs({
  theme,
  llmsTxt: {
    maxChars: {
      mode: "warn",
      chars: 50_000,
    },
    apiCatalog: false,
    baseUrl: "https://docs.example.com",
    siteTitle: "Nested Config Docs",
    siteDescription: "Nested options stay readable",
  },
});`,
    );

    const { GET } = createDocsAPI({ rootDir, entry: "docs" });

    const catalog = await GET(new Request("http://localhost/.well-known/api-catalog"));
    expect(catalog.status).toBe(404);

    const llms = await GET(new Request("http://localhost/llms.txt"));
    const llmsText = await llms.text();
    expect(llmsText).toContain("# Nested Config Docs");
    expect(llmsText).toContain("> Nested options stay readable");
    expect(llmsText).toContain("https://docs.example.com/docs.md");

    const manifest = await GET(new Request("http://localhost/.well-known/agent.json"));
    expect(await manifest.json()).toMatchObject({
      capabilities: { apiCatalog: false },
      apiCatalog: { enabled: false, route: null, api: null },
    });
  });

  it("serves a root skill.md file before falling back to generated skill content", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-root-skill-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );
    writeFileSync(
      join(rootDir, "skill.md"),
      `---
name: docs
description: Custom docs skill.
---

# Custom Docs Skill

Use the product-specific workflow first.
`,
    );

    process.chdir(rootDir);

    const { GET, HEAD, POST } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const skillApi = await GET(new Request("http://localhost/api/docs?format=skill"));
    const skillApiText = await skillApi.text();
    expect(skillApi.status).toBe(200);
    expect(skillApi.headers.get("content-type")).toContain("text/markdown");
    expect(skillApiText).toContain("# Custom Docs Skill");
    expect(skillApiText).toContain("Use the product-specific workflow first.");
    expect(skillApiText).not.toContain("# Documentation Skill");

    for (const path of ["/skill.md", "/.well-known/skill.md", "/api/internal/docs?format=skill"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/markdown");
      expect(await response.text()).toBe(skillApiText);
    }

    const catalogResponse = await GET(new Request("http://localhost/.well-known/api-catalog"));
    expect(catalogResponse.status).toBe(200);
    expect(catalogResponse.headers.get("content-type")).toBe(
      'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"; charset=utf-8',
    );
    expect(catalogResponse.headers.get("link")).toContain('rel="api-catalog"');
    expect(catalogResponse.headers.get("link")).toContain("</.well-known/agent.json>");
    expect(catalogResponse.headers.get("link")).toContain("</.well-known/agent-skills/index.json>");
    const catalog = (await catalogResponse.json()) as {
      linkset: Array<{
        anchor: string;
        item?: Array<{ href: string }>;
        "service-doc"?: Array<{ href: string }>;
        "service-meta"?: Array<{ href: string }>;
      }>;
    };
    expect(catalog.linkset[0]).toMatchObject({
      anchor: "http://localhost/.well-known/api-catalog",
    });
    expect(catalog.linkset[0]?.item?.map(({ href }) => href)).toContain(
      "http://localhost/api/docs",
    );
    expect(catalog.linkset[0]?.["service-doc"]?.map(({ href }) => href)).toEqual(
      expect.arrayContaining([
        "http://localhost/AGENTS.md",
        "http://localhost/skill.md",
        "http://localhost/docs.md",
      ]),
    );
    expect(catalog.linkset[0]?.["service-meta"]?.map(({ href }) => href)).toEqual(
      expect.arrayContaining([
        "http://localhost/.well-known/agent.json",
        "http://localhost/.well-known/agent-skills/index.json",
      ]),
    );

    const catalogQueryResponse = await GET(
      new Request("http://localhost/api/docs?format=api-catalog"),
    );
    expect(await catalogQueryResponse.json()).toEqual(catalog);

    const catalogHead = await HEAD(
      new Request("http://localhost/.well-known/api-catalog", { method: "HEAD" }),
    );
    expect(catalogHead.status).toBe(200);
    expect(catalogHead.headers.get("content-type")).toContain("application/linkset+json");
    expect(await catalogHead.text()).toBe("");

    const indexResponse = await GET(
      new Request("http://localhost/.well-known/agent-skills/index.json"),
    );
    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers.get("content-type")).toContain("application/json");
    expect(indexResponse.headers.get("access-control-allow-origin")).toBe("*");
    expect(indexResponse.headers.get("link")).toContain('rel="item"');
    const index = (await indexResponse.json()) as {
      $schema: string;
      skills: Array<{
        name: string;
        type: string;
        description: string;
        url: string;
        digest: string;
      }>;
    };
    const skillDigest = createHash("sha256").update(skillApiText, "utf8").digest("hex");
    expect(index).toEqual({
      $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
      skills: [
        {
          name: "docs",
          type: "skill-md",
          description: "Custom docs skill.",
          url: "/.well-known/agent-skills/docs/SKILL.md",
          digest: `sha256:${skillDigest}`,
        },
      ],
    });

    const indexQueryResponse = await GET(
      new Request("http://localhost/api/docs?format=agent-skills"),
    );
    expect(await indexQueryResponse.json()).toEqual(index);

    const customIndexQueryResponse = await GET(
      new Request("http://localhost/api/internal/docs?format=agent-skills"),
    );
    expect(customIndexQueryResponse.status).toBe(200);
    expect(await customIndexQueryResponse.json()).toEqual(index);

    const customCatalogQueryResponse = await GET(
      new Request("http://localhost/api/internal/docs?format=api-catalog"),
    );
    expect(customCatalogQueryResponse.status).toBe(200);
    const customCatalog = (await customCatalogQueryResponse.json()) as {
      linkset: Array<{ item?: Array<{ href: string }> }>;
    };
    expect(customCatalog.linkset[0]?.item?.map(({ href }) => href)).toContain(
      "http://localhost/api/internal/docs",
    );

    for (const path of [
      "/.well-known/agent-skills/docs/SKILL.md",
      "/api/docs?format=agent-skill&name=docs",
      "/api/internal/docs?format=agent-skill&name=docs",
    ]) {
      const artifactResponse = await GET(new Request(`http://localhost${path}`));
      expect(artifactResponse.status).toBe(200);
      expect(artifactResponse.headers.get("content-type")).toContain("text/markdown");
      expect(artifactResponse.headers.get("etag")).toBe(`"${skillDigest}"`);
      expect(artifactResponse.headers.get("link")).toContain('rel="collection"');
      expect(await artifactResponse.text()).toBe(skillApiText);
    }

    for (const path of [
      "/.well-known/agent-skills/index.json",
      "/.well-known/agent-skills/docs/SKILL.md",
    ]) {
      const response = await HEAD(new Request(`http://localhost${path}`, { method: "HEAD" }));
      expect(response.status).toBe(200);
      expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
      expect(await response.text()).toBe("");
    }

    const customIndexHead = await HEAD(
      new Request("http://localhost/api/internal/docs?format=agent-skills", {
        method: "HEAD",
      }),
    );
    expect(customIndexHead.status).toBe(200);
    expect(await customIndexHead.text()).toBe("");

    const customIndexPost = await POST(
      new Request("http://localhost/api/internal/docs?format=agent-skills", {
        method: "POST",
      }),
    );
    expect(customIndexPost.status).toBe(405);
    expect(customIndexPost.headers.get("allow")).toBe("GET, HEAD");
  });

  it("serves legacy discovery HEAD without loading documents and records HEAD analytics", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-discovery-head-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    writeFileSync(join(rootDir, "AGENTS.md"), "# Custom agent instructions\n");
    writeFileSync(
      join(rootDir, "skill.md"),
      `---
name: docs
description: Custom docs skill.
---

# Custom skill
`,
    );

    const events: DocsAnalyticsEvent[] = [];
    const { HEAD, POST } = createDocsAPI({
      rootDir,
      entry: "docs",
      analytics: {
        console: false,
        onEvent(event) {
          events.push(event);
        },
      },
    });
    const readFileSpy = vi.spyOn(fs, "readFileSync");

    try {
      for (const path of ["/.well-known/agent.json", "/AGENTS.md", "/skill.md"]) {
        const response = await HEAD(new Request(`http://localhost${path}`, { method: "HEAD" }));
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("");
      }

      const legacyFiles = new Set([join(rootDir, "AGENTS.md"), join(rootDir, "skill.md")]);
      expect(
        readFileSpy.mock.calls.some(([file]) => typeof file === "string" && legacyFiles.has(file)),
      ).toBe(false);
      expect(
        events
          .filter((event) =>
            ["agent_spec_request", "agents_request", "skill_request"].includes(event.type),
          )
          .map((event) => event.properties?.method),
      ).toEqual(["HEAD", "HEAD", "HEAD"]);

      const unsupported = await POST(
        new Request("http://localhost/api/docs?format=agent-skills", { method: "POST" }),
      );
      expect(unsupported.status).toBe(405);
      expect(unsupported.headers.get("allow")).toBe("GET, HEAD");
    } finally {
      readFileSpy.mockRestore();
    }
  });

  it("serves a root AGENTS.md file before falling back to generated agent instructions", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-root-agents-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );
    writeFileSync(
      join(rootDir, "AGENTS.md"),
      `# Custom Agent Instructions

Use the product-specific coding workflow first.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const agentsApi = await GET(new Request("http://localhost/api/docs?format=agents"));
    const agentsApiText = await agentsApi.text();
    expect(agentsApi.status).toBe(200);
    expect(agentsApi.headers.get("content-type")).toContain("text/markdown");
    expect(agentsApiText).toContain("# Custom Agent Instructions");
    expect(agentsApiText).toContain("product-specific coding workflow");
    expect(agentsApiText).not.toContain("# Agent Instructions");

    for (const path of [
      "/AGENTS.md",
      "/.well-known/AGENTS.md",
      "/AGENT.md",
      "/.well-known/AGENT.md",
      "/api/internal/docs?format=agents",
    ]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/markdown");
      expect(await response.text()).toBe(agentsApiText);
    }
  });

  it("uses the human audience projection for normal search", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Visible content.

<Human>Search should return this human-only coral token.</Human>

<Audience only="agent">
Search should not return this hidden agent-only zebra token.
</Audience>
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      entry: "docs",
    });

    const response = await GET(
      new Request("http://localhost/api/docs?query=agent-only%20zebra%20token"),
    );
    const payload = (await response.json()) as Array<{ content: string; description?: string }>;
    const renderedSearchText = payload
      .map((result) => `${result.content}\n${result.description ?? ""}`)
      .join("\n");

    expect(renderedSearchText).not.toContain("agent-only zebra token");

    const humanResponse = await GET(
      new Request("http://localhost/api/docs?query=human-only%20coral%20token"),
    );
    const humanPayload = (await humanResponse.json()) as Array<{
      content: string;
      description?: string;
    }>;
    expect(humanPayload.some((result) => result.content.includes("Introduction"))).toBe(true);
  });

  it("serves markdown through the default docs api route, including Agent blocks and preferring agent.md when present", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-markdown-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "getting-started", "quickstart"), { recursive: true });
    mkdirSync(join(rootDir, "app", "docs", "overview"), { recursive: true });
    mkdirSync(join(rootDir, "app", "docs", "configuration"), { recursive: true });
    const quickstartPath = join(
      rootDir,
      "app",
      "docs",
      "getting-started",
      "quickstart",
      "page.mdx",
    );
    writeFileSync(
      quickstartPath,
      `---
title: "Quickstart"
description: "Start fast"
related:
  - /docs/overview
  - /docs/configuration
agent:
  tokenBudget: 700
  task: Start the docs app
  outcome: The local docs route responds successfully.
  appliesTo:
    framework: nextjs
    version: ">=16"
  files:
    - docs.config.ts
  commands:
    - pnpm dev
  verification:
    - expect: The docs route returns HTTP 200
---

# Quickstart

Run \`pnpm dev\`.

<Agent>
Verify the onboarding command examples before changing this page.
</Agent>

<Human>Follow the visual dashboard walkthrough.</Human>

<Audience only="agent">
Run the deterministic onboarding verifier.
</Audience>
`,
    );
    const quickstartLastModified = new Date("2026-07-18T14:23:45.000Z");
    utimesSync(quickstartPath, quickstartLastModified, quickstartLastModified);
    writeFileSync(
      join(rootDir, "app", "docs", "overview", "page.mdx"),
      `---
title: "Overview"
description: "Human overview"
related:
  - /docs/configuration
---

# Overview

Human content.

<Agent>
This embedded agent block should be ignored because agent.md overrides the page.
</Agent>
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "overview", "agent.md"),
      `<Human>Open the overview dashboard.</Human>

<Audience only="agent">Use this page as the implementation map.</Audience>
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "configuration", "page.mdx"),
      `---
title: "Configuration"
description: "Configure the framework"
---

# Configuration

Config content.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const fallbackResponse = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=getting-started/quickstart"),
    );
    expect(fallbackResponse.status).toBe(200);
    expect(fallbackResponse.headers.get("content-type")).toContain("text/markdown");
    expect(fallbackResponse.headers.get("link")).toBe(
      '<http://localhost/docs/getting-started/quickstart>; rel="canonical"',
    );
    expect(fallbackResponse.headers.get("last-modified")).toBe("Sat, 18 Jul 2026 14:23:45 GMT");
    expect(fallbackResponse.headers.get("vary")).toBeNull();
    const fallbackDocument = await fallbackResponse.text();
    expect(fallbackDocument).toMatch(/^---\ntitle: "Quickstart"/);
    expect(fallbackDocument).toContain(
      'canonical_url: "http://localhost/docs/getting-started/quickstart"',
    );
    expect(fallbackDocument).toContain(
      'markdown_url: "http://localhost/docs/getting-started/quickstart.md"',
    );
    expect(fallbackDocument).toMatch(/last_updated: "\d{4}-\d{2}-\d{2}"/);
    expect(fallbackDocument).toContain("agent:\n  tokenBudget: 700");
    expect(fallbackDocument).toContain('  task: "Start the docs app"');
    expect(fallbackDocument).toContain("# Quickstart\nURL: /docs/getting-started/quickstart");
    expect(fallbackDocument).toContain("LLM index: /llms.txt");
    expect(fallbackDocument).toContain(
      ["Description: Start fast", "Related: /docs/overview, /docs/configuration"].join("\n"),
    );
    expect(fallbackDocument).toContain(
      "Verify the onboarding command examples before changing this page.",
    );
    expect(fallbackDocument).toContain("Run the deterministic onboarding verifier.");
    expect(fallbackDocument).not.toContain("Follow the visual dashboard walkthrough.");
    expect(fallbackDocument).toContain("## Agent Contract");
    expect(fallbackDocument).toContain("- Framework: `nextjs`");
    expect(fallbackDocument).toContain("### Verification\n\n- The docs route returns HTTP 200");
    expect(fallbackDocument).not.toContain("<Agent>");

    const { GET: getWithSitemapBaseUrl } = createDocsAPI({
      rootDir,
      entry: "docs",
      sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
    });
    const sitemapBaseUrlResponse = await getWithSitemapBaseUrl(
      new Request("http://localhost/api/docs?format=markdown&path=getting-started/quickstart"),
    );
    expect(sitemapBaseUrlResponse.headers.get("link")).toBe(
      '<https://docs.example.com/docs/getting-started/quickstart>; rel="canonical"',
    );
    const sitemapBaseUrlDocument = await sitemapBaseUrlResponse.text();
    expect(sitemapBaseUrlDocument).toContain(
      'canonical_url: "https://docs.example.com/docs/getting-started/quickstart"',
    );
    expect(sitemapBaseUrlDocument).toContain(
      'markdown_url: "https://docs.example.com/docs/getting-started/quickstart.md"',
    );

    const { GET: getWithLlmsDisabled } = createDocsAPI({
      rootDir,
      entry: "docs",
      llmsTxt: false,
    });
    const disabledFallbackResponse = await getWithLlmsDisabled(
      new Request("http://localhost/api/docs?format=markdown&path=getting-started/quickstart"),
    );
    expect(await disabledFallbackResponse.text()).not.toContain("LLM index: /llms.txt");

    const agentResponse = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=overview"),
    );
    expect(agentResponse.status).toBe(200);
    expect(agentResponse.headers.get("last-modified")).toBeNull();
    const agentDocument = await agentResponse.text();
    expect(agentDocument).toMatch(/^---\ntitle: "Overview"/);
    expect(agentDocument).toContain('description: "Human overview"');
    expect(agentDocument).toContain('canonical_url: "http://localhost/docs/overview"');
    expect(agentDocument).toContain('markdown_url: "http://localhost/docs/overview.md"');
    expect(agentDocument).toContain("Use this page as the implementation map.");
    expect(agentDocument).not.toContain("Open the overview dashboard.");
    expect(agentDocument).toContain("## Sitemap");

    const rewrittenFallbackResponse = await GET(
      new Request("http://localhost/docs/getting-started/quickstart.md"),
    );
    expect(rewrittenFallbackResponse.status).toBe(200);
    expect(rewrittenFallbackResponse.headers.get("content-type")).toContain("text/markdown");
    expect(rewrittenFallbackResponse.headers.get("link")).toBe(
      '<http://localhost/docs/getting-started/quickstart>; rel="canonical"',
    );
    expect(rewrittenFallbackResponse.headers.get("content-location")).toBe(
      "http://localhost/docs/getting-started/quickstart.md",
    );
    expect(rewrittenFallbackResponse.headers.get("etag")).toMatch(/^W\/"/);
    expect(rewrittenFallbackResponse.headers.get("last-modified")).toBe(
      "Sat, 18 Jul 2026 14:23:45 GMT",
    );
    expect(rewrittenFallbackResponse.headers.get("vary")).toBeNull();
    expect(await rewrittenFallbackResponse.text()).toContain(
      "Verify the onboarding command examples before changing this page.",
    );
    const conditionalResponse = await GET(
      new Request("http://localhost/docs/getting-started/quickstart.md", {
        headers: { "If-None-Match": rewrittenFallbackResponse.headers.get("etag") ?? "" },
      }),
    );
    expect(conditionalResponse.status).toBe(304);
    expect(await conditionalResponse.text()).toBe("");

    const dateConditionalResponse = await GET(
      new Request("http://localhost/docs/getting-started/quickstart.md", {
        headers: { "If-Modified-Since": "Sat, 18 Jul 2026 14:23:45 GMT" },
      }),
    );
    expect(dateConditionalResponse.status).toBe(304);
    expect(await dateConditionalResponse.text()).toBe("");

    const rewrittenAgentResponse = await GET(new Request("http://localhost/docs/overview.md"));
    expect(rewrittenAgentResponse.status).toBe(200);
    expect(await rewrittenAgentResponse.text()).toContain(
      "Use this page as the implementation map.",
    );

    const acceptFallbackResponse = await GET(
      new Request("http://localhost/docs/getting-started/quickstart", {
        headers: { accept: "text/markdown" },
      }),
    );
    expect(acceptFallbackResponse.status).toBe(200);
    expect(acceptFallbackResponse.headers.get("content-type")).toContain("text/markdown");
    expect(acceptFallbackResponse.headers.get("link")).toBe(
      '<http://localhost/docs/getting-started/quickstart>; rel="canonical"',
    );
    expect(acceptFallbackResponse.headers.get("vary")).toBe("Accept");
    expect(await acceptFallbackResponse.text()).toContain(
      "Verify the onboarding command examples before changing this page.",
    );

    const acceptAgentResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { accept: "text/markdown, */*" },
      }),
    );
    expect(acceptAgentResponse.status).toBe(200);
    expect(acceptAgentResponse.headers.get("vary")).toBe("Accept");
    expect(await acceptAgentResponse.text()).toContain("Use this page as the implementation map.");

    const weightedAcceptAgentResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { accept: "application/json, text/markdown;q=0.5" },
      }),
    );
    expect(weightedAcceptAgentResponse.status).toBe(200);
    expect(weightedAcceptAgentResponse.headers.get("content-type")).toContain("text/markdown");
    expect(weightedAcceptAgentResponse.headers.get("vary")).toBe("Accept");
    expect(await weightedAcceptAgentResponse.text()).toContain(
      "Use this page as the implementation map.",
    );

    const htmlPreferredResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { accept: "text/html;q=1, text/markdown;q=0.5" },
      }),
    );
    expect(htmlPreferredResponse.headers.get("content-type")).not.toContain("text/markdown");
    expect(await htmlPreferredResponse.text()).toBe("[]");

    const signatureAgentResponse = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=overview", {
        headers: { "Signature-Agent": "https://chatgpt.com" },
      }),
    );
    expect(signatureAgentResponse.status).toBe(200);
    expect(signatureAgentResponse.headers.get("vary")).toBe("Accept, Signature-Agent");
    expect(await signatureAgentResponse.text()).toContain(
      "Use this page as the implementation map.",
    );

    const signatureAgentPageResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { "Signature-Agent": "https://chatgpt.com" },
      }),
    );
    expect(signatureAgentPageResponse.status).toBe(200);
    expect(signatureAgentPageResponse.headers.get("content-type")).toContain("text/markdown");
    expect(signatureAgentPageResponse.headers.get("link")).toBe(
      '<http://localhost/docs/overview>; rel="canonical"',
    );
    expect(signatureAgentPageResponse.headers.get("vary")).toBe("Accept, Signature-Agent");
    expect(await signatureAgentPageResponse.text()).toContain(
      "Use this page as the implementation map.",
    );

    const userAgentPageResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { "user-agent": "ClaudeBot/1.0" },
      }),
    );
    expect(userAgentPageResponse.status).toBe(200);
    expect(userAgentPageResponse.headers.get("content-type")).toContain("text/markdown");
    expect(userAgentPageResponse.headers.get("link")).toBe(
      '<http://localhost/docs/overview>; rel="canonical"',
    );
    expect(userAgentPageResponse.headers.get("vary")).toBe("User-Agent");
    expect(await userAgentPageResponse.text()).toContain(
      "Use this page as the implementation map.",
    );

    const heuristicPageResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { "user-agent": "AcmeAgentFetcher/1.0" },
      }),
    );
    expect(heuristicPageResponse.status).toBe(200);
    expect(heuristicPageResponse.headers.get("content-type")).toContain("text/markdown");
    expect(heuristicPageResponse.headers.get("vary")).toBe("User-Agent, Sec-Fetch-Mode");
    expect(await heuristicPageResponse.text()).toContain(
      "Use this page as the implementation map.",
    );

    const browserLikeHeuristicResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: {
          "user-agent": "AcmeAgentFetcher/1.0",
          "sec-fetch-mode": "navigate",
        },
      }),
    );
    expect(browserLikeHeuristicResponse.headers.get("content-type")).not.toContain("text/markdown");
    expect(await browserLikeHeuristicResponse.text()).toBe("[]");

    const zeroQualityAcceptResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { accept: "application/json, text/markdown;profile=agent;q=0" },
      }),
    );
    expect(zeroQualityAcceptResponse.headers.get("content-type")).not.toContain("text/markdown");
    expect(await zeroQualityAcceptResponse.text()).toBe("[]");

    const substringAcceptResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { accept: "application/not-text/markdownish" },
      }),
    );
    expect(substringAcceptResponse.headers.get("content-type")).not.toContain("text/markdown");
    expect(await substringAcceptResponse.text()).toBe("[]");
  });

  it("emits agent_read analytics for markdown API, .md routes, and Accept header reads", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-read-analytics-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "guides", "setup"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    writeFileSync(
      join(rootDir, "app", "docs", "guides", "setup", "page.mdx"),
      `---
title: "Setup"
---

# Setup

Install the package.
`,
    );

    const events: Array<{
      type: string;
      source?: string;
      path?: string;
      properties?: Record<string, unknown>;
    }> = [];

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      analytics: {
        console: false,
        onEvent(event) {
          events.push(event);
        },
      },
    });

    await GET(new Request("http://localhost/api/docs?format=markdown&path=guides/setup"));
    await GET(new Request("http://localhost/docs/guides/setup.md"));
    await GET(
      new Request("http://localhost/docs/guides/setup", {
        headers: { accept: "text/markdown" },
      }),
    );
    await GET(
      new Request("http://localhost/docs/guides/setup", {
        headers: { "user-agent": "ClaudeBot/1.0" },
      }),
    );

    const agentReads = events.filter((event) => event.type === "agent_read");
    expect(agentReads).toHaveLength(4);
    expect(agentReads.map((event) => event.properties?.delivery)).toEqual([
      "api_format",
      "md_route",
      "accept_header",
      "user_agent",
    ]);
    expect(agentReads.find((event) => event.properties?.delivery === "user_agent")).toMatchObject({
      properties: expect.objectContaining({
        userAgent: "ClaudeBot/1.0",
      }),
    });
    expect(agentReads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "server",
          path: "/api/docs",
          properties: expect.objectContaining({
            requestedPath: "guides/setup",
            found: true,
          }),
        }),
        expect.objectContaining({
          source: "server",
          path: "/docs/guides/setup.md",
          properties: expect.objectContaining({
            requestedPath: "guides/setup",
            found: true,
          }),
        }),
        expect.objectContaining({
          source: "server",
          path: "/docs/guides/setup",
          properties: expect.objectContaining({
            requestedPath: "guides/setup",
            found: true,
          }),
        }),
      ]),
    );
  });

  it("emits analytics for docs API, agent, markdown, feedback, and search routes", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-api-analytics-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "guides", "setup"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
description: "Start here"
---

# Introduction

Welcome to the docs.
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "guides", "setup", "page.mdx"),
      `---
title: "Setup"
description: "Install the framework"
---

# Setup

Install the package.
`,
    );
    writeFileSync(join(rootDir, "skill.md"), "# Site skill\n\nUse the framework routes.\n");

    const events: DocsAnalyticsEvent[] = [];
    const onFeedback = vi.fn(async () => undefined);
    const { GET, POST } = createDocsAPI({
      rootDir,
      entry: "docs",
      analytics: {
        console: false,
        onEvent(event) {
          events.push(event);
        },
      },
      feedback: {
        agent: {
          enabled: true,
          onFeedback,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              task: { type: "string" },
              outcome: { type: "string" },
            },
            required: ["task", "outcome"],
          },
        },
      },
    });

    await GET(new Request("http://localhost/api/docs/agent/spec"));
    await GET(new Request("http://localhost/api/docs/agent/feedback/schema"));
    await GET(new Request("http://localhost/api/docs?format=agents"));
    await GET(new Request("http://localhost/api/docs?format=skill"));
    await GET(new Request("http://localhost/api/docs?format=markdown&path=guides/setup"));
    await GET(new Request("http://localhost/docs/guides/setup.md"));
    await GET(
      new Request("http://localhost/docs/guides/setup", {
        headers: { accept: "text/markdown" },
      }),
    );
    await GET(new Request("http://localhost/api/docs?format=llms"));
    await GET(new Request("http://localhost/api/docs?format=llms-full"));
    await GET(new Request("http://localhost/api/docs?query=install"));

    const invalidFeedback = await POST(
      new Request("http://localhost/api/docs/agent/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            task: "validate analytics",
          },
        }),
      }),
    );
    expect(invalidFeedback.status).toBe(400);

    const validFeedback = await POST(
      new Request("http://localhost/api/docs/agent/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          context: {
            page: "/docs/guides/setup",
          },
          payload: {
            task: "validate analytics",
            outcome: "implemented",
          },
        }),
      }),
    );
    expect(validFeedback.status).toBe(201);

    const disabledAi = await POST(
      new Request("http://localhost/api/docs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "How do I install?" }],
        }),
      }),
    );
    expect(disabledAi.status).toBe(404);

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "agent_spec_request",
        "agents_request",
        "agent_feedback_schema",
        "skill_request",
        "agent_read",
        "markdown_request",
        "llms_request",
        "api_search",
        "agent_feedback_error",
        "agent_feedback_submit",
        "api_ai_error",
      ]),
    );
    expect(
      events.filter((event) => event.type === "agent_read").map((event) => event.properties),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ delivery: "api_format", found: true }),
        expect.objectContaining({ delivery: "md_route", found: true }),
        expect.objectContaining({ delivery: "accept_header", found: true }),
      ]),
    );
    expect(events.find((event) => event.type === "api_search")).toMatchObject({
      source: "server",
      path: "/api/docs",
      properties: expect.objectContaining({
        queryLength: 7,
      }),
    });
    const agentFeedbackSubmitEvent = events.find((event) => event.type === "agent_feedback_submit");
    expect(agentFeedbackSubmitEvent).toMatchObject({
      properties: expect.objectContaining({
        feedbackKind: "agent",
        handled: true,
        hasContext: true,
        hasPayload: true,
        agentFeedbackContext: {
          page: "/docs/guides/setup",
        },
        contextPage: "/docs/guides/setup",
        payloadKeys: ["task", "outcome"],
        payloadFieldCount: 2,
      }),
    });
    expect(agentFeedbackSubmitEvent?.input).toBeUndefined();
    expect(agentFeedbackSubmitEvent?.properties).not.toHaveProperty("payload");
    expect(agentFeedbackSubmitEvent?.properties).not.toHaveProperty("agentFeedbackPayload");
    expect(events.find((event) => event.type === "api_ai_error")).toMatchObject({
      properties: expect.objectContaining({
        reason: "disabled",
      }),
    });
  });

  it("emits analytics and observability separately for successful Ask AI requests and responses", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-api-ai-analytics-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Installation"
---

# Installation

Install the framework with pnpm.
`,
    );

    const analyticsEvents: DocsAnalyticsEvent[] = [];
    const traceEvents: DocsObservabilityEvent[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("data: {}\n\n", {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      }),
    ) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        rootDir,
        entry: "docs",
        ai: {
          enabled: true,
          apiKey: "test-key",
          baseUrl: "https://llm.example/v1",
          model: "test-model",
        },
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

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Install" }],
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(analyticsEvents.map((event) => event.type)).toEqual([
        "api_ai_request",
        "api_ai_response",
      ]);
      expect(traceEvents.map((event) => event.type)).toEqual([
        "run.start",
        "user.input",
        "retrieval.query",
        "retrieval.result",
        "prompt.build",
        "model.call",
        "model.response",
        "model.stream",
        "agent.final",
        "run.end",
      ]);
      expect(analyticsEvents.find((event) => event.type === "api_ai_request")).toMatchObject({
        properties: expect.objectContaining({
          model: "test-model",
          questionLength: 7,
          retrievedCount: 1,
        }),
      });
      expect(traceEvents.find((event) => event.type === "model.call")).toMatchObject({
        traceId: expect.any(String),
        name: "test-model",
        status: "started",
        inputPreview: expect.objectContaining({
          messageCount: 2,
          stream: true,
          providerOrigin: "https://llm.example",
        }),
      });
      expect(traceEvents.find((event) => event.type === "run.end")).toMatchObject({
        traceId: expect.any(String),
        spanId: traceEvents.find((event) => event.type === "run.start")?.spanId,
        status: "success",
        durationMs: expect.any(Number),
        outputPreview: expect.objectContaining({
          stream: true,
          retrievedCount: 1,
        }),
      });
      expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
        "https://llm.example/v1/chat/completions",
      );
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("uses Docs Cloud provider config for Ask AI while keeping the chat SSE contract", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-api-ai-docs-cloud-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Installation"
---

# Installation

Install the framework with pnpm.
`,
    );

    const originalFetch = globalThis.fetch;
    const originalProjectId = process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID;
    const originalNextProjectId = process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    const originalServerProjectId = process.env.DOCS_CLOUD_PROJECT_ID;
    const originalApiKey = process.env.CUSTOM_DOCS_CLOUD_KEY;

    process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_cloud";
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.DOCS_CLOUD_PROJECT_ID;
    process.env.CUSTOM_DOCS_CLOUD_KEY = "cloud-key";
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ answer: "Use Docs Cloud for hosted Ask AI." }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    ) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        rootDir,
        entry: "docs",
        ai: {
          enabled: true,
          provider: "docs-cloud",
        },
        cloud: {
          apiKey: { env: "CUSTOM_DOCS_CLOUD_KEY" },
        },
        analytics: false,
      });

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "How do I install it?" }],
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/event-stream");
      expect(await response.text()).toContain("Use Docs Cloud for hosted Ask AI.");

      const [cloudUrl, cloudInit] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
      expect(cloudUrl).toBe("https://api.farming-labs.dev/v1/projects/project_cloud/knowledge/ask");
      expect(cloudInit?.headers).toMatchObject({
        Authorization: "Bearer cloud-key",
      });
      expect(JSON.parse(String(cloudInit?.body))).toMatchObject({
        question: "How do I install it?",
        answerMode: "auto",
        answerStyle: "public",
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalProjectId === undefined) delete process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID;
      else process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID = originalProjectId;
      if (originalNextProjectId === undefined) delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
      else process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = originalNextProjectId;
      if (originalServerProjectId === undefined) delete process.env.DOCS_CLOUD_PROJECT_ID;
      else process.env.DOCS_CLOUD_PROJECT_ID = originalServerProjectId;
      if (originalApiKey === undefined) delete process.env.CUSTOM_DOCS_CLOUD_KEY;
      else process.env.CUSTOM_DOCS_CLOUD_KEY = originalApiKey;
      vi.restoreAllMocks();
    }
  });

  it("reads Docs Cloud API key env from docs.config for Ask AI", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-api-ai-docs-cloud-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Configuration"
---

# Configuration

Configure the framework with docs.config.ts.
`,
    );
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
  ai: {
    enabled: true,
    provider: "docs-cloud",
  },
  cloud: {
    apiKey: { env: "CONFIG_DOCS_CLOUD_KEY" },
  },
});
`,
    );

    const originalFetch = globalThis.fetch;
    const originalProjectId = process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID;
    const originalNextProjectId = process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    const originalServerProjectId = process.env.DOCS_CLOUD_PROJECT_ID;
    const originalDefaultApiKey = process.env.DOCS_CLOUD_API_KEY;
    const originalApiKey = process.env.CONFIG_DOCS_CLOUD_KEY;
    const originalApiUrl = process.env.DOCS_CLOUD_API_URL;
    const originalPublicApiUrl = process.env.PUBLIC_DOCS_CLOUD_URL;
    const originalNextPublicApiUrl = process.env.NEXT_PUBLIC_DOCS_CLOUD_URL;

    process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_config";
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.DOCS_CLOUD_PROJECT_ID;
    delete process.env.DOCS_CLOUD_API_KEY;
    delete process.env.DOCS_CLOUD_API_URL;
    delete process.env.PUBLIC_DOCS_CLOUD_URL;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_URL;
    process.env.CONFIG_DOCS_CLOUD_KEY = "config-cloud-key";
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ answer: "The config key reached Docs Cloud." }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    ) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        rootDir,
        analytics: false,
      });

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "How do I configure it?" }],
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("The config key reached Docs Cloud.");

      const [cloudUrl, cloudInit] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
      expect(cloudUrl).toBe(
        "https://api.farming-labs.dev/v1/projects/project_config/knowledge/ask",
      );
      expect(cloudInit?.headers).toMatchObject({
        Authorization: "Bearer config-cloud-key",
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalProjectId === undefined) delete process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID;
      else process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID = originalProjectId;
      if (originalNextProjectId === undefined) delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
      else process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = originalNextProjectId;
      if (originalServerProjectId === undefined) delete process.env.DOCS_CLOUD_PROJECT_ID;
      else process.env.DOCS_CLOUD_PROJECT_ID = originalServerProjectId;
      if (originalDefaultApiKey === undefined) delete process.env.DOCS_CLOUD_API_KEY;
      else process.env.DOCS_CLOUD_API_KEY = originalDefaultApiKey;
      if (originalApiKey === undefined) delete process.env.CONFIG_DOCS_CLOUD_KEY;
      else process.env.CONFIG_DOCS_CLOUD_KEY = originalApiKey;
      if (originalApiUrl === undefined) delete process.env.DOCS_CLOUD_API_URL;
      else process.env.DOCS_CLOUD_API_URL = originalApiUrl;
      if (originalPublicApiUrl === undefined) delete process.env.PUBLIC_DOCS_CLOUD_URL;
      else process.env.PUBLIC_DOCS_CLOUD_URL = originalPublicApiUrl;
      if (originalNextPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_DOCS_CLOUD_URL;
      else process.env.NEXT_PUBLIC_DOCS_CLOUD_URL = originalNextPublicApiUrl;
      vi.restoreAllMocks();
    }
  });

  it("infers package guidance from Ask AI context so examples avoid placeholder imports", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-api-ai-package-prompt-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Installation"
---

# Installation

Install Better Auth with pnpm.

\`\`\`ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
});
\`\`\`
`,
    );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("data: {}\n\n", {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      }),
    ) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        rootDir,
        entry: "docs",
        ai: {
          enabled: true,
          apiKey: "test-key",
          baseUrl: "https://llm.example/v1",
          model: "test-model",
          docsUrl: "https://docs.example.com",
        },
      });

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "How do I create the auth instance?" }],
          }),
        }),
      );

      expect(response.status).toBe(200);

      const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
      const upstreamBody = JSON.parse(String(init?.body)) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      const systemMessage = upstreamBody.messages?.find((message) => message.role === "system");
      expect(systemMessage?.content).toContain(
        'Never use placeholder package names or imports such as "your-auth-library"',
      );
      expect(systemMessage?.content).toContain(
        "Package and import hints inferred from the retrieved documentation context",
      );
      expect(systemMessage?.content).toContain(
        "Package names found in install/import examples: better-auth",
      );
      expect(systemMessage?.content).toContain('import { betterAuth } from "better-auth";');
      expect(systemMessage?.content).toContain("https://docs.example.com");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("keeps upstream Ask AI fetch error details out of API responses", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-api-ai-fetch-error-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Installation"
---

# Installation

Install the framework with pnpm.
`,
    );

    const traceEvents: DocsObservabilityEvent[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("secret upstream detail")) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        rootDir,
        entry: "docs",
        ai: {
          enabled: true,
          apiKey: "test-key",
          baseUrl: "https://llm.example/v1",
          model: "test-model",
        },
        observability: {
          console: false,
          onEvent(event) {
            traceEvents.push(event);
          },
        },
      });

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Install" }],
          }),
        }),
      );

      const body = await response.text();
      expect(response.status).toBe(502);
      expect(JSON.parse(body)).toEqual({ error: "LLM API request failed." });
      expect(body).not.toContain("secret upstream detail");

      const runSpanId = traceEvents.find((event) => event.type === "run.start")?.spanId;
      expect(runSpanId).toEqual(expect.any(String));
      expect(traceEvents.find((event) => event.type === "model.error")).toMatchObject({
        outputPreview: {
          message: "secret upstream detail",
        },
      });
      expect(traceEvents.find((event) => event.type === "run.error")).toMatchObject({
        spanId: runSpanId,
        status: "error",
      });
      expect(traceEvents.find((event) => event.type === "run.end")).toMatchObject({
        spanId: runSpanId,
        status: "error",
      });
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("returns actionable markdown recovery when the requested page does not exist", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-markdown-missing-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    mkdirSync(join(rootDir, "app", "docs", "guides", "quickstart"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Home"
---

# Home
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "guides", "quickstart", "page.mdx"),
      `---
title: "Quickstart"
description: "Start building quickly"
---

# Quickstart
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/api/docs?format=markdown&path=quick"));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    const notFoundDocument = await response.text();
    expect(notFoundDocument).toMatch(/^---\ntitle: "Docs Page Not Found"/);
    expect(notFoundDocument).toContain('canonical_url: "http://localhost/docs/quick"');
    expect(notFoundDocument).toContain('markdown_url: "http://localhost/docs/quick.md"');
    expect(notFoundDocument).toContain("# Docs Page Not Found");
    expect(notFoundDocument).toContain("`/docs/quick.md`");
    expect(notFoundDocument).toContain("## Closest Matches");
    expect(notFoundDocument).toContain("[Quickstart](/docs/guides/quickstart.md)");
    expect(notFoundDocument).toContain("`/.well-known/agent.json`");
    expect(notFoundDocument).toContain("`/api/docs?query={query}`");
    expect(notFoundDocument).toContain("`/sitemap.md`");
    expect(notFoundDocument).toContain("## Sitemap");

    const redirectResponse = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=guides/quikstart"),
    );
    expect(redirectResponse.status).toBe(307);
    expect(redirectResponse.headers.get("location")).toBe(
      "http://localhost/docs/guides/quickstart.md",
    );
  });

  it("serves the agent discovery spec through the shared docs api handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-spec-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  llmsTxt: {
    enabled: true,
    siteTitle: "Agent Docs",
    siteDescription: "Machine-readable documentation",
    baseUrl: "https://docs.example.com",
  },
  i18n: {
    locales: ["en", "fr"],
    defaultLocale: "fr",
  },
  robots: {
    enabled: true,
  },
};`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      feedback: {
        agent: {
          enabled: true,
          route: "/internal/agent-feedback",
          schemaRoute: "/internal/agent-feedback/schema",
        },
      },
      mcp: {
        enabled: true,
        route: "/internal/docs/mcp",
        tools: {
          listPages: true,
          readPage: true,
          listTasks: false,
          readTask: true,
          searchDocs: false,
          getNavigation: true,
        },
      },
      apiReference: {
        enabled: true,
        path: "api-reference",
      },
    });

    const response = await GET(new Request("http://localhost/api/docs/agent/spec"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("link")).toContain("</.well-known/api-catalog>");
    expect(response.headers.get("link")).toContain("</.well-known/agent-skills/index.json>");

    const spec = (await response.json()) as {
      version: string;
      site: { title: string; description?: string; entry: string; baseUrl: string };
      locales: {
        enabled: boolean;
        available: string[];
        default: string | null;
        queryParam: string;
        fallbackQueryParam: string;
      };
      capabilities: Record<string, boolean>;
      api: Record<string, string>;
      apiCatalog: Record<string, string | boolean>;
      config: { format: string; endpoint: string };
      agentContract: Record<string, unknown>;
      openapi: Record<string, unknown>;
      markdown: Record<string, unknown>;
      llms: Record<string, string | boolean>;
      agents: Record<string, unknown>;
      search: {
        enabled: boolean;
        endpoint: string;
        method: string;
        queryParam: string;
        localeParam: string;
      };
      robots: { enabled: boolean; route: string; defaultRoute: string };
      structuredData: Record<string, unknown>;
      skills: {
        enabled: boolean;
        file: string;
        route: string;
        wellKnown: string;
        api: string;
        generatedFallback: boolean;
        discovery: Record<string, string>;
        registry: string;
        install: string;
        recommended: Array<{ name: string; description: string }>;
      };
      mcp: {
        enabled: boolean;
        endpoint: string;
        defaultEndpoint: string;
        publicEndpoint: string;
        wellKnownEndpoint: string;
        publicEndpoints: string[];
        canonicalEndpoint: string;
        name: string;
        version: string;
        tools: Record<string, boolean>;
      };
      feedback: { enabled: boolean; schema: string; submit: string };
      instructions: Record<string, boolean>;
    };

    expect(spec.version).toBe("1");
    expect(spec.site).toEqual({
      title: "Agent Docs",
      description: "Machine-readable documentation",
      entry: "docs",
      baseUrl: "https://docs.example.com",
    });
    expect(spec.locales).toEqual({
      enabled: true,
      available: ["en", "fr"],
      default: "fr",
      queryParam: "lang",
      fallbackQueryParam: "locale",
    });
    expect(spec.capabilities).toEqual({
      markdownRoutes: true,
      agentMdOverrides: true,
      agentBlocks: true,
      structuredAgentContracts: true,
      agents: true,
      llms: true,
      skills: true,
      apiCatalog: true,
      agentSkillsDiscovery: true,
      mcp: true,
      search: true,
      sitemap: true,
      robots: true,
      structuredData: true,
      apiReference: true,
      openapi: true,
      agentFeedback: true,
      locales: true,
    });
    expect(spec.api).toMatchObject({
      docs: "/api/docs",
      agentSpec: "/api/docs/agent/spec",
      agentSpecDefault: "/.well-known/agent.json",
      agentSpecFallback: "/.well-known/agent",
      agentSpecWellKnown: "/.well-known/agent",
      agentSpecWellKnownJson: "/.well-known/agent.json",
      agentSpecQuery: "/api/docs?agent=spec",
      config: "/api/docs?format=config",
      diagnostics: "/api/docs?format=diagnostics",
      agents: "/api/docs?format=agents",
      apiCatalog: "/.well-known/api-catalog",
      apiCatalogQuery: "/api/docs?format=api-catalog",
      agentSkillsIndex: "/.well-known/agent-skills/index.json",
      openapi: "/api/docs?format=openapi",
    });
    expect(spec.apiCatalog).toEqual({
      enabled: true,
      route: "/.well-known/api-catalog",
      api: "/api/docs?format=api-catalog",
      mediaType: "application/linkset+json",
      profile: "https://www.rfc-editor.org/info/rfc9727",
    });
    expect(spec.config).toMatchObject({
      format: "docs-config-map.v1",
      endpoint: "/api/docs?format=config",
    });
    expect(spec.agentContract).toMatchObject({
      enabled: true,
      schemaVersion: "page-agent-contract.v1",
      mcpTools: { read: "read_task" },
    });
    expect(spec.agentContract).not.toHaveProperty("mcpTools.list");
    expect(spec.openapi).toEqual({
      enabled: true,
      url: "/api/docs?format=openapi",
      source: "generated",
      specUrl: null,
      apiReferencePath: "/api-reference",
      format: "OpenAPI 3.1",
    });
    expect(spec.markdown).toMatchObject({
      enabled: true,
      acceptHeader: "text/markdown",
      pagePattern: "/docs/{slug}.md",
      rootPage: "/docs.md",
      apiPattern: "/api/docs?format=markdown&path={slug}",
      resolutionOrder: ["agent.md", "agent audience projection", "shared page markdown"],
    });
    expect(spec.llms).toEqual({
      enabled: true,
      defaultTxt: "/llms.txt",
      defaultFull: "/llms-full.txt",
      txt: "/api/docs?format=llms",
      full: "/api/docs?format=llms-full",
      publicTxt: "/llms.txt",
      publicFull: "/llms-full.txt",
      wellKnownTxt: "/.well-known/llms.txt",
      wellKnownFull: "/.well-known/llms-full.txt",
    });
    expect(spec.agents).toEqual({
      enabled: true,
      file: "AGENTS.md",
      route: "/AGENTS.md",
      wellKnown: "/.well-known/AGENTS.md",
      api: "/api/docs?format=agents",
      generatedFallback: true,
      aliases: ["/AGENT.md", "/.well-known/AGENT.md"],
    });
    expect(spec.search).toEqual({
      enabled: true,
      endpoint: "/api/docs?query={query}",
      method: "GET",
      queryParam: "query",
      localeParam: "lang",
    });
    expect(spec.robots).toEqual({
      enabled: true,
      route: "/robots.txt",
      defaultRoute: "/robots.txt",
    });
    expect(spec.structuredData).toEqual({
      enabled: true,
      format: "application/ld+json",
      schema: "https://schema.org/TechArticle",
      fields: ["headline", "description", "url", "dateModified", "breadcrumb", "mainEntity"],
      canonicalUrlField: "url",
      breadcrumbType: "BreadcrumbList",
      agentContractType: "HowTo",
    });
    expect(spec.skills).toEqual({
      enabled: true,
      file: "skill.md",
      route: "/skill.md",
      wellKnown: "/.well-known/skill.md",
      api: "/api/docs?format=skill",
      generatedFallback: true,
      discovery: {
        schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
        index: "/.well-known/agent-skills/index.json",
        artifact: "/.well-known/agent-skills/{name}/SKILL.md",
        apiIndex: "/api/docs?format=agent-skills",
        apiArtifact: "/api/docs?format=agent-skill&name={name}",
        digest: "sha256",
      },
      registry: "skills.sh",
      install: "npx skills add farming-labs/docs",
      recommended: [
        {
          name: "getting-started",
          description:
            "Use for installation, init, framework setup, theme CSS, and first docs.config wiring.",
        },
      ],
    });
    expect(spec.mcp).toEqual({
      enabled: true,
      endpoint: "/internal/docs/mcp",
      defaultEndpoint: "/mcp",
      publicEndpoint: "/mcp",
      wellKnownEndpoint: "/.well-known/mcp",
      publicEndpoints: ["/mcp", "/.well-known/mcp"],
      canonicalEndpoint: "/api/docs/mcp",
      name: "Agent Docs",
      version: "0.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        readPage: true,
        listTasks: false,
        readTask: true,
        searchDocs: false,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
    });
    expect(spec.feedback).toMatchObject({
      enabled: true,
      schema: "/internal/agent-feedback/schema",
      submit: "/internal/agent-feedback",
    });
    expect(spec.instructions).toMatchObject({
      preferMarkdownRoutes: true,
      useMcpWhenAvailable: true,
      readFeedbackSchemaBeforeSubmitting: true,
      doNotAssumeFeedbackPayloadShape: true,
    });

    for (const path of ["/.well-known/agent", "/.well-known/agent.json"]) {
      const wellKnownResponse = await GET(new Request(`http://localhost${path}`));
      expect(wellKnownResponse.status).toBe(200);
      expect(wellKnownResponse.headers.get("content-type")).toContain("application/json");
      expect(wellKnownResponse.headers.get("link")).toContain('rel="api-catalog"');
      expect(await wellKnownResponse.json()).toEqual(spec);
    }
  });

  it("serves a docs config map through the shared GET handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-config-map-"));
    tempDirs.push(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      search: {
        provider: "algolia",
        appId: "APP_ID",
        indexName: "docs",
        searchApiKey: "search-secret",
      },
      feedback: {
        onFeedback() {},
      },
      mcp: {
        enabled: true,
        tools: {
          readPage: true,
        },
      },
    });

    const response = await GET(new Request("http://localhost/api/docs?format=config"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const config = (await response.json()) as {
      format: string;
      values: Record<string, any>;
      pointers: Record<string, { path: string; kind: string }>;
    };

    expect(config.format).toBe("docs-config-map.v1");
    expect(config.values.entry).toBe("docs");
    expect(config.values.search).toMatchObject({
      provider: "algolia",
      appId: "APP_ID",
      indexName: "docs",
      searchApiKey: {
        $kind: "secret",
        value: "[redacted]",
      },
    });
    expect(config.values.feedback).toMatchObject({
      onFeedback: {
        $kind: "function",
        name: "onFeedback",
      },
    });
    expect(config.pointers["/mcp/tools/readPage"]).toEqual({
      path: "mcp.tools.readPage",
      kind: "boolean",
    });
  });

  it("serves docs diagnostics through the shared GET handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-diagnostics-"));
    tempDirs.push(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      search: {
        provider: "algolia",
        appId: "APP_ID",
        indexName: "docs",
        searchApiKey: "search-secret",
      },
      ai: {
        enabled: true,
        model: "gpt-4o-mini",
      },
      mcp: {
        enabled: true,
        tools: {
          readPage: true,
          searchDocs: false,
        },
      },
      feedback: {
        agent: false,
      },
    });

    const response = await GET(new Request("http://localhost/api/docs?format=diagnostics"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");

    const diagnostics = (await response.json()) as {
      format: string;
      ok: boolean;
      adapter: string | null;
      routes: Record<string, string | null>;
      features: Record<string, any>;
      warnings: Array<{ code: string }>;
      errors: Array<{ code: string }>;
    };

    expect(diagnostics).toMatchObject({
      format: "docs-diagnostics.v1",
      ok: true,
      adapter: "next",
      routes: {
        docs: "/docs",
        api: "/api/docs",
        config: "/api/docs?format=config",
        diagnostics: "/api/docs?format=diagnostics",
        search: "/api/docs?query={query}",
        askAi: "/api/docs",
      },
      features: {
        search: {
          status: "enabled",
          provider: "algolia",
          transport: "GET",
        },
        ai: {
          status: "enabled",
          transport: "POST",
        },
        mcp: {
          status: "enabled",
          tools: {
            readPage: true,
            searchDocs: false,
          },
        },
        feedback: {
          status: "enabled",
          human: true,
          agent: false,
        },
      },
    });
    expect(diagnostics.warnings).toEqual([]);
    expect(diagnostics.errors).toEqual([]);
    expect(JSON.stringify(diagnostics)).not.toContain("search-secret");
  });

  it("reports a top-level apiCatalog opt-out in docs diagnostics", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-diagnostics-api-catalog-"));
    tempDirs.push(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      apiCatalog: false,
      llmsTxt: { apiCatalog: true },
    });

    const response = await GET(new Request("http://localhost/api/docs?format=diagnostics"));
    expect(response.status).toBe(200);

    const diagnostics = (await response.json()) as {
      routes: Record<string, string | null>;
      features: Record<string, { status: string; route?: string | null }>;
    };
    expect(diagnostics.routes.apiCatalog).toBeNull();
    expect(diagnostics.features.apiCatalog).toMatchObject({
      status: "disabled",
      route: null,
    });
  });

  it("uses the resolved public docsPath in docs diagnostics", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-diagnostics-docspath-"));
    tempDirs.push(rootDir);

    writeFileSync(
      join(rootDir, "docs.config.ts"),
      'export default { entry: "docs", docsPath: "guides" };\n',
    );

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/api/docs?format=diagnostics"));
    expect(response.status).toBe(200);

    const diagnostics = (await response.json()) as {
      routes: Record<string, string | null>;
    };

    expect(diagnostics.routes.docs).toBe("/guides");
  });

  it("serves the agent discovery spec through the rewritten query form", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-spec-query-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "guides"), { recursive: true });
    writeFileSync(join(rootDir, "app", "guides", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "guides",
      feedback: {
        agent: false,
      },
      search: false,
      mcp: false,
    });

    const response = await GET(new Request("http://localhost/api/docs?agent=spec"));
    expect(response.status).toBe(200);
    const spec = (await response.json()) as {
      site: { title: string; entry: string; baseUrl: string };
      locales: {
        enabled: boolean;
        available: string[];
        default: string | null;
        queryParam: string;
        fallbackQueryParam: string;
      };
      capabilities: Record<string, boolean>;
      agentContract: Record<string, unknown>;
      markdown: { acceptHeader: string; pagePattern: string; rootPage: string };
      llms: Record<string, string | boolean>;
      agents: Record<string, unknown>;
      openapi: Record<string, unknown>;
      search: { enabled: boolean; endpoint: string; method: string };
      robots: { enabled: boolean; route: string; defaultRoute: string };
      structuredData: Record<string, unknown>;
      skills: {
        enabled: boolean;
        file: string;
        route: string;
        wellKnown: string;
        api: string;
        generatedFallback: boolean;
        discovery: Record<string, string>;
        registry: string;
        install: string;
      };
      mcp: {
        enabled: boolean;
        endpoint: string;
        defaultEndpoint: string;
        publicEndpoint: string;
        wellKnownEndpoint: string;
        publicEndpoints: string[];
        canonicalEndpoint: string;
      };
      feedback: { enabled: boolean; schema: string; submit: string };
    };

    expect(spec.site).toEqual({
      title: "Documentation",
      entry: "guides",
      baseUrl: "http://localhost",
    });
    expect(spec.locales).toEqual({
      enabled: false,
      available: [],
      default: null,
      queryParam: "lang",
      fallbackQueryParam: "locale",
    });
    expect(spec.capabilities).toEqual({
      markdownRoutes: true,
      agentMdOverrides: true,
      agentBlocks: true,
      structuredAgentContracts: true,
      agents: true,
      llms: true,
      skills: true,
      apiCatalog: true,
      agentSkillsDiscovery: true,
      mcp: false,
      search: false,
      sitemap: true,
      robots: true,
      structuredData: true,
      apiReference: false,
      openapi: false,
      agentFeedback: false,
      locales: false,
    });
    expect(spec.agentContract).not.toHaveProperty("mcpTools");
    expect(spec.openapi).toMatchObject({
      enabled: false,
      url: null,
      apiReferencePath: null,
    });
    expect(spec.markdown).toMatchObject({
      acceptHeader: "text/markdown",
      pagePattern: "/guides/{slug}.md",
      rootPage: "/guides.md",
    });
    expect(spec.llms).toEqual({
      enabled: true,
      defaultTxt: "/llms.txt",
      defaultFull: "/llms-full.txt",
      txt: "/api/docs?format=llms",
      full: "/api/docs?format=llms-full",
      publicTxt: "/llms.txt",
      publicFull: "/llms-full.txt",
      wellKnownTxt: "/.well-known/llms.txt",
      wellKnownFull: "/.well-known/llms-full.txt",
    });
    expect(spec.agents).toMatchObject({
      enabled: true,
      file: "AGENTS.md",
      route: "/AGENTS.md",
      wellKnown: "/.well-known/AGENTS.md",
      api: "/api/docs?format=agents",
      generatedFallback: true,
    });
    expect(spec.search).toMatchObject({
      enabled: false,
      endpoint: "/api/docs?query={query}",
      method: "GET",
    });
    expect(spec.robots).toEqual({
      enabled: true,
      route: "/robots.txt",
      defaultRoute: "/robots.txt",
    });
    expect(spec.structuredData).toMatchObject({
      enabled: true,
      format: "application/ld+json",
      schema: "https://schema.org/TechArticle",
    });
    expect(spec.skills).toMatchObject({
      enabled: true,
      file: "skill.md",
      route: "/skill.md",
      wellKnown: "/.well-known/skill.md",
      api: "/api/docs?format=skill",
      generatedFallback: true,
      discovery: {
        schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
        index: "/.well-known/agent-skills/index.json",
        artifact: "/.well-known/agent-skills/{name}/SKILL.md",
        apiIndex: "/api/docs?format=agent-skills",
        apiArtifact: "/api/docs?format=agent-skill&name={name}",
        digest: "sha256",
      },
      registry: "skills.sh",
      install: "npx skills add farming-labs/docs",
    });
    expect(spec.mcp).toMatchObject({
      enabled: false,
      endpoint: "/api/docs/mcp",
      defaultEndpoint: "/mcp",
      publicEndpoint: "/mcp",
      wellKnownEndpoint: "/.well-known/mcp",
      publicEndpoints: ["/mcp", "/.well-known/mcp"],
      canonicalEndpoint: "/api/docs/mcp",
    });
    expect(spec.feedback).toMatchObject({
      enabled: false,
      schema: "/api/docs/agent/feedback/schema",
      submit: "/api/docs/agent/feedback",
    });
  });

  it("advertises the API route that serves a query-form agent manifest", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-custom-agent-spec-route-"));
    tempDirs.push(rootDir);

    const parseManifest = async (response: Response) => {
      expect(response.status).toBe(200);
      return (await response.json()) as {
        api: Record<string, string>;
        apiCatalog: { api: string | null };
        config: { endpoint: string };
        markdown: { apiPattern: string };
        llms: { txt: string; full: string };
        openapi: { enabled: boolean; url: string | null };
        skills: {
          api: string;
          discovery: { apiIndex: string; apiArtifact: string };
        };
      };
    };

    const inferred = createDocsAPI({ rootDir, entry: "docs", apiReference: true });
    const inferredManifest = await parseManifest(
      await inferred.GET(new Request("http://localhost/api/internal/docs?agent=spec")),
    );

    expect(inferredManifest.api).toMatchObject({
      docs: "/api/internal/docs",
      config: "/api/internal/docs?format=config",
      diagnostics: "/api/internal/docs?format=diagnostics",
      agentSpec: "/api/internal/docs?agent=spec",
      agentSpecQuery: "/api/internal/docs?agent=spec",
      apiCatalogQuery: "/api/internal/docs?format=api-catalog",
    });
    expect(inferredManifest.apiCatalog.api).toBe("/api/internal/docs?format=api-catalog");
    expect(inferredManifest.config.endpoint).toBe("/api/internal/docs?format=config");
    expect(inferredManifest.markdown.apiPattern).toBe(
      "/api/internal/docs?format=markdown&path={slug}",
    );
    expect(inferredManifest.llms).toMatchObject({
      txt: "/api/internal/docs?format=llms",
      full: "/api/internal/docs?format=llms-full",
    });
    expect(inferredManifest.skills).toMatchObject({
      api: "/api/internal/docs?format=skill",
      discovery: {
        apiIndex: "/api/internal/docs?format=agent-skills",
        apiArtifact: "/api/internal/docs?format=agent-skill&name={name}",
      },
    });

    const inferredDiagnostics = await inferred.GET(
      new Request("http://localhost/api/internal/docs?format=diagnostics"),
    );
    expect(await inferredDiagnostics.json()).toMatchObject({
      routes: {
        api: "/api/internal/docs",
        config: "/api/internal/docs?format=config",
      },
    });

    const inferredSkill = await inferred.GET(
      new Request("http://localhost/api/internal/docs?format=skill"),
    );
    const inferredSkillText = await inferredSkill.text();
    expect(inferredSkillText).toContain("/api/internal/docs?agent=spec");
    expect(inferredSkillText).toContain("/api/internal/docs?query={query}");
    expect(inferredSkillText).toContain("/api/internal/docs?format=agents");

    const inferredSkillArtifact = await inferred.GET(
      new Request("http://localhost/api/internal/docs?format=agent-skill&name=docs"),
    );
    expect(await inferredSkillArtifact.text()).toContain("/api/internal/docs?format=skill");

    const inferredLlms = await inferred.GET(
      new Request("http://localhost/api/internal/docs?format=llms"),
    );
    const inferredLlmsText = await inferredLlms.text();
    expect(inferredLlmsText).toContain("/api/internal/docs?format=openapi");
    expect(inferredLlmsText).not.toContain("/api/docs?format=openapi");

    const inferredPublicLlms = await inferred.GET(new Request("http://localhost/llms.txt"));
    const inferredPublicLlmsText = await inferredPublicLlms.text();
    expect(inferredPublicLlmsText).toContain("/api/docs?format=openapi");
    expect(inferredPublicLlmsText).not.toContain("/api/internal/docs?format=openapi");

    const inferredLlmsAfterPublic = await inferred.GET(
      new Request("http://localhost/api/internal/docs?format=llms"),
    );
    const inferredLlmsAfterPublicText = await inferredLlmsAfterPublic.text();
    expect(inferredLlmsAfterPublicText).toContain("/api/internal/docs?format=openapi");
    expect(inferredLlmsAfterPublicText).not.toContain("/api/docs?format=openapi");

    const configured = createDocsAPI({
      rootDir,
      entry: "docs",
      apiRoute: "api/internal/docs/",
      apiReference: {
        enabled: true,
        path: "api-reference",
      },
    });
    const wellKnownManifest = await parseManifest(
      await configured.GET(new Request("http://localhost/.well-known/agent.json")),
    );
    expect(wellKnownManifest.api.docs).toBe("/api/internal/docs");
    expect(wellKnownManifest.api.agentSpecQuery).toBe("/api/internal/docs?agent=spec");
    expect(wellKnownManifest.skills.discovery.apiIndex).toBe(
      "/api/internal/docs?format=agent-skills",
    );
    expect(wellKnownManifest.openapi).toMatchObject({
      enabled: true,
      url: "/api/internal/docs?format=openapi",
    });

    const configuredSkillWithLocale = await configured.GET(
      new Request("http://localhost/skill.md?lang=en"),
    );
    const configuredSkillWithLocaleText = await configuredSkillWithLocale.text();
    expect(configuredSkillWithLocaleText).toContain("/api/internal/docs?format=skill");
    expect(configuredSkillWithLocaleText).toContain("/api/internal/docs?format=openapi");
    expect(configuredSkillWithLocaleText).not.toContain("/api/docs?format=openapi");
    expect(configuredSkillWithLocaleText).not.toContain("/skill.md?format=skill");

    const configuredAgents = await configured.GET(
      new Request("http://localhost/.well-known/AGENTS.md"),
    );
    const configuredAgentsText = await configuredAgents.text();
    expect(configuredAgentsText).toContain("/api/internal/docs?agent=spec");
    expect(configuredAgentsText).toContain("/api/internal/docs?query={query}");
    expect(configuredAgentsText).toContain("/api/internal/docs?format=skill");
    expect(configuredAgentsText).toContain("/api/internal/docs?format=openapi");
    expect(configuredAgentsText).not.toContain("/api/docs?format=openapi");

    const configuredLlms = await configured.GET(new Request("http://localhost/llms.txt"));
    const configuredLlmsText = await configuredLlms.text();
    expect(configuredLlmsText).toContain("/api/internal/docs?format=openapi");
    expect(configuredLlmsText).not.toContain("/api/docs?format=openapi");

    const configuredOpenapi = await configured.GET(
      new Request("http://localhost/api/internal/docs?format=openapi"),
    );
    expect(configuredOpenapi.status).toBe(200);

    const configuredDiagnostics = await configured.GET(
      new Request("http://localhost/api/internal/docs?format=diagnostics"),
    );
    expect(await configuredDiagnostics.json()).toMatchObject({
      routes: {
        api: "/api/internal/docs",
        config: "/api/internal/docs?format=config",
      },
    });

    for (const publicPath of [
      "/docs/api/llms.txt",
      "/docs-map/sitemap.md",
      "/docs/installation.md",
    ]) {
      const publicDiagnostics = await configured.GET(
        new Request(`http://localhost${publicPath}?format=diagnostics`),
      );
      expect(await publicDiagnostics.json()).toMatchObject({
        routes: {
          api: "/api/internal/docs",
          config: "/api/internal/docs?format=config",
        },
      });
    }

    const configuredMap = await configured.GET(
      new Request("http://localhost/api/internal/docs?format=config"),
    );
    expect(await configuredMap.json()).toMatchObject({
      values: {
        cloud: { apiRoute: "/api/internal/docs" },
      },
    });

    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  cloud: {
    apiKey: { env: "DOCS_CLOUD_API_KEY" },
    apiRoute: " api//from-config/ ",
  },
};`,
    );
    const fromConfig = createDocsAPI({ rootDir, entry: "docs" });
    const configManifest = await parseManifest(
      await fromConfig.GET(new Request("http://localhost/.well-known/agent.json")),
    );
    expect(configManifest.api.docs).toBe("/api/from-config");
    expect(configManifest.api.config).toBe("/api/from-config?format=config");

    const configCatalog = await fromConfig.GET(
      new Request("http://localhost/.well-known/api-catalog"),
    );
    const configCatalogBody = (await configCatalog.json()) as {
      linkset: Array<{ item?: Array<{ href: string }> }>;
    };
    expect(configCatalogBody.linkset[0]?.item?.map(({ href }) => href)).toContain(
      "http://localhost/api/from-config",
    );
  });

  it("serves the default agent feedback schema through the shared docs api handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-feedback-schema-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/api/docs/agent/feedback/schema"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/schema+json");

    const schema = (await response.json()) as {
      properties?: {
        context?: { properties?: Record<string, unknown> };
        payload?: { properties?: Record<string, unknown>; required?: string[] };
      };
      required?: string[];
    };

    expect(schema.required).toEqual(["payload"]);
    expect(schema.properties?.context?.properties).toMatchObject({
      page: { type: "string" },
      url: { type: "string" },
      slug: { type: "string" },
      locale: { type: "string" },
      source: { type: "string" },
    });
    expect(schema.properties?.payload?.properties).toMatchObject({
      task: expect.objectContaining({ type: "string" }),
      outcome: expect.objectContaining({ type: "string" }),
      missingContext: expect.objectContaining({ type: "array" }),
    });
    expect(schema.properties?.payload?.required).toEqual(["task", "outcome"]);
  });

  it("accepts agent feedback posts and awaits the async callback", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-feedback-post-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const deferred = createDeferredPromise<void>();
    const onFeedback = vi.fn(() => deferred.promise);
    const { POST } = createDocsAPI({
      rootDir,
      entry: "docs",
      feedback: {
        agent: {
          enabled: true,
          onFeedback,
        },
      },
    });

    const responsePromise = POST(
      new Request("http://localhost/api/docs/agent/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          context: {
            page: "/docs/installation",
            url: "https://docs.example.com/docs/installation.md",
            slug: "installation",
            locale: "en",
            source: "md-route",
            ignored: "value",
          },
          payload: {
            task: "install docs in an existing Next.js app",
            outcome: "implemented",
            confidence: 0.78,
          },
        }),
      }),
    );

    expect(onFeedback).toHaveBeenCalledTimes(0);
    await vi.waitFor(() => {
      expect(onFeedback).toHaveBeenCalledTimes(1);
    });

    let settled = false;
    responsePromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    deferred.resolve();
    const response = await responsePromise;

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, handled: true });
    expect(onFeedback).toHaveBeenCalledWith({
      context: {
        page: "/docs/installation",
        url: "https://docs.example.com/docs/installation.md",
        slug: "installation",
        locale: "en",
        source: "md-route",
      },
      payload: {
        task: "install docs in an existing Next.js app",
        outcome: "implemented",
        confidence: 0.78,
      },
    });
  });

  it("returns a non-handled response when agent feedback has no callback", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-feedback-noop-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const { POST } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await POST(
      new Request("http://localhost/api/docs?feedback=agent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            task: "check docs",
            outcome: "partial",
          },
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, handled: false });
  });

  it("rejects malformed agent feedback payloads", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-feedback-invalid-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const { POST } = createDocsAPI({
      rootDir,
      entry: "docs",
      feedback: {
        agent: {
          enabled: true,
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/agent/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          context: {
            page: "/docs/installation",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Agent feedback body must include a payload object",
    });
  });

  it("rejects agent feedback payloads that do not satisfy the configured schema", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-feedback-schema-invalid-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const { POST } = createDocsAPI({
      rootDir,
      entry: "docs",
      feedback: {
        agent: {
          enabled: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              task: { type: "string" },
              outcome: { type: "string" },
            },
            required: ["task", "outcome"],
          },
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/agent/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            task: "demo",
            extra: true,
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "payload.outcome is required",
    });
  });

  it("accepts agent feedback schema and submission through the rewritten query form", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-feedback-query-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const onFeedback = vi.fn(async () => undefined);
    const { GET, POST } = createDocsAPI({
      rootDir,
      entry: "docs",
      feedback: {
        agent: {
          enabled: true,
          onFeedback,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              task: { type: "string" },
              outcome: { type: "string" },
              customTag: { type: "string" },
            },
            required: ["task", "outcome"],
          },
        },
      },
    });

    const schemaResponse = await GET(
      new Request("http://localhost/api/docs?feedback=agent&schema=1"),
    );
    expect(schemaResponse.status).toBe(200);
    const schema = (await schemaResponse.json()) as {
      properties?: { payload?: { properties?: Record<string, unknown> } };
    };
    expect(schema.properties?.payload?.properties).toMatchObject({
      customTag: { type: "string" },
    });

    const submitResponse = await POST(
      new Request("http://localhost/api/docs?feedback=agent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          context: {
            source: "api",
          },
          payload: {
            task: "validate rewrite path",
            outcome: "implemented",
            customTag: "query-mode",
          },
        }),
      }),
    );

    expect(submitResponse.status).toBe(201);
    expect(onFeedback).toHaveBeenCalledWith({
      context: {
        source: "api",
      },
      payload: {
        task: "validate rewrite path",
        outcome: "implemented",
        customTag: "query-mode",
      },
    });
  });

  it("indexes changelog entries under the docs changelog route instead of the raw source route", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-changelog-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "changelog", "2026-04-15"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
description: "Start here"
---

# Introduction

Welcome to the docs.
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "changelog", "2026-04-15", "page.mdx"),
      `---
title: "OpenAPI mode is now default"
description: "A changelog entry"
---

# OpenAPI mode is now default

The changelog now has its own dedicated route.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      entry: "docs",
      changelog: {
        enabled: true,
        path: "changelogs",
        contentDir: "changelog",
      },
    });

    const response = await GET(new Request("http://localhost/api/docs?query=OpenAPI"));
    const payload = (await response.json()) as Array<{
      url: string;
      content: string;
      description?: string;
      type: string;
    }>;

    expect(payload.some((result) => result.url === "/docs/changelogs/2026-04-15")).toBe(true);
    expect(payload.some((result) => result.url.startsWith("/docs/changelog/"))).toBe(false);
  });

  it("serves changelog markdown with the public docsPath in lookups and canonical links", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-changelog-docspath-markdown-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "changelog", "2026-04-15"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
description: "Start here"
---

# Introduction

Welcome to the docs.
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "changelog", "2026-04-15", "page.mdx"),
      `---
title: "OpenAPI mode is now default"
description: "A changelog entry"
---

# OpenAPI mode is now default

The changelog now has its own dedicated route.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      docsPath: "learn",
      changelog: {
        enabled: true,
        path: "changelogs",
        contentDir: "changelog",
      },
    });

    const mdRouteResponse = await GET(
      new Request("http://localhost/learn/changelogs/2026-04-15.md"),
    );
    expect(mdRouteResponse.status).toBe(200);
    expect(mdRouteResponse.headers.get("content-type")).toContain("text/markdown");
    expect(mdRouteResponse.headers.get("link")).toBe(
      '<http://localhost/learn/changelogs/2026-04-15>; rel="canonical"',
    );
    expect(await mdRouteResponse.text()).toContain(
      "# OpenAPI mode is now default\nURL: /learn/changelogs/2026-04-15",
    );

    const acceptResponse = await GET(
      new Request("http://localhost/learn/changelogs/2026-04-15", {
        headers: { accept: "text/markdown" },
      }),
    );
    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.headers.get("link")).toBe(
      '<http://localhost/learn/changelogs/2026-04-15>; rel="canonical"',
    );
  });

  it.each(["", "/", "///"])(
    "serves markdown from root-mounted docsPath value %s",
    async (docsPath) => {
      const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-root-docspath-markdown-"));
      tempDirs.push(rootDir);

      mkdirSync(join(rootDir, "app", "docs", "quickstart"), { recursive: true });
      writeFileSync(
        join(rootDir, "app", "docs", "quickstart", "page.mdx"),
        `---
title: "Quickstart"
description: "Start here"
---

# Quickstart

Welcome to the docs.
`,
      );

      process.chdir(rootDir);

      const { GET } = createDocsAPI({
        rootDir,
        entry: "docs",
        docsPath,
      });

      const response = await GET(new Request("http://localhost/quickstart.md"));
      expect(response.status).toBe(200);
      expect(response.headers.get("link")).toBe('<http://localhost/quickstart>; rel="canonical"');
      expect(await response.text()).toContain("# Quickstart\nURL: /quickstart");
    },
  );

  it.each(["docs", "/docs", "docs/", "/docs/"])(
    "serves markdown from default docsPath value %s",
    async (docsPath) => {
      const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-default-docspath-markdown-"));
      tempDirs.push(rootDir);

      mkdirSync(join(rootDir, "app", "docs", "quickstart"), { recursive: true });
      writeFileSync(
        join(rootDir, "app", "docs", "quickstart", "page.mdx"),
        `---
title: "Quickstart"
description: "Start here"
---

# Quickstart

Welcome to the docs.
`,
      );

      process.chdir(rootDir);

      const { GET } = createDocsAPI({
        rootDir,
        entry: "docs",
        docsPath,
      });

      const response = await GET(new Request("http://localhost/docs/quickstart.md"));
      expect(response.status).toBe(200);
      expect(response.headers.get("link")).toBe(
        '<http://localhost/docs/quickstart>; rel="canonical"',
      );
      expect(await response.text()).toContain("# Quickstart\nURL: /docs/quickstart");
    },
  );

  it("skips changelog indexing when reading the changelog directory fails", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-changelog-search-read-failure-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "changelog", "2026-04-15"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "changelog", "2026-04-15", "page.mdx"),
      `---
title: "OpenAPI mode is now default"
---

# OpenAPI mode is now default
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      entry: "docs",
      changelog: {
        enabled: true,
        path: "changelogs",
        contentDir: "changelog",
      },
    });

    const changelogDir = join(rootDir, "app", "docs", "changelog");
    chmodSync(changelogDir, 0o000);

    try {
      const response = await GET(new Request("http://localhost/api/docs?query=Welcome"));
      const payload = (await response.json()) as Array<{ url: string; content: string }>;

      expect(response.status).toBe(200);
      expect(payload.some((result) => result.url === "/docs")).toBe(true);
    } finally {
      chmodSync(changelogDir, 0o755);
    }
  });

  it("uses contentDir when provided for GET search requests", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-content-dir-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "website", "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "website", "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Start here"
---

# Overview

Schema-first storage layer.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      contentDir: "website/app/docs",
    });

    const response = await GET(new Request("http://localhost/api/docs?query=schema"));
    const payload = (await response.json()) as Array<{
      url: string;
      content: string;
      description?: string;
      type: string;
    }>;

    expect(payload.length).toBeGreaterThan(0);
    expect(payload.some((result) => result.url.startsWith("/docs"))).toBe(true);
    expect(payload.some((result) => result.content.includes("Overview"))).toBe(true);
  });

  it("falls back to traced server docs files when project-root content is unavailable", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-traced-server-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, ".next", "server", "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, ".next", "server", "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Bundled docs"
---

# Overview

Search from traced server files.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/api/docs?query=traced"));
    const payload = (await response.json()) as Array<{
      url: string;
      content: string;
      description?: string;
      type: string;
    }>;

    expect(payload.length).toBeGreaterThan(0);
    expect(payload.some((result) => result.content.includes("Overview"))).toBe(true);
  });

  it("falls back to process.cwd docs files when a compiled rootDir is provided in dev", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-dev-root-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    mkdirSync(join(rootDir, ".next"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Process cwd docs"
---

# Overview

Search from process cwd docs files.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir: join(rootDir, ".next"),
      entry: "docs",
    });

    const response = await GET(new Request("http://localhost/api/docs?query=process"));
    const payload = (await response.json()) as Array<{
      url: string;
      content: string;
      description?: string;
      type: string;
    }>;

    expect(payload.length).toBeGreaterThan(0);
    expect(payload.some((result) => result.content.includes("Overview"))).toBe(true);
  });

  it("routes GET search through an MCP search provider with a relative endpoint", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    process.chdir(rootDir);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2025-11-25",
              capabilities: {},
              serverInfo: { name: "docs-mcp", version: "1.0.0" },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "mcp-session-id": "session-1",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    results: [
                      {
                        id: "mcp-1",
                        url: "/docs/installation",
                        content: "Installation — Quickstart",
                        description: "Returned from MCP search_docs.",
                        type: "heading",
                        section: "Quickstart",
                      },
                    ],
                  }),
                },
              ],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 })) as typeof fetch;

    try {
      const { GET } = createDocsAPI({
        entry: "docs",
        search: {
          provider: "mcp",
          endpoint: "/api/docs/mcp",
        },
      });

      const response = await GET(new Request("http://localhost/api/docs?query=quickstart"));
      const payload = (await response.json()) as Array<{
        id: string;
        url: string;
        content: string;
        description?: string;
        type: string;
        section?: string;
      }>;

      expect(payload).toEqual([
        {
          id: "mcp-1",
          url: "/docs/installation",
          content: "Installation — Quickstart",
          description: "Returned from MCP search_docs.",
          type: "heading",
          section: "Quickstart",
        },
      ]);

      expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe("http://localhost/api/docs/mcp");
      expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe("http://localhost/api/docs/mcp");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it.each([
    {
      label: "default MCP route",
      mcp: undefined,
      endpoint: "http://localhost/api/docs/mcp",
    },
    {
      label: "custom MCP route",
      mcp: { route: "/custom/docs/mcp" },
      endpoint: "http://localhost/custom/docs/mcp",
    },
  ])("routes Ask AI retrieval through the $label when ai.useMcp is enabled", async (scenario) => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-ai-use-mcp-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    process.chdir(rootDir);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2025-11-25",
              capabilities: {},
              serverInfo: { name: "docs-mcp", version: "1.0.0" },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "mcp-session-id": "session-1",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    results: [
                      {
                        id: "mcp-ask-ai-1",
                        url: "/docs/introduction",
                        content: "Introduction - Ask AI MCP result",
                        description: "Returned from MCP search_docs for Ask AI.",
                        type: "heading",
                        section: "Ask AI",
                      },
                    ],
                  }),
                },
              ],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response("data: {}\n\n", {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        }),
      ) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        entry: "docs",
        ai: {
          enabled: true,
          apiKey: "test-key",
          baseUrl: "https://llm.example/v1",
          model: "test-model",
          useMcp: true,
        },
        mcp: scenario.mcp,
      });

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "How does Ask AI use MCP?" }],
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(scenario.endpoint);
      expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(scenario.endpoint);
      expect(vi.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe(scenario.endpoint);
      expect(vi.mocked(globalThis.fetch).mock.calls[3]?.[0]).toBe(
        "https://llm.example/v1/chat/completions",
      );

      const upstreamInit = vi.mocked(globalThis.fetch).mock.calls[3]?.[1];
      const upstreamBody = JSON.parse(String(upstreamInit?.body)) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      const systemMessage = upstreamBody.messages?.find((message) => message.role === "system");
      expect(systemMessage?.content).toContain("Returned from MCP search_docs for Ask AI.");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("supports a custom Ask AI MCP endpoint with headers and tool name", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-ai-use-mcp-custom-endpoint-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    process.chdir(rootDir);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2025-11-25",
              capabilities: {},
              serverInfo: { name: "remote-docs-mcp", version: "1.0.0" },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "mcp-session-id": "remote-session-1",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    results: [
                      {
                        id: "remote-mcp-ask-ai-1",
                        url: "/docs/remote",
                        content: "Remote MCP result",
                        description: "Returned from a custom MCP endpoint.",
                        type: "page",
                      },
                    ],
                  }),
                },
              ],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response("data: {}\n\n", {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        }),
      ) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        entry: "docs",
        ai: {
          enabled: true,
          apiKey: "test-key",
          baseUrl: "https://llm.example/v1",
          model: "test-model",
          useMcp: {
            endpoint: "https://docs.example.com/mcp",
            headers: {
              Authorization: "Bearer docs-mcp-token",
            },
            toolName: "custom_search_docs",
          },
        },
      });

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "How does custom MCP work?" }],
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe("https://docs.example.com/mcp");
      expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe("https://docs.example.com/mcp");

      const initializeInit = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
      expect(initializeInit?.headers).toMatchObject({
        Authorization: "Bearer docs-mcp-token",
      });

      const toolInit = vi.mocked(globalThis.fetch).mock.calls[1]?.[1];
      expect(toolInit?.headers).toMatchObject({
        Authorization: "Bearer docs-mcp-token",
        "mcp-session-id": "remote-session-1",
      });
      expect(JSON.parse(String(toolInit?.body))).toMatchObject({
        method: "tools/call",
        params: {
          name: "custom_search_docs",
        },
      });

      const upstreamInit = vi.mocked(globalThis.fetch).mock.calls[3]?.[1];
      const upstreamBody = JSON.parse(String(upstreamInit?.body)) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      const systemMessage = upstreamBody.messages?.find((message) => message.role === "system");
      expect(systemMessage?.content).toContain("Returned from a custom MCP endpoint.");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("uses a real custom MCP endpoint for Ask AI retrieval before generation", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-ai-real-mcp-endpoint-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "guides"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "guides", "page.mdx"),
      `---
title: "MCP Integration"
description: "Use MCP retrieval for Ask AI."
---

# MCP Integration

Ask AI should retrieve this exact MCP Actual Retrieval Token from the real MCP handler.
`,
    );

    process.chdir(rootDir);

    const mcpHandlers = createDocsMCPAPI({
      rootDir,
      entry: "docs",
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);

      if (url.href === "https://docs.example.com/mcp") {
        if (request.method === "POST") return mcpHandlers.POST(request);
        if (request.method === "DELETE") return mcpHandlers.DELETE(request);
        return mcpHandlers.GET(request);
      }

      if (url.href === "https://llm.example/v1/chat/completions") {
        return new Response("data: {}\n\n", {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        });
      }

      throw new Error(`Unexpected fetch request: ${url.href}`);
    }) as typeof fetch;

    try {
      const { POST } = createDocsAPI({
        rootDir,
        entry: "docs",
        ai: {
          enabled: true,
          apiKey: "test-key",
          baseUrl: "https://llm.example/v1",
          model: "test-model",
          useMcp: {
            endpoint: "https://docs.example.com/mcp",
            headers: {
              Authorization: "Bearer docs-mcp-token",
            },
          },
        },
      });

      const response = await POST(
        new Request("http://localhost/api/docs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "How do I use MCP retrieval?" }],
          }),
        }),
      );

      expect(response.status).toBe(200);

      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([input, init]) => ({
        request: input instanceof Request ? input : new Request(input, init),
        init,
      }));
      const mcpCalls = calls.filter(
        ({ request }) => request.url === "https://docs.example.com/mcp",
      );
      expect(mcpCalls.map(({ request }) => request.method)).toEqual(["POST", "POST"]);
      expect(new Headers(mcpCalls[0]?.init?.headers).get("authorization")).toBe(
        "Bearer docs-mcp-token",
      );
      expect(new Headers(mcpCalls[1]?.init?.headers).get("mcp-session-id")).toBeNull();
      expect(JSON.parse(String(mcpCalls[1]?.init?.body))).toMatchObject({
        method: "tools/call",
        params: {
          name: "search_docs",
        },
      });

      const llmCall = calls.find(
        ({ request }) => request.url === "https://llm.example/v1/chat/completions",
      );
      expect(llmCall).toBeDefined();
      const upstreamBody = JSON.parse(String(llmCall?.init?.body)) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      const systemMessage = upstreamBody.messages?.find((message) => message.role === "system");
      expect(systemMessage?.content).toContain("MCP Actual Retrieval Token");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });
});

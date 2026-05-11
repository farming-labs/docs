import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
    const sessionId = response.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const listPagesResponse = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
          "mcp-session-id": sessionId!,
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
  note: "mcp: false",
  // mcp: false
  mcp: {
    enabled: true,
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
    expect(response.headers.get("mcp-session-id")).toBeTruthy();
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
    expect(response.headers.get("mcp-session-id")).toBeTruthy();
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
      `export default {
  llmsTxt: {
    enabled: true,
    siteTitle: "Alias Docs",
    baseUrl: "https://docs.example.com",
  },
};`,
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

    for (const path of ["/llms.txt", "/.well-known/llms.txt"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).toBe(llmsApiText);
    }

    const llmsFullApi = await GET(new Request("http://localhost/api/docs?format=llms-full"));
    const llmsFullApiText = await llmsFullApi.text();
    expect(llmsFullApi.status).toBe(200);
    expect(llmsFullApiText).toContain("Welcome to the docs.");

    for (const path of ["/llms-full.txt", "/.well-known/llms-full.txt"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).toBe(llmsFullApiText);
    }

    const skillApi = await GET(new Request("http://localhost/api/docs?format=skill"));
    const skillApiText = await skillApi.text();
    expect(skillApi.status).toBe(200);
    expect(skillApi.headers.get("content-type")).toContain("text/markdown");
    expect(skillApiText).toContain("name: docs");
    expect(skillApiText).toContain("# Alias Docs Skill");
    expect(skillApiText).toContain("/docs.md");
    expect(skillApiText).toContain("/.well-known/agent.json");

    for (const path of ["/skill.md", "/.well-known/skill.md", "/api/internal/docs?format=skill"]) {
      const response = await GET(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/markdown");
      expect(await response.text()).toBe(skillApiText);
    }
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

    const response = await GET(new Request("http://localhost/llms.txt"));
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("# Default Docs");
    expect(text).toContain("- [Getting Started](/docs/getting-started.md): First steps");
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

    const { GET } = createDocsAPI({
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
  });

  it("keeps Agent blocks out of the normal search index", async () => {
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

<Agent>
Search should not return this hidden agent-only zebra token.
</Agent>
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
  });

  it("serves markdown through the default docs api route, including Agent blocks and preferring agent.md when present", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-markdown-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "getting-started", "quickstart"), { recursive: true });
    mkdirSync(join(rootDir, "app", "docs", "overview"), { recursive: true });
    mkdirSync(join(rootDir, "app", "docs", "configuration"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "getting-started", "quickstart", "page.mdx"),
      `---
title: "Quickstart"
description: "Start fast"
related:
  - /docs/overview
  - /docs/configuration
---

# Quickstart

Run \`pnpm dev\`.

<Agent>
Verify the onboarding command examples before changing this page.
</Agent>
`,
    );
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
      "Use this page as the implementation map.\n",
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
    expect(fallbackResponse.headers.get("vary")).toBeNull();
    const fallbackDocument = await fallbackResponse.text();
    expect(fallbackDocument).toContain("# Quickstart\nURL: /docs/getting-started/quickstart");
    expect(fallbackDocument).toContain(
      ["Description: Start fast", "Related: /docs/overview, /docs/configuration"].join("\n"),
    );
    expect(fallbackDocument).toContain(
      "Verify the onboarding command examples before changing this page.",
    );
    expect(fallbackDocument).not.toContain("<Agent>");

    const agentResponse = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=overview"),
    );
    expect(agentResponse.status).toBe(200);
    expect(await agentResponse.text()).toBe("Use this page as the implementation map.\n");

    const rewrittenFallbackResponse = await GET(
      new Request("http://localhost/docs/getting-started/quickstart.md"),
    );
    expect(rewrittenFallbackResponse.status).toBe(200);
    expect(rewrittenFallbackResponse.headers.get("content-type")).toContain("text/markdown");
    expect(rewrittenFallbackResponse.headers.get("vary")).toBeNull();
    expect(await rewrittenFallbackResponse.text()).toContain(
      "Verify the onboarding command examples before changing this page.",
    );

    const rewrittenAgentResponse = await GET(new Request("http://localhost/docs/overview.md"));
    expect(rewrittenAgentResponse.status).toBe(200);
    expect(await rewrittenAgentResponse.text()).toBe("Use this page as the implementation map.\n");

    const acceptFallbackResponse = await GET(
      new Request("http://localhost/docs/getting-started/quickstart", {
        headers: { accept: "text/markdown" },
      }),
    );
    expect(acceptFallbackResponse.status).toBe(200);
    expect(acceptFallbackResponse.headers.get("content-type")).toContain("text/markdown");
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
    expect(await acceptAgentResponse.text()).toBe("Use this page as the implementation map.\n");

    const weightedAcceptAgentResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { accept: "application/json, text/markdown;q=0.5" },
      }),
    );
    expect(weightedAcceptAgentResponse.status).toBe(200);
    expect(weightedAcceptAgentResponse.headers.get("content-type")).toContain("text/markdown");
    expect(weightedAcceptAgentResponse.headers.get("vary")).toBe("Accept");
    expect(await weightedAcceptAgentResponse.text()).toBe(
      "Use this page as the implementation map.\n",
    );

    const signatureAgentResponse = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=overview", {
        headers: { "Signature-Agent": "https://chatgpt.com" },
      }),
    );
    expect(signatureAgentResponse.status).toBe(200);
    expect(signatureAgentResponse.headers.get("vary")).toBe("Accept, Signature-Agent");
    expect(await signatureAgentResponse.text()).toBe("Use this page as the implementation map.\n");

    const signatureAgentPageResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { "Signature-Agent": "https://chatgpt.com" },
      }),
    );
    expect(signatureAgentPageResponse.status).toBe(200);
    expect(signatureAgentPageResponse.headers.get("content-type")).toContain("text/markdown");
    expect(signatureAgentPageResponse.headers.get("vary")).toBe("Accept, Signature-Agent");
    expect(await signatureAgentPageResponse.text()).toBe(
      "Use this page as the implementation map.\n",
    );

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

    const agentReads = events.filter((event) => event.type === "agent_read");
    expect(agentReads).toHaveLength(3);
    expect(agentReads.map((event) => event.properties?.delivery)).toEqual([
      "api_format",
      "md_route",
      "accept_header",
    ]);
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
    expect(events.find((event) => event.type === "agent_feedback_submit")).toMatchObject({
      properties: expect.objectContaining({
        handled: true,
        payloadKeys: ["task", "outcome"],
      }),
    });
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

  it("returns 404 for markdown mode when the requested page does not exist", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-markdown-missing-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Home"
---

# Home
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
    });

    const response = await GET(
      new Request("http://localhost/api/docs?format=markdown&path=missing"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    const notFoundDocument = await response.text();
    expect(notFoundDocument).toContain("# Docs Page Not Found");
    expect(notFoundDocument).toContain("`/docs/missing.md`");
    expect(notFoundDocument).toContain("`/.well-known/agent.json`");
    expect(notFoundDocument).toContain("`/api/docs?query={query}`");
    expect(notFoundDocument).toContain("`/sitemap.md`");
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
          searchDocs: false,
          getNavigation: true,
        },
      },
    });

    const response = await GET(new Request("http://localhost/api/docs/agent/spec"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

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
      markdown: Record<string, unknown>;
      llms: Record<string, string | boolean>;
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
      llms: true,
      skills: true,
      mcp: true,
      search: true,
      sitemap: false,
      robots: true,
      structuredData: true,
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
    });
    expect(spec.markdown).toMatchObject({
      enabled: true,
      acceptHeader: "text/markdown",
      pagePattern: "/docs/{slug}.md",
      rootPage: "/docs.md",
      apiPattern: "/api/docs?format=markdown&path={slug}",
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
      fields: ["headline", "description", "url", "dateModified", "breadcrumb"],
      canonicalUrlField: "url",
      breadcrumbType: "BreadcrumbList",
    });
    expect(spec.skills).toEqual({
      enabled: true,
      file: "skill.md",
      route: "/skill.md",
      wellKnown: "/.well-known/skill.md",
      api: "/api/docs?format=skill",
      generatedFallback: true,
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
        listPages: true,
        readPage: true,
        searchDocs: false,
        getNavigation: true,
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
      expect(await wellKnownResponse.json()).toEqual(spec);
    }
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
      markdown: { acceptHeader: string; pagePattern: string; rootPage: string };
      llms: Record<string, string | boolean>;
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
      llms: true,
      skills: true,
      mcp: false,
      search: false,
      sitemap: false,
      robots: true,
      structuredData: true,
      agentFeedback: false,
      locales: false,
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

  it("serves the default agent feedback schema through the shared docs api handler", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-agent-feedback-schema-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Home\n");

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      rootDir,
      entry: "docs",
      feedback: {
        agent: {
          enabled: true,
        },
      },
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
      feedback: {
        agent: {
          enabled: true,
        },
      },
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
      expect(mcpCalls.map(({ request }) => request.method)).toEqual(["POST", "POST", "DELETE"]);
      expect(new Headers(mcpCalls[0]?.init?.headers).get("authorization")).toBe(
        "Bearer docs-mcp-token",
      );
      expect(new Headers(mcpCalls[1]?.init?.headers).get("mcp-session-id")).toEqual(
        expect.any(String),
      );
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
    writeFileSync(
      join(rootDir, "app", "docs", "getting-started", "quickstart", "page.mdx"),
      `---
title: "Quickstart"
description: "Start fast"
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
    const fallbackDocument = await fallbackResponse.text();
    expect(fallbackDocument).toContain("# Quickstart\nURL: /docs/getting-started/quickstart");
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
    expect(await acceptFallbackResponse.text()).toContain(
      "Verify the onboarding command examples before changing this page.",
    );

    const acceptAgentResponse = await GET(
      new Request("http://localhost/docs/overview", {
        headers: { accept: "text/markdown, */*" },
      }),
    );
    expect(acceptAgentResponse.status).toBe(200);
    expect(await acceptAgentResponse.text()).toBe("Use this page as the implementation map.\n");
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
    expect(await response.text()).toBe("Not Found");
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
      llms: { enabled: boolean; txt: string; full: string };
      search: {
        enabled: boolean;
        endpoint: string;
        method: string;
        queryParam: string;
        localeParam: string;
      };
      skills: {
        enabled: boolean;
        registry: string;
        install: string;
        recommended: Array<{ name: string; description: string }>;
      };
      mcp: {
        enabled: boolean;
        endpoint: string;
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
      agentFeedback: true,
      locales: true,
    });
    expect(spec.api).toMatchObject({
      docs: "/api/docs",
      agentSpec: "/api/docs/agent/spec",
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
      txt: "/api/docs?format=llms",
      full: "/api/docs?format=llms-full",
    });
    expect(spec.search).toEqual({
      enabled: true,
      endpoint: "/api/docs?query={query}",
      method: "GET",
      queryParam: "query",
      localeParam: "lang",
    });
    expect(spec.skills).toEqual({
      enabled: true,
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
      llms: { enabled: boolean; txt: string; full: string };
      search: { enabled: boolean; endpoint: string; method: string };
      skills: { enabled: boolean; registry: string; install: string };
      mcp: { enabled: boolean; endpoint: string };
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
      llms: false,
      skills: true,
      mcp: false,
      search: false,
      agentFeedback: false,
      locales: false,
    });
    expect(spec.markdown).toMatchObject({
      acceptHeader: "text/markdown",
      pagePattern: "/guides/{slug}.md",
      rootPage: "/guides.md",
    });
    expect(spec.llms).toEqual({
      enabled: false,
      txt: "/api/docs?format=llms",
      full: "/api/docs?format=llms-full",
    });
    expect(spec.search).toMatchObject({
      enabled: false,
      endpoint: "/api/docs?query={query}",
      method: "GET",
    });
    expect(spec.skills).toMatchObject({
      enabled: true,
      registry: "skills.sh",
      install: "npx skills add farming-labs/docs",
    });
    expect(spec.mcp).toMatchObject({
      enabled: false,
      endpoint: "/api/docs/mcp",
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
});

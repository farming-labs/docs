import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocsSearchAdapterContext } from "./types.js";
import {
  buildDocsAskAIContext,
  buildDocsSearchDocuments,
  createAlgoliaSearchAdapter,
  createCustomSearchAdapter,
  createMcpSearchAdapter,
  createTypesenseSearchAdapter,
  performDocsSearch,
  resolveSearchRequestConfig,
} from "./search.js";

const pages = [
  {
    title: "Installation",
    url: "/docs/installation",
    description: "Install the docs framework in your app.",
    content: "Install the docs framework in your app. Configure the route and theme.",
    rawContent: `# Installation

Install the docs framework in your app.

## Quickstart

Configure the route and theme.
`,
  },
];

describe("buildDocsSearchDocuments", () => {
  it("splits pages into section documents by default", () => {
    const documents = buildDocsSearchDocuments(pages);

    expect(documents.map((item) => item.type)).toEqual(["page", "heading", "heading"]);
    expect(documents.some((item) => item.section === "Quickstart")).toBe(true);
    expect(documents.find((item) => item.section === "Quickstart")?.url).toBe(
      "/docs/installation#quickstart",
    );
  });

  it("deduplicates repeated heading hashes per page", () => {
    const documents = buildDocsSearchDocuments([
      {
        title: "Database",
        url: "/docs/database",
        content: "Session first. Session second.",
        rawContent: `# Database

## Session

First section.

## Session

Second section.
`,
      },
    ]);

    expect(documents.filter((item) => item.section === "Session").map((item) => item.url)).toEqual([
      "/docs/database#session",
      "/docs/database#session-1",
    ]);
  });

  it("strips image markdown without leaving a leading bang", () => {
    const documents = buildDocsSearchDocuments([
      {
        title: "Images",
        url: "/docs/images",
        content: "Overview",
        rawContent: `# Images

![Architecture diagram](https://example.com/diagram.png)

## Flow

![Flow chart](https://example.com/flow.png)
`,
      },
    ]);

    expect(documents.find((item) => item.type === "page")?.content).not.toContain("!");
    expect(documents.find((item) => item.section === "Flow")?.content).toContain("Flow chart");
  });

  it("keeps fenced code searchable in section documents", () => {
    const documents = buildDocsSearchDocuments([
      {
        title: "Doctor",
        url: "/docs/doctor",
        content: "Validate docs readiness.",
        rawContent: `import { Callout } from "@/components/callout";

# Doctor

## Remote URL

Run the doctor against a deployed site:

\`\`\`bash
docs doctor --url https://docs.example.com
\`\`\`

\`\`\`ts
import { betterAuth } from "better-auth";
export const auth = betterAuth({});
\`\`\`
`,
      },
    ]);

    const sectionContent = documents.find((item) => item.section === "Remote URL")?.content;
    expect(sectionContent).toContain("docs doctor --url https://docs.example.com");
    expect(sectionContent).toContain('import { betterAuth } from "better-auth";');
    expect(sectionContent).toContain("export const auth = betterAuth({});");
    expect(sectionContent).not.toContain("@/components/callout");
  });
});

describe("performDocsSearch", () => {
  it("returns simple search results with snippets", async () => {
    const results = await performDocsSearch({
      pages,
      query: "configure",
    });

    expect(results[0]).toMatchObject({
      url: "/docs/installation#quickstart",
      type: "heading",
    });
    expect(results[0].content).toContain("Quickstart");
    expect(results[0].description).toContain("Configure the route");
  });

  it("prioritizes exact result labels over broader prefix matches", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "React",
          url: "/docs/react",
          content: "Configure React search.",
          rawContent: `# React

## Search

Configure React search.
`,
        },
        {
          title: "React Search API",
          url: "/docs/react-search-api",
          content: "API reference for React search.",
          rawContent: `# React Search API

API reference for React search.
`,
        },
      ],
      query: "React Search",
    });

    expect(results[0]).toMatchObject({
      url: "/docs/react#search",
      content: "React — Search",
      section: "Search",
    });
  });

  it("prioritizes exact URL segment matches", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "AI Search",
          url: "/docs/ai-search",
          content: "Configure the AI search experience.",
          rawContent: "# AI Search\n\nConfigure the AI search experience.",
        },
        {
          title: "Search",
          url: "/docs/search",
          content: "Mentions ai-native as a related setup option.",
          rawContent: "# Search\n\nMentions ai-native as a related setup option.",
        },
        {
          title: "AI Native",
          url: "/docs/getting-started/ai-native",
          content: "Configure AI-native docs.",
          rawContent: "# AI Native\n\nConfigure AI-native docs.",
        },
      ],
      query: "ai-native",
    });

    expect(results[0]).toMatchObject({
      url: "/docs/getting-started/ai-native",
      content: "AI Native",
    });
  });

  it("prioritizes literal inside-page matches before page matches", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "MCP",
          url: "/docs/mcp",
          content: "Overview page.",
          rawContent: "Overview page.",
        },
        {
          title: "Customization",
          url: "/docs/customization/transports",
          content: "Transport options.",
          rawContent: `# Customization

## Stdio transport

Use MCP locally from editor and agent clients.
`,
        },
      ],
      query: "mcp",
    });

    expect(results[0]).toMatchObject({
      type: "heading",
      url: "/docs/customization/transports#stdio-transport",
      content: "Customization — Stdio transport",
    });
    expect(results[1]).toMatchObject({
      type: "page",
      url: "/docs/mcp",
      content: "MCP",
    });
  });

  it("keeps exact page matches after literal inside-page matches from an external provider", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "MCP Server",
          url: "/docs/customization/mcp",
          content: "Configure MCP routes for multiple frameworks.",
          rawContent: `# MCP Server

## Stdio transport

Use the local MCP transport.

## Custom route

Configure a custom MCP route.
`,
        },
      ],
      query: "mcp",
      search: createCustomSearchAdapter({
        name: "external",
        async search() {
          return [
            {
              id: "external-1",
              url: "/docs/customization/mcp#stdio-transport",
              content: "MCP Server — Stdio transport",
              description: "Use the local MCP transport.",
              type: "heading",
              section: "Stdio transport",
            },
          ];
        },
      }),
    });

    expect(results[0]).toMatchObject({
      type: "heading",
      url: "/docs/customization/mcp#stdio-transport",
    });
    expect(results[1]).toMatchObject({
      type: "page",
      url: "/docs/customization/mcp",
      content: "MCP Server",
    });
  });

  it("does not treat repeated page labels as literal inside-page matches", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "AI Native",
          url: "/docs/getting-started/ai-native",
          content: "Configure AI-native docs.",
          rawContent: `# AI Native

## Custom Loading States

Customize the loading UI.
`,
        },
      ],
      query: "ai-native",
      search: createCustomSearchAdapter({
        name: "external",
        async search() {
          return [
            {
              id: "external-1",
              url: "/docs/getting-started/ai-native#custom-loading-states",
              content: "AI Native — Custom Loading States",
              description: "Customize the loading UI.",
              type: "heading",
              section: "Custom Loading States",
            },
          ];
        },
      }),
    });

    expect(results[0]).toMatchObject({
      type: "page",
      url: "/docs/getting-started/ai-native",
      content: "AI Native",
    });
    expect(results[1]).toMatchObject({
      type: "heading",
      url: "/docs/getting-started/ai-native#custom-loading-states",
    });
  });

  it("uses a custom adapter when configured", async () => {
    const search = await performDocsSearch({
      pages,
      query: "install",
      search: createCustomSearchAdapter({
        name: "custom",
        async search(query, context) {
          expect(query.query).toBe("install");
          expect(context.documents.length).toBeGreaterThan(0);
          return [
            {
              id: "custom-1",
              url: "/docs/custom",
              content: "Custom result",
              description: "From the custom adapter",
              type: "page",
            },
          ];
        },
      }),
    });

    expect(search).toEqual([
      {
        id: "custom-1",
        url: "/docs/custom",
        content: "Custom result",
        description: "From the custom adapter",
        type: "page",
      },
    ]);
  });

  it("falls back to simple search when a custom adapter throws", async () => {
    const results = await performDocsSearch({
      pages,
      query: "installation",
      search: createCustomSearchAdapter({
        name: "broken",
        async search() {
          throw new Error("nope");
        },
      }),
    });

    expect(results[0]?.url?.startsWith("/docs/installation")).toBe(true);
  });

  it("uses an MCP adapter when configured", async () => {
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
                        description: "Pulled from MCP search_docs.",
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
      ) as typeof fetch;

    try {
      const results = await performDocsSearch({
        pages,
        query: "quickstart",
        search: resolveSearchRequestConfig(
          {
            provider: "mcp",
            endpoint: "/api/docs/mcp",
          },
          "http://127.0.0.1:3000/api/docs",
        ),
      });

      expect(results).toEqual([
        {
          id: "mcp-1",
          url: "/docs/installation",
          content: "Installation — Quickstart",
          description: "Pulled from MCP search_docs.",
          type: "heading",
          score: undefined,
          section: "Quickstart",
        },
      ]);
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
      const searchCall = vi.mocked(globalThis.fetch).mock.calls[1]?.[1];
      expect(searchCall?.headers).toBeDefined();
      expect(searchCall?.headers).not.toHaveProperty("mcp-session-id");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("strips markdown artifacts from result descriptions", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "Quickstart",
          url: "/docs/quickstart",
          description: "Get up and running in minutes",
          content:
            "Quickstart Create a page Create a new folder under app/docs/ with a page.mdx file. Then create app/docs/my-page/page.mdx. Your page is now available at /docs/my-page.",
          rawContent: `# Quickstart

## Creating a Page

Create a new folder under \`app/docs/\` with a \`page.mdx\` file:

\`\`\`bash
mkdir -p app/docs/my-page
\`\`\`

Then create \`app/docs/my-page/page.mdx\`:

\`\`\`mdx
---
title: "My Page"
description: "A custom documentation page"
---

# My Page

Write your content here using **Markdown** and JSX components.
\`\`\`

Your page is now available at \`/docs/my-page\`.
`,
        },
      ],
      query: "my page",
    });

    expect(results[0]?.description).toContain("/docs/my-page");
    expect(results[0]?.description).not.toContain("```");
    expect(results[0]?.description).not.toContain("`");
    expect(results[0]?.description).not.toContain("|");
  });

  it("ignores question stopwords and punctuation when ranking natural-language queries", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "AI Chat",
          url: "/docs/ai-chat",
          content: "suggestedQuestions: What themes are available?",
          rawContent: `# AI Chat

## Suggested Questions

\`\`\`ts
suggestedQuestions: ["What themes are available?"]
\`\`\`
`,
        },
        {
          title: "Customize",
          url: "/docs/customize",
          content: "Nine built-in themes are available.",
          rawContent: `# Customize

## Available Themes

Nine built-in themes are available: fumadocs, darksharp, pixel-border, colorful, shiny, darkbold, greentree, hardline, and concrete.
`,
        },
      ],
      query: "What themes are available?",
    });

    expect(results[0]).toMatchObject({
      url: "/docs/customize#available-themes",
      section: "Available Themes",
    });
  });
});

describe("buildDocsAskAIContext", () => {
  it("uses section search and preserves code blocks for the model context", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Doctor",
          url: "/docs/doctor",
          description: "Validate docs readiness before shipping.",
          content: "Validate docs readiness.",
          rawContent: `# Doctor

## Local Checks

Run local checks before publishing.

## Remote URL

Run the doctor against a hosted site:

\`\`\`bash
docs doctor --url https://docs.example.com
\`\`\`

\`\`\`ts
import { betterAuth } from "better-auth";
\`\`\`
`,
        },
      ],
      query: "docs doctor --url",
      limit: 1,
    });

    expect(context.results[0]).toMatchObject({
      url: "/docs/doctor#remote-url",
      section: "Remote URL",
    });
    expect(context.context).toContain("URL: /docs/doctor#remote-url");
    expect(context.context).toContain("```bash");
    expect(context.context).toContain("docs doctor --url https://docs.example.com");
    expect(context.context).toContain('import { betterAuth } from "better-auth";');
    expect(context.packageHints.packages).toContain("better-auth");
    expect(context.packageHints.imports).toContain('import { betterAuth } from "better-auth";');
    expect(context.context).not.toContain("Local Checks");
  });

  it("hydrates custom search results with local page content", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Installation",
          url: "/docs/installation",
          content: "Install the package.",
          rawContent: `# Installation

## Package Manager

\`\`\`bash
pnpm add @farming-labs/docs
\`\`\`
`,
        },
      ],
      query: "install",
      search: createCustomSearchAdapter({
        name: "custom",
        async search() {
          return [
            {
              id: "custom-install",
              url: "/docs/installation#package-manager",
              content: "Installation — Package Manager",
              type: "heading",
              section: "Package Manager",
            },
          ];
        },
      }),
    });

    expect(context.searchResults.some((result) => result.id === "custom-install")).toBe(true);
    expect(context.results[0]).toMatchObject({
      url: "/docs/installation#package-manager",
      section: "Package Manager",
    });
    expect(context.context).toContain("pnpm add @farming-labs/docs");
  });

  it("keeps duplicate heading titles on the same page when URL hashes differ", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Plugins",
          url: "/docs/plugins",
          content: "Configure server and client plugins.",
          rawContent: `# Plugins

## Configure

Server plugin setup.

## Configure

Client plugin setup.
`,
        },
      ],
      query: "configure plugins",
      limit: 2,
      search: createCustomSearchAdapter({
        name: "duplicate-headings",
        async search() {
          return [
            {
              id: "server-configure",
              url: "/docs/plugins#configure",
              content: "Plugins — Configure",
              type: "heading",
              section: "Configure",
            },
            {
              id: "client-configure",
              url: "/docs/plugins#configure-1",
              content: "Plugins — Configure",
              type: "heading",
              section: "Configure",
            },
          ];
        },
      }),
    });

    expect(context.results.map((result) => result.url)).toEqual([
      "/docs/plugins#configure",
      "/docs/plugins#configure-1",
    ]);
  });

  it("supplements stale external search results with local section ranking", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "AI Chat",
          url: "/docs/getting-started/ai-native",
          content: "suggestedQuestions: What themes are available?",
          rawContent: `# AI Chat

## Suggested Questions

\`\`\`ts
suggestedQuestions: ["What themes are available?"]
\`\`\`
`,
        },
        {
          title: "Customize",
          url: "/docs/customize",
          content: "Nine built-in themes are available.",
          rawContent: `# Customize

## Available Themes

Nine built-in themes are available: default, colorful, concrete, darkbold,
darksharp, hardline, ledger, minimal, and shiny.
`,
        },
      ],
      query: "What themes are available?",
      limit: 1,
      search: createCustomSearchAdapter({
        name: "stale",
        async search() {
          return [
            {
              id: "stale-suggested-questions",
              url: "/docs/getting-started/ai-native#suggested-questions",
              content: "AI Chat — Suggested Questions",
              type: "heading",
              section: "Suggested Questions",
            },
          ];
        },
      }),
    });

    expect(context.results[0]).toMatchObject({
      url: "/docs/customize#available-themes",
      section: "Available Themes",
    });
    expect(context.context).toContain("Nine built-in themes are available");
  });

  it("uses absolute context URLs when a request base URL is provided", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Customize",
          url: "/docs/customize",
          content: "Nine built-in themes are available.",
          rawContent: `# Customize

## Available Themes

Nine built-in themes are available.
`,
        },
      ],
      query: "available themes",
      baseUrl: "https://docs.example.com/api/docs",
      limit: 1,
    });

    expect(context.results[0]?.url).toBe(
      "https://docs.example.com/docs/customize#available-themes",
    );
    expect(context.context).toContain(
      "URL: https://docs.example.com/docs/customize#available-themes",
    );
  });
});

describe("remote search adapters", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("maps Algolia hits into docs search results", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            {
              objectID: "alg-1",
              url: "/docs/installation",
              title: "Installation",
              section: "Quickstart",
              type: "heading",
              _snippetResult: {
                content: {
                  value: "Install the docs framework in your app.",
                },
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const adapter = createAlgoliaSearchAdapter({
      provider: "algolia",
      appId: "app-id",
      indexName: "docs",
      searchApiKey: "search-key",
    });

    const results = await adapter.search({ query: "install", limit: 5 }, {
      pages: [],
      documents: [],
    } as DocsSearchAdapterContext);

    expect(results).toEqual([
      {
        id: "alg-1",
        url: "/docs/installation",
        content: "Installation — Quickstart",
        description: "Install the docs framework in your app.",
        type: "heading",
        score: undefined,
        section: "Quickstart",
      },
    ]);
  });

  it("trims oversized Algolia records before syncing", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    const adapter = createAlgoliaSearchAdapter({
      provider: "algolia",
      appId: "app-id",
      indexName: "docs",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
    });

    expect(adapter.index).toBeDefined();
    await adapter.index!({
      pages: [],
      documents: [
        {
          id: "/docs/cli#page",
          url: "/docs/cli",
          title: "CLI",
          content: "A".repeat(20_000),
          description: "B".repeat(2_000),
          type: "page",
        },
      ],
    } as DocsSearchAdapterContext);

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(call).toBeDefined();
    const init = call?.[1];
    expect(typeof init?.body).toBe("string");
    const payload = JSON.parse(String(init?.body));
    const record = payload.requests[0].body as Record<string, unknown>;
    const bytes = new TextEncoder().encode(JSON.stringify(record)).length;

    expect(bytes).toBeLessThanOrEqual(9_500);
    expect(record.objectID).toBe("/docs/cli#page");
    expect(record.content).toBeTypeOf("string");
  });

  it("maps Typesense hits into docs search results", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            {
              text_match: 123,
              document: {
                id: "ts-1",
                url: "/docs/installation",
                title: "Installation",
                section: "Quickstart",
                type: "heading",
                description: "Install the docs framework in your app.",
              },
              highlights: [
                {
                  field: "content",
                  snippet: "Install the docs framework in your app.",
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const adapter = createTypesenseSearchAdapter({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
    });

    const results = await adapter.search({ query: "install", limit: 5 }, {
      pages: [],
      documents: [],
    } as DocsSearchAdapterContext);

    expect(results).toEqual([
      {
        id: "ts-1",
        url: "/docs/installation",
        content: "Installation — Quickstart",
        description: "Install the docs framework in your app.",
        type: "heading",
        score: 123,
        section: "Quickstart",
      },
    ]);
  });

  it("creates a Typesense collection without an invalid default sorting field", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const adapter = createTypesenseSearchAdapter({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
      adminApiKey: "admin-key",
    });

    expect(adapter.index).toBeDefined();
    await adapter.index!({
      pages,
      documents: buildDocsSearchDocuments(pages),
    } as DocsSearchAdapterContext);

    const createCall = vi.mocked(globalThis.fetch).mock.calls[1];
    expect(createCall).toBeDefined();
    const init = createCall?.[1];
    expect(init).toBeDefined();
    expect(typeof init?.body).toBe("string");
    const payload = JSON.parse(String(init?.body));
    expect(payload.default_sorting_field).toBeUndefined();
  });

  it("maps legacy MCP search_docs payloads into docs search results", async () => {
    vi.mocked(globalThis.fetch)
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
                        slug: "installation",
                        url: "/docs/installation",
                        title: "Installation",
                        excerpt: "Install the docs framework in your app.",
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
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        }),
      );

    const adapter = createMcpSearchAdapter({
      provider: "mcp",
      endpoint: "https://docs.example.com/api/docs/mcp",
    });

    const results = await adapter.search({ query: "install", limit: 5 }, {
      pages: [],
      documents: [],
    } as DocsSearchAdapterContext);

    expect(results).toEqual([
      {
        id: "installation",
        url: "/docs/installation",
        content: "Installation",
        description: "Install the docs framework in your app.",
        type: "page",
        score: undefined,
        section: undefined,
      },
    ]);
  });
});

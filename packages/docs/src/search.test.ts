import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocsSearchAdapterContext } from "./types.js";
import {
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
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        }),
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

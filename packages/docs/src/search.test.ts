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
  resolveDocsSearchAudience,
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

  it("builds distinct human and agent audience indexes", () => {
    const audiencePages = [
      {
        title: "Audience policy",
        url: "/docs/audience",
        content: "Shared text. Human troubleshooting token.",
        rawContent: "# Audience policy\n\nShared text. Human troubleshooting token.",
        agentFallbackContent: "Shared text. Agent execution token.",
        agentFallbackRawContent: "# Audience policy\n\nShared text. Agent execution token.",
      },
    ];

    const humanDocuments = buildDocsSearchDocuments(audiencePages);
    const agentDocuments = buildDocsSearchDocuments(audiencePages, {}, "agent");

    expect(humanDocuments.map((document) => document.content).join(" ")).toContain(
      "Human troubleshooting token",
    );
    expect(humanDocuments.map((document) => document.content).join(" ")).not.toContain(
      "Agent execution token",
    );
    expect(agentDocuments.map((document) => document.content).join(" ")).toContain(
      "Agent execution token",
    );
    expect(agentDocuments.map((document) => document.content).join(" ")).not.toContain(
      "Human troubleshooting token",
    );
  });

  it("uses CommonMark headings and never treats fenced shell comments as headings", () => {
    const documents = buildDocsSearchDocuments([
      {
        title: "Advanced setup",
        url: "/docs/advanced",
        content: "Install the CLI and verify setup.",
        rawContent: `   ## [Install the \`CLI\`](https://example.com/cli)

\`\`\`bash
# this is a shell comment, not a heading
echo ready
\`\`\`

[Verify *setup*](https://example.com/verify)
-------------------------------------------

## Repeat

First.

## Repeat

Second.
`,
      },
    ]);

    expect(documents.filter((item) => item.type === "heading")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "Install the CLI",
          url: "/docs/advanced#install-the-cli",
          content: expect.stringContaining("echo ready"),
        }),
        expect.objectContaining({
          section: "Verify setup",
          url: "/docs/advanced#verify-setup",
        }),
        expect.objectContaining({ section: "Repeat", url: "/docs/advanced#repeat" }),
        expect.objectContaining({ section: "Repeat", url: "/docs/advanced#repeat-1" }),
      ]),
    );
    expect(
      documents.some((item) => item.url.endsWith("#this-is-a-shell-comment-not-a-heading")),
    ).toBe(false);
    expect(documents.some((item) => item.section?.includes("shell comment"))).toBe(false);
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

  it("indexes task and outcome terms from structured agent contracts", () => {
    const documents = buildDocsSearchDocuments([
      {
        title: "Dependencies",
        url: "/docs/dependencies",
        content: "Manage project packages.",
        rawContent: "# Dependencies\n\nManage project packages.",
        agent: {
          task: "Create a hermetic dependency graph",
          outcome: "Every package resolves from the committed lockfile.",
        },
      },
    ]);

    const page = documents.find((document) => document.type === "page");
    expect(page?.content).toContain("Create a hermetic dependency graph");
    expect(page?.content).toContain("Every package resolves from the committed lockfile");
    expect(page?.content).not.toContain("farming-labs:agent-contract");
  });
});

describe("performDocsSearch", () => {
  it.each([
    [undefined, "human"],
    [null, "human"],
    ["", "human"],
    ["human", "human"],
    ["Agent", "human"],
    ["bot", "human"],
    ["agent", "agent"],
  ] as const)("resolves the %s audience query value to %s", (value, expected) => {
    expect(resolveDocsSearchAudience(value)).toBe(expected);
  });

  it("auto-forwards MCP audience only to the same-origin default search tool", () => {
    expect(
      resolveSearchRequestConfig(
        { provider: "mcp", endpoint: "/api/docs/mcp" },
        "https://docs.example.com/api/docs",
      ),
    ).toMatchObject({
      endpoint: "https://docs.example.com/api/docs/mcp",
      forwardAudience: true,
    });
    expect(
      resolveSearchRequestConfig(
        { provider: "mcp", endpoint: "https://remote.example/mcp" },
        "https://docs.example.com/api/docs",
      ),
    ).toMatchObject({ forwardAudience: false });
    expect(
      resolveSearchRequestConfig(
        { provider: "mcp", endpoint: "/api/docs/mcp", toolName: "custom_search" },
        "https://docs.example.com/api/docs",
      ),
    ).toMatchObject({ forwardAudience: false });
  });

  it("keeps public search human-only while allowing explicit agent retrieval", async () => {
    const audiencePages = [
      {
        title: "Audience policy",
        url: "/docs/audience",
        content: "Human walkthrough.",
        rawContent: "# Audience policy\n\nHuman walkthrough.",
        agentFallbackContent: "Use the cobalt automation token.",
        agentFallbackRawContent: "# Audience policy\n\nUse the cobalt automation token.",
      },
    ];

    const humanResults = await performDocsSearch({
      pages: audiencePages,
      query: "cobalt automation token",
    });
    const agentResults = await performDocsSearch({
      pages: audiencePages,
      query: "cobalt automation token",
      audience: "agent",
    });

    expect(humanResults).toHaveLength(0);
    expect(agentResults[0]?.url).toBe("/docs/audience");
  });

  it("never syncs the agent projection into a public hosted index", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hits: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch;

    try {
      await performDocsSearch({
        pages: [
          {
            title: "Audience sync",
            url: "/docs/audience-sync",
            content: "Human coral walkthrough.",
            rawContent: "# Audience sync\n\nHuman coral walkthrough.",
            agentFallbackContent: "Agent indigo procedure.",
            agentFallbackRawContent: "# Audience sync\n\nAgent indigo procedure.",
          },
        ],
        query: "indigo procedure",
        audience: "agent",
        search: {
          provider: "algolia",
          appId: "audience-sync-app",
          indexName: "audience-sync-index",
          searchApiKey: "search-key",
          adminApiKey: "admin-key",
          syncOnSearch: true,
        },
      });

      const syncPayload = JSON.parse(
        String(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body),
      ) as { requests: Array<{ body: { content?: string } }> };
      const indexedContent = syncPayload.requests
        .map((request) => request.body.content ?? "")
        .join(" ");
      expect(indexedContent).toContain("Human coral walkthrough");
      expect(indexedContent).not.toContain("Agent indigo procedure");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

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
          expect(query.audience).toBe("human");
          expect(context.audience).toBe("human");
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

  it("projects raw audience blocks before passing documents to custom adapters", async () => {
    const seen: string[] = [];
    const adapter = createCustomSearchAdapter({
      name: "audience-aware-custom",
      async search(query, context) {
        seen.push(`${query.audience}:${context.audience}:${context.documents[0]?.content ?? ""}`);
        return [];
      },
    });
    const sourcePages = [
      {
        title: "Audience projection",
        url: "/docs/audience-projection",
        content:
          "Shared context. <Human>Human coral token.</Human> <Agent>Agent indigo token.</Agent>",
      },
    ];

    await performDocsSearch({ pages: sourcePages, query: "token", search: adapter });
    await performDocsSearch({
      pages: sourcePages,
      query: "token",
      audience: "agent",
      search: adapter,
    });

    expect(seen[0]).toContain("human:human:Shared context. Human coral token.");
    expect(seen[0]).not.toContain("Agent indigo token");
    expect(seen[1]).toContain("agent:agent:Shared context. Agent indigo token.");
    expect(seen[1]).not.toContain("Human coral token");
  });

  it("replaces stale local provider snippets with the selected human projection", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "Audience-safe search",
          url: "/docs/audience-safe-search",
          content: "Shared setup. Human coral walkthrough.",
          rawContent: "# Audience-safe search\n\nShared setup. Human coral walkthrough.",
          agentFallbackContent: "Shared setup. Agent indigo procedure.",
          agentFallbackRawContent:
            "# Audience-safe search\n\nShared setup. Agent indigo procedure.",
        },
      ],
      query: "shared setup",
      search: createCustomSearchAdapter({
        name: "stale-agent-index",
        async search() {
          return [
            {
              id: "stale-hit",
              url: "/docs/audience-safe-search",
              content: "Audience-safe search",
              description: "Shared setup. Agent indigo procedure.",
              type: "page",
            },
          ];
        },
      }),
    });

    expect(results.find((result) => result.id === "stale-hit")?.description).toContain(
      "Human coral walkthrough",
    );
    expect(JSON.stringify(results)).not.toContain("Agent indigo procedure");
  });

  it("does not turn cross-audience provider hits into false-positive local results", async () => {
    const sourcePages = [
      {
        title: "Audience-safe filtering",
        url: "/docs/audience-safe-filtering",
        content: "Shared setup. Human coral walkthrough.",
        rawContent: "# Audience-safe filtering\n\nShared setup. Human coral walkthrough.",
        agentFallbackContent: "Shared setup. Agent indigo procedure.",
        agentFallbackRawContent:
          "# Audience-safe filtering\n\nShared setup. Agent indigo procedure.",
      },
    ];
    const staleProvider = createCustomSearchAdapter({
      name: "cross-audience-index",
      async search(query) {
        return [
          {
            id: `stale-${query.audience}`,
            url: "/docs/audience-safe-filtering",
            content: "Audience-safe filtering",
            type: "page",
          },
        ];
      },
    });

    await expect(
      performDocsSearch({
        pages: sourcePages,
        query: "indigo",
        search: staleProvider,
      }),
    ).resolves.toEqual([]);
    await expect(
      performDocsSearch({
        pages: sourcePages,
        query: "coral",
        audience: "agent",
        search: staleProvider,
      }),
    ).resolves.toEqual([]);
  });

  it("falls back to current human content when a provider returns a stale absolute anchor", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "Current search guide",
          url: "/docs/current-search-guide",
          content: `Current amber workflow. ${"Detailed human guidance. ".repeat(30)}`,
          rawContent: `# Current search guide\n\nCurrent amber workflow. ${"Detailed human guidance. ".repeat(30)}`,
          agentFallbackContent: "Agent violet workflow.",
          agentFallbackRawContent: "# Current search guide\n\nAgent violet workflow.",
        },
      ],
      query: "amber",
      baseUrl: "https://docs.example.com",
      search: createCustomSearchAdapter({
        name: "stale-anchor-index",
        async search() {
          return [
            {
              id: "removed-anchor",
              url: "https://docs.example.com/docs/current-search-guide#removed",
              content: "Current search guide — Removed",
              description: "Agent violet workflow.",
              type: "heading",
              section: "Removed",
            },
          ];
        },
      }),
    });

    expect(results.some((result) => result.url === "/docs/current-search-guide")).toBe(true);
    expect(JSON.stringify(results)).toContain("Current amber workflow");
    expect(JSON.stringify(results)).not.toContain("Agent violet workflow");
    expect(
      Math.max(...results.map((result) => result.description?.length ?? 0)),
    ).toBeLessThanOrEqual(160);
  });

  it("fails remote MCP human projection closed when audience forwarding is not enabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const results = await performDocsSearch({
        pages,
        query: "configure",
        search: {
          provider: "mcp",
          endpoint: "https://remote.example/mcp",
        },
      });

      expect(results[0]?.url).toBe("/docs/installation#quickstart");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
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

  it("trusts agent-native MCP results without matching them to the local human index", async () => {
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
                        url: "/docs/remote-agent-runbook",
                        content: "Remote agent runbook",
                        description: "Agent-only procedure from MCP search_docs.",
                        type: "heading",
                        section: "Procedure",
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
        query: "remote agent runbook",
        audience: "agent",
        limit: 1,
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
          url: "/docs/remote-agent-runbook",
          content: "Remote agent runbook",
          description: "Agent-only procedure from MCP search_docs.",
          type: "heading",
          score: undefined,
          section: "Procedure",
        },
      ]);
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
      const searchCall = vi.mocked(globalThis.fetch).mock.calls[1]?.[1];
      expect(searchCall?.headers).toBeDefined();
      expect(searchCall?.headers).not.toHaveProperty("mcp-session-id");
      expect(JSON.parse(String(searchCall?.body))).toMatchObject({
        params: {
          arguments: {
            audience: "agent",
          },
        },
      });
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

  it("keeps snippets bounded when the matching query itself is long", async () => {
    const longQuery = `agent-${"projection-".repeat(24)}token`;
    const results = await performDocsSearch({
      pages: [
        {
          title: "Long query",
          url: "/docs/long-query",
          content: `Prefix ${longQuery} suffix`,
        },
      ],
      query: longQuery,
      limit: 1,
    });

    expect(results[0]?.description?.length).toBeLessThanOrEqual(160);
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
  it("retrieves agent-only terms and excludes human-only text", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Audience-aware setup",
          url: "/docs/audience-aware",
          content: "Shared introduction. Human screenshot walkthrough.",
          rawContent: "# Setup\n\nShared introduction. Human screenshot walkthrough.",
          agentFallbackContent: "Shared introduction. Use the zircon handshake nonce.",
          agentFallbackRawContent:
            "# Setup\n\nShared introduction.\n\n## Automation\n\nUse the zircon handshake nonce.",
        },
      ],
      query: "zircon handshake nonce",
      limit: 1,
    });

    expect(context.results[0]?.url).toBe("/docs/audience-aware#automation");
    expect(context.context).toContain("zircon handshake nonce");
    expect(context.context).not.toContain("Human screenshot walkthrough");
  });

  it("retrieves and includes a contract when only its task terms match", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Dependencies",
          url: "/docs/dependencies",
          content: "Manage project packages.",
          rawContent: "# Dependencies\n\nManage project packages.",
          agent: {
            task: "Create a hermetic dependency graph",
            outcome: "Every package resolves from the committed lockfile.",
          },
        },
      ],
      query: "hermetic dependency graph",
      limit: 1,
    });

    expect(context.results[0]?.url).toBe("/docs/dependencies");
    expect(context.context).toContain("Task: Create a hermetic dependency graph");
    expect(context.context).toContain(
      "Outcome: Every package resolves from the committed lockfile.",
    );
    expect(context.context).not.toContain("farming-labs:agent-contract");
  });

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

  it("sanitizes hosted search snippets against the agent projection", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Audience-safe retrieval",
          url: "/docs/audience-safe",
          content: "Shared setup. Human coral walkthrough.",
          rawContent: "# Audience-safe retrieval\n\nShared setup. Human coral walkthrough.",
          agentFallbackContent: "Shared setup. Agent indigo procedure.",
          agentFallbackRawContent:
            "# Audience-safe retrieval\n\nShared setup. Agent indigo procedure.",
        },
      ],
      query: "shared setup",
      search: createCustomSearchAdapter({
        name: "human-index",
        async search() {
          return [
            {
              id: "hosted-audience-safe",
              url: "https://docs.example.com/docs/audience-safe",
              content: "Audience-safe retrieval",
              description: "Human coral walkthrough.",
              type: "page",
            },
          ];
        },
      }),
      baseUrl: "https://docs.example.com",
    });

    expect(context.searchResults.some((result) => result.id === "hosted-audience-safe")).toBe(true);
    expect(JSON.stringify(context.searchResults)).not.toContain("Human coral walkthrough");
    expect(context.context).toContain("Agent indigo procedure");
    expect(context.context).not.toContain("Human coral walkthrough");
  });

  it("sanitizes MCP snippets for local pages against the agent projection", async () => {
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
              serverInfo: { name: "remote-docs", version: "1.0.0" },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
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
                        id: "mcp-audience-safe",
                        url: "https://docs.example.com/docs/audience-safe",
                        content: "Audience-safe retrieval",
                        description: "Human coral walkthrough.",
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
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

    try {
      const context = await buildDocsAskAIContext({
        pages: [
          {
            title: "Audience-safe retrieval",
            url: "/docs/audience-safe",
            content: "Shared setup. Human coral walkthrough.",
            rawContent: "# Audience-safe retrieval\n\nShared setup. Human coral walkthrough.",
            agentFallbackContent: "Shared setup. Agent indigo procedure.",
            agentFallbackRawContent:
              "# Audience-safe retrieval\n\nShared setup. Agent indigo procedure.",
          },
        ],
        query: "shared setup",
        search: {
          provider: "mcp",
          endpoint: "https://remote.example/mcp",
        },
        baseUrl: "https://docs.example.com",
        limit: 1,
      });

      expect(context.searchResults.some((result) => result.id === "mcp-audience-safe")).toBe(true);
      expect(JSON.stringify(context.searchResults)).not.toContain("Human coral walkthrough");
      expect(context.context).toContain("Agent indigo procedure");
      expect(context.context).not.toContain("Human coral walkthrough");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("preserves truly foreign MCP results instead of hydrating same-path local pages", async () => {
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
              serverInfo: { name: "remote-docs", version: "1.0.0" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
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
                        id: "foreign-audience-safe",
                        url: "https://remote.example/docs/audience-safe",
                        content: "Remote audience-safe retrieval",
                        description: "Remote agent orchid procedure.",
                        type: "page",
                      },
                    ],
                  }),
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;

    try {
      const context = await buildDocsAskAIContext({
        pages: [
          {
            title: "Local audience-safe retrieval",
            url: "/docs/audience-safe",
            content: "Local human content.",
            rawContent: "# Local\n\nLocal human content.",
            agentFallbackContent: "Local agent indigo procedure.",
            agentFallbackRawContent: "# Local\n\nLocal agent indigo procedure.",
          },
        ],
        query: "remote orchid",
        search: { provider: "mcp", endpoint: "https://remote.example/mcp" },
        baseUrl: "https://docs.example.com",
        limit: 1,
      });

      expect(context.results[0]?.url).toBe("https://remote.example/docs/audience-safe");
      expect(context.context).toContain("Remote agent orchid procedure.");
      expect(context.context).not.toContain("Local agent indigo procedure.");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("keeps foreign MCP context when a local exact match has the same path", async () => {
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
              serverInfo: { name: "remote-docs", version: "1.0.0" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
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
                        id: "foreign-shared-runbook",
                        url: "https://remote.example/docs/shared-runbook",
                        content: "Shared runbook",
                        description: "Remote agent orchid procedure.",
                        type: "page",
                      },
                    ],
                  }),
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;

    try {
      const context = await buildDocsAskAIContext({
        pages: [
          {
            title: "Shared runbook",
            url: "/docs/shared-runbook",
            content: "Local human walkthrough.",
            rawContent: "# Shared runbook\n\nLocal human walkthrough.",
            agentFallbackContent: "Local agent indigo procedure.",
            agentFallbackRawContent: "# Shared runbook\n\nLocal agent indigo procedure.",
          },
        ],
        query: "shared runbook",
        search: { provider: "mcp", endpoint: "https://remote.example/mcp" },
        baseUrl: "https://docs.example.com",
        limit: 2,
      });

      expect(context.searchResults.map((result) => result.url)).toEqual(
        expect.arrayContaining([
          "/docs/shared-runbook",
          "https://remote.example/docs/shared-runbook",
        ]),
      );
      expect(context.results.map((result) => result.url)).toContain(
        "https://remote.example/docs/shared-runbook",
      );
      expect(context.context).toContain("Local agent indigo procedure.");
      expect(context.context).toContain("Remote agent orchid procedure.");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
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
    expect(context.results[0]?.contextContent).toContain("Server plugin setup.");
    expect(context.results[0]?.contextContent).not.toContain("Client plugin setup.");
    expect(context.results[1]?.contextContent).toContain("Client plugin setup.");
  });

  it("skips anchored search hits that do not resolve instead of hydrating the whole page", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Authentication",
          url: "/docs/authentication",
          content: "Sensitive whole-page fallback content.",
          rawContent: `# Authentication

Sensitive whole-page fallback content.
`,
        },
      ],
      query: "external-only-needle",
      search: createCustomSearchAdapter({
        name: "stale-anchor",
        async search() {
          return [
            {
              id: "stale-anchor",
              url: "/docs/authentication#removed-section",
              content: "Authentication — Removed section",
              type: "heading",
              section: "Removed section",
            },
          ];
        },
      }),
    });

    expect(context.searchResults).toEqual([]);
    expect(context.results).toEqual([]);
    expect(context.context).not.toContain("Sensitive whole-page fallback content.");
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

    const results = await adapter.search({ query: "install", limit: 5, audience: "agent" }, {
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
    expect(
      JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[1]?.body)),
    ).not.toHaveProperty("params.arguments.audience");
  });

  it("fails direct MCP searches closed when the default human audience cannot be forwarded", async () => {
    const adapter = createMcpSearchAdapter({
      provider: "mcp",
      endpoint: "https://docs.example.com/api/docs/mcp",
    });

    await expect(
      adapter.search({ query: "install", limit: 5 }, {
        pages: [],
        documents: [],
      } as DocsSearchAdapterContext),
    ).rejects.toThrow(
      "MCP human-projection search requires forwardAudience: true on an audience-aware tool.",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("forwards human for direct MCP searches that omit audience", async () => {
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
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: { content: [{ type: "text", text: JSON.stringify({ results: [] }) }] },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const adapter = createMcpSearchAdapter({
      provider: "mcp",
      endpoint: "https://docs.example.com/api/docs/mcp",
      forwardAudience: true,
    });

    await adapter.search({ query: "install", limit: 5 }, {
      pages: [],
      documents: [],
    } as DocsSearchAdapterContext);

    expect(JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[1]?.body))).toMatchObject({
      params: { arguments: { audience: "human" } },
    });
  });

  it("attempts independently bounded MCP session cleanup after caller abort", async () => {
    vi.useFakeTimers();
    try {
      const callerController = new AbortController();
      let cleanupSignal: AbortSignal | undefined;
      let resolveCleanupStarted!: () => void;
      const cleanupStarted = new Promise<void>((resolve) => {
        resolveCleanupStarted = resolve;
      });

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
                "mcp-session-id": "session-timeout",
              },
            },
          ),
        )
        .mockImplementationOnce(async (_input, init) => {
          expect(init?.signal).toBe(callerController.signal);
          callerController.abort(new Error("search timed out"));
          throw callerController.signal.reason;
        })
        .mockImplementationOnce((_input, init) => {
          cleanupSignal = init?.signal as AbortSignal;
          resolveCleanupStarted();
          return new Promise<Response>((_resolve, reject) => {
            cleanupSignal?.addEventListener("abort", () => reject(cleanupSignal?.reason), {
              once: true,
            });
          });
        });

      const adapter = createMcpSearchAdapter({
        provider: "mcp",
        endpoint: "https://docs.example.com/api/docs/mcp",
      });
      const request = adapter.search({ query: "install", limit: 5, audience: "agent" }, {
        pages: [],
        documents: [],
        signal: callerController.signal,
      } as DocsSearchAdapterContext);
      const rejection = expect(request).rejects.toThrow("search timed out");

      await cleanupStarted;
      const cleanupCall = vi.mocked(globalThis.fetch).mock.calls[2];
      expect(cleanupCall?.[1]?.method).toBe("DELETE");
      expect(cleanupSignal).not.toBe(callerController.signal);
      expect(cleanupSignal?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1_000);
      await rejection;
      expect(cleanupSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

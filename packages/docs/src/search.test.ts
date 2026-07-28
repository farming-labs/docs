import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocsSearchAdapterContext, DocsSearchResult } from "./types.js";
import {
  buildDocsAskAIContext,
  buildDocsRetrievalDigestProjection,
  buildDocsSearchDocuments,
  createAlgoliaSearchAdapter,
  createCustomSearchAdapter,
  createMcpSearchAdapter,
  createTypesenseSearchAdapter,
  enrichDocsSearchDocumentsWithProvenance,
  normalizeDocsSearchFilters,
  performDocsSearch,
  performDocsSearchWithMetadata,
  resolveDocsSearchAudience,
  resolveDocsSearchRequest,
  resolveSearchRequestConfig,
} from "./search.js";
import { digestDocsRetrievalContent } from "./retrieval-digest.js";

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

  it("uses the locale-qualified URL for page and section document identities", () => {
    const documents = buildDocsSearchDocuments([
      {
        ...pages[0],
        locale: "pt_BR",
      },
    ]);

    expect(documents.map((document) => document.id)).toEqual([
      "/docs/installation?lang=pt_BR#page",
      "/docs/installation?lang=pt_BR#section-0",
      "/docs/installation?lang=pt_BR#section-1",
    ]);
    expect(documents.find((document) => document.section === "Quickstart")?.url).toBe(
      "/docs/installation?lang=pt_BR#quickstart",
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

  it("uses canonical Unicode, explicit, and collision-safe heading anchors", () => {
    const documents = buildDocsSearchDocuments([
      {
        title: "Anchor guide",
        url: "/docs/anchors",
        content: "Canonical anchor guidance.",
        rawContent: `# Café 配置

## Overview [#release-overview]

## Repeat

First.

## Repeat

Second.

## Foo

## Foo

## Foo-1
`,
      },
    ]);

    expect(
      documents.filter((document) => document.type === "heading").map((document) => document.url),
    ).toEqual([
      "/docs/anchors#caf%C3%A9-%E9%85%8D%E7%BD%AE",
      "/docs/anchors#release-overview",
      "/docs/anchors#repeat",
      "/docs/anchors#repeat-1",
      "/docs/anchors#foo",
      "/docs/anchors#foo-1",
      "/docs/anchors#foo-1-1",
    ]);
  });

  it("keeps reserved explicit anchors distinct and URL-safe", () => {
    const documents = buildDocsSearchDocuments([
      {
        title: "Reserved anchors",
        url: "/docs/reserved",
        content: "Reserved anchor guidance.",
        rawContent: [
          "## Hash [#foo#bar]",
          "",
          "Hash content.",
          "",
          "## Percent [#foo%23bar]",
          "",
          "Percent content.",
        ].join("\n"),
      },
    ]);

    expect(
      documents.filter((document) => document.type === "heading").map((document) => document.url),
    ).toEqual(["/docs/reserved#foo%23bar", "/docs/reserved#foo%2523bar"]);
  });

  it("keeps authored DOM anchors ahead of generated contract-only headings", () => {
    const documents = buildDocsSearchDocuments(
      [
        {
          title: "Contract collision",
          url: "/docs/contract-collision",
          content: "Authored contract collision guidance.",
          rawContent: [
            "## Authored [#agent-contract]",
            "",
            "Authored collision marker.",
            "",
            "## Prerequisites",
            "",
            "Authored prerequisite collision marker.",
          ].join("\n"),
          agent: {
            task: "Run the generated contract task.",
            outcome: "The generated contract outcome is available.",
            prerequisites: ["Generated prerequisite collision marker."],
          },
        },
      ],
      {},
      "agent",
    );

    expect(
      documents
        .filter((document) => document.type === "heading")
        .map(({ id, section, url }) => ({ id, section, url })),
    ).toEqual([
      {
        id: "/docs/contract-collision#section-0",
        section: "Authored",
        url: "/docs/contract-collision#agent-contract",
      },
      {
        id: "/docs/contract-collision#section-1",
        section: "Prerequisites",
        url: "/docs/contract-collision#prerequisites",
      },
    ]);
  });

  it("keeps contract-marker examples in fences inert for agent section filtering", () => {
    const documents = buildDocsSearchDocuments(
      [
        {
          title: "Contract marker examples",
          url: "/docs/contract-marker-examples",
          content: "Explain contract marker examples.",
          rawContent: [
            "```md",
            "<!-- farming-labs:agent-contract:start -->",
            "```",
            "",
            "## Keep this section",
            "",
            "Authored retrieval guidance.",
            "",
            "<!-- farming-labs:agent-contract:end -->",
          ].join("\n"),
        },
      ],
      {},
      "agent",
    );

    expect(
      documents.filter((document) => document.type === "heading").map((document) => document.url),
    ).toContain("/docs/contract-marker-examples#keep-this-section");
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

  it("adds normalized page and contract scope metadata to search documents", () => {
    const [document] = buildDocsSearchDocuments(
      [
        {
          title: "Scoped setup",
          url: "/docs/scoped",
          content: "Configure setup.",
          framework: "Next.js",
          version: "v16",
          tags: ["Setup", "AUTH"],
          agent: {
            appliesTo: {
              framework: "next",
              version: ">=16 <18",
              package: ["@FARMING-LABS/NEXT", "@farming-labs/docs"],
            },
          },
        },
      ],
      { strategy: "page" },
    );

    expect(document).toMatchObject({
      framework: "nextjs",
      version: "16",
      package: ["@farming-labs/next", "@farming-labs/docs"],
      tags: ["setup", "auth"],
    });
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

  it("normalizes bounded scalar, repeated, and comma-separated scope filters", () => {
    const params = new URLSearchParams();
    params.append("framework", "Next.js, astro");
    params.append("framework", "next");
    params.append("version", "v16, >=17");
    params.append("package", "@FARMING-LABS/NEXT");
    for (let index = 0; index < 20; index += 1) params.append("tags", `Tag-${index}`);
    params.set("response", "structured");

    expect(resolveDocsSearchRequest(params)).toEqual({
      structured: true,
      filters: {
        framework: ["nextjs", "astro"],
        version: ["16", ">=17"],
        package: ["@farming-labs/next"],
        tags: Array.from({ length: 16 }, (_, index) => `tag-${index}`),
      },
    });
    expect(
      normalizeDocsSearchFilters({
        framework: ["SvelteKit", "svelte"],
        package: `Example/${"X".repeat(200)}`,
      }),
    ).toEqual({
      framework: ["sveltekit"],
      package: [`example/${"x".repeat(120)}`],
    });
    expect(resolveDocsSearchRequest(new URLSearchParams("response=Structured")).structured).toBe(
      false,
    );
    expect(
      normalizeDocsSearchFilters({
        framework: `${"next,".repeat(10_000)}astro`,
      }),
    ).toEqual({ framework: ["nextjs"] });
  });

  it("applies OR within scope fields and AND across fields", async () => {
    const scopedPages = [
      {
        title: "Next install",
        url: "/docs/next",
        content: "Install the shared package.",
        framework: "Next.js",
        version: ">=16",
        tags: ["setup", "react"],
        agent: {
          appliesTo: {
            framework: ["next"],
            version: "<18",
            package: "@farming-labs/next",
          },
        },
      },
      {
        title: "Astro install",
        url: "/docs/astro",
        content: "Install the shared package.",
        framework: "astro",
        version: "5",
        tags: ["setup"],
        agent: { appliesTo: { package: "@farming-labs/astro" } },
      },
    ];

    const results = await performDocsSearch({
      pages: scopedPages,
      query: "install",
      filters: {
        framework: ["nuxt", "Next.js"],
        version: ["17", "20"],
        package: ["@farming-labs/next"],
        tags: ["guides", "react"],
      },
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.url.startsWith("/docs/next"))).toBe(true);
  });

  it("requires one requested version to satisfy every nonempty declaration", async () => {
    const intersectionPage = {
      title: "Versioned install",
      url: "/docs/versioned",
      content: "Install the versioned package.",
      version: ">=16",
      agent: { appliesTo: { version: "<18" } },
    };

    expect(
      await performDocsSearch({
        pages: [intersectionPage],
        query: "install",
        filters: { version: "17" },
      }),
    ).not.toHaveLength(0);
    expect(
      await performDocsSearch({
        pages: [intersectionPage],
        query: "install",
        filters: { version: "20" },
      }),
    ).toEqual([]);
  });

  it("requires one shared version across all alternative version declarations", async () => {
    const intersectionPage = {
      title: "Version alternatives",
      url: "/docs/version-alternatives",
      content: "Install the versioned package.",
      version: "1 || 3",
      agent: { appliesTo: { version: ["2", "3"] } },
    };

    expect(
      await performDocsSearch({
        pages: [intersectionPage],
        query: "install",
        filters: { version: ">=1 <3" },
      }),
    ).toEqual([]);
    expect(
      await performDocsSearch({
        pages: [intersectionPage],
        query: "install",
        filters: { version: "3" },
      }),
    ).not.toHaveLength(0);
  });

  it("forwards normalized filters and only scoped documents to custom adapters", async () => {
    const seen: Array<{ query: unknown; urls: string[] }> = [];
    await performDocsSearch({
      pages: [
        {
          title: "Next guide",
          url: "/docs/next",
          content: "Shared guide token.",
          framework: "nextjs",
          agent: { appliesTo: { package: "@farming-labs/next" } },
        },
        {
          title: "Astro guide",
          url: "/docs/astro",
          content: "Shared guide token.",
          framework: "astro",
          agent: { appliesTo: { package: "@farming-labs/astro" } },
        },
      ],
      query: "guide",
      filters: { framework: "Next.js", package: "@FARMING-LABS/NEXT" },
      search: createCustomSearchAdapter({
        name: "scoped-custom",
        async search(query, context) {
          seen.push({
            query,
            urls: context.pages.map((page) => page.url),
          });
          return [];
        },
      }),
    });

    expect(seen[0]).toMatchObject({
      query: {
        filters: {
          framework: ["nextjs"],
          package: ["@farming-labs/next"],
        },
      },
      urls: ["/docs/next"],
    });
  });

  it("does not leak stale local provider hits outside the requested scope", async () => {
    const results = await performDocsSearch({
      pages: [
        {
          title: "Next shared guide",
          url: "/docs/next",
          content: "Configure the shared token.",
          framework: "nextjs",
        },
        {
          title: "Astro shared guide",
          url: "/docs/astro",
          content: "Configure the shared token.",
          framework: "astro",
        },
      ],
      query: "shared token",
      filters: { framework: "next" },
      search: createCustomSearchAdapter({
        name: "stale-scope-index",
        async search() {
          return [
            {
              id: "stale-astro",
              url: "/docs/astro",
              content: "Astro shared guide",
              description: "Configure the shared token.",
              type: "page",
            },
          ];
        },
      }),
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.url.startsWith("/docs/next"))).toBe(true);
    expect(results.some((result) => result.id === "stale-astro")).toBe(false);
  });

  it("returns bounded structured warnings without changing legacy array results", async () => {
    const scopedPages = [
      {
        title: "Next setup",
        url: "/docs/next",
        content: "Configure shared setup.",
        framework: "nextjs",
        version: "16",
        agent: { appliesTo: { package: "@farming-labs/next" } },
      },
      {
        title: "Astro setup",
        url: "/docs/astro",
        content: "Configure shared setup.",
        framework: "astro",
        version: "5",
        agent: { appliesTo: { package: "@farming-labs/astro" } },
      },
      {
        title: "Shared setup",
        url: "/docs/aaa-missing-scope",
        content: "Configure shared setup without declared scope.",
      },
    ];

    const legacy = await performDocsSearch({ pages: scopedPages, query: "configure" });
    const structured = await performDocsSearchWithMetadata({
      pages: scopedPages,
      query: "configure",
    });

    expect(Array.isArray(legacy)).toBe(true);
    expect(structured).toMatchObject({
      format: "docs-search.v1",
      query: "configure",
      audience: "human",
      filters: {},
      resultCount: legacy.length,
      results: legacy,
    });
    expect(structured.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ambiguous_scope", field: "framework" }),
        expect.objectContaining({ code: "ambiguous_scope", field: "version" }),
        expect.objectContaining({ code: "ambiguous_scope", field: "package" }),
      ]),
    );
    expect(structured.warnings.length).toBeLessThanOrEqual(16);
    for (const field of ["framework", "version", "package"] as const) {
      const warning = structured.warnings.find(
        (item) => item.code === "ambiguous_scope" && item.field === field,
      );
      expect(warning?.pageUrls).not.toContain("/docs/aaa-missing-scope");
    }
  });

  it("attaches canonical, scoped provenance to simple and structured search results", async () => {
    const provenancePages = [
      {
        title: "Provenance install",
        url: "/docs/provenance-install",
        canonicalUrl: "/guides/provenance-install",
        description: "Install the provenance-aware package.",
        content: "Install the provenance-aware package with the cobalt marker.",
        rawContent: `# Provenance install

Install the provenance-aware package.

## Quick start

Run the cobalt provenance marker.
`,
        locale: "en-US",
        framework: "Next.js",
        version: "v16",
        tags: ["Setup", "AUTH"],
        lastModified: "2026-07-27T12:34:56.000Z",
        agent: {
          appliesTo: {
            framework: "next",
            version: "16",
            package: "@FARMING-LABS/NEXT",
          },
        },
      },
    ];
    const options = {
      pages: provenancePages,
      query: "cobalt provenance marker",
      baseUrl: "https://docs.example.com/api/docs/search",
    };

    const legacy = await performDocsSearch(options);
    const structured = await performDocsSearchWithMetadata(options);
    const legacySection = legacy.find((result) => result.section === "Quick start");
    const structuredSection = structured.results.find((result) => result.section === "Quick start");

    expect(legacySection?.source).toMatchObject({
      canonicalUrl: "https://docs.example.com/guides/provenance-install#quick-start",
      scope: {
        audience: "human",
        locale: ["en-us"],
        framework: ["nextjs"],
        version: ["16"],
        package: ["@farming-labs/next"],
        tags: ["auth", "setup"],
      },
      lastModified: "2026-07-27T12:34:56.000Z",
    });
    expect(legacySection?.source?.digest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(legacySection?.source?.indexGeneration).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(structured.indexGeneration).toBe(legacySection?.source?.indexGeneration);
    expect(structuredSection?.source).toEqual(legacySection?.source);
  });

  it("returns reproducible digests for human and explicit agent source projections", async () => {
    const page = {
      title: "Reproducible provenance",
      url: "/docs/reproducible-provenance",
      content: "Human vermilion retrieval marker.",
      rawContent: "# Reproducible provenance\n\nHuman vermilion retrieval marker.",
      agentContent: "Agent cerulean retrieval marker.",
      agentRawContent: "# Reproducible provenance\n\nAgent cerulean retrieval marker.",
      lastModified: "2026-07-20T10:00:00.000Z",
      agentLastModified: "2026-07-19T09:00:00.000Z",
      agent: {
        task: "Verify the selected retrieval projection.",
        outcome: "The projection digest matches.",
      },
    };
    const [humanResult] = await performDocsSearch({
      pages: [page],
      query: "human vermilion",
      audience: "human",
    });
    const [agentResult] = await performDocsSearch({
      pages: [page],
      query: "agent cerulean",
      audience: "agent",
    });

    expect(humanResult?.source?.digest).toBe(
      digestDocsRetrievalContent(buildDocsRetrievalDigestProjection(page, "human")),
    );
    expect(agentResult?.source?.digest).toBe(
      digestDocsRetrievalContent(buildDocsRetrievalDigestProjection(page, "agent")),
    );
    expect(agentResult?.source?.digest).not.toBe(humanResult?.source?.digest);
    expect(agentResult?.source?.lastModified).toBe("2026-07-20T10:00:00.000Z");
  });

  it("normalizes provenance locale scope without changing its addressable locale query", async () => {
    const [result] = await performDocsSearch({
      pages: [
        {
          title: "Localized provenance",
          url: "/docs/localized-provenance",
          content: "Localized provenance marker.",
          locale: "pt_BR",
        },
      ],
      query: "localized provenance marker",
      baseUrl: "https://docs.example.com",
    });

    expect(result?.source).toMatchObject({
      canonicalUrl: "https://docs.example.com/docs/localized-provenance?lang=pt_BR",
      scope: { audience: "human", locale: ["pt-br"] },
    });
  });

  it("keeps index generations stable across request noise and changes them with index semantics", async () => {
    const alphaPage = {
      title: "Alpha provenance",
      url: "/docs/alpha-provenance",
      content: "Alpha provenance marker.",
      rawContent: "# Alpha provenance\n\nAlpha provenance marker.",
      framework: "nextjs",
    };
    const betaPage = {
      title: "Beta provenance",
      url: "/docs/beta-provenance",
      content: "Beta provenance marker.",
      rawContent: "# Beta provenance\n\nBeta provenance marker.",
      framework: "astro",
    };
    const baseline = await performDocsSearchWithMetadata({
      pages: [alphaPage, betaPage],
      query: "alpha",
      baseUrl: "https://docs.example.com/api/docs/search",
    });
    const reordered = await performDocsSearchWithMetadata({
      pages: [betaPage, alphaPage],
      query: "beta",
      baseUrl: "https://docs.example.com/api/docs/search",
    });
    const previewHost = await performDocsSearchWithMetadata({
      pages: [alphaPage, betaPage],
      query: "unmatched request text",
      baseUrl: "https://preview.example.net/other/base",
    });
    const changedContent = await performDocsSearchWithMetadata({
      pages: [
        {
          ...alphaPage,
          content: "Alpha provenance marker with changed content.",
          rawContent: "# Alpha provenance\n\nAlpha provenance marker with changed content.",
        },
        betaPage,
      ],
      query: "alpha",
    });
    const changedScope = await performDocsSearchWithMetadata({
      pages: [{ ...alphaPage, framework: "nuxt" }, betaPage],
      query: "alpha",
    });
    const changedFilesystemTime = await performDocsSearchWithMetadata({
      pages: [{ ...alphaPage, lastModified: "2026-07-28T00:00:00.000Z" }, betaPage],
      query: "alpha",
    });
    const changedAuthoredTime = await performDocsSearchWithMetadata({
      pages: [{ ...alphaPage, lastmod: "2026-07-28" }, betaPage],
      query: "alpha",
    });
    const changedAgentContract = await performDocsSearchWithMetadata({
      pages: [
        {
          ...alphaPage,
          agent: {
            task: "Configure the contract-only retrieval marker.",
            outcome: "The contract marker is indexed.",
          },
        },
        betaPage,
      ],
      query: "alpha",
    });
    const agentAudience = await performDocsSearchWithMetadata({
      pages: [alphaPage, betaPage],
      query: "alpha",
      audience: "agent",
    });
    const pageChunking = await performDocsSearchWithMetadata({
      pages: [alphaPage, betaPage],
      query: "alpha",
      search: { provider: "simple", chunking: { strategy: "page" } },
    });

    expect(baseline.indexGeneration).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(reordered.indexGeneration).toBe(baseline.indexGeneration);
    expect(previewHost.indexGeneration).toBe(baseline.indexGeneration);
    expect(changedContent.indexGeneration).not.toBe(baseline.indexGeneration);
    expect(changedScope.indexGeneration).not.toBe(baseline.indexGeneration);
    expect(changedFilesystemTime.indexGeneration).toBe(baseline.indexGeneration);
    expect(changedAuthoredTime.indexGeneration).not.toBe(baseline.indexGeneration);
    expect(changedAgentContract.indexGeneration).not.toBe(baseline.indexGeneration);
    expect(agentAudience.indexGeneration).not.toBe(baseline.indexGeneration);
    expect(pageChunking.indexGeneration).not.toBe(baseline.indexGeneration);
  });

  it("returns a structured generation for blank queries without invoking the provider", async () => {
    const providerSearch = vi.fn(async () => {
      throw new Error("Blank structured queries must not reach the provider.");
    });

    const structured = await performDocsSearchWithMetadata({
      pages: [
        {
          title: "Blank query provenance",
          url: "/docs/blank-query-provenance",
          content: "Blank query provenance marker.",
        },
      ],
      query: " \n ",
      search: createCustomSearchAdapter({
        name: "blank-query-provenance-provider",
        search: providerSearch,
      }),
    });

    expect(providerSearch).not.toHaveBeenCalled();
    expect(structured).toMatchObject({
      query: " \n ",
      resultCount: 0,
      results: [],
    });
    expect(structured.indexGeneration).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("drops malformed provenance returned by a custom provider", async () => {
    const malformedResult = {
      id: "malformed-provenance",
      url: "https://remote.example/docs/install",
      content: "Remote installation result",
      type: "page",
      source: {
        canonicalUrl: "javascript:alert(1)",
        scope: { audience: "human" },
        digest: "sha256:aaaaaaaa",
        indexGeneration: "sha256:bbbbbbbb",
      },
    } as unknown as DocsSearchResult;

    const results = await performDocsSearch({
      pages: [],
      query: "installation",
      baseUrl: "https://docs.example.com",
      supplementExternalResults: false,
      search: createCustomSearchAdapter({
        name: "malformed-provenance-provider",
        async search() {
          return [malformedResult];
        },
      }),
    });

    expect(results).toEqual([]);
  });

  it.each([
    { framework: "nextjs" },
    { tags: Array.from({ length: 17 }, (_, index) => `tag-${index}`) },
    { locale: [123] },
    { versionGroups: [["16"], "17"] },
    { truncated: ["framework", "unknown"] },
    { conflicts: ["framework", "version", "package", "tags", "framework"] },
  ])("fails closed for malformed or oversized source scope %#", async (scope) => {
    const results = await performDocsSearch({
      pages: [],
      query: "installation",
      baseUrl: "https://docs.example.com",
      supplementExternalResults: false,
      search: createCustomSearchAdapter({
        name: "malformed-scope-provider",
        async search() {
          return [
            {
              id: "malformed-scope",
              url: "https://remote.example/docs/install",
              content: "Remote installation result",
              type: "page",
              source: {
                canonicalUrl: "https://remote.example/docs/install",
                scope: { audience: "human", ...scope },
                digest: `sha256:${"a".repeat(64)}`,
                indexGeneration: `sha256:${"b".repeat(64)}`,
              },
            } as DocsSearchResult,
          ];
        },
      }),
    });

    expect(results).toEqual([]);
  });

  it("rejects foreign results whose valid provenance targets another audience", async () => {
    const source = {
      canonicalUrl: "https://remote.example/docs/install",
      scope: { audience: "agent" as const, framework: ["nextjs"] },
      digest: `sha256:${"a".repeat(64)}`,
      indexGeneration: `sha256:${"b".repeat(64)}`,
    };
    const results = await performDocsSearch({
      pages: [],
      query: "installation",
      audience: "human",
      baseUrl: "https://docs.example.com",
      supplementExternalResults: false,
      search: createCustomSearchAdapter({
        name: "cross-audience-provenance-provider",
        async search() {
          return [
            {
              id: "cross-audience-provenance",
              url: source.canonicalUrl,
              content: "Agent-only installation result",
              type: "page",
              source,
            },
          ];
        },
      }),
    });

    expect(results).toEqual([]);
  });

  it("rejects filtered foreign results whose relevant provenance scope was truncated", async () => {
    const results = await performDocsSearch({
      pages: [],
      query: "installation",
      filters: { framework: "nextjs" },
      baseUrl: "https://docs.example.com",
      supplementExternalResults: false,
      search: createCustomSearchAdapter({
        name: "truncated-scope-provider",
        async search() {
          return [
            {
              id: "truncated-scope",
              url: "https://remote.example/docs/install",
              content: "Remote installation result",
              type: "page",
              source: {
                canonicalUrl: "https://remote.example/docs/install",
                scope: {
                  audience: "human",
                  framework: ["nextjs"],
                  truncated: ["framework"],
                },
                digest: `sha256:${"a".repeat(64)}`,
                indexGeneration: `sha256:${"b".repeat(64)}`,
              },
            },
          ];
        },
      }),
    });

    expect(results).toEqual([]);
  });

  it("reports and excludes unknown, missing, and conflicting scope metadata", async () => {
    const structured = await performDocsSearchWithMetadata({
      pages: [
        {
          title: "Missing scope",
          url: "/docs/missing",
          content: "Configure scope.",
        },
        {
          title: "Conflicting scope",
          url: "/docs/conflict",
          content: "Configure scope.",
          framework: "nextjs",
          agent: { appliesTo: { framework: "astro" } },
        },
        {
          title: "Unrelated missing scope",
          url: "/docs/unrelated",
          content: "Observe the turquoise migration token.",
        },
      ],
      query: "configure",
      filters: { framework: "nuxt" },
    });

    expect(structured.results).toEqual([]);
    expect(structured.filters).toEqual({ framework: ["nuxt"] });
    expect(structured.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unknown_filter_value",
          field: "framework",
          values: ["nuxt"],
        }),
        expect.objectContaining({
          code: "missing_scope_metadata",
          field: "framework",
          pageUrls: ["/docs/missing"],
          count: 1,
        }),
        expect.objectContaining({
          code: "conflicting_scope_metadata",
          field: "framework",
          pageUrls: ["/docs/conflict"],
        }),
      ]),
    );
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
            framework: "nextjs",
            content: "Human coral walkthrough.",
            rawContent: "# Audience sync\n\nHuman coral walkthrough.",
            agentFallbackContent: "Agent indigo procedure.",
            agentFallbackRawContent: "# Audience sync\n\nAgent indigo procedure.",
          },
          {
            title: "Out-of-scope sync",
            url: "/docs/out-of-scope-sync",
            framework: "astro",
            content: "Human amber walkthrough.",
            rawContent: "# Out-of-scope sync\n\nHuman amber walkthrough.",
            agentFallbackContent: "Agent violet procedure.",
            agentFallbackRawContent: "# Out-of-scope sync\n\nAgent violet procedure.",
          },
        ],
        query: "indigo procedure",
        audience: "agent",
        filters: { framework: "next" },
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
      expect(indexedContent).toContain("Human amber walkthrough");
      expect(indexedContent).not.toContain("Agent indigo procedure");
      expect(indexedContent).not.toContain("Agent violet procedure");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });

  it("starts provider search before building local documents and skips unused sync projections", async () => {
    let adapterStarted = false;
    let agentProjectionReads = 0;
    let humanProjectionReads = 0;
    let projectedAfterAdapterStarted = false;
    const sourcePages = [
      {
        title: "Lazy agent search",
        url: "/docs/lazy-agent-search",
        content: "Human coral walkthrough.",
        get rawContent() {
          humanProjectionReads += 1;
          return "# Lazy agent search\n\nHuman coral walkthrough.";
        },
        get agentRawContent() {
          agentProjectionReads += 1;
          projectedAfterAdapterStarted ||= adapterStarted;
          return "# Lazy agent search\n\nAgent indigo procedure.";
        },
      },
    ];

    const results = await performDocsSearch({
      pages: sourcePages,
      query: "agent indigo procedure",
      audience: "agent",
      search: createCustomSearchAdapter({
        name: "lazy-provider",
        async search() {
          adapterStarted = true;
          return [];
        },
      }),
    });

    expect(adapterStarted).toBe(true);
    expect(projectedAfterAdapterStarted).toBe(true);
    expect(agentProjectionReads).toBeGreaterThan(0);
    expect(humanProjectionReads).toBe(0);
    expect(results[0]?.url).toBe("/docs/lazy-agent-search");
  });

  it("preserves writable adapter document contexts while materializing lazily", async () => {
    const replacementDocuments = buildDocsSearchDocuments([
      {
        title: "Adapter replacement",
        url: "/docs/adapter-replacement",
        content: "Replacement indigo procedure.",
        rawContent: "# Adapter replacement\n\nReplacement indigo procedure.",
      },
    ]);

    const results = await performDocsSearch({
      pages: [
        {
          title: "Unread source",
          url: "/docs/unread-source",
          content: "Unread source content.",
          get rawContent(): string {
            throw new Error("The replaced document context should not be materialized.");
          },
        },
      ],
      query: "replacement indigo procedure",
      search: createCustomSearchAdapter({
        name: "document-replacement-provider",
        search(_query, context) {
          context.documents = replacementDocuments;
          return Promise.resolve([]);
        },
      }),
    });

    expect(results[0]?.url).toBe("/docs/adapter-replacement");
  });

  it("observes an in-flight provider rejection when local projection fails", async () => {
    let rejectProvider: ((reason?: unknown) => void) | undefined;
    const providerSearch = new Promise<never>((_resolve, reject) => {
      rejectProvider = reject;
    });
    const catchSpy = vi.spyOn(providerSearch, "catch");

    await expect(
      performDocsSearch({
        pages: [
          {
            title: "Broken projection",
            url: "/docs/broken-projection",
            content: "Broken projection content.",
            get rawContent(): string {
              throw new Error("Local projection failed.");
            },
          },
        ],
        query: "broken projection",
        failureMode: "throw",
        search: createCustomSearchAdapter({
          name: "rejecting-provider",
          search() {
            return providerSearch;
          },
        }),
      }),
    ).rejects.toThrow("Local projection failed.");

    expect(catchSpy).toHaveBeenCalledOnce();
    rejectProvider?.(new Error("Provider failed after local projection."));
    await Promise.resolve();
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

  it("round-trips helper-generated relative provenance through a custom adapter", async () => {
    const search = await performDocsSearch({
      pages,
      query: "install",
      supplementExternalResults: false,
      search: createCustomSearchAdapter({
        name: "provenance-aware-custom",
        async search(_query, context) {
          const [document] = await enrichDocsSearchDocumentsWithProvenance({
            documents: context.documents,
            pages: context.pages,
            audience: context.audience,
            chunking: context.chunking,
          });
          if (!document) return [];
          return [
            {
              id: document.id,
              url: document.url,
              content: document.title,
              type: document.type,
              source: document.source,
            },
          ];
        },
      }),
    });

    expect(search[0]?.source).toMatchObject({
      canonicalUrl: "/docs/installation",
      scope: { audience: "human" },
      digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      indexGeneration: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
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

  it("keeps case-sensitive custom section anchors distinct", async () => {
    const context = await buildDocsAskAIContext({
      pages: [
        {
          title: "Case-sensitive anchors",
          url: "/docs/case-sensitive",
          content: "Case-sensitive anchor guidance.",
          rawContent: [
            "## Upper [#Foo]",
            "",
            "Shared case-sensitive marker for the uppercase section.",
            "",
            "## Lower [#foo]",
            "",
            "Shared case-sensitive marker for the lowercase section.",
          ].join("\n"),
        },
      ],
      query: "shared case-sensitive marker",
      limit: 5,
    });

    expect(context.results.map((result) => result.url)).toEqual(
      expect.arrayContaining(["/docs/case-sensitive#Foo", "/docs/case-sensitive#foo"]),
    );
    expect(context.context).toContain("uppercase section");
    expect(context.context).toContain("lowercase section");
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
    expect(context.context).toContain(
      "Canonical URL: https://docs.example.com/docs/customize#available-themes",
    );
    expect(context.context).toMatch(/Source digest: sha256:[a-f0-9]{64}/u);
    expect(context.context).toMatch(/Index generation: sha256:[a-f0-9]{64}/u);
  });
});

describe("remote search adapters", () => {
  const originalFetch = globalThis.fetch;
  const sourceDigest = `sha256:${"a".repeat(64)}`;
  const sourceGeneration = `sha256:${"b".repeat(64)}`;

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
              source_canonical_url: "https://docs.example.com/docs/installation#quickstart",
              source_scope_audience: "human",
              source_scope_framework: ["nextjs"],
              source_last_modified: "2026-07-27T12:34:56.000Z",
              source_digest: sourceDigest,
              source_index_generation: sourceGeneration,
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
        source: {
          canonicalUrl: "https://docs.example.com/docs/installation#quickstart",
          scope: { audience: "human", framework: ["nextjs"] },
          lastModified: "2026-07-27T12:34:56.000Z",
          digest: sourceDigest,
          indexGeneration: sourceGeneration,
        },
      },
    ]);
  });

  it("rejects hosted hits with malformed nested provenance despite valid flattened fields", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            {
              objectID: "alg-mixed-source",
              url: "/docs/installation",
              title: "Installation",
              type: "page",
              source: { canonicalUrl: "javascript:alert(1)" },
              source_canonical_url: "https://docs.example.com/docs/installation",
              source_scope_audience: "human",
              source_digest: sourceDigest,
              source_index_generation: sourceGeneration,
            },
            {
              objectID: "alg-null-source",
              url: "/docs/null-source",
              title: "Null source",
              type: "page",
              source: null,
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

    await expect(
      adapter.search({ query: "install", limit: 5 }, {
        pages: [],
        documents: [],
      } as DocsSearchAdapterContext),
    ).resolves.toEqual([]);
  });

  it("filters Algolia before provider top-k using the locally scoped document ids", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ hits: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const adapter = createAlgoliaSearchAdapter({
      provider: "algolia",
      appId: "app-id",
      indexName: "docs",
      searchApiKey: "search-key",
    });

    await adapter.search(
      {
        query: "install",
        limit: 5,
        filters: { framework: ["nextjs"] },
      },
      {
        pages: [],
        documents: [
          {
            id: "/docs/next#page",
            url: "/docs/next",
            title: "Next",
            content: "Install Next.",
            type: "page",
          },
        ],
      } as DocsSearchAdapterContext,
    );

    const request = JSON.parse(
      String(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(request).toMatchObject({
      hitsPerPage: 5,
      restrictSearchableAttributes: ["title", "section", "content", "description"],
      filters: 'objectID:"/docs/next#page"',
    });
  });

  it("trims oversized Algolia records before syncing", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).endsWith("/batch")) {
        return new Response(JSON.stringify({ taskID: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "published" }), { status: 200 });
    });

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
          framework: "nextjs",
          version: "16",
          package: ["@farming-labs/next"],
          tags: ["setup"],
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
    expect(record).toMatchObject({
      framework: "nextjs",
      version: "16",
      package: ["@farming-labs/next"],
      tags: ["setup"],
    });
    expect(String(call?.[0])).toBe("https://app-id.algolia.net/1/indexes/docs/batch");
  });

  it("owns Algolia records with scoped ids and avoids unsafe cross-generation pruning", async () => {
    let indexedRecord: Record<string, unknown> | undefined;
    const operations: string[] = [];
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/batch")) {
        const payload = JSON.parse(String(init?.body)) as {
          requests: Array<{ action: string; body: Record<string, unknown> }>;
        };
        const action = payload.requests[0]?.action;
        operations.push(action ?? "empty");
        if (action === "addObject") indexedRecord = payload.requests[0]?.body;
        return new Response(JSON.stringify({ taskID: action === "addObject" ? 1 : 2 }), {
          status: 200,
        });
      }
      if (url.includes("/task/")) {
        return new Response(JSON.stringify({ status: "published" }), { status: 200 });
      }
      if (url.endsWith("/query")) {
        return new Response(JSON.stringify({ hits: [indexedRecord] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected Algolia request: ${url}`);
    });

    const adapter = createAlgoliaSearchAdapter({
      provider: "algolia",
      appId: "owned-app",
      indexName: "owned-index",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
      syncNamespace: "site-a",
    });
    const context = {
      pages,
      documents: buildDocsSearchDocuments(pages),
      audience: "human" as const,
      baseUrl: "https://docs.example.com",
      indexBaseUrl: "https://docs.example.com",
      chunking: { strategy: "section" as const },
    };

    await adapter.index?.(context);

    expect(indexedRecord?.objectID).toMatch(/^docs_[a-f0-9]{64}$/u);
    expect(indexedRecord).toMatchObject({
      id: indexedRecord?.objectID,
      source_document_id: "/docs/installation#page",
      _tags: [indexedRecord?.source_corpus_id],
    });
    expect(indexedRecord?.source_corpus_id).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(operations).toEqual(["addObject"]);
    expect(
      vi.mocked(globalThis.fetch).mock.calls.some(([input]) => String(input).endsWith("/browse")),
    ).toBe(false);

    const results = await adapter.search({ query: "install", limit: 5 }, context);
    const queryCall = vi
      .mocked(globalThis.fetch)
      .mock.calls.find(([input]) => String(input).endsWith("/query"));
    const queryBody = JSON.parse(String(queryCall?.[1]?.body)) as {
      filters?: string;
    };
    expect(queryBody.filters).toBe(`_tags:"${String(indexedRecord?.source_corpus_id)}"`);
    expect(results[0]?.id).toBe("/docs/installation#page");
  });

  it("uses the current human hosted generation only as a ranking hint for agent output", async () => {
    let pageRecord: Record<string, unknown> | undefined;
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/batch")) {
        const payload = JSON.parse(String(init?.body)) as {
          requests: Array<{ action: string; body: Record<string, unknown> }>;
        };
        if (payload.requests[0]?.action === "addObject") {
          pageRecord = payload.requests
            .map((request) => request.body)
            .find((record) => record.source_document_id === "/docs/audience-ranking#page");
        }
        return new Response(JSON.stringify({ taskID: 1 }), { status: 200 });
      }
      if (url.includes("/task/")) {
        return new Response(JSON.stringify({ status: "published" }), { status: 200 });
      }
      if (url.endsWith("/browse")) {
        return new Response(
          JSON.stringify({
            hits: pageRecord
              ? [
                  {
                    objectID: pageRecord.objectID,
                    source_corpus_id: pageRecord.source_corpus_id,
                  },
                ]
              : [],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/query")) {
        return new Response(
          JSON.stringify({
            hits: pageRecord
              ? [
                  {
                    ...pageRecord,
                    _snippetResult: {
                      content: { value: "Human-only semantic cobalt explanation." },
                    },
                  },
                ]
              : [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected Algolia request: ${url}`);
    });

    const results = await performDocsSearch({
      pages: [
        {
          title: "Audience ranking",
          url: "/docs/audience-ranking",
          content: "Human and agent guidance.",
          rawContent: `# Audience ranking

<Human>
Human-only semantic cobalt explanation.
</Human>

<Agent>
Agent-safe indigo procedure.
</Agent>
`,
        },
      ],
      query: "semantic cobalt",
      audience: "agent",
      baseUrl: "https://docs.example.com",
      syncBaseUrl: "https://docs.example.com",
      supplementExternalResults: false,
      search: {
        provider: "algolia",
        appId: "agent-ranking-app",
        indexName: "agent-ranking-index",
        searchApiKey: "search-key",
        adminApiKey: "admin-key",
        syncNamespace: "agent-ranking-site",
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "/docs/audience-ranking#page",
      url: "/docs/audience-ranking",
      content: "Audience ranking",
      source: {
        scope: { audience: "agent" },
      },
    });
    expect(results[0]?.description).toContain("Agent-safe indigo procedure");
    expect(results[0]?.description).not.toContain("Human-only");
  });

  it("uses local scope when a known hosted result has bounded provenance values", async () => {
    let indexedRecord: Record<string, unknown> | undefined;
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/batch")) {
        const payload = JSON.parse(String(init?.body)) as {
          requests: Array<{ action: string; body: Record<string, unknown> }>;
        };
        if (payload.requests[0]?.action === "addObject") {
          indexedRecord = payload.requests[0]?.body;
        }
        return Response.json({ taskID: 1 });
      }
      if (url.includes("/task/")) return Response.json({ status: "published" });
      if (url.endsWith("/browse")) {
        return Response.json({
          hits: indexedRecord
            ? [
                {
                  objectID: indexedRecord.objectID,
                  source_corpus_id: indexedRecord.source_corpus_id,
                },
              ]
            : [],
        });
      }
      if (url.endsWith("/query")) {
        return Response.json({ hits: indexedRecord ? [indexedRecord] : [] });
      }
      throw new Error(`Unexpected Algolia request: ${url}`);
    });
    const tags = Array.from({ length: 17 }, (_, index) => `tag-${String(index).padStart(2, "0")}`);

    const results = await performDocsSearch({
      pages: [
        {
          title: "Bounded provenance",
          url: "/docs/bounded-provenance",
          content: "Bounded provenance retrieval marker.",
          tags,
        },
      ],
      query: "bounded provenance",
      filters: { tags: "tag-16" },
      baseUrl: "https://docs.example.com",
      syncBaseUrl: "https://docs.example.com",
      supplementExternalResults: false,
      search: {
        provider: "algolia",
        appId: "bounded-scope-app",
        indexName: "bounded-scope-index",
        searchApiKey: "search-key",
        adminApiKey: "admin-key",
        syncNamespace: "bounded-scope-site",
        chunking: { strategy: "page" },
      },
    });

    expect(indexedRecord?.source_scope_tags).not.toContain("tag-16");
    expect(indexedRecord?.source_scope_truncated).toContain("tags");
    expect(results).toHaveLength(1);
    expect(results[0]?.source?.scope.truncated).toContain("tags");
  });

  it("uses source-less legacy local hits only as ranking hints", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            {
              objectID: "/docs/installation#page",
              url: "/docs/installation",
              title: "Installation",
              type: "page",
            },
            {
              objectID: "partial-provenance",
              url: "/docs/installation",
              title: "Partial installation",
              type: "page",
              source_canonical_url: "/docs/installation",
              source_scope_audience: "human",
              source_digest: `sha256:${"a".repeat(64)}`,
            },
            {
              objectID: "foreign-legacy",
              url: "https://foreign.example/docs/install",
              title: "Foreign installation",
              type: "page",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const results = await performDocsSearch({
      pages,
      query: "install",
      baseUrl: "https://docs.example.com",
      syncBaseUrl: "https://docs.example.com",
      supplementExternalResults: false,
      search: {
        provider: "algolia",
        appId: "legacy-hint-app",
        indexName: "legacy-hint-index",
        searchApiKey: "search-key",
        syncNamespace: "legacy-hint-site",
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "/docs/installation#page",
      url: "/docs/installation",
      source: { scope: { audience: "human" } },
    });
  });

  it("does not prune an owned Algolia corpus when discovery is empty", async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    const adapter = createAlgoliaSearchAdapter({
      provider: "algolia",
      appId: "empty-owned-app",
      indexName: "empty-owned-index",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
      syncNamespace: "empty-owned-site",
    });

    await adapter.index?.({
      pages: [],
      documents: [],
      audience: "human",
    } as DocsSearchAdapterContext);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-syncs Algolia only when the complete index generation changes", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).endsWith("/batch")) {
        return new Response(JSON.stringify({ taskID: 1 }), { status: 200 });
      }
      if (String(input).includes("/task/")) {
        return new Response(JSON.stringify({ status: "published" }), { status: 200 });
      }
      return new Response(JSON.stringify({ hits: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const search = {
      provider: "algolia" as const,
      appId: "provenance-generation-app",
      indexName: "provenance-generation-index",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
      syncOnSearch: true,
    };
    const originalPages = [
      {
        title: "Generation sync",
        url: "/docs/generation-sync",
        content: "First generation provenance marker.",
        rawContent: "# Generation sync\n\nFirst generation provenance marker.",
      },
    ];

    await performDocsSearch({
      pages: originalPages,
      query: "generation provenance",
      search,
      baseUrl: "https://docs.example.com",
    });
    await performDocsSearch({
      pages: originalPages,
      query: "different request",
      search,
      baseUrl: "https://docs.example.com",
    });
    await performDocsSearch({
      pages: [
        {
          ...originalPages[0],
          content: "Second generation provenance marker.",
          rawContent: "# Generation sync\n\nSecond generation provenance marker.",
        },
      ],
      query: "generation provenance",
      search,
      baseUrl: "https://docs.example.com",
    });

    const batchCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([input]) => String(input).endsWith("/batch"));
    const generations = batchCalls.map(([, init]) => {
      const payload = JSON.parse(String(init?.body)) as {
        requests: Array<{
          body: { source_canonical_url?: string; source_index_generation?: string };
        }>;
      };
      return payload.requests[0]?.body.source_index_generation;
    });

    expect(batchCalls).toHaveLength(2);
    expect(generations.every((generation) => /^sha256:[a-f0-9]{64}$/u.test(generation ?? ""))).toBe(
      true,
    );
    expect(new Set(generations).size).toBe(2);
    const firstBatch = JSON.parse(String(batchCalls[0]?.[1]?.body)) as {
      requests: Array<{ body: { source_canonical_url?: string } }>;
    };
    expect(firstBatch.requests[0]?.body.source_canonical_url).toBe(
      "https://docs.example.com/docs/generation-sync",
    );
  });

  it("keeps canonical hosted sync state isolated between sites in one process", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/batch")) {
        return Response.json({ taskID: 1 });
      }
      if (url.includes("/task/")) {
        return Response.json({ status: "published" });
      }
      return Response.json({ hits: [] });
    });
    const search = {
      provider: "algolia" as const,
      appId: "multi-site-sync-app",
      indexName: "multi-site-sync-index",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
      syncOnSearch: true,
    };
    const run = (baseUrl: string) =>
      performDocsSearch({
        pages,
        query: "install",
        search,
        baseUrl,
        syncBaseUrl: baseUrl,
      });

    await run("https://alpha.example.com");
    await run("https://beta.example.com");
    await run("https://alpha.example.com");

    const addBatches = vi.mocked(globalThis.fetch).mock.calls.filter(([, init]) => {
      if (!init?.body) return false;
      const body = JSON.parse(String(init.body)) as {
        requests?: Array<{ action?: string }>;
      };
      return body.requests?.[0]?.action === "addObject";
    });
    expect(addBatches).toHaveLength(2);
  });

  it("retries a failed generation sync instead of marking it complete", async () => {
    let failBatch = true;
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).endsWith("/batch")) {
        if (failBatch) return new Response("sync failed", { status: 500 });
        return new Response(JSON.stringify({ taskID: 1 }), { status: 200 });
      }
      if (String(input).includes("/task/")) {
        return new Response(JSON.stringify({ status: "published" }), { status: 200 });
      }
      return new Response(JSON.stringify({ hits: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const options = {
      pages: [
        {
          title: "Retry generation sync",
          url: "/docs/retry-generation-sync",
          content: "Retry generation provenance marker.",
          rawContent: "# Retry generation sync\n\nRetry generation provenance marker.",
        },
      ],
      query: "retry generation",
      failureMode: "throw" as const,
      search: {
        provider: "algolia" as const,
        appId: "provenance-retry-app",
        indexName: "provenance-retry-index",
        searchApiKey: "search-key",
        adminApiKey: "admin-key",
        syncOnSearch: true,
      },
    };

    await expect(performDocsSearch(options)).rejects.toThrow("Failed to sync documents to Algolia");
    failBatch = false;
    await expect(performDocsSearch(options)).resolves.not.toHaveLength(0);

    expect(
      vi.mocked(globalThis.fetch).mock.calls.filter(([input]) => String(input).endsWith("/batch")),
    ).toHaveLength(2);
  });

  it("serializes concurrent syncs for different generations of one hosted index", async () => {
    let releaseFirstSync: (() => void) | undefined;
    const firstSyncGate = new Promise<void>((resolve) => {
      releaseFirstSync = resolve;
    });
    let batchCalls = 0;
    let activeBatches = 0;
    let maxActiveBatches = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).endsWith("/batch")) {
        batchCalls += 1;
        activeBatches += 1;
        maxActiveBatches = Math.max(maxActiveBatches, activeBatches);
        if (batchCalls === 1) await firstSyncGate;
        activeBatches -= 1;
        return new Response(JSON.stringify({ taskID: batchCalls }), { status: 200 });
      }
      if (String(input).includes("/task/")) {
        return new Response(JSON.stringify({ status: "published" }), { status: 200 });
      }
      return new Response(JSON.stringify({ hits: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const search = {
      provider: "algolia" as const,
      appId: "provenance-concurrent-app",
      indexName: "provenance-concurrent-index",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
      syncOnSearch: true,
    };
    const basePage = {
      title: "Concurrent generation",
      url: "/docs/concurrent-generation",
      content: "First concurrent generation.",
      rawContent: "# Concurrent generation\n\nFirst concurrent generation.",
    };
    const firstSearch = performDocsSearch({
      pages: [basePage],
      query: "concurrent generation",
      search,
    });
    await vi.waitFor(() => expect(batchCalls).toBe(1));
    const secondSearch = performDocsSearch({
      pages: [
        {
          ...basePage,
          content: "Second concurrent generation.",
          rawContent: "# Concurrent generation\n\nSecond concurrent generation.",
        },
      ],
      query: "concurrent generation",
      search,
    });
    await Promise.resolve();

    expect(batchCalls).toBe(1);
    releaseFirstSync?.();
    await Promise.all([firstSearch, secondSearch]);

    expect(batchCalls).toBe(2);
    expect(maxActiveBatches).toBe(1);
  });

  it("re-syncs A after an in-flight B generation would otherwise overwrite it", async () => {
    let releaseGenerationB: (() => void) | undefined;
    const generationBGate = new Promise<void>((resolve) => {
      releaseGenerationB = resolve;
    });
    let batchCalls = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).endsWith("/batch")) {
        batchCalls += 1;
        if (batchCalls === 2) await generationBGate;
        return new Response(JSON.stringify({ taskID: batchCalls }), { status: 200 });
      }
      if (String(input).includes("/task/")) {
        return new Response(JSON.stringify({ status: "published" }), { status: 200 });
      }
      return new Response(JSON.stringify({ hits: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const search = {
      provider: "algolia" as const,
      appId: "provenance-aba-app",
      indexName: "provenance-aba-index",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
      syncOnSearch: true,
    };
    const generationA = {
      title: "A-B-A generation",
      url: "/docs/aba-generation",
      content: "Generation A.",
      rawContent: "# A-B-A generation\n\nGeneration A.",
    };
    const generationB = {
      ...generationA,
      content: "Generation B.",
      rawContent: "# A-B-A generation\n\nGeneration B.",
    };

    await performDocsSearch({ pages: [generationA], query: "generation", search });
    const searchB = performDocsSearch({ pages: [generationB], query: "generation", search });
    await vi.waitFor(() => expect(batchCalls).toBe(2));
    const finalSearchA = performDocsSearch({
      pages: [generationA],
      query: "generation",
      search,
    });
    await Promise.resolve();
    expect(batchCalls).toBe(2);

    releaseGenerationB?.();
    await Promise.all([searchB, finalSearchA]);
    expect(batchCalls).toBe(3);
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
                source_canonical_url: "https://docs.example.com/docs/installation#quickstart",
                source_scope_audience: "agent",
                source_scope_package: ["@farming-labs/docs"],
                source_digest: sourceDigest,
                source_index_generation: sourceGeneration,
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
        source: {
          canonicalUrl: "https://docs.example.com/docs/installation#quickstart",
          scope: { audience: "agent", package: ["@farming-labs/docs"] },
          digest: sourceDigest,
          indexGeneration: sourceGeneration,
        },
      },
    ]);
  });

  it("filters Typesense before provider top-k using the locally scoped document ids", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ results: [{ hits: [] }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const adapter = createTypesenseSearchAdapter({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
    });

    await adapter.search(
      {
        query: "install",
        limit: 5,
        filters: { framework: ["nextjs"] },
      },
      {
        pages: [],
        documents: [
          {
            id: "/docs/next#page",
            url: "/docs/next",
            title: "Next",
            content: "Install Next.",
            type: "page",
          },
        ],
      } as DocsSearchAdapterContext,
    );

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(String(url)).toBe("https://typesense.example.com/multi_search");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      searches: [
        expect.objectContaining({
          collection: "docs",
          q: "install",
          per_page: "5",
          filter_by: "id:=[`/docs/next#page`]",
        }),
      ],
    });
  });

  it("creates a Typesense collection without an invalid default sorting field", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/collections/docs") && !init?.method) {
        return new Response(null, { status: 404 });
      }
      if (url.endsWith("/collections") && init?.method === "POST") {
        return new Response("{}", { status: 201 });
      }
      const count = String(init?.body).split("\n").filter(Boolean).length;
      return new Response(
        Array.from({ length: count }, () => JSON.stringify({ success: true })).join("\n"),
        { status: 200 },
      );
    });

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
      baseUrl: "https://docs.example.com",
    } as DocsSearchAdapterContext);

    const createCall = vi.mocked(globalThis.fetch).mock.calls[1];
    expect(createCall).toBeDefined();
    const init = createCall?.[1];
    expect(init).toBeDefined();
    expect(typeof init?.body).toBe("string");
    const payload = JSON.parse(String(init?.body));
    expect(payload.default_sorting_field).toBeUndefined();
    expect(payload.fields).toContainEqual({
      name: "package",
      type: "string[]",
      optional: true,
    });
    expect(payload.fields).toContainEqual({
      name: "source_digest",
      type: "string",
      optional: true,
    });
    const imported = JSON.parse(
      String(vi.mocked(globalThis.fetch).mock.calls[2]?.[1]?.body).split("\n")[0],
    ) as Record<string, unknown>;
    expect(imported.source_canonical_url).toBe("https://docs.example.com/docs/installation");
    expect(imported.source_scope_audience).toBe("human");
    expect(imported.source_digest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(imported.source_index_generation).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("recovers when another sync creates the Typesense collection concurrently", async () => {
    let inspectCount = 0;
    let createdFields: Array<Record<string, unknown>> = [];
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/collections/docs") && !init?.method) {
        inspectCount += 1;
        return inspectCount === 1
          ? new Response(null, { status: 404 })
          : Response.json({ fields: createdFields });
      }
      if (url.endsWith("/collections") && init?.method === "POST") {
        createdFields = (
          JSON.parse(String(init.body)) as { fields: Array<Record<string, unknown>> }
        ).fields;
        return new Response("already exists", { status: 409 });
      }
      if (url.includes("/documents/import")) {
        const count = String(init?.body).split("\n").filter(Boolean).length;
        return new Response(
          Array.from({ length: count }, () => JSON.stringify({ success: true })).join("\n"),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected Typesense request: ${url}`);
    });

    const adapter = createTypesenseSearchAdapter({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
      adminApiKey: "admin-key",
    });

    await adapter.index!({
      pages,
      documents: buildDocsSearchDocuments(pages),
      audience: "human",
    } as DocsSearchAdapterContext);
    expect(inspectCount).toBe(2);
  });

  it("recovers when another sync adds missing Typesense provenance fields concurrently", async () => {
    let inspectCount = 0;
    let alteredFields: Array<Record<string, unknown>> = [];
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/collections/docs") && !init?.method) {
        inspectCount += 1;
        return Response.json({ fields: inspectCount === 1 ? [] : alteredFields });
      }
      if (url.endsWith("/collections/docs") && init?.method === "PATCH") {
        alteredFields = (
          JSON.parse(String(init.body)) as { fields: Array<Record<string, unknown>> }
        ).fields;
        return new Response("fields already exist", { status: 409 });
      }
      if (url.includes("/documents/import")) {
        const count = String(init?.body).split("\n").filter(Boolean).length;
        return new Response(
          Array.from({ length: count }, () => JSON.stringify({ success: true })).join("\n"),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected Typesense request: ${url}`);
    });
    const adapter = createTypesenseSearchAdapter({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
      adminApiKey: "admin-key",
    });

    await adapter.index!({
      pages,
      documents: buildDocsSearchDocuments(pages),
      audience: "human",
    } as DocsSearchAdapterContext);

    expect(inspectCount).toBe(2);
    expect(alteredFields).toContainEqual({
      name: "source_digest",
      type: "string",
      optional: true,
    });
  });

  it("owns Typesense records with scoped ids and avoids unsafe cross-generation pruning", async () => {
    let importedRecord: Record<string, unknown> | undefined;
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/collections/owned-docs") && !init?.method) {
        return new Response(null, { status: 404 });
      }
      if (url.pathname.endsWith("/collections") && init?.method === "POST") {
        return new Response("{}", { status: 201 });
      }
      if (url.pathname.endsWith("/documents/import")) {
        const records = String(init?.body)
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>);
        importedRecord = records[0];
        return new Response(records.map(() => JSON.stringify({ success: true })).join("\n"), {
          status: 200,
        });
      }
      if (url.pathname.endsWith("/multi_search")) {
        return new Response(
          JSON.stringify({
            results: [{ hits: [{ document: importedRecord, text_match: 123 }] }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected Typesense request: ${url.toString()}`);
    });

    const adapter = createTypesenseSearchAdapter({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "owned-docs",
      apiKey: "search-key",
      adminApiKey: "admin-key",
      syncNamespace: "site-a",
    });
    const context = {
      pages,
      documents: buildDocsSearchDocuments(pages),
      audience: "human" as const,
      baseUrl: "https://docs.example.com",
      indexBaseUrl: "https://docs.example.com",
      chunking: { strategy: "section" as const },
    };

    await adapter.index?.(context);

    expect(importedRecord).toMatchObject({
      id: expect.stringMatching(/^docs_[a-f0-9]{64}$/u),
      source_document_id: "/docs/installation#page",
    });
    expect(importedRecord?.source_corpus_id).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(
      vi.mocked(globalThis.fetch).mock.calls.some(([input, init]) => {
        const url = new URL(String(input));
        return (
          url.pathname.endsWith("/documents/export") ||
          (url.pathname.endsWith("/documents") && init?.method === "DELETE")
        );
      }),
    ).toBe(false);

    const results = await adapter.search({ query: "install", limit: 5 }, context);
    const searchCall = vi
      .mocked(globalThis.fetch)
      .mock.calls.find(([input]) => String(input).endsWith("/multi_search"));
    const searchBody = JSON.parse(String(searchCall?.[1]?.body)) as {
      searches: Array<{ filter_by?: string }>;
    };
    expect(searchBody.searches[0]?.filter_by).toBe(
      `source_corpus_id:=\`${String(importedRecord?.source_corpus_id)}\``,
    );
    expect(results[0]?.id).toBe("/docs/installation#page");
  });

  it("rejects incompatible existing Typesense provenance field types", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          fields: [
            {
              name: "source_scope_locale",
              type: "string",
              optional: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const adapter = createTypesenseSearchAdapter({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "incompatible-provenance",
      apiKey: "search-key",
      adminApiKey: "admin-key",
    });

    await expect(
      adapter.index?.({
        pages,
        documents: buildDocsSearchDocuments(pages),
      } as DocsSearchAdapterContext),
    ).rejects.toThrow(
      "Typesense collection has incompatible provenance fields: source_scope_locale.",
    );
  });

  it("rejects per-record Typesense import failures and retries the generation", async () => {
    let importAttempts = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/documents/import?action=upsert")) {
        importAttempts += 1;
        const count = String(init?.body).split("\n").filter(Boolean).length;
        return new Response(
          Array.from({ length: count }, (_, index) =>
            JSON.stringify(
              importAttempts === 1 && index === 0
                ? { success: false, error: "schema rejected the document" }
                : { success: true },
            ),
          ).join("\n"),
          { status: 200 },
        );
      }
      if (url.includes("/documents/search?")) {
        return new Response(JSON.stringify({ hits: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (!init?.method) {
        return new Response(JSON.stringify({ fields: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    });

    const options = {
      pages,
      query: "install",
      failureMode: "throw" as const,
      search: {
        provider: "typesense" as const,
        baseUrl: "https://typesense.example.com",
        collection: "provenance-import-retry",
        apiKey: "search-key",
        adminApiKey: "admin-key",
        syncOnSearch: true,
      },
    };

    await expect(performDocsSearch(options)).rejects.toThrow(
      "Typesense failed to import record 1: schema rejected the document",
    );
    await expect(performDocsSearch(options)).resolves.not.toHaveLength(0);
    expect(importAttempts).toBe(2);
  });

  it("starts non-sync MCP I/O before agent projection without building the human corpus", async () => {
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
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              content: [{ type: "text", text: JSON.stringify({ results: [] }) }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    let agentProjectionReads = 0;
    let humanProjectionReads = 0;
    let mcpStartedBeforeProjection = false;
    const results = await performDocsSearch({
      pages: [
        {
          title: "Lazy MCP search",
          url: "/docs/lazy-mcp-search",
          content: "Human coral walkthrough.",
          get rawContent() {
            humanProjectionReads += 1;
            return "# Lazy MCP search\n\nHuman coral walkthrough.";
          },
          get agentRawContent() {
            agentProjectionReads += 1;
            mcpStartedBeforeProjection ||= vi.mocked(globalThis.fetch).mock.calls.length > 0;
            return "# Lazy MCP search\n\nAgent indigo procedure.";
          },
        },
      ],
      query: "agent indigo procedure",
      audience: "agent",
      search: {
        provider: "mcp",
        endpoint: "https://docs.example.com/mcp",
        forwardAudience: true,
      },
      baseUrl: "https://docs.example.com",
    });

    expect(mcpStartedBeforeProjection).toBe(true);
    expect(agentProjectionReads).toBeGreaterThan(0);
    expect(humanProjectionReads).toBe(0);
    expect(results[0]?.url).toBe("/docs/lazy-mcp-search");
  });

  it("maps legacy MCP search_docs payloads and drops malformed provenance", async () => {
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
                      {
                        slug: "unsafe-installation",
                        url: "/docs/unsafe-installation",
                        title: "Unsafe installation",
                        excerpt: "This malformed provenance result must be dropped.",
                        source: {
                          canonicalUrl: "data:text/html,unsafe",
                          scope: { audience: "human" },
                          digest: "invalid",
                          indexGeneration: "invalid",
                        },
                      },
                      {
                        slug: "partial-installation",
                        url: "/docs/partial-installation",
                        title: "Partial installation",
                        excerpt: "This partial provenance result must be dropped.",
                        source: { lastModified: "2026-07-28" },
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

    const results = await adapter.search(
      {
        query: "install",
        limit: 5,
        audience: "agent",
      },
      {
        pages: [],
        documents: [],
      } as DocsSearchAdapterContext,
    );

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
    const requestPayload = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[1]?.body));
    expect(requestPayload).not.toHaveProperty("params.arguments.audience");
    expect(requestPayload).not.toHaveProperty("params.arguments.framework");
  });

  it("preserves verified filtered foreign MCP hits without leaking known out-of-scope pages", async () => {
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
              "mcp-session-id": "session-filtered",
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
                    format: "docs-search.v1",
                    query: "remote orchid",
                    audience: "agent",
                    filters: { framework: ["nextjs"] },
                    resultCount: 2,
                    results: [
                      {
                        id: "foreign-next",
                        url: "https://remote.example/docs/next",
                        content: "Remote Next guidance",
                        description: "Remote orchid procedure.",
                        type: "page",
                      },
                      {
                        id: "known-local-astro",
                        url: "https://docs.example.com/docs/astro",
                        content: "Astro guidance",
                        description: "Remote orchid procedure.",
                        type: "page",
                      },
                    ],
                    warnings: [],
                  }),
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const results = await performDocsSearch({
      pages: [
        {
          title: "Local Next",
          url: "/docs/next",
          content: "Local Next setup.",
          framework: "nextjs",
        },
        {
          title: "Local Astro",
          url: "/docs/astro",
          content: "Remote orchid procedure.",
          framework: "astro",
        },
      ],
      query: "remote orchid",
      audience: "agent",
      filters: { framework: "next" },
      search: {
        provider: "mcp",
        endpoint: "https://remote.example/mcp",
      },
      baseUrl: "https://docs.example.com",
    });

    expect(results.map((result) => result.id)).toContain("foreign-next");
    expect(results.map((result) => result.id)).not.toContain("known-local-astro");
    const requestPayload = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[1]?.body));
    expect(requestPayload).toHaveProperty("params.arguments.framework", ["nextjs"]);
  });

  it("rejects filtered MCP hits when the response does not verify the applied scope", async () => {
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
              "mcp-session-id": "session-unverified",
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
                        id: "unverified",
                        url: "https://remote.example/docs/next",
                        content: "Unverified result",
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
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const adapter = createMcpSearchAdapter({
      provider: "mcp",
      endpoint: "https://remote.example/mcp",
    });
    const results = await adapter.search(
      {
        query: "install",
        audience: "agent",
        filters: normalizeDocsSearchFilters({ framework: "next" }),
      },
      { pages: [], documents: [] } as DocsSearchAdapterContext,
    );

    expect(results).toEqual([]);
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

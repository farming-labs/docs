import { describe, it, expect } from "vitest";
import {
  buildDocsPageStructuredData,
  buildPageOpenGraph,
  buildPageTwitter,
  renderDocsPageStructuredDataJson,
  resolveDocsMetadataBaseUrl,
  resolveOGImage,
  resolveTitle,
} from "./metadata.js";
import type { OGConfig, PageFrontmatter } from "./types.js";

describe("resolveTitle", () => {
  it("replaces %s with page title", () => {
    expect(resolveTitle("Hello", { titleTemplate: "%s – Docs" })).toBe("Hello – Docs");
  });

  it("uses %s when no template", () => {
    expect(resolveTitle("Page")).toBe("Page");
  });

  it("uses default when template is empty", () => {
    expect(resolveTitle("X", { titleTemplate: "Docs" })).toBe("Docs");
  });
});

describe("resolveOGImage", () => {
  const baseUrl = "https://example.com";

  it("returns first openGraph image URL when page has openGraph.images", () => {
    const page: PageFrontmatter = {
      title: "SQLite",
      openGraph: {
        images: [{ url: "/og/sqlite.png", width: 1200, height: 630 }],
      },
    };
    expect(resolveOGImage(page, undefined, baseUrl)).toBe("/og/sqlite.png");
  });

  it("resolves relative openGraph image URL with baseUrl", () => {
    const page: PageFrontmatter = {
      title: "X",
      openGraph: {
        images: [{ url: "og/sqlite.png" }],
      },
    };
    expect(resolveOGImage(page, undefined, baseUrl)).toBe("https://example.com/og/sqlite.png");
  });

  it("returns ogImage when no openGraph", () => {
    const page: PageFrontmatter = {
      title: "X",
      ogImage: "/og/custom.png",
    };
    expect(resolveOGImage(page, { enabled: true }, baseUrl)).toBe("/og/custom.png");
  });

  it("prefers openGraph.images over ogImage", () => {
    const page: PageFrontmatter = {
      title: "X",
      ogImage: "/og/old.png",
      openGraph: {
        images: [{ url: "/og/new.png" }],
      },
    };
    expect(resolveOGImage(page, { enabled: true }, baseUrl)).toBe("/og/new.png");
  });

  it("returns dynamic endpoint URL when no page OG and config has endpoint", () => {
    const page: PageFrontmatter = { title: "Hello", description: "Desc" };
    const og: OGConfig = {
      enabled: true,
      type: "dynamic",
      endpoint: "/api/og",
    };
    expect(resolveOGImage(page, og, baseUrl)).toBe("https://example.com/api/og");
  });

  it("returns defaultImage when no page OG and config has defaultImage", () => {
    const page: PageFrontmatter = { title: "X" };
    const og: OGConfig = {
      enabled: true,
      defaultImage: "/default-og.png",
    };
    expect(resolveOGImage(page, og, baseUrl)).toBe("/default-og.png");
  });

  it("returns undefined when og disabled", () => {
    const page: PageFrontmatter = { title: "X", ogImage: "/x.png" };
    expect(resolveOGImage(page, { enabled: false })).toBeUndefined();
  });
});

describe("buildPageOpenGraph", () => {
  const baseUrl = "https://example.com";

  it("uses page.openGraph when present", () => {
    const page: PageFrontmatter = {
      title: "Farming-Labs",
      description:
        "Farming Labs is a software development company that builds tools for the farming industry.",
      openGraph: {
        images: [{ url: "/og/databases/sqlite.png", width: 1200, height: 630 }],
      },
    };
    const og = buildPageOpenGraph(page, undefined, baseUrl);
    expect(og).toEqual({
      title: "Farming-Labs",
      description:
        "Farming Labs is a software development company that builds tools for the farming industry.",
      images: [
        {
          url: "/og/databases/sqlite.png",
          width: 1200,
          height: 630,
        },
      ],
    });
  });

  it("fills title/description from page when openGraph omits them", () => {
    const page: PageFrontmatter = {
      title: "Page",
      description: "Desc",
      openGraph: {
        images: [{ url: "/img.png" }],
      },
    };
    const og = buildPageOpenGraph(page, undefined, baseUrl);
    expect(og?.title).toBe("Page");
    expect(og?.description).toBe("Desc");
  });

  it("builds from ogImage when no openGraph", () => {
    const page: PageFrontmatter = {
      title: "X",
      description: "Y",
      ogImage: "/og/simple.png",
    };
    const ogConfig: OGConfig = { enabled: true };
    const og = buildPageOpenGraph(page, ogConfig, baseUrl);
    expect(og).toEqual({
      title: "X",
      description: "Y",
      images: [{ url: "/og/simple.png", width: 1200, height: 630 }],
    });
  });

  it("returns undefined when no OG source", () => {
    const page: PageFrontmatter = { title: "X" };
    expect(buildPageOpenGraph(page, undefined)).toBeUndefined();
    expect(buildPageOpenGraph(page, { enabled: false })).toBeUndefined();
  });
});

describe("buildPageTwitter", () => {
  const baseUrl = "https://example.com";

  it("uses page.twitter when present", () => {
    const page: PageFrontmatter = {
      title: "Farming-Labs",
      twitter: {
        card: "summary_large_image",
        images: ["/og/farming-labs/og.png"],
      },
    };
    const tw = buildPageTwitter(page, undefined, baseUrl);
    expect(tw).toEqual({
      card: "summary_large_image",
      images: ["/og/farming-labs/og.png"],
    });
  });

  it("builds from ogImage when no twitter", () => {
    const page: PageFrontmatter = {
      title: "X",
      description: "Y",
      ogImage: "/og/simple.png",
    };
    const ogConfig: OGConfig = { enabled: true };
    const tw = buildPageTwitter(page, ogConfig, baseUrl);
    expect(tw).toEqual({
      card: "summary_large_image",
      title: "X",
      description: "Y",
      images: ["/og/simple.png"],
    });
  });

  it("returns undefined when no twitter and no og source", () => {
    const page: PageFrontmatter = { title: "X" };
    expect(buildPageTwitter(page, undefined)).toBeUndefined();
  });
});

describe("buildDocsPageStructuredData", () => {
  it("builds Vercel-style TechArticle JSON-LD with canonical URL and breadcrumbs", () => {
    const data = buildDocsPageStructuredData({
      title: "Agent-friendly docs",
      description: "Write docs that agents can discover and cite.",
      url: "/docs/guides/agent-friendly-docs",
      baseUrl: "https://docs.example.com",
      entry: "docs",
      dateModified: "2026-05-10",
    }) as {
      "@type": string;
      headline: string;
      url: string;
      dateModified: string;
      breadcrumb: { itemListElement: Array<{ name: string; item: string }> };
    };

    expect(data["@type"]).toBe("TechArticle");
    expect(data.headline).toBe("Agent-friendly docs");
    expect(data.url).toBe("https://docs.example.com/docs/guides/agent-friendly-docs");
    expect(data.dateModified).toBe("2026-05-10T00:00:00.000Z");
    expect(data.breadcrumb.itemListElement).toEqual([
      expect.objectContaining({ name: "Docs", item: "https://docs.example.com/docs" }),
      expect.objectContaining({ name: "Guides", item: "https://docs.example.com/docs/guides" }),
      expect.objectContaining({
        name: "Agent-friendly docs",
        item: "https://docs.example.com/docs/guides/agent-friendly-docs",
      }),
    ]);
  });

  it("escapes JSON-LD for script tag insertion", () => {
    const json = renderDocsPageStructuredDataJson({
      title: "</script><script>alert(1)</script>",
      url: "/docs/security",
    });

    expect(json).toContain("\\u003c/script>");
    expect(json).not.toContain("</script>");
  });

  it("represents actionable page contracts as a Schema.org HowTo", () => {
    const data = buildDocsPageStructuredData({
      title: "Configure MCP",
      description: "Configure the docs endpoint.",
      url: "/docs/mcp",
      agent: {
        task: "Configure authenticated MCP",
        outcome: "Unauthenticated requests are rejected.",
        appliesTo: { framework: "nextjs", package: ["@farming-labs/next"] },
        prerequisites: ["An MCP endpoint is enabled"],
        files: ["docs.config.ts"],
        commands: [
          {
            run: "pnpm test",
            cwd: "packages/next",
            description: "Test the adapter",
          },
        ],
        verification: [{ run: "curl https://docs.example.com/mcp", expect: "HTTP 401" }],
      },
    }) as {
      mainEntity?: {
        "@type": string;
        name: string;
        description: string;
        about: Array<{ name: string }>;
        supply: Array<{ "@type": string; name: string }>;
        step: Array<{ "@type": string; position: number; name: string; text: string }>;
      };
    };

    expect(data.mainEntity).toMatchObject({
      "@type": "HowTo",
      name: "Configure authenticated MCP",
      description: "Unauthenticated requests are rejected.",
    });
    expect(data.mainEntity?.about.map((item) => item.name)).toEqual([
      "framework: nextjs",
      "package: @farming-labs/next",
    ]);
    expect(data.mainEntity?.supply).toEqual([
      { "@type": "HowToSupply", name: "An MCP endpoint is enabled" },
      { "@type": "HowToSupply", name: "docs.config.ts" },
    ]);
    expect(data.mainEntity?.step).toEqual([
      {
        "@type": "HowToStep",
        position: 1,
        name: "Test the adapter",
        text: "pnpm test (from packages/next)",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Verify the result",
        text: "curl https://docs.example.com/mcp. Expected: HTTP 401",
      },
    ]);
  });

  it("reuses existing public URL config for metadata base URL", () => {
    expect(
      resolveDocsMetadataBaseUrl({
        sitemap: { enabled: true, baseUrl: "https://docs.example.com/" },
        entry: "docs",
      }),
    ).toBe("https://docs.example.com");

    expect(
      resolveDocsMetadataBaseUrl({
        llmsTxt: { enabled: true, baseUrl: "https://llms.example.com" },
        entry: "docs",
      }),
    ).toBe("https://llms.example.com");

    expect(
      resolveDocsMetadataBaseUrl({
        sitemap: { enabled: true, baseUrl: "not a url" },
        llmsTxt: { enabled: true, baseUrl: "https://llms.example.com" },
        entry: "docs",
      }),
    ).toBe("https://llms.example.com");
  });
});

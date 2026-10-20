import { describe, expect, it } from "vitest";
import {
  buildDocsSitemapManifest,
  createDocsSitemapLastmodResolver,
  createDocsSitemapResponse,
  renderDocsSitemapMarkdown,
  renderDocsSitemapXml,
  resolveDocsSitemapConfig,
  resolveDocsSitemapPageLastmod,
  resolveDocsSitemapRequest,
} from "./sitemap.js";

describe("docs sitemap helpers", () => {
  it("resolves default and prefixed sitemap routes", () => {
    expect(resolveDocsSitemapConfig().enabled).toBe(true);
    expect(resolveDocsSitemapConfig().xml.route).toBe("/sitemap.xml");
    expect(resolveDocsSitemapConfig().markdown.docsRoute).toBe("/docs/sitemap.md");
    expect(resolveDocsSitemapConfig(true).xml.route).toBe("/sitemap.xml");
    expect(resolveDocsSitemapConfig(true).markdown.wellKnownRoute).toBe("/.well-known/sitemap.md");

    const prefixed = resolveDocsSitemapConfig({ routePrefix: "/docs" });
    expect(prefixed.xml.route).toBe("/docs/sitemap.xml");
    expect(prefixed.markdown.route).toBe("/docs/sitemap.md");
    expect(prefixed.markdown.docsRoute).toBeUndefined();
    expect(prefixed.markdown.wellKnownRoute).toBe("/docs/.well-known/sitemap.md");
  });

  it("detects public and API sitemap requests", () => {
    expect(resolveDocsSitemapRequest(new URL("https://example.com/sitemap.xml"))).toBe("xml");
    expect(resolveDocsSitemapRequest(new URL("https://example.com/sitemap.xml"), true)).toBe("xml");
    expect(resolveDocsSitemapRequest(new URL("https://example.com/sitemap.md"), true)).toBe(
      "markdown",
    );
    expect(resolveDocsSitemapRequest(new URL("https://example.com/docs/sitemap.md"), true)).toBe(
      "markdown",
    );
    expect(
      resolveDocsSitemapRequest(new URL("https://example.com/api/docs?format=sitemap-md"), false),
    ).toBe("markdown");
    expect(
      resolveDocsSitemapRequest(
        new URL("https://example.com/api/internal/docs?format=sitemap-xml"),
        true,
        { apiRoute: "/api/internal/docs" },
      ),
    ).toBe("xml");
    expect(resolveDocsSitemapRequest(new URL("https://example.com/sitemap.xml"), false)).toBeNull();
  });

  it("renders XML and Markdown from a manifest", () => {
    const manifest = buildDocsSitemapManifest({
      entry: "docs",
      siteTitle: "Example Docs",
      baseUrl: "https://docs.example.com",
      generatedAt: "2026-05-08T12:00:00.000Z",
      pages: [
        {
          url: "/docs/configuration",
          title: "Configuration",
          description: "Configure docs.config.ts",
          lastModified: "2026-05-07T10:00:00.000Z",
          related: [{ href: "/docs/customization/mcp" }],
        },
      ],
    });

    expect(renderDocsSitemapXml(manifest)).toContain(
      "<loc>https://docs.example.com/docs/configuration</loc>",
    );
    expect(renderDocsSitemapXml(manifest)).toContain("<lastmod>2026-05-07</lastmod>");

    const markdown = renderDocsSitemapMarkdown(manifest);
    expect(markdown).toContain("# Example Docs Sitemap");
    expect(markdown).toContain("- [Configuration](/docs/configuration)");
    expect(markdown).toContain("Markdown: /docs/configuration.md");
    expect(markdown).toContain("Related: /docs/customization/mcp");
  });

  it("creates cacheable responses with ETags", async () => {
    const response = createDocsSitemapResponse({
      request: new Request("https://docs.example.com/sitemap.xml"),
      sitemap: true,
      entry: "docs",
      pages: [{ url: "/docs", title: "Home", lastmod: "2026-05-08" }],
    });

    expect(response?.headers.get("content-type")).toContain("application/xml");
    expect(response?.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(response?.headers.get("etag")).toBeTruthy();
    expect(await response?.text()).toContain("<urlset");
  });

  it("creates query-format responses on a custom API route", async () => {
    const response = createDocsSitemapResponse({
      request: new Request("https://docs.example.com/api/internal/docs?format=sitemap-md"),
      apiRoute: "/api/internal/docs",
      sitemap: true,
      entry: "docs",
      pages: [{ url: "/docs", title: "Home" }],
    });

    expect(response?.headers.get("content-type")).toContain("text/markdown");
    expect(await response?.text()).toContain("# Documentation Sitemap");
  });

  it("looks up stable page freshness from a sitemap manifest", () => {
    const manifest = buildDocsSitemapManifest({
      entry: "docs",
      pages: [
        { url: "/docs", title: "Home", lastmod: "2026-05-08T10:00:00.000Z" },
        { url: "/docs/configuration", title: "Configuration", lastmod: "2026-05-09" },
      ],
    });

    expect(resolveDocsSitemapPageLastmod(manifest, "/docs/configuration")).toBe("2026-05-09");
    expect(resolveDocsSitemapPageLastmod(manifest, "/docs/missing")).toBeUndefined();
    expect(resolveDocsSitemapPageLastmod(null, "/docs")).toBeUndefined();
  });

  it("indexes a manifest once while preserving first-match and URL normalization semantics", () => {
    const manifest = buildDocsSitemapManifest({ entry: "docs", pages: [] });
    manifest.pages = [
      { url: "/docs/intro/", markdownUrl: "/docs/intro.md", title: "First", lastmod: "invalid" },
      {
        url: "/docs/intro",
        markdownUrl: "/docs/intro.md",
        title: "Duplicate",
        lastmod: "2026-05-09",
      },
      {
        url: "/docs/topic?lang=fr",
        markdownUrl: "/docs/topic.md?lang=fr",
        title: "French",
        lastmod: "2026-05-10T10:00:00Z",
      },
      {
        url: "/docs/topic",
        markdownUrl: "/docs/topic.md",
        title: "Default",
        lastmod: "2026-05-08",
      },
    ];
    const resolve = createDocsSitemapLastmodResolver(manifest);
    for (const url of [
      "/docs/intro",
      "/docs/intro/",
      "/docs/topic",
      "/docs/topic?lang=fr",
      "/missing",
    ]) {
      expect(resolve(url)).toBe(resolveDocsSitemapPageLastmod(manifest, url));
    }
    expect(createDocsSitemapLastmodResolver(null)("/docs")).toBeUndefined();
    manifest.pages[3].lastmod = "2026-06-01";
    expect(resolve("/docs/topic")).toBe("2026-05-08");
    expect(createDocsSitemapLastmodResolver(manifest)("/docs/topic")).toBe("2026-06-01");
    expect(resolveDocsSitemapPageLastmod(manifest, "/docs/topic")).toBe("2026-06-01");
  });

  it("reads each manifest URL once when resolving freshness for a large site", () => {
    const manifest = buildDocsSitemapManifest({ entry: "docs", pages: [] });
    let reads = 0;
    manifest.pages = Array.from({ length: 1_000 }, (_, index) => ({
      get url() {
        reads += 1;
        return `/docs/${index}`;
      },
      markdownUrl: `/docs/${index}.md`,
      title: `Page ${index}`,
      lastmod: "2026-05-08",
    }));
    const resolve = createDocsSitemapLastmodResolver(manifest);
    expect(reads).toBe(0);
    for (let index = 0; index < 1_000; index++) {
      expect(resolve(`/docs/${index}`)).toBe("2026-05-08");
    }
    expect(reads).toBe(1_000);
  });
});

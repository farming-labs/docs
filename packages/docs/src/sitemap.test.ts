import { describe, expect, it } from "vitest";
import {
  buildDocsSitemapManifest,
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
});

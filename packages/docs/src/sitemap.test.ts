import { describe, expect, it } from "vitest";
import {
  buildDocsSitemapManifest,
  createDocsSitemapResponse,
  renderDocsSitemapMarkdown,
  renderDocsSitemapXml,
  resolveDocsSitemapConfig,
  resolveDocsSitemapRequest,
} from "./sitemap.js";

describe("docs sitemap helpers", () => {
  it("resolves default and prefixed sitemap routes", () => {
    expect(resolveDocsSitemapConfig(true).xml.route).toBe("/sitemap.xml");
    expect(resolveDocsSitemapConfig(true).markdown.wellKnownRoute).toBe("/.well-known/sitemap.md");

    const prefixed = resolveDocsSitemapConfig({ routePrefix: "/docs" });
    expect(prefixed.xml.route).toBe("/docs/sitemap.xml");
    expect(prefixed.markdown.route).toBe("/docs/sitemap.md");
    expect(prefixed.markdown.wellKnownRoute).toBe("/docs/.well-known/sitemap.md");
  });

  it("detects public and API sitemap requests", () => {
    expect(resolveDocsSitemapRequest(new URL("https://example.com/sitemap.xml"), true)).toBe("xml");
    expect(resolveDocsSitemapRequest(new URL("https://example.com/sitemap.md"), true)).toBe(
      "markdown",
    );
    expect(
      resolveDocsSitemapRequest(new URL("https://example.com/api/docs?format=sitemap-md"), false),
    ).toBe("markdown");
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
});

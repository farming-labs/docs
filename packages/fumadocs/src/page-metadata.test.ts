import { describe, expect, it, vi } from "vitest";
import { serializePageMetadata, resolvePageMetadata, type DocsPageMaps } from "./page-metadata.js";
import { compactPageStructuredData, renderPageStructuredData } from "./page-structured-data.js";

function fixture(): DocsPageMaps {
  return {
    lastModifiedMap: { "/docs/a": "October 17, 2026", "/docs/b": "October 17, 2026" },
    generatedTitleMap: { "/docs/a": "A", "/docs/b": "Custom visible title" },
    descriptionMap: { "/docs/a": "Unicode 日本語 </script>", "/docs/b": "" },
    readingTimeMap: { "/docs/a": 0, "/docs/b": 7 },
    structuredDataPages: {
      baseUrl: "https://example.com",
      entry: "docs",
      pages: {
        "/docs/a": compactPageStructuredData({
          title: "A",
          description: "Unicode 日本語 </script>",
          url: "/docs/a?lang=fr",
          dateModified: "2026-10-17T00:00:00.000Z",
          breadcrumbs: [{ name: "Custom", url: "/custom" }],
          agent: { task: "Install", commands: ["pnpm install"] },
        }),
        "/docs/b": compactPageStructuredData({
          title: "B",
          description: "Schema-only description",
          url: "/docs/b",
          dateModified: "2026-10-17T00:00:00.000Z",
        }),
        "/": compactPageStructuredData({ title: "Root", url: "/" }),
      },
    },
  };
}

describe("packed page metadata", () => {
  it("preserves visible metadata and exact JSON-LD for every route after transport", () => {
    const maps = fixture();
    const data = JSON.parse(JSON.stringify(serializePageMetadata(maps)));
    for (const route of Object.keys(maps.structuredDataPages.pages)) {
      const page = resolvePageMetadata(data, route)!;
      expect(page.generatedTitle).toBe(maps.generatedTitleMap[route]);
      expect(page.description).toBe(maps.descriptionMap[route]);
      expect(page.lastModified).toBe(maps.lastModifiedMap[route]);
      expect(page.readingTime).toBe(maps.readingTimeMap[route]);
      expect(renderPageStructuredData(page.structuredDataPages, route)).toBe(
        renderPageStructuredData(maps.structuredDataPages, route),
      );
    }
    expect(resolvePageMetadata(data, "/missing")).toBeUndefined();
    expect(resolvePageMetadata(data, "constructor")).toBeUndefined();
    expect(resolvePageMetadata(undefined, "/docs/a")).toBeUndefined();
  });

  it("decodes once per snapshot, isolates locales, and observes a replaced snapshot", () => {
    const maps = fixture();
    const first = serializePageMetadata(maps);
    maps.structuredDataPages.pages["/docs/a"].title = "Updated";
    const second = serializePageMetadata(maps);
    const parse = vi.spyOn(JSON, "parse");
    try {
      resolvePageMetadata(first, "/docs/a");
      resolvePageMetadata(first, "/docs/b");
      expect(parse).toHaveBeenCalledTimes(1);
      expect(
        resolvePageMetadata(second, "/docs/a")?.structuredDataPages.pages["/docs/a"].title,
      ).toBe("Updated");
      expect(
        resolvePageMetadata(first, "/docs/a")?.structuredDataPages.pages["/docs/a"].title,
      ).toBe("A");
      first.json = second.json;
      expect(
        resolvePageMetadata(first, "/docs/a")?.structuredDataPages.pages["/docs/a"].title,
      ).toBe("Updated");
      expect(parse).toHaveBeenCalledTimes(3);
    } finally {
      parse.mockRestore();
    }
  });
});

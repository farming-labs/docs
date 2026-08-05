import { describe, expect, it } from "vitest";
import { createDocsServer } from "../src/server.js";

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const sitemapManifest = JSON.stringify({
  version: 1,
  generatedAt: "2026-07-28T00:00:00.000Z",
  entry: "docs",
  pages: [
    {
      url: "/docs",
      markdownUrl: "/docs.md",
      title: "Astro provenance",
      lastmod: "2026-07-27",
    },
  ],
});
const source = `---
title: "Astro provenance"
framework: "Astro"
version: "5"
lastmod: 2026-07-26
tags:
  - retrieval
---

# Astro provenance

Unique retrieval provenance needle.
`;
const localizedSource = source.replace("lastmod: 2026-07-26\n", "");
const localizedSitemapManifest = JSON.stringify({
  version: 1,
  generatedAt: "2026-07-28T00:00:00.000Z",
  entry: "docs",
  pages: [
    {
      url: "/docs",
      markdownUrl: "/docs.md",
      title: "Astro fallback provenance",
      lastmod: "2026-07-20",
    },
    {
      url: "/docs?lang=fr",
      markdownUrl: "/docs.md?lang=fr",
      title: "Astro localized provenance",
      lastmod: "2026-07-21",
    },
    {
      url: "/docs/fallback",
      markdownUrl: "/docs/fallback.md",
      title: "Astro fallback freshness",
      lastmod: "2026-07-22",
    },
  ],
});
const fallbackSource = `---
title: "Astro fallback freshness"
framework: "Astro"
---

# Astro fallback freshness

Unique fallback freshness needle.
`;

describe("createDocsServer structured search provenance", () => {
  it("uses the shared metadata pipeline without changing legacy response envelopes", async () => {
    const server = createDocsServer({
      entry: "docs",
      sitemap: { baseUrl: "https://docs.example.com" },
      _preloadedContent: {
        "/docs/page.md": source,
        "/.farming-labs/sitemap-manifest.json": sitemapManifest,
      },
    });

    const legacy = await server.GET({
      request: new Request("https://preview.example/api/docs?query=provenance"),
    });
    const legacyPayload = await legacy.json();
    expect(legacyPayload).toEqual(expect.any(Array));
    expect(legacyPayload.every((result: { explanation?: unknown }) => !result.explanation)).toBe(
      true,
    );

    const structured = await server.GET({
      request: new Request("https://preview.example/api/docs?query=provenance&response=structured"),
    });
    const payload = await structured.json();

    expect(payload.indexGeneration).toMatch(digestPattern);
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            canonicalUrl: expect.stringMatching(/^https:\/\/docs\.example\.com\/docs(?:#|$)/),
            scope: expect.objectContaining({ audience: "human", framework: ["astro"] }),
            lastModified: "2026-07-26T00:00:00.000Z",
            digest: expect.stringMatching(digestPattern),
            indexGeneration: payload.indexGeneration,
          }),
        }),
      ]),
    );
    expect(payload.results.every((result: { explanation?: unknown }) => !result.explanation)).toBe(
      true,
    );

    const explained = await server.GET({
      request: new Request(
        "https://preview.example/api/docs?query=provenance&response=structured&explain=true",
      ),
    });
    const explainedPayload = await explained.json();
    expect(explainedPayload.results[0]?.explanation).toMatchObject({
      format: "docs-search-explanation.v1",
      rank: 1,
      rankingStrategy: "lexical",
      selectedScope: expect.objectContaining({ framework: ["astro"] }),
      rankingReasons: expect.any(Array),
    });

    const blankLegacy = await server.GET({
      request: new Request("https://preview.example/api/docs?query=%20"),
    });
    await expect(blankLegacy.json()).resolves.toEqual([]);

    const blankStructured = await server.GET({
      request: new Request("https://preview.example/api/docs?query=%20&response=structured"),
    });
    const blankPayload = await blankStructured.json();
    expect(blankPayload).toMatchObject({
      format: "docs-search.v1",
      query: "",
      resultCount: 0,
      results: [],
    });
    expect(blankPayload.indexGeneration).toMatch(digestPattern);

    const facets = await server.GET({
      request: new Request("https://preview.example/api/docs?response=facets&framework=Astro"),
    });
    expect(facets.headers.get("cache-control")).toContain("max-age=60");
    await expect(facets.json()).resolves.toMatchObject({
      format: "docs-search-facets.v1",
      filters: { framework: ["astro"] },
      matchedPageCount: 1,
      facets: {
        framework: { total: 1, hasMore: false, values: [{ value: "astro", count: 1 }] },
        version: { total: 1, hasMore: false, values: [{ value: "5", count: 1 }] },
        tags: { total: 1, hasMore: false, values: [{ value: "retrieval", count: 1 }] },
      },
    });
  });

  it("continues a selected facet without returning document bodies", async () => {
    const server = createDocsServer({
      entry: "docs",
      _preloadedContent: Object.fromEntries(
        Array.from({ length: 105 }, (_, index) => {
          const tag = `tag-${String(index).padStart(3, "0")}`;
          return [
            `/docs/tag-${index}/page.md`,
            `---
title: "Tag ${index}"
tags:
  - ${tag}
---

# Tag ${index}

Large body ${index} that must not appear in facet discovery.
`,
          ];
        }),
      ),
    });

    const first = await server.GET({
      request: new Request("https://preview.example/api/docs?response=facets&facet=tags&limit=50"),
    });
    const firstPayload = await first.json();
    expect(firstPayload.facets.tags).toMatchObject({
      total: 105,
      hasMore: true,
      values: expect.arrayContaining([{ value: "tag-000", count: 1 }]),
    });
    expect(firstPayload.facets.tags.values).toHaveLength(50);
    expect(JSON.stringify(firstPayload)).not.toContain("Large body");

    const second = await server.GET({
      request: new Request(
        `https://preview.example/api/docs?response=facets&facet=tags&limit=50&cursor=${firstPayload.facets.tags.nextCursor}`,
      ),
    });
    const secondPayload = await second.json();
    expect(secondPayload.facets.tags).toMatchObject({
      total: 105,
      hasMore: true,
    });
    expect(secondPayload.facets.tags.values.at(0)?.value).toBe("tag-050");
    expect(secondPayload.facets.tags.values.at(-1)?.value).toBe("tag-099");
  });

  it("prefers locale-qualified manifest freshness and falls back to the base page URL", async () => {
    const server = createDocsServer({
      entry: "docs",
      i18n: { locales: ["en", "fr"], defaultLocale: "en" },
      sitemap: { baseUrl: "https://docs.example.com" },
      _preloadedContent: {
        "/docs/fr/page.md": localizedSource,
        "/docs/fr/fallback.md": fallbackSource,
        "/.farming-labs/sitemap-manifest.json": localizedSitemapManifest,
      },
    });

    const localized = await server.GET({
      request: new Request(
        "https://preview.example/api/docs?query=provenance&response=structured&lang=fr",
      ),
    });
    const localizedPayload = await localized.json();
    expect(localizedPayload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            canonicalUrl: expect.stringContaining("/docs?lang=fr"),
            scope: expect.objectContaining({ locale: ["fr"] }),
            lastModified: "2026-07-21T00:00:00.000Z",
          }),
        }),
      ]),
    );

    const fallback = await server.GET({
      request: new Request(
        "https://preview.example/api/docs?query=fallback&response=structured&lang=fr",
      ),
    });
    const fallbackPayload = await fallback.json();
    expect(fallbackPayload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            canonicalUrl: expect.stringContaining("/docs/fallback?lang=fr"),
            scope: expect.objectContaining({ locale: ["fr"] }),
            lastModified: "2026-07-22T00:00:00.000Z",
          }),
        }),
      ]),
    );
  });
});

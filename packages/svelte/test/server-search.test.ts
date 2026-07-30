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
      title: "Svelte provenance",
      lastmod: "2026-07-27",
    },
  ],
});
const source = `---
title: "Svelte provenance"
framework: "SvelteKit"
version: "2"
lastmod: 2026-07-26
tags:
  - retrieval
---

# Svelte provenance

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
      title: "Svelte fallback provenance",
      lastmod: "2026-07-20",
    },
    {
      url: "/docs?lang=fr",
      markdownUrl: "/docs.md?lang=fr",
      title: "Svelte localized provenance",
      lastmod: "2026-07-21",
    },
    {
      url: "/docs/fallback",
      markdownUrl: "/docs/fallback.md",
      title: "Svelte fallback freshness",
      lastmod: "2026-07-22",
    },
  ],
});
const fallbackSource = `---
title: "Svelte fallback freshness"
framework: "SvelteKit"
---

# Svelte fallback freshness

Unique fallback freshness needle.
`;

function event(url: string) {
  const request = new Request(url);
  return { request, url: new URL(url) };
}

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

    const legacy = await server.GET(event("https://preview.example/api/docs?query=provenance"));
    const legacyPayload = await legacy.json();
    expect(legacyPayload).toEqual(expect.any(Array));
    expect(legacyPayload.every((result: { explanation?: unknown }) => !result.explanation)).toBe(
      true,
    );

    const structured = await server.GET(
      event("https://preview.example/api/docs?query=provenance&response=structured"),
    );
    const payload = await structured.json();

    expect(payload.indexGeneration).toMatch(digestPattern);
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            canonicalUrl: expect.stringMatching(/^https:\/\/docs\.example\.com\/docs(?:#|$)/),
            scope: expect.objectContaining({ audience: "human", framework: ["sveltekit"] }),
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

    const explained = await server.GET(
      event("https://preview.example/api/docs?query=provenance&response=structured&explain=true"),
    );
    const explainedPayload = await explained.json();
    expect(explainedPayload.results[0]?.explanation).toMatchObject({
      format: "docs-search-explanation.v1",
      rank: 1,
      rankingStrategy: "lexical",
      selectedScope: expect.objectContaining({ framework: ["sveltekit"] }),
      rankingReasons: expect.any(Array),
    });

    const blankLegacy = await server.GET(event("https://preview.example/api/docs?query=%20"));
    await expect(blankLegacy.json()).resolves.toEqual([]);

    const blankStructured = await server.GET(
      event("https://preview.example/api/docs?query=%20&response=structured"),
    );
    const blankPayload = await blankStructured.json();
    expect(blankPayload).toMatchObject({
      format: "docs-search.v1",
      query: "",
      resultCount: 0,
      results: [],
    });
    expect(blankPayload.indexGeneration).toMatch(digestPattern);

    const facets = await server.GET(
      event("https://preview.example/api/docs?response=facets&framework=SvelteKit"),
    );
    expect(facets.headers.get("cache-control")).toContain("max-age=60");
    await expect(facets.json()).resolves.toMatchObject({
      format: "docs-search-facets.v1",
      filters: { framework: ["sveltekit"] },
      matchedPageCount: 1,
      facets: {
        framework: { values: [{ value: "sveltekit", count: 1 }] },
        version: { values: [{ value: "2", count: 1 }] },
        tags: { values: [{ value: "retrieval", count: 1 }] },
      },
    });
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

    const localized = await server.GET(
      event("https://preview.example/api/docs?query=provenance&response=structured&lang=fr"),
    );
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

    const fallback = await server.GET(
      event("https://preview.example/api/docs?query=fallback&response=structured&lang=fr"),
    );
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

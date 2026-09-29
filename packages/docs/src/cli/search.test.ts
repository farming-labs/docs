import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveAlgoliaSyncConfig,
  resolveSearchSyncProvider,
  resolveTypesenseSyncConfig,
  syncSearch,
} from "./search.js";

const initialCwd = process.cwd();
const tempDirs: string[] = [];

afterEach(() => {
  process.chdir(initialCwd);
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("search sync cli", () => {
  it("prefers the explicit --typesense shortcut", () => {
    expect(resolveSearchSyncProvider({ typesense: true }, {})).toBe("typesense");
  });

  it("infers typesense from env when provider is omitted", () => {
    expect(resolveSearchSyncProvider({}, { TYPESENSE_URL: "https://typesense.example.com" })).toBe(
      "typesense",
    );
  });

  it("builds a typesense sync config from env", () => {
    expect(
      resolveTypesenseSyncConfig(
        {},
        {
          TYPESENSE_URL: "https://typesense.example.com",
          TYPESENSE_API_KEY: "search-key",
          TYPESENSE_ADMIN_API_KEY: "admin-key",
        },
      ),
    ).toEqual({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
      adminApiKey: "admin-key",
      mode: "keyword",
    });
  });

  it("requires an ollama model for hybrid typesense sync", () => {
    expect(() =>
      resolveTypesenseSyncConfig(
        { mode: "hybrid" },
        {
          TYPESENSE_URL: "https://typesense.example.com",
          TYPESENSE_API_KEY: "search-key",
          TYPESENSE_ADMIN_API_KEY: "admin-key",
        },
      ),
    ).toThrow(/TYPESENSE_OLLAMA_MODEL/);
  });

  it("reads a stable hosted corpus namespace from env", () => {
    expect(
      resolveTypesenseSyncConfig(
        {},
        {
          TYPESENSE_URL: "https://typesense.example.com",
          TYPESENSE_API_KEY: "search-key",
          TYPESENSE_ADMIN_API_KEY: "admin-key",
          DOCS_SEARCH_SYNC_NAMESPACE: "product-docs",
        },
      ).syncNamespace,
    ).toBe("product-docs");
  });

  it("builds an algolia sync config from env", () => {
    expect(
      resolveAlgoliaSyncConfig(
        {},
        {
          ALGOLIA_APP_ID: "app-id",
          ALGOLIA_ADMIN_API_KEY: "admin-key",
          ALGOLIA_SEARCH_API_KEY: "search-key",
        },
      ),
    ).toEqual({
      provider: "algolia",
      appId: "app-id",
      indexName: "docs",
      searchApiKey: "search-key",
      adminApiKey: "admin-key",
    });
  });

  it("includes generated OpenAPI operation documents in external search sync", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-search-sync-openapi-"));
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify({ dependencies: { next: "16.0.0" } }),
    );
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  apiReference: { enabled: true, specUrl: "./openapi.yaml" },
};
`,
    );
    writeFileSync(join(rootDir, "app", "docs", "page.mdx"), "# Documentation\n");
    writeFileSync(
      join(rootDir, "openapi.yaml"),
      [
        'openapi: "3.1.0"',
        "info:",
        "  title: Orchard API",
        '  version: "1.0.0"',
        "paths:",
        "  /harvests:",
        "    get:",
        "      operationId: listHarvests",
        "      summary: List precision harvests",
        "      responses:",
        '        "200":',
        "          description: OK",
        "",
      ].join("\n"),
    );

    const importedDocuments: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/collections/docs")) return new Response(null, { status: 404 });
        if (url.endsWith("/collections")) return Response.json({}, { status: 201 });
        if (url.includes("/documents/import")) {
          const records = String(init?.body)
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as Record<string, unknown>);
          importedDocuments.push(...records);
          return new Response(records.map(() => JSON.stringify({ success: true })).join("\n"));
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    process.chdir(rootDir);

    await syncSearch({
      typesense: true,
      baseUrl: "https://typesense.example.com",
      siteUrl: "https://docs.example.com",
      apiKey: "search-key",
      adminApiKey: "admin-key",
    });

    expect(importedDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringMatching(/^\/api-reference\/operations\/list-harvests-[a-z0-9]+$/),
          title: "List precision harvests",
          version: "1.0.0",
          tags: expect.arrayContaining(["openapi", "get"]),
        }),
      ]),
    );
  });
});

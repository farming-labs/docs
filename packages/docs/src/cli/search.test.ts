import { describe, expect, it } from "vitest";
import {
  resolveAlgoliaSyncConfig,
  resolveSearchSyncProvider,
  resolveTypesenseSyncConfig,
} from "./search.js";

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
});

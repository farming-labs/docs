import { describe, expect, it } from "vitest";
import { withDocs } from "./config.js";

describe("withDocs", () => {
  it("enables Farm docs without mutating the input config", () => {
    const input = { preset: "vercel" } as const;
    const result = withDocs(input);

    expect(result).toMatchObject({
      preset: "vercel",
      docs: {
        enabled: true,
        adapter: {
          id: "@farming-labs/farmjs",
          protocol: 1,
          server: "@farming-labs/farmjs/server",
          react: "@farming-labs/farmjs/react",
          vite: "@farming-labs/farmjs/vite",
        },
      },
    });
    expect("docs" in input).toBe(false);
  });

  it("preserves native Farm docs options", () => {
    const result = withDocs({
      docs: {
        entry: "/guide",
        contentDir: "content/guide",
      },
    });

    expect(result.docs).toEqual({
      enabled: true,
      adapter: expect.objectContaining({ id: "@farming-labs/farmjs", protocol: 1 }),
      entry: "/guide",
      contentDir: "content/guide",
    });
  });

  it("merges adapter options after existing docs options", () => {
    const result = withDocs(
      {
        docs: {
          configPath: "legacy.config.ts",
          config: { entry: "docs", search: false },
        },
      },
      {
        configPath: "docs.config.ts",
        config: { search: true },
      },
    );

    expect(result.docs).toEqual({
      enabled: true,
      adapter: expect.objectContaining({ id: "@farming-labs/farmjs", protocol: 1 }),
      configPath: "docs.config.ts",
      config: { entry: "docs", search: true },
    });
  });

  it("supports explicitly disabling the adapter", () => {
    expect(withDocs({}, { enabled: false }).docs).toMatchObject({
      enabled: false,
      adapter: { id: "@farming-labs/farmjs", protocol: 1 },
    });
  });
});

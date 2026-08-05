import { describe, expect, it } from "vitest";
import { withDocs } from "./config.js";

describe("withDocs", () => {
  it("enables Farm docs without mutating the input config", () => {
    const input = { preset: "vercel" } as const;
    const result = withDocs(input);

    expect(result).toEqual({ preset: "vercel", docs: { enabled: true } });
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
      configPath: "docs.config.ts",
      config: { entry: "docs", search: true },
    });
  });

  it("supports explicitly disabling the adapter", () => {
    expect(withDocs({}, { enabled: false }).docs).toEqual({ enabled: false });
  });
});

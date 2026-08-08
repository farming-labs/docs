import { describe, expect, it } from "vitest";
import { normalizeDocsModuleKey, resolveDocsModule } from "./module-map.js";

describe("Farm docs module map", () => {
  it("normalizes Vite module keys", () => {
    expect(normalizeDocsModuleKey("./docs\\guide/page.mdx")).toBe("/docs/guide/page.mdx");
  });

  it("resolves route-relative module keys directly", () => {
    const module = { default: "direct" };

    expect(resolveDocsModule({ "/guide/page.mdx": module }, "/guide/page.mdx")).toBe(module);
  });

  it("resolves production Vite keys by their route-relative suffix", () => {
    const module = { default: "production" };

    expect(
      resolveDocsModule(
        { "/src/app/docs/getting-started/page.md": module },
        "/getting-started/page.md",
      ),
    ).toBe(module);
  });

  it("does not guess when multiple content roots have the same source path", () => {
    expect(
      resolveDocsModule(
        {
          "/src/app/docs/guide/page.mdx": { default: "primary" },
          "/fixtures/docs/guide/page.mdx": { default: "fixture" },
        },
        "/guide/page.mdx",
      ),
    ).toBeUndefined();
  });
});

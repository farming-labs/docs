import { compile } from "@mdx-js/mdx";
import { defaultShikiFactory, wasmShikiFactory } from "fumadocs-core/highlight/shiki/full";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFarmDocsMdxCompileOptions } from "./vite.js";

// Its own file, so the highlighter starts with nothing loaded, as on a page that compiles first.
describe("docs code highlighting", () => {
  afterEach(() => vi.restoreAllMocks());

  it("highlights embedded frontmatter the same no matter which page compiles first", async () => {
    const javascript = vi.spyOn(defaultShikiFactory, "getOrInit");
    const oniguruma = vi.spyOn(wasmShikiFactory, "getOrInit");
    const source = ["```mdx", "---", 'title: "Hello"', "---", "", "# Hello", "```"].join("\n");

    const output = String(await compile(source, createFarmDocsMdxCompileOptions()));

    // The YAML key colour, not the plain-text fallback used before the grammar loads.
    expect(output).toMatch(/"--shiki-light":\s*"#22863A"[^}]*}[^}]*children:\s*"title"/);
    expect(output).toContain("--shiki-dark");
    expect(oniguruma).toHaveBeenCalledOnce();
    expect(javascript).not.toHaveBeenCalled();
  });
});

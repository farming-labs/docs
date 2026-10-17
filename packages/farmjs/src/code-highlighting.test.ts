import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { createFarmDocsMdxCompileOptions } from "./vite.js";

// Its own file, so the highlighter starts with nothing loaded, as on a page that compiles first.
describe("docs code highlighting", () => {
  it("highlights embedded frontmatter the same no matter which page compiles first", async () => {
    const source = ["```mdx", "---", 'title: "Hello"', "---", "", "# Hello", "```"].join("\n");

    const output = String(await compile(source, createFarmDocsMdxCompileOptions()));

    // The YAML key colour, not the plain-text fallback used before the grammar loads.
    expect(output).toMatch(/"--shiki-light":\s*"#22863A"[^}]*}[^}]*children:\s*"title"/);
  });
});

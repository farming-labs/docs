import { describe, expect, it } from "vitest";
import { resolveDocsMdxOptions } from "./mdx-options.js";
import type { DocsMdxOptions, DocsMdxPlugin } from "./types.js";

describe("resolveDocsMdxOptions", () => {
  it("resolves omitted and empty options to no plugins", () => {
    const empty = { remarkPlugins: [], rehypePlugins: [], codeHighlighter: undefined };
    expect(resolveDocsMdxOptions(undefined)).toEqual(empty);
    expect(resolveDocsMdxOptions({})).toEqual(empty);
  });

  it("keeps module names, paths and JSON options in order", () => {
    const options: DocsMdxOptions = {
      remarkPlugins: ["remark-directive", ["./lib/remark-docs.mjs", { nested: [true, 1, null] }]],
      rehypePlugins: [["rehype-external-links"]],
      codeHighlighter: ["./lib/highlight.mjs", { theme: "github-dark" }],
    };
    expect(resolveDocsMdxOptions(options)).toEqual({
      remarkPlugins: options.remarkPlugins,
      rehypePlugins: options.rehypePlugins,
      codeHighlighter: options.codeHighlighter,
    });
  });

  it("copies tuples and nested options before a loader mutates them", () => {
    const original: DocsMdxPlugin = ["remark-custom", { nested: [1] }];
    const copied = resolveDocsMdxOptions({ remarkPlugins: [original] }).remarkPlugins[0] as any;
    copied[0] = () => {};
    copied[1].nested.push(2);
    expect(original).toEqual(["remark-custom", { nested: [1] }]);
  });

  it.each([
    () => {},
    "",
    " ",
    ["plugin", () => {}],
    ["plugin", { callback: () => {} }],
    ["plugin", new Date()],
    ["plugin", { value: Infinity }],
    ["plugin", {}, {}],
  ])("rejects non-portable plugin configuration %#", (plugin) => {
    expect(() => resolveDocsMdxOptions({ remarkPlugins: [plugin as DocsMdxPlugin] })).toThrow(
      /MDX plugin/,
    );
  });

  it("rejects circular options", () => {
    const options: any = {};
    options.self = options;
    expect(() => resolveDocsMdxOptions({ codeHighlighter: ["highlight", options] })).toThrow(
      /JSON-serializable/,
    );
  });

  it("reports every problem at once", () => {
    expect(() =>
      resolveDocsMdxOptions({
        remarkPlugin: ["remark-directive"],
        rehypePlugins: "rehype-slug",
        codeHighlighter: "",
      } as never),
    ).toThrow(
      [
        "Invalid `mdx` options:",
        "- Unknown `mdx.remarkPlugin`. Use `remarkPlugins`, `rehypePlugins` or `codeHighlighter`.",
        "- `mdx.rehypePlugins` must be an array of MDX plugins.",
        "- `mdx.codeHighlighter` must be an MDX plugin module name or path, or a [module, JSON options] tuple.",
      ].join("\n"),
    );
    expect(() => resolveDocsMdxOptions(["remark-directive"] as never)).toThrow(
      "`mdx` must be an object",
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkHeading from "./mdx-plugins/remark-heading.js";
import remarkCodeGroup from "./mdx-plugins/remark-code-group.js";
import remarkMarkdownAlternate from "./mdx-plugins/remark-markdown-alternate.js";
import rehypeToc from "./mdx-plugins/rehype-toc.js";
import rehypeCode from "./mdx-plugins/rehype-code.js";
import { withDocs } from "./config.js";
import { resolveMdxExtensions, type DocsMdxPlugin, type WithDocsOptions } from "./mdx-options.js";

const builtins: Record<string, any> = {
  "remark-gfm": remarkGfm,
  "remark-frontmatter": remarkFrontmatter,
  "remark-mdx-frontmatter": remarkMdxFrontmatter,
  "@farming-labs/next/mdx-plugins/remark-heading": remarkHeading,
  "@farming-labs/next/mdx-plugins/remark-code-group": remarkCodeGroup,
  "@farming-labs/next/mdx-plugins/remark-markdown-alternate": remarkMarkdownAlternate,
  "@farming-labs/next/mdx-plugins/rehype-toc": rehypeToc,
  "@farming-labs/next/mdx-plugins/rehype-code": rehypeCode,
};
function webpackOptions(options: WithDocsOptions = {}) {
  const config = withDocs({}, undefined, options);
  const resolved = config.webpack!({ resolve: { alias: {} }, module: { rules: [] } }, {
    defaultLoaders: { babel: {} },
  } as any);
  return resolved.module.rules[0].use[1].options;
}
async function loadPlugins(entries: DocsMdxPlugin[]) {
  return Promise.all(
    entries.map(async (entry) => {
      const [name, options] = Array.isArray(entry) ? entry : [entry];
      const plugin = builtins[name] ?? (await import(pathToFileURL(name).href)).default;
      return options === undefined ? plugin : [plugin, options];
    }),
  );
}

describe("MDX extension hooks", () => {
  let root: string;
  let cwd: string;
  beforeEach(() => {
    cwd = process.cwd();
    root = mkdtempSync(join(tmpdir(), "docs-mdx-hooks-"));
    writeFileSync(join(root, "docs.config.ts"), 'export default { entry: "docs" };');
    process.chdir(root);
  });
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it("keeps all defaults when options are omitted or empty", () => {
    expect(webpackOptions()).toEqual(webpackOptions({ mdx: {} }));
    expect(webpackOptions().rehypePlugins).toEqual([
      "@farming-labs/next/mdx-plugins/rehype-toc",
      [
        "@farming-labs/next/mdx-plugins/rehype-code",
        { themes: { light: "github-light", dark: "github-dark" } },
      ],
    ]);
  });

  it("passes the same serializable extension pipeline to Webpack and Turbopack", () => {
    const options: WithDocsOptions = {
      mdx: {
        remarkPlugins: [["remark-directive", { nested: [true, 1, null] }]],
        rehypePlugins: ["rehype-external-links"],
        codeHighlighter: ["custom-highlight", { theme: "github-dark" }],
      },
    };
    const expected = webpackOptions(options);
    vi.stubEnv("TURBOPACK", "1");
    const config = withDocs({}, undefined, options);
    const rules = Object.values(config.turbopack!.rules!).flat() as any[];
    const loader = rules
      .flatMap((rule) => rule.loaders ?? [])
      .find((item) => item.options?.remarkPlugins);
    expect(loader.options).toEqual(expected);
    expect(expected.remarkPlugins.at(-1)).toEqual(options.mdx!.remarkPlugins![0]);
    expect(expected.rehypePlugins).toEqual([
      "@farming-labs/next/mdx-plugins/rehype-toc",
      options.mdx!.codeHighlighter,
      "rehype-external-links",
    ]);
    expect(JSON.parse(JSON.stringify(loader.options))).toEqual(loader.options);
  });

  it("compiles custom plugins while preserving metadata, headings, TOC, GFM and MDX", async () => {
    const remark = join(root, "remark.mjs");
    const rehype = join(root, "rehype.mjs");
    writeFileSync(
      remark,
      `export default function(options) { return (tree) => { tree.children.push({ type: 'paragraph', children: [{type: 'text', value: options.label}] }); }; }`,
    );
    writeFileSync(
      rehype,
      `export default function() { return (tree) => { tree.children.push({ type: 'element', tagName: 'aside', properties: { 'data-extension': 'custom' }, children: [{ type: 'text', value: 'Custom rehype' }] }); }; }`,
    );
    const options = webpackOptions({
      mdx: { remarkPlugins: [[remark, { label: "Custom remark" }]], rehypePlugins: [rehype] },
    });
    const file = await compile(
      {
        path: join(root, "app/docs/page.mdx"),
        value:
          "---\ntitle: Guide\n---\n\n# Guide\n\n## Setup\n\n| Name | Value |\n| --- | --- |\n| one | two |\n\n```ts\nconst example = 1;\n```\n\n<CustomComponent />",
      },
      {
        remarkPlugins: await loadPlugins(options.remarkPlugins),
        rehypePlugins: await loadPlugins(options.rehypePlugins),
      },
    );
    const code = String(file);
    for (const marker of [
      "metadata",
      "Guide",
      "setup",
      "toc",
      "table",
      "shiki",
      "CustomComponent",
      "Custom remark",
      "data-extension",
      "Custom rehype",
    ])
      expect(code).toContain(marker);
  });

  it("copies tuples and nested options before Next mutates them", () => {
    const original: DocsMdxPlugin = ["remark-custom", { nested: [1] }];
    const copied = resolveMdxExtensions({ remarkPlugins: [original] }).remarkPlugins[0] as any;
    copied[0] = () => {};
    copied[1].nested.push(2);
    expect(original).toEqual(["remark-custom", { nested: [1] }]);
  });

  it.each([
    () => {},
    "",
    ["plugin", () => {}],
    ["plugin", { callback: () => {} }],
    ["plugin", new Date()],
    ["plugin", { value: Infinity }],
    ["plugin", {}, {}],
  ])("rejects non-portable plugin configuration %#", (plugin) => {
    expect(() => resolveMdxExtensions({ remarkPlugins: [plugin as DocsMdxPlugin] })).toThrow(/MDX/);
  });

  it("rejects circular options", () => {
    const options: any = {};
    options.self = options;
    expect(() => resolveMdxExtensions({ codeHighlighter: ["highlight", options] })).toThrow(/JSON/);
  });
});

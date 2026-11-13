import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile, run } from "@mdx-js/mdx";
import * as jsxRuntime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkHeading from "./mdx-plugins/remark-heading.js";
import remarkCodeGroup from "./mdx-plugins/remark-code-group.js";
import remarkMarkdownAlternate from "./mdx-plugins/remark-markdown-alternate.js";
import rehypeToc from "./mdx-plugins/rehype-toc.js";
import rehypeCode from "./mdx-plugins/rehype-code.js";
import { withDocs } from "./config.js";
import type { DocsMdxPlugin, WithDocsOptions } from "./mdx-options.js";

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
function webpackOptions(
  options: WithDocsOptions = {},
  docsConfig?: Parameters<typeof withDocs>[1],
) {
  const config = withDocs({}, docsConfig, options);
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

  it("preserves TOML metadata when an app enables TOML frontmatter", async () => {
    const options = webpackOptions({
      mdx: { remarkPlugins: [["remark-frontmatter", ["yaml", "toml"]]] },
    });
    const output = String(
      await compile(
        '+++\ntitle = "Guide"\nenabled = true\n[build]\nretries = 3\n[[links]]\nlabel = "Install"\nurl = "/docs/install"\n+++\n\n# Guide',
        {
          outputFormat: "function-body",
          remarkPlugins: await loadPlugins(options.remarkPlugins),
          rehypePlugins: await loadPlugins(options.rehypePlugins),
        },
      ),
    );

    const { metadata } = await run(output, { ...jsxRuntime, baseUrl: import.meta.url });
    expect(metadata).toEqual({
      title: "Guide",
      enabled: true,
      build: { retries: 3 },
      links: [{ label: "Install", url: "/docs/install" }],
    });
  });

  it("reads mdx from the docs config like the deprecated withDocs option", () => {
    const mdx = {
      remarkPlugins: [["remark-directive", { nested: [true] }] as DocsMdxPlugin],
      codeHighlighter: "custom-highlight",
    };
    const fromConfig = webpackOptions({}, { mdx });

    expect(fromConfig).toEqual(webpackOptions({ mdx }));
    expect(fromConfig).toEqual(webpackOptions({ mdx }, { mdx: undefined }));
    expect(fromConfig.remarkPlugins.at(-1)).toEqual(mdx.remarkPlugins[0]);
    expect(fromConfig.rehypePlugins[1]).toBe("custom-highlight");
  });

  it("resolves relative plugin paths from the app root", () => {
    const options = webpackOptions(
      {},
      { mdx: { remarkPlugins: [["./lib/remark.mjs", { a: 1 }]], codeHighlighter: "../hl.mjs" } },
    );
    expect(options.remarkPlugins.at(-1)).toEqual([join(process.cwd(), "lib/remark.mjs"), { a: 1 }]);
    expect(options.rehypePlugins[1]).toBe(join(process.cwd(), "../hl.mjs"));
  });

  it("rejects mdx set in both the docs config and the withDocs options", () => {
    expect(() =>
      webpackOptions({ mdx: { rehypePlugins: ["a"] } }, { mdx: { rehypePlugins: ["b"] } }),
    ).toThrow("Set `mdx` in docs.config or in the `withDocs` options, not both.");
  });

  it("asks for the live config when docs.config sets mdx", () => {
    writeFileSync(
      join(root, "docs.config.ts"),
      'export default { entry: "docs", mdx: { remarkPlugins: ["./lib/remark-docs.mjs"] } };',
    );
    expect(() => webpackOptions()).toThrow(
      "docs.config.ts sets `mdx`, which withDocs reads from the live config. Pass it: withDocs(nextConfig, docsConfig).",
    );
    expect(() => webpackOptions({}, { mdx: undefined })).not.toThrow();
  });

  it("surfaces invalid plugin configuration from the docs config", () => {
    expect(() =>
      webpackOptions({}, { mdx: { remarkPlugins: [["plugin", { callback: () => {} }] as never] } }),
    ).toThrow(/JSON-serializable/);
  });
});

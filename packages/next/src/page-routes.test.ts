import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compile, run } from "@mdx-js/mdx";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkHeading from "./mdx-plugins/remark-heading.js";
import rehypeToc from "./mdx-plugins/rehype-toc.js";
import rehypePageBoundary from "./mdx-plugins/rehype-page-boundary.js";
import { discoverDocsPageRoutes, supportsDocsPageBoundary } from "./page-routes.js";

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true });
});

describe("page metadata boundaries", () => {
  it("selects ordinary MDX routes and leaves custom route layouts intact", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-page-routes-"));
    temporary.push(root);
    for (const file of [
      "page.mdx",
      "guide/page.md",
      "custom/page.tsx",
      "custom/child/page.mdx",
      "custom/layout.tsx",
      "[slug]/page.mdx",
      "(group)/page.mdx",
      "_private/page.mdx",
      "@slot/page.mdx",
      "duplicate/page.md",
      "duplicate/page.mdx",
      "template/template.jsx",
      "template/page.mdx",
      "authored/page.mdx",
    ]) {
      const path = join(root, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        file === "authored/page.mdx" ? "export default CustomLayout\n\n# Authored" : "# Example",
      );
    }
    expect(
      discoverDocsPageRoutes(root, "/handbook")
        .map((page) => page.route)
        .sort(),
    ).toEqual(["/handbook", "/handbook/guide"]);
    expect(
      discoverDocsPageRoutes(root, "")
        .map((page) => page.route)
        .sort(),
    ).toEqual(["/", "/guide"]);
  });

  it("ignores exports inside fenced examples", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-page-fences-"));
    temporary.push(root);
    writeFileSync(
      join(root, "page.mdx"),
      "# Example\n\n```tsx\nexport default function Page() {}\n```\n\n~~~ts\nexport const config = {};\n~~~",
    );
    expect(discoverDocsPageRoutes(root, "/docs").map((page) => page.route)).toEqual(["/docs"]);
  });

  it("keeps exports after imports or comments on the existing transport", async () => {
    const root = mkdtempSync(join(tmpdir(), "docs-page-exports-"));
    temporary.push(root);
    for (const module of [
      'import Layout from "./layout"; export default Layout;',
      'import Layout from "./layout"; /* Keep this layout. */ export default Layout;',
    ]) {
      const document = `${module}\n\n# Example`;
      await compile(document);
      writeFileSync(join(root, "page.mdx"), document);
      expect(discoverDocsPageRoutes(root, "/docs")).toEqual([]);
    }
  });

  it("uses legacy transport when the installed theme lacks the page boundary export", () => {
    for (const supported of [false, true]) {
      const root = mkdtempSync(join(tmpdir(), "docs-page-peer-"));
      temporary.push(root);
      const theme = join(root, "node_modules/@farming-labs/theme");
      mkdirSync(theme, { recursive: true });
      writeFileSync(join(theme, "index.mjs"), "export {};");
      writeFileSync(
        join(theme, "package.json"),
        JSON.stringify({
          name: "@farming-labs/theme",
          exports: supported ? { "./internal/page": "./index.mjs" } : { ".": "./index.mjs" },
        }),
      );
      expect(supportsDocsPageBoundary(root)).toBe(supported);
    }
  });

  it("compiles metadata, imports, headings and TOC without changing their values", async () => {
    const source = "/repo/app/docs/guide/page.mdx";
    const document = {
      path: source,
      value:
        '---\ntitle: Guide\n---\n\nimport { Note } from "./note";\n\n# Guide\n\n## Setup\n\n<Note>Preserved content</Note>',
    };
    const plugins = [
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: "metadata" }],
      remarkHeading,
    ] as any[];
    const output = String(
      await compile(document, {
        remarkPlugins: plugins,
        rehypePlugins: [
          rehypeToc,
          [rehypePageBoundary, { pages: [{ source, route: "/docs/guide" }] }],
        ],
      }),
    );
    expect(output).toContain('from "@farming-labs/next/internal/page"');
    expect(output).toContain('from "./note"');
    expect(output).toContain('route: "/docs/guide"');
    expect(output).toContain('"title": "Guide"');
    expect(output).toContain('id: "setup"');
    expect(output).toContain("export let toc");
    expect(output).toContain('url: "#setup"');
    expect(output).toContain("Preserved content");
    const normal = String(await compile(document, { remarkPlugins: plugins }));
    const skipped = String(
      await compile(document, { remarkPlugins: plugins, rehypePlugins: [rehypePageBoundary] }),
    );
    expect(skipped).toBe(normal);
  });
  it("preserves exact rendered HTML, including whitespace between blocks", async () => {
    const source = "/repo/app/docs/page.mdx";
    const document = {
      path: source,
      value:
        "---\ntitle: Example\n---\n\n# Heading\n\nParagraph **bold**.\n\n- One\n- Two\n\n```ts\nexport const value = 1;\n```\n\n## Next",
    };
    const mockBoundary = () => (tree: { children: any[] }) => {
      for (const node of tree.children) {
        for (const statement of node.data?.estree?.body ?? []) {
          if (
            statement.type === "ImportDeclaration" &&
            statement.source.value === "@farming-labs/next/internal/page"
          ) {
            statement.source.value =
              "data:text/javascript,export function DocsPageBoundary(props) { return props.children; }";
          }
        }
      }
    };
    const render = async (wrapped: boolean) => {
      const result = await compile(document, {
        outputFormat: "function-body",
        remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: "metadata" }]],
        rehypePlugins: wrapped
          ? [[rehypePageBoundary, { pages: [{ source, route: "/docs" }] }], mockBoundary]
          : [],
      });
      const module = await run(String(result), { ...jsxRuntime, baseUrl: import.meta.url });
      return renderToStaticMarkup(createElement(module.default));
    };
    expect(await render(true)).toBe(await render(false));
  });
});

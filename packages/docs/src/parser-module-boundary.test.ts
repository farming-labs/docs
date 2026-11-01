import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import * as core from "./index.js";
import * as mdx from "./mdx.js";
import * as server from "./server.js";

describe("published parse-only entrypoints", () => {
  it("preserves the MDX helper exports and their existing identities", () => {
    expect(Object.keys(mdx).sort()).toEqual([
      "applyDocsMarkdownHeadingAnchors",
      "encodeDocsHeadingTocUrls",
      "isolateDocsMarkdownPromptReferences",
      "remarkCodeGroup",
      "toDocsMarkdownUrl",
      "withDocsMarkdownRenderableHeadings",
    ]);
    for (const [name, helper] of Object.entries(mdx)) {
      expect(helper).toBe(({ ...core, ...server } as Record<string, unknown>)[name]);
    }
  });

  it.each(["index", "server", "runtime", "mdx", "markdown-rendering"])(
    "%s only loads parsing dependencies when it accepts raw Markdown",
    (entry) => {
      const modules = new Set<string>();
      const external = new Set<string>();
      function visit(path: string) {
        if (modules.has(path)) return;
        modules.add(path);
        const ast = ts.createSourceFile(
          path,
          readFileSync(path, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        for (const node of ast.statements) {
          if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
          if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
          const name = node.moduleSpecifier.text;
          if (name.startsWith(".")) visit(resolve(dirname(path), name));
          else external.add(name);
        }
      }
      visit(fileURLToPath(new URL(`../dist/${entry}.mjs`, import.meta.url)));
      expect([...external]).not.toContain("@mdx-js/mdx");
      if (entry === "mdx") {
        for (const dependency of ["remark-parse", "remark-mdx", "remark-gfm", "unified"]) {
          expect([...external]).not.toContain(dependency);
        }
      } else {
        expect([...external]).toContain("remark-parse");
      }
    },
  );
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";

describe("published parse-only entrypoints", () => {
  it.each(["index", "server", "runtime", "mdx", "markdown-rendering"])(
    "%s does not load the MDX compiler through its static imports",
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
      expect([...external]).toContain("remark-parse");
    },
  );
});

import { readFileSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";

describe("published browser module boundary", () => {
  it("does not import the MDX compiler or server discovery through telemetry", () => {
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
    visit(fileURLToPath(new URL("../dist/browser.mjs", import.meta.url)));
    expect([...external]).not.toContain("@mdx-js/mdx");
    expect([...external].filter((name) => name.startsWith("node:"))).toEqual([]);
    expect([...modules].map((path) => basename(path))).not.toContain("agent.mjs");
    expect([...modules].map((path) => basename(path))).not.toContain("content-changes.mjs");
  });
});

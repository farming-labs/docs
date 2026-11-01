import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as config from "./config.js";
import * as core from "./index.js";

describe("configuration entry", () => {
  it("preserves the helpers available from the root entry", () => {
    for (const [name, value] of Object.entries(config)) {
      expect(value).toBe(core[name as keyof typeof core]);
    }
    const onCopyClick = () => {};
    const theme = config.createTheme({
      name: "test",
      ui: { colors: { primary: "red", background: "white" } },
    });
    const resolved = config.defineDocs({
      entry: "docs",
      theme: theme({ ui: { colors: { primary: "blue" } } }),
      onCopyClick,
    });
    expect(resolved.entry).toBe("docs");
    expect(resolved.onCopyClick).toBe(onCopyClick);
    expect(resolved.theme?.ui?.colors).toEqual({ primary: "blue", background: "white" });
    expect(resolved.theme?._userColorOverrides).toEqual({ primary: "blue" });
    expect(theme().ui?.colors?.primary).toBe("red");
  });

  it("loads only configuration helpers in the published module graph", () => {
    const modules = new Set<string>();
    const external = new Set<string>();
    function visit(path: string) {
      if (modules.has(path)) return;
      modules.add(path);
      const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest);
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith(".")) visit(resolve(dirname(path), specifier));
        else external.add(specifier);
      }
    }
    visit(fileURLToPath(new URL("../dist/config.mjs", import.meta.url)));
    expect([...external]).toEqual([]);
    expect([...modules].map((path) => basename(path)).sort()).toEqual([
      "config.mjs",
      "create-theme.mjs",
      "define-docs.mjs",
      "utils.mjs",
    ]);
  });
});

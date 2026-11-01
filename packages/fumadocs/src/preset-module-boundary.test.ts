import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("published theme presets", () => {
  for (const directory of ["fumadocs", "astro-theme", "svelte-theme", "nuxt-theme"]) {
    const root = fileURLToPath(new URL(`../../${directory}/`, import.meta.url));
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const presets = Object.entries(manifest.exports).filter(([, value]) => {
      const entry = (value as { import?: string }).import;
      return entry && (/^\.\/dist\/[^/]+\/index\.mjs$/.test(entry) || entry.includes("/themes/"));
    });
    it.each(presets)(`${manifest.name}%s keeps runtime code out of configuration`, (_, value) => {
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
          else if (specifier.startsWith("@farming-labs/docs")) {
            visit(createRequire(path).resolve(specifier));
          } else external.add(specifier);
        }
      }
      visit(resolve(root, (value as { import: string }).import));
      expect([...external]).toEqual([]);
      const coreModules = [...modules].filter((path) => path.includes("/docs/dist/"));
      expect(coreModules.map((path) => basename(path)).sort()).toEqual([
        "config.mjs",
        "create-theme.mjs",
        "define-docs.mjs",
        "utils.mjs",
      ]);
    });
  }
});

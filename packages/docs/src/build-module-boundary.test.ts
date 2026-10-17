import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import * as build from "./build.js";
import * as core from "./index.js";
import * as server from "./server.js";

describe("adapter build entry", () => {
  it("re-exports the same constants and helpers as existing entrypoints", () => {
    for (const [name, value] of Object.entries(build)) {
      expect(value).toBe(({ ...core, ...server } as Record<string, unknown>)[name]);
    }
  });

  it("keeps runtime, MDX compilation and OpenAPI out of the published import graph", () => {
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
    visit(fileURLToPath(new URL("../dist/build.mjs", import.meta.url)));
    for (const name of [
      "index.mjs",
      "server.mjs",
      "agent.mjs",
      "mcp.mjs",
      "openapi-operations.mjs",
      "audience.mjs",
    ]) {
      expect([...modules].map((path) => basename(path))).not.toContain(name);
    }
    expect([...external]).not.toContain("@mdx-js/mdx");
    expect([...external]).not.toContain("zod");
  });
});

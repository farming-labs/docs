import React from "react";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DocsConfig } from "@farming-labs/docs";
import { DocsCommandSearch } from "./docs-command-search.js";
import { createDocsLayout } from "./docs-layout.js";
import { TanstackDocsLayout } from "./tanstack-layout.js";

function countCommandSearch(node: React.ReactNode): number {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return 0;
  return (
    (node.type === DocsCommandSearch ? 1 : 0) +
    React.Children.toArray(node.props.children).reduce<number>(
      (sum, child) => sum + countCommandSearch(child),
      0,
    )
  );
}

const cases: { name: string; ai?: DocsConfig["ai"]; staticExport?: boolean; command: number }[] = [
  { name: "AI omitted", command: 1 },
  { name: "AI disabled", ai: { enabled: false, mode: "search" }, command: 1 },
  { name: "floating AI", ai: { enabled: true, mode: "floating" }, command: 1 },
  { name: "default AI mode", ai: { enabled: true }, command: 0 },
  { name: "AI search", ai: { enabled: true, mode: "search" }, command: 0 },
  { name: "sidebar AI search", ai: { enabled: true, mode: "sidebar-icon" }, command: 0 },
  {
    name: "static export",
    ai: { enabled: true, mode: "floating" },
    staticExport: true,
    command: 0,
  },
];

let originalCwd: string;
let directory: string;
beforeAll(() => {
  originalCwd = process.cwd();
  directory = mkdtempSync(join(tmpdir(), "docs-search-mode-"));
  mkdirSync(join(directory, "app", "docs"), { recursive: true });
  writeFileSync(join(directory, "app", "docs", "page.mdx"), "# Docs\n");
  process.chdir(directory);
});
afterAll(() => {
  process.chdir(originalCwd);
  rmSync(directory, { recursive: true, force: true });
});

for (const adapter of ["Next", "TanStack", "browser"] as const) {
  describe(`${adapter} search ownership`, () => {
    it.each(cases)(
      "renders the appropriate search handler for $name",
      ({ ai, staticExport, command }) => {
        const config: DocsConfig = { entry: "docs", ai, staticExport };
        const children = React.createElement("p", null, "Content");
        const rendered =
          adapter === "Next"
            ? createDocsLayout(config)({ children })
            : TanstackDocsLayout({
                config,
                tree: { name: "Docs", children: [] },
                children,
                browserRuntime: adapter === "browser",
              });
        expect(countCommandSearch(rendered)).toBe(command);
      },
    );
  });
}

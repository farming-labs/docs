import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withDocs } from "./config.js";

let root: string;
let originalCwd: string;
beforeEach(() => {
  originalCwd = process.cwd();
  root = mkdtempSync(join(tmpdir(), "docs-metadata-config-"));
  mkdirSync(join(root, "app/docs/guide"), { recursive: true });
  writeFileSync(
    join(root, "docs.config.ts"),
    'export default { entry: "docs", telemetry: false };',
  );
  writeFileSync(join(root, "app/docs/page.mdx"), "# Docs");
  writeFileSync(join(root, "app/docs/guide/page.mdx"), "# Guide");
  const theme = join(root, "node_modules/@farming-labs/theme");
  mkdirSync(theme, { recursive: true });
  writeFileSync(join(theme, "index.mjs"), "export {};");
  writeFileSync(
    join(theme, "package.json"),
    JSON.stringify({ exports: { "./internal/page": "./index.mjs" } }),
  );
  process.chdir(root);
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true });
});

it("selects page transport in production, including static export", () => {
  for (const config of [{}, { output: "export" as const }]) {
    expect(JSON.parse(withDocs(config).env!.FARMING_DOCS_PAGE_ROUTES!)).toEqual([
      "/docs",
      "/docs/guide",
    ]);
  }
});
it("keeps development, explicit site mode and base paths on the existing transport", () => {
  expect(
    withDocs({}, undefined, { pageMetadata: "site" }).env?.FARMING_DOCS_PAGE_ROUTES,
  ).toBeUndefined();
  expect(withDocs({ basePath: "/handbook" }).env?.FARMING_DOCS_PAGE_ROUTES).toBeUndefined();
  vi.stubEnv("NODE_ENV", "development");
  expect(withDocs().env?.FARMING_DOCS_PAGE_ROUTES).toBeUndefined();
});
it("keeps custom layouts and authored exports on the existing transport", () => {
  writeFileSync(join(root, "app/docs/guide/page.mdx"), "export default CustomLayout\n\n# Guide");
  expect(JSON.parse(withDocs().env!.FARMING_DOCS_PAGE_ROUTES!)).toEqual(["/docs"]);
  writeFileSync(
    join(root, "app/docs/layout.tsx"),
    "export default function Layout({children}) { return children; }",
  );
  expect(withDocs().env?.FARMING_DOCS_PAGE_ROUTES).toBeUndefined();
});
it("rejects invalid transport options", () => {
  expect(() => withDocs({}, undefined, { pageMetadata: "unknown" as "auto" })).toThrow(
    'Use "auto" or "site"',
  );
});

it("keeps customized generated layout nesting on the existing transport", () => {
  expect(withDocs().env?.FARMING_DOCS_PAGE_ROUTES).toBeDefined();
  const layout = join(root, "app/docs/layout.tsx");
  writeFileSync(layout, readFileSync(layout, "utf8").replace(/^\/\/ Auto-generated[^\n]*\n/, ""));
  expect(withDocs().env?.FARMING_DOCS_PAGE_ROUTES).toBeDefined();
  writeFileSync(
    layout,
    readFileSync(layout, "utf8").replace(
      "<DocsLayout>{children}</DocsLayout>",
      '<DocsLayout><section className="custom-content">{children}</section></DocsLayout>',
    ),
  );
  expect(withDocs().env?.FARMING_DOCS_PAGE_ROUTES).toBeUndefined();
});

it("keeps custom MDX providers and compiler extensions on the existing transport", () => {
  expect(
    withDocs({}, undefined, { mdx: { remarkPlugins: ["custom-plugin"] } }).env
      ?.FARMING_DOCS_PAGE_ROUTES,
  ).toBeUndefined();
  writeFileSync(
    join(root, "mdx-components.tsx"),
    "export function useMDXComponents() { return { wrapper: CustomWrapper }; }",
  );
  expect(withDocs().env?.FARMING_DOCS_PAGE_ROUTES).toBeUndefined();
});

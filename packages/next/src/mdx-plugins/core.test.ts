import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirs: string[] = [];
const loader = transpileModule(
  readFileSync(fileURLToPath(new URL("./core.ts", import.meta.url)), "utf8"),
  {
    compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
  },
).outputText;
const names = [
  "remarkCodeGroup",
  "toDocsMarkdownUrl",
  "applyDocsMarkdownHeadingAnchors",
  "encodeDocsHeadingTocUrls",
  "withDocsMarkdownRenderableHeadings",
  "isolateDocsMarkdownPromptReferences",
];
const exportsFor = (value: string) =>
  names.map((name) => `export const ${name} = ${JSON.stringify(value)};`).join("\n");

function loadWithCore(exports: Record<string, string>, files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "docs-mdx-entry-"));
  temporaryDirs.push(dir);
  const core = join(dir, "node_modules/@farming-labs/docs");
  mkdirSync(core, { recursive: true });
  writeFileSync(join(core, "package.json"), JSON.stringify({ type: "module", exports }));
  for (const [name, source] of Object.entries(files)) writeFileSync(join(core, name), source);
  const path = join(dir, "loader.mjs");
  writeFileSync(path, loader);
  return () =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `const helpers = await import(${JSON.stringify(pathToFileURL(path).href)}); console.log(JSON.stringify(helpers));`,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("MDX compiler core entry", () => {
  it("loads compiler helpers without evaluating the root or server barrels", () => {
    const load = loadWithCore(
      { ".": "./root.mjs", "./server": "./server.mjs", "./mdx": "./mdx.mjs" },
      {
        "root.mjs": 'throw new Error("root barrel evaluated");',
        "server.mjs": 'throw new Error("server barrel evaluated");',
        "mdx.mjs": exportsFor("compiler"),
      },
    );
    expect(load()).toEqual(Object.fromEntries(names.map((name) => [name, "compiler"])));
  });

  it("keeps older core packages without the compiler export working", () => {
    const load = loadWithCore(
      { ".": "./root.mjs", "./server": "./server.mjs" },
      {
        "root.mjs": exportsFor("legacy"),
        "server.mjs": 'export const remarkCodeGroup = "legacy code group";',
      },
    );
    expect(load()).toEqual({
      ...Object.fromEntries(names.map((name) => [name, "legacy"])),
      remarkCodeGroup: "legacy code group",
    });
  });

  it("supports older focused entries without the URL helper", () => {
    const load = loadWithCore(
      { ".": "./root.mjs", "./server": "./server.mjs", "./mdx": "./mdx.mjs" },
      {
        "root.mjs": 'export const toDocsMarkdownUrl = "legacy URL";',
        "server.mjs": 'throw new Error("server barrel evaluated");',
        "mdx.mjs": names
          .filter((name) => name !== "toDocsMarkdownUrl")
          .map((name) => `export const ${name} = "compiler";`)
          .join("\n"),
      },
    );
    expect(load()).toEqual({
      ...Object.fromEntries(names.map((name) => [name, "compiler"])),
      toDocsMarkdownUrl: "legacy URL",
    });
  });

  it.each([
    ["missing compiler file", undefined, "ERR_MODULE_NOT_FOUND"],
    ["compiler evaluation failure", 'throw new Error("compiler failed");', "compiler failed"],
    [
      "missing compiler dependency",
      'import "missing-compiler-dependency";',
      "ERR_MODULE_NOT_FOUND",
    ],
  ])("does not hide a %s with a legacy fallback", (_label, source, message) => {
    const load = loadWithCore(
      { ".": "./root.mjs", "./server": "./server.mjs", "./mdx": "./mdx.mjs" },
      {
        "root.mjs": exportsFor("legacy"),
        "server.mjs": exportsFor("legacy"),
        ...(source ? { "mdx.mjs": source } : {}),
      },
    );
    expect(load).toThrow(message);
  });
});

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirs: string[] = [];
const loader = transpileModule(
  readFileSync(fileURLToPath(new URL("./mdx-core.ts", import.meta.url)), "utf8"),
  {
    compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
  },
).outputText;
const names = [
  "remarkCodeGroup",
  "applyDocsMarkdownHeadingAnchors",
  "encodeDocsHeadingTocUrls",
  "withDocsMarkdownRenderableHeadings",
  "isolateDocsMarkdownPromptReferences",
];
const exportsFor = (value: string) =>
  names.map((name) => `export const ${name} = ${JSON.stringify(value)};`).join("\n");

function loadWithCore(
  exports: Record<string, string>,
  files: Record<string, string>,
  mode: "import" | "require" | "concurrent import" = "import",
) {
  const dir = mkdtempSync(join(tmpdir(), "farm-docs-mdx-entry-"));
  temporaryDirs.push(dir);
  const core = join(dir, "node_modules/@farming-labs/docs");
  mkdirSync(core, { recursive: true });
  writeFileSync(join(core, "package.json"), JSON.stringify({ type: "module", exports }));
  for (const [name, source] of Object.entries(files)) writeFileSync(join(core, name), source);
  const path = join(dir, "loader.mjs");
  writeFileSync(path, loader);
  // Stands in for the docs theme, which imports the compiler entry while Farm loads the config.
  const theme = join(dir, "theme.mjs");
  writeFileSync(theme, 'export * from "@farming-labs/docs/mdx";');
  const scripts = {
    import: `const helpers = await import(${JSON.stringify(pathToFileURL(path).href)});`,
    require: `import {createRequire} from 'node:module'; const helpers = createRequire(import.meta.url)(${JSON.stringify(path)});`,
    "concurrent import": `const [, helpers] = await Promise.all([import(${JSON.stringify(pathToFileURL(theme).href)}), import(${JSON.stringify(pathToFileURL(path).href)})]);`,
  };
  return () =>
    JSON.parse(
      execFileSync(
        process.execPath,
        ["--input-type=module", "-e", `${scripts[mode]} console.log(JSON.stringify(helpers));`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("MDX compiler core entry", () => {
  it.each(["import", "require"] as const)("loads only compiler helpers (%s)", (mode) => {
    const load = loadWithCore(
      { ".": "./root.mjs", "./server": "./server.mjs", "./mdx": "./mdx.mjs" },
      {
        "root.mjs": 'throw new Error("root barrel evaluated");',
        "server.mjs": 'throw new Error("server barrel evaluated");',
        "mdx.mjs": exportsFor("compiler"),
      },
      mode,
    );
    expect(load()).toEqual(Object.fromEntries(names.map((name) => [name, "compiler"])));
  });

  it("loads while another module is still importing the compiler entry", () => {
    // Node 22.13 crashed here when the adapter required the entry that the other import was
    // loading. The race does not fail every run, so try it a few times.
    const load = loadWithCore(
      { ".": "./root.mjs", "./server": "./server.mjs", "./mdx": "./mdx.mjs" },
      {
        "root.mjs": 'throw new Error("root barrel evaluated");',
        "server.mjs": 'throw new Error("server barrel evaluated");',
        "mdx.mjs": exportsFor("compiler"),
      },
      "concurrent import",
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(load()).toEqual(Object.fromEntries(names.map((name) => [name, "compiler"])));
    }
  });

  it("fails clearly with a core older than the supported range", () => {
    const load = loadWithCore(
      { ".": "./root.mjs", "./server": "./server.mjs" },
      {
        "root.mjs": exportsFor("legacy"),
        "server.mjs": 'export const remarkCodeGroup = "legacy code group";',
      },
    );
    expect(load).toThrow("ERR_PACKAGE_PATH_NOT_EXPORTED");
  });

  it.each([
    ["missing compiler file", undefined, "MODULE_NOT_FOUND"],
    [
      "compiler evaluation failure",
      `${exportsFor("compiler")}\nthrow new Error("compiler failed");`,
      "compiler failed",
    ],
    [
      "missing compiler dependency",
      'import "missing-compiler-dependency";',
      "ERR_MODULE_NOT_FOUND",
    ],
  ])("reports a %s instead of loading the core barrels", (_label, source, message) => {
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

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@mdx-js/mdx";
import { defaultShikiFactory, wasmShikiFactory } from "fumadocs-core/highlight/shiki/full";
import { build } from "tsdown";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rehypeCode from "./rehype-code.js";

const themes = { light: "github-light", dark: "github-dark" };

describe("build-time code highlighting", () => {
  afterEach(() => vi.restoreAllMocks());

  it("highlights both themes without initializing the JavaScript regex engine", async () => {
    const javascript = vi.spyOn(defaultShikiFactory, "getOrInit");
    const oniguruma = vi.spyOn(wasmShikiFactory, "getOrInit");
    const output = String(
      await compile('```ts title="example.ts"\nconst answer = 42; // [!code highlight]\n```', {
        rehypePlugins: [[rehypeCode, { themes }]],
      }),
    );

    expect(output).toContain("--shiki-light");
    expect(output).toContain("--shiki-dark");
    expect(output).toContain("highlighted");
    expect(output).toContain("example.ts");
    expect(oniguruma).toHaveBeenCalledOnce();
    expect(javascript).not.toHaveBeenCalled();
  });

  it("tokenizes every line completely however long it takes", async () => {
    // Shiki otherwise stops styling a line after 500 ms, which a cold worker can reach.
    const source = "```ts\nconst a = 1; const b = 2;\n```";
    const expected = String(await compile(source, { rehypePlugins: [[rehypeCode, { themes }]] }));
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));
    const slow = String(await compile(source, { rehypePlugins: [[rehypeCode, { themes }]] }));
    expect(slow).toBe(expected);
  });

  it("preserves an explicitly selected JavaScript engine", async () => {
    const javascript = vi.spyOn(defaultShikiFactory, "getOrInit");
    const oniguruma = vi.spyOn(wasmShikiFactory, "getOrInit");
    const output = String(
      await compile("```js\nconst answer = 42;\n```", {
        rehypePlugins: [[rehypeCode, { engine: "js" }]],
      }),
    );

    expect(output).toContain("shiki");
    expect(javascript).toHaveBeenCalledOnce();
    expect(oniguruma).not.toHaveBeenCalled();
  });
});

describe("code highlight cache", () => {
  let cacheDir: string;
  const entries = () =>
    readdirSync(cacheDir, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".json"),
    );
  const highlight = (source: string, options: object = { themes, cacheDir }) =>
    compile(source, { rehypePlugins: [[rehypeCode, options]] }).then(String);

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "docs-code-cache-"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("reuses highlighted blocks in later builds without starting Shiki", async () => {
    const source =
      '```ts title="a.ts"\nconst a = 1; // [!code highlight]\n```\n\n```bash\npnpm add a\n```';
    const uncached = await highlight(source, { themes });
    expect(await highlight(source)).toBe(uncached);
    expect(entries()).toHaveLength(2);

    const oniguruma = vi.spyOn(wasmShikiFactory, "getOrInit");
    expect(await highlight(source)).toBe(uncached);
    expect(oniguruma).not.toHaveBeenCalled();
  });

  it("highlights only the blocks that changed", async () => {
    await highlight("```ts\nconst a = 1;\n```");
    const source = "```ts\nconst a = 1;\n```\n\n```ts\nconst b = 2;\n```";
    expect(await highlight(source)).toBe(await highlight(source, { themes }));
    expect(entries()).toHaveLength(2);
  });

  it("does not store a block that took longer than a configured tokenize time limit", async () => {
    // Shiki leaves the rest of a line unstyled once tokenizing it takes `tokenizeTimeLimit`.
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (clock += 1_000));
    const source = "```ts\nconst a = 1;\n```";
    await highlight(source, { themes, cacheDir, tokenizeTimeLimit: 500 });
    expect(entries()).toHaveLength(0);
    // The default turns the limit off, so every line is tokenized completely.
    await highlight(source);
    expect(entries()).toHaveLength(1);
  });

  it("ignores the cache directory when an option is not plain JSON", async () => {
    const transformer = { name: "mark", pre: (node: { properties: object }) => node };
    await highlight("```ts\nconst a = 1;\n```", { themes, cacheDir, transformers: [transformer] });
    expect(entries()).toHaveLength(0);
  });

  it("treats a damaged entry as a miss and replaces it", async () => {
    const source = "```ts\nconst a = 1;\n```";
    const expected = await highlight(source);
    const [entry] = entries();
    writeFileSync(join(cacheDir, entry!), "{");
    expect(await highlight(source)).toBe(expected);
    expect(JSON.parse(readFileSync(join(cacheDir, entry!), "utf8")).fragment.type).toBe("root");
  });

  it("keeps the newest entries when a cache directory fills up", async () => {
    // Find 70 blocks whose keys land in the same of the 256 cache directories.
    const shardOf = (n: number) =>
      createHash("sha256").update(`ts::const v = ${n};\n`).digest("hex").slice(0, 2);
    const shard = shardOf(0);
    const blocks: number[] = [];
    for (let n = 0; blocks.length < 70; n++) if (shardOf(n) === shard) blocks.push(n);
    await highlight(blocks.map((n) => `\`\`\`ts\nconst v = ${n};\n\`\`\``).join("\n\n"));
    const stored = entries().filter((file) => file.split(/[/\\]/).at(-2) === shard);
    expect(stored.length).toBeGreaterThanOrEqual(48);
    expect(stored.length).toBeLessThanOrEqual(64);
  });

  it("removes cache scopes left by other options after an hour", async () => {
    const stale = join(cacheDir, "0123456789abcdef");
    const recent = join(cacheDir, "fedcba9876543210");
    mkdirSync(stale);
    mkdirSync(recent);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(stale, twoHoursAgo, twoHoursAgo);
    await highlight("```ts\nconst a = 1;\n```");
    expect(readdirSync(cacheDir)).not.toContain("0123456789abcdef");
    expect(readdirSync(cacheDir)).toContain("fedcba9876543210");
  });

  it("keys entries by highlighter options", async () => {
    const source = "```ts\nconst a = 1;\n```";
    const light = await highlight(source, { themes: { light: "github-light" }, cacheDir });
    const both = await highlight(source);
    expect(both).not.toBe(light);
    expect(entries()).toHaveLength(2);
  });
});

// Copies one traced path. pnpm links packages with symlinks, so links are recreated inside the copy
// rather than followed, or the copy would reach files the trace left out.
function copyTraced(root: string, out: string, file: string) {
  const source = join(root, file);
  const copy = join(out, file);
  mkdirSync(dirname(copy), { recursive: true });
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(source);
    const linked = isAbsolute(target)
      ? join(out, relative(root, target))
      : resolve(dirname(copy), target);
    symlinkSync(linked, copy, statSync(source).isDirectory() ? "junction" : "file");
  } else if (stat.isFile()) {
    cpSync(source, copy);
  }
}

describe("traced server output", () => {
  const packageDir = fileURLToPath(new URL("../..", import.meta.url));
  const root = resolve(packageDir, "../..");
  let buildDir: string;
  let outDir: string;

  beforeEach(() => {
    // Inside the package, so the built plugin resolves the package's own dependencies.
    mkdirSync(join(packageDir, "node_modules", ".cache"), { recursive: true });
    buildDir = mkdtempSync(join(packageDir, "node_modules", ".cache", "rehype-code-trace-"));
    outDir = mkdtempSync(join(tmpdir(), "docs-code-trace-"));
  });
  afterEach(() => {
    rmSync(buildDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  });

  // Vercel functions and Next's standalone output ship only the files Next's tracer finds by
  // following imports, not all of `node_modules`. Request-time highlighting has no cache.
  it("highlights without a cache using only the files a traced function ships", async () => {
    await build({
      config: false,
      cwd: packageDir,
      entry: { "rehype-code": "src/mdx-plugins/rehype-code.ts" },
      outDir: buildDir,
      format: "esm",
      dts: false,
      logLevel: "silent",
    });
    const entry = join(buildDir, "entry.mjs");
    writeFileSync(
      entry,
      `import { compile } from "@mdx-js/mdx";
import rehypeCode from "./rehype-code.mjs";
const source = "\`\`\`ts\\nconst a = 1;\\n\`\`\`\\n\\n\`\`\`mdx\\n# Title\\n\`\`\`";
const themes = { light: "github-light", dark: "github-dark" };
const output = String(await compile(source, { rehypePlugins: [[rehypeCode, { themes }]] }));
console.log(output.includes("--shiki-dark") ? "highlighted" : "plain");
`,
    );
    const { nodeFileTrace } = createRequire(import.meta.url)("next/dist/compiled/@vercel/nft");
    const { fileList } = (await nodeFileTrace([entry], { base: root })) as {
      fileList: Set<string>;
    };
    for (const file of fileList) copyTraced(root, outDir, file);

    const stdout = execFileSync(process.execPath, [join(outDir, relative(root, entry))], {
      encoding: "utf8",
    });
    expect(stdout.trim()).toBe("highlighted");
  }, 60_000);
});

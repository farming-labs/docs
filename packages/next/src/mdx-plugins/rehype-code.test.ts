import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "@mdx-js/mdx";
import { defaultShikiFactory, wasmShikiFactory } from "fumadocs-core/highlight/shiki/full";
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

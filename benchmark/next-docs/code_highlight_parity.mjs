// Checks that the highlighted-code cache never changes compiled MDX.
//
//   node benchmark/next-docs/code_highlight_parity.mjs [--jobs 4] [--out <file>]
//
// It compiles the benchmark corpus, the website's docs and a list of edge cases through the Next
// adapter's remark and rehype plugins from `packages/next/dist`. One process first compiles every
// file in order with an empty cache, as a build worker would. Then each file is compiled alone in
// two fresh processes, once without the cache and once with the filled cache, and the outputs must
// be identical. Build `@farming-labs/next` first.
//
// Shiki stops styling a line after `tokenizeTimeLimit`, 500 ms by default, which a cold process on a
// busy machine can reach. Both sides turn the limit off, so differences come from the cache and not
// from load. The plugin's own tests cover how the cache treats slow blocks.
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const next = join(repo, "packages/next");
const { values } = parseArgs({
  options: {
    jobs: { type: "string", default: "4" },
    out: { type: "string" },
    child: { type: "string" },
    "cache-dir": { type: "string" },
    file: { type: "string" },
  },
});

const EDGE_CASES = [
  '```ts title="a.ts" lineNumbers\nconst a = 1; // [!code highlight]\nconst b = 2; // [!code focus]\nconst c = 3; // [!code ++]\nconst d = 4; // [!code --]\n// [!code word:value]\nconst value = a;\n```',
  "```\nno language\n```",
  "```js\n```",
  "~~~python\nprint('tilde')\n~~~",
  "    indented code\n    block",
  "> ```bash\n> pnpm add a\n> ```",
  '- item\n\n  ```json\n  {"a": 1}\n  ```',
  "```tsx\nexport const X = () => <div className=\"x\">🌱 {'é'}</div>;\n```",
  "```diff\n- old\n+ new\n```",
  "```ts\n\tconst tab = 1;\n\n\n```",
  "```ts\nconst same = 1;\n```\n\n```ts\nconst same = 1;\n```",
  '```ts title="one"\nconst same = 1;\n```\n\n```ts title="two"\nconst same = 1;\n```',
  "<div>\n\n```ts\nconst inJsx = 1;\n```\n\n</div>",
  "`inline code` and ```ts\nconst x = 1;\n```",
  "```ts noCopy\nconst noCopy = 1;\n```",
  '```bash tab="npm"\nnpm i\n```',
  "```plaintext\nplain\n```",
  "```sh\necho $HOME\n```",
  "```ts-tags\nconst style = css`a { color: red; }`;\n```",
  "```ts\nconst style = css`a { color: red; }`;\n```",
  '```vue\n<template><div>{{ count }}</div></template>\n<script setup lang="ts">const count = 1;</script>\n```',
  "```svelte\n<script>let count = 1;</script>\n<p>{count}</p>\n```",
  "````md\n# Title\n\n```ts\nconst nested = 1;\n```\n````",
  "```unknown-language\nnot a grammar\n```",
  "```ansi\n\u001b[31mred\u001b[0m\n```",
];

async function sources() {
  const { corpusPage } = await import(
    pathToFileURL(join(repo, "benchmark/next-docs/prepare.mjs")).href
  );
  const files = Array.from({ length: 100 }, (_, i) => [`corpus/${i}.mdx`, corpusPage(i).source]);
  const website = execFileSync("git", ["ls-files", "--", "website/src/app/docs/*.mdx"], {
    cwd: repo,
    encoding: "utf8",
  });
  for (const file of website.trim().split("\n"))
    files.push([file, readFileSync(join(repo, file), "utf8")]);
  EDGE_CASES.forEach((source, i) => files.push([`edge/${i}.mdx`, source]));
  return files;
}

// The Next adapter's default plugin chain, as `withDocs()` configures it for `app/docs`.
async function createCompiler(cacheDir) {
  const require = createRequire(join(next, "package.json"));
  const load = async (id) => {
    const module = await import(pathToFileURL(require.resolve(id)).href);
    return module.default ?? module;
  };
  const plugin = async (name) =>
    (await import(pathToFileURL(join(next, "dist/mdx-plugins", `${name}.mjs`)).href)).default;
  const shiki = await import(
    pathToFileURL(require.resolve("fumadocs-core/highlight/shiki/full")).href
  );
  const counter = { shikiStarts: 0 };
  for (const factory of [shiki.wasmShikiFactory, shiki.defaultShikiFactory]) {
    const getOrInit = factory.getOrInit.bind(factory);
    factory.getOrInit = () => (counter.shikiStarts++, getOrInit());
  }
  const { createProcessor } = await import(pathToFileURL(require.resolve("@mdx-js/mdx")).href);
  const options = { themes: { light: "github-light", dark: "github-dark" }, tokenizeTimeLimit: 0 };
  const processor = createProcessor({
    providerImportSource: "next-mdx-import-source-file",
    development: false,
    remarkPlugins: [
      await load("remark-gfm"),
      await load("remark-frontmatter"),
      [
        await plugin("remark-markdown-alternate"),
        { entry: "docs", appDir: "app", docsPath: "/docs", enabled: true },
      ],
      [await load("remark-mdx-frontmatter"), { name: "metadata" }],
      await plugin("remark-code-group"),
      await plugin("remark-heading"),
    ],
    rehypePlugins: [
      await plugin("rehype-toc"),
      [await plugin("rehype-code"), cacheDir ? { ...options, cacheDir } : options],
    ],
  });
  return {
    counter,
    async compile(path, value) {
      try {
        const output = String(await processor.process({ path, value }));
        return createHash("sha256").update(output).digest("hex");
      } catch (error) {
        return `error: ${String(error.message).split("\n")[0]}`;
      }
    },
  };
}

if (values.child) {
  const files = await sources();
  const compiler = await createCompiler(values["cache-dir"]);
  if (values.child === "sequence") {
    for (const [path, value] of files) await compiler.compile(path, value);
    console.log(JSON.stringify({ files: files.length, shikiStarts: compiler.counter.shikiStarts }));
  } else {
    const [path, value] = files[Number(values.file)];
    const hash = await compiler.compile(path, value);
    console.log(JSON.stringify({ hash, shikiStarts: compiler.counter.shikiStarts }));
  }
} else {
  const jobs = Number(values.jobs);
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error("`--jobs` must be a positive integer.");
  const self = fileURLToPath(import.meta.url);
  const run = (args) =>
    new Promise((resolve, reject) =>
      execFile(
        process.execPath,
        [self, ...args],
        { encoding: "utf8", maxBuffer: 1 << 24 },
        (error, stdout) => (error ? reject(error) : resolve(JSON.parse(stdout))),
      ),
    );
  const cacheDir = mkdtempSync(join(tmpdir(), "docs-code-highlight-parity-"));
  try {
    const files = await sources();
    const sequence = await run(["--child", "sequence", "--cache-dir", cacheDir]);
    const rows = Array.from({ length: files.length });
    let cursor = 0;
    await Promise.all(
      Array.from({ length: jobs }, async () => {
        while (cursor < files.length) {
          const index = cursor++;
          const uncached = await run(["--child", "file", "--file", String(index)]);
          const cached = await run([
            "--child",
            "file",
            "--file",
            String(index),
            "--cache-dir",
            cacheDir,
          ]);
          rows[index] = {
            file: files[index][0],
            same: uncached.hash === cached.hash,
            error: uncached.hash.startsWith("error") ? uncached.hash : undefined,
            cachedShikiStarts: cached.shikiStarts,
          };
        }
      }),
    );
    const summary = {
      files: rows.length,
      differences: rows.filter((row) => !row.same).map((row) => row.file),
      withoutShiki: rows.filter((row) => row.cachedShikiStarts === 0).length,
      errors: rows.filter((row) => row.error).map((row) => `${row.file}: ${row.error}`),
      sequenceShikiStarts: sequence.shikiStarts,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (values.out) writeFileSync(values.out, `${JSON.stringify({ summary, rows }, null, 2)}\n`);
    if (summary.differences.length) process.exitCode = 1;
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

// Times each step of Shiki's startup in fresh Node processes, the way the Next adapter's code
// highlighter starts it in a build worker: import, regex engine, themes, two languages, the first
// highlights, and the steady state. It also times parsing a cached result, which is the work a
// highlight cache hit does instead.
//
//   node benchmark/next-docs/shiki-startup.mjs [--rounds 7] [--precompiled <dir>] [--out <file>]
//
// `--precompiled` adds Shiki's precompiled grammars with the raw JavaScript engine. The directory
// must hold `@shikijs/langs-precompiled` and `@shikijs/engine-javascript` at the version of Shiki
// that fumadocs-core resolves.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const { values } = parseArgs({
  options: {
    rounds: { type: "string", default: "7" },
    precompiled: { type: "string" },
    out: { type: "string" },
    child: { type: "string" },
  },
});
const fumadocs = realpathSync(join(repo, "packages/next/node_modules/fumadocs-core"));
const fromFumadocs = createRequire(join(fumadocs, "package.json"));

function packageVersion(require, name) {
  let directory = dirname(require.resolve(name));
  for (;;) {
    try {
      const json = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (json.name === name) return json.version;
    } catch {}
    if (directory === dirname(directory))
      throw new Error(`Could not find the package.json of ${name}.`);
    directory = dirname(directory);
  }
}

if (values.child) {
  const engine = values.child;
  const shikiPath = fromFumadocs.resolve("shiki");
  const fromPrecompiled = values.precompiled && createRequire(join(values.precompiled, "index.js"));
  const load = (require, name) => import(pathToFileURL(require.resolve(name)).href);
  const result = {};
  let last = performance.now();
  const mark = (step) => {
    const now = performance.now();
    result[step] = Number((now - last).toFixed(1));
    last = now;
  };

  const shiki = await import(pathToFileURL(shikiPath).href);
  mark("importShiki");
  const regex =
    engine === "oniguruma"
      ? await shiki.createOnigurumaEngine(
          import(pathToFileURL(fromFumadocs.resolve("shiki/wasm")).href),
        )
      : engine === "js"
        ? shiki.createJavaScriptRegexEngine()
        : (
            await load(fromPrecompiled, "@shikijs/engine-javascript/raw")
          ).createJavaScriptRawEngine();
  mark("engine");
  const highlighter = await shiki.createHighlighter({ langs: [], themes: [], engine: regex });
  mark("createHighlighter");
  await highlighter.loadTheme("github-light", "github-dark");
  mark("themes");
  const language = async (name) =>
    engine === "precompiled"
      ? (await load(fromPrecompiled, `@shikijs/langs-precompiled/${name}`)).default
      : name;
  await highlighter.loadLanguage(await language("typescript"));
  mark("loadTypeScript");
  await highlighter.loadLanguage(await language("shellscript"));
  mark("loadShell");

  const code = [
    "interface Options { retries: number; timeout: number }",
    "export async function loadTopic(options: Options) {",
    '  const response = await fetch("/api/topics/1");',
    '  if (!response.ok) throw new Error("Request failed");',
    "  return response.json();",
    "}",
  ].join("\n");
  const options = {
    lang: "ts",
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  };
  highlighter.codeToHast(code, options);
  mark("firstTypeScript");
  highlighter.codeToHast("npm install example-sdk\nexport TOPIC=1\nexample-sdk validate --strict", {
    ...options,
    lang: "bash",
  });
  mark("firstShell");
  for (let i = 0; i < 50; i++) highlighter.codeToHast(code.replace("1", String(i)), options);
  mark("next50TypeScript");
  const cached = JSON.stringify(highlighter.codeToHast(code, options));
  last = performance.now();
  for (let i = 0; i < 50; i++) JSON.parse(cached);
  mark("parse50Cached");
  result.cachedBytes = cached.length;
  console.log(JSON.stringify(result));
} else {
  const rounds = Number(values.rounds);
  if (!Number.isInteger(rounds) || rounds < 1)
    throw new Error("`--rounds` must be a positive integer.");
  const versions = { node: process.version, shiki: packageVersion(fromFumadocs, "shiki") };
  const engines = ["oniguruma", "js"];
  if (values.precompiled) {
    const fromPrecompiled = createRequire(join(values.precompiled, "index.js"));
    for (const name of ["@shikijs/langs-precompiled", "@shikijs/engine-javascript"]) {
      const version = packageVersion(fromPrecompiled, name);
      if (version !== versions.shiki)
        throw new Error(
          `${name} is ${version}, but fumadocs-core uses Shiki ${versions.shiki}. Install ${name}@${versions.shiki}.`,
        );
    }
    engines.push("precompiled");
  }

  const samples = Object.fromEntries(engines.map((engine) => [engine, []]));
  // One warmup round fills the operating system's file cache and is not counted.
  for (let round = 0; round <= rounds; round++) {
    const shift = round % engines.length;
    for (const engine of [...engines.slice(shift), ...engines.slice(0, shift)]) {
      const args = [fileURLToPath(import.meta.url), "--child", engine];
      if (values.precompiled) args.push("--precompiled", values.precompiled);
      const child = spawnSync(process.execPath, args, { encoding: "utf8" });
      if (child.status !== 0) throw new Error(`The ${engine} run failed:\n${child.stderr}`);
      if (round > 0) samples[engine].push(JSON.parse(child.stdout));
    }
  }

  const median = (list) => list.toSorted((a, b) => a - b)[Math.floor(list.length / 2)];
  const summary = {};
  for (const [engine, list] of Object.entries(samples)) {
    summary[engine] = Object.fromEntries(
      Object.keys(list[0]).map((step) => [step, median(list.map((s) => s[step]))]),
    );
    const {
      importShiki,
      engine: regex,
      createHighlighter,
      themes,
      loadTypeScript,
      loadShell,
      firstTypeScript,
    } = summary[engine];
    summary[engine].untilFirstTypeScript = Number(
      (
        importShiki +
        regex +
        createHighlighter +
        themes +
        loadTypeScript +
        loadShell +
        firstTypeScript
      ).toFixed(1),
    );
  }
  console.table(summary);
  if (values.out)
    writeFileSync(
      values.out,
      `${JSON.stringify({ versions, rounds, summary, samples }, null, 2)}\n`,
    );
}

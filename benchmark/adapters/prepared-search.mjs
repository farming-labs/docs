import { readFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { platform, release, cpus } from "node:os";
import assert from "node:assert/strict";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const base = process.argv[2] || "HEAD";
const output = resolve(process.argv[3] || "/tmp/docs-prepared-search");
mkdirSync(output, { recursive: true });
const esbuildDir = readdirSync(join(root, "node_modules/.pnpm")).find((name) =>
  name.startsWith("esbuild@"),
);
if (!esbuildDir) throw new Error("Install workspace dependencies before running this benchmark.");
const { build } = await import(
  pathToFileURL(join(root, "node_modules/.pnpm", esbuildDir, "node_modules/esbuild/lib/main.js"))
    .href
);
const source = "packages/docs/src/search.ts";
const variants = {
  before: execFileSync("git", ["show", `${base}:${source}`], { cwd: root, encoding: "utf8" }),
  after: readFileSync(join(root, source), "utf8"),
};
const modules = {};
for (const [name, contents] of Object.entries(variants)) {
  const outfile = join(output, `${name}.mjs`);
  await build({
    stdin: { contents, resolveDir: join(root, "packages/docs/src"), loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    banner: {
      js: 'import {createRequire} from "node:module"; const require = createRequire(import.meta.url);',
    },
  });
  modules[name] = await import(pathToFileURL(outfile).href);
}
const summarize = (samples) => ({
  median:
    (samples.toSorted((a, b) => a - b)[Math.floor((samples.length - 1) / 2)] +
      samples.toSorted((a, b) => a - b)[Math.floor(samples.length / 2)]) /
    2,
  p95: samples.toSorted((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1],
  samples,
});
const cases = [];
const trials = 20;
const warmups = 3;
for (const count of [100, 1000]) {
  const pages = Array.from({ length: count }, (_, i) => ({
    title: `Topic ${i}`,
    url: `/docs/topic-${i}`,
    content: "",
    rawContent: `# Topic ${i}\n\nOverview.\n\n${Array.from({ length: 6 }, (_, s) => `## Section ${s}\n\nConfigure the documentation framework with shared theme tokens. ${"Preserve page semantics and search scope. ".repeat(8)}\n\n\`\`\`ts\nconst topic = ${i};\n\`\`\``).join("\n\n")}`,
    framework: "react",
    version: "1",
    tags: ["docs"],
  }));
  const expected = modules.before.buildDocsSearchDocuments(pages);
  const samples = { before: [], after: [], controlA: [], controlB: [] };
  const measure = (name, label) => {
    const start = performance.now();
    const result = modules[name].buildDocsSearchDocuments(pages);
    const elapsed = performance.now() - start;
    assert.deepEqual(result, expected);
    samples[label].push(elapsed);
  };
  for (let i = 0; i < warmups; i++) {
    measure("before", "before");
    measure("after", "after");
  }
  for (const key of Object.keys(samples)) samples[key] = [];
  for (let i = 0; i < trials; i++) {
    for (const name of i % 2 ? ["after", "before"] : ["before", "after"]) measure(name, name);
    for (const label of i % 2 ? ["controlB", "controlA"] : ["controlA", "controlB"])
      measure("before", label);
  }
  // Fresh content objects and changed input must remain equivalent after warming.
  const changed = structuredClone(pages);
  changed[0].rawContent = "# Changed\n\nFresh text";
  changed[0].tags.push("updated");
  assert.deepEqual(
    modules.after.buildDocsSearchDocuments(changed),
    modules.before.buildDocsSearchDocuments(changed),
  );
  const summaries = Object.fromEntries(
    Object.entries(samples).map(([key, values]) => [key, summarize(values)]),
  );
  cases.push({ pages: count, documents: expected.length, ...summaries });
}
const result = {
  baseline: execFileSync("git", ["rev-parse", base], { cwd: root, encoding: "utf8" }).trim(),
  environment: {
    node: process.version,
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model,
  },
  warmups,
  trials,
  unit: "milliseconds",
  scope:
    "Warm buildDocsSearchDocuments only; includes correctness checks outside measured intervals. All source helpers are from the current checkout.",
  discardedSamples: 0,
  cases,
};
writeFileSync(join(output, "results.json"), JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      ...result,
      cases: cases.map((c) => ({
        ...c,
        ...Object.fromEntries(
          ["before", "after", "controlA", "controlB"].map((k) => [
            k,
            { median: c[k].median, p95: c[k].p95 },
          ]),
        ),
      })),
    },
    null,
    2,
  ),
);

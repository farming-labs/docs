import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg, platform, release } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const baseline = process.argv[2] ?? "HEAD";
const output = resolve(process.argv[3] ?? "/tmp/docs-search-query");
const fixtures = process.argv.slice(4);
if (fixtures.length === 0) fixtures.push("website", "100", "1000");
mkdirSync(output, { recursive: true });
const esbuildDir = readdirSync(join(root, "node_modules/.pnpm")).find((name) =>
  name.startsWith("esbuild@"),
);
assert(esbuildDir, "Install the locked workspace dependencies first.");
const { build } = await import(
  pathToFileURL(join(root, "node_modules/.pnpm", esbuildDir, "node_modules/esbuild/lib/main.js"))
);
const { loadDocsContent } = await import(
  pathToFileURL(join(root, "packages/farmjs/dist/content.js"))
);
const sourcePath = "packages/docs/src/search.ts";
const modules = {};
for (const [name, contents] of Object.entries({
  before: execFileSync("git", ["show", `${baseline}:${sourcePath}`], {
    cwd: root,
    encoding: "utf8",
  }),
  after: readFileSync(join(root, sourcePath), "utf8"),
})) {
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
  modules[name] = await import(pathToFileURL(outfile));
}

const queries = [
  "installation",
  "configure docs theme",
  "agent contract verification",
  "not-a-real-search-term-8301",
];
const warmups = 3;
const trials = 20;
const summarize = (samples) => {
  const sorted = samples.toSorted((a, b) => a - b);
  return {
    median:
      (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples,
  };
};
const cases = [];
for (const fixture of fixtures) {
  assert(fixture === "website" || /^[1-9]\d*$/.test(fixture), `Invalid fixture: ${fixture}`);
  const pages =
    fixture === "website"
      ? loadDocsContent(join(root, "website/src/app/docs"))
      : Array.from({ length: Number(fixture) }, (_, i) => ({
          title: `Topic ${i}`,
          url: `/docs/topic-${i}`,
          description: `Documentation topic ${i}`,
          content: "",
          framework: "nextjs",
          version: "1",
          tags: ["docs"],
          rawContent: `# Topic ${i}\n\nOverview of installation.\n\n${Array.from({ length: 6 }, (_, s) => `## Section ${s}\n\nConfigure docs theme tokens and agent contract verification for topic ${i} section ${s}. ${"Preserve page semantics and search scope. ".repeat(8)}\n\n\`\`\`ts\nconst topic = ${i};\n\`\`\``).join("\n\n")}`,
        }));
  const run = async (name, selectedPages = pages, selectedQueries = queries, explain = false) => {
    const results = [];
    for (const query of selectedQueries) {
      results.push(
        await modules[name].performDocsSearch({
          pages: selectedPages,
          query,
          limit: 10,
          search: { provider: "simple" },
          audience: "human",
          explain,
        }),
      );
    }
    return results;
  };
  const expected = await run("before");
  for (let i = 0; i < warmups; i++) {
    for (const name of ["before", "after"]) assert.deepEqual(await run(name), expected);
  }
  const samples = { before: [], after: [], controlA: [], controlB: [] };
  const cpuSamples = { before: [], after: [], controlA: [], controlB: [] };
  for (let trial = 0; trial < trials; trial++) {
    const order = ["before", "after", "controlA", "controlB"];
    if (trial % 2) order.reverse();
    for (const label of order) {
      const name = label === "after" ? "after" : "before";
      const cpuStart = process.cpuUsage();
      const start = performance.now();
      const actual = await run(name);
      samples[label].push((performance.now() - start) / queries.length);
      const cpu = process.cpuUsage(cpuStart);
      cpuSamples[label].push((cpu.user + cpu.system) / 1000 / queries.length);
      assert.deepEqual(actual, expected);
    }
  }
  const edgeQueries = [
    " NEEDLE?! ",
    "ÉCLAIR... ",
    "東京",
    "C++",
    "foo.bar",
    "the and",
    "",
    "[needle]",
  ];
  const edited = structuredClone(pages.slice(0, 3));
  edited[0].rawContent = "# Edited\n\n## Needle?! \n\nÉclair... 東京 C++ foo.bar [needle]";
  edited[0].content = edited[0].rawContent;
  edited[0].description = "Needle?! ";
  assert.deepEqual(
    await run("after", edited, edgeQueries, true),
    await run("before", edited, edgeQueries, true),
  );
  const result = {
    fixture,
    pages: pages.length,
    documents: modules.before.buildDocsSearchDocuments(pages).length,
    sourceBytes: pages.reduce(
      (total, page) => total + Buffer.byteLength(page.rawContent ?? page.content),
      0,
    ),
    loadavg: loadavg(),
    wallMs: Object.fromEntries(
      Object.entries(samples).map(([key, values]) => [key, summarize(values)]),
    ),
    cpuMs: Object.fromEntries(
      Object.entries(cpuSamples).map(([key, values]) => [key, summarize(values)]),
    ),
  };
  cases.push(result);
  writeFileSync(join(output, `${fixture}.json`), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      fixture,
      wallMs: Object.fromEntries(
        Object.entries(result.wallMs).map(([key, { samples: _samples, ...summary }]) => [
          key,
          summary,
        ]),
      ),
    }),
  );
}
writeFileSync(
  join(output, "results.json"),
  JSON.stringify(
    {
      baseline: execFileSync("git", ["rev-parse", baseline], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      environment: {
        node: process.version,
        platform: platform(),
        release: release(),
        cpu: cpus()[0]?.model,
      },
      queries,
      warmups,
      trials,
      discardedSamples: 0,
      unit: "milliseconds per query, averaged over a four-query batch",
      scope:
        "Warm performDocsSearch with the simple provider, including preparation, ranking and provenance. Excludes filesystem loading, HTTP and browser work. Helpers and dependencies are identical across both bundled variants.",
      correctness:
        "Every timed result deep-equals baseline outside the timer. Edited input, Unicode, punctuation, stop words, empty queries and explanations also match. No samples were discarded.",
      cases,
    },
    null,
    2,
  ),
);

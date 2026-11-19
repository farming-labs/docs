import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dirs = process.argv.slice(2).map((path) => resolve(path));
if (dirs.length !== 3 || new Set(dirs).size !== 3) {
  throw new Error(
    "Pass three distinct dist directories: baseline, an identical control, and candidate.",
  );
}
const apis = await Promise.all(
  dirs.map((dir) => import(pathToFileURL(join(dir, "markdown-sections.mjs")))),
);
const root = fileURLToPath(new URL("../../website/src/app/docs/", import.meta.url));
const paths = readdirSync(root, { recursive: true })
  .filter((p) => /(?:^|[/\\])(?:page\.mdx|agent\.md)$/u.test(p))
  .sort();
assert.ok(paths.length > 0, "The docs corpus is empty.");
const fingerprint = createHash("sha256");
const pages = paths.map((path) => {
  const source = readFileSync(join(root, path), "utf8");
  fingerprint.update(path.replaceAll("\\", "/")).update("\0").update(source).update("\0");
  const sections = apis[0].parseDocsMarkdownSections(source);
  for (const api of apis.slice(1))
    assert.deepEqual(api.parseDocsMarkdownSections(source), sections);
  assert.ok(sections.length, path);
  const hits = [
    sections[0].anchor,
    "#" + sections[Math.floor(sections.length / 2)].anchor,
    "/docs/page#" + encodeURIComponent(sections.at(-1).anchor),
  ];
  const miss = "missing-from-this-document";
  assert.equal(apis[0].findDocsMarkdownSection(source, miss), undefined);
  for (const selector of [...hits, miss, ...sections.map((section) => section.title)]) {
    const expected = apis[0].findDocsMarkdownSection(source, selector);
    for (const api of apis.slice(1))
      assert.deepEqual(api.findDocsMarkdownSection(source, selector), expected);
  }
  return { source, hits, mixed: [...hits, miss] };
});

const orders = [
  [0, 1, 2],
  [2, 1, 0],
  [1, 2, 0],
  [0, 2, 1],
  [2, 0, 1],
  [1, 0, 2],
];
const jobs = {};
for (const workload of ["hits", "mixed", "cold"]) {
  const samples = apis.map(() => []);
  const batches = { hits: 20, mixed: 4, cold: 1 }[workload];
  for (let round = 0; round < 27; round++) {
    for (const index of orders[round % orders.length]) {
      const api = apis[index];
      const start = performance.now();
      for (let batch = 0; batch < batches; batch++) {
        for (const page of pages) {
          if (workload === "cold") {
            api.parseDocsMarkdownSections(page.source + "\n\nBenchmark round " + round + ".\n");
          } else {
            for (const selector of page[workload])
              api.findDocsMarkdownSection(page.source, selector);
          }
        }
      }
      const ms = (performance.now() - start) / batches;
      if (round >= 3) samples[index].push(ms);
    }
  }
  jobs[workload] = Object.fromEntries(
    samples.map((values, i) => {
      const sorted = [...values].sort((a, b) => a - b);
      const percentile = (p) => sorted[Math.ceil(p * sorted.length) - 1];
      return [
        ["baseline", "control", "candidate"][i],
        { medianMs: percentile(0.5), p95Ms: percentile(0.95), samplesMs: values },
      ];
    }),
  );
}
console.log(
  JSON.stringify(
    { node: process.version, pages: pages.length, corpusSha256: fingerprint.digest("hex"), jobs },
    null,
    2,
  ),
);

import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { cpus, release } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sweep = process.argv.includes("--full-corpus");
const farm = process.argv.includes("--farm-filesystem");
const roots = process.argv
  .slice(2)
  .filter((arg) => !["--full-corpus", "--farm-filesystem"].includes(arg));
if (roots.length !== 3)
  throw new Error("Pass three installed package roots: parent, identical control and candidate.");
const resolveImports = roots.map((root) => createRequire(path.resolve(root, "package.json")));
const site = fileURLToPath(new URL("../../website/src/app/docs/", import.meta.url));
const pageFiles = fs
  .readdirSync(site, { recursive: true })
  .filter((p) => /(?:^|[/\\])page\.mdx$/.test(p))
  .sort();
const paths = pageFiles.map((f) => "/docs" + ("/" + f.replaceAll("\\", "/")).slice(0, -9));
const fingerprint = createHash("sha256");
for (const f of pageFiles)
  fingerprint
    .update(f.replaceAll("\\", "/"))
    .update("\0")
    .update(fs.readFileSync(path.join(site, f)))
    .update("\0");
const orders = [
  [0, 1, 2],
  [2, 1, 0],
  [1, 2, 0],
  [0, 2, 1],
  [2, 0, 1],
  [1, 0, 2],
];
const results = {};
const adapters = farm ? ["farmjs"] : ["astro", "nuxt", "svelte", "tanstack-start"];
for (const adapter of adapters) {
  const variants = await Promise.all(
    resolveImports.map(async (resolveFrom) => {
      const entry = (name) =>
        import(pathToFileURL(resolveFrom.resolve(`@farming-labs/${adapter}/${name}`)));
      const { loadDocsNavTree } = await entry("content");
      const { createDocsServer } = await entry("server");
      const server = createDocsServer({ entry: "docs", contentDir: site, ordering: "numeric" });
      return {
        numeric: () => loadDocsNavTree(site, "docs", "numeric"),
        alphabetical: () => loadDocsNavTree(site, "docs", "alphabetical"),
        page(pathname) {
          if (adapter === "svelte")
            return server.load({ url: new URL(pathname, "https://example.test") });
          if (adapter === "tanstack-start" || adapter === "farmjs")
            return server.load({ pathname });
          return server.load(pathname);
        },
      };
    }),
  );
  const measurements = {};
  for (const job of ["numeric", "alphabetical", "page"]) {
    const routes = job === "page" ? paths : ["/docs"];
    for (const route of routes) {
      const expected = await variants[0][job](route);
      for (const api of variants.slice(1)) assert.deepEqual(await api[job](route), expected);
    }
    const samples = [[], [], []];
    const io = [];
    for (const api of variants) {
      const counts = {};
      const original = {};
      for (const method of ["readFileSync", "readdirSync", "statSync", "existsSync"]) {
        counts[method] = 0;
        original[method] = fs[method];
        fs[method] = function (file, ...args) {
          if (typeof file === "string" && file.startsWith(site)) counts[method]++;
          return original[method].call(this, file, ...args);
        };
      }
      try {
        await api[job]("/docs");
      } finally {
        Object.assign(fs, original);
      }
      io.push(counts);
    }
    // The full-corpus mode records single requests on two complete passes through the site.
    const warmups = 6;
    const rounds = sweep ? paths.length * 2 : 24;
    const operationsPerBatch = sweep ? 1 : 3;
    for (let round = -warmups; round < rounds; round++) {
      const index = sweep ? Math.max(round, 0) : round + warmups;
      const route = routes[index % routes.length];
      for (const variant of orders[(round + warmups) % orders.length]) {
        const start = performance.now();
        for (let operation = 0; operation < operationsPerBatch; operation++) {
          await variants[variant][job](route);
        }
        if (round >= 0) samples[variant].push((performance.now() - start) / operationsPerBatch);
      }
    }
    measurements[job] = Object.fromEntries(
      samples.map((times, i) => {
        const sorted = times.toSorted((a, b) => a - b);
        return [
          ["parent", "control", "candidate"][i],
          {
            reads: io[i].readFileSync,
            io: io[i],
            medianMs: sorted[Math.ceil(sorted.length / 2) - 1],
            p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
            samplesMs: times,
          },
        ];
      }),
    );
  }
  results[adapter] = measurements;
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      cpu: cpus()[0].model,
      os: release(),
      pages: paths.length,
      corpusSha256: fingerprint.digest("hex"),
      warmups: 6,
      measured: sweep ? paths.length * 2 : 24,
      operationsPerBatch: sweep ? 1 : 3,
      results,
    },
    null,
    2,
  ),
);

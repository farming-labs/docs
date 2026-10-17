/** Isolated cache-store overhead, not an application build benchmark. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { corpusPage, repoRoot } from "../next-docs/prepare.mjs";
import { createFarmDocsMdxCompileOptions } from "../../packages/farmjs/dist/vite.js";

const [baselineRef, candidateFile, output] = process.argv.slice(2);
assert(
  baselineRef && candidateFile && output,
  "Usage: node --expose-gc cache-store-benchmark.mjs BASELINE_REF CANDIDATE_FILE OUTPUT",
);
const require = createRequire(path.join(repoRoot, "packages/farmjs/package.json"));
const { transformWithEsbuild } = await import(pathToFileURL(require.resolve("vite")));
const { default: mdx } = await import(pathToFileURL(require.resolve("@mdx-js/rollup")));
const digest = (data) => createHash("sha256").update(data).digest("hex");
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "farm-cache-store-bench-"));
const sources = {
  before: execFileSync("git", ["show", `${baselineRef}:packages/farmjs/src/mdx-build-cache.ts`], {
    cwd: repoRoot,
    encoding: "utf8",
  }),
  after: await fs.readFile(candidateFile, "utf8"),
};
try {
  const implementations = {};
  for (const [name, source] of Object.entries(sources)) {
    const file = path.join(scratch, `${name}.mjs`);
    await fs.writeFile(
      file,
      (await transformWithEsbuild(source, "cache.ts", { format: "esm", target: "es2022" })).code,
    );
    implementations[name] = (await import(pathToFileURL(file))).MdxBuildCache;
  }
  const compiler = mdx(createFarmDocsMdxCompileOptions());
  const context = {
    error(error) {
      throw error;
    },
  };
  const entries = [];
  for (let index = 0; index < 100; index++) {
    const id = `/corpus/page-${index}.mdx`;
    const source = corpusPage(index).source;
    const result = await compiler.transform.call(context, source, id);
    entries.push({ id, key: digest(source), result: JSON.parse(JSON.stringify(result)) });
  }
  const editSource = corpusPage(0).source + "\nA changed paragraph.\n";
  const edited = {
    ...entries[0],
    key: digest(editSource),
    result: JSON.parse(
      JSON.stringify(await compiler.transform.call(context, editSource, entries[0].id)),
    ),
  };
  const seedFile = path.join(scratch, "seed.json");
  const seed = new implementations.before(seedFile);
  for (const { id, key, result } of entries) await seed.compile(id, key, async () => result);
  await seed.flush();
  const seedBytes = (await fs.stat(seedFile)).size;
  const samples = [];
  for (let trial = -2; trial < 10; trial++) {
    const order = trial % 2 === 0 ? ["before", "after"] : ["after", "before"];
    for (const mode of ["warm", "edit"])
      for (const variant of order) {
        const file = path.join(scratch, `${variant}-${mode}.json`);
        await fs.copyFile(seedFile, file);
        const cache = new implementations[variant](file);
        const selected = mode === "edit" ? [edited, ...entries.slice(1)] : entries;
        let writes = 0,
          writtenBytes = 0,
          compileCalls = 0;
        const results = [];
        const write = fs.writeFile;
        fs.writeFile = async (...args) => {
          writes++;
          writtenBytes += Buffer.byteLength(args[1]);
          return write(...args);
        };
        global.gc?.();
        const start = performance.now();
        let milliseconds;
        try {
          for (let graph = 0; graph < 2; graph++) {
            for (const { id, key, result } of selected) {
              results.push(
                await cache.compile(id, key, async () => {
                  compileCalls++;
                  return result;
                }),
              );
            }
            await cache.flush();
          }
          milliseconds = performance.now() - start;
        } finally {
          fs.writeFile = write;
        }
        assert.equal(compileCalls, mode === "edit" ? 1 : 0);
        assert.deepEqual(
          results,
          [...selected, ...selected].map((entry) => entry.result),
        );
        assert.equal(JSON.parse(await fs.readFile(file, "utf8")).length, 100);
        if (trial >= 0)
          samples.push({
            trial: trial + 1,
            variant,
            mode,
            milliseconds,
            writes,
            writtenBytes,
            compileCalls,
          });
      }
  }
  const median = (values) => {
    const sorted = values.toSorted((a, b) => a - b);
    return (sorted[4] + sorted[5]) / 2;
  };
  const rows = ["warm", "edit"].flatMap((mode) =>
    ["before", "after"].map((variant) => {
      const selected = samples.filter(
        (sample) => sample.mode === mode && sample.variant === variant,
      );
      return {
        mode,
        variant,
        medianMilliseconds: median(selected.map((sample) => sample.milliseconds)),
        minMilliseconds: Math.min(...selected.map((sample) => sample.milliseconds)),
        maxMilliseconds: Math.max(...selected.map((sample) => sample.milliseconds)),
        writes: [...new Set(selected.map((sample) => sample.writes))],
        writtenBytes: [...new Set(selected.map((sample) => sample.writtenBytes))],
      };
    }),
  );
  const result = {
    scope:
      "Cache load, two passes of 100 hits/one changed entry, and two flushes only. Excludes MDX compilation, bundling, type checking and deployment. The edited compilation result is prepared outside measurement.",
    baselineRef,
    candidateFile: path.resolve(candidateFile),
    sourceHashes: Object.fromEntries(
      Object.entries(sources).map(([key, value]) => [key, digest(value)]),
    ),
    compilerOptionsFromDocsCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim(),
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0].model,
    pages: 100,
    seedBytes,
    warmupTrials: 2,
    trials: 10,
    explicitGc: Boolean(global.gc),
    rows,
    samples,
  };
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ seedBytes, rows }, null, 2));
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}

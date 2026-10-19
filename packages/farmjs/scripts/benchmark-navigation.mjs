import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = path.resolve(packageDir, "../..");
const require = createRequire(path.join(packageDir, "package.json"));
const ts = require("typescript");
const [base = "origin/main", output] = process.argv.slice(2);
const sourcePath = "packages/farmjs/src/content.ts";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "docs-nav-comparison-"));
const originalRead = fs.readFileSync;

try {
  fs.symlinkSync(path.join(packageDir, "node_modules"), path.join(temp, "node_modules"), "dir");
  const sources = {
    before: execFileSync("git", ["show", `${base}:${sourcePath}`], { cwd: repo, encoding: "utf8" }),
    after: fs.readFileSync(path.join(repo, sourcePath), "utf8"),
  };
  const loaders = {};
  for (const [name, source] of Object.entries(sources)) {
    const target = path.join(temp, `${name}.mjs`);
    fs.writeFileSync(
      target,
      ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    );
    loaders[name] = (await import(pathToFileURL(target))).loadDocsNavTree;
  }

  const result = {
    baseline: execFileSync("git", ["rev-parse", base], { cwd: repo, encoding: "utf8" }).trim(),
    candidate: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    cpu: os.cpus()[0]?.model,
    scope:
      "Navigation construction only; warm filesystem/frontmatter caches, seven alternating trials. No MDX compilation, page rendering, network or full-build timing.",
    cases: [],
  };

  for (const pages of [100, 337, 1000]) {
    const dir = path.join(temp, String(pages));
    fs.mkdirSync(dir);
    for (let i = 0; i < pages; i++) {
      fs.writeFileSync(
        path.join(dir, `page-${String(i).padStart(4, "0")}.md`),
        `---\ntitle: Page ${i}\norder: ${pages - i}\n---\n\n# Page ${i}\n`,
      );
    }
    for (const ordering of ["alphabetical", "numeric"]) {
      const expected = loaders.before(dir, "docs", ordering);
      assert.deepEqual(loaders.after(dir, "docs", ordering), expected);
      const reads = {};
      for (const name of ["before", "after"]) {
        let count = 0;
        fs.readFileSync = function (file, ...args) {
          if (String(file).startsWith(dir + path.sep)) count++;
          return originalRead.call(this, file, ...args);
        };
        try {
          assert.deepEqual(loaders[name](dir, "docs", ordering), expected);
        } finally {
          fs.readFileSync = originalRead;
        }
        reads[name] = count;
      }
      const samples = { before: [], after: [] };
      for (let trial = 0; trial < 7; trial++) {
        for (const name of trial % 2 ? ["after", "before"] : ["before", "after"]) {
          const start = performance.now();
          const tree = loaders[name](dir, "docs", ordering);
          samples[name].push(performance.now() - start);
          assert.deepEqual(tree, expected);
        }
      }
      const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
      result.cases.push({
        pages,
        ordering,
        sourceReads: reads,
        milliseconds: samples,
        medianMilliseconds: { before: median(samples.before), after: median(samples.after) },
        identicalNavigation: true,
      });
    }
  }
  const text = JSON.stringify(result, null, 2) + "\n";
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, text);
  }
  console.log(text);
} finally {
  fs.readFileSync = originalRead;
  fs.rmSync(temp, { recursive: true, force: true });
}

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Node 24+; build core, theme and adapter first. Fresh processes, warm OS file cache.
const dist = resolve(import.meta.dirname, "../dist");
const token = randomUUID();
const baselineVite = join(dist, `.benchmark-vite-${token}.js`);
const baselineConfig = join(dist, `.benchmark-config-${token}.js`);
const vite = readFileSync(join(dist, "vite.js"), "utf8");
let replaced = false;
const baseline = vite.replace(/import \{([^}]+)\} from "\.\/mdx-core\.js";/, (_, names) => {
  replaced = true;
  const core = names
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "remarkCodeGroup");
  return `import { ${core.join(", ")} } from "@farming-labs/docs";\nimport { remarkCodeGroup } from "@farming-labs/docs/server";`;
});
if (!replaced) throw new Error("No focused MDX import found; build the adapter first.");
const config = readFileSync(join(dist, "config.js"), "utf8");
if (!config.includes('"./vite.js"')) throw new Error("Unsupported emitted config wrapper.");
const child = `
import {registerHooks} from 'node:module';
import {performance} from 'node:perf_hooks';
const urls = new Set();
registerHooks({load(url, context, next) {urls.add(url); return next(url, context);}});
const start = performance.now();
const {withDocs} = await import(process.argv[1]);
const importMs = performance.now() - start;
const config = withDocs({});
if (!config.docs.enabled || !config.vite.plugins.length) throw new Error('Docs plugins missing');
console.log(JSON.stringify({importMs, totalMs: performance.now() - start, modules: urls.size}));
`;
const samples = [];
writeFileSync(baselineVite, baseline, { flag: "wx" });
try {
  writeFileSync(baselineConfig, config.replace('"./vite.js"', `"./.benchmark-vite-${token}.js"`), {
    flag: "wx",
  });
  for (let trial = 1; trial <= 7; trial++) {
    for (const kind of trial % 2 ? ["baseline", "candidate"] : ["candidate", "baseline"]) {
      const target = kind === "baseline" ? baselineConfig : join(dist, "config.js");
      const sample = JSON.parse(
        execFileSync(
          process.execPath,
          ["--input-type=module", "-e", child, pathToFileURL(target).href],
          {
            encoding: "utf8",
          },
        ),
      );
      samples.push({ kind, trial, ...sample });
    }
  }
} finally {
  rmSync(baselineVite, { force: true });
  rmSync(baselineConfig, { force: true });
}
const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = Object.fromEntries(
  ["baseline", "candidate"].map((kind) => [
    kind,
    Object.fromEntries(
      ["importMs", "totalMs", "modules"].map((key) => [
        key,
        median(samples.filter((row) => row.kind === kind).map((row) => row[key])),
      ]),
    ),
  ]),
);
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      method:
        "Same emitted Farm adapter; baseline restores broad compiler imports. Seven alternating fresh-process trials with warm OS file cache. Config import and withDocs setup only, not a complete Farm or Vercel build.",
      summary,
      samples,
    },
    null,
    2,
  ),
);

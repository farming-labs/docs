import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Node 24+; build core and adapter first. Fresh processes, warm OS filesystem cache.
const dist = resolve(import.meta.dirname, "../dist");
const entry = readFileSync(join(dist, "config.mjs"), "utf8");
const match = entry.match(/import \{ (\w+) as withDocs \} from "\.\/([^"]+)"/);
if (!match) throw new Error("Unsupported emitted config wrapper; rebuild the adapter first.");
const [, exportName, chunkName] = match;
const chunk = join(dist, chunkName);
const source = readFileSync(chunk, "utf8");
const serverNames = new Set([
  "ensureDocsReviewWorkflow",
  "renderDocsAgentSkillsBundle",
  "resolveConfiguredAgentSkillsSync",
]);
let replaced = false;
const baseline = source.replace(
  /import \{([^}]+)\} from "@farming-labs\/docs\/build";/g,
  (_, names) => {
    replaced = true;
    const imports = names.split(",").map((name) => name.trim());
    return `import { ${imports.filter((name) => !serverNames.has(name)).join(", ")} } from "@farming-labs/docs";\nimport { ${imports.filter((name) => serverNames.has(name)).join(", ")} } from "@farming-labs/docs/server";`;
  },
);
if (!replaced) throw new Error("No focused build import found in the emitted config.");
const temporary = join(dist, `.config-benchmark-${randomUUID()}.mjs`);
const child = `
import { registerHooks } from 'node:module';
import { performance } from 'node:perf_hooks';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const urls = new Set();
const root = mkdtempSync(join(tmpdir(), 'docs-startup-'));
writeFileSync(join(root, 'docs.config.ts'), 'export default { entry: "docs", review: false };');
process.chdir(root);
process.env.NODE_ENV = 'test';
registerHooks({load(url, context, next) {urls.add(url); return next(url, context);}});
try {
  const start = performance.now();
  const mod = await import(process.argv[1]);
  const importMs = performance.now() - start;
  mod[process.argv[2]]();
  console.log(JSON.stringify({importMs, totalMs: performance.now() - start, modules: urls.size}));
} finally {rmSync(root, {recursive: true, force: true});}
`;
const samples = [];
writeFileSync(temporary, baseline, { flag: "wx" });
try {
  for (let trial = 1; trial <= 7; trial++) {
    for (const kind of trial % 2 ? ["baseline", "candidate"] : ["candidate", "baseline"]) {
      const target = kind === "baseline" ? temporary : chunk;
      const sample = JSON.parse(
        execFileSync(
          process.execPath,
          ["--input-type=module", "-e", child, pathToFileURL(target).href, exportName],
          { encoding: "utf8" },
        ),
      );
      samples.push({ kind, trial, ...sample });
    }
  }
} finally {
  rmSync(temporary, { force: true });
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
        "Same emitted withDocs chunk; baseline restores broad imports. Seven alternating fresh-process trials. Setup and import only; not Next compilation or an OS-cache-cold benchmark.",
      summary,
      samples,
    },
    null,
    2,
  ),
);

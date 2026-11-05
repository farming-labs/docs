import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packPackages } from "./pack-packages.mjs";
const repo = fileURLToPath(new URL("../..", import.meta.url));
const output = resolve(process.argv[2] ?? "/tmp/docs-next-packed");
const { packages, importEntry } = packPackages(repo, output, ["docs", "fumadocs", "next"]);
await importEntry("@farming-labs/next", "./mdx-plugins/rehype-page-boundary");
const report = {
  packages: [...packages],
  node: process.version,
  exports: "all explicit targets present",
  pageBoundaryPlugin: "imported",
};
writeFileSync(join(output, "results.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

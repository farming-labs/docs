import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packPackages } from "./pack-packages.mjs";
const repo = fileURLToPath(new URL("../..", import.meta.url));
const output = resolve(process.argv[2] ?? "/tmp/docs-content-packed");
const { packages, importEntry } = packPackages(repo, output, [
  "docs",
  "astro",
  "svelte",
  "nuxt",
  "tanstack-start",
]);
const { createDocsContentMapCache } = await importEntry("@farming-labs/docs", "./runtime");
const content = { "/docs/page.md": "---\ntitle: Packed docs\n---\n# Packed docs" };
const cache = createDocsContentMapCache(content);
assert.equal(
  cache.get("size", () => Object.keys(content).length),
  1,
);
for (const framework of ["astro", "svelte", "nuxt", "tanstack-start"]) {
  const { createDocsServer } = await importEntry(`@farming-labs/${framework}`, "./server");
  const files = {
    ...content,
    "/docs/same/index.md": "---\ntitle: First index\n---\n",
    "/docs/same/page.md": "---\ntitle: Second index\n---\n",
  };
  const server = createDocsServer({
    entry: "docs",
    contentDir: "docs",
    telemetry: false,
    _preloadedContent: files,
  });
  const request =
    framework === "svelte"
      ? { url: new URL("https://example.com/docs") }
      : framework === "tanstack-start"
        ? { pathname: "/docs" }
        : "/docs";
  const first = await server.load(request);
  first.tree.children[0].name = "Caller mutation";
  assert.equal((await server.load(request)).tree.children[0].name, "Packed docs");
  const firstIndex = files["/docs/same/index.md"];
  delete files["/docs/same/index.md"];
  files["/docs/same/index.md"] = firstIndex;
  const reordered = (await server.load(request)).tree.children
    .filter((node) => node.url === "/docs/same")
    .map((node) => node.name);
  assert.deepEqual(
    reordered,
    ["astro", "nuxt"].includes(framework)
      ? ["Second index", "First index"]
      : ["First index", "Second index"],
    `${framework}: duplicate index order follows the existing content-map ownership`,
  );
}
const report = {
  packages: [...packages],
  node: process.version,
  exports: "all explicit targets present",
  nativeServers: 4,
};
writeFileSync(join(output, "results.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

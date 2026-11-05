import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packPackages } from "./pack-packages.mjs";
const repo = fileURLToPath(new URL("../..", import.meta.url));
const output = resolve(process.argv[2] ?? "/tmp/docs-native-packed");
const { packages, importEntry } = packPackages(repo, output, [
  "docs",
  "astro",
  "svelte",
  "nuxt",
  "svelte-theme",
  "nuxt-theme",
]);
for (const framework of ["astro", "svelte", "nuxt"]) {
  const { renderMarkdown } = await importEntry(`@farming-labs/${framework}`, "./markdown");
  assert.match(await renderMarkdown("# Packed prose"), /Packed prose/);
  assert.match(await renderMarkdown("```ts\nconst packed = true;\n```"), /shiki/);
}
for (const [name, extension] of [
  ["svelte", "svelte"],
  ["nuxt", "vue"],
]) {
  const root = packages.get(`@farming-labs/${name}-theme`);
  const trigger = readFileSync(join(root, `src/components/FloatingAIChat.${extension}`), "utf8");
  assert(trigger.includes(`import("./FloatingAIChatContent.${extension}")`));
  assert(existsSync(join(root, `src/components/FloatingAIChatContent.${extension}`)));
}
const report = {
  packages: [...packages],
  node: process.version,
  exports: "all explicit targets present",
  nativeHighlighters: 3,
  lazyChatAssets: 2,
};
writeFileSync(join(output, "results.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

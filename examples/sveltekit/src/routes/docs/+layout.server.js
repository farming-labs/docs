import { loadDocsNavTree, flattenNavTree } from "@farming-labs/svelte";
import path from "node:path";

export function load() {
  const contentDir = path.resolve("src/content/docs");
  const tree = loadDocsNavTree(contentDir, "docs");
  const flatPages = flattenNavTree(tree);

  return { tree, flatPages };
}

import { json } from "@sveltejs/kit";
import { loadDocsContent } from "@farming-labs/svelte";
import path from "node:path";

const contentDir = path.resolve("src/content/docs");
let indexCache = null;

function getIndex() {
  if (!indexCache) {
    indexCache = loadDocsContent(contentDir, "docs");
  }
  return indexCache;
}

export function GET({ url }) {
  const query = url.searchParams.get("query")?.toLowerCase().trim();
  if (!query) return json([]);

  const index = getIndex();

  const results = index
    .map((page) => {
      const titleMatch = page.title.toLowerCase().includes(query) ? 10 : 0;
      const words = query.split(/\s+/);
      const contentMatch = words.reduce((score, word) => {
        return score + (page.content.toLowerCase().includes(word) ? 1 : 0);
      }, 0);
      return { ...page, score: titleMatch + contentMatch };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ title, url, description }) => ({
      content: title,
      url,
      description,
    }));

  return json(results);
}

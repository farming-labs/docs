import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { renderMarkdown } from "$lib/render-markdown.js";

const GITHUB_REPO = "https://github.com/farming-labs/docs";
const GITHUB_BRANCH = "main";
const GITHUB_CONTENT_DIR = "examples/sveltekit/src/content/docs";

export async function load({ parent }) {
  const filePath = path.resolve("src/content/docs/index.md");
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const html = await renderMarkdown(content);

  const { flatPages } = await parent();
  const currentUrl = "/docs";
  const currentIndex = flatPages.findIndex((p) => p.url === currentUrl);
  const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
  const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

  const editOnGithub = `${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${GITHUB_CONTENT_DIR}/index.md`;

  const stat = fs.statSync(filePath);
  const lastModified = stat.mtime.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    title: data.title ?? "Documentation",
    description: data.description,
    html,
    previousPage,
    nextPage,
    editOnGithub,
    lastModified,
  };
}

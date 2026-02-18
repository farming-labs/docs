import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { error } from "@sveltejs/kit";
import { renderMarkdown } from "$lib/render-markdown.js";

const GITHUB_REPO = "https://github.com/farming-labs/docs";
const GITHUB_BRANCH = "main";
const GITHUB_CONTENT_DIR = "examples/sveltekit/src/content/docs";

export async function load({ params, parent }) {
  const slug = params.slug;
  const contentDir = path.resolve("src/content/docs");

  const candidates = [
    path.join(contentDir, slug, "index.md"),
    path.join(contentDir, slug, "index.svx"),
    path.join(contentDir, `${slug}.md`),
    path.join(contentDir, `${slug}.svx`),
  ];

  let filePath = null;
  let relPath = "";
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      filePath = candidate;
      relPath = path.relative(contentDir, candidate);
      break;
    }
  }

  if (!filePath) {
    error(404, { message: `Page not found: /docs/${slug}` });
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const html = await renderMarkdown(content);

  const { flatPages } = await parent();
  const currentUrl = `/docs/${slug}`;
  const currentIndex = flatPages.findIndex((p) => p.url === currentUrl);
  const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
  const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

  const editOnGithub = `${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${GITHUB_CONTENT_DIR}/${relPath}`;

  const stat = fs.statSync(filePath);
  const lastModified = stat.mtime.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    title: data.title ?? slug.split("/").pop()?.replace(/-/g, " ") ?? "Documentation",
    description: data.description,
    html,
    slug,
    previousPage,
    nextPage,
    editOnGithub,
    lastModified,
  };
}

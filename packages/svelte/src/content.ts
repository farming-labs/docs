/**
 * Content loading utilities for SvelteKit docs.
 *
 * Scans the filesystem for `.md` / `.svx` content files,
 * extracts frontmatter, and builds a navigation tree compatible
 * with @farming-labs/docs DocsConfig.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface PageNode {
  type: "page";
  name: string;
  url: string;
  icon?: string;
  description?: string;
}

export interface FolderNode {
  type: "folder";
  name: string;
  icon?: string;
  index?: PageNode;
  children: NavNode[];
}

export type NavNode = PageNode | FolderNode;

export interface NavTree {
  name: string;
  children: NavNode[];
}

export interface ContentPage {
  slug: string;
  url: string;
  title: string;
  description?: string;
  icon?: string;
  content: string;
  rawContent: string;
}

/**
 * Scan a content directory and return all docs pages.
 * Expects a flat or nested structure of `.md` files:
 *   content/docs/index.md       → /docs
 *   content/docs/installation.md → /docs/installation
 *   content/docs/guides/auth.md  → /docs/guides/auth
 */
export function loadDocsContent(
  contentDir: string,
  entry: string = "docs",
): ContentPage[] {
  const pages: ContentPage[] = [];
  const absDir = path.resolve(contentDir);

  function scan(dir: string, slugParts: string[]) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir).sort();
    for (const name of entries) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        scan(full, [...slugParts, name]);
        continue;
      }

      if (!name.endsWith(".md") && !name.endsWith(".mdx") && !name.endsWith(".svx")) continue;

      const raw = fs.readFileSync(full, "utf-8");
      const { data, content } = matter(raw);

      const baseName = name.replace(/\.(md|mdx|svx)$/, "");
      const isIndex = baseName === "index" || baseName === "page" || baseName === "+page";

      const slug = isIndex
        ? slugParts.join("/")
        : [...slugParts, baseName].join("/");

      const url = slug ? `/${entry}/${slug}` : `/${entry}`;

      const title =
        (data.title as string) ??
        baseName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      pages.push({
        slug,
        url,
        title,
        description: data.description as string | undefined,
        icon: data.icon as string | undefined,
        content: stripMarkdown(content),
        rawContent: content,
      });
    }
  }

  scan(absDir, []);
  return pages;
}

/**
 * Build a navigation tree from a content directory.
 */
export function loadDocsNavTree(
  contentDir: string,
  entry: string = "docs",
): NavTree {
  const absDir = path.resolve(contentDir);
  const children: NavNode[] = [];

  const indexPath = findIndex(absDir);
  if (indexPath) {
    const { data } = matter(fs.readFileSync(indexPath, "utf-8"));
    children.push({
      type: "page",
      name: (data.title as string) ?? "Documentation",
      url: `/${entry}`,
      icon: data.icon as string | undefined,
    });
  }

  children.push(...scanDir(absDir, [], entry));
  return { name: "Docs", children };
}

function scanDir(dir: string, slugParts: string[], entry: string): NavNode[] {
  if (!fs.existsSync(dir)) return [];
  const nodes: NavNode[] = [];
  const entries = fs.readdirSync(dir).sort();

  for (const name of entries) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isDirectory()) continue;

    const indexPath = findIndex(full);
    if (!indexPath) continue;

    const { data } = matter(fs.readFileSync(indexPath, "utf-8"));
    const slug = [...slugParts, name];
    const url = `/${entry}/${slug.join("/")}`;
    const displayName =
      (data.title as string) ?? name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const icon = data.icon as string | undefined;

    const childDirs = fs.readdirSync(full).filter((n) => {
      const p = path.join(full, n);
      return fs.statSync(p).isDirectory() && findIndex(p) !== null;
    });

    if (childDirs.length > 0) {
      nodes.push({
        type: "folder",
        name: displayName,
        icon,
        index: { type: "page", name: displayName, url, icon },
        children: scanDir(full, slug, entry),
      });
    } else {
      nodes.push({ type: "page", name: displayName, url, icon });
    }
  }

  return nodes;
}

function findIndex(dir: string): string | null {
  for (const name of ["page.md", "page.mdx", "index.md", "index.svx", "+page.md", "+page.svx"]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Flatten a navigation tree into an ordered list of pages.
 * Useful for computing previous/next page links.
 */
export function flattenNavTree(tree: NavTree): PageNode[] {
  const pages: PageNode[] = [];

  function walk(nodes: NavNode[]) {
    for (const node of nodes) {
      if (node.type === "page") {
        pages.push(node);
      } else if (node.type === "folder") {
        if (node.index) pages.push(node.index);
        walk(node.children);
      }
    }
  }

  walk(tree.children);
  return pages;
}

function stripMarkdown(content: string): string {
  return content
    .replace(/^(import|export)\s.*$/gm, "")
    .replace(/<[^>]+\/>/g, "")
    .replace(/<\/?[A-Z][^>]*>/g, "")
    .replace(/<\/?[a-z][^>]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

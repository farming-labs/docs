/**
 * Content loading utilities for Nuxt docs.
 *
 * Scans the filesystem for `.md` / `.mdx` content files,
 * extracts frontmatter, and builds a navigation tree compatible
 * with @farming-labs/docs DocsConfig.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { OrderingItem } from "@farming-labs/docs";

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
  ordering?: "alphabetical" | "numeric" | OrderingItem[],
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

  const rootSlugOrder = Array.isArray(ordering) ? ordering : undefined;
  children.push(...scanDir(absDir, [], entry, ordering, rootSlugOrder));
  return { name: "Docs", children };
}

function buildNavNode(
  dir: string, name: string, slugParts: string[], entry: string,
  ordering?: "alphabetical" | "numeric" | OrderingItem[],
  childSlugOrder?: OrderingItem[],
): NavNode | null {
  const full = path.join(dir, name);
  if (!fs.statSync(full).isDirectory()) return null;

  const indexPath = findIndex(full);
  if (!indexPath) return null;

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
    return {
      type: "folder",
      name: displayName,
      icon,
      index: { type: "page", name: displayName, url, icon },
      children: scanDir(full, slug, entry, ordering, childSlugOrder),
    };
  }
  return { type: "page", name: displayName, url, icon };
}

function scanDir(
  dir: string, slugParts: string[], entry: string,
  ordering?: "alphabetical" | "numeric" | OrderingItem[],
  slugOrder?: OrderingItem[],
): NavNode[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir).sort();

  if (slugOrder) {
    const nodes: NavNode[] = [];
    const slugMap = new Set(slugOrder.map((i) => i.slug));

    for (const item of slugOrder) {
      if (!entries.includes(item.slug)) continue;
      const node = buildNavNode(dir, item.slug, slugParts, entry, ordering, item.children);
      if (node) nodes.push(node);
    }
    for (const name of entries) {
      if (slugMap.has(name)) continue;
      const node = buildNavNode(dir, name, slugParts, entry, ordering);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  if (ordering === "numeric") {
    const nodes: { order: number; node: NavNode }[] = [];
    for (const name of entries) {
      const full = path.join(dir, name);
      if (!fs.statSync(full).isDirectory()) continue;
      const indexPath = findIndex(full);
      if (!indexPath) continue;
      const { data } = matter(fs.readFileSync(indexPath, "utf-8"));
      const order = typeof data.order === "number" ? data.order : Infinity;
      const node = buildNavNode(dir, name, slugParts, entry, ordering);
      if (node) nodes.push({ order, node });
    }
    nodes.sort((a, b) => {
      if (a.order === b.order) return 0;
      return a.order - b.order;
    });
    return nodes.map((n) => n.node);
  }

  const nodes: NavNode[] = [];
  for (const name of entries) {
    const node = buildNavNode(dir, name, slugParts, entry, ordering);
    if (node) nodes.push(node);
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

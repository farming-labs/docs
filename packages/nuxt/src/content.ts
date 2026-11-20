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
import {
  normalizeDocsRelated,
  normalizePageAgentFrontmatter,
  normalizeDocsOkfTrustMetadataInput,
  resolveDocsAudienceMdxContent,
  resolveDocsPageAudience,
  resolvePageSidebarFolderIndexBehavior,
  type OrderingItem,
  type PageAgentFrontmatter,
  type DocsOkfTrustMetadataInput,
  type ResolvedDocsRelatedLink,
  type SidebarFolderIndexBehavior,
} from "@farming-labs/docs";

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
  folderIndexBehavior?: SidebarFolderIndexBehavior;
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
  /** `"agent"` pages are left out of navigation, human search, and HTML routes. */
  audience?: "agent";
  description?: string;
  related?: ResolvedDocsRelatedLink[];
  agent?: PageAgentFrontmatter;
  okf?: DocsOkfTrustMetadataInput;
  icon?: string;
  sourcePath?: string;
  lastmod?: string;
  lastModified?: string;
  locale?: string;
  framework?: string;
  version?: string;
  tags?: string[];
  content: string;
  rawContent: string;
  agentContent?: string;
  agentRawContent?: string;
  agentLastModified?: string;
  agentFallbackContent?: string;
  agentFallbackRawContent?: string;
}

export function normalizeDocsFrontmatterLastmod(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return undefined;
}

/**
 * Scan a content directory and return all docs pages.
 * Expects a flat or nested structure of `.md` files:
 *   content/docs/index.md       → /docs
 *   content/docs/installation.md → /docs/installation
 *   content/docs/guides/auth.md  → /docs/guides/auth
 */
export function loadDocsContent(contentDir: string, entry: string = "docs"): ContentPage[] {
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

      if (name === "agent.md") continue;
      if (!name.endsWith(".md") && !name.endsWith(".mdx") && !name.endsWith(".svx")) continue;

      const raw = fs.readFileSync(full, "utf-8");
      const { data, content } = matter(raw);
      const humanRawContent = resolveDocsAudienceMdxContent(content, "human");
      const pageAgentRawContent = resolveDocsAudienceMdxContent(content, "agent");
      const related = normalizeDocsRelated(data.related);

      const baseName = name.replace(/\.(md|mdx|svx)$/, "");
      const isIndex = baseName === "index" || baseName === "page" || baseName === "+page";

      const slug = isIndex ? slugParts.join("/") : [...slugParts, baseName].join("/");

      const url = slug ? `/${entry}/${slug}` : `/${entry}`;
      const agentDoc = isIndex ? readAgentDoc(dir) : undefined;

      const title =
        (data.title as string) ??
        baseName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      pages.push({
        slug,
        url,
        title,
        ...(resolveDocsPageAudience(data.audience) ? { audience: "agent" as const } : {}),
        description: data.description as string | undefined,
        ...(related.length > 0 ? { related } : {}),
        agent: normalizePageAgentFrontmatter(data.agent),
        okf: normalizeDocsOkfTrustMetadataInput(data.okf),
        icon: data.icon as string | undefined,
        sourcePath: full.replace(/\\/g, "/"),
        lastmod: normalizeDocsFrontmatterLastmod(data.lastmod),
        lastModified: stat.mtime.toISOString(),
        locale: typeof data.locale === "string" ? data.locale : undefined,
        framework: typeof data.framework === "string" ? data.framework : undefined,
        version: typeof data.version === "string" ? data.version : undefined,
        tags: Array.isArray(data.tags)
          ? data.tags.filter((tag): tag is string => typeof tag === "string")
          : undefined,
        content: stripMarkdown(humanRawContent),
        rawContent: humanRawContent,
        ...(pageAgentRawContent !== humanRawContent
          ? {
              agentFallbackContent: stripMarkdown(pageAgentRawContent),
              agentFallbackRawContent: pageAgentRawContent,
            }
          : {}),
        ...agentDoc,
      });
    }
  }

  scan(absDir, []);
  return pages;
}

function readAgentDoc(dir: string) {
  const agentPath = path.join(dir, "agent.md");
  if (!fs.existsSync(agentPath)) return undefined;

  const raw = fs.readFileSync(agentPath, "utf-8");
  const { content } = matter(raw);
  const agentRawContent = resolveDocsAudienceMdxContent(content, "agent");
  return {
    agentContent: stripMarkdown(agentRawContent),
    agentRawContent,
    agentLastModified: fs.statSync(agentPath).mtime.toISOString(),
  };
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
  const rootData = indexPath ? matter(fs.readFileSync(indexPath)).data : undefined;
  // An agent-only root page has no human projection, so it has no sidebar entry.
  if (rootData && !resolveDocsPageAudience(rootData.audience)) {
    const data = rootData;
    children.push({
      type: "page",
      name: (data.title as string) ?? "Documentation",
      url: `/${entry}`,
      icon: data.icon as string | undefined,
    });
  }

  const rootSlugOrder = Array.isArray(ordering) ? ordering : undefined;
  if (fs.existsSync(absDir)) {
    children.push(...buildNavLevel(readNavFolders(absDir), [], entry, ordering, rootSlugOrder));
  }
  return { name: "Docs", children };
}

interface NavFolder {
  name: string;
  dir: string;
  indexPath: string;
}

function readNavFolders(dir: string): NavFolder[] {
  const folders: NavFolder[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink() && !fs.statSync(full).isDirectory()) continue;
    const indexPath = findIndex(full);
    if (indexPath) folders.push({ name: entry.name, dir: full, indexPath });
  }
  return folders.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function buildNavNode(
  { name, dir }: NavFolder,
  data: Record<string, unknown>,
  slugParts: string[],
  entry: string,
  ordering?: "alphabetical" | "numeric" | OrderingItem[],
  childSlugOrder?: OrderingItem[],
): NavNode | null {
  const slug = [...slugParts, name];
  const url = `/${entry}/${slug.join("/")}`;
  const displayName =
    (data.title as string) ?? name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const icon = data.icon as string | undefined;

  const childDirs = readNavFolders(dir);

  // An agent-only page has no human projection: keep visible children under a plain folder.
  if (resolveDocsPageAudience(data.audience)) {
    const children = buildNavLevel(childDirs, slug, entry, ordering, childSlugOrder);
    return children.length > 0 ? { type: "folder", name: displayName, icon, children } : null;
  }

  if (childDirs.length > 0) {
    return {
      type: "folder",
      name: displayName,
      icon,
      index: { type: "page", name: displayName, url, icon },
      folderIndexBehavior: resolvePageSidebarFolderIndexBehavior(data.sidebar),
      children: buildNavLevel(childDirs, slug, entry, ordering, childSlugOrder),
    };
  }
  return { type: "page", name: displayName, url, icon };
}

function buildNavLevel(
  folders: NavFolder[],
  slugParts: string[],
  entry: string,
  ordering?: "alphabetical" | "numeric" | OrderingItem[],
  slugOrder?: OrderingItem[],
): NavNode[] {
  const nodes: NavNode[] = [];
  const ranked: { order: number; node: NavNode }[] = [];
  function append(folder: NavFolder, childOrder?: OrderingItem[]) {
    const data = matter(fs.readFileSync(folder.indexPath)).data;
    const node = buildNavNode(folder, data, slugParts, entry, ordering, childOrder);
    if (!node) return;
    if (ordering === "numeric") {
      ranked.push({ order: typeof data.order === "number" ? data.order : Infinity, node });
    } else {
      nodes.push(node);
    }
  }

  if (slugOrder) {
    const byName = new Map(folders.map((folder) => [folder.name, folder]));
    const orderedNames = new Set<string>();
    for (const item of slugOrder) {
      const folder = byName.get(item.slug);
      if (folder) append(folder, item.children);
      orderedNames.add(item.slug);
    }
    for (const folder of folders) {
      if (!orderedNames.has(folder.name)) append(folder);
    }
  } else {
    for (const folder of folders) append(folder);
  }
  if (ordering === "numeric") {
    ranked.sort((a, b) => a.order - b.order);
    return ranked.map(({ node }) => node);
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

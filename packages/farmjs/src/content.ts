/**
 * Content loading utilities for Farm.js docs.
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
  defaultOpen?: boolean;
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

const FARM_DOCS_LAST_MODIFIED_MANIFEST = ".farm-docs-last-modified.json";

interface FarmDocsLastModifiedManifest {
  version: 1;
  pages: Record<string, string>;
}

function normalizeRelativeContentPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

export function readFarmDocsLastModifiedManifest(
  contentDir: string,
): FarmDocsLastModifiedManifest | null {
  const manifestPath = path.join(contentDir, FARM_DOCS_LAST_MODIFIED_MANIFEST);
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const parsed = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8"),
    ) as Partial<FarmDocsLastModifiedManifest>;
    if (parsed.version !== 1 || !parsed.pages || typeof parsed.pages !== "object") return null;

    return {
      version: 1,
      pages: Object.fromEntries(
        Object.entries(parsed.pages).filter(
          (entry): entry is [string, string] =>
            typeof entry[1] === "string" && !Number.isNaN(new Date(entry[1]).getTime()),
        ),
      ),
    };
  } catch {
    return null;
  }
}

export function resolveFarmDocsLastModified(
  contentDir: string,
  sourcePath: string,
  manifest: FarmDocsLastModifiedManifest | null,
): string | undefined {
  if (!manifest) return undefined;
  const relativePath = normalizeRelativeContentPath(path.relative(contentDir, sourcePath));
  return manifest.pages[relativePath];
}

export function normalizeDocsFrontmatterLastmod(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return undefined;
}

export function loadDocsContent(contentDir: string, entry: string = "docs"): ContentPage[] {
  const pages: ContentPage[] = [];
  const absDir = path.resolve(contentDir);
  const lastModifiedManifest = readFarmDocsLastModifiedManifest(absDir);

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
      if (!name.endsWith(".md") && !name.endsWith(".mdx")) continue;

      const raw = fs.readFileSync(full, "utf-8");
      const { data, content } = matter(raw);
      const humanRawContent = resolveDocsAudienceMdxContent(content, "human");
      const pageAgentRawContent = resolveDocsAudienceMdxContent(content, "agent");
      const related = normalizeDocsRelated(data.related);

      const baseName = name.replace(/\.(md|mdx)$/, "");
      const isIndex = baseName === "index" || baseName === "page";

      const slug = isIndex ? slugParts.join("/") : [...slugParts, baseName].join("/");
      const url = slug ? `/${entry}/${slug}` : `/${entry}`;
      const agentDoc = isIndex ? readAgentDoc(dir) : undefined;

      const title =
        (data.title as string) ??
        baseName.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

      pages.push({
        slug,
        url,
        title,
        description: data.description as string | undefined,
        ...(related.length > 0 ? { related } : {}),
        agent: normalizePageAgentFrontmatter(data.agent),
        okf: normalizeDocsOkfTrustMetadataInput(data.okf),
        icon: data.icon as string | undefined,
        sourcePath: full.replace(/\\/g, "/"),
        lastmod: normalizeDocsFrontmatterLastmod(data.lastmod),
        lastModified:
          resolveFarmDocsLastModified(absDir, full, lastModifiedManifest) ??
          stat.mtime.toISOString(),
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
  dir: string,
  name: string,
  slugParts: string[],
  entry: string,
  ordering?: "alphabetical" | "numeric" | OrderingItem[],
  childSlugOrder?: OrderingItem[],
): NavNode | null {
  const full = path.join(dir, name);
  const stat = fs.statSync(full);

  if (stat.isFile()) {
    if (name === "agent.md" || (!name.endsWith(".md") && !name.endsWith(".mdx"))) return null;

    const baseName = name.replace(/\.(md|mdx)$/, "");
    if (baseName === "page" || baseName === "index") return null;

    const { data } = matter(fs.readFileSync(full, "utf-8"));
    const slug = [...slugParts, baseName].join("/");

    return {
      type: "page",
      name:
        (data.title as string) ??
        baseName.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      url: `/${entry}/${slug}`,
      icon: data.icon as string | undefined,
    };
  }

  if (!stat.isDirectory()) return null;

  const indexPath = findIndex(full);
  const data = indexPath ? matter(fs.readFileSync(indexPath, "utf-8")).data : {};
  const slug = [...slugParts, name];
  const url = `/${entry}/${slug.join("/")}`;
  const displayName =
    (data.title as string) ??
    name.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const icon = data.icon as string | undefined;

  const children = scanDir(full, slug, entry, ordering, childSlugOrder);

  if (children.length > 0) {
    return {
      type: "folder",
      name: displayName,
      icon,
      ...(indexPath ? { index: { type: "page" as const, name: displayName, url, icon } } : {}),
      folderIndexBehavior: resolvePageSidebarFolderIndexBehavior(data.sidebar),
      children,
    };
  }

  return indexPath ? { type: "page", name: displayName, url, icon } : null;
}

function navEntrySlug(name: string): string {
  return name.replace(/\.(md|mdx)$/, "");
}

function scanDir(
  dir: string,
  slugParts: string[],
  entry: string,
  ordering?: "alphabetical" | "numeric" | OrderingItem[],
  slugOrder?: OrderingItem[],
): NavNode[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir).sort();

  if (slugOrder) {
    const nodes: NavNode[] = [];
    const slugMap = new Set(slugOrder.map((item) => item.slug));

    for (const item of slugOrder) {
      const name = entries.find((entryName) => navEntrySlug(entryName) === item.slug);
      if (!name) continue;
      const node = buildNavNode(dir, name, slugParts, entry, ordering, item.children);
      if (node) nodes.push(node);
    }

    for (const name of entries) {
      if (slugMap.has(navEntrySlug(name))) continue;
      const node = buildNavNode(dir, name, slugParts, entry, ordering);
      if (node) nodes.push(node);
    }

    return nodes;
  }

  if (ordering === "numeric") {
    const nodes: { order: number; name: string; node: NavNode }[] = [];

    for (const name of entries) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      const metadataPath = stat.isDirectory() ? findIndex(full) : full;
      const data =
        metadataPath && (metadataPath.endsWith(".md") || metadataPath.endsWith(".mdx"))
          ? matter(fs.readFileSync(metadataPath, "utf-8")).data
          : {};
      const order = typeof data.order === "number" ? data.order : Infinity;
      const node = buildNavNode(dir, name, slugParts, entry, ordering);
      if (node) nodes.push({ order, name, node });
    }

    nodes.sort((a, b) => {
      if (a.order === b.order) return a.name.localeCompare(b.name);
      return a.order - b.order;
    });

    return nodes.map((item) => item.node);
  }

  const nodes: NavNode[] = [];
  for (const name of entries) {
    const node = buildNavNode(dir, name, slugParts, entry, ordering);
    if (node) nodes.push(node);
  }
  return nodes;
}

function findIndex(dir: string): string | null {
  for (const name of ["page.md", "page.mdx", "index.md", "index.mdx"]) {
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

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
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

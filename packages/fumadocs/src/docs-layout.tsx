import { DocsLayout } from "fumadocs-ui/layouts/docs";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ReactNode, ReactElement } from "react";
import type { DocsConfig } from "@farming-labs/docs";
import { DocsPageClient } from "./docs-page-client.js";

// ─── Tree node types (mirrors fumadocs-core/page-tree) ───────────────
interface PageNode {
  type: "page";
  name: string;
  url: string;
  icon?: ReactNode;
}
interface FolderNode {
  type: "folder";
  name: string;
  icon?: ReactNode;
  index?: PageNode;
  children: (PageNode | FolderNode)[];
}
type TreeNode = PageNode | FolderNode;

// ─── Helpers ─────────────────────────────────────────────────────────

/** Resolve a frontmatter `icon` string to a ReactNode via the icon registry. */
function resolveIcon(
  iconKey: string | undefined,
  registry: Record<string, unknown> | undefined,
): ReactNode | undefined {
  if (!iconKey || !registry) return undefined;
  return (registry[iconKey] as ReactNode) ?? undefined;
}

/** Read frontmatter from a page.mdx file. */
function readFrontmatter(filePath: string): Record<string, unknown> {
  try {
    const { data } = matter(fs.readFileSync(filePath, "utf-8"));
    return data;
  } catch {
    return {};
  }
}

/** Check if a directory has any subdirectories that contain page.mdx. */
function hasChildPages(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (
      fs.statSync(full).isDirectory() &&
      fs.existsSync(path.join(full, "page.mdx"))
    ) {
      return true;
    }
  }
  return false;
}

// ─── buildTree ───────────────────────────────────────────────────────

function buildTree(config: DocsConfig) {
  const docsDir = path.join(process.cwd(), "app", config.entry);
  const icons = config.icons as Record<string, unknown> | undefined;
  const rootChildren: TreeNode[] = [];

  // Root page (e.g. /docs)
  if (fs.existsSync(path.join(docsDir, "page.mdx"))) {
    const data = readFrontmatter(path.join(docsDir, "page.mdx"));
    rootChildren.push({
      type: "page",
      name: (data.title as string) ?? "Documentation",
      url: `/${config.entry}`,
      icon: resolveIcon(data.icon as string | undefined, icons),
    });
  }

  /**
   * Recursively scan a directory and return tree nodes.
   *
   * - If a subdirectory has its own children (nested pages), it becomes a
   *   **folder** node with collapsible children. Its own `page.mdx` becomes
   *   the folder's `index` page.
   * - Otherwise it becomes a simple **page** node.
   */
  function scan(dir: string, baseSlug: string[]): TreeNode[] {
    if (!fs.existsSync(dir)) return [];

    const nodes: TreeNode[] = [];
    const entries = fs.readdirSync(dir).sort();

    for (const name of entries) {
      const full = path.join(dir, name);
      if (!fs.statSync(full).isDirectory()) continue;

      const pagePath = path.join(full, "page.mdx");
      if (!fs.existsSync(pagePath)) continue;

      const data = readFrontmatter(pagePath);
      const slug = [...baseSlug, name];
      const url = `/${config.entry}/${slug.join("/")}`;
      const icon = resolveIcon(data.icon as string | undefined, icons);
      const displayName =
        (data.title as string) ?? name.replace(/-/g, " ");

      // Does this directory have nested child pages?
      if (hasChildPages(full)) {
        // → Folder node (collapsible) with its page as the index
        const folderChildren = scan(full, slug);
        nodes.push({
          type: "folder",
          name: displayName,
          icon,
          index: { type: "page", name: displayName, url, icon },
          children: folderChildren,
        });
      } else {
        // → Simple page node
        nodes.push({ type: "page", name: displayName, url, icon });
      }
    }

    return nodes;
  }

  rootChildren.push(...scan(docsDir, []));
  return { name: "Docs", children: rootChildren };
}

// ─── createDocsMetadata ──────────────────────────────────────────────

/**
 * Build a Next.js Metadata object from the docs config.
 *
 * Returns layout-level metadata including `title.template` so each page's
 * frontmatter `title` is formatted (e.g. "Getting Started – Docs").
 *
 * Usage in `app/docs/layout.tsx`:
 * ```ts
 * export const metadata = createDocsMetadata(docsConfig);
 * ```
 */
export function createDocsMetadata(config: DocsConfig) {
  const meta = config.metadata;
  const template = meta?.titleTemplate ?? "%s";
  // Extract the suffix from the template for the default title
  // e.g. "%s – Docs" → default is "Docs"
  const defaultTitle = template.replace("%s", "").replace(/^[\s–—-]+/, "").trim() || "Docs";

  return {
    title: {
      template,
      default: defaultTitle,
    },
    ...(meta?.description ? { description: meta.description } : {}),
    ...(meta?.twitterCard
      ? { twitter: { card: meta.twitterCard } }
      : {}),
  };
}

// ─── createDocsLayout ────────────────────────────────────────────────

export function createDocsLayout(config: DocsConfig) {
  const tocConfig = config.theme?.ui?.layout?.toc;
  const tocEnabled = tocConfig?.enabled !== false;

  return function DocsLayoutWrapper({ children }: { children: ReactNode }) {
    return (
      <DocsLayout
        tree={buildTree(config)}
        nav={{ title: "Docs", url: `/${config.entry}` }}
      >
        <DocsPageClient tocEnabled={tocEnabled}>{children}</DocsPageClient>
      </DocsLayout>
    );
  };
}

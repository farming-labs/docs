import { DocsLayout } from "fumadocs-ui/layouts/docs";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ReactNode, ReactElement } from "react";
import { serializeIcon } from "./serialize-icon.js";
import type { DocsConfig, ThemeToggleConfig, BreadcrumbConfig, SidebarConfig, TypographyConfig, FontStyle, PageActionsConfig, CopyMarkdownConfig, OpenDocsConfig } from "@farming-labs/docs";
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

/** Resolve the themeToggle config into fumadocs-ui's `themeSwitch` prop. */
function resolveThemeSwitch(toggle: boolean | ThemeToggleConfig | undefined) {
  // undefined or true → show toggle (default)
  if (toggle === undefined || toggle === true) {
    return { enabled: true };
  }
  // false → hide toggle
  if (toggle === false) {
    return { enabled: false };
  }
  // object → map to fumadocs-ui shape
  return {
    enabled: toggle.enabled !== false,
    mode: toggle.mode,
  };
}

/** Resolve sidebar config. */
function resolveSidebar(sidebar: boolean | SidebarConfig | undefined) {
  if (sidebar === undefined || sidebar === true) return {};
  if (sidebar === false) return { enabled: false };
  return {
    enabled: sidebar.enabled !== false,
    component: sidebar.component as ReactNode,
    footer: sidebar.footer as ReactNode,
    banner: sidebar.banner as ReactNode,
    collapsible: sidebar.collapsible,
  };
}

// ─── Typography CSS variable generation ──────────────────────────────

function buildFontStyleVars(prefix: string, style?: FontStyle): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.size) parts.push(`${prefix}-size: ${style.size};`);
  if (style.weight != null) parts.push(`${prefix}-weight: ${style.weight};`);
  if (style.lineHeight) parts.push(`${prefix}-line-height: ${style.lineHeight};`);
  if (style.letterSpacing) parts.push(`${prefix}-letter-spacing: ${style.letterSpacing};`);
  return parts.join("\n  ");
}

function buildTypographyCSS(typo?: TypographyConfig): string {
  if (!typo?.font) return "";

  const vars: string[] = [];
  const fontStyle = typo.font.style;

  // Font families
  if (fontStyle?.sans) vars.push(`--fd-font-sans: ${fontStyle.sans};`);
  if (fontStyle?.mono) vars.push(`--fd-font-mono: ${fontStyle.mono};`);

  // Heading and body font styles
  const elements = ["h1", "h2", "h3", "h4", "body", "small"] as const;
  for (const el of elements) {
    const style = typo.font[el];
    if (style) {
      const cssVars = buildFontStyleVars(`--fd-${el}`, style);
      if (cssVars) vars.push(cssVars);
    }
  }

  if (vars.length === 0) return "";
  return `:root {\n  ${vars.join("\n  ")}\n}`;
}

function TypographyStyle({ typography }: { typography?: TypographyConfig }) {
  const css = buildTypographyCSS(typography);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// ─── createDocsLayout ────────────────────────────────────────────────

export function createDocsLayout(config: DocsConfig) {
  const tocConfig = config.theme?.ui?.layout?.toc;
  const tocEnabled = tocConfig?.enabled !== false;

  // Nav title: supports string or ReactNode (component)
  const navTitle = (config.nav?.title as ReactNode) ?? "Docs";
  const navUrl = config.nav?.url ?? `/${config.entry}`;

  // Theme toggle
  const themeSwitch = resolveThemeSwitch(config.themeToggle);

  // Default theme (for RootProvider) when toggle is hidden
  const toggleConfig = typeof config.themeToggle === "object" ? config.themeToggle : undefined;
  const forcedTheme =
    themeSwitch.enabled === false && toggleConfig?.default && toggleConfig.default !== "system"
      ? toggleConfig.default
      : undefined;

  // Sidebar
  const sidebarProps = resolveSidebar(config.sidebar);

  // Breadcrumb
  const breadcrumbConfig = config.breadcrumb;
  const breadcrumbEnabled =
    breadcrumbConfig === undefined ||
    breadcrumbConfig === true ||
    (typeof breadcrumbConfig === "object" && breadcrumbConfig.enabled !== false);

  // Typography
  const typography = config.theme?.ui?.typography;

  // Page actions (Copy Markdown, Open in …)
  const pageActions = config.pageActions;
  const copyMarkdownEnabled = resolveBool(pageActions?.copyMarkdown);
  const openDocsEnabled = resolveBool(pageActions?.openDocs);

  // Serialize provider icons to HTML strings so they survive the
  // server → client component boundary.
  const rawProviders =
    typeof pageActions?.openDocs === "object" && pageActions.openDocs.providers
      ? (pageActions.openDocs.providers as Array<{ name: string; icon?: unknown; urlTemplate: string }>)
      : undefined;

  const openDocsProviders = rawProviders?.map((p) => ({
    name: p.name,
    urlTemplate: p.urlTemplate,
    iconHtml: p.icon ? serializeIcon(p.icon) : undefined,
  }));

  return function DocsLayoutWrapper({ children }: { children: ReactNode }) {
    return (
      <DocsLayout
        tree={buildTree(config)}
        nav={{ title: navTitle, url: navUrl }}
        themeSwitch={themeSwitch}
        sidebar={sidebarProps}
      >
        <TypographyStyle typography={typography} />
        {forcedTheme && <ForcedThemeScript theme={forcedTheme} />}
        <DocsPageClient
          tocEnabled={tocEnabled}
          breadcrumbEnabled={breadcrumbEnabled}
          entry={config.entry}
          copyMarkdown={copyMarkdownEnabled}
          openDocs={openDocsEnabled}
          openDocsProviders={openDocsProviders as any}
        >
          {children}
        </DocsPageClient>
      </DocsLayout>
    );
  };
}

/** Resolve `boolean | { enabled?: boolean }` to a simple boolean. */
function resolveBool(v: boolean | { enabled?: boolean } | undefined): boolean {
  if (v === undefined) return false;
  if (typeof v === "boolean") return v;
  return v.enabled !== false;
}


/**
 * Tiny inline script to force a theme when the toggle is hidden.
 * Sets the class on <html> before React hydrates to avoid FOUC.
 */
function ForcedThemeScript({ theme }: { theme: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.classList.remove('light','dark');document.documentElement.classList.add('${theme}');`,
      }}
    />
  );
}

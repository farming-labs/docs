import { DocsLayout } from "fumadocs-ui/layouts/docs";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ReactNode, ReactElement } from "react";
import { serializeIcon } from "./serialize-icon.js";
import type { DocsConfig, ThemeToggleConfig, BreadcrumbConfig, SidebarConfig, TypographyConfig, FontStyle, PageActionsConfig, CopyMarkdownConfig, OpenDocsConfig, GithubConfig, AIConfig, OrderingItem } from "@farming-labs/docs";
import { DocsPageClient } from "./docs-page-client.js";
import { DocsAIFeatures } from "./docs-ai-features.js";
import { DocsCommandSearch } from "./docs-command-search.js";

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
  const ordering = config.ordering;
  const rootChildren: TreeNode[] = [];

  if (fs.existsSync(path.join(docsDir, "page.mdx"))) {
    const data = readFrontmatter(path.join(docsDir, "page.mdx"));
    rootChildren.push({
      type: "page",
      name: (data.title as string) ?? "Documentation",
      url: `/${config.entry}`,
      icon: resolveIcon(data.icon as string | undefined, icons),
    });
  }

  function buildNode(dir: string, name: string, baseSlug: string[], slugOrder?: OrderingItem[]): TreeNode | null {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isDirectory()) return null;

    const pagePath = path.join(full, "page.mdx");
    if (!fs.existsSync(pagePath)) return null;

    const data = readFrontmatter(pagePath);
    const slug = [...baseSlug, name];
    const url = `/${config.entry}/${slug.join("/")}`;
    const icon = resolveIcon(data.icon as string | undefined, icons);
    const displayName = (data.title as string) ?? name.replace(/-/g, " ");

    if (hasChildPages(full)) {
      const folderChildren = scanDir(full, slug, slugOrder);
      return {
        type: "folder",
        name: displayName,
        icon,
        index: { type: "page", name: displayName, url, icon },
        children: folderChildren,
      };
    }
    return { type: "page", name: displayName, url, icon };
  }

  function scanDir(dir: string, baseSlug: string[], slugOrder?: OrderingItem[]): TreeNode[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir).sort();

    if (slugOrder) {
      const nodes: TreeNode[] = [];
      const slugMap = new Map<string, OrderingItem>();
      for (const item of slugOrder) slugMap.set(item.slug, item);

      for (const item of slugOrder) {
        if (!entries.includes(item.slug)) continue;
        const node = buildNode(dir, item.slug, baseSlug, item.children);
        if (node) nodes.push(node);
      }
      for (const name of entries) {
        if (slugMap.has(name)) continue;
        const node = buildNode(dir, name, baseSlug);
        if (node) nodes.push(node);
      }
      return nodes;
    }

    if (ordering === "numeric") {
      const nodes: { order: number; node: TreeNode }[] = [];
      for (const name of entries) {
        const full = path.join(dir, name);
        if (!fs.statSync(full).isDirectory()) continue;
        const pagePath = path.join(full, "page.mdx");
        if (!fs.existsSync(pagePath)) continue;
        const data = readFrontmatter(pagePath);
        const order = typeof data.order === "number" ? data.order : Infinity;
        const node = buildNode(dir, name, baseSlug);
        if (node) nodes.push({ order, node });
      }
      nodes.sort((a, b) => {
        if (a.order === b.order) return 0;
        return a.order - b.order;
      });
      return nodes.map((n) => n.node);
    }

    const nodes: TreeNode[] = [];
    for (const name of entries) {
      const node = buildNode(dir, name, baseSlug);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  const rootSlugOrder = Array.isArray(ordering) ? ordering : undefined;
  rootChildren.push(...scanDir(docsDir, [], rootSlugOrder));
  return { name: "Docs", children: rootChildren };
}

// ─── Last Modified Map ───────────────────────────────────────────────

/**
 * Scan all page.mdx files under the docs entry directory and build
 * a map of URL pathname → formatted last-modified date string.
 */
function buildLastModifiedMap(entry: string): Record<string, string> {
  const docsDir = path.join(process.cwd(), "app", entry);
  const map: Record<string, string> = {};

  function formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function scan(dir: string, slugParts: string[]) {
    if (!fs.existsSync(dir)) return;

    const pagePath = path.join(dir, "page.mdx");
    if (fs.existsSync(pagePath)) {
      const url = slugParts.length === 0
        ? `/${entry}`
        : `/${entry}/${slugParts.join("/")}`;
      const stat = fs.statSync(pagePath);
      map[url] = formatDate(stat.mtime);
    }

    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        scan(full, [...slugParts, name]);
      }
    }
  }

  scan(docsDir, []);
  return map;
}

/**
 * Scan all page.mdx files and build a map of URL pathname → description
 * from the frontmatter `description` field.
 */
function buildDescriptionMap(entry: string): Record<string, string> {
  const docsDir = path.join(process.cwd(), "app", entry);
  const map: Record<string, string> = {};

  function scan(dir: string, slugParts: string[]) {
    if (!fs.existsSync(dir)) return;

    const pagePath = path.join(dir, "page.mdx");
    if (fs.existsSync(pagePath)) {
      const data = readFrontmatter(pagePath);
      const desc = data.description as string | undefined;
      if (desc) {
        const url = slugParts.length === 0
          ? `/${entry}`
          : `/${entry}/${slugParts.join("/")}`;
        map[url] = desc;
      }
    }

    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        scan(full, [...slugParts, name]);
      }
    }
  }

  scan(docsDir, []);
  return map;
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

// ─── Color CSS variable generation ───────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  primary: "--color-fd-primary",
  primaryForeground: "--color-fd-primary-foreground",
  background: "--color-fd-background",
  foreground: "--color-fd-foreground",
  muted: "--color-fd-muted",
  mutedForeground: "--color-fd-muted-foreground",
  border: "--color-fd-border",
  card: "--color-fd-card",
  cardForeground: "--color-fd-card-foreground",
  accent: "--color-fd-accent",
  accentForeground: "--color-fd-accent-foreground",
  popover: "--color-fd-popover",
  popoverForeground: "--color-fd-popover-foreground",
  secondary: "--color-fd-secondary",
  secondaryForeground: "--color-fd-secondary-foreground",
  ring: "--color-fd-ring",
};

function buildColorsCSS(colors?: Record<string, string | undefined>): string {
  if (!colors) return "";
  const vars: string[] = [];
  for (const [key, value] of Object.entries(colors)) {
    if (!value || !COLOR_MAP[key]) continue;
    vars.push(`${COLOR_MAP[key]}: ${value};`);
  }
  if (vars.length === 0) return "";
  return `.dark {\n  ${vars.join("\n  ")}\n}`;
}

function ColorStyle({ colors }: { colors?: Record<string, string | undefined> }) {
  const css = buildColorsCSS(colors);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
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
  const tocStyle = (tocConfig as any)?.style as "default" | "directional" | undefined;

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

  // Colors — only user-provided overrides (preset defaults stay in CSS files)
  const colors = config.theme?._userColorOverrides as Record<string, string | undefined> | undefined;

  // Typography
  const typography = config.theme?.ui?.typography;

  // Page actions (Copy Markdown, Open in …)
  const pageActions = config.pageActions;
  const copyMarkdownEnabled = resolveBool(pageActions?.copyMarkdown);
  const openDocsEnabled = resolveBool(pageActions?.openDocs);
  const pageActionsPosition = pageActions?.position ?? "below-title";

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

  // GitHub config — normalize string shorthand to object
  const githubRaw = config.github;
  const githubUrl = typeof githubRaw === "string"
    ? githubRaw.replace(/\/$/, "")
    : githubRaw?.url.replace(/\/$/, "");
  const githubBranch = typeof githubRaw === "object" ? (githubRaw.branch ?? "main") : "main";
  const githubDirectory = typeof githubRaw === "object"
    ? githubRaw.directory?.replace(/^\/|\/$/g, "")
    : undefined;

  // AI features — resolved from config, rendered automatically
  const aiConfig = config.ai as AIConfig | undefined;
  const aiEnabled = !!aiConfig?.enabled;
  const aiMode = aiConfig?.mode ?? "search";
  const aiPosition = aiConfig?.position ?? "bottom-right";
  const aiFloatingStyle = aiConfig?.floatingStyle ?? "panel";
  // Serialize the custom trigger component to HTML so it survives
  // the server → client boundary.
  const aiTriggerComponentHtml = aiConfig?.triggerComponent
    ? serializeIcon(aiConfig.triggerComponent)
    : undefined;
  const aiSuggestedQuestions = aiConfig?.suggestedQuestions;
  const aiLabel = aiConfig?.aiLabel;
  const aiLoadingComponentHtml = typeof aiConfig?.loadingComponent === "function"
    ? serializeIcon(aiConfig.loadingComponent({ name: aiLabel || "AI" }))
    : undefined;

  // Build last-modified map by scanning all page.mdx files
  const lastModifiedMap = buildLastModifiedMap(config.entry);

  // Build description map from frontmatter
  const descriptionMap = buildDescriptionMap(config.entry);

  return function DocsLayoutWrapper({ children }: { children: ReactNode }) {
    return (
      <DocsLayout
        tree={buildTree(config)}
        nav={{ title: navTitle, url: navUrl }}
        themeSwitch={themeSwitch}
        sidebar={sidebarProps}
      >
        <ColorStyle colors={colors} />
        <TypographyStyle typography={typography} />
        {forcedTheme && <ForcedThemeScript theme={forcedTheme} />}
        <DocsCommandSearch />
        {aiEnabled && (
          <DocsAIFeatures
            mode={aiMode}
            position={aiPosition}
            floatingStyle={aiFloatingStyle}
            triggerComponentHtml={aiTriggerComponentHtml}
            suggestedQuestions={aiSuggestedQuestions}
            aiLabel={aiLabel}
            loadingComponentHtml={aiLoadingComponentHtml}
          />
        )}
        <DocsPageClient
          tocEnabled={tocEnabled}
          tocStyle={tocStyle}
          breadcrumbEnabled={breadcrumbEnabled}
          entry={config.entry}
          copyMarkdown={copyMarkdownEnabled}
          openDocs={openDocsEnabled}
          openDocsProviders={openDocsProviders as any}
          pageActionsPosition={pageActionsPosition}
          githubUrl={githubUrl}
          githubBranch={githubBranch}
          githubDirectory={githubDirectory}
          lastModifiedMap={lastModifiedMap}
          descriptionMap={descriptionMap}
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

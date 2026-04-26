import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Suspense, type ReactNode } from "react";
import { serializeIcon } from "./serialize-icon.js";
import {
  buildPageOpenGraph,
  buildPageTwitter,
  resolveChangelogConfig,
  resolveDocsAgentMdxContent,
} from "@farming-labs/docs";
import type {
  DocsConfig,
  ThemeToggleConfig,
  SidebarConfig,
  TypographyConfig,
  FontStyle,
  AIConfig,
  OrderingItem,
  PageFrontmatter,
} from "@farming-labs/docs";
import { DocsPageClient } from "./docs-page-client.js";
import { DocsAIFeatures } from "./docs-ai-features.js";
import { DocsCommandSearch } from "./docs-command-search.js";
import { resolvePageReadingTime, resolveReadingTimeOptions } from "./reading-time.js";
import { SidebarSearchWithAI } from "./sidebar-search-ai.js";
import { LocaleThemeControl } from "./locale-theme-control.js";
import { withLangInUrl } from "./i18n.js";
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
  children: TreeNode[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}
interface SeparatorNode {
  type: "separator";
  name: string;
  icon?: ReactNode;
}
type TreeNode = PageNode | FolderNode | SeparatorNode;

interface TreeRoot {
  name: string;
  children: TreeNode[];
}

interface ChangelogTreeEntry {
  slug: string;
  date: string;
  title: string;
  pinned: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getNextAppDir(root: string): string {
  if (fs.existsSync(path.join(root, "src", "app"))) return "src/app";
  return "app";
}

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
function isWithinDir(candidate: string, target: string): boolean {
  const relative = path.relative(target, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isExcludedDir(dir: string, excludedDirs: string[]): boolean {
  const resolved = path.resolve(dir);
  return excludedDirs.some((excluded) => isWithinDir(resolved, excluded));
}

function hasChildPages(dir: string, excludedDirs: string[]): boolean {
  if (!fs.existsSync(dir)) return false;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (isExcludedDir(full, excludedDirs)) continue;
    if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "page.mdx"))) {
      return true;
    }
  }
  return false;
}

// ─── buildTree ───────────────────────────────────────────────────────

interface DocsLocaleContext {
  entryPath: string;
  docsDir: string;
  locale?: string;
}

interface DocsI18nLike {
  locales?: string[];
  defaultLocale?: string;
}

function getDocsI18n(config: DocsConfig): DocsI18nLike | undefined {
  return (config as unknown as { i18n?: DocsI18nLike }).i18n;
}

function resolveDocsI18nConfig(i18n?: DocsI18nLike | null) {
  if (!i18n || !Array.isArray(i18n.locales)) return null;
  const locales = Array.from(
    new Set(i18n.locales.map((item: string) => item.trim()).filter(Boolean)),
  );
  if (locales.length === 0) return null;

  const defaultLocale =
    i18n.defaultLocale && locales.includes(i18n.defaultLocale) ? i18n.defaultLocale : locales[0];

  return {
    locales,
    defaultLocale,
  };
}

function resolveDocsLocaleContext(config: DocsConfig, locale?: string): DocsLocaleContext {
  const entryBase = config.entry ?? "docs";
  const i18n = resolveDocsI18nConfig(getDocsI18n(config));
  const contentDir = (config as DocsConfig & { contentDir?: string }).contentDir;

  function resolveContentDir(localeValue?: string) {
    if (!contentDir) {
      const appDir = getNextAppDir(process.cwd());
      return path.join(process.cwd(), appDir, entryBase, ...(localeValue ? [localeValue] : []));
    }

    const base = path.isAbsolute(contentDir) ? contentDir : path.join(process.cwd(), contentDir);
    return localeValue ? path.join(base, localeValue) : base;
  }

  if (!i18n) {
    return {
      entryPath: entryBase,
      docsDir: resolveContentDir(),
    };
  }

  const resolvedLocale = locale && i18n.locales.includes(locale) ? locale : i18n.defaultLocale;
  const entryPath = entryBase;
  return {
    entryPath,
    locale: resolvedLocale,
    docsDir: resolveContentDir(resolvedLocale),
  };
}

function getExcludedDocsDirs(config: DocsConfig, ctx: DocsLocaleContext): string[] {
  const changelog = resolveChangelogConfig(config.changelog);
  if (!changelog.enabled) return [];

  const dir = path.isAbsolute(changelog.contentDir)
    ? changelog.contentDir
    : path.join(ctx.docsDir, changelog.contentDir);

  return [path.resolve(dir)];
}

function readChangelogTreeEntries(
  config: DocsConfig,
  ctx: DocsLocaleContext,
): ChangelogTreeEntry[] {
  const changelog = resolveChangelogConfig(config.changelog);
  if (!changelog.enabled) return [];

  const changelogDir = path.isAbsolute(changelog.contentDir)
    ? changelog.contentDir
    : path.join(ctx.docsDir, changelog.contentDir);

  if (!fs.existsSync(changelogDir)) return [];

  const entries: ChangelogTreeEntry[] = [];

  for (const name of fs.readdirSync(changelogDir)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;

    const entryDir = path.join(changelogDir, name);
    if (!fs.existsSync(entryDir) || !fs.statSync(entryDir).isDirectory()) continue;

    const pagePath = path.join(entryDir, "page.mdx");
    if (!fs.existsSync(pagePath)) continue;

    const data = readFrontmatter(pagePath);
    if (data.draft === true) continue;

    entries.push({
      slug: name,
      date: name,
      title: (data.title as string) ?? name.replace(/-/g, " "),
      pinned: data.pinned === true,
    });
  }

  return entries.sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.date.localeCompare(left.date);
  });
}

function buildChangelogTree(
  config: DocsConfig,
  ctx: DocsLocaleContext,
  flat = false,
): FolderNode | null {
  const changelog = resolveChangelogConfig(config.changelog);
  if (!changelog.enabled) return null;

  const entries = readChangelogTreeEntries(config, ctx);
  if (entries.length === 0) return null;

  const url = `/${ctx.entryPath}/${changelog.path}`;
  const children: PageNode[] = entries.map((entry) => ({
    type: "page",
    name: entry.title,
    url: `${url}/${entry.slug}`,
  }));

  return {
    type: "folder",
    name: changelog.title,
    index: {
      type: "page",
      name: changelog.title,
      url,
    },
    children,
    ...(flat ? { collapsible: false, defaultOpen: true } : {}),
  };
}

function buildTree(config: DocsConfig, ctx: DocsLocaleContext, flat = false) {
  const docsDir = ctx.docsDir;
  const icons = config.icons as Record<string, unknown> | undefined;
  const ordering = config.ordering;
  const rootChildren: TreeNode[] = [];
  const excludedDirs = getExcludedDocsDirs(config, ctx);

  if (fs.existsSync(path.join(docsDir, "page.mdx"))) {
    const data = readFrontmatter(path.join(docsDir, "page.mdx"));
    rootChildren.push({
      type: "page",
      name: (data.title as string) ?? "Documentation",
      url: `/${ctx.entryPath}`,
      icon: resolveIcon(data.icon as string | undefined, icons),
    });
  }

  function buildNode(
    dir: string,
    name: string,
    baseSlug: string[],
    slugOrder?: OrderingItem[],
  ): TreeNode | null {
    const full = path.join(dir, name);
    if (isExcludedDir(full, excludedDirs)) return null;
    if (!fs.statSync(full).isDirectory()) return null;

    const pagePath = path.join(full, "page.mdx");
    if (!fs.existsSync(pagePath)) return null;

    const data = readFrontmatter(pagePath);
    const slug = [...baseSlug, name];
    const url = `/${ctx.entryPath}/${slug.join("/")}`;
    const icon = resolveIcon(data.icon as string | undefined, icons);
    const displayName = (data.title as string) ?? name.replace(/-/g, " ");

    if (hasChildPages(full, excludedDirs)) {
      const folderChildren = scanDir(full, slug, slugOrder);
      return {
        type: "folder",
        name: displayName,
        icon,
        index: { type: "page", name: displayName, url, icon },
        children: folderChildren,
        ...(flat ? { collapsible: false, defaultOpen: true } : {}),
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
        if (isExcludedDir(path.join(dir, item.slug), excludedDirs)) continue;
        const node = buildNode(dir, item.slug, baseSlug, item.children);
        if (node) nodes.push(node);
      }
      for (const name of entries) {
        if (isExcludedDir(path.join(dir, name), excludedDirs)) continue;
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
        if (isExcludedDir(full, excludedDirs)) continue;
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
      if (isExcludedDir(path.join(dir, name), excludedDirs)) continue;
      const node = buildNode(dir, name, baseSlug);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  const rootSlugOrder = Array.isArray(ordering) ? ordering : undefined;
  rootChildren.push(...scanDir(docsDir, [], rootSlugOrder));
  const changelogTree = buildChangelogTree(config, ctx, flat);
  if (changelogTree) {
    if (rootChildren.length > 0) {
      rootChildren.push({
        type: "separator",
        name: "Updates",
      });
    }
    rootChildren.push(changelogTree);
  }
  return { name: "Docs", children: rootChildren };
}

function localizeTreeUrls(tree: TreeRoot, locale?: string): TreeRoot {
  function mapNode(node: TreeNode): TreeNode {
    if (node.type === "page") {
      return {
        ...node,
        url: withLangInUrl(node.url, locale),
      };
    }

    if (node.type === "separator") {
      return node;
    }

    return {
      ...node,
      index: node.index
        ? {
            ...node.index,
            url: withLangInUrl(node.index.url, locale),
          }
        : undefined,
      children: node.children.map(mapNode),
    };
  }

  return {
    ...tree,
    children: tree.children.map(mapNode),
  };
}

// ─── Last Modified Map ───────────────────────────────────────────────

/**
 * Scan all page.mdx files under the docs entry directory and build
 * a map of URL pathname → formatted last-modified date string.
 */
function buildLastModifiedMap(config: DocsConfig, ctx: DocsLocaleContext): Record<string, string> {
  const docsDir = ctx.docsDir;
  const map: Record<string, string> = {};
  const excludedDirs = getExcludedDocsDirs(config, ctx);

  function formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function scan(dir: string, slugParts: string[]) {
    if (!fs.existsSync(dir)) return;
    if (isExcludedDir(dir, excludedDirs)) return;

    const pagePath = path.join(dir, "page.mdx");
    if (fs.existsSync(pagePath)) {
      const url =
        slugParts.length === 0 ? `/${ctx.entryPath}` : `/${ctx.entryPath}/${slugParts.join("/")}`;
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
function buildDescriptionMap(config: DocsConfig, ctx: DocsLocaleContext): Record<string, string> {
  const docsDir = ctx.docsDir;
  const map: Record<string, string> = {};
  const excludedDirs = getExcludedDocsDirs(config, ctx);

  function scan(dir: string, slugParts: string[]) {
    if (!fs.existsSync(dir)) return;
    if (isExcludedDir(dir, excludedDirs)) return;

    const pagePath = path.join(dir, "page.mdx");
    if (fs.existsSync(pagePath)) {
      const data = readFrontmatter(pagePath);
      const desc = data.description as string | undefined;
      if (desc) {
        const url =
          slugParts.length === 0 ? `/${ctx.entryPath}` : `/${ctx.entryPath}/${slugParts.join("/")}`;
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

function buildReadingTimeMap(
  config: DocsConfig,
  ctx: DocsLocaleContext,
  options: {
    enabledByDefault: boolean;
    wordsPerMinute: number;
  },
): Record<string, number> {
  const docsDir = ctx.docsDir;
  const map: Record<string, number> = {};
  const excludedDirs = getExcludedDocsDirs(config, ctx);

  function scan(dir: string, slugParts: string[]) {
    if (!fs.existsSync(dir)) return;
    if (isExcludedDir(dir, excludedDirs)) return;

    const pagePath = path.join(dir, "page.mdx");
    if (fs.existsSync(pagePath)) {
      const source = fs.readFileSync(pagePath, "utf-8");
      const { data, content } = matter(source);
      const humanContent = resolveDocsAgentMdxContent(content, "human");
      const minutes = resolvePageReadingTime(data as PageFrontmatter, humanContent, options);

      if (typeof minutes === "number") {
        const url =
          slugParts.length === 0 ? `/${ctx.entryPath}` : `/${ctx.entryPath}/${slugParts.join("/")}`;
        map[url] = minutes;
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
  const og = config.og;
  const template = meta?.titleTemplate ?? "%s";
  const defaultTitle =
    template
      .replace("%s", "")
      .replace(/^[\s–—-]+/, "")
      .trim() || "Docs";

  const result: Record<string, unknown> = {
    title: {
      template,
      default: defaultTitle,
    },
    ...(meta?.description ? { description: meta.description } : {}),
    ...(meta?.twitterCard ? { twitter: { card: meta.twitterCard } } : {}),
  };

  if (og?.enabled !== false && og?.endpoint) {
    const ogUrl = `${og.endpoint}?title=${encodeURIComponent(defaultTitle)}${meta?.description ? `&description=${encodeURIComponent(meta.description)}` : ""}`;
    result.openGraph = {
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    };
    result.twitter = {
      ...(result.twitter as object),
      card: meta?.twitterCard ?? "summary_large_image",
      images: [ogUrl],
    };
  }

  return result;
}

/**
 * Generate page-level metadata with dynamic or static OG/twitter.
 * When the page has `openGraph` or `twitter` in frontmatter, those are used (static OG).
 * Otherwise uses `ogImage` or the config dynamic endpoint.
 *
 * Usage in a docs page or [[...slug]] route:
 * ```ts
 * export function generateMetadata({ params }) {
 *   const page = getPage(params.slug);
 *   return createPageMetadata(docsConfig, page.data);
 * }
 * ```
 */
export function createPageMetadata(
  config: DocsConfig,
  page: Pick<PageFrontmatter, "title" | "description" | "ogImage" | "openGraph" | "twitter">,
  baseUrl?: string,
) {
  const result: Record<string, unknown> = {
    title: page.title,
    ...(page.description ? { description: page.description } : {}),
  };

  if (config.og?.enabled !== false) {
    const openGraph = buildPageOpenGraph(page, config.og, baseUrl);
    if (openGraph) result.openGraph = openGraph;
    const twitter = buildPageTwitter(page, config.og, baseUrl);
    if (twitter) result.twitter = twitter;
  }

  return result;
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
    componentFn: typeof sidebar.component === "function" ? sidebar.component : undefined,
    footer: sidebar.footer as ReactNode,
    banner: sidebar.banner as ReactNode,
    collapsible: sidebar.collapsible,
    flat: sidebar.flat,
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
  const block = vars.join("\n  ");
  return `:root {\n  ${block}\n}\n.dark {\n  ${block}\n}`;
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

// ─── Layout CSS variable generation ──────────────────────────────────

interface LayoutDimensions {
  sidebarWidth?: number;
  contentWidth?: number;
  tocWidth?: number;
}

function LayoutStyle({ layout }: { layout?: LayoutDimensions }) {
  if (!layout) return null;

  const rootVars: string[] = [];
  const desktopRootVars: string[] = [];
  const desktopGridVars: string[] = [];

  if (layout.sidebarWidth) {
    const v = `--fd-sidebar-width: ${layout.sidebarWidth}px`;
    desktopRootVars.push(`${v};`);
    desktopGridVars.push(`${v} !important;`);
  }
  if (layout.contentWidth) {
    rootVars.push(`--fd-content-width: ${layout.contentWidth}px;`);
  }
  if (layout.tocWidth) {
    const v = `--fd-toc-width: ${layout.tocWidth}px`;
    desktopRootVars.push(`${v};`);
    desktopGridVars.push(`${v} !important;`);
  }

  if (rootVars.length === 0 && desktopRootVars.length === 0) return null;

  const parts: string[] = [];

  if (rootVars.length > 0) {
    parts.push(`:root {\n  ${rootVars.join("\n  ")}\n}`);
  }

  if (desktopRootVars.length > 0) {
    const inner = [`:root {\n    ${desktopRootVars.join("\n    ")}\n  }`];
    if (desktopGridVars.length > 0) {
      inner.push(`[style*="fd-sidebar-col"] {\n    ${desktopGridVars.join("\n    ")}\n  }`);
    }
    parts.push(`@media (min-width: 1024px) {\n  ${inner.join("\n  ")}\n}`);
  }

  return <style dangerouslySetInnerHTML={{ __html: parts.join("\n") }} />;
}

// ─── createDocsLayout ────────────────────────────────────────────────

export function createDocsLayout(config: DocsConfig, options?: { locale?: string }) {
  const tocConfig = config.theme?.ui?.layout?.toc;
  const tocEnabled = tocConfig?.enabled !== false;
  const tocStyle = (tocConfig as any)?.style as "default" | "directional" | undefined;

  const localeContext = resolveDocsLocaleContext(config, options?.locale);
  const i18n = resolveDocsI18nConfig(getDocsI18n(config));
  const activeLocale = localeContext.locale ?? i18n?.defaultLocale;
  const docsApiUrl = withLangInUrl("/api/docs", activeLocale);
  const changelogConfig = resolveChangelogConfig(config.changelog);
  const changelogBasePath = changelogConfig.enabled
    ? `/${localeContext.entryPath}/${changelogConfig.path}`
    : undefined;
  // Nav title: supports string or ReactNode (component)
  const navTitle = (config.nav?.title as ReactNode) ?? "Docs";
  const navUrl = withLangInUrl(config.nav?.url ?? `/${localeContext.entryPath}`, activeLocale);

  // Theme toggle
  const themeSwitch = resolveThemeSwitch(config.themeToggle);

  // Default theme (for RootProvider) when toggle is hidden
  const toggleConfig = typeof config.themeToggle === "object" ? config.themeToggle : undefined;
  const forcedTheme =
    themeSwitch.enabled === false && toggleConfig?.default && toggleConfig.default !== "system"
      ? toggleConfig.default
      : undefined;

  // Sidebar
  const resolvedSidebar = resolveSidebar(config.sidebar);
  const sidebarFlat = resolvedSidebar.flat;
  const sidebarComponentFn = resolvedSidebar.componentFn;
  const { flat: _sidebarFlat, componentFn: _componentFn, ...sidebarProps } = resolvedSidebar;

  // Breadcrumb
  const breadcrumbConfig = config.breadcrumb;
  const breadcrumbEnabled =
    breadcrumbConfig === undefined ||
    breadcrumbConfig === true ||
    (typeof breadcrumbConfig === "object" && breadcrumbConfig.enabled !== false);

  // Colors — only user-provided overrides (preset defaults stay in CSS files)
  const colors = config.theme?._userColorOverrides as
    | Record<string, string | undefined>
    | undefined;

  // Typography
  const typography = config.theme?.ui?.typography;

  // Layout dimensions (sidebar width, content width, toc width)
  const layoutDimensions = config.theme?.ui?.layout;

  // Page actions (Copy Markdown, Open in …)
  const pageActions = config.pageActions;
  const copyMarkdownEnabled = resolveBool(pageActions?.copyMarkdown);
  const openDocsEnabled = resolveBool(pageActions?.openDocs);
  const pageActionsPosition = pageActions?.position ?? "below-title";
  const pageActionsAlignment = pageActions?.alignment ?? "left";

  // Last updated config — normalize boolean/object to position string
  const lastUpdatedRaw = config.lastUpdated;
  const lastUpdatedEnabled =
    lastUpdatedRaw !== false &&
    (typeof lastUpdatedRaw !== "object" || lastUpdatedRaw.enabled !== false);
  const lastUpdatedPosition: "footer" | "below-title" =
    typeof lastUpdatedRaw === "object" ? (lastUpdatedRaw.position ?? "footer") : "footer";
  const readingTimeOptions = resolveReadingTimeOptions(config.readingTime);
  const readingTimeEnabled = readingTimeOptions.enabled;
  const readingTimeWordsPerMinute = readingTimeOptions.wordsPerMinute ?? 220;

  // llms.txt config
  const llmsTxtEnabled = resolveBool(config.llmsTxt);
  const feedbackConfig = resolveFeedbackConfig(config.feedback);

  // Serialize provider icons to HTML strings so they survive the
  // server → client component boundary.
  const rawProviders =
    typeof pageActions?.openDocs === "object" && pageActions.openDocs.providers
      ? (pageActions.openDocs.providers as Array<{
          name: string;
          icon?: unknown;
          urlTemplate: string;
        }>)
      : undefined;

  const openDocsProviders = rawProviders?.map((p) => ({
    name: p.name,
    urlTemplate: p.urlTemplate,
    iconHtml: p.icon ? serializeIcon(p.icon) : undefined,
  }));

  // GitHub config — normalize string shorthand to object
  const githubRaw = config.github;
  const githubUrl =
    typeof githubRaw === "string"
      ? githubRaw.replace(/\/$/, "")
      : githubRaw?.url.replace(/\/$/, "");
  const githubBranch = typeof githubRaw === "object" ? (githubRaw.branch ?? "main") : "main";
  const githubDirectory =
    typeof githubRaw === "object" ? githubRaw.directory?.replace(/^\/|\/$/g, "") : undefined;
  const contentDir = (config as DocsConfig & { contentDir?: string }).contentDir;

  // When staticExport is true (e.g. Cloudflare Pages), no server → disable search and AI
  const staticExport = !!(config as { staticExport?: boolean }).staticExport;
  // AI features — resolved from config, rendered automatically
  const aiConfig = config.ai as AIConfig | undefined;
  const aiEnabled = !staticExport && !!aiConfig?.enabled;
  const aiMode = aiConfig?.mode ?? ("search" as "search" | "floating" | "sidebar-icon");
  const aiPosition = aiConfig?.position ?? "bottom-right";
  const aiFloatingStyle = aiConfig?.floatingStyle ?? "panel";
  // Serialize the custom trigger component to HTML so it survives
  // the server → client boundary.
  const aiTriggerComponentHtml = aiConfig?.triggerComponent
    ? serializeIcon(aiConfig.triggerComponent)
    : undefined;
  const aiSuggestedQuestions = aiConfig?.suggestedQuestions;
  const aiLabel = aiConfig?.aiLabel;
  const aiLoaderVariant = aiConfig?.loader;
  const aiLoadingComponentHtml =
    typeof aiConfig?.loadingComponent === "function"
      ? serializeIcon(aiConfig.loadingComponent({ name: aiLabel || "AI" }))
      : undefined;

  // Support both legacy flat fields and new nested `model: { models, defaultModel }` shape.
  const rawModelConfig = (aiConfig as any)?.model as
    | { models?: { id: string; label: string }[]; defaultModel?: string }
    | string
    | undefined;

  let aiModels = (aiConfig as any)?.models as { id: string; label: string }[] | undefined;
  let aiDefaultModelId: string | undefined =
    (aiConfig as any)?.defaultModel ??
    (typeof aiConfig?.model === "string" ? aiConfig.model : undefined);

  if (rawModelConfig && typeof rawModelConfig === "object") {
    aiModels = rawModelConfig.models ?? aiModels;
    aiDefaultModelId =
      rawModelConfig.defaultModel ?? rawModelConfig.models?.[0]?.id ?? aiDefaultModelId;
  }

  // Build last-modified map by scanning all page.mdx files
  const lastModifiedMap = buildLastModifiedMap(config, localeContext);

  // Build description map from frontmatter
  const descriptionMap = buildDescriptionMap(config, localeContext);
  const readingTimeMap = buildReadingTimeMap(config, localeContext, {
    enabledByDefault: readingTimeEnabled,
    wordsPerMinute: readingTimeWordsPerMinute,
  });

  return function DocsLayoutWrapper({ children }: { children: ReactNode }) {
    const tree = buildTree(config, localeContext, !!sidebarFlat);
    const localizedTree = i18n ? localizeTreeUrls(tree, activeLocale) : tree;

    const finalSidebarProps = { ...sidebarProps } as Record<string, unknown>;
    const sidebarFooter = sidebarProps.footer as ReactNode;

    if (i18n) {
      finalSidebarProps.footer = (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sidebarFooter}
          <Suspense fallback={null}>
            <LocaleThemeControl
              locales={i18n.locales}
              defaultLocale={i18n.defaultLocale}
              locale={activeLocale}
              showThemeToggle={themeSwitch.enabled !== false}
              themeMode={themeSwitch.mode}
            />
          </Suspense>
        </div>
      );
    }

    if (sidebarComponentFn) {
      finalSidebarProps.component = (sidebarComponentFn as Function)({
        tree: localizedTree,
        collapsible: sidebarProps.collapsible !== false,
        flat: !!sidebarFlat,
      }) as ReactNode;
    }

    return (
      <div id="nd-docs-layout" style={{ display: "contents" }}>
        <DocsLayout
          tree={localizedTree}
          nav={{ title: navTitle, url: navUrl }}
          themeSwitch={i18n ? { ...themeSwitch, enabled: false } : themeSwitch}
          sidebar={finalSidebarProps}
          {...(aiMode === "sidebar-icon" && aiEnabled
            ? {
                searchToggle: { components: { lg: <SidebarSearchWithAI /> } },
              }
            : {})}
        >
          <ColorStyle colors={colors} />
          <TypographyStyle typography={typography} />
          <LayoutStyle layout={layoutDimensions} />
          {forcedTheme && <ForcedThemeScript theme={forcedTheme} />}
          {!staticExport && (
            <Suspense fallback={null}>
              <DocsCommandSearch api={docsApiUrl} locale={activeLocale} />
            </Suspense>
          )}
          {aiEnabled && (
            <Suspense fallback={null}>
              <DocsAIFeatures
                mode={aiMode}
                api={docsApiUrl}
                locale={activeLocale}
                position={aiPosition}
                floatingStyle={aiFloatingStyle}
                triggerComponentHtml={aiTriggerComponentHtml}
                suggestedQuestions={aiSuggestedQuestions}
                aiLabel={aiLabel}
                loaderVariant={aiLoaderVariant}
                loadingComponentHtml={aiLoadingComponentHtml}
                models={aiModels}
                defaultModelId={aiDefaultModelId}
              />
            </Suspense>
          )}
          <Suspense fallback={children}>
            <DocsPageClient
              tocEnabled={tocEnabled}
              tocStyle={tocStyle}
              breadcrumbEnabled={breadcrumbEnabled}
              changelogBasePath={changelogBasePath}
              entry={localeContext.entryPath}
              locale={activeLocale}
              copyMarkdown={copyMarkdownEnabled}
              openDocs={openDocsEnabled}
              openDocsProviders={openDocsProviders as any}
              pageActionsPosition={pageActionsPosition}
              pageActionsAlignment={pageActionsAlignment}
              githubUrl={githubUrl}
              contentDir={contentDir}
              githubBranch={githubBranch}
              githubDirectory={githubDirectory}
              lastModifiedMap={lastModifiedMap}
              lastUpdatedEnabled={lastUpdatedEnabled}
              lastUpdatedPosition={lastUpdatedPosition}
              readingTimeEnabled={readingTimeEnabled}
              readingTimeMap={readingTimeMap}
              llmsTxtEnabled={llmsTxtEnabled}
              descriptionMap={descriptionMap}
              feedbackEnabled={feedbackConfig.enabled}
              feedbackQuestion={feedbackConfig.question}
              feedbackPlaceholder={feedbackConfig.placeholder}
              feedbackPositiveLabel={feedbackConfig.positiveLabel}
              feedbackNegativeLabel={feedbackConfig.negativeLabel}
              feedbackSubmitLabel={feedbackConfig.submitLabel}
            >
              {children}
            </DocsPageClient>
          </Suspense>
        </DocsLayout>
      </div>
    );
  };
}

/** Resolve `boolean | { enabled?: boolean }` to a simple boolean. */
function resolveBool(v: boolean | { enabled?: boolean } | undefined): boolean {
  if (v === undefined) return false;
  if (typeof v === "boolean") return v;
  return v.enabled !== false;
}

function resolveFeedbackConfig(feedback: DocsConfig["feedback"]) {
  const defaults = {
    enabled: false,
    question: "How is this guide?",
    placeholder: "Leave your feedback...",
    positiveLabel: "Good",
    negativeLabel: "Bad",
    submitLabel: "Submit",
  };

  if (feedback === undefined || feedback === false) return defaults;
  if (feedback === true) return { ...defaults, enabled: true };

  const hasHumanFeedbackConfig =
    feedback.enabled !== undefined ||
    feedback.question !== undefined ||
    feedback.placeholder !== undefined ||
    feedback.positiveLabel !== undefined ||
    feedback.negativeLabel !== undefined ||
    feedback.submitLabel !== undefined ||
    feedback.onFeedback !== undefined;

  return {
    enabled: feedback.enabled === true || (feedback.enabled !== false && hasHumanFeedbackConfig),
    question: feedback.question ?? defaults.question,
    placeholder: feedback.placeholder ?? defaults.placeholder,
    positiveLabel: feedback.positiveLabel ?? defaults.positiveLabel,
    negativeLabel: feedback.negativeLabel ?? defaults.negativeLabel,
    submitLabel: feedback.submitLabel ?? defaults.submitLabel,
  };
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

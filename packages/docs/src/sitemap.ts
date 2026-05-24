import type { DocsSitemapConfig, ResolvedDocsRelatedLink } from "./types.js";

export const DEFAULT_SITEMAP_XML_ROUTE = "/sitemap.xml";
export const DEFAULT_SITEMAP_MD_ROUTE = "/sitemap.md";
export const DEFAULT_SITEMAP_MD_DOCS_ROUTE = "/docs/sitemap.md";
export const DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE = "/.well-known/sitemap.md";
export const DEFAULT_SITEMAP_MANIFEST_PATH = ".farming-labs/sitemap-manifest.json";

export type DocsSitemapFormat = "xml" | "markdown";

export interface DocsSitemapPageInput {
  slug?: string;
  url: string;
  title: string;
  description?: string;
  related?: ResolvedDocsRelatedLink[];
  sourcePath?: string;
  lastmod?: string;
  lastModified?: string;
}

export interface DocsSitemapManifestPage {
  url: string;
  absoluteUrl?: string;
  markdownUrl: string;
  title: string;
  description?: string;
  sourcePath?: string;
  lastmod?: string;
  lastmodSource?: "git" | "filesystem" | "frontmatter" | "manifest" | "unknown";
  related?: string[];
}

export interface DocsSitemapManifest {
  version: 1;
  generatedAt: string;
  baseUrl?: string;
  entry: string;
  siteTitle?: string;
  pages: DocsSitemapManifestPage[];
}

export interface DocsSitemapResolvedConfig {
  enabled: boolean;
  routePrefix: string;
  baseUrl?: string;
  manifestPath: string;
  xml: {
    enabled: boolean;
    includeLastmod: boolean;
    route: string;
  };
  markdown: {
    enabled: boolean;
    includeDescriptions: boolean;
    includeLastmod: boolean;
    linkTarget: "html" | "markdown" | "both";
    route: string;
    docsRoute?: string;
    wellKnownRoute: string;
  };
}

export interface CreateDocsSitemapResponseOptions {
  request: Request;
  sitemap?: boolean | DocsSitemapConfig;
  entry?: string;
  siteTitle?: string;
  baseUrl?: string;
  pages: DocsSitemapPageInput[];
  manifest?: DocsSitemapManifest | null;
}

function normalizeUrlPath(value: string): string {
  const normalized = value.replace(/\/+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

function normalizeRoutePrefix(value?: string): string {
  if (!value) return "";
  const normalized = normalizeUrlPath(`/${value.replace(/^\/+|\/+$/g, "")}`);
  return normalized === "/" ? "" : normalized;
}

function joinRoute(prefix: string, route: string): string {
  return normalizeUrlPath(`${prefix}/${route.replace(/^\/+/, "")}`);
}

function normalizeDateOnly(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) return dateOnly[1];

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function normalizeBaseUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || undefined;
}

function isEnabledObject(config: boolean | DocsSitemapConfig | undefined): boolean {
  if (config === false) return false;
  if (config === undefined) return true;
  if (config === true) return true;
  return config.enabled !== false;
}

export function resolveDocsSitemapConfig(
  sitemap?: boolean | DocsSitemapConfig,
  defaults: { baseUrl?: string } = {},
): DocsSitemapResolvedConfig {
  const objectConfig: DocsSitemapConfig = sitemap && typeof sitemap === "object" ? sitemap : {};
  const routePrefix = normalizeRoutePrefix(objectConfig.routePrefix);
  const xmlConfig = objectConfig.xml;
  const markdownConfig = objectConfig.markdown;

  const xmlEnabled =
    xmlConfig === false
      ? false
      : typeof xmlConfig === "object"
        ? (xmlConfig.enabled ?? true)
        : true;
  const markdownEnabled =
    markdownConfig === false
      ? false
      : typeof markdownConfig === "object"
        ? (markdownConfig.enabled ?? true)
        : true;

  return {
    enabled: isEnabledObject(sitemap),
    routePrefix,
    baseUrl: normalizeBaseUrl(objectConfig.baseUrl ?? defaults.baseUrl),
    manifestPath: objectConfig.manifestPath ?? DEFAULT_SITEMAP_MANIFEST_PATH,
    xml: {
      enabled: xmlEnabled,
      includeLastmod: typeof xmlConfig === "object" ? (xmlConfig.includeLastmod ?? true) : true,
      route: joinRoute(routePrefix, DEFAULT_SITEMAP_XML_ROUTE),
    },
    markdown: {
      enabled: markdownEnabled,
      includeDescriptions:
        typeof markdownConfig === "object" ? (markdownConfig.includeDescriptions ?? true) : true,
      includeLastmod:
        typeof markdownConfig === "object" ? (markdownConfig.includeLastmod ?? true) : true,
      linkTarget:
        typeof markdownConfig === "object" ? (markdownConfig.linkTarget ?? "both") : "both",
      route: joinRoute(routePrefix, DEFAULT_SITEMAP_MD_ROUTE),
      docsRoute: routePrefix ? undefined : DEFAULT_SITEMAP_MD_DOCS_ROUTE,
      wellKnownRoute: joinRoute(routePrefix, DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE),
    },
  };
}

export function resolveDocsSitemapRequest(
  url: URL,
  sitemap?: boolean | DocsSitemapConfig,
): DocsSitemapFormat | null {
  const pathname = normalizeUrlPath(url.pathname);
  const format = url.searchParams.get("format")?.trim();

  if (pathname === "/api/docs") {
    if (format === "sitemap-xml") return "xml";
    if (format === "sitemap-md" || format === "sitemap-markdown") return "markdown";
  }

  const resolved = resolveDocsSitemapConfig(sitemap);
  if (!resolved.enabled) return null;

  if (resolved.xml.enabled && pathname === resolved.xml.route) return "xml";
  if (
    resolved.markdown.enabled &&
    (pathname === resolved.markdown.route ||
      pathname === resolved.markdown.docsRoute ||
      pathname === resolved.markdown.wellKnownRoute)
  ) {
    return "markdown";
  }

  return null;
}

export function toDocsSitemapMarkdownUrl(url: string): string {
  const normalized = normalizeUrlPath(url);
  return normalized.endsWith(".md") ? normalized : `${normalized}.md`;
}

function absolutizeUrl(baseUrl: string | undefined, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = normalizeBaseUrl(baseUrl);
  return base ? `${base}${url.startsWith("/") ? url : `/${url}`}` : url;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashString(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(value);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `"fnv1a64-${hash.toString(16).padStart(16, "0")}"`;
}

function newestLastmod(pages: DocsSitemapManifestPage[]): string | undefined {
  let newest: string | undefined;
  for (const page of pages) {
    const date = normalizeDateOnly(page.lastmod);
    if (!date) continue;
    if (!newest || date > newest) newest = date;
  }
  return newest;
}

function titleize(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sitemapSectionName(entry: string, pageUrl: string): string {
  const normalizedEntry = `/${entry.replace(/^\/+|\/+$/g, "") || "docs"}`;
  const normalizedUrl = normalizeUrlPath(pageUrl);
  if (normalizedUrl === normalizedEntry) return "Overview";

  const slug = normalizedUrl.startsWith(`${normalizedEntry}/`)
    ? normalizedUrl.slice(normalizedEntry.length + 1)
    : normalizedUrl.replace(/^\/+/, "");
  const firstSegment = slug.split("/").filter(Boolean)[0];
  return firstSegment ? titleize(firstSegment) : "Pages";
}

export function buildDocsSitemapManifest(options: {
  pages: DocsSitemapPageInput[];
  entry?: string;
  siteTitle?: string;
  baseUrl?: string;
  generatedAt?: string;
  resolveLastmod?: (
    page: DocsSitemapPageInput,
  ) => { lastmod?: string; lastmodSource?: DocsSitemapManifestPage["lastmodSource"] } | undefined;
}): DocsSitemapManifest {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const seen = new Set<string>();
  const pages: DocsSitemapManifestPage[] = [];

  for (const page of options.pages) {
    const url = normalizeUrlPath(page.url);
    if (seen.has(url)) continue;
    seen.add(url);

    const resolvedLastmod = options.resolveLastmod?.(page);
    const fallbackLastmod = normalizeDateOnly(page.lastmod ?? page.lastModified);
    const lastmod = normalizeDateOnly(resolvedLastmod?.lastmod) ?? fallbackLastmod;

    pages.push({
      url,
      absoluteUrl: absolutizeUrl(baseUrl, url),
      markdownUrl: toDocsSitemapMarkdownUrl(url),
      title: page.title,
      description: page.description,
      sourcePath: page.sourcePath,
      lastmod,
      lastmodSource: resolvedLastmod?.lastmodSource ?? (lastmod ? "unknown" : undefined),
      related: page.related?.map((link) => link.href),
    });
  }

  pages.sort((left, right) => left.url.localeCompare(right.url));

  return {
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    baseUrl,
    entry: options.entry ?? "docs",
    siteTitle: options.siteTitle,
    pages,
  };
}

export function renderDocsSitemapXml(
  manifest: DocsSitemapManifest,
  options: { baseUrl?: string; includeLastmod?: boolean } = {},
): string {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? manifest.baseUrl);
  const includeLastmod = options.includeLastmod ?? true;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const page of manifest.pages) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(page.absoluteUrl ?? absolutizeUrl(baseUrl, page.url))}</loc>`);
    const lastmod = normalizeDateOnly(page.lastmod);
    if (includeLastmod && lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

export function renderDocsSitemapMarkdown(
  manifest: DocsSitemapManifest,
  options: {
    baseUrl?: string;
    includeDescriptions?: boolean;
    includeLastmod?: boolean;
    linkTarget?: "html" | "markdown" | "both";
  } = {},
): string {
  const siteTitle = manifest.siteTitle ?? "Documentation";
  const includeDescriptions = options.includeDescriptions ?? true;
  const includeLastmod = options.includeLastmod ?? true;
  const linkTarget = options.linkTarget ?? "both";
  const lines = [`# ${siteTitle} Sitemap`, ""];
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? manifest.baseUrl);

  if (baseUrl) lines.push(`Base URL: ${baseUrl}`);
  lines.push(`Docs entry: /${manifest.entry.replace(/^\/+|\/+$/g, "") || "docs"}`);
  lines.push(`Generated: ${normalizeDateOnly(manifest.generatedAt) ?? manifest.generatedAt}`, "");

  const groups = new Map<string, DocsSitemapManifestPage[]>();
  for (const page of manifest.pages) {
    const sectionName = sitemapSectionName(manifest.entry, page.url);
    groups.set(sectionName, [...(groups.get(sectionName) ?? []), page]);
  }

  for (const [sectionName, pages] of groups) {
    lines.push(`## ${sectionName}`, "");

    for (const page of pages) {
      const primaryHref = linkTarget === "markdown" ? page.markdownUrl : page.url;
      lines.push(`- [${page.title}](${primaryHref})`);
      if (linkTarget === "both" || linkTarget === "markdown") {
        lines.push(`  Markdown: ${page.markdownUrl}`);
      }
      if (includeDescriptions && page.description) {
        lines.push(`  Description: ${page.description}`);
      }
      const lastmod = normalizeDateOnly(page.lastmod);
      if (includeLastmod && lastmod) lines.push(`  Last updated: ${lastmod}`);
      if (page.related && page.related.length > 0) {
        lines.push(`  Related: ${page.related.join(", ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function readDocsSitemapManifestFromContentMap(
  contentMap?: Record<string, string> | null,
): DocsSitemapManifest | null {
  if (!contentMap) return null;
  const raw =
    contentMap[`/${DEFAULT_SITEMAP_MANIFEST_PATH}`] ?? contentMap[DEFAULT_SITEMAP_MANIFEST_PATH];
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DocsSitemapManifest;
  } catch {
    return null;
  }
}

export function resolveDocsSitemapPageLastmod(
  manifest: DocsSitemapManifest | null | undefined,
  url: string,
): string | undefined {
  if (!manifest) return undefined;
  const normalizedUrl = normalizeUrlPath(url);
  const page = manifest.pages.find((entry) => normalizeUrlPath(entry.url) === normalizedUrl);
  return normalizeDateOnly(page?.lastmod);
}

export function createDocsSitemapResponse({
  request,
  sitemap,
  entry = "docs",
  siteTitle,
  baseUrl,
  pages,
  manifest,
}: CreateDocsSitemapResponseOptions): Response | null {
  const url = new URL(request.url);
  const format = resolveDocsSitemapRequest(url, sitemap);
  if (!format) return null;

  const resolved = resolveDocsSitemapConfig(sitemap, { baseUrl });
  if (!resolved.enabled) return null;
  if (format === "xml" && !resolved.xml.enabled) return null;
  if (format === "markdown" && !resolved.markdown.enabled) return null;

  const nextManifest =
    manifest ??
    buildDocsSitemapManifest({
      pages,
      entry,
      siteTitle,
      baseUrl: resolved.baseUrl ?? url.origin,
    });

  const responseBaseUrl = resolved.baseUrl ?? nextManifest.baseUrl ?? url.origin;
  const body =
    format === "xml"
      ? renderDocsSitemapXml(nextManifest, {
          baseUrl: responseBaseUrl,
          includeLastmod: resolved.xml.includeLastmod,
        })
      : renderDocsSitemapMarkdown(nextManifest, {
          baseUrl: responseBaseUrl,
          includeDescriptions: resolved.markdown.includeDescriptions,
          includeLastmod: resolved.markdown.includeLastmod,
          linkTarget: resolved.markdown.linkTarget,
        });

  const headers = new Headers({
    "Content-Type":
      format === "xml" ? "application/xml; charset=utf-8" : "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: hashString(body),
  });
  const lastModified = newestLastmod(nextManifest.pages);
  if (lastModified)
    headers.set("Last-Modified", new Date(`${lastModified}T00:00:00.000Z`).toUTCString());

  if (request.headers.get("if-none-match") === headers.get("ETag")) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, { headers });
}

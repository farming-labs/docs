"use client";

import { DocsBody, DocsPage, EditOnGitHub } from "fumadocs-ui/layouts/docs/page";
import { Children, Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "fumadocs-core/framework";
import type { CopyMarkdownFormat, DocsFeedbackData, ReadingTimeFormat } from "@farming-labs/docs";
import { PageActions } from "./page-actions.js";
import { useWindowPathname, useWindowSearchParams } from "./client-location.js";
import { DocsFeedback } from "./docs-feedback.js";
import { resolveClientLocale, withLangInUrl } from "./i18n.js";
import { emitClientAnalyticsEvent } from "./client-analytics.js";
import { escapeJsonLdForScript } from "./json-ld.js";

const agentLlmsDirectiveStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

interface TOCItem {
  title: string;
  url: string;
  depth: number;
}

interface PageNavigationItem {
  name: string;
  url: string;
}

/** Serializable provider — icon is an HTML string, not JSX. */
interface SerializedProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
  target?: "markdown" | "page" | "source" | "github";
  prompt?: string;
}

interface DocsPageClientProps {
  tocEnabled: boolean;
  tocStyle?: "default" | "directional";
  breadcrumbEnabled?: boolean;
  changelogBasePath?: string;
  /** The docs entry folder name (e.g. "docs") — used to strip from breadcrumb */
  entry?: string;
  /** Public docs route prefix. Empty string means docs render from the site root. */
  publicPath?: string;
  /** Active locale (used for llms.txt links) */
  locale?: string;
  copyMarkdown?: boolean;
  copyMarkdownFormat?: CopyMarkdownFormat;
  copyMarkdownIncludeTitle?: boolean;
  copyMarkdownLabel?: string;
  copyMarkdownCopiedLabel?: string;
  openDocs?: boolean;
  openDocsProviders?: SerializedProvider[];
  openDocsTarget?: "markdown" | "page" | "source" | "github";
  openDocsPrompt?: string;
  /** Where to render page actions relative to the title */
  pageActionsPosition?: "above-title" | "below-title" | "toc";
  /** Horizontal alignment of page action buttons */
  pageActionsAlignment?: "left" | "right";
  /** GitHub repository URL (e.g. "https://github.com/user/repo") */
  githubUrl?: string;
  /** Path to docs content relative to the repo root (used for Edit on GitHub outside Next.js app/docs) */
  contentDir?: string;
  /** GitHub branch name @default "main" */
  githubBranch?: string;
  /** Subdirectory in the repo where the docs site lives (for monorepos) */
  githubDirectory?: string;
  /** Direct GitHub URL override for the current page. */
  editOnGithubUrl?: string;
  /** Map of pathname → formatted last-modified date string */
  lastModifiedMap?: Record<string, string>;
  /** Direct last-modified value override for the current page. */
  lastModified?: string;
  /** Map of pathname → reading time in minutes */
  readingTimeMap?: Record<string, number>;
  /** Direct reading-time override for the current page. */
  readingTime?: number | null;
  /** Reading-time label style. */
  readingTimeFormat?: ReadingTimeFormat;
  previousPage?: PageNavigationItem | null;
  nextPage?: PageNavigationItem | null;
  /** Map of pathname → serialized Schema.org JSON-LD. */
  structuredDataMap?: Record<string, string>;
  /** Direct serialized Schema.org JSON-LD override for the current page. */
  structuredData?: string;
  /**
   * Whether path-based reading time values should render by default.
   * Explicit `readingTime` overrides can still render when this is false.
   */
  readingTimeEnabled?: boolean;
  /** Whether to show "Last updated" at all */
  lastUpdatedEnabled?: boolean;
  /** Label shown before the formatted last-updated date */
  lastUpdatedLabel?: string;
  /** Where to show the "Last updated" date: "footer" (next to Edit on GitHub) or "below-title" */
  lastUpdatedPosition?: "footer" | "below-title";
  /** Whether llms.txt is enabled — shows links in footer */
  llmsTxtEnabled?: boolean;
  /** Map of pathname → frontmatter description */
  descriptionMap?: Record<string, string>;
  /** Frontmatter description to display below the page title (overrides descriptionMap) */
  description?: string;
  /** Built-in page feedback prompt configuration */
  feedbackEnabled?: boolean;
  feedbackQuestion?: string;
  feedbackPlaceholder?: string;
  feedbackRequireComment?: boolean;
  feedbackPositiveLabel?: string;
  feedbackNegativeLabel?: string;
  feedbackSubmitLabel?: string;
  feedbackSuccessMessage?: string;
  feedbackErrorMessage?: string;
  feedbackOnFeedback?: (data: DocsFeedbackData) => void | Promise<void>;
  analytics?: boolean;
  children: ReactNode;
}

/**
 * Path-based breadcrumb that shows only parent / current folder.
 * Skips the entry segment (e.g. "docs"). Parent is clickable.
 */
function PathBreadcrumb({
  pathname,
  publicPath,
  locale,
}: {
  pathname: string;
  publicPath: string;
  locale?: string;
}) {
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const publicParts = publicPath.split("/").filter(Boolean);
  const hasPublicPrefix =
    publicParts.length > 0 &&
    segments.slice(0, publicParts.length).join("/") === publicParts.join("/");
  const contentSegments = hasPublicPrefix ? segments.slice(publicParts.length) : segments;

  if (contentSegments.length < 2) return null;

  const parentSegment = contentSegments[contentSegments.length - 2];
  const currentSegment = contentSegments[contentSegments.length - 1];

  const parentLabel = parentSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const currentLabel = currentSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const parentUrl =
    "/" + [...publicParts, ...contentSegments.slice(0, -1)].filter(Boolean).join("/");
  const localizedParentUrl = withLangInUrl(parentUrl, locale);

  return (
    <nav className="fd-breadcrumb" aria-label="Breadcrumb">
      <span key="parent" className="fd-breadcrumb-item">
        <a
          href={localizedParentUrl}
          className="fd-breadcrumb-parent fd-breadcrumb-link"
          onClick={(e) => {
            e.preventDefault();
            router.push(localizedParentUrl);
          }}
        >
          {parentLabel}
        </a>
      </span>
      <span key="current" className="fd-breadcrumb-item">
        <span className="fd-breadcrumb-sep">/</span>
        <span className="fd-breadcrumb-current">{currentLabel}</span>
      </span>
    </nav>
  );
}

/**
 * Client wrapper for DocsPage that auto-detects headings from the DOM,
 * populates the Table of Contents, and renders page action buttons
 * (Copy Markdown, Open in LLM). Re-scans when the route changes.
 */
/**
 * Build the GitHub URL for the current page's source file (edit view).
 *
 * Examples:
 *   No directory:  https://github.com/user/repo/edit/main/app/docs/cli/page.mdx
 *   With directory: https://github.com/farming-labs/docs/edit/main/website/app/docs/cli/page.mdx
 */
function buildGithubFileUrl(
  githubUrl: string,
  branch: string,
  pathname: string,
  entry: string,
  locale?: string,
  directory?: string,
  contentDir?: string,
): string {
  const normalizedEntry = entry.replace(/^\/+|\/+$/g, "") || "docs";
  const normalizedContentDir = contentDir?.replace(/^\/+|\/+$/g, "");
  const entryParts = normalizedEntry.split("/").filter(Boolean);
  const pathnameParts = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  const slugParts =
    pathnameParts.slice(0, entryParts.length).join("/") === entryParts.join("/")
      ? pathnameParts.slice(entryParts.length)
      : pathnameParts;
  const dirPrefix = directory ? `${directory}/` : "";
  const basePath = normalizedContentDir || `app/${normalizedEntry}`;
  const relativePath = [locale, slugParts.join("/")].filter(Boolean).join("/");
  const path = `${dirPrefix}${basePath}${relativePath ? `/${relativePath}` : ""}/page.mdx`;
  return `${githubUrl}/edit/${branch}/${path}`;
}

function localizeInternalLinks(root: ParentNode, locale?: string) {
  const anchors = root.querySelectorAll<HTMLAnchorElement>(
    'a[href]:not([data-fd-lang-localized="true"])',
  );

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) continue;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;

    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) continue;

      anchor.href = withLangInUrl(url.pathname + url.search + url.hash, locale);
      anchor.dataset.fdLangLocalized = "true";
    } catch {
      // Ignore malformed links and leave them untouched.
    }
  }
}

function normalizePublicDocsPath(value: string | undefined, entry: string): string {
  if (typeof value !== "string") return `/${entry.replace(/^\/+|\/+$/g, "") || "docs"}`;
  const cleaned = value.trim();
  if (cleaned === "" || cleaned === "/") return "";
  return `/${cleaned.replace(/^\/+|\/+$/g, "")}`;
}

function toPublicDocsPath(pathname: string, entry: string, publicPath: string): string {
  const normalizedEntry = `/${entry.replace(/^\/+|\/+$/g, "") || "docs"}`;
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (publicPath === normalizedEntry) return normalizedPath;
  if (normalizedPath === normalizedEntry) return publicPath || "/";
  if (normalizedPath.startsWith(`${normalizedEntry}/`)) {
    const suffix = normalizedPath.slice(normalizedEntry.length + 1);
    return publicPath ? `${publicPath}/${suffix}` : `/${suffix}`;
  }

  return normalizedPath;
}

function rewriteDocsPathLinks(root: ParentNode, entry: string, publicPath: string) {
  const anchors = root.querySelectorAll<HTMLAnchorElement>(
    'a[href]:not([data-fd-docspath="true"])',
  );

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) continue;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;

    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) continue;

      const nextPath = toPublicDocsPath(url.pathname, entry, publicPath);
      if (nextPath === url.pathname) continue;

      anchor.href = `${nextPath}${url.search}${url.hash}`;
      anchor.dataset.fdDocspath = "true";
    } catch {
      // Ignore malformed links and leave them untouched.
    }
  }
}

function normalizeCurrentPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

function syncDocsPathActiveLinks(root: ParentNode, entry: string, publicPath: string) {
  const currentPath = normalizeCurrentPath(window.location.pathname);
  const anchors = root.querySelectorAll<HTMLAnchorElement>("a[data-active][href]");

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) continue;

    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) continue;
      if (!isDocsNavigationPath(url.pathname, entry, publicPath)) continue;

      const publicHrefPath = normalizeCurrentPath(
        toPublicDocsPath(url.pathname, entry, publicPath),
      );
      anchor.dataset.active = publicHrefPath === currentPath ? "true" : "false";
    } catch {
      // Ignore malformed links and leave them untouched.
    }
  }
}

function isFrameworkPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/.well-known") ||
    pathname === "/mcp" ||
    pathname === "/llms.txt" ||
    pathname === "/llms-full.txt" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/sitemap.md" ||
    pathname === "/AGENTS.md" ||
    pathname === "/AGENT.md" ||
    pathname === "/skill.md" ||
    /\/[^/]+\.[^/]+$/.test(pathname)
  );
}

function isDocsNavigationPath(pathname: string, entry: string, publicPath: string): boolean {
  if (isFrameworkPath(pathname)) return false;

  const normalizedEntry = `/${entry.replace(/^\/+|\/+$/g, "") || "docs"}`;
  if (pathname === normalizedEntry || pathname.startsWith(`${normalizedEntry}/`)) return true;

  if (publicPath === "") return pathname.startsWith("/");
  return pathname === publicPath || pathname.startsWith(`${publicPath}/`);
}

function installDocsPathNavigationGuard(entry: string, publicPath: string) {
  const normalizedEntry = `/${entry.replace(/^\/+|\/+$/g, "") || "docs"}`;
  if (publicPath === normalizedEntry) return undefined;

  function onClick(event: MouseEvent) {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (!isDocsNavigationPath(url.pathname, entry, publicPath)) return;

      const nextPath = toPublicDocsPath(url.pathname, entry, publicPath);
      if (nextPath === url.pathname) return;

      const nextHref = `${nextPath}${url.search}${url.hash}`;

      if (
        nextHref === `${window.location.pathname}${window.location.search}${window.location.hash}`
      ) {
        return;
      }

      event.preventDefault();
      window.location.assign(nextHref);
    } catch {
      // Ignore malformed links and leave them untouched.
    }
  }

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

function decodeHashTarget(hash: string): string {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatReadingTimeLabel(minutes: number, format: ReadingTimeFormat = "long"): string {
  const normalized = Math.max(1, Math.ceil(minutes));
  return format === "short" ? `${normalized} min` : `${normalized} min read`;
}

function escapeIdSelector(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\.#:[\]>+~(){}^$|*?=!'`\s]/g, "\\$&");
}

function scrollToHashTarget(hash: string): boolean {
  if (!hash || hash === "#") return false;

  const targetId = decodeHashTarget(hash);
  if (!targetId) return false;

  const target =
    document.getElementById(targetId) ??
    document.querySelector<HTMLElement>(`#${escapeIdSelector(targetId)}`);
  if (!target) return false;

  target.scrollIntoView({ block: "start" });
  return true;
}

function TitleDecorations({
  description,
  belowTitle,
}: {
  description?: ReactNode;
  belowTitle?: ReactNode;
}) {
  if (!description && !belowTitle) return null;

  return (
    <>
      {description && <Fragment key="description">{description}</Fragment>}
      {belowTitle && <Fragment key="below-title">{belowTitle}</Fragment>}
    </>
  );
}

function ThreadlinePageControls() {
  return (
    <div className="fd-threadline-doc-controls not-prose" aria-label="Page controls">
      <button key="back" type="button" aria-label="Go back" onClick={() => window.history.back()}>
        <span aria-hidden="true">&lt;</span>
      </button>
      <button
        key="forward"
        type="button"
        aria-label="Go forward"
        onClick={() => window.history.forward()}
      >
        <span aria-hidden="true">&gt;</span>
      </button>
    </div>
  );
}

function findThreadlineTocActionsContainer(): HTMLElement | null {
  const toc =
    document.getElementById("nd-toc") ?? document.querySelector<HTMLElement>(".fd-toc, [data-toc]");

  if (!toc) return null;

  const stickyChild = toc.querySelector<HTMLElement>(
    ":scope > .sticky, :scope > [class*='sticky']",
  );
  if (stickyChild) return stickyChild;

  const tocClassName = typeof toc.className === "string" ? toc.className : "";
  if (tocClassName.includes("grid-area:toc")) return toc;

  let node = toc.parentElement;

  while (node && node.id !== "nd-docs-layout") {
    const className = typeof node.className === "string" ? node.className : "";

    if (
      className.includes("grid-area:toc") ||
      window.getComputedStyle(node).position === "sticky"
    ) {
      return node;
    }

    node = node.parentElement;
  }

  return toc.parentElement ?? toc;
}

export function DocsPageClient({
  tocEnabled,
  tocStyle = "default",
  breadcrumbEnabled = true,
  changelogBasePath,
  entry = "docs",
  publicPath,
  locale,
  copyMarkdown = false,
  copyMarkdownFormat,
  copyMarkdownIncludeTitle,
  copyMarkdownLabel,
  copyMarkdownCopiedLabel,
  openDocs = false,
  openDocsProviders,
  openDocsTarget,
  openDocsPrompt,
  pageActionsPosition = "below-title",
  pageActionsAlignment = "left",
  githubUrl,
  contentDir,
  githubBranch = "main",
  githubDirectory,
  editOnGithubUrl,
  lastModifiedMap,
  lastModified: lastModifiedProp,
  readingTimeMap,
  readingTime: readingTimeProp,
  readingTimeFormat = "long",
  previousPage,
  nextPage,
  structuredDataMap,
  structuredData: structuredDataProp,
  readingTimeEnabled = false,
  lastUpdatedEnabled = true,
  lastUpdatedLabel = "Last updated",
  lastUpdatedPosition = "footer",
  llmsTxtEnabled = false,
  descriptionMap,
  description,
  feedbackEnabled = false,
  feedbackQuestion,
  feedbackPlaceholder,
  feedbackRequireComment,
  feedbackPositiveLabel,
  feedbackNegativeLabel,
  feedbackSubmitLabel,
  feedbackSuccessMessage,
  feedbackErrorMessage,
  feedbackOnFeedback,
  analytics = false,
  children,
}: DocsPageClientProps) {
  const fdTocStyle = tocStyle === "directional" ? "clerk" : undefined;
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [titlePortalHost, setTitlePortalHost] = useState<HTMLElement | null>(null);
  const [titleControlsPortalHost, setTitleControlsPortalHost] = useState<HTMLElement | null>(null);
  const [tocActionsPortalHost, setTocActionsPortalHost] = useState<HTMLElement | null>(null);
  const pathname = usePathname();
  const browserPathname = useWindowPathname();
  const searchParams = useWindowSearchParams();
  const activeLocale = resolveClientLocale(searchParams, locale);
  const resolvedPublicPath = normalizePublicDocsPath(publicPath, entry);
  const llmsLangQuery = activeLocale ? `?lang=${encodeURIComponent(activeLocale)}` : "";

  const pageDescription = description ?? descriptionMap?.[pathname.replace(/\/$/, "") || "/"];
  const normalizedPath = (browserPathname || pathname).replace(/\/$/, "") || "/";
  const isChangelogRoute = !!(
    changelogBasePath &&
    (normalizedPath === changelogBasePath || normalizedPath.startsWith(`${changelogBasePath}/`))
  );
  const matchedReadingTime = readingTimeMap?.[normalizedPath];
  const structuredDataJson = !isChangelogRoute
    ? (structuredDataProp ?? structuredDataMap?.[normalizedPath])
    : undefined;

  useEffect(() => {
    if (!analytics) return;
    emitClientAnalyticsEvent({
      type: "page_view",
      locale: activeLocale,
      path: normalizedPath,
      properties: {
        entry,
        pathname: normalizedPath,
        isChangelogRoute,
      },
    });
  }, [analytics, activeLocale, entry, isChangelogRoute, normalizedPath]);

  useEffect(() => {
    return installDocsPathNavigationGuard(entry, resolvedPublicPath);
  }, [entry, resolvedPublicPath]);

  const resolvedReadingTime = !isChangelogRoute
    ? readingTimeProp !== undefined
      ? readingTimeProp
      : readingTimeEnabled
        ? matchedReadingTime
        : undefined
    : undefined;
  const effectiveTocEnabled = isChangelogRoute ? false : tocEnabled;
  const effectiveBreadcrumbEnabled = isChangelogRoute ? false : breadcrumbEnabled;

  useEffect(() => {
    if (!effectiveTocEnabled) return;

    const timer = requestAnimationFrame(() => {
      const container = document.getElementById("nd-page");
      if (!container) return;

      const headings = container.querySelectorAll("h2[id], h3[id], h4[id]");
      const items: TOCItem[] = Array.from(headings).map((el) => ({
        title: el.textContent?.replace(/^#\s*/, "") || "",
        url: `#${el.id}`,
        depth: parseInt(el.tagName[1], 10),
      }));

      setToc(items);
    });

    return () => cancelAnimationFrame(timer);
  }, [effectiveTocEnabled, pathname]);

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      const root = document.body;
      if (!root) return;
      rewriteDocsPathLinks(root, entry, resolvedPublicPath);
      syncDocsPathActiveLinks(root, entry, resolvedPublicPath);
      if (!activeLocale) return;
      localizeInternalLinks(root, activeLocale);
    });

    return () => cancelAnimationFrame(timer);
  }, [activeLocale, browserPathname, children, entry, pathname, resolvedPublicPath]);

  useEffect(() => {
    const root = document.documentElement;

    if (isChangelogRoute) {
      root.dataset.fdRouteKind = "changelog";
      return () => {
        if (root.dataset.fdRouteKind === "changelog") {
          delete root.dataset.fdRouteKind;
        }
      };
    }

    if (root.dataset.fdRouteKind === "changelog") {
      delete root.dataset.fdRouteKind;
    }
  }, [isChangelogRoute]);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;
    let cancelled = false;

    const scheduleScroll = (attempt = 0) => {
      if (cancelled) return;
      const hash = window.location.hash;
      if (!hash) return;

      if (scrollToHashTarget(hash) || attempt >= 20) return;

      timeout = window.setTimeout(() => {
        frame = requestAnimationFrame(() => scheduleScroll(attempt + 1));
      }, 100);
    };

    frame = requestAnimationFrame(() => scheduleScroll());

    const onHashChange = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      frame = requestAnimationFrame(() => scheduleScroll());
    };

    window.addEventListener("hashchange", onHashChange);

    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHashChange);
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [pathname, children]);

  const showActions =
    !isChangelogRoute && (copyMarkdown || openDocs || pageActionsPosition === "toc");
  const showActionsBelowTitle = showActions && pageActionsPosition === "below-title";
  const showActionsAboveTitle = showActions && pageActionsPosition === "above-title";
  const showActionsInToc = showActions && pageActionsPosition === "toc";
  const githubFileUrl =
    editOnGithubUrl ??
    (githubUrl
      ? buildGithubFileUrl(
          githubUrl,
          githubBranch,
          pathname,
          entry,
          activeLocale,
          githubDirectory,
          contentDir,
        )
      : undefined);

  useEffect(() => {
    if (!showActionsInToc) {
      setTocActionsPortalHost(null);
      return;
    }

    let frame = 0;
    let attempts = 0;
    let host: HTMLElement | null = null;
    let cancelled = false;

    const mountActions = () => {
      if (cancelled) return;

      const container = findThreadlineTocActionsContainer();

      if (!container) {
        if (attempts < 12) {
          attempts += 1;
          frame = requestAnimationFrame(mountActions);
        } else {
          setTocActionsPortalHost(null);
        }
        return;
      }

      host = container.querySelector<HTMLElement>(":scope > .fd-actions-toc-host");

      if (!host) {
        host = document.createElement("div");
        host.className = "fd-actions-toc-host";
        container.append(host);
      }

      setTocActionsPortalHost(host);
    };

    frame = requestAnimationFrame(mountActions);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);

      if (host?.isConnected) {
        host.remove();
      }

      setTocActionsPortalHost(null);
    };
  }, [pathname, showActionsInToc, toc.length]);

  useEffect(() => {
    if (!showActionsInToc) {
      setTitleControlsPortalHost(null);
      return;
    }

    const container = document.getElementById("nd-page");
    const title = container?.querySelector("h1");
    if (!title) {
      setTitleControlsPortalHost(null);
      return;
    }

    const host = document.createElement("div");
    host.className = "fd-threadline-title-controls-host";
    title.insertAdjacentElement("afterend", host);
    setTitleControlsPortalHost(host);

    return () => {
      host.remove();
      setTitleControlsPortalHost(null);
    };
  }, [pathname, showActionsInToc]);

  const lastModified =
    !isChangelogRoute && lastUpdatedEnabled
      ? (lastModifiedProp ?? lastModifiedMap?.[normalizedPath])
      : undefined;

  const showLastUpdatedBelowTitle = !!lastModified && lastUpdatedPosition === "below-title";
  const showLastUpdatedInFooter = !!lastModified && lastUpdatedPosition === "footer";
  const lastUpdatedLabelText = lastUpdatedLabel.trim();
  const lastUpdatedText =
    lastUpdatedLabelText && lastModified ? `${lastUpdatedLabelText} ${lastModified}` : lastModified;
  const showFooter =
    !isChangelogRoute && (!!githubFileUrl || showLastUpdatedInFooter || llmsTxtEnabled);
  const localizedPreviousPage = previousPage?.url
    ? { ...previousPage, url: withLangInUrl(previousPage.url, activeLocale) }
    : null;
  const localizedNextPage = nextPage?.url
    ? { ...nextPage, url: withLangInUrl(nextPage.url, activeLocale) }
    : null;
  const showPageNavigation = !isChangelogRoute && (!!localizedPreviousPage || !!localizedNextPage);
  const readingTimeBlock =
    typeof resolvedReadingTime === "number" ? (
      <div key="reading-time" className="fd-page-meta not-prose">
        <span className="fd-page-meta-dot" aria-hidden="true">
          ·
        </span>
        <span className="fd-page-meta-item">
          {formatReadingTimeLabel(resolvedReadingTime, readingTimeFormat)}
        </span>
      </div>
    ) : undefined;

  const titleDescription = pageDescription ? (
    <p className="fd-page-description">{pageDescription}</p>
  ) : undefined;

  const showReadingTimeAboveTitle = !!readingTimeBlock && showActionsAboveTitle;
  const showReadingTimeBelowTitle =
    !!readingTimeBlock &&
    !showReadingTimeAboveTitle &&
    (showActionsBelowTitle ||
      showLastUpdatedBelowTitle ||
      (!showActions && pageActionsPosition === "below-title"));

  const belowTitleBlock =
    showLastUpdatedBelowTitle || showActionsBelowTitle || showReadingTimeBelowTitle ? (
      <div key="below-title" className="fd-below-title-block not-prose">
        {showLastUpdatedBelowTitle && (
          <p key="last-updated" className="fd-last-updated-inline">
            {lastUpdatedText}
          </p>
        )}
        <hr key="separator" className="fd-title-separator" />
        {showActionsBelowTitle && (
          <div
            key="actions"
            className="fd-actions-portal"
            data-actions-alignment={pageActionsAlignment}
          >
            <PageActions
              copyMarkdown={copyMarkdown}
              copyMarkdownFormat={copyMarkdownFormat}
              copyMarkdownIncludeTitle={copyMarkdownIncludeTitle}
              copyMarkdownLabel={copyMarkdownLabel}
              copyMarkdownCopiedLabel={copyMarkdownCopiedLabel}
              openDocs={openDocs}
              providers={openDocsProviders}
              openDocsTarget={openDocsTarget}
              openDocsPrompt={openDocsPrompt}
              alignment={pageActionsAlignment}
              variant="default"
              githubFileUrl={githubFileUrl}
              analytics={analytics}
            />
          </div>
        )}
        {showReadingTimeBelowTitle && readingTimeBlock}
      </div>
    ) : undefined;

  const decoratedChildren = children;
  const needsTitleDecorationsPortal = !!titleDescription || !!belowTitleBlock;

  useEffect(() => {
    if (!needsTitleDecorationsPortal) {
      setTitlePortalHost(null);
      return;
    }

    const container = document.getElementById("nd-page");
    const title = container?.querySelector("h1");
    if (!title) {
      setTitlePortalHost(null);
      return;
    }

    const host = document.createElement("div");
    host.className = "fd-title-decorations-host";
    title.insertAdjacentElement("afterend", host);
    setTitlePortalHost(host);

    return () => {
      host.remove();
      setTitlePortalHost(null);
    };
  }, [needsTitleDecorationsPortal, pathname]);

  const titleDecorations = needsTitleDecorationsPortal ? (
    <TitleDecorations description={titleDescription} belowTitle={belowTitleBlock} />
  ) : null;
  const titleDecorationsPortal =
    titleDecorations && titlePortalHost
      ? createPortal(titleDecorations, titlePortalHost, "title-decorations")
      : null;
  const titleDecorationsFallback = titleDecorations && !titlePortalHost ? titleDecorations : null;
  const titleControlsPortal =
    showActionsInToc && titleControlsPortalHost
      ? createPortal(<ThreadlinePageControls />, titleControlsPortalHost, "title-controls")
      : null;
  const tocActionsPortal =
    showActionsInToc && tocActionsPortalHost
      ? createPortal(
          <div className="fd-actions-toc-portal not-prose">
            <PageActions
              copyMarkdown={copyMarkdown}
              copyMarkdownFormat={copyMarkdownFormat}
              copyMarkdownIncludeTitle={copyMarkdownIncludeTitle}
              copyMarkdownLabel={copyMarkdownLabel}
              copyMarkdownCopiedLabel={copyMarkdownCopiedLabel}
              openDocs={openDocs}
              providers={openDocsProviders}
              openDocsTarget={openDocsTarget}
              openDocsPrompt={openDocsPrompt}
              alignment="left"
              variant="rail"
              githubFileUrl={githubFileUrl}
              analytics={analytics}
            />
          </div>,
          tocActionsPortalHost,
          "toc-actions",
        )
      : null;
  const renderedChildren = Children.toArray(decoratedChildren).map((child, index) => (
    <Fragment key={`fd-rendered-child-${index}`}>{child}</Fragment>
  ));

  return (
    <>
      {structuredDataJson && (
        <script
          key="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLdForScript(structuredDataJson) }}
        />
      )}
      {llmsTxtEnabled && (
        <a
          key="llms-txt"
          href={`/llms.txt${llmsLangQuery}`}
          className="fd-agent-llms-directive"
          style={agentLlmsDirectiveStyle}
          tabIndex={-1}
          aria-hidden="true"
        >
          llms.txt
        </a>
      )}
      {titleControlsPortal}
      {tocActionsPortal}
      <DocsPage
        key="docs-page"
        full={false}
        toc={toc}
        tableOfContent={{ enabled: effectiveTocEnabled, style: fdTocStyle }}
        tableOfContentPopover={{ enabled: effectiveTocEnabled, style: fdTocStyle }}
        breadcrumb={{ enabled: false }}
        footer={{ enabled: !isChangelogRoute }}
      >
        {effectiveBreadcrumbEnabled && (
          <PathBreadcrumb
            key="breadcrumb"
            pathname={pathname}
            publicPath={resolvedPublicPath}
            locale={activeLocale}
          />
        )}
        {showActionsAboveTitle && (
          <div key="actions-above-title" className="fd-below-title-block not-prose">
            <div
              key="actions"
              className="fd-actions-portal"
              data-actions-alignment={pageActionsAlignment}
            >
              <PageActions
                copyMarkdown={copyMarkdown}
                copyMarkdownFormat={copyMarkdownFormat}
                copyMarkdownIncludeTitle={copyMarkdownIncludeTitle}
                copyMarkdownLabel={copyMarkdownLabel}
                copyMarkdownCopiedLabel={copyMarkdownCopiedLabel}
                openDocs={openDocs}
                providers={openDocsProviders}
                openDocsTarget={openDocsTarget}
                openDocsPrompt={openDocsPrompt}
                alignment={pageActionsAlignment}
                variant="default"
                githubFileUrl={githubFileUrl}
                analytics={analytics}
              />
            </div>
            {readingTimeBlock}
          </div>
        )}
        {!showReadingTimeAboveTitle && !showReadingTimeBelowTitle ? readingTimeBlock : null}
        <DocsBody key="body" style={{ display: "flex", flexDirection: "column" }}>
          <div key="content" style={{ flex: 1 }}>
            {renderedChildren}
          </div>
          {titleDecorationsFallback}
          {titleDecorationsPortal}
          {!isChangelogRoute && feedbackEnabled && (
            <DocsFeedback
              key="feedback"
              pathname={normalizedPath}
              entry={entry}
              locale={activeLocale}
              question={feedbackQuestion}
              placeholder={feedbackPlaceholder}
              requireComment={feedbackRequireComment}
              positiveLabel={feedbackPositiveLabel}
              negativeLabel={feedbackNegativeLabel}
              submitLabel={feedbackSubmitLabel}
              successMessage={feedbackSuccessMessage}
              errorMessage={feedbackErrorMessage}
              onFeedback={feedbackOnFeedback}
              analytics={analytics}
            />
          )}
          {showFooter && (
            <div key="footer" className="not-prose fd-page-footer">
              {githubFileUrl && <EditOnGitHub key="github" href={githubFileUrl} />}
              {llmsTxtEnabled && (
                <span key="llms-links" className="fd-llms-txt-links">
                  <a
                    href={`/llms.txt${llmsLangQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fd-llms-txt-link"
                  >
                    llms.txt
                  </a>
                  <a
                    href={`/llms-full.txt${llmsLangQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fd-llms-txt-link"
                  >
                    llms-full.txt
                  </a>
                </span>
              )}
              {showLastUpdatedInFooter && lastModified && (
                <span key="last-updated" className="fd-last-updated-footer">
                  {lastUpdatedText}
                </span>
              )}
            </div>
          )}
          {showPageNavigation && (
            <nav
              key="page-navigation"
              className="not-prose fd-page-nav"
              aria-label="Page navigation"
            >
              {localizedPreviousPage ? (
                <a href={localizedPreviousPage.url} className="fd-page-nav-card fd-page-nav-prev">
                  <span className="fd-page-nav-title fd-page-nav-title-prev">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    {localizedPreviousPage.name}
                  </span>
                  <span className="fd-page-nav-description">Previous Page</span>
                </a>
              ) : (
                <div aria-hidden="true" />
              )}
              {localizedNextPage ? (
                <a href={localizedNextPage.url} className="fd-page-nav-card fd-page-nav-next">
                  <span className="fd-page-nav-title fd-page-nav-title-next">
                    {localizedNextPage.name}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                  <span className="fd-page-nav-description">Next Page</span>
                </a>
              ) : (
                <div aria-hidden="true" />
              )}
            </nav>
          )}
        </DocsBody>
      </DocsPage>
    </>
  );
}

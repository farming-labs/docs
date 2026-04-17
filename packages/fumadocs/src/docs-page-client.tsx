"use client";

import { DocsBody, DocsPage, EditOnGitHub } from "fumadocs-ui/layouts/docs/page";
import { Children, cloneElement, isValidElement, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "fumadocs-core/framework";
import type { DocsFeedbackData } from "@farming-labs/docs";
import { PageActions } from "./page-actions.js";
import { useWindowSearchParams } from "./client-location.js";
import { DocsFeedback } from "./docs-feedback.js";
import { resolveClientLocale, withLangInUrl } from "./i18n.js";

interface TOCItem {
  title: string;
  url: string;
  depth: number;
}

interface TitleInsertions {
  description?: ReactNode;
  belowTitle?: ReactNode;
}

/** Serializable provider — icon is an HTML string, not JSX. */
interface SerializedProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
}

interface DocsPageClientProps {
  tocEnabled: boolean;
  tocStyle?: "default" | "directional";
  breadcrumbEnabled?: boolean;
  changelogBasePath?: string;
  /** The docs entry folder name (e.g. "docs") — used to strip from breadcrumb */
  entry?: string;
  /** Active locale (used for llms.txt links) */
  locale?: string;
  copyMarkdown?: boolean;
  openDocs?: boolean;
  openDocsProviders?: SerializedProvider[];
  /** Where to render page actions relative to the title */
  pageActionsPosition?: "above-title" | "below-title";
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
  /** Whether to show "Last updated" at all */
  lastUpdatedEnabled?: boolean;
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
  feedbackPositiveLabel?: string;
  feedbackNegativeLabel?: string;
  feedbackSubmitLabel?: string;
  feedbackOnFeedback?: (data: DocsFeedbackData) => void | Promise<void>;
  children: ReactNode;
}

/**
 * Path-based breadcrumb that shows only parent / current folder.
 * Skips the entry segment (e.g. "docs"). Parent is clickable.
 */
function PathBreadcrumb({
  pathname,
  entry,
  locale,
}: {
  pathname: string;
  entry: string;
  locale?: string;
}) {
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const entryParts = entry.split("/").filter(Boolean);
  const contentSegments = segments.slice(entryParts.length);

  if (contentSegments.length < 2) return null;

  const parentSegment = contentSegments[contentSegments.length - 2];
  const currentSegment = contentSegments[contentSegments.length - 1];

  const parentLabel = parentSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const currentLabel = currentSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const parentUrl =
    "/" + [...segments.slice(0, entryParts.length), ...contentSegments.slice(0, -1)].join("/");
  const localizedParentUrl = withLangInUrl(parentUrl, locale);

  return (
    <nav className="fd-breadcrumb" aria-label="Breadcrumb">
      <span className="fd-breadcrumb-item">
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
      <span className="fd-breadcrumb-item">
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

function decodeHashTarget(hash: string): string {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

function injectTitleDecorations(
  node: ReactNode,
  { description, belowTitle }: TitleInsertions,
): { node: ReactNode; inserted: boolean } {
  if (!description && !belowTitle) return { node, inserted: false };

  let inserted = false;

  const extras = [description, belowTitle].filter(Boolean);
  if (extras.length === 0) return { node, inserted: false };

  function visit(current: ReactNode): ReactNode {
    if (current == null || typeof current === "boolean") return current;
    if (inserted) return current;

    if (Array.isArray(current)) {
      return current.flatMap((child) => {
        const next = visit(child);
        return Array.isArray(next) ? next : [next];
      });
    }

    if (!isValidElement(current)) return current;

    if (typeof current.type === "string" && current.type === "h1") {
      inserted = true;
      return [current, ...extras];
    }

    const childProps = (current.props as { children?: ReactNode } | null) ?? null;
    if (childProps?.children === undefined) return current;

    const nextChildren = Children.toArray(childProps.children).flatMap((child) => {
      const next = visit(child);
      return Array.isArray(next) ? next : [next];
    });

    if (!inserted) return current;

    return cloneElement(current, undefined, nextChildren);
  }

  if (Array.isArray(node)) {
    return {
      node: node.flatMap((child) => {
        const next = visit(child);
        return Array.isArray(next) ? next : [next];
      }),
      inserted,
    };
  }

  return {
    node: visit(node),
    inserted,
  };
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
      {description}
      {belowTitle}
    </>
  );
}

export function DocsPageClient({
  tocEnabled,
  tocStyle = "default",
  breadcrumbEnabled = true,
  changelogBasePath,
  entry = "docs",
  locale,
  copyMarkdown = false,
  openDocs = false,
  openDocsProviders,
  pageActionsPosition = "below-title",
  pageActionsAlignment = "left",
  githubUrl,
  contentDir,
  githubBranch = "main",
  githubDirectory,
  editOnGithubUrl,
  lastModifiedMap,
  lastModified: lastModifiedProp,
  lastUpdatedEnabled = true,
  lastUpdatedPosition = "footer",
  llmsTxtEnabled = false,
  descriptionMap,
  description,
  feedbackEnabled = false,
  feedbackQuestion,
  feedbackPlaceholder,
  feedbackPositiveLabel,
  feedbackNegativeLabel,
  feedbackSubmitLabel,
  feedbackOnFeedback,
  children,
}: DocsPageClientProps) {
  const fdTocStyle = tocStyle === "directional" ? "clerk" : undefined;
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [titlePortalHost, setTitlePortalHost] = useState<HTMLElement | null>(null);
  const [browserPath, setBrowserPath] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useWindowSearchParams();
  const activeLocale = resolveClientLocale(searchParams, locale);
  const llmsLangParam = activeLocale ? `&lang=${encodeURIComponent(activeLocale)}` : "";

  const pageDescription = description ?? descriptionMap?.[pathname.replace(/\/$/, "") || "/"];
  const normalizedPath = (browserPath ?? pathname).replace(/\/$/, "") || "/";
  const isChangelogRoute = !!(
    changelogBasePath &&
    (normalizedPath === changelogBasePath ||
      normalizedPath.startsWith(`${changelogBasePath}/`))
  );
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
    if (!activeLocale) return;

    const timer = requestAnimationFrame(() => {
      const container = document.getElementById("nd-page");
      if (!container) return;
      localizeInternalLinks(container, activeLocale);
    });

    return () => cancelAnimationFrame(timer);
  }, [activeLocale, children, pathname]);

  useEffect(() => {
    setBrowserPath(window.location.pathname);
  }, [pathname]);

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

  const showActions = !isChangelogRoute && (copyMarkdown || openDocs);
  const showActionsBelowTitle = showActions && pageActionsPosition === "below-title";
  const showActionsAboveTitle = showActions && pageActionsPosition === "above-title";
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

  const lastModified = !isChangelogRoute && lastUpdatedEnabled
    ? (lastModifiedProp ?? lastModifiedMap?.[normalizedPath])
    : undefined;

  const showLastUpdatedBelowTitle = !!lastModified && lastUpdatedPosition === "below-title";
  const showLastUpdatedInFooter = !!lastModified && lastUpdatedPosition === "footer";
  const showFooter =
    !isChangelogRoute && (!!githubFileUrl || showLastUpdatedInFooter || llmsTxtEnabled);

  const titleDescription = pageDescription ? (
    <p className="fd-page-description">{pageDescription}</p>
  ) : undefined;

  const belowTitleBlock =
    showLastUpdatedBelowTitle || showActionsBelowTitle ? (
      <div className="fd-below-title-block not-prose">
        {showLastUpdatedBelowTitle && (
          <p className="fd-last-updated-inline">Last updated {lastModified}</p>
        )}
        <hr className="fd-title-separator" />
        {showActionsBelowTitle && (
          <div className="fd-actions-portal" data-actions-alignment={pageActionsAlignment}>
            <PageActions
              copyMarkdown={copyMarkdown}
              openDocs={openDocs}
              providers={openDocsProviders}
              alignment={pageActionsAlignment}
              githubFileUrl={githubFileUrl}
            />
          </div>
        )}
      </div>
    ) : undefined;

  const { node: decoratedChildren, inserted: titleDecorationsInserted } = injectTitleDecorations(
    children,
    {
      description: titleDescription,
      belowTitle: belowTitleBlock,
    },
  );
  const needsTitleDecorationsPortal =
    !titleDecorationsInserted && (!!titleDescription || !!belowTitleBlock);

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

  const titleDecorationsPortal =
    needsTitleDecorationsPortal && titlePortalHost
      ? createPortal(
          <TitleDecorations description={titleDescription} belowTitle={belowTitleBlock} />,
          titlePortalHost,
        )
      : null;

  return (
    <DocsPage
      full={false}
      toc={toc}
      tableOfContent={{ enabled: effectiveTocEnabled, style: fdTocStyle }}
      tableOfContentPopover={{ enabled: effectiveTocEnabled, style: fdTocStyle }}
      breadcrumb={{ enabled: false }}
      footer={{ enabled: !isChangelogRoute }}
    >
      {effectiveBreadcrumbEnabled && (
        <PathBreadcrumb pathname={pathname} entry={entry} locale={activeLocale} />
      )}
      {showActionsAboveTitle && (
        <div className="fd-below-title-block not-prose">
          <div className="fd-actions-portal" data-actions-alignment={pageActionsAlignment}>
            <PageActions
              copyMarkdown={copyMarkdown}
              openDocs={openDocs}
              providers={openDocsProviders}
              alignment={pageActionsAlignment}
              githubFileUrl={githubFileUrl}
            />
          </div>
        </div>
      )}
      <DocsBody style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1 }}>{decoratedChildren}</div>
        {titleDecorationsPortal}
        {!isChangelogRoute && feedbackEnabled && (
          <DocsFeedback
            pathname={normalizedPath}
            entry={entry}
            locale={activeLocale}
            question={feedbackQuestion}
            placeholder={feedbackPlaceholder}
            positiveLabel={feedbackPositiveLabel}
            negativeLabel={feedbackNegativeLabel}
            submitLabel={feedbackSubmitLabel}
            onFeedback={feedbackOnFeedback}
          />
        )}
        {showFooter && (
          <div className="not-prose fd-page-footer">
            {githubFileUrl && <EditOnGitHub href={githubFileUrl} />}
            {llmsTxtEnabled && (
              <span className="fd-llms-txt-links">
                <a
                  href={`/api/docs?format=llms${llmsLangParam}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fd-llms-txt-link"
                >
                  llms.txt
                </a>
                <a
                  href={`/api/docs?format=llms-full${llmsLangParam}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fd-llms-txt-link"
                >
                  llms-full.txt
                </a>
              </span>
            )}
            {showLastUpdatedInFooter && lastModified && (
              <span className="fd-last-updated-footer">Last updated {lastModified}</span>
            )}
          </div>
        )}
      </DocsBody>
    </DocsPage>
  );
}

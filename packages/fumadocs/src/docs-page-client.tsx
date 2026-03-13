"use client";

import { DocsBody, DocsPage, EditOnGitHub } from "fumadocs-ui/layouts/docs/page";
import { useEffect, useState, type ReactNode } from "react";
// @ts-ignore – resolved by the workspace dependency graph
import { createPortal } from "react-dom";
// @ts-ignore – resolved by Next.js at runtime
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageActions } from "./page-actions.js";
import { resolveClientLocale, withLangInUrl } from "./i18n.js";

interface TOCItem {
  title: string;
  url: string;
  depth: number;
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
  /** GitHub branch name @default "main" */
  githubBranch?: string;
  /** Subdirectory in the repo where the docs site lives (for monorepos) */
  githubDirectory?: string;
  /** Map of pathname → formatted last-modified date string */
  lastModifiedMap?: Record<string, string>;
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
): string {
  const normalizedEntry = entry.replace(/^\/+|\/+$/g, "") || "docs";
  const entryParts = normalizedEntry.split("/").filter(Boolean);
  const pathnameParts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const slugParts =
    pathnameParts.slice(0, entryParts.length).join("/") === entryParts.join("/")
      ? pathnameParts.slice(entryParts.length)
      : pathnameParts;
  const dirPrefix = directory ? `${directory}/` : "";
  const basePath = `app/${normalizedEntry}`;
  const relativePath = [locale, slugParts.join("/")].filter(Boolean).join("/");
  const path = `${dirPrefix}${basePath}${relativePath ? `/${relativePath}` : ""}/page.mdx`;
  return `${githubUrl}/edit/${branch}/${path}`;
}

function localizeInternalLinks(root: ParentNode, locale?: string) {
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href]:not([data-fd-lang-localized="true"])');

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

export function DocsPageClient({
  tocEnabled,
  tocStyle = "default",
  breadcrumbEnabled = true,
  entry = "docs",
  locale,
  copyMarkdown = false,
  openDocs = false,
  openDocsProviders,
  pageActionsPosition = "below-title",
  pageActionsAlignment = "left",
  githubUrl,
  githubBranch = "main",
  githubDirectory,
  lastModifiedMap,
  lastUpdatedEnabled = true,
  lastUpdatedPosition = "footer",
  llmsTxtEnabled = false,
  descriptionMap,
  description,
  children,
}: DocsPageClientProps) {
  const fdTocStyle = tocStyle === "directional" ? "clerk" : undefined;
  const [toc, setToc] = useState<TOCItem[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeLocale = resolveClientLocale(searchParams, locale);
  const llmsLangParam = activeLocale ? `&lang=${encodeURIComponent(activeLocale)}` : "";
  const [actionsPortalTarget, setActionsPortalTarget] = useState<HTMLElement | null>(null);

  const pageDescription = description ?? descriptionMap?.[pathname.replace(/\/$/, "") || "/"];

  useEffect(() => {
    if (!tocEnabled) return;

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
  }, [tocEnabled, pathname]);

  // Inject frontmatter description right below the first h1 on the page
  useEffect(() => {
    if (!pageDescription) return;

    const timer = requestAnimationFrame(() => {
      const container = document.getElementById("nd-page");
      if (!container) return;

      const existingDesc = container.querySelector(".fd-page-description");
      if (existingDesc) existingDesc.remove();

      const h1 = container.querySelector("h1");
      if (!h1) return;

      const descEl = document.createElement("p");
      descEl.className = "fd-page-description";
      descEl.textContent = pageDescription;
      h1.insertAdjacentElement("afterend", descEl);
    });

    return () => {
      cancelAnimationFrame(timer);
      const desc = document.querySelector("#nd-page .fd-page-description");
      if (desc) desc.remove();
    };
  }, [pageDescription, pathname]);

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      const container = document.getElementById("nd-page");
      if (!container) return;
      localizeInternalLinks(container, activeLocale);
    });

    return () => cancelAnimationFrame(timer);
  }, [activeLocale, children, pathname]);

  const showActions = copyMarkdown || openDocs;
  const githubFileUrl = githubUrl
    ? buildGithubFileUrl(githubUrl, githubBranch, pathname, entry, activeLocale, githubDirectory)
    : undefined;

  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const lastModified = lastUpdatedEnabled ? lastModifiedMap?.[normalizedPath] : undefined;

  const showLastUpdatedBelowTitle = !!lastModified && lastUpdatedPosition === "below-title";
  const showLastUpdatedInFooter = !!lastModified && lastUpdatedPosition === "footer";
  const showFooter = !!githubFileUrl || showLastUpdatedInFooter || llmsTxtEnabled;

  const needsBelowTitleBlock = showLastUpdatedBelowTitle || showActions;

  // Inject: last-updated (below-title mode), separator, and page-actions portal target after h1
  useEffect(() => {
    if (!needsBelowTitleBlock) return;

    const timer = requestAnimationFrame(() => {
      const container = document.getElementById("nd-page");
      if (!container) return;

      container.querySelectorAll(".fd-below-title-block").forEach((el) => el.remove());

      const h1 = container.querySelector("h1");
      if (!h1) return;

      let insertAfter: Element = h1;
      const desc = container.querySelector(".fd-page-description");
      if (desc) insertAfter = desc;

      const wrapper = document.createElement("div");
      wrapper.className = "fd-below-title-block not-prose";

      if (showLastUpdatedBelowTitle) {
        const lastUpdatedEl = document.createElement("p");
        lastUpdatedEl.className = "fd-last-updated-inline";
        lastUpdatedEl.textContent = `Last updated ${lastModified}`;
        wrapper.appendChild(lastUpdatedEl);
      }

      if (showLastUpdatedBelowTitle || showActions) {
        const hr = document.createElement("hr");
        hr.className = "fd-title-separator";
        wrapper.appendChild(hr);
      }

      if (showActions) {
        const portalEl = document.createElement("div");
        portalEl.className = "fd-actions-portal";
        portalEl.setAttribute("data-actions-alignment", pageActionsAlignment);
        wrapper.appendChild(portalEl);
        setActionsPortalTarget(portalEl);
      }

      insertAfter.insertAdjacentElement("afterend", wrapper);
    });

    return () => {
      cancelAnimationFrame(timer);
      setActionsPortalTarget(null);
      document.querySelectorAll("#nd-page .fd-below-title-block").forEach((el) => el.remove());
    };
  }, [
    lastModified,
    needsBelowTitleBlock,
    showLastUpdatedBelowTitle,
    showActions,
    pageActionsAlignment,
    pathname,
  ]);

  return (
    <DocsPage
      toc={toc}
      tableOfContent={{ enabled: tocEnabled, style: fdTocStyle }}
      tableOfContentPopover={{ enabled: tocEnabled, style: fdTocStyle }}
      breadcrumb={{ enabled: false }}
    >
      {breadcrumbEnabled && <PathBreadcrumb pathname={pathname} entry={entry} locale={activeLocale} />}
      {showActions &&
        actionsPortalTarget &&
        createPortal(
          <PageActions
            copyMarkdown={copyMarkdown}
            openDocs={openDocs}
            providers={openDocsProviders}
            githubFileUrl={githubFileUrl}
          />,
          actionsPortalTarget,
        )}
      <DocsBody style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1 }}>{children}</div>
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

"use client";

import { DocsBody, DocsPage, EditOnGitHub } from "fumadocs-ui/layouts/docs/page";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
// @ts-ignore – resolved by Next.js at runtime
import { usePathname, useRouter } from "next/navigation";
import { PageActions } from "./page-actions.js";

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
}: {
  pathname: string;
  entry: string;
}) {
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 2) return null;

  const parentSegment = segments[segments.length - 2];
  const currentSegment = segments[segments.length - 1];

  const parentLabel = parentSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const currentLabel = currentSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const parentUrl = "/" + segments.slice(0, segments.length - 1).join("/");

  return (
    <nav className="fd-breadcrumb" aria-label="Breadcrumb">
      <span className="fd-breadcrumb-item">
        <a
          href={parentUrl}
          className="fd-breadcrumb-parent fd-breadcrumb-link"
          onClick={(e) => {
            e.preventDefault();
            router.push(parentUrl);
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
 * Build the GitHub URL for the current page's source file.
 *
 * Examples:
 *   No directory:  https://github.com/user/repo/tree/main/app/docs/cli/page.mdx
 *   With directory: https://github.com/farming-labs/docs/tree/main/website/app/docs/cli/page.mdx
 */
function buildGithubFileUrl(
  githubUrl: string,
  branch: string,
  pathname: string,
  directory?: string,
): string {
  const segments = pathname.replace(/^\//, "").replace(/\/$/, "");
  const dirPrefix = directory ? `${directory}/` : "";
  return `${githubUrl}/tree/${branch}/${dirPrefix}app/${segments}/page.mdx`;
}

export function DocsPageClient({
  tocEnabled,
  tocStyle = "default",
  breadcrumbEnabled = true,
  entry = "docs",
  copyMarkdown = false,
  openDocs = false,
  openDocsProviders,
  pageActionsPosition = "below-title",
  pageActionsAlignment = "right",
  githubUrl,
  githubBranch = "main",
  githubDirectory,
  lastModifiedMap,
  descriptionMap,
  description,
  children,
}: DocsPageClientProps) {
  const fdTocStyle = tocStyle === "directional" ? "clerk" : undefined;
  const [toc, setToc] = useState<TOCItem[]>([]);
  const pathname = usePathname();
  const [actionsPortalTarget, setActionsPortalTarget] = useState<HTMLElement | null>(null);

  const pageDescription = description
    ?? descriptionMap?.[pathname.replace(/\/$/, "") || "/"];

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

  const showActions = copyMarkdown || openDocs;
  const githubFileUrl = githubUrl
    ? buildGithubFileUrl(githubUrl, githubBranch, pathname, githubDirectory)
    : undefined;

  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const lastModified = lastModifiedMap?.[normalizedPath];

  const showFooter = !!githubFileUrl;

  // Inject: last-updated, separator, and page-actions portal target after h1
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      const container = document.getElementById("nd-page");
      if (!container) return;

      // Clean up any previously injected elements
      container.querySelectorAll(".fd-below-title-block").forEach(el => el.remove());

      const h1 = container.querySelector("h1");
      if (!h1) return;

      // Find the insertion point: after h1, after description if present
      let insertAfter: Element = h1;
      const desc = container.querySelector(".fd-page-description");
      if (desc) insertAfter = desc;

      // Create wrapper for below-title elements
      const wrapper = document.createElement("div");
      wrapper.className = "fd-below-title-block not-prose";

      // Last updated text
      if (lastModified) {
        const lastUpdatedEl = document.createElement("p");
        lastUpdatedEl.className = "fd-last-updated-inline";
        lastUpdatedEl.textContent = `Last updated ${lastModified}`;
        wrapper.appendChild(lastUpdatedEl);
      }

      // Separator
      if (lastModified || showActions) {
        const hr = document.createElement("hr");
        hr.className = "fd-title-separator";
        wrapper.appendChild(hr);
      }

      // Portal target for page actions (React component)
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
      document.querySelectorAll("#nd-page .fd-below-title-block").forEach(el => el.remove());
    };
  }, [lastModified, showActions, pageActionsAlignment, pathname]);

  return (
    <DocsPage
      toc={toc}
      tableOfContent={{ enabled: tocEnabled, style: fdTocStyle }}
      tableOfContentPopover={{ enabled: tocEnabled, style: fdTocStyle }}
      breadcrumb={{ enabled: false }}
    >
      {breadcrumbEnabled && <PathBreadcrumb pathname={pathname} entry={entry} />}
      {/* Page actions rendered into portal target (injected after h1) */}
      {showActions && actionsPortalTarget && createPortal(
        <PageActions
          copyMarkdown={copyMarkdown}
          openDocs={openDocs}
          providers={openDocsProviders}
        />,
        actionsPortalTarget,
      )}
      <DocsBody
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div style={{ flex: 1 }}>{children}</div>
        {showFooter && (
          <div className="not-prose fd-page-footer">
            {githubFileUrl && <EditOnGitHub href={githubFileUrl} />}
          </div>
        )}
      </DocsBody>
    </DocsPage>
  );
}

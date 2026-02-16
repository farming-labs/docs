"use client";

import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  breadcrumbEnabled?: boolean;
  /** The docs entry folder name (e.g. "docs") — used to strip from breadcrumb */
  entry?: string;
  copyMarkdown?: boolean;
  openDocs?: boolean;
  openDocsProviders?: SerializedProvider[];
  /** Where to render page actions relative to the title */
  pageActionsPosition?: "above-title" | "below-title";
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
  const allSegments = pathname.split("/").filter(Boolean);
  const segments = allSegments.filter(
    (s) => s.toLowerCase() !== entry.toLowerCase(),
  );

  if (segments.length < 2) return null;

  const parentSegment = segments[segments.length - 2];
  const currentSegment = segments[segments.length - 1];

  const parentLabel = parentSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const currentLabel = currentSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const parentIndex = allSegments.indexOf(parentSegment);
  const parentUrl = "/" + allSegments.slice(0, parentIndex + 1).join("/");

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
 * Inserts `el` right after the first <h1> inside `container`.
 * Returns true if successful.
 */
function insertAfterH1(container: HTMLElement, el: HTMLElement): boolean {
  const h1 = container.querySelector("h1");
  if (!h1) return false;
  h1.insertAdjacentElement("afterend", el);
  return true;
}

/**
 * Client wrapper for DocsPage that auto-detects headings from the DOM,
 * populates the Table of Contents, and renders page action buttons
 * (Copy Markdown, Open in LLM). Re-scans when the route changes.
 */
export function DocsPageClient({
  tocEnabled,
  breadcrumbEnabled = true,
  entry = "docs",
  copyMarkdown = false,
  openDocs = false,
  openDocsProviders,
  pageActionsPosition = "below-title",
  children,
}: DocsPageClientProps) {
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [actionsReady, setActionsReady] = useState(pageActionsPosition !== "below-title");
  const pathname = usePathname();
  const actionsRef = useRef<HTMLDivElement>(null);

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

  // Move page actions below the h1 when position is "below-title"
  useEffect(() => {
    if (pageActionsPosition !== "below-title") return;
    setActionsReady(false);
    const el = actionsRef.current;
    if (!el) return;

    const timer = requestAnimationFrame(() => {
      const article = el.closest("article") ?? document.getElementById("nd-page");
      if (article && insertAfterH1(article, el)) {
        setActionsReady(true);
      } else {
        setActionsReady(true);
      }
    });

    return () => cancelAnimationFrame(timer);
  }, [pageActionsPosition, pathname]);

  const showActions = copyMarkdown || openDocs;
  const isAbove = pageActionsPosition === "above-title";

  return (
    <DocsPage
      toc={toc}
      tableOfContent={{ enabled: tocEnabled }}
      tableOfContentPopover={{ enabled: tocEnabled }}
      breadcrumb={{ enabled: false }}
    >
      {breadcrumbEnabled && <PathBreadcrumb pathname={pathname} entry={entry} />}
      {showActions && (
        <div
          ref={actionsRef}
          data-actions-position={pageActionsPosition}
          style={actionsReady ? undefined : { opacity: 0, position: "absolute", pointerEvents: "none" }}
        >
          <PageActions
            copyMarkdown={copyMarkdown}
            openDocs={openDocs}
            providers={openDocsProviders}
          />
        </div>
      )}
      <DocsBody>{children}</DocsBody>
    </DocsPage>
  );
}

"use client";

import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import { useEffect, useState, type ReactNode } from "react";
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
  // Split and remove the entry segment
  const allSegments = pathname.split("/").filter(Boolean);
  const segments = allSegments.filter(
    (s) => s.toLowerCase() !== entry.toLowerCase(),
  );

  // Only show breadcrumb when there are at least 2 segments after removing entry
  if (segments.length < 2) return null;

  // Show only the immediate parent and current
  const parentSegment = segments[segments.length - 2];
  const currentSegment = segments[segments.length - 1];

  const parentLabel = parentSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const currentLabel = currentSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Build the parent URL: reconstruct path up to the parent segment
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
  children,
}: DocsPageClientProps) {
  const [toc, setToc] = useState<TOCItem[]>([]);
  const pathname = usePathname();

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

  const showActions = copyMarkdown || openDocs;

  return (
    <DocsPage
      toc={toc}
      tableOfContent={{ enabled: tocEnabled }}
      tableOfContentPopover={{ enabled: tocEnabled }}
      breadcrumb={{ enabled: false }}
    >
      {breadcrumbEnabled && <PathBreadcrumb pathname={pathname} entry={entry} />}
      {showActions && (
        <PageActions
          copyMarkdown={copyMarkdown}
          openDocs={openDocs}
          providers={openDocsProviders}
        />
      )}
      <DocsBody>{children}</DocsBody>
    </DocsPage>
  );
}

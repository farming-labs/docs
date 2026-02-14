"use client";

import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import { useEffect, useState, type ReactNode } from "react";
// @ts-ignore – resolved by Next.js at runtime
import { usePathname } from "next/navigation";

interface TOCItem {
  title: string;
  url: string;
  depth: number;
}

interface DocsPageClientProps {
  tocEnabled: boolean;
  breadcrumbEnabled?: boolean;
  children: ReactNode;
}

/**
 * Client wrapper for DocsPage that auto-detects headings from the DOM
 * and populates the Table of Contents. Re-scans when the route changes.
 */
export function DocsPageClient({ tocEnabled, breadcrumbEnabled = true, children }: DocsPageClientProps) {
  const [toc, setToc] = useState<TOCItem[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    if (!tocEnabled) return;

    // Wait a tick for the new page content to render, then scan for headings
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

  return (
    <DocsPage
      toc={toc}
      tableOfContent={{ enabled: tocEnabled }}
      tableOfContentPopover={{ enabled: tocEnabled }}
      breadcrumb={{ enabled: breadcrumbEnabled }}
    >
      <DocsBody>{children}</DocsBody>
    </DocsPage>
  );
}

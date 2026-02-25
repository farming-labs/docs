"use client";

import { useState, useCallback, useRef, useEffect } from "react";
// @ts-ignore – resolved by Next.js at runtime
import { usePathname } from "next/navigation";

/** Serializable provider — icon is an HTML string, not JSX. */
interface SerializedProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
}

interface PageActionsProps {
  copyMarkdown?: boolean;
  openDocs?: boolean;
  providers?: SerializedProvider[];
  /** GitHub file URL (edit view) for the current page. Used when urlTemplate contains {githubUrl}. */
  githubFileUrl?: string | null;
}

const CopyIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const DEFAULT_PROVIDERS: SerializedProvider[] = [
  {
    name: "ChatGPT",
    urlTemplate:
      "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it.",
  },
  {
    name: "Claude",
    urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it.",
  },
];

export function PageActions({
  copyMarkdown,
  openDocs,
  providers,
  githubFileUrl,
}: PageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const resolvedProviders = providers ?? DEFAULT_PROVIDERS;

  const handleCopyMarkdown = useCallback(async () => {
    try {
      const article = document.querySelector("article");
      if (article) {
        await navigator.clipboard.writeText(article.innerText || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // silent
    }
  }, []);

  const handleOpen = useCallback(
    (template: string) => {
      if (/\{githubUrl\}/.test(template) && !githubFileUrl) {
        setDropdownOpen(false);
        return;
      }
      const pageUrl = window.location.href;
      const mdxUrl = `${window.location.origin}${pathname}.mdx`;
      let url = template
        .replace(/\{url\}/g, encodeURIComponent(pageUrl))
        .replace(/\{mdxUrl\}/g, encodeURIComponent(mdxUrl))
        .replace(/\{githubUrl\}/g, githubFileUrl ?? "");
      window.open(url, "_blank", "noopener,noreferrer");
      setDropdownOpen(false);
    },
    [pathname, githubFileUrl],
  );

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Close on route change
  useEffect(() => {
    setDropdownOpen(false);
    setCopied(false);
  }, [pathname]);

  if (!copyMarkdown && !openDocs) return null;

  return (
    <div className="fd-page-actions" data-page-actions>
      {copyMarkdown && (
        <button
          type="button"
          onClick={handleCopyMarkdown}
          className="fd-page-action-btn"
          data-copied={copied}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? "Copied!" : "Copy page"}</span>
        </button>
      )}

      {openDocs && resolvedProviders.length > 0 && (
        <div ref={dropdownRef} className="fd-page-action-dropdown">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="fd-page-action-btn"
            aria-expanded={dropdownOpen}
          >
            <span>Open in</span>
            <ChevronDownIcon />
          </button>

          {dropdownOpen && (
            <div className="fd-page-action-menu" role="menu">
              {resolvedProviders.map((provider) => (
                <button
                  key={provider.name}
                  type="button"
                  role="menuitem"
                  className="fd-page-action-menu-item"
                  onClick={() => handleOpen(provider.urlTemplate)}
                >
                  {provider.iconHtml && (
                    <span
                      className="fd-page-action-menu-icon"
                      dangerouslySetInnerHTML={{ __html: provider.iconHtml }}
                    />
                  )}
                  <span className="fd-page-action-menu-label">Open in {provider.name}</span>
                  <ExternalLinkIcon />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

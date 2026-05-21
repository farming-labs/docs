"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "fumadocs-core/framework";
import { emitClientAnalyticsEvent } from "./client-analytics.js";
import { sanitizeIconHtml } from "./safe-icon-html.js";

/** Serializable provider — icon is an HTML string, not JSX. */
interface SerializedProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
  target?: "markdown" | "page" | "source" | "github";
  prompt?: string;
}

interface PageActionsProps {
  copyMarkdown?: boolean;
  openDocs?: boolean;
  providers?: SerializedProvider[];
  openDocsTarget?: "markdown" | "page" | "source" | "github";
  openDocsPrompt?: string;
  alignment?: "left" | "right";
  /** GitHub file URL (edit view) for the current page. Used when urlTemplate contains {githubUrl}. */
  githubFileUrl?: string | null;
  analytics?: boolean;
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
    urlTemplate: "https://chatgpt.com/?q={prompt}",
  },
  {
    name: "Claude",
    urlTemplate: "https://claude.ai/new?q={prompt}",
  },
];

const DEFAULT_OPEN_DOCS_TARGET = "markdown";
const DEFAULT_OPEN_DOCS_PROMPT = "Read this documentation: {url}";

function pageUrlToMarkdownUrl(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    const pathname = url.pathname.replace(/\/+$/, "") || url.pathname;
    url.pathname = pathname.endsWith(".md") ? pathname : `${pathname}.md`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    const clean = pageUrl.replace(/[?#].*$/, "").replace(/\/+$/, "") || pageUrl;
    return clean.endsWith(".md") ? clean : `${clean}.md`;
  }
}

function fillPromptTemplate(template: string, values: Record<string, string>): string {
  return template
    .replace(/\{pageUrl\}/g, values.pageUrl)
    .replace(/\{markdownUrl\}/g, values.markdownUrl)
    .replace(/\{sourceUrl\}/g, values.sourceUrl)
    .replace(/\{mdxUrl\}/g, values.sourceUrl)
    .replace(/\{githubUrl\}/g, values.githubUrl)
    .replace(/\{url\}/g, values.url);
}

export function PageActions({
  copyMarkdown,
  openDocs,
  providers,
  openDocsTarget = DEFAULT_OPEN_DOCS_TARGET,
  openDocsPrompt = DEFAULT_OPEN_DOCS_PROMPT,
  alignment = "left",
  githubFileUrl,
  analytics = false,
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
        const content = article.innerText || "";
        await navigator.clipboard.writeText(content);
        if (analytics) {
          emitClientAnalyticsEvent({
            type: "page_action_copy_markdown",
            properties: {
              contentLength: content.length,
              pathname,
            },
          });
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // silent
    }
  }, [analytics, pathname]);

  const handleOpen = useCallback(
    (provider: SerializedProvider) => {
      const template = provider.urlTemplate;
      if (/\{githubUrl\}/.test(template) && !githubFileUrl) {
        setDropdownOpen(false);
        return;
      }
      const pageUrl = window.location.href;
      const sourceUrl = `${window.location.origin}${pathname}.mdx`;
      const markdownUrl = pageUrlToMarkdownUrl(pageUrl);
      const target = provider.target ?? openDocsTarget;
      const targetUrl =
        target === "markdown"
          ? markdownUrl
          : target === "source"
            ? sourceUrl
            : target === "github"
              ? (githubFileUrl ?? pageUrl)
              : pageUrl;
      const prompt = fillPromptTemplate(provider.prompt ?? openDocsPrompt, {
        url: targetUrl,
        pageUrl,
        markdownUrl,
        sourceUrl,
        githubUrl: githubFileUrl ?? "",
      });
      let url = template
        .replace(/\{prompt\}/g, encodeURIComponent(prompt))
        .replace(/\{url\}/g, encodeURIComponent(targetUrl))
        .replace(/\{pageUrl\}/g, encodeURIComponent(pageUrl))
        .replace(/\{markdownUrl\}/g, encodeURIComponent(markdownUrl))
        .replace(/\{sourceUrl\}/g, encodeURIComponent(sourceUrl))
        .replace(/\{mdxUrl\}/g, encodeURIComponent(sourceUrl))
        .replace(/\{githubUrl\}/g, githubFileUrl ?? "");
      if (analytics) {
        emitClientAnalyticsEvent({
          type: "page_action_open_docs",
          properties: {
            provider: provider.name,
            pathname,
            usesGithubUrl: template.includes("{githubUrl}"),
          },
        });
      }
      window.open(url, "_blank", "noopener,noreferrer");
      setDropdownOpen(false);
    },
    [analytics, pathname, githubFileUrl, openDocsPrompt, openDocsTarget],
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
    <div className="fd-page-actions" data-page-actions data-actions-alignment={alignment}>
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
            onClick={() => {
              const next = !dropdownOpen;
              setDropdownOpen(next);
              if (analytics && next) {
                emitClientAnalyticsEvent({
                  type: "page_action_open_docs_menu",
                  properties: {
                    providerCount: resolvedProviders.length,
                    pathname,
                  },
                });
              }
            }}
            className="fd-page-action-btn"
            aria-expanded={dropdownOpen}
          >
            <span>Open in</span>
            <ChevronDownIcon />
          </button>

          {dropdownOpen && (
            <div className="fd-page-action-menu" role="menu">
              {resolvedProviders.map((provider) => {
                const iconHtml = sanitizeIconHtml(provider.iconHtml);

                return (
                  <button
                    key={provider.name}
                    type="button"
                    role="menuitem"
                    className="fd-page-action-menu-item"
                    onClick={() => handleOpen(provider)}
                  >
                    {iconHtml && (
                      <span
                        className="fd-page-action-menu-icon"
                        dangerouslySetInnerHTML={{ __html: iconHtml }}
                      />
                    )}
                    <span className="fd-page-action-menu-label">Open in {provider.name}</span>
                    <ExternalLinkIcon />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

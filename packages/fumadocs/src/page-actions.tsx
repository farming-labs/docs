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
  variant?: "default" | "rail";
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

const FileTextIcon = () => (
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
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2.02c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.71 1.25 3.37.96.1-.75.4-1.25.73-1.54-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.18 1.18a10.9 10.9 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.7.41.36.78 1.06.78 2.14v3.03c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);

const SparklesIcon = () => (
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
    <path d="M9.94 15.5 8.5 21l-1.44-5.5L1.5 14l5.56-1.5L8.5 7l1.44 5.5L15.5 14Z" />
    <path d="M17.5 3 18 5l2 .5-2 .5-.5 2-.5-2-2-.5 2-.5Z" />
    <path d="M19 11.5 20 15l3.5 1-3.5 1-1 3.5-1-3.5-3.5-1 3.5-1Z" />
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
  variant = "default",
  githubFileUrl,
  analytics = false,
}: PageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const resolvedProviders = providers ?? DEFAULT_PROVIDERS;
  const cleanedPathname = pathname.replace(/\/+$/, "") || "/";
  const markdownHref =
    cleanedPathname === "/" ? "/index.md" : `${cleanedPathname.replace(/\.md$/, "")}.md`;

  const handleCopyMarkdown = useCallback(async () => {
    try {
      let content = "";

      try {
        const response = await fetch(markdownHref, {
          headers: { Accept: "text/markdown" },
        });

        if (response.ok) {
          content = await response.text();
        }
      } catch {
        // Fall back to rendered article text below.
      }

      if (!content) {
        const article = document.querySelector("article");
        content = article?.innerText || "";
      }

      if (!content) return;

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
    } catch {
      // silent
    }
  }, [analytics, markdownHref, pathname]);

  const handleOpen = useCallback(
    (provider: SerializedProvider) => {
      const template = provider.urlTemplate;
      const githubUrl = githubFileUrl ?? "";
      if (/\{githubUrl\}/.test(template) && !githubUrl) {
        setDropdownOpen(false);
        return;
      }
      const pageUrl = window.location.href;
      const sourceUrl = `${window.location.origin}${pathname}.mdx`;
      const markdownUrl = pageUrlToMarkdownUrl(pageUrl);
      const target = provider.target ?? openDocsTarget;
      if (target === "github" && !githubUrl) {
        setDropdownOpen(false);
        return;
      }
      const targetUrl =
        target === "markdown"
          ? markdownUrl
          : target === "source"
            ? sourceUrl
            : target === "github"
              ? githubUrl
              : pageUrl;
      const prompt = fillPromptTemplate(provider.prompt ?? openDocsPrompt, {
        url: targetUrl,
        pageUrl,
        markdownUrl,
        sourceUrl,
        githubUrl,
      });
      let url = template
        .replace(/\{prompt\}/g, encodeURIComponent(prompt))
        .replace(/\{url\}/g, encodeURIComponent(targetUrl))
        .replace(/\{pageUrl\}/g, encodeURIComponent(pageUrl))
        .replace(/\{markdownUrl\}/g, encodeURIComponent(markdownUrl))
        .replace(/\{sourceUrl\}/g, encodeURIComponent(sourceUrl))
        .replace(/\{mdxUrl\}/g, encodeURIComponent(sourceUrl))
        .replace(/\{githubUrl\}/g, githubUrl);
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

  const handleAskAI = useCallback(() => {
    const trigger = document.querySelector<HTMLButtonElement>(
      ".fd-ai-fm-trigger-btn, [data-ai-trigger], button[aria-label='Ask AI']",
    );
    if (!trigger) return;

    trigger.click();
    if (analytics) {
      emitClientAnalyticsEvent({
        type: "page_action_ask_ai",
        properties: { pathname },
      });
    }
  }, [analytics, pathname]);

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

  if (variant !== "rail" && !copyMarkdown && !openDocs) return null;

  if (variant === "rail") {
    return (
      <div
        className="fd-page-actions fd-page-actions-rail"
        data-page-actions
        data-page-actions-variant="rail"
      >
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

        {openDocs && (
          <a className="fd-page-action-btn" href={markdownHref} target="_blank" rel="noreferrer">
            <FileTextIcon />
            <span>View as Markdown</span>
          </a>
        )}

        {githubFileUrl && (
          <a className="fd-page-action-btn" href={githubFileUrl} target="_blank" rel="noreferrer">
            <GitHubIcon />
            <span>Edit on GitHub</span>
          </a>
        )}

        <button type="button" onClick={handleAskAI} className="fd-page-action-btn">
          <SparklesIcon />
          <span>Ask AI</span>
        </button>
      </div>
    );
  }

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

"use client";

import type { CSSProperties } from "react";
import Link from "fumadocs-core/link";
import { usePathname } from "fumadocs-core/framework";
import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import type { DocsNavLink } from "@farming-labs/docs";
import type { DocsNavTitle } from "./layout-chrome.js";

export interface DocsTopHeaderProps {
  title: DocsNavTitle;
  titleUrl: string;
  links: DocsNavLink[];
  /** Show the search trigger. */
  search: boolean;
  /** Show the Ask AI trigger of the `sidebar-icon` AI mode. */
  askAI: boolean;
  themeToggle: false | { mode?: "light-dark" | "light-dark-system" };
  themeName?: string;
  height?: number;
}

function isLinkActive(href: string, pathname: string): "page" | "section" | undefined {
  if (/^\w+:|^\/\//.test(href)) return undefined;
  const target = href.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  const current = pathname.replace(/\/+$/, "") || "/";
  if (current === target) return "page";
  if (target !== "/" && current.startsWith(`${target}/`)) return "section";
  return undefined;
}

/** Site header spanning the page, rendered when the theme sets `ui.layout.header.placement: "top"`. */
export function DocsTopHeader({
  title,
  titleUrl,
  links,
  search,
  askAI,
  themeToggle,
  themeName,
  height,
}: DocsTopHeaderProps) {
  const pathname = usePathname();
  const style = height ? ({ "--fd-top-header-height": `${height}px` } as CSSProperties) : undefined;

  return (
    <header className="fd-top-header" data-fd-theme={themeName} style={style}>
      {typeof title === "function" ? (
        title({ className: "fd-top-header-title" })
      ) : (
        <Link href={titleUrl} className="fd-top-header-title">
          {title}
        </Link>
      )}
      <div className="fd-top-header-controls">
        {search && (
          <button
            type="button"
            className="fd-top-header-search"
            aria-label="Search documentation"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={() => window.dispatchEvent(new CustomEvent("fd-open-search"))}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span>Search</span>
            <kbd aria-hidden="true">⌘K</kbd>
          </button>
        )}
        {askAI && (
          <button
            type="button"
            className="fd-top-header-ask-ai"
            aria-label="Ask AI"
            onClick={() => window.dispatchEvent(new CustomEvent("fd-open-ai"))}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4" />
              <path d="M22 5h-4" />
            </svg>
          </button>
        )}
        {links.length > 0 && (
          <nav className="fd-top-header-links" aria-label="Site">
            {links.map((link) => {
              const active = isLinkActive(link.href, pathname);
              return (
                <Link
                  key={`${link.href}:${link.label}`}
                  href={link.href}
                  external={link.external === true}
                  data-active={active ? "true" : undefined}
                  aria-current={active === "page" ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
        {themeToggle && (
          <ThemeSwitch mode={themeToggle.mode} className="fd-top-header-theme-toggle" />
        )}
      </div>
    </header>
  );
}

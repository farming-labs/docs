"use client";

import { useEffect, useState } from "react";

/**
 * Custom search toggle for sidebar that includes an AI sparkle button.
 * Rendered via fumadocs-ui's `searchToggle.components.lg` prop.
 * Communicates with DocsAIFeatures via custom DOM events.
 */
export function SidebarSearchWithAI() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function openSearch() {
    // Dispatch custom event — intercepted by DocsAIFeatures
    window.dispatchEvent(new CustomEvent("fd-open-search"));
  }

  function openAI() {
    window.dispatchEvent(new CustomEvent("fd-open-ai"));
  }

  if (!mounted) {
    // SSR placeholder to avoid hydration mismatch
    return (
      <div className="fd-sidebar-search-ai-row">
        <button type="button" data-search-full="" className="fd-sidebar-search-btn">
          <svg
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
          <span className="fd-sidebar-search-kbd">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </button>
        <button type="button" className="fd-sidebar-ai-btn" aria-label="Ask AI" title="Ask AI">
          <svg
            xmlns="http://www.w3.org/2000/svg"
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
      </div>
    );
  }

  return (
    <div className="fd-sidebar-search-ai-row">
      <button
        type="button"
        onClick={openSearch}
        data-search-full=""
        className="fd-sidebar-search-btn"
      >
        <svg
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
        <span className="fd-sidebar-search-kbd">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </button>
      <button
        type="button"
        onClick={openAI}
        className="fd-sidebar-ai-btn"
        aria-label="Ask AI"
        title="Ask AI"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
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
    </div>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from "react";
import { useWindowSearchParams } from "./client-location.js";
import { resolveClientLocale, withLangInUrl } from "./i18n.js";
import { emitClientAnalyticsEvent } from "./client-analytics.js";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
  description?: string;
  section?: string;
}

type RecentEntry = { id: string; label: string; url: string };
type SearchFilter = "all" | "pages" | "inside";
const BREADCRUMB_SEPARATOR = "\u00a0\u00a0>\u00a0\u00a0";

const FILTER_LABELS: Record<SearchFilter, string> = {
  all: "All",
  pages: "Pages",
  inside: "Inside pages",
};

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent || el.innerText || "";
  }
  return html.replace(/<[^>]+>/g, "");
}

function stripSearchPreview(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/`+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function breadcrumbForUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://docs.local");
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((part) =>
        decodeURIComponent(part)
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase()),
      );
    return parts.length > 0 ? parts.join(BREADCRUMB_SEPARATOR) : "Docs";
  } catch {
    return "Docs";
  }
}

function normalizeSearchPhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[?!.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function literalMatchPriority(query: string, value?: string): number {
  const q = normalizeSearchPhrase(query);
  const text = normalizeSearchPhrase(value ?? "");
  if (!q || !text) return 0;
  if (text === q) return 2;

  const boundary = "[^\\p{L}\\p{N}]";
  return new RegExp(`(^|${boundary})${escapeRegExp(q)}(?=$|${boundary})`, "u").test(text) ? 1 : 0;
}

function tokenizeLiteralQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}@/_:.-]+/gu, " ")
        .split(/\s+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{N}]+$/gu, ""))
        .filter((word) => word.length > 1),
    ),
  );
}

function isLiteralLookupQuery(query: string): boolean {
  const q = normalizeSearchPhrase(query);
  const words = tokenizeLiteralQuery(q);
  return words.length > 0 && words.length <= 3 && words.join(" ") === q;
}

function hasDistinctSearchSection(result: SearchResult, label: string): boolean {
  if (result.type === "page") return false;
  if (!result.section) return true;
  const title = label.split(/\s+[—–]\s+/)[0] ?? "";
  return normalizeSearchPhrase(result.section) !== normalizeSearchPhrase(title);
}

function getUrlSearchSegments(url: string): string[] {
  try {
    const parsed = new URL(url, "https://docs.local");
    return Array.from(
      new Set(
        parsed.pathname
          .split("/")
          .flatMap((segment) => {
            const decoded = decodeURIComponent(segment);
            return [decoded, decoded.replace(/[-_]+/g, " ")];
          })
          .map(normalizeSearchPhrase)
          .filter(Boolean),
      ),
    );
  } catch {
    return [];
  }
}

function exactMatchPriority(query: string, label: string, url: string): number {
  const q = normalizeSearchPhrase(query);
  if (!q) return 0;

  const normalizedLabel = normalizeSearchPhrase(label);
  const joinedLabel = normalizeSearchPhrase(label.replace(/\s+[—–-]\s+/g, " "));
  const labelParts = normalizedLabel
    .split(/\s+[—–-]\s+/)
    .map(normalizeSearchPhrase)
    .filter(Boolean);

  if (normalizedLabel === q || joinedLabel === q) return 4;
  if (labelParts.includes(q)) return 3;
  if (getUrlSearchSegments(url).includes(q)) return 2;
  if (normalizedLabel.startsWith(q) || joinedLabel.startsWith(q)) return 1;
  return 0;
}

function resultDisplayLabel(result: SearchResult): string {
  const section = result.section ? stripSearchPreview(stripHtml(result.section)) : "";
  if (section) return section;

  const label = stripSearchPreview(stripHtml(result.content));
  const parts = label
    .split(/\s+[—–]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (result.type === "heading" && parts.length > 1) return parts[parts.length - 1] ?? label;
  return label;
}

function fuzzyScore(query: string, text: string) {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return { score: 0, indices: [] as number[] };

  let score = 0;
  const indices: number[] = [];

  const idx = t.indexOf(q);
  if (idx >= 0) {
    score += 100 + Math.max(0, 20 - idx);
    for (let i = 0; i < q.length; i++) indices.push(idx + i);
  } else {
    let tPos = 0;
    let chain = 0;
    for (let i = 0; i < q.length; i++) {
      const found = t.indexOf(q[i], tPos);
      if (found === -1) {
        score -= 5;
      } else {
        indices.push(found);
        if (found === tPos) chain += 2;
        else chain = 0;
        score += 2 + chain;
        tPos = found + 1;
        if (found === 0 || /\s|-|_|\/|\./.test(text[found - 1])) score += 3;
      }
    }
  }
  return { score, indices: Array.from(new Set(indices)).sort((a, b) => a - b) };
}

function HighlightedLabel({ label, indices = [] }: { label: string; indices?: number[] }) {
  if (!indices.length) return <>{label}</>;
  const out: ReactNode[] = [];
  const highlighted = new Set(indices);
  let pos = 0;
  while (pos < label.length) {
    const marked = highlighted.has(pos);
    let end = pos + 1;
    while (end < label.length && highlighted.has(end) === marked) end++;
    const run = label.slice(pos, end);

    if (marked) {
      out.push(
        <mark key={`m-${pos}`} className="omni-highlight">
          {run}
        </mark>,
      );
    } else {
      out.push(<span key={`t-${pos}`}>{run}</span>);
    }
    pos = end;
  }
  return <>{out}</>;
}

function SearchIcon() {
  return (
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
  );
}

function ArrowDownIcon() {
  return (
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
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
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function CornerDownLeftIcon() {
  return (
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
      <path d="m9 10-5 5 5 5" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="omni-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function HistoryIcon() {
  return (
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

interface ResultItem {
  id: string;
  label: string;
  subtitle: string;
  description?: string;
  url: string;
  type: SearchResult["type"];
  score: number;
  exactPriority: number;
  insideLiteralPriority: number;
  sourceIndex: number;
  indices: number[];
  descriptionIndices: number[];
}

/**
 * Built-in docs search command palette.
 * Intercepts Cmd+K and sidebar search button to provide an advanced
 * fuzzy-search experience. Styled entirely via omni-* CSS classes
 * so each theme provides its own visual variant.
 */
export function DocsCommandSearch({
  api = "/api/docs",
  locale,
  analytics = false,
}: {
  api?: string;
  locale?: string;
  analytics?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchParams = useWindowSearchParams();
  const activeLocale = resolveClientLocale(searchParams, locale);
  const searchApi = useMemo(() => withLangInUrl(api, activeLocale), [activeLocale, api]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchCacheRef = useRef(new Map<string, ResultItem[]>());

  const setOpenWithAnalytics = useCallback(
    (nextOpen: boolean, trigger: string) => {
      setOpen(nextOpen);
      if (!analytics) return;
      emitClientAnalyticsEvent({
        type: nextOpen ? "search_open" : "search_close",
        locale: activeLocale,
        properties: {
          trigger,
          mode: "command",
        },
      });
    },
    [activeLocale, analytics],
  );

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("fd:omni:recents");
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpenWithAnalytics(true, "keyboard");
      }
    }
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [setOpenWithAnalytics]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;
      const text = button.textContent || "";
      const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();
      const isSearchButton =
        (text.includes("Search") && (text.includes("⌘") || text.includes("K"))) ||
        ariaLabel.includes("search") ||
        text === "Open Search";
      if (isSearchButton) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpenWithAnalytics(true, "button");
      }
    }
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [setOpenWithAnalytics]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = `${activeLocale ?? ""}:${searchApi}:${debouncedQuery}`;
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setActiveIndex(0);
      setLoading(false);
      return;
    }
    setLoading(true);

    (async () => {
      const startedAt = Date.now();
      try {
        const requestUrl = new URL(searchApi, window.location.origin);
        requestUrl.searchParams.set("query", debouncedQuery);
        const res = await fetch(requestUrl.toString(), { signal: controller.signal });
        if (!res.ok || cancelled) return;
        const data: SearchResult[] = await res.json();
        const items: ResultItem[] = data.map((r, sourceIndex) => {
          const sourceLabel = stripSearchPreview(stripHtml(r.content));
          const label = resultDisplayLabel(r);
          const description = r.description
            ? stripSearchPreview(stripHtml(r.description)).slice(0, 220)
            : undefined;
          const { score, indices } = fuzzyScore(debouncedQuery, label);
          const descriptionMatch = description
            ? fuzzyScore(debouncedQuery, description)
            : { indices: [] };
          const url = withLangInUrl(r.url, activeLocale);
          return {
            id: r.id,
            label,
            subtitle: breadcrumbForUrl(r.url),
            description,
            url,
            type: r.type,
            score,
            exactPriority: exactMatchPriority(debouncedQuery, sourceLabel, r.url),
            insideLiteralPriority:
              hasDistinctSearchSection(r, sourceLabel) && isLiteralLookupQuery(debouncedQuery)
                ? Math.max(
                    literalMatchPriority(debouncedQuery, r.section),
                    literalMatchPriority(debouncedQuery, description),
                  )
                : 0,
            sourceIndex,
            indices,
            descriptionIndices: descriptionMatch.indices,
          };
        });
        items.sort((a, b) => {
          const literalDelta = b.insideLiteralPriority - a.insideLiteralPriority;
          if (literalDelta) return literalDelta;
          if (a.insideLiteralPriority > 0 && b.insideLiteralPriority > 0) {
            return a.sourceIndex - b.sourceIndex;
          }

          return (
            b.exactPriority - a.exactPriority ||
            b.score - a.score ||
            a.sourceIndex - b.sourceIndex ||
            a.label.localeCompare(b.label)
          );
        });
        if (!cancelled) {
          if (searchCacheRef.current.size >= 20) {
            const firstKey = searchCacheRef.current.keys().next().value;
            if (firstKey) searchCacheRef.current.delete(firstKey);
          }
          searchCacheRef.current.set(cacheKey, items);
          setResults(items);
          setActiveIndex(0);
          if (analytics) {
            emitClientAnalyticsEvent({
              type: "search_query",
              locale: activeLocale,
              properties: {
                mode: "command",
                queryLength: debouncedQuery.length,
                resultCount: items.length,
                durationMs: Math.max(0, Date.now() - startedAt),
              },
            });
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        if (!cancelled && analytics) {
          emitClientAnalyticsEvent({
            type: "search_error",
            locale: activeLocale,
            properties: {
              mode: "command",
              queryLength: debouncedQuery.length,
              durationMs: Math.max(0, Date.now() - startedAt),
            },
          });
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeLocale, analytics, debouncedQuery, searchApi]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
      setResults([]);
      setFilter("all");
      setFilterOpen(false);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const previousHtmlOverflow = documentElement.style.overflow;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenWithAnalytics(false, "escape");
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpenWithAnalytics]);

  const saveRecent = useCallback(
    (item: ResultItem) => {
      try {
        const entry: RecentEntry = { id: item.id, label: item.label, url: item.url };
        const next = [entry, ...recents.filter((r) => r.id !== entry.id)].slice(0, 8);
        setRecents(next);
        localStorage.setItem("fd:omni:recents", JSON.stringify(next));
      } catch {}
    },
    [recents],
  );

  const execute = useCallback(
    (item: ResultItem) => {
      if (analytics) {
        emitClientAnalyticsEvent({
          type: "search_result_click",
          locale: activeLocale,
          path: item.url,
          properties: {
            mode: "command",
            resultId: item.id,
            resultUrl: item.url,
            labelLength: item.label.length,
            queryLength: query.length,
          },
        });
      }
      saveRecent(item);
      setOpen(false);
      if (item.url.startsWith("http")) window.open(item.url, "_blank", "noopener");
      else window.location.href = item.url;
    },
    [activeLocale, analytics, query.length, saveRecent],
  );

  const displayItems = useMemo(() => {
    if (results.length === 0) return [];
    if (filter === "pages") return results.filter((item) => item.type === "page");
    if (filter === "inside") return results.filter((item) => item.type !== "page");
    return results;
  }, [filter, results]);

  const recentItems = useMemo((): ResultItem[] => {
    if (query.trim() || results.length > 0) return [];
    return recents.map((r) => ({
      id: r.id,
      label: r.label,
      subtitle: "Recently viewed",
      url: r.url,
      type: "page",
      score: 0,
      exactPriority: 0,
      insideLiteralPriority: 0,
      sourceIndex: 0,
      indices: [],
      descriptionIndices: [],
    }));
  }, [query, results, recents]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filter, debouncedQuery]);

  function updateFilter(nextFilter: SearchFilter) {
    setFilter(nextFilter);
    setFilterOpen(false);
    setActiveIndex(0);
  }

  function moveActive(delta: number) {
    const total = displayItems.length + recentItems.length;
    if (!total) return;
    let next = activeIndex + delta;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    setActiveIndex(next);
    const allItems = [...recentItems, ...displayItems];
    const node = listRef.current?.querySelector<HTMLElement>(`[data-id="${allItems[next]?.id}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const allItems = [...recentItems, ...displayItems];
      if (allItems[activeIndex]) execute(allItems[activeIndex]);
    }
  }

  if (!mounted || !open) return null;

  const allItems = [...recentItems, ...displayItems];

  return createPortal(
    <>
      <div className="omni-overlay" onClick={() => setOpenWithAnalytics(false, "overlay")} />
      <div
        className="omni-content"
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
      >
        <div className="omni-header">
          <div className="omni-search-row">
            <span className="omni-search-icon">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="omni-search-input"
            />
            <button
              aria-label="Close"
              className="omni-close-btn"
              onClick={() => setOpenWithAnalytics(false, "button")}
            >
              ESC
            </button>
          </div>
        </div>

        <div className="omni-body" ref={listRef} role="listbox" aria-label="Search results">
          {loading && (
            <div className="omni-loading">
              <LoaderIcon /> Searching…
            </div>
          )}

          {recentItems.length > 0 && (
            <div className="omni-group">
              <div className="omni-group-label">Recent</div>
              <div className="omni-group-items">
                {recentItems.map((item, i) => (
                  <button
                    key={item.id}
                    data-id={item.id}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => execute(item)}
                    className={cn("omni-item", i === activeIndex && "omni-item-active")}
                  >
                    <div className="omni-item-text">
                      <div className="omni-item-subtitle">{item.subtitle}</div>
                      <div className="omni-item-label">{item.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayItems.length > 0 && (
            <div className="omni-group">
              <div className="omni-group-label">Documentation</div>
              <div className="omni-group-items">
                {displayItems.map((item, i) => {
                  const idx = recentItems.length + i;
                  return (
                    <button
                      key={item.id}
                      data-id={item.id}
                      role="option"
                      aria-selected={idx === activeIndex}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => execute(item)}
                      className={cn("omni-item", idx === activeIndex && "omni-item-active")}
                    >
                      <div className="omni-item-text">
                        <div className="omni-item-subtitle">{item.subtitle}</div>
                        <div className="omni-item-label">
                          <HighlightedLabel label={item.label} indices={item.indices} />
                        </div>
                        {item.description && (
                          <div className="omni-item-description">
                            <HighlightedLabel
                              label={item.description}
                              indices={item.descriptionIndices}
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {allItems.length === 0 && !loading && (
            <div className="omni-empty">
              <div className="omni-empty-icon">
                <HistoryIcon />
              </div>
              {debouncedQuery && results.length > 0
                ? `No ${FILTER_LABELS[filter].toLowerCase()} results found.`
                : debouncedQuery
                  ? "No results found. Try a different query."
                  : "Type to search the docs, or browse recent items."}
            </div>
          )}
        </div>

        <div className="omni-footer">
          <div className="omni-footer-inner">
            <div className="omni-footer-hints">
              <span className="omni-footer-hint">
                <CornerDownLeftIcon /> to select
              </span>
              <span className="omni-footer-hint">
                <ArrowUpIcon />
                <ArrowDownIcon /> to navigate
              </span>
              <span className="omni-footer-hint omni-footer-hint-desktop">
                <span className="omni-kbd-sm">ESC</span> to close
              </span>
            </div>
            <div className="omni-footer-filter">
              <span className="omni-filter-label">Filter</span>
              <button
                type="button"
                className="omni-filter-button"
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((value) => !value)}
              >
                {FILTER_LABELS[filter]}
                <ArrowDownIcon />
              </button>
              {filterOpen && (
                <div className="omni-filter-menu" role="menu" aria-label="Search filter">
                  {(["all", "pages", "inside"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={filter === mode}
                      className={cn(
                        "omni-filter-option",
                        filter === mode && "omni-filter-option-active",
                      )}
                      onClick={() => updateFilter(mode)}
                    >
                      {FILTER_LABELS[mode]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

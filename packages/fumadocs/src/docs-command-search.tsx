"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
}

type RecentEntry = { id: string; label: string; url: string };

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent || el.innerText || "";
  }
  return html.replace(/<[^>]+>/g, "");
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

function HighlightedLabel({ label, indices }: { label: string; indices: number[] }) {
  if (!indices.length) return <>{label}</>;
  const out: ReactNode[] = [];
  for (let pos = 0; pos < label.length; pos++) {
    if (indices.includes(pos)) {
      let run = label[pos];
      let p = pos + 1;
      while (indices.includes(p) && p < label.length) {
        run += label[p];
        p++;
      }
      out.push(<mark key={`m-${pos}`} className="omni-highlight">{run}</mark>);
      pos = p - 1;
    } else {
      out.push(<span key={`t-${pos}`}>{label[pos]}</span>);
    }
  }
  return <>{out}</>;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  );
}

function TypeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" x2="15" y1="20" y2="20" /><line x1="12" x2="12" y1="4" y2="20" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function EnterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" /><path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="omni-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
    </svg>
  );
}

function iconForType(type: string) {
  switch (type) {
    case "heading": return <HashIcon />;
    case "text": return <TypeIcon />;
    default: return <FileIcon />;
  }
}

function labelForType(type: string) {
  switch (type) {
    case "page": return "Page";
    case "heading": return "Section";
    case "text": return "Content";
    default: return "Result";
  }
}

interface ResultItem {
  id: string;
  label: string;
  subtitle: string;
  url: string;
  icon: ReactNode;
  score: number;
  indices: number[];
}

/**
 * Built-in docs search command palette.
 * Intercepts Cmd+K and sidebar search button to provide an advanced
 * fuzzy-search experience. Styled entirely via omni-* CSS classes
 * so each theme provides its own visual variant.
 */
export function DocsCommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("fd:omni:recents");
      if (raw) setRecents(JSON.parse(raw));
    } catch { }
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
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

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
        setOpen(true);
      }
    }
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/docs?query=${encodeURIComponent(debouncedQuery)}`);
        if (!res.ok || cancelled) return;
        const data: SearchResult[] = await res.json();
        const items: ResultItem[] = data.map((r) => {
          const label = stripHtml(r.content);
          const { score, indices } = fuzzyScore(debouncedQuery, label);
          return {
            id: r.id,
            label,
            subtitle: labelForType(r.type),
            url: r.url,
            icon: iconForType(r.type),
            score,
            indices,
          };
        });
        items.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
        if (!cancelled) {
          setResults(items);
          setActiveIndex(0);
        }
      } catch { }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const saveRecent = useCallback((item: ResultItem) => {
    try {
      const entry: RecentEntry = { id: item.id, label: item.label, url: item.url };
      const next = [entry, ...recents.filter(r => r.id !== entry.id)].slice(0, 8);
      setRecents(next);
      localStorage.setItem("fd:omni:recents", JSON.stringify(next));
    } catch { }
  }, [recents]);

  const execute = useCallback((item: ResultItem) => {
    saveRecent(item);
    setOpen(false);
    if (item.url.startsWith("http")) window.open(item.url, "_blank", "noopener");
    else window.location.href = item.url;
  }, [saveRecent]);

  const displayItems = useMemo(() => {
    if (results.length > 0) return results;
    return [];
  }, [results]);

  const recentItems = useMemo((): ResultItem[] => {
    if (query.trim() || results.length > 0) return [];
    return recents.map(r => ({
      id: r.id, label: r.label, subtitle: "Recently viewed",
      url: r.url, icon: <FileIcon />, score: 0, indices: [],
    }));
  }, [query, results, recents]);

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
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const allItems = [...recentItems, ...displayItems];
      if (allItems[activeIndex]) execute(allItems[activeIndex]);
    }
  }

  if (!mounted || !open) return null;

  const allItems = [...recentItems, ...displayItems];

  return createPortal(
    <>
      <div className="omni-overlay" onClick={() => setOpen(false)} />
      <div className="omni-content" role="dialog" aria-label="Search documentation">
        <div className="omni-header">
          <div className="omni-search-row">
            <span className="omni-search-icon"><SearchIcon /></span>
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              placeholder="Search documentation…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="omni-search-input"
            />
            <kbd className="omni-kbd">⌘K</kbd>
            <button aria-label="Close" className="omni-close-btn" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="omni-body" ref={listRef} role="listbox" aria-label="Search results">
          {loading && (
            <div className="omni-loading"><LoaderIcon /> Searching…</div>
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
                    <div className="omni-item-icon">{item.icon}</div>
                    <div className="omni-item-text">
                      <div className="omni-item-label">{item.label}</div>
                      <div className="omni-item-subtitle">{item.subtitle}</div>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="omni-item-ext"
                      title="Open in new tab"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <ExternalLinkIcon />
                    </a>
                    <ChevronRightIcon />
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
                      <div className="omni-item-icon">{item.icon}</div>
                      <div className="omni-item-text">
                        <div className="omni-item-label">
                          <HighlightedLabel label={item.label} indices={item.indices} />
                        </div>
                        <div className="omni-item-subtitle">{item.subtitle}</div>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="omni-item-ext"
                        title="Open in new tab"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        <ExternalLinkIcon />
                      </a>
                      <ChevronRightIcon />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {allItems.length === 0 && !loading && (
            <div className="omni-empty">
              <div className="omni-empty-icon"><HistoryIcon /></div>
              {debouncedQuery
                ? "No results found. Try a different query."
                : "Type to search the docs, or browse recent items."}
            </div>
          )}
        </div>

        <div className="omni-footer">
          <div className="omni-footer-inner">
            <div className="omni-footer-hints">
              <span className="omni-footer-hint"><EnterIcon /> to select</span>
              <span className="omni-footer-hint"><ArrowUpIcon /><ArrowDownIcon /> to navigate</span>
              <span className="omni-footer-hint omni-footer-hint-desktop"><CloseIcon /> to close</span>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

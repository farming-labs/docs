"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Command,
  Search,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  X,
  Pin,
  History,
  ExternalLink,
  ChevronRight,
  Loader2,
} from "lucide-react";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

export type OmniItem = {
  id: string;
  label: string;
  groupId: string;
  subtitle?: string;
  href?: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  pinned?: boolean;
  disabled?: boolean;
  keywords?: string[];
  onAction?: () => void;
};

export type OmniSource = {
  id: string;
  label: string;
  fetch: (query: string) => Promise<OmniItem[]> | OmniItem[];
  emptyHint?: React.ReactNode;
  minQuery?: number;
};

type RecentEntry = Pick<OmniItem, "id" | "label" | "groupId" | "href" | "shortcut">;

export type OmniCommandPaletteProps = {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  sources: OmniSource[];
  placeholder?: string;
  storageKey?: string;
  showRecents?: boolean;
  maxRecents?: number;
  showPinnedFirst?: boolean;
  className?: string;
  contentClassName?: string;
  debounceMs?: number;
  onItemExecuted?: (item: OmniItem) => void;
  renderItem?: (item: OmniItem, active: boolean) => React.ReactNode;
  renderHeader?: (query: string) => React.ReactNode;
  renderFooter?: (activeItem: OmniItem | null) => React.ReactNode;
  openKeys?: Array<{ key: string; meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean }>;
  portalContainer?: HTMLElement | null;
};

const DEFAULT_OPEN_KEYS = [{ key: "k", meta: true }, { key: "k", ctrl: true }];
const DEFAULT_PLACEHOLDER = "Search documentation…";
const DEFAULT_STORAGE_KEY = "omni:recents";
const DEFAULT_DEBOUNCE = 120;
const DEFAULT_MAX_RECENTS = 8;

function fuzzyScore(query: string, text: string, keywords: string[] = []) {
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
      const c = q[i];
      const found = t.indexOf(c, tPos);
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

  for (const k of keywords) {
    const kk = k.toLowerCase();
    if (kk.includes(q) || q.includes(kk)) score += 8;
  }

  return { score, indices: Array.from(new Set(indices)).sort((a, b) => a - b) };
}

function useDebouncedValue<T>(value: T, delay = DEFAULT_DEBOUNCE) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function useHotkeys(
  handlers: Array<{
    key: string;
    handler: (e: KeyboardEvent) => void;
    meta?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
  }>
) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      for (const h of handlers) {
        const match =
          e.key.toLowerCase() === h.key.toLowerCase() &&
          (!!h.meta === e.metaKey) &&
          (!!h.ctrl === e.ctrlKey) &&
          (!!h.alt === e.altKey) &&
          (!!h.shift === e.shiftKey);
        if (match) {
          e.preventDefault();
          h.handler(e);
          break;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}

export function OmniCommandPalette({
  open: controlledOpen,
  onOpenChange,
  sources,
  placeholder = DEFAULT_PLACEHOLDER,
  storageKey = DEFAULT_STORAGE_KEY,
  showRecents = true,
  maxRecents = DEFAULT_MAX_RECENTS,
  showPinnedFirst = true,
  className,
  contentClassName,
  debounceMs = DEFAULT_DEBOUNCE,
  onItemExecuted,
  renderItem,
  renderHeader,
  renderFooter,
  openKeys = DEFAULT_OPEN_KEYS,
  portalContainer,
}: OmniCommandPaletteProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<Record<string, OmniItem[]>>({});
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [recents, setRecents] = React.useState<RecentEntry[]>([]);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  function setOpen(v: boolean) {
    if (controlledOpen === undefined) setUncontrolledOpen(v);
    onOpenChange?.(v);
  }

  useHotkeys(
    openKeys.map(kb => ({
      ...kb,
      handler: () => setOpen(!open),
    }))
  );

  React.useEffect(() => {
    let cancelled = false;

    async function go() {
      const q = debouncedQuery;
      const nextResults: Record<string, OmniItem[]> = {};
      for (const src of sources) {
        if (q.length < (src.minQuery ?? 0)) {
          nextResults[src.id] = [];
          continue;
        }
        const markLoading = (on: boolean) =>
          setLoadingIds(prev => {
            const copy = new Set(prev);
            if (on) copy.add(src.id);
            else copy.delete(src.id);
            return copy;
          });

        try {
          markLoading(true);
          const raw = await src.fetch(q);
          nextResults[src.id] = Array.isArray(raw) ? raw : [];
        } catch {
          nextResults[src.id] = [];
        } finally {
          markLoading(false);
        }
      }

      if (!cancelled) {
        setResults(nextResults);
        setActiveId(null);
      }
    }

    go();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, sources]);

  const groups = React.useMemo(() => {
    const q = debouncedQuery.trim();
    const out: Array<{
      id: string;
      label: string;
      items: Array<OmniItem & { _score: number; _indices: number[] }>;
    }> = [];

    const sourceById = new Map(sources.map(s => [s.id, s]));
    const pinned: OmniItem[] = [];

    for (const [sid, items] of Object.entries(results)) {
      const srcMeta = sourceById.get(sid);
      if (!srcMeta) continue;
      let arr = (items ?? []).map(item => {
        const { score, indices } = fuzzyScore(q, item.label, item.keywords ?? []);
        return { ...item, _score: q ? score : 0, _indices: q ? indices : [] };
      });

      if (!q && showPinnedFirst) {
        for (const it of arr) if (it.pinned && !it.disabled) pinned.push(it);
        arr = arr.filter(i => !i.pinned);
      }

      if (q) arr.sort((a, b) => b._score - a._score || a.label.localeCompare(b.label));
      else arr.sort((a, b) => a.label.localeCompare(b.label));

      out.push({
        id: sid,
        label: sourceById.get(sid)?.label ?? sid,
        items: arr,
      });
    }

    const finalGroups: typeof out = [];
    if (!debouncedQuery && showPinnedFirst && pinned.length) {
      finalGroups.push({
        id: "__pinned",
        label: "Pinned",
        items: pinned.map(p => ({ ...p, _score: 0, _indices: [] })),
      });
    }

    if (!debouncedQuery && showRecents && recents.length) {
      finalGroups.push({
        id: "__recents",
        label: "Recent",
        items: recents.map(r => ({
          id: r.id,
          label: r.label,
          subtitle: "Recently used",
          groupId: r.groupId,
          href: r.href,
          shortcut: r.shortcut,
          _score: 0,
          _indices: [],
        })),
      });
    }

    finalGroups.push(...out);
    return finalGroups;
  }, [results, sources, debouncedQuery, showPinnedFirst, showRecents, recents]);

  const flatItems = React.useMemo(
    () => groups.flatMap(g => g.items),
    [groups]
  );

  const activeIndex = React.useMemo(() => {
    if (!activeId) return -1;
    return flatItems.findIndex(i => i.id === activeId);
  }, [activeId, flatItems]);

  function moveActive(delta: number) {
    if (!flatItems.length) return;
    let next = activeIndex + delta;
    if (next < 0) next = flatItems.length - 1;
    if (next >= flatItems.length) next = 0;
    setActiveId(flatItems[next].id);
    const node = listRef.current?.querySelector<HTMLElement>(`[data-id="${flatItems[next].id}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }

  function execute(item: OmniItem) {
    try {
      const entry: RecentEntry = {
        id: item.id,
        label: item.label,
        groupId: item.groupId,
        href: item.href,
        shortcut: item.shortcut,
      };
      const next = [entry, ...recents.filter(r => r.id !== entry.id)].slice(0, maxRecents);
      setRecents(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}

    item.onAction?.();
    if (item.href) {
      if (item.href.startsWith("http")) window.open(item.href, "_blank", "noopener");
      else window.location.href = item.href;
    }
    onItemExecuted?.(item);
    setOpen(false);
  }

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
      setActiveId(null);
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal container={portalContainer ?? undefined}>
        <Dialog.Overlay className="omni-overlay" />
        <Dialog.Content
          aria-label="Command palette"
          className={cn("omni-content", contentClassName)}
        >
          {/* Header */}
          <div className="omni-header">
            {renderHeader ? (
              renderHeader(query)
            ) : (
              <div className="omni-search-row">
                <span className="omni-search-icon">
                  <Search className="size-4" aria-hidden />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="omni-listbox"
                  aria-activedescendant={activeId ? `omni-item-${activeId}` : undefined}
                  placeholder={placeholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      moveActive(1);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      moveActive(-1);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (activeIndex >= 0) execute(flatItems[activeIndex]);
                    }
                  }}
                  className="omni-search-input"
                />
                <kbd className="omni-kbd">⌘K</kbd>
                <Dialog.Close asChild>
                  <button aria-label="Close" className="omni-close-btn">
                    <X className="size-4" aria-hidden />
                  </button>
                </Dialog.Close>
              </div>
            )}
          </div>

          {/* Body */}
          <div
            id="omni-listbox"
            role="listbox"
            aria-label="Command results"
            className={cn("omni-body", className)}
            ref={listRef}
          >
            {loadingIds.size > 0 && (
              <div className="omni-loading">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Fetching results…
              </div>
            )}

            {groups.map((g) => (
              <div key={g.id} className="omni-group">
                {g.items.length > 0 && (
                  <div className="omni-group-label">{g.label}</div>
                )}
                <div className="omni-group-items">
                  {g.items.map((item) => {
                    const active = item.id === activeId || (activeId == null && flatItems.indexOf(item) === 0);
                    const nodeId = `omni-item-${item.id}`;
                    return (
                      <button
                        key={item.id}
                        id={nodeId}
                        data-id={item.id}
                        role="option"
                        aria-selected={active}
                        disabled={item.disabled}
                        onMouseEnter={() => setActiveId(item.id)}
                        onFocus={() => setActiveId(item.id)}
                        onClick={() => !item.disabled && execute(item)}
                        className={cn(
                          "omni-item",
                          active && "omni-item-active",
                          item.disabled && "omni-item-disabled"
                        )}
                      >
                        {renderItem ? (
                          renderItem(item, active)
                        ) : (
                          <>
                            <div className="omni-item-icon">
                              {item.icon ?? <Command className="size-4" aria-hidden />}
                            </div>

                            <div className="omni-item-text">
                              <div className="omni-item-label">
                                {renderHighlighted(item.label, item as OmniItem & { _indices?: number[] })}
                              </div>
                              {item.subtitle && (
                                <div className="omni-item-subtitle">{item.subtitle}</div>
                              )}
                            </div>

                            {item.pinned && (
                              <span title="Pinned" className="omni-item-badge" aria-hidden>
                                <Pin className="size-3.5" />
                              </span>
                            )}
                            {item.href && (
                              <a href={item.href} target="_blank" rel="noopener noreferrer" className="omni-item-badge" aria-hidden>
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                            {item.shortcut && (
                              <span className="omni-item-shortcuts">
                                {item.shortcut.map((s, i) => (
                                  <kbd key={i} className="omni-kbd-sm">{s}</kbd>
                                ))}
                              </span>
                            )}
                            <ChevronRight className="omni-item-chevron" aria-hidden />
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
                {g.items.length === 0 && debouncedQuery && (
                  <div className="omni-empty-group">No matches in {g.label}.</div>
                )}
              </div>
            ))}

            {flatItems.length === 0 && (
              <div className="omni-empty">
                <div className="omni-empty-icon">
                  <History className="size-4" aria-hidden />
                </div>
                {debouncedQuery
                  ? "No results found. Try a different query."
                  : "Type to search the docs, or browse recent items."}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="omni-footer">
            {renderFooter ? (
              renderFooter(activeIndex >= 0 ? flatItems[activeIndex] : null)
            ) : (
              <div className="omni-footer-inner">
                <div className="omni-footer-hints">
                  <span className="omni-footer-hint">
                    <CornerDownLeft className="size-3" /> to select
                  </span>
                  <span className="omni-footer-hint">
                    <ArrowUp className="size-3" />
                    <ArrowDown className="size-3" /> to navigate
                  </span>
                  <span className="omni-footer-hint omni-footer-hint-desktop">
                    <X className="size-3" /> to close
                  </span>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function renderHighlighted(label: string, item: OmniItem & { _indices?: number[] }) {
  const inds = item._indices ?? [];
  if (!inds.length) return label;

  const out: React.ReactNode[] = [];
  for (let pos = 0; pos < label.length; pos++) {
    const ch = label[pos];
    const isHi = inds.includes(pos);
    if (isHi) {
      let run = ch;
      let p = pos + 1;
      while (inds.includes(p) && p < label.length) {
        run += label[p];
        p++;
      }
      out.push(
        <mark key={`m-${pos}`} className="omni-highlight">{run}</mark>
      );
      pos = p - 1;
    } else {
      out.push(<React.Fragment key={`t-${pos}`}>{ch}</React.Fragment>);
    }
  }
  return out;
}


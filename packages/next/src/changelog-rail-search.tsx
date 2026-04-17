"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export interface ChangelogDirectoryEntry {
  slug: string;
  title: string;
  description?: string;
  date: string;
  url: string;
  version?: string;
  tags: string[];
  authors: string[];
  image?: string;
  content?: ReactNode;
}

interface ChangelogDirectoryProps {
  title: string;
  description?: string;
  entries: ChangelogDirectoryEntry[];
  searchEnabled: boolean;
  actions?: ReactNode;
}

interface ChangelogTOCItem {
  href: string;
  title: string;
  meta?: string;
}

const MAGIC_PROSE =
  "fd-changelog-prose prose dark:prose-invert max-w-none min-w-0 prose-headings:scroll-mt-8 prose-headings:font-semibold prose-a:no-underline prose-headings:tracking-tight prose-headings:text-balance prose-p:tracking-tight prose-p:text-balance";

function formatTagLabel(tag: string) {
  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function formatTimelineDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
    .format(parsed)
    .toUpperCase();
}

function buildSearchHaystack(entry: ChangelogDirectoryEntry) {
  return [
    entry.title,
    entry.description,
    entry.date,
    entry.version,
    entry.tags.join(" "),
    entry.authors.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function EmptyResults({ query }: { query: string }) {
  return (
    <div
      className="rounded-lg border border-fd-border/70 bg-fd-muted/30 px-6 py-12 sm:px-8"
      style={{
        width: "min(100%, 48rem)",
        maxWidth: "48rem",
        minHeight: "10rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        textAlign: "left",
        alignSelf: "flex-start",
        marginLeft: 0,
        marginRight: "auto",
      }}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
        No matches
      </p>
      <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-fd-foreground sm:text-3xl">
        Nothing matched “{query}”
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-fd-muted-foreground">
        Try a release title, version, tag, or author name.
      </p>
    </div>
  );
}

function decodeHashValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getHashTargetElement(href: string) {
  if (!href.startsWith("#")) return null;
  const targetId = decodeHashValue(href.slice(1));
  if (!targetId) return null;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("[id]")).filter(
    (candidate) => candidate.id === targetId,
  );
  const element =
    candidates.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    }) ?? candidates[0];
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) return element;

  return (
    element.closest<HTMLElement>("h1, h2, h3, h4, h5, h6, section, article") ??
    element.parentElement
  );
}

export function ChangelogTOC({
  title,
  items,
  variant = "releases",
}: {
  title: string;
  items: ChangelogTOCItem[];
  variant?: "releases" | "content";
}) {
  const tocId = `fd-changelog-toc-${variant}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const [activeHref, setActiveHref] = useState(items[0]?.href ?? "");

  useEffect(() => {
    if (items.length === 0) {
      setActiveHref("");
      return;
    }

    let frameId = 0;

    const updateActiveHref = () => {
      const threshold = Math.max(140, window.innerHeight * 0.18);
      let nextActiveHref = items[0]?.href ?? "";

      for (const item of items) {
        const element = getHashTargetElement(item.href);
        if (!element) continue;

        const { top } = element.getBoundingClientRect();
        if (top <= threshold) {
          nextActiveHref = item.href;
        } else {
          break;
        }
      }

      if (window.location.hash) {
        const hashHref = `#${decodeHashValue(window.location.hash.slice(1))}`;
        if (items.some((item) => item.href === hashHref)) {
          nextActiveHref = hashHref;
        }
      }

      setActiveHref(nextActiveHref);
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateActiveHref();
      });
    };

    updateActiveHref();
    window.setTimeout(updateActiveHref, 0);
    window.setTimeout(updateActiveHref, 250);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <aside
      id={tocId}
      className="fd-changelog-toc"
      aria-label={title}
      data-fd-changelog-toc="true"
      data-variant={variant}
    >
      <div className="fd-changelog-toc-card">
        <p className="fd-changelog-toc-heading">{title}</p>
        <nav className="fd-changelog-toc-list">
          {items.map((item) => {
            const isActive = item.href === activeHref;

            return (
              <a
                key={item.href}
                href={item.href}
                className="fd-changelog-toc-link"
                data-fd-changelog-toc-link="true"
                data-active={isActive ? "true" : "false"}
                aria-current={isActive ? "location" : undefined}
                onClick={() => setActiveHref(item.href)}
              >
                {item.meta ? <span className="fd-changelog-toc-meta">{item.meta}</span> : null}
                <span className="fd-changelog-toc-title">{item.title}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function ChangelogTimelineItem({
  entry,
  isLast,
}: {
  entry: ChangelogDirectoryEntry;
  isLast: boolean;
}) {
  return (
    <div id={entry.slug} className="fd-changelog-entry relative scroll-mt-24 not-prose isolate">
      <div className="fd-changelog-mobile-summary">
        {entry.version ? <div className="fd-changelog-version-box">{entry.version}</div> : <div />}
        <time className="fd-changelog-date" style={{ marginBottom: "10px" }} dateTime={entry.date}>
          {formatTimelineDate(entry.date)}
        </time>
      </div>

      <div
        className="fd-changelog-mobile-content"
        style={isLast ? undefined : { paddingBottom: "5rem" }}
      >
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-balance text-lg font-semibold leading-snug tracking-tight text-fd-foreground md:text-xl">
            <Link href={entry.url} className="text-inherit no-underline hover:underline">
              {entry.title}
            </Link>
          </h2>

          {entry.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <span
                  key={`${entry.slug}-${tag}`}
                  className="fd-changelog-tag"
                  data-testid="changelog-tag"
                >
                  {formatTagLabel(tag)}
                </span>
              ))}
            </div>
          ) : null}

          {entry.description ? (
            <p className="m-0 max-w-2xl text-sm leading-relaxed text-fd-muted-foreground">
              {entry.description}
            </p>
          ) : null}
        </div>

        {entry.content || entry.image ? (
          <div className={MAGIC_PROSE}>
            {entry.image ? (
              <p>
                <img
                  src={entry.image}
                  alt={`${entry.title} preview`}
                  loading="lazy"
                  decoding="async"
                />
              </p>
            ) : null}
            {entry.content}
          </div>
        ) : null}
      </div>

      <div
        className="fd-changelog-desktop-grid"
        style={isLast ? undefined : { paddingBottom: "5rem" }}
      >
        <div className="flex items-start justify-end pt-0.5">
          {entry.version ? (
            <div className="fd-changelog-version-box">{entry.version}</div>
          ) : (
            <div className="h-9" aria-hidden="true" />
          )}
        </div>

        <div className="fd-changelog-rail" data-testid="changelog-rail">
          <div
            className="fd-changelog-timeline-dot mt-1"
            data-testid="changelog-timeline-dot"
            aria-hidden
          />
          {isLast ? <div className="fd-changelog-rail-end-mask" aria-hidden /> : null}
        </div>

        <div className="min-w-0 space-y-5">
          <time className="fd-changelog-date block pt-0.5" dateTime={entry.date}>
            {formatTimelineDate(entry.date)}
          </time>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="m-0 text-balance text-lg font-semibold leading-snug tracking-tight text-fd-foreground md:text-xl">
                <Link href={entry.url} className="text-inherit no-underline hover:underline">
                  {entry.title}
                </Link>
              </h2>

              {entry.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <span
                      key={`${entry.slug}-${tag}`}
                      className="fd-changelog-tag"
                      data-testid="changelog-tag"
                    >
                      {formatTagLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : null}

              {entry.description ? (
                <p className="m-0 max-w-2xl text-sm leading-relaxed text-fd-muted-foreground">
                  {entry.description}
                </p>
              ) : null}
            </div>

            {entry.content || entry.image ? (
              <div className={MAGIC_PROSE}>
                {entry.image ? (
                  <p>
                    <img
                      src={entry.image}
                      alt={`${entry.title} preview`}
                      loading="lazy"
                      decoding="async"
                    />
                  </p>
                ) : null}
                {entry.content}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChangelogDirectory({
  title,
  description,
  entries,
  searchEnabled,
  actions,
}: ChangelogDirectoryProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) return entries;
    return entries.filter((entry) => buildSearchHaystack(entry).includes(normalizedQuery));
  }, [entries, normalizedQuery]);

  const releaseCount = entries.length;
  const hasResults = filteredEntries.length > 0;
  const tocItems = filteredEntries.map((entry) => ({
    href: `#${entry.slug}`,
    title: entry.title,
    meta: entry.version ?? formatTimelineDate(entry.date),
  }));
  const searchControl = searchEnabled ? (
    <div className="fd-changelog-search-row">
      <label className="fd-changelog-search" aria-label="Search changelog entries">
        <span className="fd-changelog-search-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search changelog entries"
          className="fd-changelog-search-input"
        />
      </label>
    </div>
  ) : null;

  return (
    <div className="fd-changelog-frame not-prose relative w-full pb-16">
      <div className="fd-changelog-header-strip border-b-0 border-fd-border/50">
        <div
          className="flex flex-wrap items-center justify-between gap-4"
          style={{ paddingTop: "1.25rem", paddingBottom: "1.25rem" }}
        >
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-fd-foreground md:text-3xl">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-fd-muted-foreground">
              {releaseCount} {releaseCount === 1 ? "release" : "releases"}
            </p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {description || searchControl ? (
        <>
          {description ? (
            <p
              className="max-w-2xl text-base leading-relaxed text-fd-muted-foreground"
              style={{ marginTop: "1rem" }}
            >
              {description}
            </p>
          ) : null}
          {searchControl ? (
            <div style={{ marginTop: description ? "1rem" : "1.25rem" }}>{searchControl}</div>
          ) : null}
          <hr className="border-0 border-t border-fd-border/40" style={{ marginTop: "1rem" }} />
        </>
      ) : null}

      <div
        className={
          hasResults ? "fd-changelog-shell fd-changelog-shell-shifted" : "fd-changelog-shell"
        }
        style={{ paddingTop: "4rem" }}
      >
        <div className="fd-changelog-main fd-changelog-directory-feed relative">
          {hasResults ? (
            <>
              <div className="fd-changelog-directory-line" aria-hidden />
              {filteredEntries.map((entry, index) => (
                <ChangelogTimelineItem
                  key={entry.slug}
                  entry={entry}
                  isLast={index === filteredEntries.length - 1}
                />
              ))}
            </>
          ) : (
            <EmptyResults query={query} />
          )}
        </div>
        {hasResults ? <ChangelogTOC title="Releases" items={tocItems} /> : null}
      </div>
    </div>
  );
}

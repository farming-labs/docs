"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

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
    <div className="rounded-lg border border-fd-border/70 bg-fd-muted/30 px-6 py-10 sm:px-8">
      <p className="text-xs font-medium text-fd-muted-foreground">No matches</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fd-foreground sm:text-3xl">
        Nothing matched “{query}”
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fd-muted-foreground">
        Try a release title, version, tag, or author name.
      </p>
    </div>
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
    <div
      id={entry.slug}
      className="fd-changelog-entry relative scroll-mt-24 not-prose isolate"
    >
      <div className="fd-changelog-mobile-summary">
        {entry.version ? <div className="fd-changelog-version-box">{entry.version}</div> : <div />}
        <time
          className="fd-changelog-date"
          style={{ marginBottom: "10px" }} 
          dateTime={entry.date}
        >
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
          <time
            className="fd-changelog-date block pt-0.5"
            dateTime={entry.date}
          >
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

  return (
    <div className="not-prose relative mx-auto w-full max-w-5xl px-6 pb-16 lg:px-10">
      <div className="-mx-6 border-b-0 border-fd-border/50 lg:-mx-10">
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
          <div className="flex flex-wrap items-center gap-2">
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            {searchEnabled ? (
              <label className="relative flex min-w-48 max-w-xs flex-1 items-center">
                <span className="pointer-events-none absolute left-2.5 text-fd-muted-foreground">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search…"
                  className="h-9 w-full rounded-md border border-fd-border bg-fd-background pl-9 pr-3 text-sm text-fd-foreground shadow-sm outline-none placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-fd-primary/25"
                />
              </label>
            ) : null}
          </div>
        </div>
      </div>

      {description ? (
        <>
          <p
            className="max-w-2xl text-base leading-relaxed text-fd-muted-foreground"
            style={{ marginTop: "1rem" }}
          >
            {description}
          </p>
          <hr
            className="border-0 border-t border-fd-border/40"
            style={{ marginTop: "1rem" }}
          />
        </>
      ) : null}

      <div className="fd-changelog-directory-feed relative" style={{ paddingTop: "4rem" }}>
        {filteredEntries.length > 0 ? (
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
    </div>
  );
}

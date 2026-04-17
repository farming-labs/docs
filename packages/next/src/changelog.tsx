import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPageMetadata, type DocsConfig } from "@farming-labs/theme";
import type { ChangelogFrontmatter } from "@farming-labs/docs";
import { resolveChangelogConfig } from "@farming-labs/docs";
import {
  createElement,
  isValidElement,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  ChangelogDirectory,
  ChangelogTOC,
  type ChangelogDirectoryEntry,
} from "./changelog-rail-search.js";

export interface GeneratedChangelogEntry {
  slug: string;
  date: string;
  url: string;
  sourcePath: string;
  Component: ComponentType;
  metadata?: ChangelogFrontmatter;
}

interface TOCItem {
  title: string;
  url: string;
  depth: number;
}

interface ResolvedChangelogEntry {
  slug: string;
  date: string;
  url: string;
  sourcePath: string;
  title: string;
  description?: string;
  authors: string[];
  version?: string;
  tags: string[];
  pinned: boolean;
  image?: string;
  Component: ComponentType;
}

function formatDisplayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(parsed)
    .toUpperCase();
}

function normalizeAuthors(value: ChangelogFrontmatter["authors"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  }

  return value.trim() ? [value] : [];
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripInlineMarkdown(value: string) {
  return normalizeWhitespace(
    value
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/<[^>]+>/g, ""),
  );
}

function slugifyHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`'"‘’“”]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractChangelogToc(sourcePath: string): TOCItem[] {
  try {
    const content = readFileSync(join(process.cwd(), sourcePath), "utf-8");
    const lines = content.split(/\r?\n/);
    const items: TOCItem[] = [];
    const seenSlugs = new Map<string, number>();
    let inFrontmatter = false;
    let frontmatterDone = false;
    let inFence = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!frontmatterDone && trimmed === "---") {
        inFrontmatter = !inFrontmatter;
        if (!inFrontmatter) frontmatterDone = true;
        continue;
      }

      if (inFrontmatter) continue;

      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }

      if (inFence) continue;

      const headingMatch = line.match(/^(#{2,4})\s+(.+?)\s*#*\s*$/);
      if (!headingMatch) continue;

      const depth = headingMatch[1].length;
      const title = stripInlineMarkdown(headingMatch[2]);
      if (!title) continue;

      const baseSlug = slugifyHeading(title) || `section-${items.length + 1}`;
      const seen = seenSlugs.get(baseSlug) ?? 0;
      seenSlugs.set(baseSlug, seen + 1);
      const slug = seen === 0 ? baseSlug : `${baseSlug}-${seen}`;

      items.push({
        title,
        url: `#${slug}`,
        depth,
      });
    }

    return items;
  } catch {
    return [];
  }
}

function resolveEntries(entries: GeneratedChangelogEntry[]): ResolvedChangelogEntry[] {
  return entries
    .filter((entry) => entry.metadata?.draft !== true)
    .map((entry) => ({
      slug: entry.slug,
      date: entry.date,
      url: entry.url,
      sourcePath: entry.sourcePath,
      title: entry.metadata?.title?.trim() || entry.slug.replace(/-/g, " "),
      description: entry.metadata?.description?.trim() || undefined,
      authors: normalizeAuthors(entry.metadata?.authors),
      version:
        typeof entry.metadata?.version === "string" ? entry.metadata.version : undefined,
      tags: Array.isArray(entry.metadata?.tags)
        ? entry.metadata.tags.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
        : [],
      pinned: entry.metadata?.pinned === true,
      image:
        typeof entry.metadata?.image === "string" && entry.metadata.image.trim().length > 0
          ? entry.metadata.image
          : undefined,
      Component: entry.Component,
    }))
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return right.date.localeCompare(left.date);
    });
}

function findEntry(entries: ResolvedChangelogEntry[], slug: string) {
  return entries.find((entry) => entry.slug === slug);
}

function toDirectoryEntries(entries: ResolvedChangelogEntry[]): ChangelogDirectoryEntry[] {
  return entries.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    date: entry.date,
    url: entry.url,
    version: entry.version,
    tags: entry.tags,
    authors: entry.authors,
    image: entry.image,
    content: createElement(entry.Component),
  }));
}

function renderActionsComponent(value: unknown): ReactNode {
  if (!value) return null;
  if (isValidElement(value)) return value;
  if (typeof value === "function") return createElement(value as ComponentType);
  return value as ReactNode;
}

function getListingUrl(config: DocsConfig) {
  const changelog = resolveChangelogConfig(config.changelog);
  const entry = (config.entry ?? "docs").replace(/^\/+|\/+$/g, "");
  return `/${entry}/${changelog.path}`;
}

function formatChangelogTagLabel(tag: string) {
  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function ChangelogActions({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return <div className="fd-changelog-actions">{children}</div>;
}

function MetaRow({
  entry,
  includeVersion = true,
}: {
  entry: ResolvedChangelogEntry;
  includeVersion?: boolean;
}) {
  const meta = [
    includeVersion && entry.version ? { label: entry.version, kind: "version" as const } : null,
    ...entry.tags.map((tag) => ({ label: tag, kind: "tag" as const })),
  ].filter(Boolean) as Array<{ label: string; kind: "version" | "tag" }>;

  return (
    <div className="flex flex-wrap gap-2">
      {meta.map((item) => (
        <span
          key={`${item.kind}-${item.label}`}
          className="fd-changelog-tag"
          data-testid={item.kind === "tag" ? "changelog-tag" : undefined}
        >
          {item.kind === "tag" ? formatChangelogTagLabel(item.label) : item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="not-prose rounded-[1.75rem] bg-black/[0.02] px-8 py-12 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
        No changelog entries yet
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
        Add a dated folder like{" "}
        <code className="rounded bg-black/[0.05] px-1.5 py-0.5 dark:bg-white/[0.08]">
          changelog/2026-03-04/page.mdx
        </code>{" "}
        and it will appear here automatically.
      </p>
    </div>
  );
}

function ChangelogEntryPagination(props: {
  previous?: ResolvedChangelogEntry;
  next?: ResolvedChangelogEntry;
}) {
  if (!props.previous && !props.next) return null;

  const both = Boolean(props.previous && props.next);

  return (
    <nav
      className="not-prose fd-page-nav mt-16"
      aria-label="Changelog pagination"
      style={both ? undefined : { gridTemplateColumns: "1fr" }}
    >
      {props.previous ? (
        <Link href={props.previous.url} prefetch className="fd-page-nav-card fd-page-nav-prev">
          <span className="fd-page-nav-label">
            <span aria-hidden>←</span>
            Previous
          </span>
          <span className="fd-page-nav-title">{props.previous.title}</span>
          {props.previous.description ? (
            <span className="line-clamp-2 text-sm text-fd-muted-foreground">
              {props.previous.description}
            </span>
          ) : null}
        </Link>
      ) : both ? (
        <div aria-hidden="true" />
      ) : null}
      {props.next ? (
        <Link href={props.next.url} prefetch className="fd-page-nav-card fd-page-nav-next">
          <span className="fd-page-nav-label">
            Next
            <span aria-hidden>→</span>
          </span>
          <span className="fd-page-nav-title">{props.next.title}</span>
          {props.next.description ? (
            <span className="line-clamp-2 text-sm text-fd-muted-foreground">
              {props.next.description}
            </span>
          ) : null}
        </Link>
      ) : both ? (
        <div aria-hidden="true" />
      ) : null}
    </nav>
  );
}

function ChangelogEntryView(props: {
  entry: ResolvedChangelogEntry;
  toc: TOCItem[];
  previous?: ResolvedChangelogEntry;
  next?: ResolvedChangelogEntry;
  listingUrl: string;
}) {
  const Content = props.entry.Component;
  const contentClassName =
    "fd-changelog-prose prose dark:prose-invert max-w-none min-w-0 prose-headings:scroll-mt-8 prose-headings:font-semibold prose-a:no-underline prose-headings:tracking-tight prose-headings:text-balance prose-p:tracking-tight prose-p:text-balance";
  const tocItems = props.toc.map((item) => ({ href: item.url, title: item.title }));

  return (
    <div className="fd-changelog-frame not-prose relative w-full pb-16">
      <div className="fd-changelog-shell">
        <div className="fd-changelog-main">
          <div className="border-b border-fd-border/50 pb-5">
            <Link
              href={props.listingUrl}
              prefetch
              style={{marginBottom: "30px" }}
              className="inline-flex items-center gap-2 text-sm font-medium text-fd-muted-foreground no-underline transition-colors hover:text-fd-foreground"
            >
              <span aria-hidden>←</span>
              Back to changelog
            </Link>
          </div>

          <div style={{ paddingTop: "4.5rem" }}>
            <div className="fd-changelog-mobile-summary">
              {props.entry.version ? (
                <div className="fd-changelog-version-box">{props.entry.version}</div>
              ) : (
                <div />
              )}
              <time className="fd-changelog-date" dateTime={props.entry.date}>
                {formatDisplayDate(props.entry.date)}
              </time>
            </div>

            <div className="fd-changelog-mobile-content">
              <header className="flex flex-col gap-2">
                <h1 className="m-0 text-balance text-2xl font-semibold leading-snug tracking-tight text-fd-foreground md:text-3xl">
                  {props.entry.title}
                </h1>
                <MetaRow entry={props.entry} includeVersion={false} />
                {props.entry.description ? (
                  <p className="m-0 max-w-2xl text-sm leading-relaxed text-fd-muted-foreground">
                    {props.entry.description}
                  </p>
                ) : null}
              </header>

              <article className={`${contentClassName} mt-6`}>
                {props.entry.image ? (
                  <p>
                    <img
                      src={props.entry.image}
                      alt={`${props.entry.title} preview`}
                      loading="lazy"
                      decoding="async"
                    />
                  </p>
                ) : null}
                <Content />
              </article>
            </div>

            <div className="fd-changelog-desktop-grid">
              <div className="flex items-start justify-end pt-0.5">
                {props.entry.version ? (
                  <div className="fd-changelog-version-box">{props.entry.version}</div>
                ) : (
                  <div className="h-9" aria-hidden="true" />
                )}
              </div>

              <div className="fd-changelog-rail" data-testid="changelog-rail">
                <div
                  className="fd-changelog-timeline-line"
                  data-testid="changelog-timeline-line"
                  aria-hidden
                  style={{ top: "1rem", bottom: "0" }}
                />
                <div
                  className="fd-changelog-timeline-dot mt-1"
                  data-testid="changelog-timeline-dot"
                  aria-hidden
                />
              </div>

              <div className="min-w-0 space-y-6">
                <time className="fd-changelog-date block pt-0.5" dateTime={props.entry.date}>
                  {formatDisplayDate(props.entry.date)}
                </time>

                <header className="flex flex-col gap-2">
                  <h1 className="m-0 text-balance text-2xl font-semibold leading-snug tracking-tight text-fd-foreground md:text-3xl">
                    {props.entry.title}
                  </h1>
                  <MetaRow entry={props.entry} includeVersion={false} />
                  {props.entry.description ? (
                    <p className="m-0 max-w-2xl text-sm leading-relaxed text-fd-muted-foreground">
                      {props.entry.description}
                    </p>
                  ) : null}
                </header>

                <article className={contentClassName}>
                  {props.entry.image ? (
                    <p>
                      <img
                        src={props.entry.image}
                        alt={`${props.entry.title} preview`}
                        loading="lazy"
                        decoding="async"
                      />
                    </p>
                  ) : null}
                  <Content />
                </article>
              </div>
            </div>
          </div>

          <ChangelogEntryPagination previous={props.previous} next={props.next} />
        </div>
        <ChangelogTOC title="On this page" items={tocItems} variant="content" />
      </div>
    </div>
  );
}

export function createNextChangelogIndexPage(
  config: DocsConfig,
  entries: GeneratedChangelogEntry[],
) {
  return function NextChangelogIndexPage() {
    const changelog = resolveChangelogConfig(config.changelog);
    const resolvedEntries = resolveEntries(entries);
    const actions = renderActionsComponent(changelog.actionsComponent);

    return resolvedEntries.length > 0 ? (
      <ChangelogDirectory
        title={changelog.title}
        description={changelog.description}
        entries={toDirectoryEntries(resolvedEntries)}
        searchEnabled={changelog.search}
        actions={actions ? <ChangelogActions>{actions}</ChangelogActions> : null}
      />
    ) : (
      <EmptyState />
    );
  };
}

export function createNextChangelogEntryPage(
  config: DocsConfig,
  entries: GeneratedChangelogEntry[],
) {
  return async function NextChangelogEntryPage(props: {
    params?: Promise<{ slug?: string }> | { slug?: string };
  }) {
    const resolvedEntries = resolveEntries(entries);
    const resolvedParams = props.params ? await props.params : undefined;
    const slug = resolvedParams?.slug;

    if (!slug) notFound();

    const entry = findEntry(resolvedEntries, slug);
    if (!entry) notFound();

    const currentIndex = resolvedEntries.findIndex(
      (candidate) => candidate.slug === slug,
    );
    const previous =
      currentIndex < resolvedEntries.length - 1
        ? resolvedEntries[currentIndex + 1]
        : undefined;
    const next =
      currentIndex > 0 ? resolvedEntries[currentIndex - 1] : undefined;

    return (
      <ChangelogEntryView
        entry={entry}
        toc={extractChangelogToc(entry.sourcePath)}
        previous={previous}
        next={next}
        listingUrl={getListingUrl(config)}
      />
    );
  };
}

export function createNextChangelogStaticParams(entries: GeneratedChangelogEntry[]) {
  return function generateStaticParams() {
    return resolveEntries(entries).map((entry) => ({ slug: entry.slug }));
  };
}

export function createNextChangelogIndexMetadata(config: DocsConfig): Metadata {
  const changelog = resolveChangelogConfig(config.changelog);
  return createPageMetadata(config, {
    title: changelog.title,
    description: changelog.description,
  }) as Metadata;
}

export function createNextChangelogEntryMetadata(
  config: DocsConfig,
  entries: GeneratedChangelogEntry[],
) {
  return async function generateMetadata(props: {
    params?: Promise<{ slug?: string }> | { slug?: string };
  }): Promise<Metadata> {
    const resolvedParams = props.params ? await props.params : undefined;
    const slug = resolvedParams?.slug;
    const entry = slug ? findEntry(resolveEntries(entries), slug) : undefined;

    if (!entry) {
      const changelog = resolveChangelogConfig(config.changelog);
      return createPageMetadata(config, {
        title: changelog.title,
        description: changelog.description,
      }) as Metadata;
    }

    return createPageMetadata(config, {
      title: entry.title,
      description: entry.description,
    }) as Metadata;
  };
}

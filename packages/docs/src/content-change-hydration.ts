import matter from "gray-matter";
import { parseDocsMarkdownSections } from "./markdown-sections.js";
import {
  createDocsPaginationCursor,
  DocsPaginationCursorError,
  resolveDocsPaginationOffset,
} from "./pagination.js";
import { digestDocsRetrievalContent } from "./retrieval-digest.js";
import { buildDocsRetrievalDigestProjection } from "./search.js";
import type {
  DocsContentChangeDocument,
  DocsContentChangedDocument,
  DocsContentChangesResponse,
  DocsSearchSourcePage,
} from "./types.js";

export const DOCS_CONTENT_CHANGE_HYDRATION_FORMAT = "docs-content-change-hydration.v1";
export const DEFAULT_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET = 5_000;
export const MIN_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET = 4;
export const MAX_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET = 32_000;
const DOCS_CONTENT_CHANGE_HYDRATION_PAGE_SIZE = 25;
const DOCS_CONTENT_CHANGE_HYDRATION_CURSOR_KIND = "mcp.tool/hydrate_content_changes";

export interface DocsContentChangeHydrationSection {
  id: string;
  heading: string;
  level: number;
}

export interface DocsContentChangeHydrationContent {
  type: "content";
  change: "added" | "changed";
  url: string;
  canonicalUrl: string;
  /** Digest from the body-free document change feed. */
  digest: string;
  previousDigest?: string;
  lastModified?: string;
  previousLastModified?: string;
  section: DocsContentChangeHydrationSection;
  /** Digest of the complete, non-overlapping section before chunking. */
  sectionDigest: string;
  /** Digest of the content bytes returned in this chunk. */
  chunkDigest: string;
  chunk: {
    index: number;
    count: number;
  };
  content: string;
  utf8Bytes: number;
}

export interface DocsContentChangeHydrationTombstone {
  type: "tombstone";
  change: "deleted";
  url: string;
  canonicalUrl: string;
  /** Last known digest for the deleted document. */
  digest: string;
  lastModified?: string;
}

export interface DocsContentChangeHydrationBudget {
  requestedTokens: number;
  strategy: "utf8-bytes";
  maxUtf8Bytes: number;
  usedUtf8Bytes: number;
  conservativeTokenUpperBound: number;
  remainingUtf8Bytes: number;
}

export interface DocsContentChangeHydrationResponse {
  format: typeof DOCS_CONTENT_CHANGE_HYDRATION_FORMAT;
  audience: "agent";
  locale?: string;
  since: string;
  indexGeneration: string;
  mode: DocsContentChangesResponse["mode"];
  resetRequired: boolean;
  documentCount: number;
  counts: DocsContentChangesResponse["counts"];
  budget: DocsContentChangeHydrationBudget;
  resultCount: number;
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  content: DocsContentChangeHydrationContent[];
  tombstones: DocsContentChangeHydrationTombstone[];
}

export interface HydrateDocsContentChangesOptions {
  changes: DocsContentChangesResponse;
  pages: readonly DocsSearchSourcePage[];
  since: string;
  tokenBudget?: number;
  cursor?: string;
  /** Stable MCP server identity mixed into opaque continuation cursors. */
  cursorScope: string;
}

type HydrationUnit = DocsContentChangeHydrationContent | DocsContentChangeHydrationTombstone;

interface HydrationSection {
  id: string;
  heading: string;
  level: number;
  content: string;
}

function docsHydrationUtf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function appendDocsHydrationLocale(url: string, locale: string | undefined): string {
  if (!locale) return url;
  const hashIndex = url.indexOf("#");
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const queryIndex = withoutHash.indexOf("?");
  const rawQuery = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  if (new URLSearchParams(rawQuery).has("lang")) return url;
  return `${withoutHash}${queryIndex >= 0 ? "&" : "?"}lang=${encodeURIComponent(locale)}${hash}`;
}

function splitDocsHydrationChunk(value: string, maxUtf8Bytes: number): [string, string] {
  if (docsHydrationUtf8Bytes(value) <= maxUtf8Bytes) return [value, ""];

  const encoder = new TextEncoder();
  let usedUtf8Bytes = 0;
  let endOffset = 0;
  let paragraphOffset = -1;
  let lineOffset = -1;
  for (const character of value) {
    const characterUtf8Bytes = encoder.encode(character).byteLength;
    if (usedUtf8Bytes + characterUtf8Bytes > maxUtf8Bytes) break;
    usedUtf8Bytes += characterUtf8Bytes;
    endOffset += character.length;
    if (value.slice(Math.max(0, endOffset - 2), endOffset) === "\n\n") {
      paragraphOffset = endOffset;
    } else if (character === "\n") {
      lineOffset = endOffset;
    }
  }

  const minimumUsefulBoundary = Math.floor(endOffset * 0.5);
  const boundary =
    paragraphOffset >= minimumUsefulBoundary
      ? paragraphOffset
      : lineOffset >= minimumUsefulBoundary
        ? lineOffset
        : endOffset;
  return [value.slice(0, boundary), value.slice(boundary)];
}

function splitDocsHydrationContent(value: string, maxUtf8Bytes: number): string[] {
  if (!value) return [""];
  const chunks: string[] = [];
  let remaining = value;
  while (remaining) {
    const [chunk, next] = splitDocsHydrationChunk(remaining, maxUtf8Bytes);
    if (!chunk && next === remaining) {
      throw new TypeError("Unable to split changed content within the requested token budget.");
    }
    chunks.push(chunk);
    remaining = next;
  }
  return chunks;
}

function partitionDocsHydrationSections(
  document: string,
  page: DocsSearchSourcePage,
): HydrationSection[] {
  const body = matter(document).content.trim();
  const parsed = parseDocsMarkdownSections(body);
  if (parsed.length === 0) {
    return [{ id: "document", heading: page.title, level: 1, content: body }];
  }

  const lines = body.split(/\r?\n/u);
  return parsed.map((section, index) => {
    const startLine = index === 0 ? 0 : Math.max(0, section.startLine - 1);
    const nextStartLine = parsed[index + 1]?.startLine;
    const endLine = nextStartLine ? Math.max(startLine, nextStartLine - 1) : lines.length;
    return {
      id: section.anchor,
      heading: section.title,
      level: section.level,
      content: lines.slice(startLine, endLine).join("\n").trim(),
    };
  });
}

function toHydrationContentUnits(
  change: DocsContentChangeDocument | DocsContentChangedDocument,
  kind: "added" | "changed",
  page: DocsSearchSourcePage,
  maxUtf8Bytes: number,
): DocsContentChangeHydrationContent[] {
  const document = buildDocsRetrievalDigestProjection(page, "agent");
  return partitionDocsHydrationSections(document, page).flatMap((section) => {
    const sectionDigest = digestDocsRetrievalContent(section.content);
    const chunks = splitDocsHydrationContent(section.content, maxUtf8Bytes);
    return chunks.map((content, index) => ({
      type: "content" as const,
      change: kind,
      url: change.url,
      canonicalUrl: change.canonicalUrl,
      digest: change.digest,
      ...("previousDigest" in change ? { previousDigest: change.previousDigest } : {}),
      ...(change.lastModified ? { lastModified: change.lastModified } : {}),
      ...("previousLastModified" in change && change.previousLastModified
        ? { previousLastModified: change.previousLastModified }
        : {}),
      section: {
        id: section.id,
        heading: section.heading,
        level: section.level,
      },
      sectionDigest,
      chunkDigest: digestDocsRetrievalContent(content),
      chunk: {
        index,
        count: chunks.length,
      },
      content,
      utf8Bytes: docsHydrationUtf8Bytes(content),
    }));
  });
}

function buildDocsHydrationUnits(
  changes: DocsContentChangesResponse,
  pages: readonly DocsSearchSourcePage[],
  maxUtf8Bytes: number,
): HydrationUnit[] {
  const pagesByUrl = new Map<string, DocsSearchSourcePage>();
  for (const page of pages) {
    pagesByUrl.set(page.url, page);
    pagesByUrl.set(appendDocsHydrationLocale(page.url, changes.locale), page);
  }

  const currentUnits = (
    [
      ...changes.added.map((change) => [change, "added"] as const),
      ...changes.changed.map((change) => [change, "changed"] as const),
    ] satisfies ReadonlyArray<
      readonly [DocsContentChangeDocument | DocsContentChangedDocument, "added" | "changed"]
    >
  ).flatMap(([change, kind]) => {
    const page = pagesByUrl.get(change.url);
    if (!page) {
      throw new TypeError(`Unable to hydrate changed documentation content for ${change.url}.`);
    }
    return toHydrationContentUnits(change, kind, page, maxUtf8Bytes);
  });
  const tombstones = changes.deleted.map(
    (change): DocsContentChangeHydrationTombstone => ({
      type: "tombstone",
      change: "deleted",
      url: change.url,
      canonicalUrl: change.canonicalUrl,
      digest: change.digest,
      ...(change.lastModified ? { lastModified: change.lastModified } : {}),
    }),
  );
  return [...currentUnits, ...tombstones];
}

function resolveDocsHydrationTokenBudget(value: number | undefined): number {
  const tokenBudget = value ?? DEFAULT_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET;
  if (
    !Number.isSafeInteger(tokenBudget) ||
    tokenBudget < MIN_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET ||
    tokenBudget > MAX_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET
  ) {
    throw new TypeError(
      `Content-change hydration tokenBudget must be between ${MIN_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET} and ${MAX_DOCS_CONTENT_CHANGE_HYDRATION_TOKEN_BUDGET}.`,
    );
  }
  return tokenBudget;
}

/**
 * Hydrate only the current bodies named by a content-change delta.
 *
 * The conservative budget treats one UTF-8 byte as at most one token. Cursors are
 * bound to the requested generation, current generation, locale, and budget.
 */
export function hydrateDocsContentChanges(
  options: HydrateDocsContentChangesOptions,
): DocsContentChangeHydrationResponse {
  if (options.changes.audience !== "agent") {
    throw new TypeError("MCP content-change hydration requires the agent audience.");
  }
  if (options.changes.since !== options.since) {
    throw new TypeError("Content-change hydration must use the resolved delta generation.");
  }

  const tokenBudget = resolveDocsHydrationTokenBudget(options.tokenBudget);
  const units = buildDocsHydrationUnits(options.changes, options.pages, tokenBudget);
  const hydrationSnapshot = digestDocsRetrievalContent(
    JSON.stringify({
      format: DOCS_CONTENT_CHANGE_HYDRATION_FORMAT,
      since: options.since,
      indexGeneration: options.changes.indexGeneration,
      mode: options.changes.mode,
      resetRequired: options.changes.resetRequired,
      units: units.map((unit) =>
        unit.type === "content"
          ? {
              type: unit.type,
              change: unit.change,
              canonicalUrl: unit.canonicalUrl,
              digest: unit.digest,
              section: unit.section.id,
              sectionDigest: unit.sectionDigest,
              chunk: unit.chunk.index,
              chunkDigest: unit.chunkDigest,
            }
          : {
              type: unit.type,
              canonicalUrl: unit.canonicalUrl,
              digest: unit.digest,
            },
      ),
    }),
  );
  const paginationOptions = {
    kind: DOCS_CONTENT_CHANGE_HYDRATION_CURSOR_KIND,
    scope: JSON.stringify({
      server: options.cursorScope,
      since: options.since,
      locale: options.changes.locale ?? null,
      tokenBudget,
    }),
    snapshot: hydrationSnapshot,
  };
  const offset = resolveDocsPaginationOffset(options.cursor, paginationOptions);
  if (options.cursor !== undefined && offset >= units.length) {
    throw new DocsPaginationCursorError();
  }

  const selected: HydrationUnit[] = [];
  let usedUtf8Bytes = 0;
  for (
    let index = offset;
    index < units.length && selected.length < DOCS_CONTENT_CHANGE_HYDRATION_PAGE_SIZE;
    index += 1
  ) {
    const unit = units[index]!;
    const unitUtf8Bytes = unit.type === "content" ? unit.utf8Bytes : 0;
    if (unitUtf8Bytes > 0 && usedUtf8Bytes + unitUtf8Bytes > tokenBudget) break;
    selected.push(unit);
    usedUtf8Bytes += unitUtf8Bytes;
  }

  const nextOffset = offset + selected.length;
  const hasMore = nextOffset < units.length;
  const nextCursor = hasMore
    ? createDocsPaginationCursor(nextOffset, paginationOptions)
    : undefined;
  const content = selected.filter(
    (unit): unit is DocsContentChangeHydrationContent => unit.type === "content",
  );
  const tombstones = selected.filter(
    (unit): unit is DocsContentChangeHydrationTombstone => unit.type === "tombstone",
  );

  return {
    format: DOCS_CONTENT_CHANGE_HYDRATION_FORMAT,
    audience: "agent",
    ...(options.changes.locale ? { locale: options.changes.locale } : {}),
    since: options.since,
    indexGeneration: options.changes.indexGeneration,
    mode: options.changes.mode,
    resetRequired: options.changes.resetRequired,
    documentCount: options.changes.documentCount,
    counts: { ...options.changes.counts },
    budget: {
      requestedTokens: tokenBudget,
      strategy: "utf8-bytes",
      maxUtf8Bytes: tokenBudget,
      usedUtf8Bytes,
      conservativeTokenUpperBound: usedUtf8Bytes,
      remainingUtf8Bytes: Math.max(0, tokenBudget - usedUtf8Bytes),
    },
    resultCount: selected.length,
    total: units.length,
    hasMore,
    ...(nextCursor ? { nextCursor } : {}),
    content,
    tombstones,
  };
}

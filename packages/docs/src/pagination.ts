import { digestDocsRetrievalContent } from "./retrieval-digest.js";

const DOCS_PAGINATION_CURSOR_VERSION = 1;
const MAX_DOCS_PAGINATION_CURSOR_CHARS = 4_096;
const MAX_DOCS_PAGINATION_STATE_CHARS = 1_024;
const MAX_DOCS_PAGINATION_OFFSET = 10_000_000;
const DOCS_PAGINATION_DIGEST_PATTERN = /^sha256:[a-f\d]{64}$/u;

export class DocsPaginationCursorError extends Error {
  readonly code = "invalid_cursor";

  constructor() {
    super("Invalid or stale pagination cursor.");
    this.name = "DocsPaginationCursorError";
  }
}

export interface DocsPaginationCursorOptions {
  kind: string;
  scope: string;
  snapshot: string;
  /** Optional provider-native continuation state wrapped by this framework cursor. */
  state?: string;
}

export interface DocsPaginationCursorPosition {
  offset: number;
  state?: string;
}

export interface DocsPaginationResult<T> {
  items: T[];
  resultCount: number;
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

function paginationDigest(label: string, value: string): string {
  return digestDocsRetrievalContent(`${label}\0${value}`);
}

function cursorChecksum(payload: readonly unknown[]): string {
  return paginationDigest("docs-pagination-checksum.v1", JSON.stringify(payload));
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string {
  const padded = `${value.replace(/-/gu, "+").replace(/_/gu, "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DOCS_PAGINATION_DIGEST_PATTERN.test(value);
}

function assertCursorOptions(options: DocsPaginationCursorOptions): void {
  if (
    !/^[a-z][a-z\d._/-]{0,127}$/u.test(options.kind) ||
    typeof options.scope !== "string" ||
    typeof options.snapshot !== "string"
  ) {
    throw new TypeError(
      "Pagination cursor options must contain a valid kind, scope, and snapshot.",
    );
  }
}

export function createDocsPaginationCursor(
  offset: number,
  options: DocsPaginationCursorOptions,
): string {
  assertCursorOptions(options);
  if (!Number.isSafeInteger(offset) || offset <= 0 || offset > MAX_DOCS_PAGINATION_OFFSET) {
    throw new TypeError("Pagination cursor offsets must be positive safe integers.");
  }
  if (
    options.state !== undefined &&
    (options.state.length === 0 || options.state.length > MAX_DOCS_PAGINATION_STATE_CHARS)
  ) {
    throw new TypeError("Pagination provider state must be a bounded, non-empty string.");
  }

  const unsigned = [
    DOCS_PAGINATION_CURSOR_VERSION,
    options.kind,
    offset,
    paginationDigest("docs-pagination-scope.v1", options.scope),
    paginationDigest("docs-pagination-snapshot.v1", options.snapshot),
    options.state ?? null,
  ] as const;
  return encodeBase64Url(JSON.stringify([...unsigned, cursorChecksum(unsigned)]));
}

export function resolveDocsPaginationCursor(
  cursor: string | undefined,
  options: Omit<DocsPaginationCursorOptions, "state">,
): DocsPaginationCursorPosition {
  assertCursorOptions(options);
  if (cursor === undefined) return { offset: 0 };
  if (
    cursor.length === 0 ||
    cursor.length > MAX_DOCS_PAGINATION_CURSOR_CHARS ||
    !/^[A-Za-z\d_-]+$/u.test(cursor)
  ) {
    throw new DocsPaginationCursorError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(cursor));
  } catch {
    throw new DocsPaginationCursorError();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 7 ||
    encodeBase64Url(JSON.stringify(parsed)) !== cursor
  ) {
    throw new DocsPaginationCursorError();
  }

  const [version, kind, offset, scopeDigest, snapshotDigest, state, checksum] = parsed;
  const unsigned = [version, kind, offset, scopeDigest, snapshotDigest, state] as const;
  if (
    version !== DOCS_PAGINATION_CURSOR_VERSION ||
    kind !== options.kind ||
    !Number.isSafeInteger(offset) ||
    (offset as number) <= 0 ||
    (offset as number) > MAX_DOCS_PAGINATION_OFFSET ||
    !isDigest(scopeDigest) ||
    !isDigest(snapshotDigest) ||
    !(
      state === null ||
      (typeof state === "string" &&
        state.length > 0 &&
        state.length <= MAX_DOCS_PAGINATION_STATE_CHARS)
    ) ||
    !isDigest(checksum) ||
    scopeDigest !== paginationDigest("docs-pagination-scope.v1", options.scope) ||
    snapshotDigest !== paginationDigest("docs-pagination-snapshot.v1", options.snapshot) ||
    checksum !== cursorChecksum(unsigned)
  ) {
    throw new DocsPaginationCursorError();
  }

  return {
    offset: offset as number,
    ...(typeof state === "string" ? { state } : {}),
  };
}

export function resolveDocsPaginationOffset(
  cursor: string | undefined,
  options: Omit<DocsPaginationCursorOptions, "state">,
): number {
  return resolveDocsPaginationCursor(cursor, options).offset;
}

export function paginateDocsItems<T>(
  items: readonly T[],
  options: DocsPaginationCursorOptions & {
    cursor?: string;
    pageSize: number;
  },
): DocsPaginationResult<T> {
  if (!Number.isSafeInteger(options.pageSize) || options.pageSize <= 0) {
    throw new TypeError("Pagination page sizes must be positive safe integers.");
  }

  const offset = resolveDocsPaginationOffset(options.cursor, options);
  if (offset >= items.length && options.cursor !== undefined) {
    throw new DocsPaginationCursorError();
  }

  const pageItems = items.slice(offset, offset + options.pageSize);
  const nextOffset = offset + pageItems.length;
  const hasMore = nextOffset < items.length;

  return {
    items: pageItems,
    resultCount: pageItems.length,
    total: items.length,
    hasMore,
    ...(hasMore ? { nextCursor: createDocsPaginationCursor(nextOffset, options) } : {}),
  };
}

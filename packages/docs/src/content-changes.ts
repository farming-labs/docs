import type {
  DocsAgentContentChangesConfig,
  DocsContentChangeDocument,
  DocsContentChangesResponse,
  DocsContentChangeSnapshotContext,
  DocsContentChangedDocument,
  DocsContentSnapshot,
  DocsContentSnapshotDocument,
  DocsSearchConfig,
  DocsSearchSourcePage,
} from "./types.js";
import { digestDocsRetrievalContent, isDocsRetrievalCanonicalUrl } from "./retrieval-digest.js";
import { buildDocsContentSnapshot, type BuildDocsContentSnapshotOptions } from "./search.js";

export const DOCS_CONTENT_CHANGES_FORMAT = "docs-content-changes.v1";
export const DOCS_CONTENT_SNAPSHOT_FORMAT = "docs-content-snapshot.v1";
export const DOCS_CONTENT_CHANGES_RESPONSE_VALUE = "changes";
export const DEFAULT_DOCS_CONTENT_CHANGE_SNAPSHOTS = 8;
const MAX_DOCS_CONTENT_CHANGE_SNAPSHOTS = 64;
const DOCS_RETRIEVAL_DIGEST_PATTERN = /^sha256:[a-f\d]{64}$/u;

/** Whether a value is a valid content-index generation identifier. */
export function isDocsContentChangeGeneration(value: string): boolean {
  return DOCS_RETRIEVAL_DIGEST_PATTERN.test(value);
}

export interface DocsContentChangesRequest {
  audience: "human" | "agent";
  since?: string;
}

export interface DocsResolvedContentChangesConfig {
  enabled: boolean;
  maxSnapshots: number;
  loadSnapshot?: DocsAgentContentChangesConfig["loadSnapshot"];
  saveSnapshot?: DocsAgentContentChangesConfig["saveSnapshot"];
}

export interface ResolveDocsContentChangesOptions extends Omit<
  BuildDocsContentSnapshotOptions,
  "pages"
> {
  pages: readonly DocsSearchSourcePage[];
  since?: string;
  request?: Request;
}

export interface DocsContentChangeFeed {
  resolve(options: ResolveDocsContentChangesOptions): Promise<DocsContentChangesResponse>;
}

export class DocsContentChangesRequestError extends Error {
  readonly code = "invalid_content_changes_request";

  constructor(message: string) {
    super(message);
    this.name = "DocsContentChangesRequestError";
  }
}

export function resolveDocsContentChangesConfig(
  input?: boolean | DocsAgentContentChangesConfig,
  options: { staticExport?: boolean } = {},
): DocsResolvedContentChangesConfig {
  const configured = input && typeof input === "object" ? input : undefined;
  const enabled = !options.staticExport && input !== false && configured?.enabled !== false;
  const requestedMax = configured?.maxSnapshots ?? DEFAULT_DOCS_CONTENT_CHANGE_SNAPSHOTS;
  const maxSnapshots =
    Number.isSafeInteger(requestedMax) &&
    requestedMax >= 1 &&
    requestedMax <= MAX_DOCS_CONTENT_CHANGE_SNAPSHOTS
      ? requestedMax
      : DEFAULT_DOCS_CONTENT_CHANGE_SNAPSHOTS;
  return {
    enabled,
    maxSnapshots,
    ...(configured?.loadSnapshot ? { loadSnapshot: configured.loadSnapshot } : {}),
    ...(configured?.saveSnapshot ? { saveSnapshot: configured.saveSnapshot } : {}),
  };
}

export function isDocsContentChangesRequest(url: URL): boolean {
  return url.searchParams.get("response") === DOCS_CONTENT_CHANGES_RESPONSE_VALUE;
}

export function resolveDocsContentChangesRequest(url: URL): DocsContentChangesRequest {
  if (!isDocsContentChangesRequest(url)) {
    throw new DocsContentChangesRequestError("Content changes require `response=changes`.");
  }
  const rawAudience = url.searchParams.get("audience");
  if (rawAudience !== null && rawAudience !== "human" && rawAudience !== "agent") {
    throw new DocsContentChangesRequestError("Content-change audience must be `human` or `agent`.");
  }
  const since = url.searchParams.get("since") ?? undefined;
  if (since !== undefined && !isDocsContentChangeGeneration(since)) {
    throw new DocsContentChangesRequestError(
      "Content-change `since` must be a SHA-256 index generation.",
    );
  }
  return {
    audience: rawAudience ?? "agent",
    ...(since ? { since } : {}),
  };
}

function snapshotScope(snapshot: DocsContentSnapshot): string {
  return JSON.stringify({
    audience: snapshot.audience,
    locale: snapshot.locale,
    baseUrl: snapshot.baseUrl,
  });
}

function snapshotKey(snapshot: DocsContentSnapshot): string {
  return `${snapshotScope(snapshot)}\0${snapshot.indexGeneration}`;
}

function snapshotContext(
  snapshot: DocsContentSnapshot,
  request?: Request,
): DocsContentChangeSnapshotContext {
  return {
    audience: snapshot.audience,
    ...(snapshot.locale ? { locale: snapshot.locale } : {}),
    ...(snapshot.baseUrl ? { baseUrl: snapshot.baseUrl } : {}),
    ...(request ? { request } : {}),
  };
}

function isSnapshotDocument(value: unknown): value is DocsContentSnapshotDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<DocsContentSnapshotDocument>;
  return (
    typeof document.url === "string" &&
    document.url.length > 0 &&
    typeof document.canonicalUrl === "string" &&
    isDocsRetrievalCanonicalUrl(document.canonicalUrl) &&
    typeof document.digest === "string" &&
    DOCS_RETRIEVAL_DIGEST_PATTERN.test(document.digest) &&
    (document.lastModified === undefined ||
      (typeof document.lastModified === "string" &&
        Number.isFinite(Date.parse(document.lastModified))))
  );
}

function validateLoadedSnapshot(
  value: DocsContentSnapshot,
  generation: string,
  current: DocsContentSnapshot,
): DocsContentSnapshot {
  if (
    value.format !== DOCS_CONTENT_SNAPSHOT_FORMAT ||
    value.indexGeneration !== generation ||
    !DOCS_RETRIEVAL_DIGEST_PATTERN.test(value.indexGeneration) ||
    snapshotScope(value) !== snapshotScope(current) ||
    !Array.isArray(value.documents) ||
    !value.documents.every(isSnapshotDocument)
  ) {
    throw new TypeError("Content-change snapshot storage returned an invalid snapshot.");
  }
  const documents = value.documents.map((document) => ({ ...document }));
  documents.sort((left, right) =>
    left.canonicalUrl === right.canonicalUrl
      ? left.url.localeCompare(right.url)
      : left.canonicalUrl.localeCompare(right.canonicalUrl),
  );
  if (
    documents.some(
      (document, index) =>
        index > 0 && documents[index - 1]?.canonicalUrl === document.canonicalUrl,
    )
  ) {
    throw new TypeError("Content-change snapshot storage returned duplicate canonical URLs.");
  }
  return { ...value, documents };
}

function asChangeDocument(document: DocsContentSnapshotDocument): DocsContentChangeDocument {
  return { ...document };
}

function buildDelta(
  current: DocsContentSnapshot,
  previous: DocsContentSnapshot | undefined,
  since: string | undefined,
): DocsContentChangesResponse {
  const currentByUrl = new Map(
    current.documents.map((document) => [document.canonicalUrl, document]),
  );
  const previousByUrl = new Map(
    previous?.documents.map((document) => [document.canonicalUrl, document]) ?? [],
  );
  const added: DocsContentChangeDocument[] = [];
  const changed: DocsContentChangedDocument[] = [];
  const deleted: DocsContentChangeDocument[] = [];

  if (!since || !previous) {
    added.push(...current.documents.map(asChangeDocument));
  } else {
    for (const document of current.documents) {
      const old = previousByUrl.get(document.canonicalUrl);
      if (!old) {
        added.push(asChangeDocument(document));
      } else if (
        old.digest !== document.digest ||
        old.lastModified !== document.lastModified ||
        old.url !== document.url
      ) {
        changed.push({
          ...asChangeDocument(document),
          previousDigest: old.digest,
          ...(old.lastModified ? { previousLastModified: old.lastModified } : {}),
        });
      }
    }
    for (const document of previous.documents) {
      if (!currentByUrl.has(document.canonicalUrl)) {
        deleted.push(asChangeDocument(document));
      }
    }
  }

  const mode = !since ? "snapshot" : previous ? "delta" : "reset";
  return {
    format: DOCS_CONTENT_CHANGES_FORMAT,
    audience: current.audience,
    ...(current.locale ? { locale: current.locale } : {}),
    since: since ?? null,
    indexGeneration: current.indexGeneration,
    mode,
    resetRequired: mode === "reset",
    documentCount: current.documents.length,
    counts: {
      added: added.length,
      changed: changed.length,
      deleted: deleted.length,
    },
    added,
    changed,
    deleted,
  };
}

export function createDocsContentChangeFeed(
  input?: boolean | DocsAgentContentChangesConfig,
): DocsContentChangeFeed {
  const config = resolveDocsContentChangesConfig(input);
  const snapshots = new Map<string, DocsContentSnapshot>();
  const saved = new Set<string>();

  const remember = (snapshot: DocsContentSnapshot) => {
    const key = snapshotKey(snapshot);
    snapshots.delete(key);
    snapshots.set(key, snapshot);
    while (snapshots.size > config.maxSnapshots) {
      const oldest = snapshots.keys().next().value as string | undefined;
      if (!oldest) break;
      snapshots.delete(oldest);
      saved.delete(oldest);
    }
  };

  return {
    async resolve(options) {
      if (!config.enabled) {
        throw new DocsContentChangesRequestError("Content changes are disabled.");
      }
      const current = await buildDocsContentSnapshot(options);
      const currentKey = snapshotKey(current);
      let previous: DocsContentSnapshot | undefined;

      if (options.since === current.indexGeneration) {
        previous = current;
      } else if (options.since) {
        const scopedKey = `${snapshotScope(current)}\0${options.since}`;
        previous = snapshots.get(scopedKey);
        if (!previous && config.loadSnapshot) {
          const loaded = await config.loadSnapshot(
            options.since,
            snapshotContext(current, options.request),
          );
          if (loaded) {
            previous = validateLoadedSnapshot(loaded, options.since, current);
            remember(previous);
          }
        }
      }

      remember(current);
      if (config.saveSnapshot && !saved.has(currentKey)) {
        await config.saveSnapshot(
          {
            ...current,
            documents: current.documents.map((document) => ({ ...document })),
          },
          snapshotContext(current, options.request),
        );
        saved.add(currentKey);
      }
      return buildDelta(current, previous, options.since);
    },
  };
}

function contentChangesEtag(response: DocsContentChangesResponse): string {
  return `"${digestDocsRetrievalContent(
    JSON.stringify([
      response.format,
      response.audience,
      response.locale ?? null,
      response.since,
      response.indexGeneration,
      response.mode,
    ]),
  )}"`;
}

function requestMatchesEtag(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) return false;
  return header
    .split(",")
    .map((value) => value.trim().replace(/^W\//u, ""))
    .some((value) => value === "*" || value === etag);
}

export async function createDocsContentChangesHttpResponse(options: {
  request: Request;
  feed: DocsContentChangeFeed;
  pages: readonly DocsSearchSourcePage[];
  search?: boolean | DocsSearchConfig;
  locale?: string;
  baseUrl?: string;
}): Promise<Response> {
  let resolved: DocsContentChangesRequest;
  try {
    resolved = resolveDocsContentChangesRequest(new URL(options.request.url));
  } catch (error) {
    if (!(error instanceof DocsContentChangesRequestError)) throw error;
    return Response.json({ error: { code: error.code, message: error.message } }, { status: 400 });
  }
  const response = await options.feed.resolve({
    pages: options.pages,
    search: options.search,
    audience: resolved.audience,
    locale: options.locale,
    baseUrl: options.baseUrl,
    since: resolved.since,
    request: options.request,
  });
  const etag = contentChangesEtag(response);
  const headers = {
    "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    ETag: etag,
    "X-Docs-Index-Generation": response.indexGeneration,
    "X-Robots-Tag": "noindex",
  };
  if (requestMatchesEtag(options.request, etag)) {
    return new Response(null, { status: 304, headers });
  }
  if (options.request.method.toUpperCase() === "HEAD") {
    return new Response(null, { headers });
  }
  return Response.json(response, { headers });
}

import { sha256DocsContent } from "./retrieval-digest.js";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export interface DocsCacheableResponseOptions {
  request: Request;
  content: string | Uint8Array;
  status?: number;
  headers?: HeadersInit;
  /** Stable SHA-256 hex digest when the caller already hashed the exact response bytes. */
  sha256?: string;
  /** Exact representation modification time. Invalid values are omitted. */
  lastModified?: string | Date | null;
}

function encodeBase64(bytes: Uint8Array): string {
  let encoded = "";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    encoded += BASE64_ALPHABET[(value >>> 18) & 63];
    encoded += BASE64_ALPHABET[(value >>> 12) & 63];
    encoded += second === undefined ? "=" : BASE64_ALPHABET[(value >>> 6) & 63];
    encoded += third === undefined ? "=" : BASE64_ALPHABET[value & 63];
  }
  return encoded;
}

function sha256HexBytes(sha256: string): Uint8Array {
  if (!/^[a-f\d]{64}$/iu.test(sha256)) {
    throw new Error("A SHA-256 digest must contain exactly 64 hexadecimal characters.");
  }
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(sha256.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/** Format an RFC 9530 Content-Digest field from a SHA-256 hex digest. */
export function formatDocsContentDigest(sha256: string): string {
  return `sha-256=:${encodeBase64(sha256HexBytes(sha256))}:`;
}

/** Normalize an exact source timestamp for Last-Modified. */
export function resolveDocsHttpDate(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string" && !/(?:T|\s)\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?/.test(value.trim())) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toUTCString();
}

function normalizeEtag(value: string): string {
  return value.trim().replace(/^W\//iu, "");
}

/** Match strong or weak If-None-Match validators for a GET/HEAD representation. */
export function requestMatchesDocsEtag(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) return false;
  if (header.trim() === "*") return true;
  const expected = normalizeEtag(etag);
  return header.split(",").some((candidate) => normalizeEtag(candidate) === expected);
}

/** Apply If-Modified-Since only when the stronger If-None-Match validator is absent. */
export function requestHasFreshDocsDate(request: Request, lastModified?: string): boolean {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  if (!lastModified || request.headers.has("if-none-match")) return false;
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) return false;
  const resourceTime = Date.parse(lastModified);
  const requestTime = Date.parse(ifModifiedSince);
  return (
    Number.isFinite(resourceTime) &&
    Number.isFinite(requestTime) &&
    Math.floor(resourceTime / 1000) <= Math.floor(requestTime / 1000)
  );
}

function exposeValidatorHeaders(headers: Headers): void {
  if (!headers.has("Access-Control-Allow-Origin")) return;
  const exposed = new Set(
    (headers.get("Access-Control-Expose-Headers") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  exposed.add("Content-Digest");
  exposed.add("ETag");
  if (headers.has("Last-Modified")) exposed.add("Last-Modified");
  headers.set("Access-Control-Expose-Headers", [...exposed].join(", "));
}

/**
 * Build a byte-stable GET/HEAD response with HTTP validators and RFC 9530 integrity metadata.
 */
export function createDocsCacheableResponse(options: DocsCacheableResponseOptions): Response {
  const method = options.request.method.toUpperCase();
  const isSafeRetrieval = method === "GET" || method === "HEAD";
  const sha256 = options.sha256 ?? sha256DocsContent(options.content);
  const etag = `"${sha256}"`;
  const lastModified = resolveDocsHttpDate(options.lastModified);
  const headers = new Headers(options.headers);
  headers.set("Content-Digest", formatDocsContentDigest(sha256));
  headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);
  exposeValidatorHeaders(headers);

  if (requestMatchesDocsEtag(options.request, etag)) {
    headers.delete("Content-Type");
    return new Response(null, { status: isSafeRetrieval ? 304 : 412, headers });
  }

  if (isSafeRetrieval && requestHasFreshDocsDate(options.request, lastModified)) {
    headers.delete("Content-Type");
    return new Response(null, { status: 304, headers });
  }

  const body =
    method === "HEAD"
      ? null
      : typeof options.content === "string"
        ? options.content
        : new Uint8Array(options.content).buffer;
  return new Response(body, { status: options.status ?? 200, headers });
}

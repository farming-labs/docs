export const DEFAULT_DOCS_JSON_BODY_MAX_BYTES = 1024 * 1024;

export type DocsJsonBodyResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      reason: "invalid_json" | "request_too_large";
      maxBodyBytes: number;
    };

function normalizedBodyLimit(maxBodyBytes: number): number {
  if (!Number.isFinite(maxBodyBytes)) return DEFAULT_DOCS_JSON_BODY_MAX_BYTES;
  return Math.max(1, Math.floor(maxBodyBytes));
}

/** Read and parse JSON without buffering an unbounded request body. */
export async function readDocsJsonBody(
  request: Request,
  maxBodyBytes = DEFAULT_DOCS_JSON_BODY_MAX_BYTES,
): Promise<DocsJsonBodyResult> {
  const limit = normalizedBodyLimit(maxBodyBytes);
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > limit) {
    return { ok: false, reason: "request_too_large", maxBodyBytes: limit };
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const reader = request.body?.getReader();

  try {
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > limit) {
          await reader.cancel();
          return { ok: false, reason: "request_too_large", maxBodyBytes: limit };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, reason: "invalid_json", maxBodyBytes: limit };
  } finally {
    reader?.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    };
  } catch {
    return { ok: false, reason: "invalid_json", maxBodyBytes: limit };
  }
}

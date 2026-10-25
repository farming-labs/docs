/**
 * A page's `sourcePath` is whatever the loading server used to read the file.
 * Absolute filesystem paths (`/var/task/...`, `C:\...`, UNC shares, `file:` URLs)
 * and paths that climb out of the content tree describe the deployment rather
 * than the docs, so agent-facing output only keeps content-relative paths.
 */
const NON_PUBLIC_SOURCE_PATH = /^(?:[\\/]|[a-z]:(?:[\\/]|$)|file:|\.\.(?:[\\/]|$))/i;

export function toPublicDocsSourcePath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
  if (!normalized || NON_PUBLIC_SOURCE_PATH.test(normalized)) return undefined;
  return normalized;
}

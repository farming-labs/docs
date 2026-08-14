/**
 * Encode heading fragments emitted by a renderer's nested table of contents.
 *
 * Fumadocs stores fragment URLs as raw DOM ids. Encoding the fragment after its
 * heading visitor runs keeps links valid without changing path prefixes.
 */
export function encodeDocsHeadingTocUrls(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) encodeDocsHeadingTocUrls(item);
    return;
  }
  if (!value || typeof value !== "object") return;

  const item = value as { url?: unknown; children?: unknown };
  if (typeof item.url === "string") {
    const hashIndex = item.url.indexOf("#");
    if (hashIndex >= 0) {
      item.url = `${item.url.slice(0, hashIndex)}#${encodeURIComponent(
        item.url.slice(hashIndex + 1),
      )}`;
    }
  }
  encodeDocsHeadingTocUrls(item.children);
}

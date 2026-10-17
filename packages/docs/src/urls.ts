export function normalizeDocsUrlPath(value: string): string {
  const normalized = value.replace(/\/+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

export function toDocsMarkdownUrl(url: string, options: { locale?: string } = {}): string {
  const hashIndex = url.indexOf("#");
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const [pathname, query = ""] = withoutHash.split("?", 2);
  const normalizedPath = normalizeDocsUrlPath(pathname || "/");
  const markdownPath = normalizedPath.endsWith(".md") ? normalizedPath : `${normalizedPath}.md`;
  const params = new URLSearchParams(query);
  if (options.locale && !params.has("lang")) params.set("lang", options.locale);
  const search = params.toString();
  return `${markdownPath}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

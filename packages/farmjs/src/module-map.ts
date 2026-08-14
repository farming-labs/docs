export function normalizeDocsModuleKey(key: string): string {
  const posixKey = key.replace(/\\/g, "/");
  return posixKey.startsWith("/") ? posixKey : `/${posixKey.replace(/^\.?\//, "")}`;
}

/**
 * Resolve a compiled MDX module using the route-relative source path emitted
 * by the docs server. Vite preserves the application source prefix in
 * production glob keys (for example `/src/app/docs/guide/page.mdx`) while the
 * runtime data intentionally stays portable (`/guide/page.mdx`).
 */
export function resolveDocsModule<T>(
  modules: Record<string, T>,
  sourcePath: string,
  entry?: string,
): T | undefined {
  const normalizedSourcePath = normalizeDocsModuleKey(sourcePath);
  const directMatch = modules[normalizedSourcePath];
  if (directMatch !== undefined) return directMatch;

  const suffixMatches = Object.entries(modules).filter(([key]) =>
    normalizeDocsModuleKey(key).endsWith(normalizedSourcePath),
  );

  if (suffixMatches.length === 1) return suffixMatches[0][1];

  // Production glob keys retain the application path while bundled docs data
  // can expose the index page as only `/page.md`. Use the configured docs
  // entry to disambiguate that root page from other Markdown index modules.
  const normalizedEntry = entry ? normalizeDocsModuleKey(entry).replace(/\/+$/, "") : undefined;
  if (normalizedEntry) {
    const entryMatches = suffixMatches.filter(([key]) =>
      normalizeDocsModuleKey(key).endsWith(`${normalizedEntry}${normalizedSourcePath}`),
    );
    if (entryMatches.length === 1) return entryMatches[0][1];
  }

  return undefined;
}

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
): T | undefined {
  const normalizedSourcePath = normalizeDocsModuleKey(sourcePath);
  const directMatch = modules[normalizedSourcePath];
  if (directMatch !== undefined) return directMatch;

  const suffixMatches = Object.entries(modules).filter(([key]) =>
    normalizeDocsModuleKey(key).endsWith(normalizedSourcePath),
  );

  return suffixMatches.length === 1 ? suffixMatches[0][1] : undefined;
}

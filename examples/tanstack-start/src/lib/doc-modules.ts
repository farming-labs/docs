const rawDocModules = import.meta.glob("/docs/**/*.{md,mdx}");

function normalizeDocsKey(key: string) {
  const posixKey = key.replace(/\\/g, "/");
  const docsIndex = posixKey.lastIndexOf("/docs/");
  if (docsIndex >= 0) return posixKey.slice(docsIndex);
  return posixKey.startsWith("/docs/") ? posixKey : `/${posixKey.replace(/^\.?\//, "")}`;
}

export const docModules = Object.fromEntries(
  Object.entries(rawDocModules).map(([key, value]) => [normalizeDocsKey(key), value]),
);

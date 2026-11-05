/** Bounded LRU for pure content projections, never request or principal results. */
export function createPreparedContentCache<T>(maxEntries = 1024, maxCharacters = 8_000_000) {
  const entries = new Map<string, { value: T; size: number }>();
  let characters = 0;
  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: T, valueCharacters: number): void {
      const previous = entries.get(key);
      if (previous) {
        characters -= previous.size;
        entries.delete(key);
      }
      const size = key.length + valueCharacters;
      if (maxEntries < 1 || size > maxCharacters) return;
      entries.set(key, { value, size });
      characters += size;
      while (entries.size > maxEntries || characters > maxCharacters) {
        const oldest = entries.entries().next().value;
        if (!oldest) break;
        characters -= oldest[1].size;
        entries.delete(oldest[0]);
      }
    },
  };
}

/**
 * Reuse derived navigation/search data for an in-memory content map. Compare
 * source strings and order on every access so additions, removals, and in-place edits
 * invalidate every variant together. Returned values belong to the caller.
 */
export function createDocsContentMapCache(content: Record<string, string>, maxVariants = 8) {
  let sources: Array<[string, string]> = [];
  const variants = new Map<string, unknown>();
  return {
    get<T>(key: string, prepare: () => T): T {
      const files = Object.entries(content);
      if (
        files.length !== sources.length ||
        files.some(([name, raw], index) => sources[index][0] !== name || sources[index][1] !== raw)
      ) {
        sources = files;
        variants.clear();
      }
      if (variants.has(key)) {
        const value = variants.get(key) as T;
        variants.delete(key);
        variants.set(key, value);
        return structuredClone(value);
      }
      const value = prepare();
      if (maxVariants > 0) {
        variants.set(key, structuredClone(value));
        while (variants.size > maxVariants) variants.delete(variants.keys().next().value!);
      }
      return value;
    },
  };
}

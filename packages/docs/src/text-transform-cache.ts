/** Bounded LRU cache for pure text transforms. Values are immutable strings. */
export function createDocsTextTransformCache({
  maxEntries = 512,
  maxCharacters = 4_000_000,
}: { maxEntries?: number; maxCharacters?: number } = {}) {
  const entries = new Map<string, { value: string; characters: number }>();
  let characters = 0;

  return {
    get(source: string): string | undefined {
      const entry = entries.get(source);
      if (!entry) return undefined;
      entries.delete(source);
      entries.set(source, entry);
      return entry.value;
    },
    set(source: string, value: string): void {
      const previous = entries.get(source);
      if (previous) {
        entries.delete(source);
        characters -= previous.characters;
      }
      const size = source.length + (source === value ? 0 : value.length);
      if (maxEntries < 1 || size > maxCharacters) return;
      entries.set(source, { value, characters: size });
      characters += size;
      while (entries.size > maxEntries || characters > maxCharacters) {
        const oldest = entries.entries().next().value;
        if (!oldest) break;
        entries.delete(oldest[0]);
        characters -= oldest[1].characters;
      }
    },
  };
}

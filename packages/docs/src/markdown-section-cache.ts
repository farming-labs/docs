import type { DocsMarkdownSection } from "./markdown-sections.js";

type CachedSection = Omit<DocsMarkdownSection, "content"> & { start: number; end: number };

/** Retain source spans instead of duplicating nested section text in the cache. */
export function createDocsMarkdownSectionCache({
  maxEntries = 1024,
  maxCharacters = 8_000_000,
}: {
  maxEntries?: number;
  maxCharacters?: number;
} = {}) {
  const entries = new Map<
    string,
    { source: string; sections: CachedSection[]; characters: number }
  >();
  let characters = 0;

  return {
    get(source: string): DocsMarkdownSection[] | undefined {
      const entry = entries.get(source);
      if (!entry) return undefined;
      entries.delete(source);
      entries.set(source, entry);
      return entry.sections.map(({ start, end, ...section }) => ({
        ...section,
        content: entry.source.slice(start, end).trim(),
      }));
    },
    set(source: string, sections: DocsMarkdownSection[]): void {
      const previous = entries.get(source);
      if (previous) {
        characters -= previous.characters;
        entries.delete(source);
      }
      const normalized = source.replace(/\r\n/g, "\n");
      const size = sections.reduce(
        (total, section) => total + section.title.length + section.anchor.length,
        source.length + (normalized === source ? 0 : normalized.length),
      );
      if (maxEntries < 1 || size > maxCharacters) return;

      const lineStarts = [0];
      for (
        let index = normalized.indexOf("\n");
        index !== -1;
        index = normalized.indexOf("\n", index + 1)
      ) {
        lineStarts.push(index + 1);
      }
      entries.set(source, {
        source: normalized,
        sections: sections.map(({ content: _content, ...section }) => ({
          ...section,
          start: lineStarts[section.startLine - 1],
          end: lineStarts[section.endLine] ?? normalized.length,
        })),
        characters: size,
      });
      characters += size;
      while (entries.size > maxEntries || characters > maxCharacters) {
        const oldest = entries.entries().next().value;
        if (!oldest) break;
        characters -= oldest[1].characters;
        entries.delete(oldest[0]);
      }
    },
  };
}

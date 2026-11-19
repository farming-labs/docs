import { describe, expect, it } from "vitest";
import { createDocsMarkdownSectionCache } from "./markdown-section-cache.js";
import type { DocsMarkdownSection } from "./markdown-sections.js";

const sections: DocsMarkdownSection[] = [
  { title: "A", anchor: "a", explicit: false, level: 1, content: "# A", startLine: 1, endLine: 1 },
];

describe("bounded Markdown section cache", () => {
  it("selects one span and returns an independent section with normalized content", () => {
    const cache = createDocsMarkdownSectionCache({ maxEntries: 2 });
    const source = "# A\r\n## B\r\nbody\r\n";
    const child = {
      ...sections[0],
      title: "B",
      anchor: "b",
      level: 2,
      content: "## B\nbody",
      startLine: 2,
      endLine: 3,
    };
    cache.set(source, [{ ...sections[0], content: "# A\n## B\nbody", endLine: 3 }, child]);
    cache.set("# A", sections);
    const selected = cache.find(source, (spans) => {
      expect(spans.every((span) => !("content" in span))).toBe(true);
      return spans.find((span) => span.anchor === "b");
    });
    expect(selected).toEqual(child);
    selected!.title = "mutated";
    cache.set("  # A", sections);
    expect(cache.get("# A")).toBeUndefined();
    expect(cache.find(source, (spans) => spans[1])).toEqual(child);
    expect(cache.find(source, () => undefined)).toBeUndefined();
    expect(cache.find("uncached source", () => undefined)).toBeNull();
  });

  it("isolates both the stored input and returned arrays and sections", () => {
    const cache = createDocsMarkdownSectionCache();
    const input = sections.map((section) => ({ ...section }));
    cache.set("# A", input);
    input[0].anchor = "mutated";
    input[0].content = "mutated";
    input.length = 0;
    const first = cache.get("# A")!;
    expect(first).toEqual(sections);
    first[0].anchor = "mutated";
    first.length = 0;
    expect(cache.get("# A")).toEqual(sections);
  });

  it("evicts the least recently read source at the entry limit", () => {
    const cache = createDocsMarkdownSectionCache({ maxEntries: 2 });
    cache.set("# A", sections);
    cache.set(" # A", sections);
    expect(cache.get("# A")).toEqual(sections);
    cache.set("  # A", sections);
    expect(cache.get(" # A")).toBeUndefined();
    expect(cache.get("# A")).toEqual(sections);
    expect(cache.get("  # A")).toEqual(sections);
  });

  it("counts source and heading strings while storing nested section text only once", () => {
    // Entries need 5 / 6 / 7 characters: source plus title and anchor.
    const cache = createDocsMarkdownSectionCache({ maxCharacters: 12 });
    cache.set("# A", sections);
    cache.set(" # A", sections);
    expect(cache.get("# A")).toEqual(sections);
    cache.set("  # A", sections);
    expect(cache.get(" # A")).toBeUndefined();
    expect(cache.get("# A")).toEqual(sections);
    expect(cache.get("  # A")).toEqual(sections);
  });

  it("skips oversized entries without evicting useful results", () => {
    const cache = createDocsMarkdownSectionCache({ maxCharacters: 5 });
    cache.set("# A", sections);
    cache.set(" # A", sections);
    expect(cache.get(" # A")).toBeUndefined();
    expect(cache.get("# A")).toEqual(sections);
  });

  it("accounts for replacement entries and caches documents without headings", () => {
    const cache = createDocsMarkdownSectionCache({ maxCharacters: 9 });
    cache.set("one", sections);
    cache.set("one", []);
    cache.set("two", []);
    cache.set("tri", []);
    expect(cache.get("one")).toEqual([]);
    expect(cache.get("two")).toEqual([]);
    expect(cache.get("tri")).toEqual([]);
  });

  it("restores normalized nested content and accounts for retained CRLF source", () => {
    const source = "# A\r\n\r\n## B\r\n\r\nBody.\r\n";
    const nested: DocsMarkdownSection[] = [
      { ...sections[0], content: "# A\n\n## B\n\nBody.", endLine: 6 },
      {
        title: "B",
        anchor: "b",
        explicit: false,
        level: 2,
        content: "## B\n\nBody.",
        startLine: 3,
        endLine: 6,
      },
    ];
    const size = source.length + source.replaceAll("\r\n", "\n").length + 4;
    const cache = createDocsMarkdownSectionCache({ maxCharacters: size });
    cache.set(source, nested);
    expect(cache.get(source)).toEqual(nested);
    cache.set("# A", sections);
    expect(cache.get(source)).toBeUndefined();
  });
});

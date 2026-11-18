import { describe, expect, it } from "vitest";
import { createSimpleSearchAdapter } from "./search.js";
import type { DocsSearchAdapterContext } from "./types.js";

describe("simple search query preparation", () => {
  it.each([
    [" NEEDLE?! ", "Needle?! ", 5670],
    ["needle", "Needle?! ", 4645],
    [" ÉCLAIR... ", "Éclair... ", 5670],
    [" 東京?! ", "東京?! ", 5670],
    ["C++", "C++", 1144],
    ["the and", "the and", 1144],
    ["foo.bar", "foo.bar", 5676],
    ["[needle]", "[needle]", 1164],
  ])("preserves literal ranking for %j", async (query, text, score) => {
    const results = await createSimpleSearchAdapter().search(
      { query },
      {
        pages: [],
        deferSourceProvenance: true,
        documents: [
          {
            id: "literal",
            url: "/docs/guide#section",
            title: "Guide",
            section: text,
            content: text,
            description: text,
            type: "heading",
          },
        ],
      },
    );
    expect(results).toMatchObject([{ id: "literal", score }]);
  });

  it("constructs one literal matcher per query regardless of document count", async () => {
    const context: DocsSearchAdapterContext = {
      pages: [],
      deferSourceProvenance: true,
      documents: Array.from({ length: 64 }, (_, index) => ({
        id: `section-${index}`,
        url: `/docs/guide#section-${index}`,
        title: "Guide",
        section: `Section ${index}`,
        content: `A needle appears in section ${index}.`,
        description: "Find the needle in this guide.",
        type: "heading",
      })),
    };
    const originalRegExp = globalThis.RegExp;
    const patterns: string[] = [];
    globalThis.RegExp = new Proxy(originalRegExp, {
      construct(target, args) {
        if (args[1] === "u" && String(args[0]).includes("[^\\p{L}\\p{N}]")) {
          patterns.push(String(args[0]));
        }
        return Reflect.construct(target, args);
      },
    });

    try {
      const results = await createSimpleSearchAdapter().search(
        { query: "needle", limit: 64 },
        context,
      );
      expect(results).toHaveLength(64);
      expect(new Set(patterns).size).toBe(1);
      expect(patterns).toHaveLength(1);
    } finally {
      globalThis.RegExp = originalRegExp;
    }
  });
});

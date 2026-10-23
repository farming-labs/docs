import { describe, expect, it } from "vitest";
import { createDocsTextTransformCache } from "./text-transform-cache.js";

describe("text transform cache", () => {
  it("retains empty results and keys by the complete source", () => {
    const cache = createDocsTextTransformCache();
    cache.set("hidden", "");
    expect(cache.get("hidden")).toBe("");
    expect(cache.get("changed hidden")).toBeUndefined();
  });

  it("evicts the least recently read entry", () => {
    const cache = createDocsTextTransformCache({ maxEntries: 2 });
    cache.set("a", "A");
    cache.set("b", "B");
    expect(cache.get("a")).toBe("A");
    cache.set("c", "C");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
  });

  it("bounds retained source and output text, including replacement entries", () => {
    const cache = createDocsTextTransformCache({ maxCharacters: 6 });
    cache.set("abc", "abc");
    cache.set("def", "def");
    expect(cache.get("abc")).toBe("abc");
    cache.set("abc", "ABC");
    expect(cache.get("def")).toBeUndefined();
    expect(cache.get("abc")).toBe("ABC");
    cache.set("too large", "result");
    expect(cache.get("too large")).toBeUndefined();
    expect(cache.get("abc")).toBe("ABC");
  });

  it("supports disabling retention", () => {
    const cache = createDocsTextTransformCache({ maxEntries: 0 });
    cache.set("a", "A");
    expect(cache.get("a")).toBeUndefined();
  });
});

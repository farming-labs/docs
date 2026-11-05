import { describe, expect, it, vi } from "vitest";
import { createDocsContentMapCache, createPreparedContentCache } from "./prepared-content-cache.js";
import { buildDocsSearchDocuments } from "./search.js";
import type { DocsSearchSourcePage } from "./types.js";

describe("prepared content", () => {
  it("bounds retention by entry count and characters with LRU eviction", () => {
    const cache = createPreparedContentCache<number>(2, 8);
    cache.set("a", 1, 1);
    cache.set("b", 2, 1);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3, 1);
    expect(cache.get("b")).toBeUndefined();
    cache.set("big", 4, 10);
    expect(cache.get("big")).toBeUndefined();
    cache.set("d", 5, 5);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("shares a snapshot but invalidates all variants on edits, additions and removals", () => {
    const files: Record<string, string> = { "page.md": "first" };
    const cache = createDocsContentMapCache(files);
    const prepare = vi.fn(() => ({ names: Object.values(files) }));
    const first = cache.get("nav", prepare);
    first.names.push("poison");
    expect(cache.get("nav", prepare)).toEqual({ names: ["first"] });
    expect(prepare).toHaveBeenCalledTimes(1);
    cache.get("search", prepare);
    files["page.md"] = "updated";
    expect(cache.get("nav", prepare).names).toEqual(["updated"]);
    expect(cache.get("search", prepare).names).toEqual(["updated"]);
    files["fr/page.md"] = "French";
    expect(cache.get("nav", prepare).names).toEqual(["updated", "French"]);
    delete files["page.md"];
    expect(cache.get("search", prepare).names).toEqual(["French"]);
  });

  it("keeps cached search projections isolated across callers, scopes, locales, and edits", () => {
    const page: DocsSearchSourcePage = {
      url: "/docs/prepared",
      title: "Prepared",
      description: "First description",
      content: "unused",
      rawContent: "# Start\n\n<Human>Human text</Human>\n<Agent>Agent text</Agent>",
      tags: ["first"],
      framework: "react",
      version: "1",
      locale: "en",
      agent: { appliesTo: { package: ["original-package"] } },
    };
    const first = buildDocsSearchDocuments([page]);
    const expected = structuredClone(first);
    first[0].title = "poison";
    first[0].tags!.push("poison");
    first[0].package!.push("poison");
    first.pop();
    expect(buildDocsSearchDocuments([structuredClone(page)])).toEqual(expected);
    const agent = buildDocsSearchDocuments([page], {}, "agent");
    expect(agent[0].content).toContain("Agent text");
    expect(agent[0].content).not.toContain("Human text");
    page.rawContent = "# Changed\n\nNew content";
    page.title = "New title";
    page.description = "New description";
    page.tags!.push("second");
    page.agent!.appliesTo!.package = ["new-package"];
    page.locale = "fr";
    page.framework = "vue";
    page.version = "2";
    const changed = buildDocsSearchDocuments([page], { strategy: "page" });
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({
      title: "New title",
      description: "New description",
      locale: "fr",
      url: "/docs/prepared?lang=fr",
      framework: "vue",
      version: "2",
      tags: ["first", "second"],
      package: ["new-package"],
    });
    expect(changed[0].content).toContain("New content");
    expect(buildDocsSearchDocuments([])).toEqual([]);
  });
  it("keys only the projected contract and scope, including agent source edits", () => {
    const extra: Record<string, unknown> = {};
    extra.self = extra;
    const page: DocsSearchSourcePage = {
      url: "/docs/cyclic-extra",
      title: "Extra metadata",
      content: "Human content",
      agentRawContent: "# Agent\n\nFirst agent source",
      agent: { appliesTo: { framework: "react", ...extra }, ...extra },
    };
    expect(buildDocsSearchDocuments([page], {}, "agent")[0].content).toContain(
      "First agent source",
    );
    page.agentRawContent = "# Agent\n\nUpdated agent source";
    expect(buildDocsSearchDocuments([page], {}, "agent")[0].content).toContain(
      "Updated agent source",
    );
    expect(buildDocsSearchDocuments([page])[0].content).toContain("Human content");
  });
  it("invalidates when unchanged source files are reordered", () => {
    const files: Record<string, string> = { first: "same", second: "same" };
    const cache = createDocsContentMapCache(files);
    expect(cache.get("order", () => Object.keys(files))).toEqual(["first", "second"]);
    delete files.first;
    files.first = "same";
    expect(cache.get("order", () => Object.keys(files))).toEqual(["second", "first"]);
  });
});

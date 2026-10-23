import { describe, expect, it } from "vitest";
import { createDocsServer } from "./server.js";
import type { OrderingItem } from "@farming-labs/docs";

const home = "---\ntitle: Home\n---\n# Home";

function server(content: Record<string, string>, ordering?: "numeric" | OrderingItem[]) {
  return createDocsServer({ entry: "docs", ordering, _preloadedContent: content });
}

describe("bundled navigation indexing", () => {
  it.each([false, true])("avoids per-node descendant scans (nested: %s)", async (nested) => {
    const content: Record<string, string> = { "/docs/page.md": home };
    const count = 100;
    for (let i = 0; i < count; i++) {
      content[nested ? `/docs/group-${i}/guide/page.md` : `/docs/page-${i}.md`] = `# Page ${i}`;
    }
    const docs = server(content);
    let checks = 0;
    const original = Array.prototype.some;
    // Count descendant comparisons separately from elapsed-time benchmarks.
    Array.prototype.some = function (callback, thisArg) {
      if (Array.isArray(this[0]?.parts)) {
        return original.call(this, (value, index, array) => {
          checks++;
          return callback.call(thisArg, value, index, array);
        });
      }
      return original.call(this, callback, thisArg);
    };
    try {
      const page = await docs.load({ pathname: "/docs" });
      expect(page.tree.children).toHaveLength(count + 1);
      expect(checks).toBeLessThanOrEqual(count * 5);
    } finally {
      Array.prototype.some = original;
    }
  });

  it("indexes explicit order lookups across sibling folders", async () => {
    const content: Record<string, string> = { "/docs/page.md": home };
    const ordering: OrderingItem[] = [];
    const count = 100;
    let slugReads = 0;
    for (let i = 0; i < count; i++) {
      content[`/docs/group-${i}/guide/page.md`] = `# Guide ${i}`;
      ordering.push({
        get slug() {
          slugReads++;
          return `group-${i}`;
        },
        children: [{ slug: "guide" }],
      });
    }
    const docs = server(content, ordering);
    slugReads = 0;
    const page = await docs.load({ pathname: "/docs" });
    expect(page.tree.children).toHaveLength(count + 1);
    expect(slugReads).toBeLessThanOrEqual(count * 10);
  });

  it("preserves first index precedence, explicit duplicates, nested overrides, and implicit folders", async () => {
    const docs = server(
      {
        "/docs/index.md": "---\ntitle: First root\n---\n# First root",
        "/docs/page.md": home,
        "/docs/guide/index.md": "---\ntitle: First guide\nicon: Book\n---\n# First guide",
        "/docs/guide/page.md": "---\ntitle: Second guide\n---\n# Second guide",
        "/docs/guide/alpha.md": "---\ntitle: Alpha\n---\n# Alpha",
        "/docs/guide/zeta.md": "---\ntitle: Zeta\n---\n# Zeta",
        "/docs/reference/api/read.md": "---\ntitle: Read\n---\n# Read",
        "/docs/extra.md": "---\ntitle: Extra\n---\n# Extra",
        "/other/ignored.md": "# Ignored",
      },
      [
        { slug: "missing" },
        { slug: "guide", children: [{ slug: "zeta" }, { slug: "alpha" }] },
        { slug: "guide", children: [{ slug: "alpha" }] },
      ],
    );
    const page = await docs.load({ pathname: "/docs" });
    expect(page.tree.children.map((node) => node.name)).toEqual([
      "First root",
      "First guide",
      "First guide",
      "Extra",
      "Reference",
    ]);
    expect(page.tree.children[1]).toEqual(page.tree.children[2]);
    expect(page.tree.children[1]).toMatchObject({
      type: "folder",
      icon: "Book",
      index: { name: "First guide", url: "/docs/guide" },
      children: [{ name: "Zeta" }, { name: "Alpha" }],
    });
    expect(page.flatPages.map((node) => node.url)).toEqual([
      "/docs",
      "/docs/guide",
      "/docs/guide/zeta",
      "/docs/guide/alpha",
      "/docs/guide",
      "/docs/guide/zeta",
      "/docs/guide/alpha",
      "/docs/extra",
      "/docs/reference/api/read",
    ]);
  });

  it("preserves numeric ties and keeps source instances independent", async () => {
    const content = {
      "/docs/page.md": home,
      "/docs/zeta.md": "---\ntitle: Zeta\norder: 1\n---\n# Zeta",
      "/docs/alpha.md": "---\ntitle: Alpha\norder: 1\n---\n# Alpha",
      "/docs/guide/page.md": "---\ntitle: Guide\norder: 0\n---\n# Guide",
    };
    const docs = server(content, "numeric");
    expect((await docs.load({ pathname: "/docs" })).flatPages.map((node) => node.name)).toEqual([
      "Home",
      "Guide",
      "Alpha",
      "Zeta",
    ]);
    content["/docs/zeta.md"] = "---\ntitle: Changed\norder: -1\n---\n# Changed";
    expect(
      (await server(content, "numeric").load({ pathname: "/docs" })).flatPages.map(
        (node) => node.name,
      ),
    ).toEqual(["Home", "Changed", "Guide", "Alpha"]);
  });

  it("keeps empty slug segments distinct from root indexes", async () => {
    const page = await server({
      "/docs/page.md": home,
      "/docs/.md": "---\ntitle: Empty leaf\n---\n# Empty leaf",
      "/docs/folder/.md": "---\ntitle: Empty child\n---\n# Empty child",
    }).load({ pathname: "/docs" });
    expect(page.tree.children).toMatchObject([
      { type: "page", name: "Home" },
      { type: "page", name: "Empty leaf", url: "/docs" },
      { type: "folder", name: "Folder", children: [{ name: "Empty child", url: "/docs/folder/" }] },
    ]);
  });

  it("names a folder from a hidden index without linking it, and leaves hidden pages out, as on Next.js", async () => {
    const docs = server({
      "/docs/page.md": home,
      "/docs/reference/page.md": "---\ntitle: API Reference\nhidden: true\n---\n",
      "/docs/reference/hooks/page.md": "---\ntitle: Hooks\n---\n# Hooks",
      "/docs/drafts/page.md": "---\ntitle: Drafts\nhidden: true\n---\n",
      "/docs/guide/page.md": "---\ntitle: Guide\n---\n# Guide",
    });
    const { tree } = await docs.load({ pathname: "/docs" });
    const reference = tree.children.find((node) => node.name === "API Reference");

    expect(reference).toMatchObject({ type: "folder", children: [{ name: "Hooks" }] });
    expect((reference as { index?: unknown } | undefined)?.index).toBeUndefined();
    expect(tree.children.map((node) => node.name)).not.toContain("Drafts");
    expect(tree.children.map((node) => node.name)).toContain("Guide");
  });
});

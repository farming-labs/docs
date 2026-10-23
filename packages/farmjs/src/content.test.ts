import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flattenNavTree, loadDocsNavTree } from "./content.js";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "farm-docs-nav-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

function write(name: string, content: string) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

describe("filesystem docs navigation", () => {
  it("reads each source once while retaining numeric order, nested metadata and index precedence", () => {
    write("page.md", "---\ntitle: Home\nicon: House\n---\n# Home");
    write("index.mdx", "---\ntitle: Alternate root\n---\n# Alternate");
    write("zeta.mdx", "---\ntitle: Zeta\norder: 1\n---\n# Zeta");
    write("alpha.md", "---\ntitle: Alpha\norder: 1\n---\n# Alpha");
    write(
      "guide/page.mdx",
      "---\ntitle: Guide\norder: 0\nicon: Book\nsidebar:\n  folderIndexBehavior: hidden\n---\n# Guide",
    );
    write("guide/index.md", "---\ntitle: Alternate guide\n---\n# Alternate");
    write("guide/first.md", "---\ntitle: First\norder: 0\n---\n# First");
    write("guide/second.mdx", "---\ntitle: Second\norder: 2\n---\n# Second");
    write("guide/agent.md", "# Agent instructions");
    write("notes.txt", "Not a navigation page");

    const read = vi.spyOn(fs, "readFileSync");
    const stat = vi.spyOn(fs, "statSync");
    const tree = loadDocsNavTree(root, "guides", "numeric");

    expect(tree.children).toEqual([
      { type: "page", name: "Home", url: "/guides", icon: "House" },
      {
        type: "folder",
        name: "Guide",
        icon: "Book",
        folderIndexBehavior: "hidden",
        index: { type: "page", name: "Guide", url: "/guides/guide", icon: "Book" },
        children: [
          { type: "page", name: "First", url: "/guides/guide/first", icon: undefined },
          { type: "page", name: "Second", url: "/guides/guide/second", icon: undefined },
        ],
      },
      { type: "page", name: "Alpha", url: "/guides/alpha", icon: undefined },
      { type: "page", name: "Zeta", url: "/guides/zeta", icon: undefined },
    ]);
    const sources = read.mock.calls
      .map(([file]) => String(file))
      .filter((file) => file.startsWith(root));
    expect(sources).toHaveLength(9);
    expect(new Set(sources).size).toBe(sources.length);
    const statPaths = stat.mock.calls.map(([file]) => String(file));
    expect(statPaths).toHaveLength(11);
    expect(new Set(statPaths).size).toBe(statPaths.length);
  });

  it.each(["alphabetical", "numeric"] as const)(
    "observes edits, additions and deletions on subsequent loads with %s ordering",
    (ordering) => {
      const firstFile = write("first.md", "---\ntitle: Before\norder: 2\n---\n# Before");
      const removedFile = write("second.md", "# Remove me");
      const first = loadDocsNavTree(root, "docs", ordering);
      first.children[0].name = "Mutated caller result";
      write("first.md", "---\ntitle: After\norder: 0\n---\n# After");
      write("third.mdx", "---\ntitle: Third\norder: 1\n---\n# Third");
      fs.unlinkSync(removedFile);

      const read = vi.spyOn(fs, "readFileSync");
      const second = loadDocsNavTree(root, "docs", ordering);
      expect(flattenNavTree(second).map((page) => [page.name, page.url])).toEqual([
        ["After", "/docs/first"],
        ["Third", "/docs/third"],
      ]);
      expect(read.mock.calls.filter(([file]) => file === firstFile)).toHaveLength(1);
      expect(read.mock.calls.some(([file]) => file === removedFile)).toBe(false);
    },
  );

  it("names a folder from a hidden index without linking it, and leaves hidden pages out, as on Next.js", () => {
    write("page.md", "---\ntitle: Home\n---\n# Home");
    write("reference/page.md", "---\ntitle: API Reference\nhidden: true\n---\n");
    write("reference/hooks/page.md", "---\ntitle: Hooks\n---\n# Hooks");
    write("drafts/page.md", "---\ntitle: Drafts\nhidden: true\n---\n");
    write("notes.md", "---\ntitle: Notes\nhidden: true\n---\n");
    write("guide/page.md", "---\ntitle: Guide\n---\n# Guide");

    const tree = loadDocsNavTree(root, "docs");
    const reference = tree.children.find((node) => node.name === "API Reference");

    expect(reference).toMatchObject({ type: "folder", children: [{ name: "Hooks" }] });
    expect((reference as { index?: unknown } | undefined)?.index).toBeUndefined();
    const names = tree.children.map((node) => node.name);
    expect(names).not.toContain("Drafts");
    expect(names).not.toContain("Notes");
    expect(names).toContain("Guide");
  });

  it("preserves explicit ordering, nested overrides and unlisted entries", () => {
    write("guide/page.md", "---\ntitle: Guide\n---\n# Guide");
    write("guide/one.md", "# One");
    write("guide/two.mdx", "# Two");
    write("extra.md", "# Extra");
    const tree = loadDocsNavTree(root, "docs", [
      { slug: "guide", children: [{ slug: "two" }, { slug: "one" }] },
    ]);
    expect(flattenNavTree(tree).map((page) => page.url)).toEqual([
      "/docs/guide",
      "/docs/guide/two",
      "/docs/guide/one",
      "/docs/extra",
    ]);
  });

  it("indexes explicit ordering without scanning directory entries for each item", () => {
    const count = 100;
    const ordering = Array.from({ length: count }, (_, i) => {
      write(`page-${i}.md`, `# Page ${i}`);
      return { slug: `page-${i}` };
    });
    const original = fs.readdirSync;
    let entryReads = 0;
    vi.spyOn(fs, "readdirSync").mockImplementation(((...args: unknown[]) => {
      const entries = Reflect.apply(original, fs, args);
      return new Proxy(entries, {
        get(target, property, receiver) {
          if (typeof property === "string" && /^\d+$/.test(property)) entryReads++;
          return Reflect.get(target, property, receiver);
        },
      });
    }) as typeof original);
    expect(flattenNavTree(loadDocsNavTree(root, "docs", ordering))).toHaveLength(count);
    expect(entryReads).toBeLessThanOrEqual(count * 5);
  });

  it("preserves first matching filenames and duplicate explicit folder overrides", () => {
    write("guide/page.md", "---\ntitle: Guide folder\n---\n# Guide");
    write("guide.md", "---\ntitle: Guide file\n---\n# Guide file");
    write("guide/alpha.md", "# Alpha");
    write("guide/zeta.md", "# Zeta");
    write("extra.md", "---\ntitle: First file\n---\n# First file");
    write("extra.mdx", "---\ntitle: Second file\n---\n# Second file");
    const tree = loadDocsNavTree(root, "docs", [
      { slug: "missing" },
      { slug: "guide", children: [{ slug: "zeta" }, { slug: "alpha" }] },
      { slug: "guide", children: [{ slug: "alpha" }, { slug: "zeta" }] },
      { slug: "extra" },
    ]);
    expect(flattenNavTree(tree).map((page) => [page.name, page.url])).toEqual([
      ["Guide folder", "/docs/guide"],
      ["Zeta", "/docs/guide/zeta"],
      ["Alpha", "/docs/guide/alpha"],
      ["Guide folder", "/docs/guide"],
      ["Alpha", "/docs/guide/alpha"],
      ["Zeta", "/docs/guide/zeta"],
      ["First file", "/docs/extra"],
    ]);
  });

  it("keeps symbolic file and folder navigation working", () => {
    const file = write("source.md", "---\ntitle: Source\norder: 1\n---\n# Source");
    write("nested/page.md", "---\ntitle: Nested\norder: 0\n---\n# Nested");
    fs.symlinkSync(file, path.join(root, "linked.md"));
    fs.symlinkSync(path.join(root, "nested"), path.join(root, "linked-folder"), "dir");
    expect(
      flattenNavTree(loadDocsNavTree(root, "docs", "numeric")).map((page) => page.url),
    ).toEqual(["/docs/linked-folder", "/docs/nested", "/docs/linked", "/docs/source"]);
  });

  it("preserves parse errors and reads repaired content on the next load", () => {
    write("broken.md", "---\ntitle: [unfinished\n---\n# Broken");
    expect(() => loadDocsNavTree(root, "docs", "numeric")).toThrow();
    write("broken.md", "---\ntitle: Repaired\n---\n# Repaired");
    expect(flattenNavTree(loadDocsNavTree(root, "docs", "numeric"))[0].name).toBe("Repaired");
  });
});

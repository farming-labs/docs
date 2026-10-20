import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFilesystemDocsMcpSource } from "./mcp.js";
import type { OrderingItem } from "./types.js";

const roots: string[] = [];

function project(files: Record<string, string>, ordering?: "numeric" | OrderingItem[]) {
  const rootDir = mkdtempSync(join(tmpdir(), "docs-navigation-"));
  roots.push(rootDir);
  for (const [name, source] of Object.entries(files)) {
    const file = join(rootDir, "docs", name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
  }
  return createFilesystemDocsMcpSource({ rootDir, ordering });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("filesystem navigation indexing", () => {
  it("keeps empty sources and trailing-empty-slug folders unchanged", async () => {
    expect((await project({}).getNavigation()).children).toEqual([]);
    expect((await project({ "folder/.md": "# Empty slug" }).getNavigation()).children).toEqual([
      { type: "folder", name: "Folder", icon: undefined, index: undefined, children: [] },
    ]);
  });

  it.each([false, true])("does not rescan all pages for each node (nested: %s)", async (nested) => {
    const count = 100;
    const source = project(
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [
          nested ? `group-${index}/guide/page.md` : `page-${index}.md`,
          `---\ntitle: Page ${index}\n---\n# Page ${index}`,
        ]),
      ),
    );
    const pages = await source.getPages();
    let slugReads = 0;
    for (const page of pages) {
      const slug = page.slug;
      Object.defineProperty(page, "slug", {
        get() {
          slugReads++;
          return slug;
        },
      });
    }
    const tree = await source.getNavigation();
    expect(tree.children).toHaveLength(count);
    expect(slugReads).toBeLessThanOrEqual(count * 3);
    const previousReads = slugReads;
    expect(await source.getNavigation()).toBe(tree);
    expect(slugReads).toBe(previousReads);
  });

  it("preserves roots, implicit folders, indexes, metadata, and explicit child ordering", async () => {
    const source = project(
      {
        "page.md": "---\ntitle: Home\nicon: House\ndescription: Start here\n---",
        "guide/page.md": "---\ntitle: Guide\nicon: Book\ndescription: Learn\n---",
        "guide/alpha.md": "---\ntitle: Alpha\n---",
        "guide/zeta.md": "---\ntitle: Zeta\n---",
        "reference/nested/api.md": "---\ntitle: API\n---",
        "extra.md": "---\ntitle: Extra\n---",
      },
      [
        { slug: "missing" },
        { slug: "guide", children: [{ slug: "zeta" }, { slug: "alpha" }] },
        { slug: "reference" },
      ],
    );
    const tree = await source.getNavigation();
    expect(tree.children).toEqual([
      { type: "page", name: "Home", url: "/docs", icon: "House", description: "Start here" },
      {
        type: "folder",
        name: "Guide",
        icon: "Book",
        index: {
          type: "page",
          name: "Guide",
          url: "/docs/guide",
          icon: "Book",
          description: "Learn",
        },
        children: [
          {
            type: "page",
            name: "Zeta",
            url: "/docs/guide/zeta",
            icon: undefined,
            description: undefined,
          },
          {
            type: "page",
            name: "Alpha",
            url: "/docs/guide/alpha",
            icon: undefined,
            description: undefined,
          },
        ],
      },
      {
        type: "folder",
        name: "Reference",
        icon: undefined,
        index: undefined,
        children: [
          {
            type: "folder",
            name: "Nested",
            icon: undefined,
            index: undefined,
            children: [
              {
                type: "page",
                name: "API",
                url: "/docs/reference/nested/api",
                icon: undefined,
                description: undefined,
              },
            ],
          },
        ],
      },
      { type: "page", name: "Extra", url: "/docs/extra", icon: undefined, description: undefined },
    ]);
  });

  it("does not search the complete explicit ordering for every folder", async () => {
    const count = 100;
    let orderReads = 0;
    const ordering = Array.from({ length: count }, (_, index) => ({
      get slug() {
        orderReads++;
        return `group-${index}`;
      },
      children: [{ slug: "zeta" }],
    }));
    const source = project(
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`group-${index}/zeta.md`, "# Zeta"]),
      ),
      ordering,
    );
    const tree = await source.getNavigation();
    expect(tree.children).toHaveLength(count);
    expect(orderReads).toBeLessThanOrEqual(count * 10);
  });

  it("retains numeric order, alphabetical ties, and last-page-wins duplicate slugs", async () => {
    const source = project(
      {
        "guide/page.md": "---\ntitle: Earlier\norder: 9\n---",
        "guide/page.mdx": "---\ntitle: Later\norder: 0\n---",
        "guide/child.md": "# Child",
        "beta.md": "---\norder: 2\n---",
        "alpha.md": "---\norder: 2\n---",
        "last.md": "# Last",
      },
      "numeric",
    );
    expect((await source.getNavigation()).children.map((node) => node.name)).toEqual([
      "Later",
      "Alpha",
      "Beta",
      "Last",
    ]);
  });

  it("keeps the first explicit folder override when the ordering repeats a slug", async () => {
    const source = project({ "guide/alpha.md": "# Alpha", "guide/zeta.md": "# Zeta" }, [
      { slug: "guide", children: [{ slug: "zeta" }] },
      { slug: "guide", children: [{ slug: "alpha" }] },
    ]);
    const tree = await source.getNavigation();
    expect(tree.children).toHaveLength(2);
    for (const node of tree.children) {
      expect(node.type === "folder" && node.children.map((child) => child.name)).toEqual([
        "Zeta",
        "Alpha",
      ]);
    }
  });
});

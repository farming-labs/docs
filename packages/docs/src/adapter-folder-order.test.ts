import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";

it.each(["astro", "nuxt", "svelte", "tanstack-start"])(
  "%s reads each numeric folder index once per navigation load",
  async (adapter) => {
    const { loadDocsNavTree } = await import(`../../${adapter}/src/content.ts`);
    const dir = fs.mkdtempSync(path.join(tmpdir(), "docs-folder-order-"));
    const pagePath = (slug: string) => path.join(dir, slug, "page.mdx");
    const writePage = (slug: string, order: number) =>
      fs.writeFileSync(pagePath(slug), `---\ntitle: ${slug}\norder: ${order}\n---\n# Example`);
    const read = vi.spyOn(fs, "readFileSync");
    try {
      for (const slug of ["a", "b"]) fs.mkdirSync(path.join(dir, slug));
      writePage("a", 2);
      writePage("b", 1);
      expect(loadDocsNavTree(dir, "docs", "numeric").children).toMatchObject([
        { name: "b" },
        { name: "a" },
      ]);
      for (const slug of ["a", "b"]) {
        expect(read.mock.calls.filter(([file]) => file === pagePath(slug))).toHaveLength(1);
      }

      writePage("a", 0);
      expect(loadDocsNavTree(dir, "docs", "numeric").children).toMatchObject([
        { name: "a" },
        { name: "b" },
      ]);
      fs.unlinkSync(pagePath("b"));
      expect(loadDocsNavTree(dir, "docs", "numeric").children).toMatchObject([{ name: "a" }]);
    } finally {
      read.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

it.each(["astro", "nuxt", "svelte", "tanstack-start"])(
  "%s lists each indexed directory once and follows directory symlinks",
  async (adapter) => {
    const { loadDocsNavTree } = await import(`../../${adapter}/src/content.ts`);
    const root = fs.mkdtempSync(path.join(tmpdir(), "docs-nav-walk-"));
    const folder = path.join(root, "group");
    const nested = path.join(folder, "child");
    const alias = path.join(root, "alias");
    const list = vi.spyOn(fs, "readdirSync");
    try {
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(folder, "page.mdx"), "\uFEFF---\r\ntitle: Référence\r\n---\r\n");
      fs.writeFileSync(path.join(nested, "page.md"), "");
      fs.symlinkSync(folder, alias, "junction");
      for (const ordering of ["alphabetical", "numeric", [{ slug: "group" }]]) {
        list.mockClear();
        const tree = loadDocsNavTree(root, "docs", ordering);
        expect(tree.children).toMatchObject([
          { name: "Référence", children: [{ name: "Child" }] },
          { name: "Référence", children: [{ name: "Child" }] },
        ]);
        for (const dir of [root, folder, nested, alias, path.join(alias, "child")]) {
          expect(list.mock.calls.filter(([file]) => file === dir)).toHaveLength(1);
        }
      }
    } finally {
      list.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

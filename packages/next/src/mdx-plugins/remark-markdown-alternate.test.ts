import { describe, expect, it } from "vitest";
import remarkMarkdownAlternate from "./remark-markdown-alternate.js";

describe("remarkMarkdownAlternate", () => {
  it("adds a text/markdown alternate URL for docs page routes", () => {
    const tree = {
      children: [{ type: "yaml", value: 'title: "Install"' }],
    };
    const transform = remarkMarkdownAlternate({ entry: "docs", contentDir: "app/docs" });

    transform(tree, { path: "/repo/app/docs/install/page.mdx" });

    expect(tree.children[0]?.value).toContain("alternates:");
    expect(tree.children[0]?.value).toContain('text/markdown: "/docs/install.md"');
  });

  it("adds root docs markdown alternate URLs", () => {
    const tree = {
      children: [{ type: "yaml", value: 'title: "Docs"' }],
    };
    const transform = remarkMarkdownAlternate({ entry: "docs", contentDir: "app/docs" });

    transform(tree, { path: "/repo/app/docs/page.mdx" });

    expect(tree.children[0]?.value).toContain('text/markdown: "/docs.md"');
  });

  it("adds root-mounted markdown alternate URLs when docsPath is empty", () => {
    const tree = {
      children: [{ type: "yaml", value: 'title: "Install"' }],
    };
    const transform = remarkMarkdownAlternate({
      entry: "docs",
      contentDir: "app/docs",
      docsPath: "",
    });

    transform(tree, { path: "/repo/app/docs/install/page.mdx" });

    expect(tree.children[0]?.value).toContain('text/markdown: "/install.md"');
  });

  it("keeps /docs.md as the root markdown URL when docsPath is empty", () => {
    const tree = {
      children: [{ type: "yaml", value: 'title: "Docs"' }],
    };
    const transform = remarkMarkdownAlternate({
      entry: "docs",
      contentDir: "app/docs",
      docsPath: "",
    });

    transform(tree, { path: "/repo/app/docs/page.mdx" });

    expect(tree.children[0]?.value).toContain('text/markdown: "/docs.md"');
  });

  it.each(["", "/", "///"])("treats docsPath %s as root-mounted docs", (docsPath) => {
    const tree = {
      children: [{ type: "yaml", value: 'title: "Install"' }],
    };
    const transform = remarkMarkdownAlternate({
      entry: "docs",
      contentDir: "app/docs",
      docsPath,
    });

    transform(tree, { path: "/repo/app/docs/install/page.mdx" });

    expect(tree.children[0]?.value).toContain('text/markdown: "/install.md"');
  });

  it.each(["docs", "/docs", "docs/", "/docs/"])(
    "normalizes docsPath %s to the default docs route",
    (docsPath) => {
      const tree = {
        children: [{ type: "yaml", value: 'title: "Install"' }],
      };
      const transform = remarkMarkdownAlternate({
        entry: "docs",
        contentDir: "app/docs",
        docsPath,
      });

      transform(tree, { path: "/repo/app/docs/install/page.mdx" });

      expect(tree.children[0]?.value).toContain('text/markdown: "/docs/install.md"');
    },
  );

  it("handles relative source paths", () => {
    const tree = {
      children: [{ type: "yaml", value: 'title: "Quickstart"' }],
    };
    const transform = remarkMarkdownAlternate({ entry: "docs", contentDir: "app/docs" });

    transform(tree, { path: "app/docs/quickstart/page.md" });

    expect(tree.children[0]?.value).toContain('text/markdown: "/docs/quickstart.md"');
  });

  it("does not overwrite custom alternates", () => {
    const tree = {
      children: [
        {
          type: "yaml",
          value: 'title: "Install"\nalternates:\n  canonical: "/custom"',
        },
      ],
    };
    const transform = remarkMarkdownAlternate({ entry: "docs", contentDir: "app/docs" });

    transform(tree, { path: "/repo/app/docs/install/page.mdx" });

    expect(tree.children[0]?.value).not.toContain("text/markdown");
  });
});

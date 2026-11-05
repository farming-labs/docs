import { describe, expect, it } from "vitest";
import { createDocsServer } from "../src/server.js";

const page = (title: string, extra = "") => `---\ntitle: ${title}\n${extra}---\n# ${title}`;
const content = {
  "/docs/page.md": page("Root"),
  "/docs/a/index.mdx": page("First A"),
  "/docs/a/page.md": page("Second A"),
  "/docs/a/one/page.md": page("One", "order: 2\n"),
  "/docs/a/two/page.md": page("Two", "order: 1\n"),
  "/docs/b/page.md": page("B", "sidebar:\n  folderIndexBehavior: hidden\n"),
  "/docs/b/missing/deep/page.md": page("Deep"),
  "/docs/orphan/deep/page.md": page("Orphan"),
  "/docs/__proto__/page.md": page("Prototype"),
  "/docs/a/agent.md": page("Agent override"),
  "/docs-fr/page.md": page("Other prefix"),
};

function createNavigationLoader(options: Record<string, unknown> = {}) {
  const server = createDocsServer({
    entry: "docs",
    contentDir: "docs",
    telemetry: false,
    sidebar: { folderIndexBehavior: "link" },
    _preloadedContent: content,
    ...options,
  });
  return (locale?: string) => server.load({ pathname: "/docs", locale });
}

function loadNavigation(options: Record<string, unknown> = {}, locale?: string) {
  return createNavigationLoader(options)(locale);
}

describe("bundled navigation", () => {
  it("retains duplicate index pages, orphan behavior, and folder overrides", async () => {
    const { tree } = await loadNavigation();
    expect(tree.children.map((node) => node.name)).toEqual([
      "Root",
      "Prototype",
      "First A",
      "Second A",
      "B",
    ]);
    const firstA = tree.children[2];
    expect(firstA).toMatchObject({
      type: "folder",
      index: { name: "First A", url: "/docs/a" },
      children: [{ name: "One" }, { name: "Two" }],
    });
    expect(tree.children[3]).toMatchObject({
      type: "folder",
      index: { name: "Second A", url: "/docs/a" },
      children: [{ name: "One" }, { name: "Two" }],
    });
    expect(tree.children[4]).toMatchObject({ type: "folder", children: [] });
    expect(tree.children[4]).not.toHaveProperty("index", expect.anything());
  });

  it("keeps first-match ordering, duplicate requests and stable numeric ties", async () => {
    const { tree } = await loadNavigation({
      ordering: [
        { slug: "missing" },
        { slug: "a", children: [{ slug: "two" }, { slug: "one" }] },
        { slug: "a", children: [{ slug: "one" }] },
      ],
    });
    expect(tree.children.map((node) => node.name)).toEqual([
      "Root",
      "First A",
      "First A",
      "Prototype",
      "B",
    ]);
    for (const node of tree.children.slice(1, 3)) {
      expect(node).toMatchObject({ children: [{ name: "Two" }, { name: "One" }] });
    }
    const numeric = await loadNavigation({ ordering: "numeric" });
    expect(numeric.tree.children.map((node) => node.name)).toEqual([
      "Root",
      "Prototype",
      "First A",
      "Second A",
      "B",
    ]);
    expect(numeric.tree.children[2]).toMatchObject({
      children: [{ name: "Two" }, { name: "One" }],
    });
  });

  it("isolates locale prefixes and newly created server snapshots", async () => {
    const localized = {
      "/docs/en/page.md": page("English"),
      "/docs/fr/page.md": page("French"),
      "/docs/fr/start/page.md": page("French start"),
    };
    const options = {
      i18n: { locales: ["en", "fr"], defaultLocale: "en" },
      _preloadedContent: localized,
    };
    const load = createNavigationLoader(options);
    const french = await load("fr");
    expect(french.tree.children.map((node) => node.name)).toEqual(["French", "French start"]);
    const english = await load("en");
    expect(english.tree.children.map((node) => node.name)).toEqual(["English"]);
    localized["/docs/fr/start/page.md"] = page("Updated French start");
    const updated = await loadNavigation(options, "fr");
    expect(updated.tree.children.map((node) => node.name)).toEqual([
      "French",
      "Updated French start",
    ]);
  });
  it("preserves map ownership and isolates returned navigation across repeated loads", async () => {
    const files: Record<string, string> = { "/docs/page.md": page("Original") };
    const load = createNavigationLoader({ _preloadedContent: files });
    const first = await load();
    first.tree.children[0].name = "Caller mutation";
    expect((await load()).tree.children[0].name).toBe("Original");
    files["/docs/page.md"] = page("Edited");
    expect((await load()).tree.children[0].name).toBe("Original");
    files["/docs/new/page.md"] = page("New");
    expect((await load()).tree.children.map((node) => node.name)).toEqual(["Original"]);
    delete files["/docs/new/page.md"];
    expect((await load()).tree.children.map((node) => node.name)).toEqual(["Original"]);
  });
});

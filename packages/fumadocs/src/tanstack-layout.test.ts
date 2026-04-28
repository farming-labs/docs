import React from "react";
import { describe, expect, it } from "vitest";
import { TanstackDocsLayout } from "./tanstack-layout.js";

describe("TanstackDocsLayout", () => {
  it("does not add an extra display: contents wrapper above the docs layout root", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
      },
      tree: {
        name: "Docs",
        children: [],
      },
      children: React.createElement("div", null, "child"),
    });

    expect(React.isValidElement(tree)).toBe(true);
    expect(tree.type).not.toBe("div");
    expect((tree.props as { id?: string; style?: { display?: string } }).id).toBeUndefined();
    expect(
      (tree.props as { id?: string; style?: { display?: string } }).style?.display,
    ).toBeUndefined();
  });

  it("applies sidebar.folderIndexBehavior to the provided tree", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        sidebar: {
          folderIndexBehavior: "toggle",
        },
      },
      tree: {
        name: "Docs",
        children: [
          {
            type: "folder",
            name: "Components",
            index: { type: "page", name: "Components", url: "/docs/components" },
            children: [{ type: "page", name: "Button", url: "/docs/components/button" }],
          },
        ],
      },
      children: React.createElement("div", null, "child"),
    });

    const resolvedTree = (tree.props as { tree: { children: Array<Record<string, unknown>> } })
      .tree;
    expect(resolvedTree.children[0]).toMatchObject({
      type: "folder",
      index: undefined,
      children: [
        expect.objectContaining({
          type: "page",
          name: "Components",
          url: "/docs/components",
        }),
        expect.objectContaining({
          type: "page",
          name: "Button",
          url: "/docs/components/button",
        }),
      ],
    });
  });

  it("applies sidebar.folderIndexBehaviorOverrides selectively", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        sidebar: {
          folderIndexBehavior: "link",
          folderIndexBehaviorOverrides: {
            "/docs/components": "toggle",
          },
        },
      },
      tree: {
        name: "Docs",
        children: [
          {
            type: "folder",
            name: "Components",
            index: { type: "page", name: "Components", url: "/docs/components" },
            children: [{ type: "page", name: "Button", url: "/docs/components/button" }],
          },
          {
            type: "folder",
            name: "Guides",
            index: { type: "page", name: "Guides", url: "/docs/guides" },
            children: [{ type: "page", name: "Writing", url: "/docs/guides/writing" }],
          },
        ],
      },
      children: React.createElement("div", null, "child"),
    });

    const resolvedTree = (tree.props as { tree: { children: Array<Record<string, unknown>> } })
      .tree;
    expect(resolvedTree.children[0]).toMatchObject({
      type: "folder",
      index: undefined,
      children: [
        expect.objectContaining({
          type: "page",
          name: "Components",
          url: "/docs/components",
        }),
        expect.objectContaining({
          type: "page",
          name: "Button",
          url: "/docs/components/button",
        }),
      ],
    });
    expect(resolvedTree.children[1]).toMatchObject({
      type: "folder",
      index: expect.objectContaining({
        name: "Guides",
        url: "/docs/guides",
      }),
      children: [
        expect.objectContaining({
          type: "page",
          name: "Writing",
          url: "/docs/guides/writing",
        }),
      ],
    });
  });

  it("prefers explicit folder behavior on the provided tree", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        sidebar: {
          folderIndexBehavior: "link",
          folderIndexBehaviorOverrides: {
            "/docs/components": "link",
          },
        },
      },
      tree: {
        name: "Docs",
        children: [
          {
            type: "folder",
            name: "Components",
            folderIndexBehavior: "toggle",
            index: { type: "page", name: "Components", url: "/docs/components" },
            children: [{ type: "page", name: "Button", url: "/docs/components/button" }],
          },
        ],
      },
      children: React.createElement("div", null, "child"),
    });

    const resolvedTree = (tree.props as { tree: { children: Array<Record<string, unknown>> } })
      .tree;
    expect(resolvedTree.children[0]).toMatchObject({
      type: "folder",
      index: undefined,
      children: [
        expect.objectContaining({
          type: "page",
          name: "Components",
          url: "/docs/components",
        }),
        expect.objectContaining({
          type: "page",
          name: "Button",
          url: "/docs/components/button",
        }),
      ],
    });
  });
});

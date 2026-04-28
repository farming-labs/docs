import { describe, expect, it } from "vitest";
import {
  applySidebarFolderIndexBehavior,
  resolvePageSidebarFolderIndexBehavior,
  resolveSidebarFolderIndexBehavior,
  resolveSidebarFolderIndexBehaviorForPath,
} from "./sidebar.js";

describe("resolveSidebarFolderIndexBehavior", () => {
  it("defaults to link mode", () => {
    expect(resolveSidebarFolderIndexBehavior(undefined)).toBe("link");
    expect(resolveSidebarFolderIndexBehavior(true)).toBe("link");
    expect(resolveSidebarFolderIndexBehavior(false)).toBe("link");
  });

  it("returns toggle mode when configured", () => {
    expect(
      resolveSidebarFolderIndexBehavior({
        folderIndexBehavior: "toggle",
      }),
    ).toBe("toggle");
  });
});

describe("resolveSidebarFolderIndexBehaviorForPath", () => {
  it("uses per-folder overrides when present", () => {
    expect(
      resolveSidebarFolderIndexBehaviorForPath(
        {
          folderIndexBehavior: "link",
          folderIndexBehaviorOverrides: {
            "/docs/components": "toggle",
          },
        },
        "/docs/components",
      ),
    ).toBe("toggle");
  });

  it("normalizes trailing slashes before matching overrides", () => {
    expect(
      resolveSidebarFolderIndexBehaviorForPath(
        {
          folderIndexBehavior: "link",
          folderIndexBehaviorOverrides: {
            "/docs/components/": "toggle",
          },
        },
        "/docs/components",
      ),
    ).toBe("toggle");
  });
});

describe("resolvePageSidebarFolderIndexBehavior", () => {
  it("reads folderIndexBehavior from page frontmatter sidebar config", () => {
    expect(
      resolvePageSidebarFolderIndexBehavior({
        folderIndexBehavior: "toggle",
      }),
    ).toBe("toggle");
  });

  it("ignores invalid sidebar frontmatter values", () => {
    expect(resolvePageSidebarFolderIndexBehavior("toggle")).toBeUndefined();
    expect(
      resolvePageSidebarFolderIndexBehavior({
        folderIndexBehavior: "sideways",
      }),
    ).toBeUndefined();
  });
});

describe("applySidebarFolderIndexBehavior", () => {
  it("leaves the tree unchanged in link mode", () => {
    const tree = {
      name: "Docs",
      children: [
        {
          type: "folder",
          name: "Components",
          index: { type: "page", name: "Components", url: "/docs/components" },
          children: [{ type: "page", name: "Button", url: "/docs/components/button" }],
        },
      ],
    };

    expect(applySidebarFolderIndexBehavior(tree, "link")).toEqual(tree);
  });

  it("promotes folder index pages into the child list in toggle mode", () => {
    const tree = {
      name: "Docs",
      children: [
        {
          type: "folder",
          name: "Components",
          url: "/docs/components",
          index: { type: "page", name: "Components", url: "/docs/components" },
          children: [
            {
              type: "folder",
              name: "Forms",
              url: "/docs/components/forms",
              index: { type: "page", name: "Forms", url: "/docs/components/forms" },
              children: [{ type: "page", name: "Input", url: "/docs/components/forms/input" }],
            },
            { type: "page", name: "Button", url: "/docs/components/button" },
          ],
        },
      ],
    };

    expect(applySidebarFolderIndexBehavior(tree, "toggle")).toEqual({
      name: "Docs",
      children: [
        {
          type: "folder",
          name: "Components",
          index: undefined,
          url: undefined,
          children: [
            { type: "page", name: "Components", url: "/docs/components" },
            {
              type: "folder",
              name: "Forms",
              index: undefined,
              url: undefined,
              children: [
                { type: "page", name: "Forms", url: "/docs/components/forms" },
                { type: "page", name: "Input", url: "/docs/components/forms/input" },
              ],
            },
            { type: "page", name: "Button", url: "/docs/components/button" },
          ],
        },
      ],
    });
  });

  it("applies selective overrides per folder URL", () => {
    const tree = {
      name: "Docs",
      children: [
        {
          type: "folder",
          name: "Components",
          url: "/docs/components",
          index: { type: "page", name: "Components", url: "/docs/components" },
          children: [{ type: "page", name: "Button", url: "/docs/components/button" }],
        },
        {
          type: "folder",
          name: "Guides",
          url: "/docs/guides",
          index: { type: "page", name: "Guides", url: "/docs/guides" },
          children: [{ type: "page", name: "Writing", url: "/docs/guides/writing" }],
        },
      ],
    };

    expect(
      applySidebarFolderIndexBehavior(tree, {
        sidebar: {
          folderIndexBehavior: "link",
          folderIndexBehaviorOverrides: {
            "/docs/components": "toggle",
          },
        },
      }),
    ).toEqual({
      name: "Docs",
      children: [
        {
          type: "folder",
          name: "Components",
          index: undefined,
          url: undefined,
          children: [
            { type: "page", name: "Components", url: "/docs/components" },
            { type: "page", name: "Button", url: "/docs/components/button" },
          ],
        },
        {
          type: "folder",
          name: "Guides",
          url: "/docs/guides",
          index: { type: "page", name: "Guides", url: "/docs/guides" },
          children: [{ type: "page", name: "Writing", url: "/docs/guides/writing" }],
        },
      ],
    });
  });

  it("prefers explicit folder behavior on the node over config overrides", () => {
    const tree = {
      name: "Docs",
      children: [
        {
          type: "folder",
          name: "Components",
          folderIndexBehavior: "toggle",
          url: "/docs/components",
          index: { type: "page", name: "Components", url: "/docs/components" },
          children: [{ type: "page", name: "Button", url: "/docs/components/button" }],
        },
      ],
    };

    expect(
      applySidebarFolderIndexBehavior(tree, {
        sidebar: {
          folderIndexBehavior: "link",
          folderIndexBehaviorOverrides: {
            "/docs/components": "link",
          },
        },
      }),
    ).toEqual({
      name: "Docs",
      children: [
        {
          type: "folder",
          index: undefined,
          url: undefined,
          name: "Components",
          children: [
            { type: "page", name: "Components", url: "/docs/components" },
            { type: "page", name: "Button", url: "/docs/components/button" },
          ],
        },
      ],
    });
  });

  it("preserves the folder row position among siblings when toggle behavior is applied", () => {
    const tree = {
      name: "Docs",
      children: [
        { type: "page", name: "Overview", url: "/docs/overview" },
        {
          type: "folder",
          name: "Components",
          folderIndexBehavior: "toggle",
          url: "/docs/components",
          index: { type: "page", name: "Components", url: "/docs/components" },
          children: [{ type: "page", name: "Button", url: "/docs/components/button" }],
        },
        { type: "page", name: "Guides", url: "/docs/guides" },
      ],
    };

    const result = applySidebarFolderIndexBehavior(tree, {
      sidebar: {
        folderIndexBehavior: "link",
      },
    });

    expect(result.children.map((node) => (node as { name?: string }).name)).toEqual([
      "Overview",
      "Components",
      "Guides",
    ]);
    expect(result.children[1]).toMatchObject({
      type: "folder",
      index: undefined,
      children: [
        expect.objectContaining({
          name: "Components",
          url: "/docs/components",
        }),
        expect.objectContaining({
          name: "Button",
          url: "/docs/components/button",
        }),
      ],
    });
  });
});

import React from "react";
import { describe, expect, it } from "vitest";
import type { DocsConfig } from "@farming-labs/docs";
import { TanstackDocsLayout } from "./tanstack-layout.js";
import { DocsTopHeader } from "./top-header.js";
import { createTheme, defineDocs } from "@farming-labs/docs/config";

function findDocsPageClientProps(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as {
    type?: unknown;
    props?: Record<string, unknown> & { children?: unknown };
  };

  if (
    candidate.type &&
    candidate.props &&
    "copyMarkdown" in candidate.props &&
    "openDocs" in candidate.props
  ) {
    return candidate.props;
  }

  const children = candidate.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findDocsPageClientProps(child);
      if (found) return found;
    }
    return null;
  }

  return children ? findDocsPageClientProps(children) : null;
}

describe("TanstackDocsLayout", () => {
  it("hands the generated title to the page client", () => {
    const tree = TanstackDocsLayout({
      config: { entry: "docs" },
      tree: { name: "Docs", children: [] },
      generatedTitle: "Installation",
      children: React.createElement("div", null, "child"),
    });

    expect(findDocsPageClientProps(tree)?.generatedTitle).toBe("Installation");
  });

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

  it("renders Shadcn folder landing pages as section labels unless links are requested", () => {
    const sourceTree = {
      name: "Docs",
      children: [
        {
          type: "folder" as const,
          name: "Authentication",
          index: { type: "page" as const, name: "Authentication", url: "/docs/authentication" },
          children: [{ type: "page" as const, name: "Email", url: "/docs/authentication/email" }],
        },
      ],
    };
    const shadcnLayout = TanstackDocsLayout({
      config: { entry: "docs", theme: { name: "shadcn" } },
      tree: sourceTree,
      children: React.createElement("div", null, "child"),
    });
    const linkedShadcnLayout = TanstackDocsLayout({
      config: {
        entry: "docs",
        theme: { name: "shadcn" },
        sidebar: { folderIndexBehavior: "link" },
      },
      tree: sourceTree,
      children: React.createElement("div", null, "child"),
    });

    const shadcnTree = (
      shadcnLayout.props as {
        tree: { children: Array<Record<string, unknown>> };
      }
    ).tree;
    const linkedShadcnTree = (
      linkedShadcnLayout.props as {
        tree: { children: Array<Record<string, unknown>> };
      }
    ).tree;

    expect(shadcnTree.children[0]).toMatchObject({
      type: "folder",
      index: undefined,
      url: undefined,
      children: [
        expect.objectContaining({
          type: "page",
          name: "Email",
          url: "/docs/authentication/email",
        }),
      ],
    });
    expect(linkedShadcnTree.children[0]).toMatchObject({
      type: "folder",
      index: expect.objectContaining({
        type: "page",
        name: "Authentication",
        url: "/docs/authentication",
      }),
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

  it("passes feedback status messages through to DocsPageClient", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        feedback: {
          successMessage: "Thanks, we logged this.",
          errorMessage: "Feedback could not be recorded.",
        },
      },
      tree: {
        name: "Docs",
        children: [],
      },
      children: React.createElement("div", null, "child"),
    });

    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.feedbackEnabled).toBe(true);
    expect(props?.feedbackSuccessMessage).toBe("Thanks, we logged this.");
    expect(props?.feedbackErrorMessage).toBe("Feedback could not be recorded.");
  });

  it("passes authored description placement through to DocsPageClient", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
      },
      tree: {
        name: "Docs",
        children: [],
      },
      descriptionInBody: true,
      children: React.createElement("div", null, "child"),
    });

    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.descriptionInBody).toBe(true);
  });

  it("keeps browser-only header actions out of normal TanStack layouts", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        theme: { name: "fumadocs-pixel-border" } as any,
        llmsTxt: true,
      },
      tree: { name: "Docs", children: [] },
      children: React.createElement("div", null, "child"),
    });

    expect(findDocsPageClientProps(tree)?.showLlmsInHeader).toBeFalsy();
  });

  it("keeps llms.txt a hidden agent directive in browser runtimes without framework CSS", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        theme: { name: "fumadocs-pixel-border" } as any,
        llmsTxt: true,
      },
      tree: { name: "Docs", children: [] },
      browserRuntime: true,
      children: React.createElement("div", null, "child"),
    });

    // Matches the Next.js layout: the header has no llms.txt cell over the search and menu buttons.
    expect(findDocsPageClientProps(tree)?.showLlmsInHeader).toBeFalsy();
    expect((tree.props as { containerProps?: Record<string, unknown> }).containerProps).toEqual({
      "data-fd-theme": "fumadocs-pixel-border",
      "data-fd-browser-adapter": "",
    });
  });

  it("keeps provided navigation groups open when the sidebar is flat", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        sidebar: { flat: true },
      },
      tree: {
        name: "Docs",
        children: [
          {
            type: "folder",
            name: "Guides",
            children: [{ type: "page", name: "Start", url: "/docs/start" }],
          },
        ],
      },
      children: React.createElement("div", null, "child"),
    });

    expect(
      (tree.props as { tree: { children: Array<Record<string, unknown>> } }).tree.children[0],
    ).toMatchObject({
      type: "folder",
      collapsible: false,
      defaultOpen: true,
    });
  });

  it("marks the layout root with the theme name for theme CSS", () => {
    const themed = TanstackDocsLayout({
      config: { entry: "docs", theme: { name: "ledger" } },
      tree: { name: "Docs", children: [] },
      children: React.createElement("div", null, "child"),
    });
    const unthemed = TanstackDocsLayout({
      config: { entry: "docs" },
      tree: { name: "Docs", children: [] },
      browserRuntime: true,
      children: React.createElement("div", null, "child"),
    });

    expect((themed.props as { containerProps?: Record<string, unknown> }).containerProps).toEqual({
      "data-fd-theme": "ledger",
    });
    expect((unthemed.props as { containerProps?: Record<string, unknown> }).containerProps).toEqual(
      { "data-fd-browser-adapter": "" },
    );
  });

  it("renders a top header after structured data and before the layout", () => {
    const links = [{ label: "GitHub", href: "https://github.com/acme/acme", external: true }];
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        nav: { title: "Acme", url: "/docs/intro", links },
        ai: { enabled: true, mode: "sidebar-icon" },
        theme: { name: "ledger", ui: { layout: { header: { placement: "top" } } } },
      },
      tree: { name: "Docs", children: [] },
      browserRuntime: true,
      structuredData: "{}",
      children: React.createElement("div", null, "child"),
    });
    const [script, header, layout] = React.Children.toArray(
      (tree.props as { children: React.ReactNode }).children,
    ) as React.ReactElement<Record<string, any>>[];

    expect(tree.type).toBe(React.Fragment);
    expect(script.type).toBe("script");
    expect(header.type).toBe(DocsTopHeader);
    expect(header.props).toMatchObject({
      title: "Acme",
      titleUrl: "/docs/intro",
      links,
      search: true,
      askAI: true,
      themeToggle: { mode: undefined },
      themeName: "ledger",
    });
    expect(layout.props.containerProps).toMatchObject({
      "data-fd-theme": "ledger",
      "data-fd-header": "top",
      "data-fd-browser-adapter": "",
    });
    expect(layout.props.nav.title).toEqual(
      React.createElement("span", { className: "fd-nav-title" }, "Acme"),
    );
    expect(layout.props.links).toEqual([
      {
        text: React.createElement("span", { className: "fd-nav-link" }, "GitHub"),
        url: "https://github.com/acme/acme",
        external: true,
      },
    ]);
  });

  it("renders a skip link before the layout when the theme enables it", () => {
    const tree = TanstackDocsLayout({
      config: { entry: "docs", theme: { ui: { layout: { skipLink: true } } } },
      tree: { name: "Docs", children: [] },
      children: React.createElement("div", null, "child"),
    });
    const [skipLink, layout] = React.Children.toArray(
      (tree.props as { children: React.ReactNode }).children,
    ) as React.ReactElement<Record<string, any>>[];

    expect(skipLink.type).toBe("a");
    expect(skipLink.props).toEqual({
      className: "fd-skip-link",
      href: "#nd-page",
      children: "Skip to content",
    });
    expect(layout.props.tree).toBeDefined();
  });

  it("turns on the theme's page options under the user's own", () => {
    const theme = createTheme({
      name: "assistant-ui",
      configDefaults: { pageActions: { copyMarkdown: true, openDocs: true } },
    });
    const render = (config: Parameters<typeof defineDocs>[0]) =>
      findDocsPageClientProps(
        TanstackDocsLayout({
          config: defineDocs(config),
          tree: { name: "Docs", children: [] },
          browserRuntime: true,
          children: React.createElement("div", null, "child"),
        }),
      );

    expect(render({ entry: "docs", theme: theme() })).toMatchObject({
      copyMarkdown: true,
      openDocs: true,
    });
    expect(
      render({ entry: "docs", theme: theme(), pageActions: { copyMarkdown: false } }),
    ).toMatchObject({ copyMarkdown: false, openDocs: true });
  });

  it("keeps the site chrome in the sidebar without a top header", () => {
    const tree = TanstackDocsLayout({
      config: { entry: "docs", nav: { title: "Acme" }, theme: { name: "ledger" } },
      tree: { name: "Docs", children: [] },
      children: React.createElement("div", null, "child"),
    });
    const props = tree.props as Record<string, any>;

    expect(tree.type).not.toBe(React.Fragment);
    expect(props.nav.title).toBe("Acme");
    expect(props.containerProps).toEqual({ "data-fd-theme": "ledger" });
    expect(props.links).toBeUndefined();
  });

  it("keeps the native TanStack layout out of framework-owned CSS", () => {
    const tree = TanstackDocsLayout({
      config: { entry: "docs" },
      tree: { name: "Docs", children: [] },
      children: React.createElement("div", null, "child"),
    });

    expect(
      (tree.props as { containerProps?: Record<string, unknown> }).containerProps,
    ).toBeUndefined();
  });

  it("passes the configured feedback placeholder through to DocsPageClient", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        feedback: {
          placeholder: "Tell us what felt unclear.",
        },
      },
      tree: {
        name: "Docs",
        children: [],
      },
      children: React.createElement("div", null, "child"),
    });

    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.feedbackEnabled).toBe(true);
    expect(props?.feedbackPlaceholder).toBe("Tell us what felt unclear.");
  });

  it("passes the configured last-updated label through to DocsPageClient", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
        lastUpdated: {
          label: "Updated",
          position: "below-title",
        },
      },
      tree: {
        name: "Docs",
        children: [],
      },
      children: React.createElement("div", null, "child"),
    });

    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.lastUpdatedEnabled).toBe(true);
    expect(props?.lastUpdatedLabel).toBe("Updated");
    expect(props?.lastUpdatedPosition).toBe("below-title");
  });
});

describe("TanstackDocsLayout page chrome", () => {
  const pageClientProps = (config: Partial<DocsConfig>, props: Record<string, unknown> = {}) =>
    findDocsPageClientProps(
      TanstackDocsLayout({
        config: { entry: "docs", ...config },
        tree: { name: "Docs", children: [] },
        children: React.createElement("div", null, "child"),
        ...props,
      }),
    );

  it.each([
    [undefined, false],
    [false, false],
    [true, true],
  ])("passes pageActions.pager %s to the title row as %s", (pager, expected) => {
    const props = pageClientProps(
      { pageActions: { pager } },
      { previousPage: null, nextPage: { name: "Next", url: "/docs/next" } },
    );

    expect(props?.titlePager).toBe(expected);
    expect(props?.nextPage).toEqual({ name: "Next", url: "/docs/next" });
  });

  it.each([
    [undefined, false],
    [true, true],
  ])("passes pageActions.viewMarkdown %s as %s", (viewMarkdown, expected) => {
    expect(pageClientProps({ pageActions: { viewMarkdown } })?.viewMarkdown).toBe(expected);
  });

  it.each([
    [undefined, "buttons"],
    ["menu", "menu"],
  ] as const)("passes pageActions.variant %s as %s", (variant, expected) => {
    expect(pageClientProps({ pageActions: { variant } })?.pageActionsVariant).toBe(expected);
  });

  it("passes the title position through", () => {
    expect(pageClientProps({ pageActions: { position: "title" } })?.pageActionsPosition).toBe(
      "title",
    );
  });

  it.each([
    [undefined, undefined],
    [true, { copyMarkdown: true, viewMarkdown: true, editOnGitHub: true }],
    [{ copyMarkdown: false }, { copyMarkdown: false, viewMarkdown: true, editOnGitHub: true }],
  ] as const)("resolves pageActions.toc %j for the rail", (toc, expected) => {
    expect(pageClientProps({ pageActions: { position: "title", toc } })?.tocActions).toEqual(
      expected,
    );
  });

  it.each([
    [undefined, true],
    [false, false],
  ])("passes pageActions.askAi %s to the rail as %s", (askAi, expected) => {
    expect(pageClientProps({ pageActions: { askAi } })?.tocAskAi).toBe(expected);
  });

  it("passes the footer element through", () => {
    const footer = React.createElement("p", null, "MIT License");

    expect(pageClientProps({ footer })?.footer).toBe(footer);
    expect(pageClientProps({})?.footer).toBeUndefined();
  });
});

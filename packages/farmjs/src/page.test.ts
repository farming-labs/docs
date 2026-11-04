import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { BrowserDocsLayout } from "@farming-labs/theme/browser";
import { describe, expect, it } from "vitest";
import { FarmDocsPageRenderer } from "./page.js";
import { createDocsServer } from "./server.js";

function findElement(node: ReactNode, type: unknown): ReactElement<any> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  if (node.type === type) return node as ReactElement<any>;
  return findElement((node.props as { children?: ReactNode }).children, type);
}

describe("FarmDocsPageRenderer", () => {
  it("passes previous and next pages to the layout's page navigation", () => {
    const previousPage = { name: "Installation", url: "/docs/installation" };
    const nextPage = { name: "Default", url: "/docs/themes/default" };
    const tree = FarmDocsPageRenderer({
      config: { entry: "docs" } as any,
      data: {
        url: "/docs/themes",
        tree: { name: "Docs", children: [] },
        previousPage,
        nextPage,
      } as any,
      Content: () => null,
    });

    const layout = findElement(tree, BrowserDocsLayout);

    // The layout renders them as .fd-page-nav below the Edit on GitHub row instead of the
    // fumadocs footer, which sat flush against that row.
    expect(layout).toBeDefined();
    expect(layout?.props.previousPage).toEqual(previousPage);
    expect(layout?.props.nextPage).toEqual(nextPage);
  });
});

describe("FarmDocsPageRenderer generated page titles", () => {
  const generatedTitleTheme = { name: "assistant-ui", ui: { page: { generatedTitle: true } } };

  async function render(theme: unknown, body: string) {
    const config = {
      entry: "docs",
      theme,
      _preloadedContent: {
        "/docs/page.md": `---\ntitle: Introduction\ndescription: Build a Farm application.\n---\n\n${body}`,
      },
    } as any;
    const data = await createDocsServer(config).load({ pathname: "/docs" });
    const Content = () =>
      body.startsWith("# ")
        ? createElement("h1", null, body.slice(2))
        : createElement("p", null, "Farm documentation content.");
    return renderToString(createElement(FarmDocsPageRenderer, { config, data, Content }));
  }

  it("renders the frontmatter title and description when the theme enables it", async () => {
    const html = await render(generatedTitleTheme, "Farm documentation content.");

    expect(html).toContain(
      '<div class="fd-generated-page-header not-prose"><h1 class="fd-page-title">Introduction</h1><p class="fd-page-description">Build a Farm application.</p></div>',
    );
  });

  it("renders no generated title when the theme does not enable it", async () => {
    const html = await render({ name: "shadcn" }, "Farm documentation content.");

    expect(html).not.toContain("fd-generated-page-header");
    expect(html).not.toContain('<h1 class="fd-page-title">');
  });

  it("does not repeat a title the page body authors", async () => {
    const html = await render(generatedTitleTheme, "# Introduction");

    expect(html).not.toContain("fd-generated-page-header");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});

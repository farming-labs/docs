import { isValidElement, type ReactElement, type ReactNode } from "react";
import { BrowserDocsLayout } from "@farming-labs/theme/browser";
import { describe, expect, it } from "vitest";
import { FarmDocsPageRenderer } from "./page.js";

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
  it("leaves previous and next page links to the layout's own footer, as on Next.js", () => {
    const tree = FarmDocsPageRenderer({
      config: { entry: "docs" } as any,
      data: {
        url: "/docs/themes",
        tree: { name: "Docs", children: [] },
        previousPage: { name: "Installation", url: "/docs/installation" },
        nextPage: { name: "Default", url: "/docs/themes/default" },
      } as any,
      Content: () => null,
    });

    const layout = findElement(tree, BrowserDocsLayout);

    // Passing these switches the layout to its custom page navigation, which the Pixel Border
    // preset does not style for browser runtimes.
    expect(layout).toBeDefined();
    expect(layout?.props.previousPage).toBeUndefined();
    expect(layout?.props.nextPage).toBeUndefined();
  });

  it("wraps the layout and the page content with the shell's layout and page", () => {
    const Content = () => null;
    const Layout = ({ children }: { children: ReactNode }) => children;
    const Page = ({ children }: { children: ReactNode }) => children;
    const tree = FarmDocsPageRenderer({
      config: { entry: "docs" } as any,
      data: { url: "/docs", tree: { name: "Docs", children: [] } } as any,
      Content,
      Layout,
      Page,
    });

    // Layout sits inside the providers and around the docs layout.
    const layout = findElement(tree, Layout);
    expect(layout).toBeDefined();
    expect(findElement(layout?.props.children, BrowserDocsLayout)).toBeDefined();
    // Page sits inside the docs layout and around the page's content.
    const docsLayout = findElement(tree, BrowserDocsLayout);
    const page = findElement(docsLayout?.props.children, Page);
    expect(page).toBeDefined();
    expect(findElement(page?.props.children, Content)).toBeDefined();
  });

  it("renders the layout and content directly without shell wrappers", () => {
    const Content = () => null;
    const tree = FarmDocsPageRenderer({
      config: { entry: "docs" } as any,
      data: { url: "/docs", tree: { name: "Docs", children: [] } } as any,
      Content,
    });

    const docsLayout = findElement(tree, BrowserDocsLayout);
    expect(isValidElement(docsLayout?.props.children)).toBe(true);
    expect((docsLayout?.props.children as ReactElement).type).toBe(Content);
  });

  it("passes a generated page title to the layout", () => {
    const tree = FarmDocsPageRenderer({
      config: { entry: "docs" } as any,
      data: {
        url: "/docs",
        tree: { name: "Docs", children: [] },
        generatedTitle: "Introduction",
      } as any,
      Content: () => null,
    });

    expect(findElement(tree, BrowserDocsLayout)?.props.generatedTitle).toBe("Introduction");
  });
});

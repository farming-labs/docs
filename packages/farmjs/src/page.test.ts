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

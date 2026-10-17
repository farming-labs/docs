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
});

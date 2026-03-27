import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => "/docs/installation",
}));

import { PageActions } from "./page-actions.js";

describe("PageActions alignment", () => {
  it("applies the alignment attribute to the rendered actions container", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: true,
        alignment: "right",
        providers: [],
      }),
    );

    expect(html).toContain('data-page-actions="true"');
    expect(html).toContain('data-actions-alignment="right"');
  });
});

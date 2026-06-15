import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockRouterState = vi.hoisted(() => ({
  pathname: "/docs/installation",
}));

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => mockRouterState.pathname,
}));

import { PageActions } from "./page-actions.js";

describe("PageActions alignment", () => {
  beforeEach(() => {
    mockRouterState.pathname = "/docs/installation";
  });

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

  it("uses /index.md for root markdown links", () => {
    mockRouterState.pathname = "/";

    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: false,
        openDocs: true,
        providers: [],
        variant: "rail",
      }),
    );

    expect(html).toContain('href="/index.md"');
  });

  it("keeps the rail Ask AI action when copy and open docs are disabled", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: false,
        openDocs: false,
        providers: [],
        variant: "rail",
      }),
    );

    expect(html).toContain('data-page-actions-variant="rail"');
    expect(html).toContain("Ask AI");
  });
});

describe("PageActions copy markdown labels", () => {
  it("renders a custom copy button label", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: true,
        copyMarkdownLabel: "Copy docs",
        providers: [],
      }),
    );

    expect(html).toContain("Copy docs");
    expect(html).not.toContain("Copy page");
  });

  it("marks the configured copy format", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: true,
        copyMarkdownFormat: "text",
        providers: [],
      }),
    );

    expect(html).toContain('data-copy-markdown-format="text"');
  });
});

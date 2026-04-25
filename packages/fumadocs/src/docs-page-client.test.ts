import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => "/docs/installation",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("./page-actions.js", () => ({
  PageActions: () => React.createElement("div", null, "Mock Actions"),
}));

vi.mock("fumadocs-ui/layouts/docs/page", async () => {
  const ReactModule = await import("react");

  return {
    DocsPage: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement("main", null, children),
    DocsBody: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement("section", null, children),
    EditOnGitHub: ({ href }: { href: string }) =>
      ReactModule.createElement("a", { href }, "Edit on GitHub"),
  };
});

import { DocsPageClient } from "./docs-page-client.js";

describe("DocsPageClient llms.txt footer links", () => {
  it("uses the public llms.txt defaults instead of docs api query routes", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        llmsTxtEnabled: true,
        locale: "en",
        children: React.createElement("article", null, "Docs"),
      }),
    );

    expect(html).toContain('href="/llms.txt?lang=en"');
    expect(html).toContain('href="/llms-full.txt?lang=en"');
    expect(html).not.toContain("/api/docs?format=llms");
  });
});

describe("DocsPageClient reading time", () => {
  it("renders the reading-time row when enabled", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        readingTimeEnabled: true,
        readingTime: 5,
        children: React.createElement(
          "article",
          null,
          React.createElement("h1", null, "Installation"),
          React.createElement("p", null, "Docs"),
        ),
      }),
    );

    expect(html).toContain("5 min read");
  });

  it("renders reading time below below-title page actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        readingTimeEnabled: true,
        readingTime: 5,
        children: React.createElement(
          "article",
          null,
          React.createElement("h1", null, "Installation"),
          React.createElement("p", null, "Docs"),
        ),
      }),
    );

    expect(html.indexOf("Mock Actions")).toBeLessThan(html.indexOf("5 min read"));
  });

  it("renders reading time below above-title page actions and above the page title", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "above-title",
        readingTimeEnabled: true,
        readingTime: 5,
        children: React.createElement(
          "article",
          null,
          React.createElement("h1", null, "Installation"),
          React.createElement("p", null, "Docs"),
        ),
      }),
    );

    expect(html.indexOf("Mock Actions")).toBeLessThan(html.indexOf("5 min read"));
    expect(html.indexOf("5 min read")).toBeLessThan(html.indexOf("Installation"));
  });
});

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
    DocsPage: ({
      children,
      footer,
    }: {
      children: React.ReactNode;
      footer?: { enabled?: boolean };
    }) =>
      ReactModule.createElement(
        "main",
        { "data-footer-enabled": String(footer?.enabled ?? true) },
        children,
      ),
    DocsBody: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"section"> & { children: React.ReactNode }) =>
      ReactModule.createElement("section", props, children),
    EditOnGitHub: ({ href }: { href: string }) =>
      ReactModule.createElement("a", { href }, "Edit on GitHub"),
  };
});

import { DocsPageClient } from "./docs-page-client.js";

describe("DocsPageClient llms.txt footer links", () => {
  it("exposes the shared document class contract to every React adapter", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        children: React.createElement("p", null, "Portable content"),
      }),
    );

    expect(html).toContain('class="fd-page-body"');
    expect(html).toContain('class="fd-docs-content"');
  });

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
    expect(html).toContain('class="fd-agent-llms-directive"');
    expect(html).not.toContain("/api/docs?format=llms");
  });

  it("exposes the llms.txt link only when the runtime owns a header action", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        llmsTxtEnabled: true,
        showLlmsInHeader: true,
        children: React.createElement("article", null, "Docs"),
      }),
    );

    expect(html).toContain('data-visible-in-header="true"');
    expect(html).toContain(">LLMS.TXT</a>");
    expect(html).not.toContain('tabindex="-1"');
    expect(html).not.toContain('aria-hidden="true"');
  });
});

describe("DocsPageClient generated page title", () => {
  it("renders title, description, and below-title actions before preserved MDX content", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        generatedTitleMap: { "/docs/installation": "Installation" },
        descriptionMap: { "/docs/installation": "Install the SDK." },
        children: React.createElement("p", null, "Preserved content"),
      }),
    );

    const titleIndex = html.indexOf("Installation");
    const descriptionIndex = html.indexOf("Install the SDK.");
    const actionsIndex = html.indexOf("Mock Actions");
    const contentIndex = html.indexOf("Preserved content");

    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeLessThan(descriptionIndex);
    expect(descriptionIndex).toBeLessThan(actionsIndex);
    expect(actionsIndex).toBeLessThan(contentIndex);
  });

  it("keeps title decorations hidden until their client portal host is ready", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        descriptionMap: { "/docs/installation": "Install the SDK." },
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement("h1", null, "Installation"),
          React.createElement("p", null, "Preserved content"),
        ),
      }),
    );

    expect(html).toContain('class="fd-title-decorations-fallback" hidden=""');
    expect(html).toContain("Mock Actions");
  });
});

describe("DocsPageClient page navigation", () => {
  it("disables the built-in pager when custom page navigation is available", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        nextPage: { name: "Capabilities", url: "/docs/capabilities" },
        children: React.createElement("article", null, "Docs"),
      }),
    );

    expect(html).toContain('data-footer-enabled="false"');
    expect(html).toContain('class="not-prose fd-page-nav"');
    expect(html.match(/Next Page/g)).toHaveLength(1);
  });

  it("keeps the built-in pager enabled when custom navigation is absent", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        children: React.createElement("article", null, "Docs"),
      }),
    );

    expect(html).toContain('data-footer-enabled="true"');
    expect(html).not.toContain('class="not-prose fd-page-nav"');
  });
});

describe("DocsPageClient structured data", () => {
  it("renders serialized Schema.org JSON-LD for the active docs page", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        structuredDataMap: {
          "/docs/installation": JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: "</script><script>alert(1)</script>",
          }),
        },
        children: React.createElement("article", null, "Docs"),
      }),
    );

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"TechArticle"');
    expect(html).toContain('"headline":"\\u003c/script>');
    expect(html).not.toContain("</script><script>");
  });
});

describe("DocsPageClient generated page header", () => {
  it("renders title, description, and below-title actions before preserved page content", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        generatedTitleMap: { "/docs/installation": "Installation" },
        descriptionMap: { "/docs/installation": "Install the framework." },
        children: React.createElement("article", null, "Preserved page content"),
      }),
    );

    const titleIndex = html.indexOf("Installation");
    const descriptionIndex = html.indexOf("Install the framework.");
    const actionsIndex = html.indexOf("Mock Actions");
    const contentIndex = html.indexOf("Preserved page content");

    expect(html).toContain('class="fd-generated-page-header not-prose"');
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(descriptionIndex).toBeGreaterThan(titleIndex);
    expect(actionsIndex).toBeGreaterThan(descriptionIndex);
    expect(contentIndex).toBeGreaterThan(actionsIndex);
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

  it("renders explicit page reading time even when the global flag is off", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        readingTimeEnabled: false,
        readingTime: 8,
        children: React.createElement(
          "article",
          null,
          React.createElement("h1", null, "Installation"),
          React.createElement("p", null, "Docs"),
        ),
      }),
    );

    expect(html).toContain("8 min read");
  });

  it("does not render path-based reading time when the global flag is off", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        readingTimeEnabled: false,
        readingTimeMap: {
          "/docs/installation": 6,
        },
        children: React.createElement(
          "article",
          null,
          React.createElement("h1", null, "Installation"),
          React.createElement("p", null, "Docs"),
        ),
      }),
    );

    expect(html).not.toContain("6 min read");
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

    const actionsIndex = html.indexOf("Mock Actions");
    const readingTimeIndex = html.indexOf("5 min read");

    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(readingTimeIndex).toBeGreaterThanOrEqual(0);
    expect(actionsIndex).toBeLessThan(readingTimeIndex);
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

    const actionsIndex = html.indexOf("Mock Actions");
    const readingTimeIndex = html.indexOf("5 min read");
    const titleIndex = html.indexOf("Installation");

    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(readingTimeIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(actionsIndex).toBeLessThan(readingTimeIndex);
    expect(readingTimeIndex).toBeLessThan(titleIndex);
  });

  it("renders reading time below the title when page actions are disabled and position is below-title", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
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

    const titleIndex = html.indexOf("Installation");
    const readingTimeIndex = html.indexOf("5 min read");

    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(readingTimeIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeLessThan(readingTimeIndex);
  });

  it("keeps reading time grouped with last updated when last updated is below-title", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        lastUpdatedEnabled: true,
        lastUpdatedPosition: "below-title",
        lastModified: "April 25, 2026",
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

    const titleIndex = html.indexOf("Installation");
    const lastUpdatedIndex = html.indexOf("Last updated April 25, 2026");
    const readingTimeIndex = html.indexOf("5 min read");

    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(lastUpdatedIndex).toBeGreaterThanOrEqual(0);
    expect(readingTimeIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeLessThan(lastUpdatedIndex);
    expect(lastUpdatedIndex).toBeLessThan(readingTimeIndex);
  });
});

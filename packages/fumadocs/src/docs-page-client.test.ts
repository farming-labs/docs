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
import { DocsTitleSlot } from "./title-slot.js";
import { serializePageMetadata, type DocsPageMaps } from "./page-metadata.js";
import { compactPageStructuredData } from "./page-structured-data.js";

describe("DocsPageClient packed metadata compatibility", () => {
  const route = "/docs/installation";
  const maps: DocsPageMaps = {
    lastModifiedMap: { [route]: "October 17, 2026" },
    generatedTitleMap: { [route]: "Installation" },
    descriptionMap: { [route]: "Install the SDK." },
    readingTimeMap: { [route]: 7 },
    structuredDataPages: {
      baseUrl: "https://example.com",
      entry: "docs",
      pages: {
        [route]: compactPageStructuredData({
          title: "Installation",
          description: "Install the SDK.",
          url: `${route}?lang=fr`,
          dateModified: "2026-10-17T00:00:00.000Z",
        }),
      },
    },
  };
  it.each(["footer", "below-title"] as const)(
    "renders identical HTML with dates in the %s position",
    (lastUpdatedPosition) => {
      const props = {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        readingTimeEnabled: true,
        lastUpdatedPosition,
        children: React.createElement("p", null, "Preserved MDX content"),
      };
      const legacy = renderToStaticMarkup(
        React.createElement(DocsPageClient, { ...props, ...maps }),
      );
      const packed = renderToStaticMarkup(
        React.createElement(DocsPageClient, {
          ...props,
          pageMetadata: serializePageMetadata(maps),
        }),
      );
      expect(packed).toBe(legacy);
    },
  );

  it("retains direct overrides and legacy map precedence when supplied together", () => {
    const props = {
      tocEnabled: false,
      breadcrumbEnabled: false,
      readingTimeEnabled: true,
      description: "Direct description",
      lastModified: "Direct date",
      readingTime: 2,
      structuredData: '{"@type":"Article","headline":"Direct"}',
      children: React.createElement("p", null, "Content"),
      ...maps,
    };
    expect(
      renderToStaticMarkup(
        React.createElement(DocsPageClient, {
          ...props,
          pageMetadata: serializePageMetadata(maps),
        }),
      ),
    ).toBe(renderToStaticMarkup(React.createElement(DocsPageClient, props)));
  });
});

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

  const slottedPage = () =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", null, "Installation"),
      React.createElement(DocsTitleSlot, { position: "title" }),
      React.createElement("p", null, "Preserved content"),
      React.createElement(DocsTitleSlot, { position: "description" }),
      React.createElement("p", null, "More content"),
    );

  it("renders title decorations in the page's title slot on the server", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        descriptionMap: { "/docs/installation": "Install the SDK." },
        titleSlot: true,
        children: slottedPage(),
      }),
    );

    expect(html).not.toContain("fd-title-decorations-fallback");
    expect(html.match(/data-fd-title-slot/g)).toHaveLength(1);
    expect(html.match(/Mock Actions/g)).toHaveLength(1);
    const title = html.indexOf("Installation</h1>");
    const slot = html.indexOf("data-fd-title-slot");
    expect(title).toBeGreaterThan(-1);
    expect(slot).toBeGreaterThan(title);
    expect(html.indexOf("Install the SDK.")).toBeGreaterThan(slot);
    expect(html.indexOf("Preserved content")).toBeGreaterThan(html.indexOf("Mock Actions"));
  });

  it("uses the slot after the description paragraph when the body starts with it", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        descriptionInBody: true,
        titleSlot: true,
        children: slottedPage(),
      }),
    );

    expect(html.match(/data-fd-title-slot/g)).toHaveLength(1);
    const slot = html.indexOf("data-fd-title-slot");
    expect(slot).toBeGreaterThan(html.indexOf("Preserved content"));
    expect(slot).toBeLessThan(html.indexOf("More content"));
  });

  it("leaves slots empty when the theme renders the page title itself", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        generatedTitleMap: { "/docs/installation": "Installation" },
        descriptionMap: { "/docs/installation": "Install the SDK." },
        titleSlot: true,
        children: slottedPage(),
      }),
    );

    expect(html).not.toContain("data-fd-title-slot");
    expect(html).toContain("fd-generated-page-header");
    expect(html.match(/Mock Actions/g)).toHaveLength(1);
  });

  it("leaves slots empty and keeps the client placement when the adapter has no title slot", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        pageActionsPosition: "below-title",
        descriptionMap: { "/docs/installation": "Install the SDK." },
        children: slottedPage(),
      }),
    );

    expect(html).not.toContain("data-fd-title-slot");
    expect(html).toContain('class="fd-title-decorations-fallback" hidden=""');
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
  it("renders compact page data in server HTML and preserves direct overrides", () => {
    const props = {
      tocEnabled: false,
      breadcrumbEnabled: false,
      structuredDataPages: {
        baseUrl: "https://example.com",
        pages: {
          "/docs/installation": {
            title: "Installation",
            url: "/docs/installation?lang=fr",
            dateModified: "2026-09-29",
          },
        },
      },
      children: React.createElement("article", null, "Docs"),
    };
    const html = renderToStaticMarkup(React.createElement(DocsPageClient, props));
    expect(html).toContain('"headline":"Installation"');
    expect(html).toContain('"url":"https://example.com/docs/installation?lang=fr"');
    expect(html).toContain('"dateModified":"2026-09-29T00:00:00.000Z"');
    const override = renderToStaticMarkup(
      React.createElement(DocsPageClient, { ...props, structuredData: '{"headline":"Override"}' }),
    );
    expect(override).toContain('"headline":"Override"');
    expect(override).not.toContain('"headline":"Installation"');
  });

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

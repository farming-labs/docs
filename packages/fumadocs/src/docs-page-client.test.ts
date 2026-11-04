import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const footerItems = vi.hoisted(() => ({
  pages: [] as Array<{ type: "page"; name: string; url: string }>,
}));

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => "/docs/installation",
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ prefetch: _prefetch, ...props }: React.ComponentProps<"a"> & { prefetch?: boolean }) =>
    React.createElement("a", props),
}));

vi.mock("fumadocs-ui/utils/use-footer-items", () => ({
  useFooterItems: () => footerItems.pages,
}));

vi.mock("./page-actions.js", () => ({
  PageActions: (props: Record<string, unknown>) =>
    React.createElement("div", { "data-mock-actions": JSON.stringify(props) }, "Mock Actions"),
}));

vi.mock("fumadocs-ui/layouts/docs/page", async () => {
  const ReactModule = await import("react");

  return {
    DocsPage: ({
      children,
      footer,
    }: {
      children: React.ReactNode;
      footer?: { enabled?: boolean; children?: React.ReactNode };
    }) =>
      ReactModule.createElement(
        "main",
        { "data-footer-enabled": String(footer?.enabled ?? true) },
        children,
        footer?.enabled === false
          ? null
          : ReactModule.createElement("nav", { "data-fumadocs-footer": "" }, footer?.children),
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

describe("DocsPageClient generated title prop", () => {
  it("renders a direct generatedTitle in the generated page header", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        generatedTitle: "Installation",
        description: "Install the framework.",
        children: React.createElement("p", null, "Body"),
      }),
    );

    expect(html).toContain(
      '<div class="fd-generated-page-header not-prose"><h1 class="fd-page-title">Installation</h1><p class="fd-page-description">Install the framework.</p></div>',
    );
  });

  it("renders no generated header without a generated title", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        description: "Install the framework.",
        children: React.createElement("p", null, "Body"),
      }),
    );

    expect(html).not.toContain("fd-generated-page-header");
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

describe("DocsPageClient title pager", () => {
  const introduction = { name: "Introduction", url: "/docs" };
  const capabilities = { name: "Capabilities", url: "/docs/capabilities" };
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        generatedTitle: "Installation",
        children: React.createElement("p", null, "Body"),
        ...props,
      }),
    );

  it("keeps the title row unchanged when the pager is off", () => {
    const html = render({ previousPage: introduction, nextPage: capabilities });

    expect(html).not.toContain("fd-title-pager");
    expect(html).not.toContain("fd-page-title-row");
    expect(html).toContain('<h1 class="fd-page-title">Installation</h1>');
  });

  it("links the bottom pager's pages from the title row", () => {
    const html = render({
      titlePager: true,
      previousPage: introduction,
      nextPage: capabilities,
    });

    expect(html).toContain(
      '<div class="fd-page-title-row"><h1 class="fd-page-title">Installation</h1><div class="fd-page-title-actions not-prose"><nav class="fd-title-pager" aria-label="Previous and next page">',
    );
    expect(html).toContain(
      '<a href="/docs" class="fd-title-pager-link fd-title-pager-prev" aria-label="Previous: Introduction" title="Previous: Introduction">',
    );
    expect(html).toContain(
      '<a href="/docs/capabilities" class="fd-title-pager-link fd-title-pager-next" aria-label="Next: Capabilities" title="Next: Capabilities">',
    );
    expect(html).toContain('class="not-prose fd-page-nav"');
  });

  it("keeps a hidden placeholder for a missing neighbor", () => {
    const html = render({ titlePager: true, previousPage: null, nextPage: capabilities });

    expect(html).toContain(
      '<span class="fd-title-pager-link fd-title-pager-prev" data-disabled="true" aria-hidden="true">',
    );
    expect(html).not.toContain("Previous:");
    expect(html).toContain('aria-label="Next: Capabilities"');
  });

  it("renders no pager for a page without neighbors", () => {
    const html = render({ titlePager: true, previousPage: null, nextPage: null });

    expect(html).not.toContain("fd-title-pager");
    expect(html).not.toContain("fd-page-title-row");
  });

  it("reads neighbors from the page tree when the layout passes none", () => {
    footerItems.pages = [
      { type: "page", ...introduction },
      { type: "page", name: "Installation", url: "/docs/installation" },
      { type: "page", ...capabilities },
    ];

    const html = render({ titlePager: true });

    expect(html).toContain('href="/docs" class="fd-title-pager-link fd-title-pager-prev"');
    expect(html).toContain(
      'href="/docs/capabilities" class="fd-title-pager-link fd-title-pager-next"',
    );
    expect(html).toContain('data-footer-enabled="true"');
  });

  it("places the pager after an authored h1 through the title decorations", () => {
    const html = render({
      titlePager: true,
      generatedTitle: undefined,
      previousPage: introduction,
      nextPage: null,
      children: React.createElement("h1", null, "Installation"),
    });

    expect(html).toContain(
      '<div class="fd-title-decorations-fallback" hidden=""><div class="fd-page-title-actions not-prose"><nav class="fd-title-pager"',
    );
  });
});

describe("DocsPageClient View as Markdown", () => {
  it.each([
    [false, false],
    [true, true],
  ])("renders the page actions for viewMarkdown %s: %s", (viewMarkdown, rendered) => {
    const html = renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        viewMarkdown,
        generatedTitle: "Installation",
        children: React.createElement("p", null, "Body"),
      }),
    );

    expect(html.includes("Mock Actions")).toBe(rendered);
    if (rendered) expect(html).toContain("&quot;viewMarkdown&quot;:true");
  });
});

describe("DocsPageClient title actions", () => {
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        copyMarkdown: true,
        generatedTitle: "Installation",
        children: React.createElement("p", null, "Body"),
        ...props,
      }),
    );
  const mockedActions = (html: string) =>
    [...html.matchAll(/data-mock-actions="([^"]*)"/g)].map(
      (match) => JSON.parse(match[1]!.replaceAll("&quot;", '"')) as Record<string, unknown>,
    );

  it("keeps button actions below the title by default", () => {
    const html = render({});

    expect(html).not.toContain("fd-page-title-row");
    expect(mockedActions(html)).toEqual([expect.objectContaining({ variant: "default" })]);
  });

  it("renders the menu variant below the title", () => {
    const html = render({ pageActionsVariant: "menu" });

    expect(html).toContain('class="fd-below-title-block not-prose"');
    expect(mockedActions(html)).toEqual([expect.objectContaining({ variant: "menu" })]);
  });

  it("puts the actions in the title row after the pager", () => {
    const html = render({
      pageActionsPosition: "title",
      pageActionsVariant: "menu",
      titlePager: true,
      previousPage: { name: "Introduction", url: "/docs" },
      nextPage: null,
    });

    const row = html.slice(html.indexOf("fd-page-title-row"), html.indexOf("fd-docs-content"));
    expect(row.indexOf("fd-title-pager")).toBeGreaterThan(row.indexOf("fd-page-title"));
    expect(row.indexOf("Mock Actions")).toBeGreaterThan(row.indexOf("fd-title-pager"));
    expect(mockedActions(html)).toEqual([
      expect.objectContaining({ variant: "menu", alignment: "right" }),
    ]);
  });

  it("keeps the title row free of actions when none are enabled", () => {
    const html = render({ copyMarkdown: false, pageActionsPosition: "title" });

    expect(html).not.toContain("fd-page-title-row");
    expect(html).not.toContain("Mock Actions");
  });
});

describe("DocsPageClient edit URL template", () => {
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        githubUrl: "https://github.com/acme/docs",
        githubDirectory: "website",
        children: React.createElement("p", null, "Body"),
        ...props,
      }),
    );

  it("derives the edit link without a template", () => {
    expect(render({})).toContain(
      'href="https://github.com/acme/docs/edit/main/website/app/docs/installation/page.mdx"',
    );
  });

  it("fills {path} with the page's source path relative to the repo", () => {
    expect(render({ githubEditUrl: "https://github.dev/acme/docs/blob/main/{path}" })).toContain(
      'href="https://github.dev/acme/docs/blob/main/website/app/docs/installation/page.mdx"',
    );
  });

  it("keeps an adapter-supplied edit link ahead of the template", () => {
    expect(
      render({
        githubEditUrl: "https://github.dev/acme/docs/blob/main/{path}",
        editOnGithubUrl: "https://example.com/edit/installation",
      }),
    ).toContain('href="https://example.com/edit/installation"');
  });
});

describe("DocsPageClient content footer", () => {
  const footer = React.createElement("p", null, "MIT License");
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(DocsPageClient, {
        tocEnabled: false,
        breadcrumbEnabled: false,
        children: React.createElement("p", null, "Body"),
        ...props,
      }),
    );

  it("renders no footer slot by default", () => {
    expect(render({})).not.toContain("fd-page-content-footer");
  });

  it("ends the content after the layout's page navigation", () => {
    const html = render({ footer, nextPage: { name: "Next", url: "/docs/next" } });

    expect(html).toContain(
      '<footer class="fd-page-content-footer not-prose"><p>MIT License</p></footer></section>',
    );
    expect(html.indexOf("fd-page-content-footer")).toBeGreaterThan(html.indexOf("fd-page-nav"));
  });

  it("follows the Fumadocs pager when the page tree supplies navigation", () => {
    const html = render({ footer });

    expect(html).toContain(
      '<nav data-fumadocs-footer=""><footer class="fd-page-content-footer not-prose"><p>MIT License</p></footer></nav></main>',
    );
    expect(html.match(/fd-page-content-footer/g)).toHaveLength(1);
  });
});

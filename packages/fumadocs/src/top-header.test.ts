import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FrameworkProvider } from "fumadocs-core/framework";
import { DocsTopHeader, type DocsTopHeaderProps } from "./top-header.js";

function render(props: Partial<DocsTopHeaderProps>, pathname = "/docs/installation") {
  return renderToStaticMarkup(
    React.createElement(FrameworkProvider, {
      usePathname: () => pathname,
      useParams: () => ({}),
      useRouter: () => ({ push() {}, refresh() {} }),
      children: React.createElement(DocsTopHeader, {
        title: "Acme",
        titleUrl: "/docs",
        links: [],
        search: true,
        askAI: false,
        themeToggle: { mode: "light-dark" },
        ...props,
      }),
    }),
  );
}

describe("DocsTopHeader", () => {
  it("renders the nav title, search, nav links and theme toggle in a header", () => {
    const html = render({
      links: [
        { label: "Docs", href: "/docs" },
        { label: "GitHub", href: "https://github.com/acme/acme", external: true },
      ],
      themeName: "ledger",
    });

    expect(html).toMatch(/^<header class="fd-top-header" data-fd-theme="ledger">/);
    expect(html).toContain('<a href="/docs" class="fd-top-header-title">Acme</a>');
    expect(html).toContain('class="fd-top-header-search" aria-label="Search documentation"');
    expect(html).toMatch(/<span>Search<\/span><kbd aria-hidden="true">⌘K<\/kbd>/);
    expect(html).toContain('<nav class="fd-top-header-links" aria-label="Site">');
    expect(html).toContain('<a href="/docs" data-active="true">Docs</a>');
    expect(html).toMatch(
      /<a href="https:\/\/github\.com\/acme\/acme" rel="noreferrer noopener" target="_blank"[^>]*>GitHub<\/a>/,
    );
    expect(html).toContain("fd-top-header-theme-toggle");
    expect(html).toContain("data-theme-toggle");
    expect(html).not.toContain("fd-top-header-ask-ai");
  });

  it("marks the link for the current page", () => {
    const html = render({ links: [{ label: "Guides", href: "/docs/guides" }] }, "/docs/guides");

    expect(html).toContain('<a href="/docs/guides" data-active="true" aria-current="page">');
  });

  it("leaves out the search trigger, theme toggle and links when they are off", () => {
    const html = render({ search: false, themeToggle: false });

    expect(html).not.toContain("fd-top-header-search");
    expect(html).not.toContain("data-theme-toggle");
    expect(html).not.toContain("fd-top-header-links");
  });

  it("adds the Ask AI trigger and a configured height", () => {
    const html = render({ askAI: true, height: 64 });

    expect(html).toContain('style="--fd-top-header-height:64px"');
    expect(html).toContain('class="fd-top-header-ask-ai" aria-label="Ask AI"');
  });
});

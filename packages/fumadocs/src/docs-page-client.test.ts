import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => "/docs/installation",
  useRouter: () => ({ push: vi.fn() }),
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
      React.createElement(
        DocsPageClient,
        {
          tocEnabled: false,
          breadcrumbEnabled: false,
          llmsTxtEnabled: true,
          locale: "en",
          children: React.createElement("article", null, "Docs"),
        },
      ),
    );

    expect(html).toContain('href="/llms.txt?lang=en"');
    expect(html).toContain('href="/llms-full.txt?lang=en"');
    expect(html).not.toContain("/api/docs?format=llms");
  });
});

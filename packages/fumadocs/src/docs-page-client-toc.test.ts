// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => "/docs/installation",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("fumadocs-ui/layouts/docs/page", async () => {
  const ReactModule = await import("react");
  return {
    DocsPage: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement("main", { id: "nd-page" }, children),
    DocsBody: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement("section", null, children),
    EditOnGitHub: ({ href }: { href: string }) =>
      ReactModule.createElement("a", { href }, "Edit on GitHub"),
  };
});

import { DocsPageClient } from "./docs-page-client.js";
import { resolveTocPageActions } from "./page-actions-config.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let toc: HTMLDivElement;
let root: Root;

beforeEach(() => {
  toc = document.createElement("div");
  toc.id = "nd-toc";
  toc.innerHTML = '<div class="sticky"></div>';
  host = document.createElement("div");
  document.body.append(toc, host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  toc.remove();
});

async function render(props: Record<string, unknown>) {
  await act(async () => {
    root.render(
      React.createElement(DocsPageClient, {
        tocEnabled: true,
        breadcrumbEnabled: false,
        generatedTitle: "Installation",
        editOnGithubUrl: "https://github.com/acme/docs/edit/main/docs/installation.mdx",
        children: React.createElement("h2", { id: "setup" }, "Setup"),
        ...props,
      }),
    );
  });
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

const rail = () => toc.querySelector<HTMLElement>(".fd-actions-toc-host .fd-page-actions-rail");
const railLabels = () =>
  Array.from(rail()?.querySelectorAll<HTMLElement>(".fd-page-action-btn") ?? []).map(
    (action) => action.textContent,
  );

describe("DocsPageClient TOC actions alongside the title actions", () => {
  it("adds no rail by default", async () => {
    await render({ copyMarkdown: true, pageActionsPosition: "below-title" });

    expect(rail()).toBeNull();
  });

  it("shows Copy page, View as Markdown and Edit on GitHub next to below-title actions", async () => {
    await render({
      copyMarkdown: true,
      pageActionsPosition: "below-title",
      tocActions: resolveTocPageActions(true),
      tocAskAi: false,
    });

    expect(railLabels()).toEqual(["Copy page", "View as Markdown", "Edit on GitHub"]);
    expect(rail()?.querySelector('a[href="/docs/installation.md"]')).not.toBeNull();
    expect(host.querySelector(".fd-below-title-block .fd-page-actions")).not.toBeNull();
    expect(document.querySelector(".fd-threadline-doc-controls")).toBeNull();
  });

  it("shows the rail with title-row menu actions", async () => {
    await render({
      copyMarkdown: true,
      pageActionsPosition: "title",
      pageActionsVariant: "menu",
      tocActions: resolveTocPageActions({ viewMarkdown: false }),
      tocAskAi: false,
    });

    expect(railLabels()).toEqual(["Copy page", "Edit on GitHub"]);
    expect(
      host.querySelector(".fd-page-title-actions .fd-page-actions-menu-trigger"),
    ).not.toBeNull();
  });

  it("leaves out Edit on GitHub without a GitHub URL", async () => {
    await render({
      editOnGithubUrl: undefined,
      tocActions: resolveTocPageActions(true),
      tocAskAi: false,
    });

    expect(railLabels()).toEqual(["Copy page", "View as Markdown"]);
  });

  it("keeps Ask AI in the rail unless it is turned off", async () => {
    await render({ tocActions: resolveTocPageActions({ copyMarkdown: false }) });
    expect(railLabels()).toContain("Ask AI");

    await render({
      tocActions: resolveTocPageActions({ copyMarkdown: false }),
      tocAskAi: false,
    });
    expect(railLabels()).not.toContain("Ask AI");
  });

  it("hides Ask AI from the position: toc rail when turned off", async () => {
    await render({ copyMarkdown: true, pageActionsPosition: "toc" });
    expect(railLabels()).toEqual(["Copy page", "Edit on GitHub", "Ask AI"]);

    await render({ copyMarkdown: true, pageActionsPosition: "toc", tocAskAi: false });
    expect(railLabels()).toEqual(["Copy page", "Edit on GitHub"]);
  });
});

describe("resolveTocPageActions", () => {
  it("is off unless configured", () => {
    expect(resolveTocPageActions(undefined)).toBeUndefined();
    expect(resolveTocPageActions(false)).toBeUndefined();
  });

  it("enables every TOC action for true and lets an object opt out", () => {
    expect(resolveTocPageActions(true)).toEqual({
      copyMarkdown: true,
      viewMarkdown: true,
      editOnGitHub: true,
    });
    expect(resolveTocPageActions({ editOnGitHub: false })).toEqual({
      copyMarkdown: true,
      viewMarkdown: true,
      editOnGitHub: false,
    });
  });
});

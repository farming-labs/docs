// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => "/docs/installation",
}));

import { resolveOpenDocsProviders } from "./open-docs-providers.js";
import { resolvePageActionDescriptions } from "./page-actions-config.js";
import { PageActionsMenu } from "./page-actions-menu.js";
import { PageActions } from "./page-actions.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function render(element: React.ReactElement) {
  await act(async () => root.render(element));
  return document.querySelector<HTMLButtonElement>(".fd-page-actions-menu-trigger")!;
}

async function press(target: Element, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

const menuItems = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]'));

const textOf = (ids: string | null) =>
  ids
    ?.split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");

describe("PageActionsMenu", () => {
  const items = (onSelect = vi.fn()) => [
    { key: "copy", label: "Copy page", onSelect },
    { key: "markdown", label: "View as Markdown", href: "/docs/installation.md" },
    { key: "mcp", label: "Copy MCP server URL", onSelect },
  ];

  it("exposes a collapsed menu button until opened", async () => {
    const trigger = await render(React.createElement(PageActionsMenu, { items: items() }));

    expect(trigger.getAttribute("aria-label")).toBe("More page actions");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("opens on click with focus on the first item and arrow-key navigation", async () => {
    const trigger = await render(React.createElement(PageActionsMenu, { items: items() }));

    await act(async () => trigger.click());

    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
    expect(menu.getAttribute("aria-label")).toBe("More page actions");
    expect(menuItems().map((item) => item.textContent)).toEqual([
      "Copy page",
      "View as Markdown",
      "Copy MCP server URL",
    ]);
    expect(menuItems().every((item) => item.tabIndex === -1)).toBe(true);
    expect(document.activeElement).toBe(menuItems()[0]);

    await press(menu, "ArrowDown");
    expect(document.activeElement).toBe(menuItems()[1]);
    await press(menu, "End");
    expect(document.activeElement).toBe(menuItems()[2]);
    await press(menu, "ArrowDown");
    expect(document.activeElement).toBe(menuItems()[0]);
    await press(menu, "ArrowUp");
    expect(document.activeElement).toBe(menuItems()[2]);
    await press(menu, "Home");
    expect(document.activeElement).toBe(menuItems()[0]);
  });

  it("opens from the keyboard on the last item with ArrowUp", async () => {
    const trigger = await render(React.createElement(PageActionsMenu, { items: items() }));

    trigger.focus();
    await press(trigger, "ArrowUp");

    expect(document.activeElement).toBe(menuItems()[2]);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = await render(React.createElement(PageActionsMenu, { items: items() }));
    trigger.focus();
    await press(trigger, "ArrowDown");

    await press(document.activeElement!, "Escape");
    // Radix restores focus in a timeout after the menu unmounts.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when Tab moves focus out of the menu", async () => {
    const trigger = await render(React.createElement(PageActionsMenu, { items: items() }));
    await act(async () => trigger.click());

    await press(document.activeElement!, "Tab");

    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("runs the selected action and closes", async () => {
    const onSelect = vi.fn();
    const trigger = await render(React.createElement(PageActionsMenu, { items: items(onSelect) }));
    await act(async () => trigger.click());

    await act(async () => menuItems()[0]!.click());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.activeElement).toBe(trigger);
  });

  it("opens links in a new tab", async () => {
    const trigger = await render(React.createElement(PageActionsMenu, { items: items() }));
    await act(async () => trigger.click());

    const link = menuItems()[1]!;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/docs/installation.md");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("names an item by its label and describes it with the second line", async () => {
    const trigger = await render(
      React.createElement(PageActionsMenu, {
        items: [
          { key: "copy", label: "Copy page", description: "Markdown, ready to paste into an LLM" },
          { key: "markdown", label: "View as Markdown", href: "/docs/installation.md" },
        ],
      }),
    );
    await act(async () => trigger.click());

    const [described, plain] = menuItems();
    expect(textOf(described!.getAttribute("aria-labelledby"))).toBe("Copy page");
    expect(textOf(described!.getAttribute("aria-describedby"))).toBe(
      "Markdown, ready to paste into an LLM",
    );
    expect(
      described!.querySelector(
        ".fd-page-action-menu-text > .fd-page-action-menu-label + .fd-page-action-menu-description",
      ),
    ).not.toBeNull();
    expect(plain!.hasAttribute("aria-labelledby")).toBe(false);
    expect(plain!.hasAttribute("aria-describedby")).toBe(false);
    expect(plain!.querySelector(".fd-page-action-menu-text")).toBeNull();
  });

  it("separates an item from the ones above it and skips the separator with the arrow keys", async () => {
    const trigger = await render(
      React.createElement(PageActionsMenu, {
        items: [
          { key: "copy", label: "Copy page", separatorBefore: true },
          { key: "markdown", label: "View as Markdown" },
          { key: "mcp", label: "Copy MCP server URL", separatorBefore: true },
        ],
      }),
    );
    await act(async () => trigger.click());

    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(
      Array.from(menu.children).map((child) => child.getAttribute("role") ?? child.tagName),
    ).toEqual(["menuitem", "menuitem", "separator", "menuitem"]);
    expect(menu.querySelector('[role="separator"]')?.className).toBe(
      "fd-page-actions-menu-separator",
    );

    expect(document.activeElement).toBe(menuItems()[0]);
    await press(menu, "ArrowDown");
    await press(menu, "ArrowDown");
    expect(document.activeElement).toBe(menuItems()[2]);
    await press(menu, "ArrowUp");
    expect(document.activeElement).toBe(menuItems()[1]);
    await press(menu, "End");
    expect(document.activeElement).toBe(menuItems()[2]);
  });

  it("renders nothing without items", async () => {
    const trigger = await render(React.createElement(PageActionsMenu, { items: [] }));

    expect(trigger).toBeNull();
  });
});

describe("PageActions menu variant", () => {
  it("lists every enabled action in order behind one trigger", async () => {
    const trigger = await render(
      React.createElement(PageActions, {
        variant: "menu",
        copyMarkdown: true,
        viewMarkdown: true,
        openDocs: true,
        providers: [
          { name: "Claude", urlTemplate: "https://claude.ai/new?q={prompt}" },
          { name: "Codex", urlTemplate: "codex://new?prompt={prompt}" },
        ],
        connectMcp: { endpoint: "https://docs.example.com/mcp" },
      }),
    );

    expect(document.querySelectorAll(".fd-page-action-btn")).toHaveLength(1);
    expect(
      document
        .querySelector("[data-page-actions-variant]")
        ?.getAttribute("data-page-actions-variant"),
    ).toBe("menu");

    await act(async () => trigger.click());

    expect(menuItems().map((item) => item.textContent)).toEqual([
      "Copy page",
      "View as Markdown",
      "Open in Claude",
      "Open in Codex",
      "Copy MCP server URL",
    ]);
  });

  it("copies the MCP server URL and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    try {
      const trigger = await render(
        React.createElement(PageActions, {
          variant: "menu",
          connectMcp: { endpoint: "/mcp" },
        }),
      );
      await act(async () => trigger.click());

      await act(async () => menuItems()[0]!.click());

      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/mcp`);
      expect(document.querySelector('[role="status"]')?.textContent).toBe("Copied MCP server URL");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  const openMenu = async (props: React.ComponentProps<typeof PageActions>) => {
    const trigger = await render(React.createElement(PageActions, { variant: "menu", ...props }));
    await act(async () => trigger.click());
    return document.querySelector<HTMLElement>('[role="menu"]')!;
  };

  const allActions = {
    copyMarkdown: true,
    viewMarkdown: true,
    openDocs: true,
    providers: resolveOpenDocsProviders([
      "claude",
      { id: "codex", description: "Open Codex in ChatGPT" },
    ]),
    connectMcp: { endpoint: "https://docs.example.com/mcp" },
  } satisfies React.ComponentProps<typeof PageActions>;

  it("renders one line per item without descriptions", async () => {
    const menu = await openMenu(allActions);

    expect(menu.querySelector(".fd-page-action-menu-description")).toBeNull();
    expect(menu.querySelector(".fd-page-action-menu-text")).toBeNull();
    expect(menu.querySelector("[aria-describedby], [aria-labelledby]")).toBeNull();
    expect(menuItems().map((item) => item.textContent)).toEqual([
      "Copy page",
      "View as Markdown",
      "Open in Claude",
      "Open in Codex",
      "Copy MCP server URL",
    ]);
  });

  it("describes each item with the built-in texts and the providers' own", async () => {
    await openMenu({ ...allActions, descriptions: resolvePageActionDescriptions(true) });

    expect(
      menuItems().map((item) => [
        textOf(item.getAttribute("aria-labelledby")),
        textOf(item.getAttribute("aria-describedby")),
      ]),
    ).toEqual([
      ["Copy page", "Markdown, ready to paste into an LLM"],
      ["View as Markdown", "This page as plain text"],
      ["Open in Claude", "Ask Claude about this page"],
      ["Open in Codex", "Open Codex in ChatGPT"],
      ["Copy MCP server URL", "Use these docs from any MCP client"],
    ]);
  });

  it("replaces one built-in description and keeps the rest", async () => {
    await openMenu({
      copyMarkdown: true,
      viewMarkdown: true,
      descriptions: resolvePageActionDescriptions({ copyMarkdown: "For your LLM" }),
    });

    expect(menuItems().map((item) => textOf(item.getAttribute("aria-describedby")))).toEqual([
      "For your LLM",
      "This page as plain text",
    ]);
  });

  it("puts a separator right before the MCP item", async () => {
    const menu = await openMenu(allActions);

    const separators = menu.querySelectorAll('[role="separator"]');
    expect(separators).toHaveLength(1);
    expect(separators[0]!.nextElementSibling?.textContent).toBe("Copy MCP server URL");
  });

  it("leaves the separator out when MCP is the only item", async () => {
    const menu = await openMenu({ connectMcp: { endpoint: "/mcp" } });

    expect(menuItems()).toHaveLength(1);
    expect(menu.querySelector('[role="separator"]')).toBeNull();
  });
});

describe("PageActions buttons variant", () => {
  it("keeps descriptions out of the buttons and the Open in dropdown", async () => {
    await act(async () =>
      root.render(
        React.createElement(PageActions, {
          copyMarkdown: true,
          viewMarkdown: true,
          openDocs: true,
          providers: resolveOpenDocsProviders(["claude"]),
          descriptions: resolvePageActionDescriptions(true),
        }),
      ),
    );
    const openIn = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Open in",
    )!;
    await act(async () => openIn.click());

    expect(document.querySelector(".fd-page-action-menu-item")?.textContent).toBe("Open in Claude");
    expect(document.body.textContent).not.toContain("Ask Claude about this page");
    expect(document.body.textContent).not.toContain("Markdown, ready to paste into an LLM");
    expect(document.querySelector(".fd-page-action-menu-description")).toBeNull();
  });
});

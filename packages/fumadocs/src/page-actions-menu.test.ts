// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => "/docs/installation",
}));

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
});

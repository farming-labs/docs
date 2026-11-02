// @vitest-environment jsdom
import React, { act, lazy } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DeferredDialog } from "./deferred-dialog.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it.each(["escape", "button", "overlay"] as const)(
  "dismisses pending dialogs by %s and restores focus",
  async (reason) => {
    const host = document.createElement("div");
    const trigger = document.createElement("button");
    document.body.append(trigger, host);
    trigger.focus();
    const root = createRoot(host);
    const Pending = lazy(() => new Promise<never>(() => {}));
    const change = vi.fn((open: boolean) => {
      root.render(
        React.createElement(DeferredDialog, {
          open,
          onOpenChange: change,
          children: React.createElement(Pending),
        }),
      );
    });
    try {
      await act(async () => {
        change(true);
      });
      const close = document.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!;
      expect(document.activeElement).toBe(close);
      const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
      document.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(close);
      await act(async () => {
        if (reason === "escape")
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        else if (reason === "button") close.click();
        else document.querySelector<HTMLElement>(".fd-ai-overlay")!.click();
      });
      expect(change).toHaveBeenLastCalledWith(false, reason);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(document.body.style.overflow).toBe("");
    } finally {
      await act(async () => root.unmount());
      host.remove();
      trigger.remove();
    }
  },
);

it("contains a failed chunk without losing the page and permits dismissal", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const error = new Error("Chunk download failed");
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  const Failed = lazy(async () => {
    throw error;
  });
  const render = (open: boolean) =>
    root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement("p", null, "Documentation remains available"),
        React.createElement(DeferredDialog, {
          open,
          onOpenChange: render,
          children: React.createElement(Failed),
        }),
      ),
    );
  try {
    await act(async () => render(true));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Reload this page");
    expect(document.querySelector("p")?.textContent).toBe("Documentation remains available");
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-busy")).toBe("false");
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  } finally {
    await act(async () => root.unmount());
    report.mockRestore();
    host.remove();
  }
});

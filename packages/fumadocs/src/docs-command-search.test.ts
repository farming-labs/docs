// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => {
  let finishDownload!: () => void;
  const download = new Promise<void>((resolve) => {
    finishDownload = resolve;
  });
  return { load: vi.fn(), push: vi.fn(), download, finishDownload };
});

vi.mock("fumadocs-core/framework", async (importOriginal) => {
  navigation.load();
  await navigation.download;
  return { ...(await importOriginal<object>()), useRouter: () => ({ push: navigation.push }) };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  vi.unstubAllGlobals();
});

it("defers search until requested, supports cancellation while loading, and retains cached results", async () => {
  const { DocsCommandSearch } = await import("./docs-command-search.js");
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  trigger.textContent = "Open Search";
  document.body.append(trigger, host);
  const root = createRoot(host);
  const events: { type: string; locale?: string; properties: Record<string, unknown> }[] = [];
  const onAnalytics = (event: Event) => events.push((event as CustomEvent).detail);
  window.addEventListener("fd:analytics", onAnalytics);
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
  });
  const fetchSearch = vi.fn(async (_url: string, _options?: RequestInit) => ({
    ok: true,
    json: async () => [
      { id: "install", type: "page", content: "Installation", url: "/docs/install" },
    ],
  }));
  vi.stubGlobal("fetch", fetchSearch);
  const key = (name: string, options: KeyboardEventInit = {}) =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, ...options }));
  const waitFor = async (assertion: () => void) => {
    await vi.waitFor(
      async () => {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });
        assertion();
      },
      { timeout: 3000 },
    );
  };
  try {
    await act(async () => {
      root.render(React.createElement(DocsCommandSearch, { locale: "fr", analytics: true }));
    });
    expect(navigation.load).not.toHaveBeenCalled();
    expect(fetchSearch).not.toHaveBeenCalled();
    trigger.focus();
    await act(async () => {
      key("k", { ctrlKey: true });
    });
    await waitFor(() => expect(navigation.load).toHaveBeenCalledOnce());
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-busy")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => {
      key("Escape");
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    await act(async () => {
      trigger.click();
    });
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      navigation.finishDownload();
      await import("./command-search-dialog.js");
    });
    await waitFor(() => expect(document.querySelector('[role="combobox"]')).not.toBeNull());
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    await waitFor(() => expect(document.activeElement).toBe(input));
    const type = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          input,
          value,
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    await type("installation");
    await waitFor(() =>
      expect(document.querySelector('[role="option"]')?.textContent).toContain("Installation"),
    );
    expect(fetchSearch).toHaveBeenCalledOnce();
    const request = new URL(fetchSearch.mock.calls[0][0] as string);
    expect(request.searchParams.get("query")).toBe("installation");
    expect(request.searchParams.get("lang")).toBe("fr");
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(navigation.push).toHaveBeenCalledWith("/docs/install?lang=fr");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await act(async () => {
      key("k", { metaKey: true });
    });
    await waitFor(() => expect(document.querySelector('[role="combobox"]')).not.toBeNull());
    const reopened = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(reopened.value).toBe("");
    expect(document.querySelector('[role="option"]')?.textContent).toContain("Installation");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        reopened,
        "installation",
      );
      reopened.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitFor(() =>
      expect(document.querySelector('[role="option"]')?.textContent).toContain("Installation"),
    );
    expect(fetchSearch).toHaveBeenCalledOnce();
    expect(navigation.load).toHaveBeenCalledOnce();
    expect(
      events
        .filter((event) => event.type === "search_open")
        .map((event) => [event.locale, event.properties.trigger]),
    ).toEqual([
      ["fr", "keyboard"],
      ["fr", "button"],
      ["fr", "keyboard"],
    ]);
    await act(async () => {
      key("Escape");
    });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(document.body.style.overflow).toBe("");
  } finally {
    navigation.finishDownload();
    vi.useRealTimers();
    await act(async () => {
      root.unmount();
    });
    window.removeEventListener("fd:analytics", onAnalytics);
    host.remove();
    trigger.remove();
    localStorage.clear();
  }
});

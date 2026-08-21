import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToWindowLocation } from "./client-location.js";

type TestWindow = EventTarget & {
  __fdHistoryPatched?: boolean;
  history: {
    pushState(data: unknown, unused: string, url?: string | URL | null): void;
    replaceState(data: unknown, unused: string, url?: string | URL | null): void;
  };
};

const originalWindow = globalThis.window;

function createTestWindow(): TestWindow {
  return Object.assign(new EventTarget(), {
    history: {
      pushState: vi.fn(),
      replaceState: vi.fn(),
    },
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("subscribeToWindowLocation", () => {
  it("notifies after the current React commit and coalesces history changes", async () => {
    const testWindow = createTestWindow();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: testWindow,
    });
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToWindowLocation(onStoreChange);

    testWindow.history.pushState(null, "", "/docs/one");
    testWindow.history.replaceState(null, "", "/docs/two");

    expect(onStoreChange).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onStoreChange).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("cancels a queued notification when the subscriber unmounts", async () => {
    const testWindow = createTestWindow();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: testWindow,
    });
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToWindowLocation(onStoreChange);

    testWindow.history.pushState(null, "", "/docs/one");
    unsubscribe();
    await Promise.resolve();

    expect(onStoreChange).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitSvelteDocsClientAnalyticsEvent,
  installSvelteDocsAnalytics,
} from "../src/lib/clientAnalytics.js";

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function installBrowserGlobals() {
  const target = {
    dispatchEvent: vi.fn(),
    localStorage: createStorage(),
    location: {
      href: "https://www.scholarxiv.com/developers/docs",
      pathname: "/developers/docs",
    },
    sessionStorage: createStorage(),
  };

  globalThis.window = target;
  globalThis.document = {
    referrer: "https://www.scholarxiv.com/",
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  globalThis.fetch = vi.fn(async () => ({ ok: true }));

  return target;
}

async function flushAnalytics() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.CustomEvent;
  delete globalThis.fetch;
  vi.restoreAllMocks();
});

describe("Svelte client analytics", () => {
  it("sends browser page views to Docs Cloud with only the public project id", async () => {
    installBrowserGlobals();
    const cleanup = installSvelteDocsAnalytics({
      env: {
        PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT: "https://analytics.example.test/events",
        PUBLIC_DOCS_CLOUD_PROJECT_ID: "project_123",
      },
    });

    emitSvelteDocsClientAnalyticsEvent({
      type: "page_view",
      input: {
        question: "private input",
      },
      path: "/developers/docs/papers-api/examples",
      properties: {
        framework: "sveltekit",
      },
    });
    await flushAnalytics();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://analytics.example.test/events",
      expect.objectContaining({
        credentials: "omit",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.projectId).toBe("project_123");
    expect(payload.event).toMatchObject({
      path: "/developers/docs/papers-api/examples",
      source: "client",
      type: "page_view",
      url: "https://www.scholarxiv.com/developers/docs",
      properties: {
        framework: "sveltekit",
      },
    });
    expect(payload.event.input).toBeUndefined();

    cleanup();
  });

  it("drains queued client events when the Svelte analytics hook installs", async () => {
    installBrowserGlobals();

    emitSvelteDocsClientAnalyticsEvent({
      type: "page_view",
      path: "/queued",
    });
    expect(fetch).not.toHaveBeenCalled();

    installSvelteDocsAnalytics({
      env: {
        PUBLIC_DOCS_CLOUD_PROJECT_ID: "project_queued",
      },
    });
    await flushAnalytics();

    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.projectId).toBe("project_queued");
    expect(payload.event.path).toBe("/queued");
  });

  it("does not install cloud analytics when analytics is explicitly disabled", async () => {
    installBrowserGlobals();

    installSvelteDocsAnalytics({
      analytics: false,
      env: {
        PUBLIC_DOCS_CLOUD_PROJECT_ID: "project_disabled",
      },
    });
    emitSvelteDocsClientAnalyticsEvent({
      type: "page_view",
      path: "/disabled",
    });
    await flushAnalytics();

    expect(fetch).not.toHaveBeenCalled();
  });
});

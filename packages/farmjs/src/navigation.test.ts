import { describe, expect, it, vi } from "vitest";
import type { DocsConfig } from "@farming-labs/docs";
import type { DocsServerLoadResult } from "./server.js";
import {
  createFarmDocsNavigator,
  type FarmDocsNavigationEnvironment,
} from "./navigation.js";
import { FARM_DOCS_NAVIGATION_HEADER } from "./runtime.js";

function page(url: string, title: string): DocsServerLoadResult {
  return {
    tree: { name: "Docs", children: [] },
    flatPages: [],
    url,
    title,
    rawContent: `# ${title}`,
    sourcePath: `${url}/page.md`,
    entry: "docs",
    previousPage: null,
    nextPage: null,
    lastModified: "August 13, 2026",
    structuredData: "{}",
  };
}

function harness(fetchImpl: FarmDocsNavigationEnvironment["fetch"]) {
  let href = "https://docs.example/docs";
  const assigned: string[] = [];
  const history: Array<{ mode: "push" | "replace"; url: string }> = [];
  const pending: boolean[] = [];
  const scroll: string[] = [];
  const data: Array<{ page: DocsServerLoadResult; scrollTarget: string | null }> = [];
  let reloads = 0;

  const environment: FarmDocsNavigationEnvironment = {
    getHref: () => href,
    fetch: fetchImpl,
    assign: (url) => assigned.push(url),
    reload: () => {
      reloads += 1;
    },
    updateHistory: (mode, url) => {
      href = url.href;
      history.push({ mode, url: url.href });
    },
    setPending: (value) => pending.push(value),
    scheduleScroll: (url) => scroll.push(url.href),
  };

  const navigator = createFarmDocsNavigator({
    config: { entry: "docs" } as DocsConfig,
    data: page("/docs", "Overview"),
    environment,
    onData: (nextPage, target) =>
      data.push({ page: nextPage, scrollTarget: target?.href ?? null }),
  });

  return {
    navigator,
    assigned,
    history,
    pending,
    scroll,
    data,
    reloads: () => reloads,
  };
}

describe("createFarmDocsNavigator", () => {
  it("keeps the current shell visible until page data is ready", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const test = harness(fetchImpl);

    const navigation = test.navigator.navigate("/docs/guides", {
      history: "push",
      scroll: true,
      fallback: "assign",
    });

    expect(test.pending).toEqual([true]);
    expect(test.data).toEqual([]);
    expect(test.history).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://docs.example/docs/guides",
      expect.objectContaining({
        cache: "no-store",
        headers: {
          Accept: "application/json",
          [FARM_DOCS_NAVIGATION_HEADER]: "1",
        },
      }),
    );

    resolveFetch?.(
      Response.json({ data: page("/docs/guides", "Guides") }),
    );
    await navigation;

    expect(test.history).toEqual([
      { mode: "push", url: "https://docs.example/docs/guides" },
    ]);
    expect(test.data[0]).toMatchObject({
      page: { title: "Guides", url: "/docs/guides" },
      scrollTarget: "https://docs.example/docs/guides",
    });
    expect(test.pending).toEqual([true, false]);
    expect(test.assigned).toEqual([]);
  });

  it("restores page data on back and forward navigation without writing history again", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const pathname = new URL(url).pathname;
      return Response.json({
        data: page(pathname, pathname === "/docs/guides" ? "Guides" : "Overview"),
      });
    });
    const test = harness(fetchImpl);

    await test.navigator.navigate("/docs/guides", {
      history: "push",
      scroll: true,
      fallback: "assign",
    });
    await test.navigator.navigate("/docs", {
      history: "none",
      scroll: false,
      fallback: "reload",
    });

    expect(test.history).toHaveLength(1);
    expect(test.data.map(({ page: value }) => value.title)).toEqual(["Guides", "Overview"]);
    expect(test.data[1]?.scrollTarget).toBeNull();
    expect(test.reloads()).toBe(0);
  });

  it("uses hard-navigation fallbacks only when a soft request fails", async () => {
    const pushFailure = harness(async () => new Response("Unavailable", { status: 503 }));
    await pushFailure.navigator.navigate("/docs/guides", {
      history: "push",
      scroll: true,
      fallback: "assign",
    });

    expect(pushFailure.assigned).toEqual(["https://docs.example/docs/guides"]);
    expect(pushFailure.data).toEqual([]);

    const popFailure = harness(async () => new Response("Unavailable", { status: 503 }));
    await popFailure.navigator.navigate("/docs/guides", {
      history: "none",
      scroll: false,
      fallback: "reload",
    });

    expect(popFailure.reloads()).toBe(1);
    expect(popFailure.assigned).toEqual([]);
  });

  it("preserves normal browser behavior for non-docs and same-page hash links", async () => {
    const fetchImpl = vi.fn<FarmDocsNavigationEnvironment["fetch"]>();
    const test = harness(fetchImpl);

    await test.navigator.navigate("/dashboard", {
      history: "push",
      scroll: true,
      fallback: "assign",
    });
    await test.navigator.navigate("/docs#install", {
      history: "push",
      scroll: true,
      fallback: "assign",
    });

    expect(test.assigned).toEqual(["https://docs.example/dashboard"]);
    expect(test.history).toEqual([
      { mode: "push", url: "https://docs.example/docs#install" },
    ]);
    expect(test.scroll).toEqual(["https://docs.example/docs#install"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

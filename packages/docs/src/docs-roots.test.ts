import { describe, expect, it } from "vitest";
import { createDocsRootHandler, createDocsRootRouter } from "./docs-roots.js";

const roots = [{ entry: "docs" }, { entry: "statewire/docs" }, { entry: "/pinboard/docs/" }];

const select = (url: string, headers?: Record<string, string>) => {
  const { root, varyReferer } = createDocsRootRouter(roots).select(
    new Request(`https://site.test${url}`, headers ? { headers } : undefined),
  );
  return { entry: root.entry, varyReferer };
};

describe("createDocsRootRouter", () => {
  it("sends pages, Markdown mirrors and nested paths to the root that owns them", () => {
    expect(select("/statewire/docs")).toEqual({ entry: "statewire/docs", varyReferer: false });
    expect(select("/statewire/docs.md").entry).toBe("statewire/docs");
    expect(select("/statewire/docs/spec/").entry).toBe("statewire/docs");
    expect(select("/pinboard/docs/fleet").entry).toBe("/pinboard/docs/");
    expect(select("/docs/spec").entry).toBe("docs");
  });

  it("does not match a root by prefix alone", () => {
    expect(select("/statewire/docsearch").entry).toBe("docs");
  });

  it("sends site-wide files and MCP to the first root", () => {
    expect(select("/llms.txt").entry).toBe("docs");
    expect(select("/robots.txt").entry).toBe("docs");
  });

  it("picks the API root from ?root=, then ?pathname=, then the Referer", () => {
    const referer = { referer: "https://site.test/pinboard/docs/fleet" };
    expect(select("/api/docs?root=statewire/docs&query=x", referer)).toEqual({
      entry: "statewire/docs",
      varyReferer: false,
    });
    expect(select("/api/docs?pathname=/statewire/docs/spec", referer)).toEqual({
      entry: "statewire/docs",
      varyReferer: false,
    });
    expect(select("/api/docs?query=x", referer)).toEqual({
      entry: "/pinboard/docs/",
      varyReferer: true,
    });
    expect(select("/api/docs/mcp", referer).entry).toBe("/pinboard/docs/");
  });

  it("falls back to the first root for an unknown or missing API root", () => {
    expect(select("/api/docs?root=nope").entry).toBe("docs");
    expect(select("/api/docs?query=x")).toEqual({ entry: "docs", varyReferer: true });
    expect(select("/api/docs?query=x", { referer: "not a url" }).entry).toBe("docs");
  });

  it("honors a custom API route", () => {
    const router = createDocsRootRouter(roots, { apiRoute: "/internal/search/" });
    const request = new Request("https://site.test/internal/search?query=x", {
      headers: { referer: "https://site.test/statewire/docs" },
    });
    expect(router.select(request).root.entry).toBe("statewire/docs");
    expect(router.select(new Request("https://site.test/api/docs?root=statewire/docs")).root).toBe(
      router.primary,
    );
  });

  it("rejects two roots with the same entry and an empty list", () => {
    expect(() => createDocsRootRouter([{ entry: "docs" }, { entry: "/docs/" }])).toThrow(
      "two docs roots share the entry /docs",
    );
    expect(() => createDocsRootRouter([])).toThrow("at least one root");
  });
});

describe("createDocsRootHandler", () => {
  const handler = createDocsRootHandler([
    { entry: "docs", handle: () => new Response("harness") },
    {
      entry: "statewire/docs",
      handle: (request) =>
        new URL(request.url).pathname === "/statewire/docs/missing"
          ? null
          : Response.redirect("https://site.test/statewire/docs/spec", 307),
    },
  ]);

  it("answers from the selected root and varies API responses chosen by Referer", async () => {
    const page = await handler(new Request("https://site.test/docs/spec"));
    expect(await page?.text()).toBe("harness");
    expect(page?.headers.get("vary")).toBeNull();

    const search = await handler(
      new Request("https://site.test/api/docs?query=x", {
        headers: { referer: "https://site.test/statewire/docs" },
      }),
    );
    expect(search?.status).toBe(307);
    expect(search?.headers.get("vary")).toBe("Referer");
    expect(search?.headers.get("location")).toBe("https://site.test/statewire/docs/spec");
  });

  it("passes through a root that does not handle the request", async () => {
    expect(await handler(new Request("https://site.test/statewire/docs/missing"))).toBeNull();
  });
});

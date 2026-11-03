import { describe, expect, it } from "vitest";
import { defineDocsHandler, defineDocsMcpHandler, defineDocsPublicHandler } from "../src/server.js";

const assets: Record<string, Record<string, string>> = {
  "assets:docs": {
    "index.md": "---\ntitle: Harness overview\n---\n\nThe harness guide.\n",
  },
  "assets:statewire/docs": {
    "index.md": "---\ntitle: Statewire overview\n---\n\nThe statewire guide.\n",
    "spec:index.md": "---\ntitle: Statewire spec\n---\n\nThe statewire spec guide.\n",
  },
};

const storage = (base: string) => ({
  getKeys: async () => Object.keys(assets[base] ?? {}),
  getItem: async (key: string) => assets[base]?.[key] ?? null,
});

const config = {
  entry: "docs",
  nav: { title: "Harness" },
  llmsTxt: { enabled: true, siteTitle: "Harness" },
  roots: [
    { entry: "statewire/docs", nav: { title: "Statewire" }, llmsTxt: { siteTitle: "Statewire" } },
  ],
};

function createEvent(method: string, url: string, referer?: string) {
  const headers: Record<string, string> = referer ? { referer: `https://site.test${referer}` } : {};
  return { method, headers, node: { req: { method, url, headers } } } as any;
}

describe("docs roots from the docs config", () => {
  const handler = defineDocsHandler(config, storage);

  it("loads a page from the root that owns ?pathname=, whatever the Referer", async () => {
    const statewire = await handler(
      createEvent("GET", "/api/docs?pathname=/statewire/docs/spec", "/docs"),
    );
    expect(statewire).toMatchObject({ title: "Statewire spec", entry: "statewire/docs" });

    const harness = await handler(
      createEvent("GET", "/api/docs?pathname=/docs", "/statewire/docs"),
    );
    expect(harness).toMatchObject({ title: "Harness overview", entry: "docs" });
  });

  it("searches the root of the page that asked and varies on the Referer", async () => {
    const statewire = (await handler(
      createEvent("GET", "/api/docs?query=guide", "/statewire/docs/spec"),
    )) as Response;
    expect(statewire.headers.get("vary")).toContain("Referer");
    const statewireUrls = (await statewire.json()).map((result: { url: string }) => result.url);
    expect(statewireUrls.length).toBeGreaterThan(0);
    expect(statewireUrls.every((url: string) => url.startsWith("/statewire/docs"))).toBe(true);

    const harness = (await handler(
      createEvent("GET", "/api/docs?query=guide", "/docs"),
    )) as Response;
    expect(harness.headers.get("vary")).toContain("Referer");
    const harnessUrls = (await harness.json()).map((result: { url: string }) => result.url);
    expect(harnessUrls.length).toBeGreaterThan(0);
    expect(harnessUrls.every((url: string) => url.startsWith("/docs"))).toBe(true);
  });

  it("serves a root's llms.txt when the link names the root", async () => {
    const response = (await handler(
      createEvent("GET", "/api/docs?format=llms&root=statewire%2Fdocs"),
    )) as Response;
    const llms = await response.text();
    expect(llms).toContain("# Statewire");
    expect(llms).toContain("/statewire/docs/spec.md");
    expect(llms).not.toContain("Harness overview");
  });

  it("serves each root's Markdown mirrors, but site-wide llms.txt and MCP from the first root", async () => {
    const publicHandler = defineDocsPublicHandler(config, storage);
    const mirror = (await publicHandler(
      createEvent("GET", "/statewire/docs/spec.md", "/docs"),
    )) as Response;
    expect(await mirror.text()).toContain("The statewire spec guide.");

    const llms = (await publicHandler(
      createEvent("GET", "/llms.txt", "/statewire/docs/spec"),
    )) as Response;
    const body = await llms.text();
    expect(body).toContain("# Harness");
    expect(body).not.toContain("Statewire");

    const initialize = (event: any) => {
      event.node.req.headers["content-type"] = "application/json";
      event.node.req.headers.accept = "application/json, text/event-stream";
      event.web = {
        request: new Request(`https://site.test${event.node.req.url}`, {
          method: "POST",
          headers: event.node.req.headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-03-26",
              capabilities: {},
              clientInfo: { name: "test", version: "0" },
            },
          }),
        }),
      };
      return event;
    };
    for (const response of [
      await publicHandler(initialize(createEvent("POST", "/api/docs/mcp", "/statewire/docs"))),
      await defineDocsMcpHandler(
        config,
        storage,
      )(initialize(createEvent("POST", "/api/docs/mcp", "/statewire/docs"))),
    ]) {
      expect(await (response as Response).text()).toContain('"name":"Harness"');
    }
  });

  it("rejects two roots with the same entry", () => {
    expect(() =>
      defineDocsHandler({ entry: "docs", roots: [{ entry: "/docs/" }] }, storage),
    ).toThrow("two docs roots share the entry /docs");
  });

  it("keeps a config without roots on one server with no Vary", async () => {
    const single = defineDocsHandler({ entry: "docs" }, storage);
    const page = await single(createEvent("GET", "/api/docs?pathname=/docs", "/statewire/docs"));
    expect(page).toMatchObject({ title: "Harness overview" });
    const search = (await single(
      createEvent("GET", "/api/docs?query=guide", "/statewire/docs"),
    )) as Response;
    expect(search.headers.get("vary")).toBeNull();
  });
});

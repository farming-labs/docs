import { describe, expect, it } from "vitest";
import { createDocsServer } from "../src/server.js";

const page = (title: string) =>
  `---\ntitle: "${title}"\n---\n\n# ${title}\n\nShared roots needle.\n`;

const server = createDocsServer({
  entry: "docs",
  contentDir: "content/harness",
  nav: { title: "Harness Docs" },
  mcp: true,
  roots: [{ entry: "statewire/docs", nav: { title: "Statewire Docs" } }],
  _preloadedContent: {
    "/content/harness/page.md": page("Harness intro"),
    "/statewire/docs/page.md": page("Statewire intro"),
    "/statewire/docs/spec/page.md": page("Statewire spec"),
  },
});

const get = (path: string, referer?: string) =>
  server.GET({
    request: new Request(`https://site.test${path}`, referer ? { headers: { referer } } : {}),
  });

async function searchUrls(response: Response) {
  const results = (await response.json()) as Array<{ url: string }>;
  return [...new Set(results.map((result) => result.url.split("#")[0]))].sort();
}

describe("createDocsServer with roots", () => {
  it("loads each page from the root that owns its path, from that root's content", async () => {
    expect((await server.load("/docs")).title).toBe("Harness intro");
    const spec = await server.load("https://site.test/statewire/docs/spec");
    expect(spec.title).toBe("Statewire spec");
    expect(spec.flatPages.map((node) => node.url)).toEqual([
      "/statewire/docs",
      "/statewire/docs/spec",
    ]);
  });

  it("searches the root of the page that asked and varies on the Referer", async () => {
    const harness = await get("/api/docs?query=needle", "https://site.test/docs");
    expect(harness.headers.get("vary")).toContain("Referer");
    expect(await searchUrls(harness)).toEqual(["/docs"]);

    const statewire = await get("/api/docs?query=needle", "https://site.test/statewire/docs/spec");
    expect(statewire.headers.get("vary")).toContain("Referer");
    expect(await searchUrls(statewire)).toEqual(["/statewire/docs", "/statewire/docs/spec"]);
  });

  it("lets ?root= and ?pathname= choose the API root over the Referer", async () => {
    const referer = "https://site.test/statewire/docs/spec";
    const named = await get("/api/docs?query=needle&root=docs", referer);
    expect(named.headers.get("vary")).toBeNull();
    expect(await searchUrls(named)).toEqual(["/docs"]);

    const byPath = await get("/api/docs?query=needle&pathname=/docs", referer);
    expect(byPath.headers.get("vary")).toBeNull();
    expect(await searchUrls(byPath)).toEqual(["/docs"]);

    const llms = await get("/api/docs?format=llms&root=statewire/docs");
    expect(await llms.text()).toContain("Statewire intro");
  });

  it("serves site-wide files and MCP from the first root", async () => {
    const referer = "https://site.test/statewire/docs";
    const rootLlms = await (await get("/api/docs?format=llms", referer)).text();
    expect(rootLlms).toContain("Statewire intro");
    const llms = await (await get("/llms.txt", referer)).text();
    expect(llms).toContain("Harness intro");
    expect(llms).not.toContain("Statewire");

    const response = await server.MCP.POST({
      request: new Request("https://site.test/api/docs/mcp", {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "docs-roots-test", version: "1" },
          },
        }),
      }),
    });
    expect(await response.text()).toContain('"name":"Harness Docs"');
  });

  it("rejects a root that reuses an entry", () => {
    expect(() => createDocsServer({ entry: "docs", roots: [{ entry: "/docs/" }] })).toThrow(
      "two docs roots share the entry /docs",
    );
  });
});

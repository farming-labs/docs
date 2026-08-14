import { describe, expect, it } from "vitest";
import { createDocsMarkdownResponse, renderDocsLlmsTxt } from "./agent.js";
import { buildDocsContentSnapshot, performDocsSearch } from "./search.js";
import type { DocsAccessPrincipal, DocsSearchSourcePage } from "./types.js";

const principal: DocsAccessPrincipal = {
  id: "agent-1",
  scopes: ["docs:private"],
  claims: { role: "editor" },
};

const pages: DocsSearchSourcePage[] = [
  {
    title: "Public guide",
    url: "/docs/public",
    content: "Public installation guidance.",
  },
  {
    title: "Private runbook",
    url: "/docs/private",
    content: "Private sentinel deployment runbook.",
    agent: {
      access: {
        scopes: ["docs:private"],
        claims: { role: ["admin", "editor"] },
      },
    },
  },
];

describe("page access across agent surfaces", () => {
  it("omits protected pages from public llms.txt, search, and content sync", async () => {
    const llms = renderDocsLlmsTxt(pages);
    expect(llms.llmsFullTxt).toContain("Public installation guidance");
    expect(llms.llmsFullTxt).not.toContain("Private sentinel");

    expect(await performDocsSearch({ pages, query: "sentinel" })).toEqual([]);
    expect(
      (await buildDocsContentSnapshot({ pages })).documents.map((document) => document.url),
    ).toEqual(["/docs/public"]);
  });

  it("includes protected search and sync content for a matching principal", async () => {
    const results = await performDocsSearch({ pages, query: "sentinel", principal });
    expect(results[0]?.url).toBe("/docs/private");
    expect(
      (await buildDocsContentSnapshot({ pages, principal })).documents.map(
        (document) => document.url,
      ),
    ).toEqual(["/docs/private", "/docs/public"]);
  });

  it("returns a private, body-free 404 for denied Markdown requests", async () => {
    const request = new Request("https://docs.example.com/docs/private.md");
    const denied = createDocsMarkdownResponse({
      request,
      requestedPath: "private",
      document: "Private sentinel deployment runbook.",
      access: pages[1]!.agent!.access,
    });
    expect(denied.status).toBe(404);
    expect(denied.headers.get("cache-control")).toBe("private, no-store");
    expect(await denied.text()).not.toContain("sentinel");

    const allowed = createDocsMarkdownResponse({
      request,
      requestedPath: "private",
      document: "Private sentinel deployment runbook.",
      access: pages[1]!.agent!.access,
      principal,
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain("Private sentinel");
  });

  it("does not leak protected pages through Markdown recovery suggestions", async () => {
    const response = createDocsMarkdownResponse({
      request: new Request("https://docs.example.com/docs/privat.md"),
      requestedPath: "privat",
      document: null,
      pages,
    });
    expect(await response.text()).not.toContain("Private runbook");
  });
});

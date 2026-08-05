import { describe, expect, it } from "vitest";
import { createDocsServer } from "./server.js";

const config = {
  entry: "docs",
  nav: { title: "Farm Docs" },
  mcp: true,
  sitemap: true,
  robots: true,
  _preloadedContent: {
    "/docs/page.md": `---
title: Introduction
description: Build a Farm application.
---

# Introduction

Farm documentation content.`,
  },
};

describe("createDocsServer", () => {
  it("loads page data for the Farm React renderer", async () => {
    const server = createDocsServer(config);
    const page = await server.load({ pathname: "/docs" });

    expect(page).toMatchObject({
      title: "Introduction",
      description: "Build a Farm application.",
      url: "/docs",
    });
  });

  it("handles docs endpoints and falls through for application routes", async () => {
    const server = createDocsServer(config);

    const search = await server.handle(
      new Request("https://farm.example/api/docs?query=documentation"),
    );
    expect(search?.status).toBe(200);
    expect(await search?.text()).toContain("Introduction");

    const markdown = await server.handle(new Request("https://farm.example/docs.md"));
    expect(markdown?.headers.get("content-type")).toContain("text/markdown");
    expect(await markdown?.text()).toContain("Farm documentation content.");

    const applicationRoute = await server.handle(new Request("https://farm.example/dashboard"));
    expect(applicationRoute).toBeNull();
  });

  it("dispatches public MCP aliases through the wrapper", async () => {
    const server = createDocsServer(config);
    const response = await server.handle(
      new Request("https://farm.example/.well-known/mcp", {
        method: "OPTIONS",
        headers: { Origin: "https://farm.example" },
      }),
    );

    expect(response?.status).toBeLessThan(500);
    expect(response).not.toBeNull();
  });
});

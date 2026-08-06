import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { createDocsServer, createFarmDocsRuntimeHandler } from "./server.js";

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
      descriptionInBody: false,
      url: "/docs",
    });
  });

  it("does not ask the client renderer to repeat an authored lead description", async () => {
    const server = createDocsServer({
      ...config,
      _preloadedContent: {
        "/docs/page.md": `---
title: Introduction
description: Build a Farm application.
---

# Introduction

Build a Farm application.

## Create an app`,
      },
    });

    const page = await server.load({ pathname: "/docs" });

    expect(page.description).toBe("Build a Farm application.");
    expect(page.descriptionInBody).toBe(true);
  });

  it("opens configured pixel-border navigation groups by default", async () => {
    const server = createDocsServer({
      ...config,
      theme: { name: "fumadocs-pixel-border" },
      navigation: {
        sidebar: [
          {
            label: "Start",
            children: [{ label: "Guide", slug: "guide" }],
          },
        ],
      },
      _preloadedContent: {
        "/docs/guide/page.md": "# Guide",
      },
    } as any);

    const page = await server.load({ pathname: "/docs/guide" });

    expect(page.tree.children[0]).toMatchObject({
      type: "folder",
      name: "Start",
      defaultOpen: true,
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

describe("createFarmDocsRuntimeHandler", () => {
  it("loads the adapter base CSS before host theme stylesheets", async () => {
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      stylesheets: ["/src/app/globals.css"],
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }) => createElement("main", null, data.title),
      }),
    });

    const response = await handler(new Request("https://farm.example/docs"));
    const html = await response?.text();

    expect(response?.status).toBe(200);
    expect(html).toContain('<link rel="stylesheet" href="/__farm_docs/browser.css">');
    expect(html).toContain('<link rel="stylesheet" href="/src/app/globals.css">');
    expect(html?.indexOf("/__farm_docs/browser.css")).toBeLessThan(
      html?.indexOf("/src/app/globals.css") ?? -1,
    );
  });
});

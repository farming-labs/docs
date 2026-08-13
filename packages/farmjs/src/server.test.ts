import { createElement } from "react";
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

  it("keeps configured navigation groups open for flat sidebars", async () => {
    const server = createDocsServer({
      ...config,
      sidebar: { flat: true },
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
      collapsible: false,
      defaultOpen: true,
    });
  });

  it("includes standalone Markdown pages and file-only folders in bundled navigation", async () => {
    const server = createDocsServer({
      ...config,
      ordering: [
        { slug: "capabilities" },
        { slug: "api", children: [{ slug: "v1" }, { slug: "v0-core" }] },
      ],
      _preloadedContent: {
        "/docs/page.md": config._preloadedContent["/docs/page.md"],
        "/docs/capabilities.md": `---\ntitle: Capabilities\n---\n# Capabilities`,
        "/docs/api/v0-core.md": `---\ntitle: v0 parity\n---\n# v0 parity`,
        "/docs/api/v1.md": `---\ntitle: API v1\n---\n# API v1`,
      },
    });

    const page = await server.load({ pathname: "/docs" });

    expect(page.tree.children).toMatchObject([
      { type: "page", name: "Introduction", url: "/docs" },
      { type: "page", name: "Capabilities", url: "/docs/capabilities" },
      {
        type: "folder",
        name: "Api",
        children: [
          { type: "page", name: "API v1", url: "/docs/api/v1" },
          { type: "page", name: "v0 parity", url: "/docs/api/v0-core" },
        ],
      },
    ]);
  });

  it("includes standalone Markdown pages and file-only folders in filesystem navigation", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "farm-docs-flat-navigation-"));
    const contentDir = path.join(rootDir, "docs");

    try {
      mkdirSync(path.join(contentDir, "api"), { recursive: true });
      writeFileSync(path.join(contentDir, "page.md"), `---\ntitle: Introduction\n---\n# Intro`);
      writeFileSync(
        path.join(contentDir, "capabilities.md"),
        `---\ntitle: Capabilities\norder: 1\n---\n# Capabilities`,
      );
      writeFileSync(path.join(contentDir, "api", "v1.md"), `---\ntitle: API v1\n---\n# API v1`);

      const server = createDocsServer({
        entry: "docs",
        contentDir,
        rootDir,
        ordering: "numeric",
      });
      const page = await server.load({ pathname: "/docs" });

      expect(page.tree.children).toMatchObject([
        { type: "page", name: "Introduction", url: "/docs" },
        { type: "page", name: "Capabilities", url: "/docs/capabilities" },
        {
          type: "folder",
          name: "Api",
          children: [{ type: "page", name: "API v1", url: "/docs/api/v1" }],
        },
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("derives Edit on GitHub from the configured content directory", async () => {
    const server = createDocsServer({
      ...config,
      contentDir: "src/app/docs",
      github: "https://github.com/farming-labs/farm.js/",
      _preloadedContent: {
        "/src/app/docs/page.md": config._preloadedContent["/docs/page.md"],
      },
    });
    const page = await server.load({ pathname: "/docs" });

    expect(page.editOnGithub).toBe(
      "https://github.com/farming-labs/farm.js/edit/main/src/app/docs/page.md",
    );
  });

  it("prefixes Edit on GitHub with a monorepo directory", async () => {
    const server = createDocsServer({
      ...config,
      contentDir: "src/app/docs",
      github: {
        url: "https://github.com/farming-labs/farm.js",
        branch: "next",
        directory: "docs",
      },
      _preloadedContent: {
        "/src/app/docs/page.md": config._preloadedContent["/docs/page.md"],
      },
    });
    const page = await server.load({ pathname: "/docs" });

    expect(page.editOnGithub).toBe(
      "https://github.com/farming-labs/farm.js/edit/next/docs/src/app/docs/page.md",
    );
  });

  it("uses bundled Git dates instead of deployment file mtimes", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "farm-docs-last-modified-"));
    const contentDir = path.join(rootDir, "docs");
    const pagePath = path.join(contentDir, "page.md");

    try {
      mkdirSync(contentDir, { recursive: true });
      writeFileSync(pagePath, "# Farm Docs\n");
      utimesSync(
        pagePath,
        new Date("2018-10-20T00:00:00.000Z"),
        new Date("2018-10-20T00:00:00.000Z"),
      );
      writeFileSync(
        path.join(contentDir, ".farm-docs-last-modified.json"),
        JSON.stringify({
          version: 1,
          pages: { "page.md": "2026-08-09T04:25:45+03:00" },
        }),
      );

      const server = createDocsServer({
        entry: "docs",
        contentDir,
        rootDir,
        nav: { title: "Farm Docs" },
        sitemap: true,
      });
      const page = await server.load({ pathname: "/docs" });
      const sitemap = await server.handle(new Request("https://farm.example/sitemap.xml"));

      expect(page.lastModified).toBe("August 9, 2026");
      expect(await sitemap?.text()).toContain("<lastmod>2026-08-09</lastmod>");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
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
  it("serves the bundled adapter CSS without a runtime filesystem dependency", async () => {
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }) => createElement("main", null, data.title),
      }),
    });

    const response = await handler(new Request("https://farm.example/__farm_docs/browser.css"));
    const css = await response?.text();

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/css");
    expect(css?.length).toBeGreaterThan(100_000);
    expect(css).toContain(".\\[\\&_svg\\]\\:size-4");
  });

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

  it("reflects declared page actions and the derived GitHub edit URL", async () => {
    const handler = createFarmDocsRuntimeHandler(
      {
        ...config,
        contentDir: "src/app/docs",
        github: {
          url: "https://github.com/farming-labs/farm.js",
          directory: "docs",
        },
        pageActions: {
          copyMarkdown: { enabled: true },
          alignment: "right",
        },
        _preloadedContent: {
          "/src/app/docs/page.md": config._preloadedContent["/docs/page.md"],
        },
      },
      {
        clientEntry: "/farm-client.js",
        loadReactModule: async () => ({
          FarmDocsPage: ({ data }) => createElement("main", null, data.title),
        }),
      },
    );

    const response = await handler(new Request("https://farm.example/docs"));
    const html = await response?.text();

    expect(html).toContain('"pageActions":{"copyMarkdown":{"enabled":true},"alignment":"right"}');
    expect(html).toContain(
      '"editOnGithub":"https://github.com/farming-labs/farm.js/edit/main/docs/src/app/docs/page.md"',
    );
  });
});

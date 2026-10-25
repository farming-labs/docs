import { Suspense, createElement } from "react";
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDocsServer, createFarmDocsRuntimeHandler } from "./server.js";
import { FARM_DOCS_NAVIGATION_HEADER } from "./runtime.js";

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

  it("leaves the API reference path to the app when the reference is not configured", async () => {
    const server = createDocsServer(config);

    await expect(server.handle(new Request("https://farm.test/api-reference"))).resolves.toBeNull();
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

  it("reads navigation once when the content is immutable, and on every load otherwise", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "farm-docs-immutable-navigation-"));
    const contentDir = path.join(rootDir, "docs");
    const names = async (server: ReturnType<typeof createDocsServer>) =>
      (await server.load({ pathname: "/docs" })).tree.children.map((node) => node.name);

    try {
      mkdirSync(contentDir, { recursive: true });
      writeFileSync(path.join(contentDir, "page.md"), `---\ntitle: Introduction\n---\n# Intro`);
      const production = createDocsServer({
        entry: "docs",
        contentDir,
        rootDir,
        _immutableContent: true,
      });
      const development = createDocsServer({ entry: "docs", contentDir, rootDir });
      expect(await names(production)).toEqual(["Introduction"]);
      expect(await names(development)).toEqual(["Introduction"]);

      writeFileSync(path.join(contentDir, "added.md"), `---\ntitle: Added\n---\n# Added`);

      // A production process serves the build it started with.
      expect(await names(production)).toEqual(["Introduction"]);
      // Development keeps picking up edits.
      expect(await names(development)).toEqual(["Introduction", "Added"]);
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

  it("serves bundled root agent documents when the project files are absent", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "farmjs-root-documents-"));
    try {
      const server = createDocsServer({
        ...config,
        rootDir,
        _preloadedRootDocuments: {
          "skill.md":
            "---\nname: site\ndescription: Use this site through its docs.\n---\n\n# Site skill\n",
          "AGENTS.md": "# Site agents\n",
        },
      });

      const skill = await server.handle(new Request("https://farm.example/skill.md"));
      expect(await skill?.text()).toContain("# Site skill");

      const agents = await server.handle(new Request("https://farm.example/AGENTS.md"));
      expect(await agents?.text()).toContain("# Site agents");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps server file paths out of agent search, trust, and MCP output", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "farm-docs-server-paths-"));
    const contentDir = path.join(rootDir, "farm-docs-content");
    try {
      mkdirSync(path.join(contentDir, "routing"), { recursive: true });
      writeFileSync(
        path.join(contentDir, "page.md"),
        "---\ntitle: Introduction\n---\n\n# Introduction\n\nFarm routing basics.\n",
      );
      writeFileSync(
        path.join(contentDir, "routing", "page.md"),
        "---\ntitle: Routing\n---\n\n# Routing\n\nFile based routing for Farm apps.\n",
      );
      const server = createDocsServer({
        entry: "docs",
        contentDir,
        rootDir,
        nav: { title: "Farm Docs" },
        mcp: true,
        agent: { okf: true },
      } as any);

      async function mcp(id: number, name: string, args: Record<string, unknown>) {
        const response = await server.handle(
          new Request("https://farm.example/api/docs/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              "mcp-protocol-version": "2025-06-18",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              method: "tools/call",
              params: { name, arguments: args },
            }),
          }),
        );
        return (await response?.text()) ?? "";
      }

      const structured = await server.handle(
        new Request(
          "https://farm.example/api/docs?query=routing&audience=agent&response=structured",
        ),
      );
      const structuredBody = (await structured?.text()) ?? "";
      expect(structuredBody).toContain('"id":"routing/page.md"');

      const outputs = [
        structuredBody,
        await (await server.handle(
          new Request("https://farm.example/api/docs?query=routing"),
        ))!.text(),
        await mcp(1, "search_docs", { query: "routing" }),
        await mcp(2, "list_pages", {}),
        await mcp(3, "read_page", { path: "/docs/routing" }),
        await mcp(4, "get_trust_metadata", {}),
        await mcp(5, "get_context", { query: "routing" }),
        await (await server.handle(new Request("https://farm.example/llms-full.txt")))!.text(),
        await (await server.handle(new Request("https://farm.example/docs/routing.md")))!.text(),
      ];
      expect(outputs[2]).toContain("/docs/routing");
      expect(outputs[5]).toContain('"id":"routing/page.md"');
      for (const output of outputs) {
        expect(output).not.toContain('"isError":true');
        expect(output).not.toContain(rootDir.replace(/\\/g, "/"));
        expect(output).not.toContain(JSON.stringify(rootDir).slice(1, -1));
      }
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

  it("reports the app's package.json version as the MCP server version", async () => {
    async function initialize(server: ReturnType<typeof createDocsServer>) {
      const response = await server.handle(
        new Request("https://farm.example/api/docs/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "test", version: "1.0.0" },
            },
          }),
        }),
      );
      const body = (await response?.text()) ?? "";
      const payload = body.trim().startsWith("{")
        ? body
        : body
            .split("\n")
            .find((line) => line.startsWith("data:"))
            ?.slice("data:".length);
      return JSON.parse(payload ?? "null")?.result?.serverInfo as
        | { name: string; version: string }
        | undefined;
    }

    const rootDir = mkdtempSync(path.join(tmpdir(), "farmjs-mcp-version-"));
    try {
      writeFileSync(
        path.join(rootDir, "package.json"),
        JSON.stringify({ name: "farm-site", version: "2.7.1" }),
      );
      expect(await initialize(createDocsServer({ ...config, rootDir }))).toEqual(
        expect.objectContaining({ name: "Farm Docs", version: "2.7.1" }),
      );
      expect(
        await initialize(createDocsServer({ ...config, rootDir, mcp: { version: "9.0.0" } })),
      ).toEqual(expect.objectContaining({ version: "9.0.0" }));
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }

    const missingRoot = mkdtempSync(path.join(tmpdir(), "farmjs-mcp-version-missing-"));
    try {
      expect(await initialize(createDocsServer({ ...config, rootDir: missingRoot }))).toEqual(
        expect.objectContaining({ version: "0.0.0" }),
      );
    } finally {
      rmSync(missingRoot, { recursive: true, force: true });
    }
  });

  it("serves an MCP server card below each public MCP endpoint", async () => {
    const server = createDocsServer({ ...config, mcp: { version: "3.0.0" } });

    for (const endpoint of ["/api/docs/mcp", "/mcp", "/.well-known/mcp"]) {
      const response = await server.handle(
        new Request(`https://farm.example${endpoint}/server-card`),
      );
      expect(response?.status).toBe(200);
      expect(response?.headers.get("content-type")).toContain("application/mcp-server-card+json");
      expect(await response?.json()).toMatchObject({
        name: "example.farm/docs",
        title: "Farm Docs",
        version: "3.0.0",
        websiteUrl: "https://farm.example/docs",
        remotes: [{ type: "streamable-http", url: `https://farm.example${endpoint}` }],
      });
    }

    expect(
      await server.handle(new Request("https://farm.example/dashboard/server-card")),
    ).toBeNull();
    const disabled = await createDocsServer({ ...config, mcp: false }).handle(
      new Request("https://farm.example/api/docs/mcp/server-card"),
    );
    expect(disabled?.headers.get("content-type") ?? "").not.toContain("mcp-server-card");
  });

  it("links an existing OpenAPI document in the API catalog without apiReference", async () => {
    const server = createDocsServer({
      ...config,
      docsPath: "/docs",
      llmsTxt: { enabled: true, siteTitle: "Farm Docs" },
      agent: { apiCatalog: { openapi: "/openapi.json" } },
    });
    const response = await server.handle(
      new Request("https://farm.example/.well-known/api-catalog"),
    );
    const catalog = (await response?.json()) as {
      linkset: Array<{
        anchor: string;
        item?: Array<{ href: string }>;
        "service-desc"?: Array<{ href: string; type?: string }>;
      }>;
    };
    const root = catalog.linkset.find((context) => context.anchor === "https://farm.example/");

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("application/linkset+json");
    expect(catalog.linkset[0]?.item?.map(({ href }) => href)).toContain("https://farm.example/");
    expect(root?.["service-desc"]).toEqual([
      expect.objectContaining({
        href: "https://farm.example/openapi.json",
        type: "application/vnd.oai.openapi+json",
      }),
    ]);
    expect(JSON.stringify(catalog)).not.toContain("format=openapi");
    expect(await server.handle(new Request("https://farm.example/api-reference"))).toBeNull();
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
  it("lists the docs MCP endpoint with the host's AI catalog", () => {
    const registered: unknown[] = [];
    createFarmDocsRuntimeHandler(
      { ...config, mcp: { version: "3.0.0" } },
      {
        registerMCPServer: (server) => {
          registered.push(server);
          return () => {};
        },
      },
    );
    expect(registered).toEqual([
      expect.objectContaining({ name: "Farm Docs", version: "3.0.0", path: "/api/docs/mcp" }),
    ]);

    const disabled: unknown[] = [];
    createFarmDocsRuntimeHandler(
      { ...config, mcp: false },
      {
        registerMCPServer: (server) => {
          disabled.push(server);
          return () => {};
        },
      },
    );
    expect(disabled).toEqual([]);

    // A host that rejects the entry leaves the docs runtime working.
    expect(() =>
      createFarmDocsRuntimeHandler(config, {
        registerMCPServer: () => {
          throw new TypeError("rejected");
        },
      }),
    ).not.toThrow();
  });

  it("returns page data for client-side documentation navigation", async () => {
    const handler = createFarmDocsRuntimeHandler(
      {
        ...config,
        _preloadedContent: {
          ...config._preloadedContent,
          "/docs/guides.md": `---\ntitle: Guides\n---\n# Guides`,
        },
      },
      {
        clientEntry: "/farm-client.js",
        loadReactModule: async () => ({
          FarmDocsPage: ({ data }) => createElement("main", null, data.title),
        }),
      },
    );

    const response = await handler(
      new Request("https://farm.example/docs/guides", {
        headers: {
          Accept: "application/json",
          [FARM_DOCS_NAVIGATION_HEADER]: "1",
        },
      }),
    );
    const payload = await response?.json();

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("application/json");
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({
      data: {
        title: "Guides",
        url: "/docs/guides",
        sourcePath: "/docs/guides.md",
      },
    });
  });

  it("loads a page's compiled Markdown before rendering it", async () => {
    const loaded: string[] = [];
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      loadReactModule: async () => ({
        async loadFarmDocsPageModule(data) {
          await Promise.resolve();
          loaded.push(data.sourcePath);
        },
        // Renders only what was loaded first, the way the adapter's page does.
        FarmDocsPage: ({ data }) =>
          createElement("main", null, loaded.includes(data.sourcePath) ? data.title : "missing"),
      }),
    });

    const response = await handler(new Request("https://farm.example/docs"));
    const html = await response?.text();

    expect(response?.status).toBe(200);
    expect(loaded).toHaveLength(1);
    expect(html).toContain("<main>");
    expect(html).not.toContain("missing");
  });

  it("renders a large page boundary once, in place", async () => {
    // The docs layout wraps the page in a Suspense boundary whose fallback is
    // the page itself. React outlines completed boundaries over 12.8 KB unless
    // told otherwise, which sent the page twice.
    const paragraph = "Farm documentation content that fills the page. ".repeat(20);
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      loadReactModule: async () => ({
        FarmDocsPage: () => {
          const page = createElement(
            "article",
            null,
            Array.from({ length: 40 }, (_, index) =>
              createElement("p", { key: index }, `${index} ${paragraph}`),
            ),
          );
          // Nested like the layout's page boundary; React flushes a root-level
          // boundary in place regardless.
          return createElement("main", null, createElement(Suspense, { fallback: page }, page));
        },
      }),
    });

    const response = await handler(new Request("https://farm.example/docs"));
    const html = (await response?.text()) ?? "";

    expect(response?.status).toBe(200);
    expect(html.match(/<article>/g)).toHaveLength(1);
    expect(html.split("39 Farm documentation content").length - 1).toBe(1);
    expect(html).not.toContain('<template id="B:');
  });

  it("renders a page once when the content is immutable, and on every request otherwise", async () => {
    let renders = 0;
    const options = {
      clientEntry: "/farm-client.js",
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }: { data: { title: string } }) => {
          renders += 1;
          return createElement("main", null, data.title);
        },
      }),
    };
    const production = createFarmDocsRuntimeHandler(config, { ...options, immutableContent: true });
    const development = createFarmDocsRuntimeHandler(config, options);
    const read = async (handler: typeof production) => {
      const response = await handler(new Request("https://farm.example/docs"));
      return {
        status: response?.status,
        headers: Object.fromEntries(response?.headers ?? []),
        html: await response?.text(),
      };
    };

    const [first, concurrent] = await Promise.all([read(production), read(production)]);
    const repeated = await read(production);
    expect(renders).toBe(1);
    expect(first.status).toBe(200);
    expect(concurrent).toEqual(first);
    expect(repeated).toEqual(first);

    renders = 0;
    const developmentFirst = await read(development);
    expect(await read(development)).toEqual(developmentFirst);
    expect(renders).toBe(2);
    // Reusing a render changes nothing a client receives.
    expect(developmentFirst).toEqual(first);
  });

  it("gives each request its own origin in a reused page", async () => {
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      immutableContent: true,
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }) => createElement("main", null, data.title),
      }),
    });

    const first = await (await handler(new Request("https://one.example/docs")))?.text();
    const second = await (await handler(new Request("http://two.example:8080/docs")))?.text();

    expect(first).toContain('href="https://one.example/docs.md"');
    expect(second).toContain('href="http://two.example:8080/docs.md"');
    expect(second).not.toContain("one.example");
    expect(`${first}${second}`).not.toContain("farm-docs-origin-");
  });

  it("still answers navigation, Markdown, HEAD, and missing pages after reusing a render", async () => {
    let renders = 0;
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      immutableContent: true,
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }) => {
          renders += 1;
          return createElement("main", null, data.title);
        },
      }),
    });

    expect((await handler(new Request("https://farm.example/docs")))?.status).toBe(200);

    const navigation = await handler(
      new Request("https://farm.example/docs", {
        headers: { [FARM_DOCS_NAVIGATION_HEADER]: "1" },
      }),
    );
    expect(navigation?.headers.get("content-type")).toContain("application/json");
    expect(navigation?.headers.get("vary")).toBe(FARM_DOCS_NAVIGATION_HEADER);
    expect(await navigation?.json()).toMatchObject({
      data: { title: "Introduction", url: "/docs" },
    });

    const markdown = await handler(
      new Request("https://farm.example/docs", { headers: { Accept: "text/markdown" } }),
    );
    expect(markdown?.headers.get("content-type")).toContain("text/markdown");
    expect(await markdown?.text()).toContain("Farm documentation content.");

    const head = await handler(new Request("https://farm.example/docs", { method: "HEAD" }));
    expect(head?.status).toBe(200);
    expect(head?.headers.get("content-type")).toContain("text/html");
    expect(await head?.text()).toBe("");

    expect(await handler(new Request("https://farm.example/docs/missing"))).toBeNull();
    expect(await handler(new Request("https://farm.example/docs/missing"))).toBeNull();
    const missingNavigation = await handler(
      new Request("https://farm.example/docs/missing", {
        headers: { [FARM_DOCS_NAVIGATION_HEADER]: "1" },
      }),
    );
    expect(missingNavigation?.status).toBe(404);
    expect(renders).toBe(1);
  });

  it("does not keep a page whose render failed", async () => {
    let attempts = 0;
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      immutableContent: true,
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }) => {
          attempts += 1;
          if (attempts === 1) throw new Error("render failed");
          return createElement("main", null, data.title);
        },
      }),
    });

    await expect(handler(new Request("https://farm.example/docs"))).rejects.toThrow();
    const response = await handler(new Request("https://farm.example/docs"));
    expect(response?.status).toBe(200);
    expect(await response?.text()).toContain("<main>Introduction</main>");
  });

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

  it("serves the adapter CSS in a cascade layer so host utilities win", async () => {
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }) => createElement("main", null, data.title),
      }),
    });

    const response = await handler(new Request("https://farm.example/__farm_docs/browser.css"));
    const css = (await response?.text()) ?? "";
    const layerStart = css.indexOf("@layer farm-docs-adapter {");

    // The theme's preflight and utilities (`.border`) sit inside the layer, so a host's own
    // `@layer utilities` rule such as `.border-l-4` takes precedence over them.
    expect(layerStart).toBeGreaterThan(0);
    expect(css.indexOf(".border {")).toBeGreaterThan(layerStart);
    expect(css.indexOf("::file-selector-button")).toBeGreaterThan(layerStart);
    expect(css.trimEnd().endsWith("}")).toBe(true);
    // @property registrations do not cascade and stay top-level, ahead of the layer.
    expect(css.indexOf("@property")).toBeLessThan(layerStart);
    expect(css.lastIndexOf("@property")).toBeLessThan(layerStart);
  });

  it("links each docs page to its Markdown mirror in the document head", async () => {
    const handler = createFarmDocsRuntimeHandler(config, {
      clientEntry: "/farm-client.js",
      loadReactModule: async () => ({
        FarmDocsPage: ({ data }) => createElement("main", null, data.title),
      }),
    });

    const response = await handler(new Request("https://farm.example/docs/"));
    const html = (await response?.text()) ?? "";
    const head = html.slice(0, html.indexOf("</head>"));

    expect(head).toContain(
      '<link rel="alternate" type="text/markdown" href="https://farm.example/docs.md">',
    );
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

  it("resolves the stored theme before loading documentation styles", async () => {
    const handler = createFarmDocsRuntimeHandler(
      {
        ...config,
        themeToggle: { enabled: true, default: "light" },
      },
      {
        clientEntry: "/farm-client.js",
        stylesheets: ["/src/app/globals.css"],
        loadReactModule: async () => ({
          FarmDocsPage: ({ data }) => createElement("main", null, data.title),
        }),
      },
    );

    const response = await handler(new Request("https://farm.example/docs"));
    const html = await response?.text();

    expect(html).toContain('<html class="light"');
    expect(html).toContain('localStorage.getItem("theme")');
    expect(html?.indexOf('localStorage.getItem("theme")')).toBeLessThan(
      html?.indexOf("/__farm_docs/browser.css") ?? -1,
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

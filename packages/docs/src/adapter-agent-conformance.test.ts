import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE } from "./agent.js";
import type { DocsAgentAdapter } from "./agent-conformance.js";
import { runDocsAgentConformance } from "./agent-conformance.js";
import {
  DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
  DEFAULT_API_CATALOG_ROUTE,
  resolveDocsPublishedAgentSkill,
} from "./standards-discovery.js";

const adapters = [
  ["tanstack-start", "../../tanstack-start/src/server.ts"],
  ["farmjs", "../../farmjs/src/server.ts"],
  ["sveltekit", "../../svelte/src/server.ts"],
  ["astro", "../../astro/src/server.ts"],
  ["nuxt", "../../nuxt/src/server.ts"],
] as const satisfies readonly (readonly [DocsAgentAdapter, string])[];

describe.each(adapters)("%s agent surface contract", (adapter, modulePath) => {
  async function loadCreateDocsServer() {
    // Keep the module path dynamic so the core typecheck does not pull adapter source files into
    // its declaration root. Vitest still executes the real adapter implementation.
    const moduleUrl = new URL(modulePath, import.meta.url).href;
    return (await import(moduleUrl)) as {
      createDocsServer(config: Record<string, unknown>): {
        GET(context: { request: Request; url?: URL }): Promise<Response>;
        HEAD(context: { request: Request; url?: URL }): Promise<Response>;
        POST(context: { request: Request; url?: URL }): Promise<Response>;
        MCP: { POST(context: { request: Request }): Promise<Response> };
      };
    };
  }

  it("conforms to the shared public agent contract", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      nav: { title: "Conformance Docs" },
      i18n: { locales: ["en", "fr"], defaultLocale: "en" },
      mcp: true,
      sitemap: true,
      robots: true,
      agent: {
        a2a: {
          name: "Conformance agent",
          description: "Answers questions from the conformance documentation.",
          supportedInterfaces: [
            { url: "https://agent.example.com/a2a" },
            {
              url: "https://agent.example.com/rpc",
              protocolBinding: "JSONRPC",
              protocolVersion: "1.1",
              tenant: "acme",
            },
          ],
          skills: [
            {
              id: "docs",
              name: "Documentation",
              description: "Answers questions from the conformance documentation.",
              tags: ["documentation"],
            },
            {
              id: "search",
              name: "Search documentation",
              description: "Finds relevant pages in the conformance documentation.",
              tags: ["documentation", "search"],
              examples: ["Find the installation guide."],
              inputModes: ["application/json"],
              outputModes: ["application/json"],
            },
          ],
        },
      },
      _preloadedContent: {
        "/docs/en/page.md": `---\ntitle: Introduction\ndescription: Start here.\n---\n\n# Introduction\n\nWelcome.`,
        "/docs/fr/page.md": `---\ntitle: Introduction\n---\n\n# Introduction\n\nBonjour.`,
      },
    });

    const report = await runDocsAgentConformance({
      adapter,
      async handle(request, surface) {
        if (surface === "mcp") return server.MCP.POST({ request });
        if (request.method === "HEAD") {
          return server.HEAD({ request, url: new URL(request.url) });
        }
        if (request.method === "POST") {
          return server.POST({ request, url: new URL(request.url) });
        }
        return server.GET({ request, url: new URL(request.url) });
      },
    });

    expect(report.cases.filter((result) => !result.passed)).toEqual([]);
    expect(report.passed).toBe(true);

    const discoveryUrl = new URL(
      DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
      "https://docs.example.com",
    );
    const discoveryResponse = await server.GET({
      request: new Request(discoveryUrl),
      url: discoveryUrl,
    });
    await expect(discoveryResponse.json()).resolves.toMatchObject({
      capabilities: {
        contentChanges: true,
      },
      contentChanges: {
        enabled: true,
        endpoint: "/api/docs?audience=agent&response=changes",
        format: "docs-content-changes.v1",
        bodyFree: true,
        etag: true,
      },
      markdown: {
        enabled: true,
        acceptHeader: "text/markdown",
      },
    });

    const changesUrl = new URL(
      "/api/docs?audience=agent&response=changes",
      "https://docs.example.com",
    );
    const changesResponse = await server.GET({
      request: new Request(changesUrl),
      url: changesUrl,
    });
    const changesEtag = changesResponse.headers.get("etag");
    const changes = (await changesResponse.json()) as {
      format: string;
      indexGeneration: string;
      mode: string;
      resetRequired: boolean;
      documentCount: number;
      added: Array<{ canonicalUrl: string; digest: string; content?: string }>;
    };
    expect(changesResponse.status).toBe(200);
    expect(changesEtag).toMatch(/^"sha256:[a-f0-9]{64}"$/);
    expect(changes).toMatchObject({
      format: "docs-content-changes.v1",
      mode: "snapshot",
      resetRequired: false,
      documentCount: 1,
      added: [
        {
          canonicalUrl: "https://docs.example.com/docs?lang=en",
          digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        },
      ],
    });
    expect(changes.added[0]).not.toHaveProperty("content");

    const deltaUrl = new URL(changesUrl);
    deltaUrl.searchParams.set("since", changes.indexGeneration);
    const deltaResponse = await server.GET({
      request: new Request(deltaUrl),
      url: deltaUrl,
    });
    await expect(deltaResponse.json()).resolves.toMatchObject({
      mode: "delta",
      resetRequired: false,
      counts: { added: 0, changed: 0, deleted: 0 },
    });

    const changesHead = await server.HEAD({
      request: new Request(changesUrl, { method: "HEAD" }),
      url: changesUrl,
    });
    expect(changesHead.status).toBe(200);
    expect(changesHead.headers.get("x-docs-index-generation")).toBe(changes.indexGeneration);
    expect(await changesHead.text()).toBe("");

    const notModified = await server.GET({
      request: new Request(changesUrl, {
        headers: { "If-None-Match": changesEtag! },
      }),
      url: changesUrl,
    });
    expect(notModified.status).toBe(304);
    expect(await notModified.text()).toBe("");

    const indexUrl = new URL("/.well-known/agent-skills/index.json", "https://docs.example.com");
    const indexResponse = await server.GET({
      request: new Request(indexUrl),
      url: indexUrl,
    });
    const index = (await indexResponse.json()) as {
      skills: Array<{ digest: string; name: string; url: string }>;
    };
    expect(index.skills).toHaveLength(1);

    const artifactUrl = new URL(index.skills[0]!.url, indexUrl);
    const artifactResponse = await server.GET({
      request: new Request(artifactUrl),
      url: artifactUrl,
    });
    const artifact = await artifactResponse.text();
    expect(index.skills[0]).toMatchObject({
      name: "docs",
      digest: `sha256:${createHash("sha256").update(artifact, "utf8").digest("hex")}`,
    });

    const cardUrl = new URL("/.well-known/agent-card.json", "https://docs.example.com");
    const cardResponse = await server.GET({
      request: new Request(cardUrl),
      url: cardUrl,
    });
    const cardEtag = cardResponse.headers.get("etag");
    const card = await cardResponse.json();
    expect(card).toStrictEqual({
      name: "Conformance agent",
      description: "Answers questions from the conformance documentation.",
      supportedInterfaces: [
        {
          url: "https://agent.example.com/a2a",
          protocolBinding: "HTTP+JSON",
          protocolVersion: "1.0",
        },
        {
          url: "https://agent.example.com/rpc",
          protocolBinding: "JSONRPC",
          protocolVersion: "1.1",
          tenant: "acme",
        },
      ],
      version: "1.0.0",
      capabilities: { streaming: false, pushNotifications: false },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: [
        {
          id: "docs",
          name: "Documentation",
          description: "Answers questions from the conformance documentation.",
          tags: ["documentation"],
        },
        {
          id: "search",
          name: "Search documentation",
          description: "Finds relevant pages in the conformance documentation.",
          tags: ["documentation", "search"],
          examples: ["Find the installation guide."],
          inputModes: ["application/json"],
          outputModes: ["application/json"],
        },
      ],
    });

    const cardHead = await server.GET({
      request: new Request(cardUrl, { method: "HEAD" }),
      url: cardUrl,
    });
    expect(cardHead.status).toBe(200);
    expect(cardHead.headers.get("etag")).toBe(cardEtag);
    expect(await cardHead.text()).toBe("");
  });

  it("applies cache validators and RFC 9530 integrity metadata across agent surfaces", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      nav: { title: "Cache Integrity Docs" },
      mcp: true,
      agent: {
        a2a: {
          name: "Cache integrity agent",
          description: "Answers questions from the cache integrity documentation.",
          supportedInterfaces: [{ url: "https://agent.example.com/a2a" }],
          skills: [
            {
              id: "docs",
              name: "Documentation",
              description: "Answers questions from the cache integrity documentation.",
              tags: ["documentation"],
            },
          ],
        },
      },
      _preloadedContent: {
        "/docs/page.md": `---\ntitle: Home\nlastmod: 2026-07-31T12:00:00.000Z\n---\n\n# Home\n\nWelcome.`,
      },
    });

    for (const path of [
      "/docs.md",
      "/llms.txt",
      "/.well-known/agent.json",
      "/.well-known/agent-card.json",
      "/.well-known/api-catalog",
      "/.well-known/agent-skills/index.json",
      "/skill.md",
    ]) {
      const url = new URL(path, "https://docs.example.com");
      const response = await server.GET({ request: new Request(url), url });
      const content = await response.text();
      const etag = response.headers.get("etag");
      const contentDigest = response.headers.get("content-digest");
      const lastModified = response.headers.get("last-modified");

      expect(response.status, path).toBe(200);
      expect(etag, path).toMatch(/^"[a-f0-9]{64}"$/u);
      expect(contentDigest, path).toBe(
        `sha-256=:${createHash("sha256").update(content, "utf8").digest("base64")}:`,
      );
      if (path === "/docs.md") expect(lastModified, path).toMatch(/ GMT$/u);
      else expect(lastModified, path).toBeNull();

      const head = await server.HEAD({
        request: new Request(url, { method: "HEAD" }),
        url,
      });
      expect(head.status, path).toBe(200);
      expect(head.headers.get("etag"), path).toBe(etag);
      expect(head.headers.get("content-digest"), path).toBe(contentDigest);
      expect(head.headers.get("last-modified"), path).toBe(lastModified);
      expect(await head.text(), path).toBe("");

      const byEtag = await server.GET({
        request: new Request(url, { headers: { "If-None-Match": etag! } }),
        url,
      });
      expect(byEtag.status, path).toBe(304);
      expect(byEtag.headers.get("content-digest"), path).toBe(contentDigest);
      expect(await byEtag.text(), path).toBe("");

      const byDate = await server.GET({
        request: new Request(url, {
          headers: {
            "If-Modified-Since": lastModified ?? "Sat, 01 Aug 2026 00:00:00 GMT",
          },
        }),
        url,
      });
      expect(byDate.status, path).toBe(lastModified ? 304 : 200);
      if (lastModified) expect(await byDate.text(), path).toBe("");
    }
  });

  it("matches the shared discovery method contract", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      nav: { title: "Method Contract Docs" },
      _preloadedContent: {
        "/docs/page.md": "# Home\n",
      },
    });

    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      for (const path of [
        DEFAULT_API_CATALOG_ROUTE,
        DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
        "/.well-known/agent-skills/docs/SKILL.md",
        "/api/docs?format=api-catalog",
        "/api/docs?format=agent-skills",
        "/api/docs?format=agent-skill&name=docs",
      ]) {
        const url = new URL(path, "https://docs.example.com");
        const request = new Request(url, { method });
        const response =
          method === "POST"
            ? await server.POST({ request, url })
            : await server.GET({ request, url });
        expect(response.status, `${method} ${path}`).toBe(405);
        expect(response.headers.get("allow"), `${method} ${path}`).toBe("GET, HEAD");
        expect(response.headers.get("access-control-allow-origin"), `${method} ${path}`).toBe("*");
        expect(response.headers.get("link"), `${method} ${path}`).toContain('rel="api-catalog"');
        expect(await response.text(), `${method} ${path}`).toBe("Method Not Allowed");
      }
    }

    const customRouteServer = createDocsServer({
      entry: "docs",
      cloud: { apiRoute: "/api/internal/docs" },
      _preloadedContent: {
        "/docs/page.md": "# Home\n",
      },
    });
    for (const method of ["PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const url = new URL("/api/internal/docs?format=agent-skills", "https://docs.example.com");
      const response = await customRouteServer.GET({
        request: new Request(url, { method }),
        url,
      });
      expect(response.status, `${method} custom API route`).toBe(405);
      expect(response.headers.get("allow"), `${method} custom API route`).toBe("GET, HEAD");
      expect(response.headers.get("link"), `${method} custom API route`).toContain(
        'rel="api-catalog"',
      );
    }

    for (const path of [
      DEFAULT_API_CATALOG_ROUTE,
      DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
      "/.well-known/agent.json",
      "/AGENTS.md",
      "/skill.md",
    ]) {
      const url = new URL(path, "https://docs.example.com");
      const getResponse = await server.GET({ request: new Request(url), url });
      const headResponse = await server.HEAD({
        request: new Request(url, { method: "HEAD" }),
        url,
      });

      expect(getResponse.status, path).toBe(200);
      expect(await getResponse.text(), path).not.toBe("");
      expect(headResponse.status, path).toBe(getResponse.status);
      expect(Object.fromEntries(headResponse.headers), path).toEqual(
        Object.fromEntries(getResponse.headers),
      );
      expect(await headResponse.text(), path).toBe("");
    }
  });

  it("serves section discovery metadata with GET and HEAD parity", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      _preloadedContent: {
        "/docs/page.md": "# Home\n\nOverview.\n\n## Install\n\nRun the installer.\n",
      },
    });
    const url = new URL("/docs.md?sections", "https://docs.example.com");
    const getResponse = await server.GET({
      request: new Request(url),
      url,
    });
    const getHeaders = Object.fromEntries(getResponse.headers);
    const payload = (await getResponse.json()) as {
      format: string;
      sectionCount: number;
      sections: Array<{ id: string }>;
    };

    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(getResponse.headers.get("x-docs-markdown-section-count")).toBe("2");
    expect(payload.format).toBe("docs-markdown-sections.v2");
    expect(payload.sectionCount).toBe(2);
    expect(payload.sections.map((section) => section.id)).toEqual(["home", "install"]);

    const headResponse = await server.HEAD({
      request: new Request(url, { method: "HEAD" }),
      url,
    });
    expect(headResponse.status).toBe(200);
    expect(Object.fromEntries(headResponse.headers)).toEqual(getHeaders);
    expect(await headResponse.text()).toBe("");
  });

  it("does not advertise or serve the runtime feed from static exports", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      staticExport: true,
      _preloadedContent: {
        "/docs/page.md": "# Home\n",
      },
    });
    const discoveryUrl = new URL("/.well-known/agent.json", "https://docs.example.com");
    const discoveryResponse = await server.GET({
      request: new Request(discoveryUrl),
      url: discoveryUrl,
    });
    const discovery = (await discoveryResponse.json()) as {
      capabilities: { contentChanges: boolean };
      api: Record<string, string>;
      contentChanges: { enabled: boolean; endpoint: string | null };
    };
    expect(discovery.capabilities.contentChanges).toBe(false);
    expect(discovery.api).not.toHaveProperty("contentChanges");
    expect(discovery.contentChanges).toMatchObject({ enabled: false, endpoint: null });

    const changesUrl = new URL(
      "/api/docs?audience=agent&response=changes",
      "https://docs.example.com",
    );
    const changesResponse = await server.GET({
      request: new Request(changesUrl),
      url: changesUrl,
    });
    expect(changesResponse.status).toBe(404);
  });

  it("keeps discovery HEAD requests bodyless with the GET validators", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const config: Record<string, unknown> = {
      entry: "docs",
      _preloadedContent: {
        "/docs/page.md": "# Home\n",
      },
    };

    const server = createDocsServer(config);
    const agentManifestUrl = new URL("/.well-known/agent.json", "https://docs.example.com");
    const getResponse = await server.GET({
      request: new Request(agentManifestUrl),
      url: agentManifestUrl,
    });
    const agentManifestResponse = await server.HEAD({
      request: new Request(agentManifestUrl, { method: "HEAD" }),
      url: agentManifestUrl,
    });
    expect(agentManifestResponse.status).toBe(200);
    expect(agentManifestResponse.headers.get("etag")).toBe(getResponse.headers.get("etag"));
    expect(agentManifestResponse.headers.get("content-digest")).toBe(
      getResponse.headers.get("content-digest"),
    );
    expect(agentManifestResponse.headers.get("last-modified")).toBe(
      getResponse.headers.get("last-modified"),
    );
    expect(await agentManifestResponse.text()).toBe("");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("HEAD must not fetch the OpenAPI document"));
    try {
      const openapiServer = createDocsServer({
        entry: "docs",
        apiReference: {
          enabled: true,
          specUrl: "https://must-not-fetch.example/openapi.json",
        },
        _preloadedContent: {
          "/docs/page.md": "# Home\n",
        },
      });
      const openapiUrl = new URL("/api/docs?format=openapi", "https://docs.example.com");
      const openapiResponse = await openapiServer.HEAD({
        request: new Request(openapiUrl, { method: "HEAD" }),
        url: openapiUrl,
      });

      expect(openapiResponse.status).toBe(200);
      expect(openapiResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(await openapiResponse.text()).toBe("");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("associates remote OpenAPI discovery with its configured product API target", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "https://schemas.example.com/product.json",
        catalogTargets: ["https://api.example.com/v1"],
      },
      _preloadedContent: {
        "/docs/page.md": "# Home\n",
      },
    });
    const url = new URL("/.well-known/api-catalog", "https://docs.example.com");
    const response = await server.GET({ request: new Request(url), url });
    const catalog = (await response.json()) as {
      linkset: Array<{
        anchor: string;
        item?: Array<{ href: string }>;
        "service-desc"?: Array<{ href: string }>;
      }>;
    };
    const contexts = new Map(catalog.linkset.map((context) => [context.anchor, context]));

    expect(response.status).toBe(200);
    expect(catalog.linkset[0]?.["service-desc"]).toBeUndefined();
    expect(catalog.linkset[0]?.item?.map(({ href }) => href)).toContain(
      "https://api.example.com/v1",
    );
    expect(contexts.get("https://docs.example.com/api/docs")?.["service-desc"]).toBeUndefined();
    expect(contexts.get("https://api.example.com/v1")?.["service-desc"]).toEqual([
      expect.objectContaining({
        href: "https://docs.example.com/api/docs?format=openapi",
      }),
    ]);
  });

  it("applies the same audience policy to search and agent outputs", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      nav: { title: "Audience Docs" },
      mcp: true,
      search: {
        provider: "custom",
        adapter: {
          name: "stale-audience-index",
          async search() {
            return [
              {
                id: "stale-audience-hit",
                url: "https://docs.example.com/docs",
                content: "Audience",
                description: "Agent indigo procedure.",
                type: "page",
              },
            ];
          },
        },
      },
      sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
      _preloadedContent: {
        "/docs/page.md": `---
title: Audience
description: Audience policy
---

# Audience

Shared context.

<Human>Human coral walkthrough.</Human>

<Audience only="agent">Agent indigo procedure.</Audience>`,
      },
    });

    async function get(path: string) {
      const url = new URL(path, "https://preview.example.com");
      return server.GET({ request: new Request(url), url });
    }

    const humanSearch = await get("/api/docs?query=human%20coral%20walkthrough");
    const defaultAgentSearch = await get("/api/docs?query=agent%20indigo%20procedure");
    const explicitAgentSearch = await get(
      "/api/docs?query=agent%20indigo%20procedure&audience=agent",
    );
    const invalidAgentSearch = await get(
      "/api/docs?query=agent%20indigo%20procedure&audience=Agent",
    );
    const humanSearchText = await humanSearch.text();
    expect(humanSearchText).toContain("Human coral walkthrough");
    expect(humanSearchText).not.toContain("Agent indigo procedure");
    expect(await defaultAgentSearch.json()).toEqual([]);
    const explicitAgentSearchText = await explicitAgentSearch.text();
    expect(explicitAgentSearchText).toContain("Agent indigo procedure");
    expect(explicitAgentSearchText).not.toContain("Human coral walkthrough");
    expect(await invalidAgentSearch.json()).toEqual([]);

    const markdown = await (await get("/docs.md")).text();
    expect(markdown).toContain("Agent indigo procedure.");
    expect(markdown).not.toContain("Human coral walkthrough.");

    const llmsFull = await (await get("/llms-full.txt")).text();
    expect(llmsFull).toContain("Agent indigo procedure.");
    expect(llmsFull).not.toContain("Human coral walkthrough.");

    const sitemap = await (await get("/sitemap.xml")).text();
    expect(sitemap).toContain("https://docs.example.com/docs");
    expect(sitemap).not.toContain("Human coral walkthrough.");
    expect(sitemap).not.toContain("Agent indigo procedure.");
  });

  it("applies scoped search filters and preserves the legacy response shape", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      nav: { title: "Scoped Search Docs" },
      _preloadedContent: {
        "/docs/next-14.md": `---
title: Next 14 scoped setup
framework: Next.js
version: v14
tags:
  - routing
  - setup
agent:
  appliesTo:
    package: "@scope/router"
---

# Next 14 scoped setup

Scoped Setup Token for the legacy router.`,
        "/docs/next-15.md": `---
title: Next 15 scoped setup
framework: next
version: "15"
tags:
  - routing
  - setup
agent:
  appliesTo:
    package: "@scope/router"
---

# Next 15 scoped setup

Scoped Setup Token for the current router.`,
        "/docs/astro-5.md": `---
title: Astro 5 scoped setup
framework: astro
version: "5"
tags:
  - routing
  - setup
agent:
  appliesTo:
    package: "@scope/router"
---

# Astro 5 scoped setup

Scoped Setup Token for Astro.`,
      },
    });

    async function search(response?: "structured") {
      const url = new URL("/api/docs", "https://docs.example.com");
      url.searchParams.set("query", "Scoped Setup Token");
      url.searchParams.set("audience", "agent");
      url.searchParams.append("framework", "Next.js");
      url.searchParams.append("version", "v15");
      url.searchParams.append("package", "@scope/router");
      url.searchParams.append("tags", "routing");
      if (response) url.searchParams.set("response", response);
      return server.GET({ request: new Request(url), url });
    }

    const legacyResponse = await search();
    const legacyPayload = (await legacyResponse.json()) as Array<{ url: string }>;
    expect(Array.isArray(legacyPayload)).toBe(true);
    expect(legacyPayload.length).toBeGreaterThan(0);
    expect(Array.from(new Set(legacyPayload.map((result) => result.url.split("#", 1)[0])))).toEqual(
      ["/docs/next-15"],
    );

    const structuredResponse = await search("structured");
    const structuredPayload = (await structuredResponse.json()) as {
      format: string;
      query: string;
      audience: string;
      filters: Record<string, string[]>;
      resultCount: number;
      results: Array<{ url: string }>;
      warnings: unknown[];
    };
    expect(structuredPayload).toMatchObject({
      format: "docs-search.v1",
      query: "Scoped Setup Token",
      audience: "agent",
      filters: {
        framework: ["nextjs"],
        version: ["15"],
        package: ["@scope/router"],
        tags: ["routing"],
      },
      warnings: [],
    });
    expect(structuredPayload.resultCount).toBe(structuredPayload.results.length);
    expect(structuredPayload.results.length).toBeGreaterThan(0);
    expect(
      Array.from(new Set(structuredPayload.results.map((result) => result.url.split("#", 1)[0]))),
    ).toEqual(["/docs/next-15"]);

    const blankUrl = new URL("/api/docs", "https://docs.example.com");
    blankUrl.searchParams.set("query", "   ");
    blankUrl.searchParams.set("audience", "agent");
    blankUrl.searchParams.set("framework", "Next.js");
    blankUrl.searchParams.append("tags", "Routing,Setup");

    const blankLegacyResponse = await server.GET({
      request: new Request(blankUrl),
      url: blankUrl,
    });
    await expect(blankLegacyResponse.json()).resolves.toEqual([]);

    blankUrl.searchParams.set("response", "structured");
    const blankStructuredResponse = await server.GET({
      request: new Request(blankUrl),
      url: blankUrl,
    });
    const blankStructuredPayload = (await blankStructuredResponse.json()) as {
      indexGeneration: string;
    };
    expect(blankStructuredPayload).toMatchObject({
      format: "docs-search.v1",
      query: "",
      audience: "agent",
      filters: {
        framework: ["nextjs"],
        tags: ["routing", "setup"],
      },
      resultCount: 0,
      results: [],
      warnings: [],
    });
    expect(blankStructuredPayload.indexGeneration).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("paginates structured search with opaque cursors without changing legacy arrays", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const analyticsUrls: string[] = [];
    const server = createDocsServer({
      entry: "docs",
      nav: { title: "Cursor Search Docs" },
      analytics: {
        console: false,
        onEvent(event: { type: string; url?: string }) {
          if (event.type === "api_search" && event.url) analyticsUrls.push(event.url);
        },
      },
      search: {
        provider: "simple",
        maxResults: 10,
        chunking: { strategy: "page" },
      },
      _preloadedContent: {
        "/docs/cursor-alpha.md": `---
title: Cursor alpha
---

# Cursor alpha

Shared cursor pagination marker for alpha.`,
        "/docs/cursor-beta.md": `---
title: Cursor beta
---

# Cursor beta

Shared cursor pagination marker for beta.`,
      },
    });

    async function get(url: URL) {
      return server.GET({ request: new Request(url), url });
    }

    const legacyUrl = new URL("/api/docs", "https://docs.example.com");
    legacyUrl.searchParams.set("query", "shared cursor pagination marker");
    legacyUrl.searchParams.set("limit", "1");
    const legacyResponse = await get(legacyUrl);
    const legacyPayload = (await legacyResponse.json()) as Array<{ id: string }>;
    expect(legacyResponse.status).toBe(200);
    expect(Array.isArray(legacyPayload)).toBe(true);
    expect(legacyPayload).toHaveLength(2);

    const firstUrl = new URL(legacyUrl);
    firstUrl.searchParams.set("response", "structured");
    const firstResponse = await get(firstUrl);
    const first = (await firstResponse.json()) as {
      resultCount: number;
      total: number;
      hasMore: boolean;
      nextCursor?: string;
      results: Array<{ id: string }>;
    };
    expect(firstResponse.status).toBe(200);
    expect(first).toMatchObject({
      resultCount: 1,
      total: 2,
      hasMore: true,
      results: [expect.objectContaining({ id: expect.any(String) })],
    });
    expect(first.nextCursor).toEqual(expect.any(String));

    const nextUrl = new URL(firstUrl);
    nextUrl.searchParams.set("cursor", first.nextCursor!);
    const nextResponse = await get(nextUrl);
    const next = (await nextResponse.json()) as {
      resultCount: number;
      total: number;
      hasMore: boolean;
      nextCursor?: string;
      results: Array<{ id: string }>;
    };
    expect(nextResponse.status).toBe(200);
    expect(next).toMatchObject({
      resultCount: 1,
      total: first.total,
      hasMore: false,
      results: [expect.objectContaining({ id: expect.any(String) })],
    });
    expect(next.nextCursor).toBeUndefined();
    expect(next.results[0]?.id).not.toBe(first.results[0]?.id);
    expect(analyticsUrls).not.toHaveLength(0);
    expect(analyticsUrls.every((value) => value === "https://docs.example.com/api/docs")).toBe(
      true,
    );

    const invalidUrl = new URL(firstUrl);
    invalidUrl.searchParams.set("cursor", "not-an-opaque-docs-cursor");
    const invalidResponse = await get(invalidUrl);
    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      error: {
        code: "invalid_cursor",
        message: expect.any(String),
      },
    });
  });

  it("uses a build-time skill snapshot without touching unavailable source paths", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const bundledSkill = await resolveDocsPublishedAgentSkill({
      preferredDocument: `---
name: bundled-demo
description: Available only from the production build snapshot.
---

# Bundled demo
`,
      fallbackDocument: "",
    });
    const server = createDocsServer({
      entry: "docs",
      agent: { skills: "path-that-does-not-exist-at-runtime" },
      _preloadedAgentSkills: [bundledSkill],
      _preloadedContent: { "/docs/page.md": "# Home\n" },
    });
    const indexUrl = new URL("/.well-known/agent-skills/index.json", "https://docs.example.com");
    const indexResponse = await server.GET({
      request: new Request(indexUrl),
      url: indexUrl,
    });
    const index = (await indexResponse.json()) as { skills: Array<{ name: string; url: string }> };
    expect(index.skills.map((skill) => skill.name)).toContain("bundled-demo");

    const skillUrl = new URL(
      index.skills.find((skill) => skill.name === "bundled-demo")!.url,
      indexUrl,
    );
    const skillResponse = await server.GET({ request: new Request(skillUrl), url: skillUrl });
    expect(await skillResponse.text()).toContain("# Bundled demo");
  });
});

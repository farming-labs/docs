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
      markdown: {
        enabled: true,
        acceptHeader: "text/markdown",
      },
    });

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

  it("keeps discovery HEAD requests metadata-only", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const config: Record<string, unknown> = {
      entry: "docs",
      agent: { skills: "must-not-resolve-for-agent-manifest-head" },
      _preloadedContent: {
        "/docs/page.md": "# Home\n",
      },
    };
    Object.defineProperty(config, "_preloadedAgentSkills", {
      get() {
        throw new Error("HEAD must not resolve configured skills");
      },
    });

    const server = createDocsServer(config);
    const agentManifestUrl = new URL("/.well-known/agent.json", "https://docs.example.com");
    const agentManifestResponse = await server.HEAD({
      request: new Request(agentManifestUrl, { method: "HEAD" }),
      url: agentManifestUrl,
    });
    expect(agentManifestResponse.status).toBe(200);
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

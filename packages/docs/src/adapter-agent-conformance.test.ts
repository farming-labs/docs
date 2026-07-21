import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE } from "./agent.js";
import type { DocsAgentAdapter } from "./agent-conformance.js";
import { runDocsAgentConformance } from "./agent-conformance.js";

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
      _preloadedContent: {
        "/docs/en/page.md": `---\ntitle: Introduction\ndescription: Start here.\n---\n\n# Introduction\n\nWelcome.`,
        "/docs/fr/page.md": `---\ntitle: Introduction\n---\n\n# Introduction\n\nBonjour.`,
      },
    });

    const report = await runDocsAgentConformance({
      adapter,
      async handle(request, surface) {
        if (surface === "mcp") return server.MCP.POST({ request });
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
  });

  it("applies the same audience policy to search and agent outputs", async () => {
    const { createDocsServer } = await loadCreateDocsServer();
    const server = createDocsServer({
      entry: "docs",
      nav: { title: "Audience Docs" },
      mcp: true,
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
      const url = new URL(path, "https://docs.example.com");
      return server.GET({ request: new Request(url), url });
    }

    const humanSearch = await get("/api/docs?query=human%20coral%20walkthrough");
    const agentSearch = await get("/api/docs?query=agent%20indigo%20procedure");
    expect(await humanSearch.text()).toContain("Audience");
    expect(await agentSearch.json()).toEqual([]);

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
});

import { describe, expect, it } from "vitest";
import type { DocsAgentAdapter } from "./agent-conformance.js";
import { runDocsAgentConformance } from "./agent-conformance.js";

const adapters = [
  ["tanstack-start", "../../tanstack-start/src/server.ts"],
  ["sveltekit", "../../svelte/src/server.ts"],
  ["astro", "../../astro/src/server.ts"],
  ["nuxt", "../../nuxt/src/server.ts"],
] as const satisfies readonly (readonly [DocsAgentAdapter, string])[];

describe.each(adapters)("%s agent surface contract", (adapter, modulePath) => {
  it("conforms to the shared public agent contract", async () => {
    // Keep the module path dynamic so the core typecheck does not pull adapter source files into
    // its declaration root. Vitest still executes the real adapter implementation.
    const moduleUrl = new URL(modulePath, import.meta.url).href;
    const { createDocsServer } = (await import(moduleUrl)) as {
      createDocsServer(config: Record<string, unknown>): {
        GET(context: { request: Request; url?: URL }): Promise<Response>;
        MCP: { POST(context: { request: Request }): Promise<Response> };
      };
    };
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
        if (surface === "mcp-initialize") return server.MCP.POST({ request });
        return server.GET({ request, url: new URL(request.url) });
      },
    });

    expect(report.cases.filter((result) => !result.passed)).toEqual([]);
    expect(report.passed).toBe(true);
  });
});

<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:39c61f7a4d47cc7d
settingsHash=fnv1a64:1b5212557ba75927
outputHash=fnv1a64:a2e521aa2c2f844c
generatedAt=2026-07-30T09:43:36.482Z
-->
# Adapter Agent Conformance

## Adapter Agent Conformance task

Task: Add the shared agent-surface conformance suite to a framework adapter.

Expected result: The adapter passes the same discovery, Markdown, sitemap, robots, skills, MCP, and paginated search contract as first-party adapters.

Exact implementation:

```ts title="src/agent-conformance.test.ts" framework="custom" runnable
import { expect, it } from "vitest";
import { runDocsAgentConformance } from "@farming-labs/docs";
import { createDocsServer } from "./server";

it("implements the agent surface contract", async () => {
  const server = createDocsServer({
    entry: "docs",
    i18n: { locales: ["en", "fr"], defaultLocale: "en" },
    mcp: true,
    sitemap: true,
    robots: true,
    _preloadedContent: {
      "/docs/en/page.md": "---\ntitle: Introduction\n---\n# Introduction",
      "/docs/fr/page.md": "---\ntitle: Introduction\n---\n# Introduction\n\nBonjour",
    },
  });

  const report = await runDocsAgentConformance({
    adapter: "sveltekit",
    async handle(request, surface) {
      if (surface === "mcp") {
        return server.MCP.POST({ request });
      }

      return server.GET({ request, url: new URL(request.url) });
    },
  });

  expect(report.cases.filter((result) => !result.passed)).toEqual([]);
});
```
## Adapter Agent Conformance prerequisites

- The adapter exposes one request handler that can serve the shared docs API and public aliases.
- A test fixture contains at least one docs page and can issue Web Request objects to the adapter.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Adapter Agent Conformance verification

- Run the adapter test containing runDocsAgentConformance. Expected: The report contains no failed cases and identifies the expected contract version.
- Failure: One public alias fails while the canonical docs API passes.
- Recovery: Forward the alias through the same shared server and preserve its method, headers, status, and response body.
- Rollback: Restore the previous adapter handler and remove only the conformance wiring introduced by the change.

## Adapter Agent Conformance agent guidance

Use `runDocsAgentConformance` when building or changing a framework adapter. Provide one callback
that dispatches ordinary requests to the adapter's public GET handler and the `mcp`
case to its MCP POST handler. Use the standard fixture titles `Introduction` and `Bonjour` so the
contract can verify default and localized Markdown. A passing report must contain no failed cases.

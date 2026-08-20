<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:90a70f0c0a38a3ce
settingsHash=fnv1a64:7a85fb928fd52635
outputHash=fnv1a64:ded084b41bf41852
generatedAt=2026-08-20T10:20:45.282Z
-->
# Ask AI

## Ask AI task

Task: Enable Ask AI with an explicit provider, retrieval path, and secret-handling model.

Expected result: A docs question returns a grounded streamed answer with citations from the configured documentation corpus.

## Ask AI prerequisites

- A working docs runtime and searchable content are already available.
- The selected provider credentials are stored in environment variables rather than committed config.
- Decide whether the browser may call the provider directly or must use a same-origin server proxy.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Ask AI verification

- Ask a question answered by one known page. Expected: The response streams successfully, cites the expected page, and does not expose provider credentials to the browser.
- Failure: The answer is plausible but cites no documentation.
- Recovery: Verify the search provider, maxResults, MCP endpoint when useMcp is enabled, and the selected page's machine-readable content.
- Rollback: Set ai.enabled to false and remove provider credentials and any custom chat route added for the integration.

## Ask AI agent guidance

Configure top-level `ai` in `docs.config.ts` or `docs.config.tsx`, and keep provider credentials in
environment variables. Next.js reads `OPENAI_API_KEY` directly; TanStack Start, SvelteKit, and Astro
pass the server-only value through `src/lib/docs.server.ts`, while Nuxt reads it through Nitro.

Set `ai.useMcp: true` only when Ask AI should retrieve with `search_docs` from `mcp.route` (default
`/api/docs/mcp`). Success means a question answered by a known page streams and cites that page. If
the answer has no citation, check the search provider, `ai.maxResults`, MCP endpoint, and the page's
machine-readable content. Move credential-bearing requests behind the same-origin docs API when the
browser reports authentication or CORS errors; `staticExport: true` intentionally hides Ask AI.

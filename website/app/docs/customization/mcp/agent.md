<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:3e985393450bab74
settingsHash=fnv1a64:4d5874ba9e62babc
outputHash=fnv1a64:7878d01f4b26d792
generatedAt=2026-07-30T09:43:36.464Z
-->
# MCP Server

## MCP Server task

Task: Expose the docs MCP server over stdio or Streamable HTTP with optional explicit authentication.

Expected result: An MCP client initializes successfully and can discover, search, and read the configured documentation resources.

## MCP Server prerequisites

- The docs API and framework public forwarder are already wired.
- Choose stdio for local use or Streamable HTTP for a shared endpoint.
- Keep HTTP public by default and add security.authenticate only when the deployment requires access control.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## MCP Server verification

- Run pnpm exec docs doctor --agent. Expected: MCP access and discovery/config/schema consistency pass.
- Initialize an MCP client and call list_docs followed by read_page for a known route. Expected: The initialize request succeeds and both tools return structured content for the configured docs corpus.
- Failure: The client receives 404 from /mcp or /.well-known/mcp.
- Recovery: Align mcp.route with the framework public forwarder and keep the documented aliases pointing at the canonical handler.
- Rollback: Set mcp.enabled to false, remove client configuration, and restore custom route or authentication wiring.

## MCP Server agent guidance

MCP is enabled and public by default: `/mcp` and `/.well-known/mcp` forward to the canonical
`/api/docs/mcp` handler. Add `mcp.security.authenticate` only for private docs; return a principal to
continue or `null` for `401`. Add `mcp.security.protectedResource.authorizationServers` and scopes
only when OAuth-aware clients need RFC 9728 discovery.

Run `pnpm exec docs doctor --agent`, then initialize a client and call `list_docs` followed by
`read_page` for a known route. A `404` can mean MCP is disabled, static export omitted the server
route, or the canonical handler and public forwarder are missing or disagree; use doctor output to
distinguish them. Repeated `401` responses mean the callback is not returning a valid principal;
`403` with `insufficient_scope` means the principal lacks a configured required scope. Local-only
clients can avoid HTTP routing with `pnpm exec docs mcp`.

The public docs MCP never contains write tools. For an operator-controlled authoring session, run
`pnpm exec docs mcp author --branch-prefix docs/`. It restricts reads and writes to documentation
files under `contentDir`, requires a current SHA-256 before overwriting, and exposes branch,
preview, doctor, diff, and feedback-analysis tools. Draft-PR publishing is not registered unless the
operator also passes `--allow-publish`; keep that server on local stdio or behind a separate
authoring-scoped OAuth transport.

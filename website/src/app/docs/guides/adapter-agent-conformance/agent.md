<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:452409f4999cf5d1
settingsHash=fnv1a64:1b5212557ba75927
outputHash=fnv1a64:a83cd1b06f2d79ce
generatedAt=2026-08-20T10:20:45.398Z
-->
# Adapter Agent Conformance
URL: /docs/guides/adapter-agent-conformance
LLM index: /llms.txt
Description: Validate that a framework adapter exposes the same agent-readable documentation contract as the first-party adapters
Related: /docs/guides/agent-friendly-docs, /docs/customization/mcp, /docs/customization/llms-txt, /docs/customization/sitemaps, /docs/cli

Every `@farming-labs/docs` adapter should expose the same machine-readable surface. The shared conformance runner turns that expectation into an executable contract.

Use `runDocsAgentConformance` when building or changing a framework adapter. Provide one callback dispatching GET requests to the adapter's public handler and the `mcp` case to its MCP POST handler. Use fixture titles `Introduction` and `Bonjour` for default and localized Markdown. A passing report must contain no failed cases.

## Exact implementation

```ts title="src/agent-conformance.test.ts" framework="custom" runnable
import { runDocsAgentConformance } from "@farming-labs/docs";

export async function verifyAdapter() {
  return runDocsAgentConformance({
    adapter: "nextjs",
    async handle(request) {
      return fetch(request);
    },
  });
}
```

## Covered surfaces

Versioned contract (`DOCS_AGENT_CONTRACT_VERSION` `1.3`) verifies:

- Custom agent discovery, RFC 9727 API catalog GET/HEAD, Agent Skills index/artifact GET/HEAD, config, diagnostics, and feedback schema
- Explicit `.md` aliases and `Accept: text/markdown` negotiation
- Default and localized page content; actionable missing-page recovery
- `llms.txt`, `llms-full.txt`, `AGENTS.md`, `skill.md`
- XML and Markdown sitemaps plus `robots.txt`
- Streamable HTTP MCP initialize request
- Gzip-encoded tar archive delivery of SKILL.md (decompressed via `readAgentSkillDocumentFromTar`)
- SKILL.md frontmatter validated against full spec — unexpected fields like `version` and incorrect `allowed-tools` type are conformance failures
- Cursor-based structured search pagination
- `capabilities.contentChanges` flag and live `GET /api/docs?audience=agent&response=changes` returning valid `docs-content-changes.v1` JSON with `indexGeneration`, `mode`, `resetRequired`, `documentCount`, and array fields; ETag and body-free delivery verified
- HTTP cache validators on every agent-surface response

## Cursor-based structured search

- `GET /api/docs?response=structured&query=<term>&limit=1` returns `hasMore`, `total`, and `nextCursor`.

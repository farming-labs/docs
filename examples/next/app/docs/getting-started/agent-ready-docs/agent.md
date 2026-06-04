# Agent Context: Agent-Ready Docs

You are an implementation agent working on `@farming-labs/docs`. Treat this file as the
machine-oriented contract for this page, prefer exact file paths and acceptance checks, and keep
the human page readable.

Use this file when implementing or modifying the `.md` docs route in the Next example app.

## Objective

Keep this contract true:

- `/docs/getting-started/agent-ready-docs` renders the human HTML page
- `/docs/getting-started/agent-ready-docs.md` returns this file
- `/docs/getting-started/agent-ready-docs` with `Signature-Agent` returns this file
- pages without `agent.md` should still work through `/docs/<slug>.md`
- pages without `agent.md` should also work through `/docs/<slug>` with `Signature-Agent`
- the human page remains readable and does not need to be rewritten for agents

## Primary Files

```txt
examples/next/next.config.ts
examples/next/app/api/docs/mcp/route.ts
examples/next/docs.config.tsx
examples/next/app/docs/getting-started/agent-ready-docs/page.mdx
examples/next/app/docs/getting-started/agent-ready-docs/agent.md
packages/next/src/config.ts
packages/fumadocs/src/docs-api.ts
```

## Route Rules

```ts
"/docs.md" -> "/api/docs?format=markdown"
"/docs/:slug*.md" -> "/api/docs?format=markdown&path=:slug*"
"/docs" + Signature-Agent -> "/api/docs?format=markdown"
"/docs/:slug*" + Signature-Agent -> "/api/docs?format=markdown&path=:slug*"
```

For this page:

```txt
/docs/getting-started/agent-ready-docs
/docs/getting-started/agent-ready-docs.md
/docs/getting-started/agent-ready-docs with Signature-Agent
```

## Markdown Route Shape

```ts
const handlers = createDocsAPI(docsConfig);

export async function GET(request, { params }) {
  const { slug = [] } = await params;
  const url = new URL(request.url);
  url.searchParams.set("format", "markdown");
  if (slug.length > 0) url.searchParams.set("path", slug.join("/"));
  return handlers.GET(new Request(url, { headers: request.headers }));
}
```

## Signature-Agent Behavior

`Signature-Agent` lets agents request the canonical docs URL and still receive markdown when they do
not send `Accept: text/markdown`.

```bash
curl http://localhost:3000/docs/getting-started/agent-ready-docs \
  -H "Signature-Agent: https://chatgpt.com"
```

Implementation contract:

- detect any non-empty `Signature-Agent` header
- only apply the markdown response under the configured docs entry route
- rewrite to the existing `/api/docs` handler with `format=markdown`
- derive `path` from the canonical docs slug without generating another API wrapper
- keep normal browser requests on the HTML page

## Implementation Notes

- `contentDir` must fall back to `app/${entry}` in the Next example
- `withDocs()` should auto-generate the existing docs API route and markdown rewrites
- the existing `/api/docs` GET handler should own markdown mode
- `Signature-Agent` rewrites should target `/api/docs?format=markdown`, not a separate wrapper
- normalize slug paths before matching page URLs
- use the shared docs page source for fallback markdown, so standard pages do not need extra setup
- fall back to normal page markdown when a page does not have `agent.md`
- return `text/markdown; charset=utf-8`
- set `X-Robots-Tag: noindex` on markdown responses
- do not expose `agent.md` as a standalone docs page

## MCP Parity

The Next example exposes MCP through:

```ts
createDocsMCPAPI(docsConfig);
```

Use MCP for tool-based reads and parity checks, but keep the `.md` route as the simple public HTTP
surface for both cases:
- `agent.md` when present
- normal page markdown when `agent.md` is missing

MCP also exposes `get_code_examples` for fenced code blocks with metadata:

````md
```ts title="docs.config.ts" framework="nextjs" packageManager="pnpm" runnable
```
````

Call it with filters such as `path`, `framework`, `packageManager`, `language`, `runnable`, `query`,
`limit`, and `locale`. The tool returns structured JSON and does not change the rendered docs UI.

MCP also exposes `list_docs` for section-aware discovery. Call it with no arguments for all docs, or
with `section` such as `getting-started` to get matching page summaries before calling `read_page`.

MCP also exposes `get_config_schema` for `docs.config.ts` metadata. Call it with no arguments for
the full schema, `option` for paths such as `mcp.tools.getConfigSchema`, or `query` for feature
areas such as `llms` or `page actions`.

## Test Commands

```bash
curl http://localhost:3000/docs/getting-started/agent-ready-docs
curl http://localhost:3000/docs/getting-started/agent-ready-docs.md
curl http://localhost:3000/docs/getting-started/agent-ready-docs \
  -H "Signature-Agent: https://chatgpt.com"
curl http://localhost:3000/docs/getting-started/quickstart.md
curl http://localhost:3000/docs/getting-started/quickstart \
  -H "Signature-Agent: https://chatgpt.com"
curl "http://localhost:3000/api/docs?format=markdown&path=getting-started/quickstart"
```

## Accept When

- `/docs/getting-started/agent-ready-docs.md` returns this file verbatim
- `/docs/getting-started/agent-ready-docs` with `Signature-Agent` returns this file verbatim
- `/docs/getting-started/quickstart.md` returns normal page markdown
- `/docs/getting-started/quickstart` with `Signature-Agent` returns normal page markdown
- `/docs/getting-started/agent-ready-docs` still renders the browser page
- MCP `read_page("/docs/getting-started/quickstart")` still returns normal docs content
- the implementation still works for pages that do not have `agent.md`

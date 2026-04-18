# Agent Context: Agent-Ready Docs

You are an implementation agent working on `@farming-labs/docs`. Treat this file as the
machine-oriented contract for this page, prefer exact file paths and acceptance checks, and keep
the human page readable.

Use this file when implementing or modifying the `.md` docs route in the Next example app.

## Objective

Keep this contract true:

- `/docs/getting-started/agent-ready-docs` renders the human HTML page
- `/docs/getting-started/agent-ready-docs.md` returns this file
- pages without `agent.md` should still work through `/docs/<slug>.md`
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
```

For this page:

```txt
/docs/getting-started/agent-ready-docs
/docs/getting-started/agent-ready-docs.md
```

## Markdown Route Shape

```ts
const handlers = createDocsAPI({ ... });

export async function GET(request, { params }) {
  const { slug = [] } = await params;
  const url = new URL(request.url);
  url.searchParams.set("format", "markdown");
  if (slug.length > 0) url.searchParams.set("path", slug.join("/"));
  return handlers.GET(new Request(url, { headers: request.headers }));
}
```

## Implementation Notes

- `contentDir` must fall back to `app/${entry}` in the Next example
- `withDocs()` should auto-generate the markdown bridge route and rewrites
- the existing `/api/docs` GET handler should own markdown mode
- normalize slug paths before matching page URLs
- use the shared docs page source for fallback markdown, so standard pages do not need extra setup
- fall back to normal page markdown when a page does not have `agent.md`
- return `text/markdown; charset=utf-8`
- set `X-Robots-Tag: noindex` on markdown responses
- do not expose `agent.md` as a standalone docs page

## MCP Parity

The Next example exposes MCP through:

```ts
createDocsMCPAPI({
  entry: docsConfig.entry,
  contentDir: docsConfig.contentDir,
  nav: docsConfig.nav,
  ordering: docsConfig.ordering,
  search: docsConfig.search,
  mcp: docsConfig.mcp,
});
```

Use MCP for tool-based reads and parity checks, but keep the `.md` route as the simple public HTTP
surface for both cases:
- `agent.md` when present
- normal page markdown when `agent.md` is missing

## Test Commands

```bash
curl http://localhost:3000/docs/getting-started/agent-ready-docs
curl http://localhost:3000/docs/getting-started/agent-ready-docs.md
curl http://localhost:3000/docs/getting-started/quickstart.md
curl "http://localhost:3000/api/docs?format=markdown&path=getting-started/quickstart"
```

## Accept When

- `/docs/getting-started/agent-ready-docs.md` returns this file verbatim
- `/docs/getting-started/quickstart.md` returns normal page markdown
- `/docs/getting-started/agent-ready-docs` still renders the browser page
- MCP `read_page("/docs/getting-started/quickstart")` still returns normal docs content
- the implementation still works for pages that do not have `agent.md`

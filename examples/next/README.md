# Next.js Example

Example docs site using `@farming-labs/docs` with `@farming-labs/theme`.

## Run

```bash
pnpm dev
```

## Test MCP

Start the app first:

```bash
pnpm dev
```

Then in another terminal run:

```bash
pnpm test:mcp
```

By default the smoke test checks `http://127.0.0.1:3000/api/docs/mcp` and verifies:

- `list_pages`
- `get_navigation`
- `search_docs`
- `read_page`

Optional overrides:

```bash
DOCS_MCP_URL=http://127.0.0.1:4021/api/docs/mcp pnpm test:mcp
MCP_SEARCH_QUERY=themes MCP_READ_PATH=quickstart pnpm test:mcp
```

## Adding Pages

Create an MDX file under `app/docs/`:

```
app/docs/your-page/page.mdx
```

```mdx
---
title: "Your Title"
description: "Page description"
icon: "rocket"
---

# Your Title

Content here.
```

No other config needed — the framework handles layout, routing, and metadata from `docs.config.ts`.

## Config

See [`docs.config.ts`](./docs.config.ts) for theme, metadata, icons, and page action configuration.

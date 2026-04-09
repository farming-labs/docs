# Next.js Example

Example docs site using `@farming-labs/docs` with `@farming-labs/theme`.

## Run

```bash
pnpm dev
```

## Search Providers

The example can run with `mcp`, `typesense`, or `algolia` search.

```bash
cp .env.local.example .env.local
```

### Typesense

- `DOCS_SEARCH_PROVIDER=typesense`
- `TYPESENSE_URL` to your Typesense host URL
- `TYPESENSE_API_KEY` to your Typesense key

Optional:

- `TYPESENSE_COLLECTION` to change the collection name
- `TYPESENSE_SEARCH_API_KEY` / `TYPESENSE_ADMIN_API_KEY` if you use separate keys
- `TYPESENSE_MODE=hybrid` plus `TYPESENSE_OLLAMA_MODEL` for hybrid search

If you want to sync the index manually instead of waiting for the first request:

```bash
pnpm exec docs search sync --typesense --config docs.config.tsx
```

### Algolia

- `DOCS_SEARCH_PROVIDER=algolia`
- `ALGOLIA_APP_ID` to your Algolia app id
- `ALGOLIA_SEARCH_API_KEY` to your Algolia search key

Optional:

- `ALGOLIA_INDEX_NAME` to change the index name
- `ALGOLIA_ADMIN_API_KEY` if you want automatic/manual index sync

Manual sync:

```bash
pnpm exec docs search sync --algolia --config docs.config.tsx
```

If you want to switch back to the built-in MCP search example:

```bash
DOCS_SEARCH_PROVIDER=mcp pnpm dev
```

To verify the active backend, query the docs API directly:

```bash
curl "http://127.0.0.1:3000/api/docs?query=session"
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

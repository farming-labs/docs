# Next.js Example

Example docs site using `@farming-labs/docs` with `@farming-labs/theme`.

## Run

```bash
pnpm dev
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

# Next.js Example

Example docs site using `@farming-labs/docs` with `theme/fumadocs` and fumadocs-ui.

**Config:** `docs.config.ts` only. **Docs:** write markdown in `app/docs/`.

## Structure

```
docs.config.ts          # Your config
app/docs/
  layout.tsx            # Provides DocsLayout (reads from docs.config)
  page.mdx              # /docs
  get-started/
    page.mdx            # /docs/get-started
  installation/
    page.mdx            # /docs/installation
```

**To add a doc:** create `app/docs/your-slug/page.mdx`:

```mdx
---
title: "Your Title"
description: "Description"
---

# Content
```

No content folder, no utils, no extra config.

## Run

```bash
pnpm dev
```

Build uses webpack (Turbopack has issues with @next/mdx): `pnpm build`

## Config

See `docs.config.ts` for theme, metadata, and OG configuration.

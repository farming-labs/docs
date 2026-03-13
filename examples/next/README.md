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

## Query Param I18n Example

Use query-param locale switching when you want URLs like `/docs/getting-started?lang=en`
and `/docs/getting-started?lang=fr` instead of `/docs/en/...`.

```tsx
// docs.config.tsx
import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
  i18n: {
    locales: ["en", "fr"],
    defaultLocale: "en",
  },
});
```

In the shared UI, this renders a locale `<select>` beside the theme toggle.

This example now includes a small working setup for the top-level docs routes:

- Localized content lives under `app/docs/en/**` and `app/docs/fr/**`.
- The public routes stay at `/docs`, `/docs/installation`, and `/docs/getting-started`.
- Route wrappers select the correct MDX file from `searchParams.lang` so the content
  changes without introducing `/docs/en` route segments.

# @farming-labs/docs

A modern, flexible MDX-based documentation framework. Write markdown, get a polished docs site — no boilerplate required.

## Packages

| Package | Description |
|---|---|
| `@farming-labs/docs` | Core config, types, CLI, and theme utilities |
| `@farming-labs/theme` | Fumadocs-based theme for Next.js with `default`, `darksharp`, and `pixel-border` variants |
| `@farming-labs/next` | Next.js adapter — `withDocs()` config wrapper and auto-generated routes |
| `@farming-labs/svelte` | SvelteKit adapter — server-side docs loader and markdown processing |
| `@farming-labs/svelte-theme` | Fumadocs-based theme for SvelteKit with `default` and `pixel-border` variants |

## Quick Start

### Option A: CLI (recommended)

Run `init` inside an existing Next.js or SvelteKit project:

```bash
npx @farming-labs/docs init
```

The CLI will:

1. Detect your framework (Next.js or SvelteKit)
2. Ask you to pick a theme
3. Ask for the docs entry path (default: `docs`)
4. Generate config, layout, CSS, and sample pages
5. Install all required dependencies
6. Start the dev server and give you a live URL

### Option B: Manual setup

#### Next.js

```bash
pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/next
```

**1. Create `docs.config.tsx`**

```tsx
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – Docs",
    description: "My documentation site",
  },
});
```

**2. Create `next.config.ts`**

```ts
import { withDocs } from "@farming-labs/next/config";
export default withDocs({});
```

**3. Import the theme CSS in `app/global.css`**

```css
@import "tailwindcss";
@import "@farming-labs/theme/default/css";
```

**4. Write docs**

Create MDX pages under `app/docs/`:

```
app/docs/
  page.mdx              # /docs
  installation/
    page.mdx            # /docs/installation
  getting-started/
    page.mdx            # /docs/getting-started
```

Each page uses frontmatter for metadata:

```mdx
---
title: "Installation"
description: "Get up and running in minutes"
icon: "rocket"
---

# Installation

Your content here.
```

That's it — no layout files, no `[[...slug]]` wrappers. The framework handles routing, layout, and metadata from your config.

#### SvelteKit

```bash
pnpm add @farming-labs/docs @farming-labs/svelte @farming-labs/svelte-theme
```

**1. Create `docs.config.ts`**

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/svelte-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  nav: {
    title: "My Docs",
    url: "/docs",
  },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "My documentation site",
  },
});
```

**2. Create `src/lib/docs.server.ts`**

```ts
import { createDocsServer } from "@farming-labs/svelte/server";
import config from "./docs.config";

// Bundle content at build time (required for serverless deployments)
const contentFiles = import.meta.glob("/docs/**/*.{md,mdx,svx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, POST } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});
```

**3. Create route files**

`src/routes/docs/+layout.svelte`:

```svelte
<script>
  import { DocsLayout } from "@farming-labs/svelte-theme";
  import config from "../../lib/docs.config";

  let { data, children } = $props();
</script>

<DocsLayout tree={data.tree} {config}>
  {@render children()}
</DocsLayout>
```

`src/routes/docs/+layout.server.js`:

```js
export { load } from "../../lib/docs.server";
```

`src/routes/docs/[...slug]/+page.svelte`:

```svelte
<script>
  import { DocsContent } from "@farming-labs/svelte-theme";
  import config from "../../../lib/docs.config";

  let { data } = $props();
</script>

<DocsContent {data} {config} />
```

**4. Import the theme CSS in `src/app.css`**

```css
@import "@farming-labs/svelte-theme/fumadocs/css";
```

**5. Write docs**

Create markdown files under `docs/`:

```
docs/
  page.md               # /docs
  installation/
    page.md             # /docs/installation
  getting-started/
    page.md             # /docs/getting-started
```

Each page uses frontmatter for metadata:

```md
---
title: "Installation"
description: "Get up and running in minutes"
icon: "rocket"
---

# Installation

Your content here.
```

## Themes

Three built-in theme variants, all based on Fumadocs:

### Next.js

```tsx
import { fumadocs } from "@farming-labs/theme";              // default
import { darksharp } from "@farming-labs/theme/darksharp";   // sharp edges, all-black
import { pixelBorder } from "@farming-labs/theme/pixel-border"; // better-auth inspired
```

```css
@import "@farming-labs/theme/default/css";
/* or */
@import "@farming-labs/theme/darksharp/css";
/* or */
@import "@farming-labs/theme/pixel-border/css";
```

### SvelteKit

```ts
import { fumadocs } from "@farming-labs/svelte-theme";
```

```css
@import "@farming-labs/svelte-theme/fumadocs/css";
/* or */
@import "@farming-labs/svelte-theme/pixel-border/css";
```

## Configuration

The `docs.config.ts` file is the single source of truth. Key options:

```tsx
export default defineDocs({
  entry: "docs",           // docs root folder
  theme: fumadocs(),       // theme preset

  nav: {                   // sidebar header
    title: "My Docs",
    url: "/docs",
  },

  breadcrumb: { enabled: true },

  themeToggle: {
    enabled: true,
    default: "dark",
  },

  metadata: {
    titleTemplate: "%s – Docs",
    description: "My docs site",
  },
});
```

## Development

```bash
pnpm install
pnpm build
pnpm dev        # starts the example app
```

## License

MIT

# @farming-labs/docs

A modern, flexible MDX-based documentation framework. Write markdown, get a polished docs site — no boilerplate required.

## Packages

| Package                      | Description                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `@farming-labs/docs`         | Core config, types, CLI, and theme utilities                                              |
| `@farming-labs/theme`        | Fumadocs-based theme for Next.js with `default`, `darksharp`, and `pixel-border` variants |
| `@farming-labs/next`         | Next.js adapter — `withDocs()` config wrapper and auto-generated routes                   |
| `@farming-labs/svelte`       | SvelteKit adapter — server-side docs loader and markdown processing                       |
| `@farming-labs/svelte-theme` | Fumadocs-based theme for SvelteKit with `default` and `pixel-border` variants             |
| `@farming-labs/astro`        | Astro adapter — server-side docs loader and markdown processing                           |
| `@farming-labs/astro-theme`  | Fumadocs-based theme for Astro with `default`, `darksharp`, and `pixel-border` variants   |
| `@farming-labs/nuxt`         | Nuxt 3 adapter — `defineDocsHandler()`, server-side docs loader, markdown processing      |
| `@farming-labs/nuxt-theme`   | Fumadocs-based theme for Nuxt with `default` variant                                      |

## Quick Start

### Option A: CLI (recommended)

Run `init` inside an existing Next.js, SvelteKit, Astro, or Nuxt project:

```bash
npx @farming-labs/docs init
```

The CLI will:

1. Detect your framework (Next.js, SvelteKit, Astro, or Nuxt)
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

#### Astro

```bash
pnpm add @farming-labs/docs @farming-labs/astro @farming-labs/astro-theme
```

**1. Create `src/lib/docs.config.ts`**

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/astro-theme";

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
import { createDocsServer } from "@farming-labs/astro/server";
import config from "./docs.config";

const contentFiles = import.meta.glob("/docs/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, POST } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});
```

**3. Create page routes**

`src/pages/docs/[...slug].astro`:

```astro
---
import DocsLayout from "@farming-labs/astro-theme/src/components/DocsLayout.astro";
import DocsContent from "@farming-labs/astro-theme/src/components/DocsContent.astro";
import config from "../../lib/docs.config";
import { load } from "../../lib/docs.server";
import "@farming-labs/astro-theme/css";

const data = await load(Astro.url.pathname);
---

<html lang="en">
  <head><title>{data.title} – Docs</title></head>
  <body>
    <DocsLayout tree={data.tree} config={config}>
      <DocsContent data={data} config={config} />
    </DocsLayout>
  </body>
</html>
```

**4. Create API route**

`src/pages/api/docs.ts`:

```ts
import type { APIRoute } from "astro";
import { GET as docsGET, POST as docsPOST } from "../../lib/docs.server";

export const GET: APIRoute = async ({ request }) => docsGET({ request });
export const POST: APIRoute = async ({ request }) => docsPOST({ request });
```

**5. Enable SSR in `astro.config.mjs`**

```js
import { defineConfig } from "astro/config";
export default defineConfig({ output: "server" });
```

**6. Write docs**

Create markdown files under `docs/`:

```
docs/
  page.md               # /docs
  installation/
    page.md             # /docs/installation
  getting-started/
    page.md             # /docs/getting-started
```

#### Nuxt

```bash
pnpm add @farming-labs/docs @farming-labs/nuxt @farming-labs/nuxt-theme
```

**1. Create `docs.config.ts`**

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/nuxt-theme";

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

**2. Configure `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  css: ["@farming-labs/nuxt-theme/fumadocs/css"],
  nitro: {
    serverAssets: [{ baseName: "docs", dir: "../docs" }],
  },
});
```

**3. Create `server/api/docs.ts`**

```ts
import { defineDocsHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsHandler(config, useStorage);
```

**4. Create `pages/docs/[...slug].vue`**

```vue
<script setup lang="ts">
import { DocsLayout, DocsContent } from "@farming-labs/nuxt-theme";
import config from "~/docs.config";

const route = useRoute();
const pathname = computed(() => route.path);

const { data, error } = await useFetch("/api/docs", {
  query: { pathname },
  watch: [pathname],
});

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found" });
}
</script>

<template>
  <div v-if="data" class="fd-docs-wrapper">
    <DocsLayout :tree="data.tree" :config="config">
      <DocsContent :data="data" :config="config" />
    </DocsLayout>
  </div>
</template>
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

## Themes

Three built-in theme variants, all based on Fumadocs:

### Next.js

```tsx
import { fumadocs } from "@farming-labs/theme"; // default
import { darksharp } from "@farming-labs/theme/darksharp"; // sharp edges, all-black
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

### Astro

```ts
import { fumadocs } from "@farming-labs/astro-theme";
```

```css
@import "@farming-labs/astro-theme/css";
/* or */
@import "@farming-labs/astro-theme/pixel-border/css";
/* or */
@import "@farming-labs/astro-theme/darksharp/css";
```

### Nuxt

```ts
import { fumadocs } from "@farming-labs/nuxt-theme/fumadocs";
```

```css
@import "@farming-labs/nuxt-theme/fumadocs/css";
```

### All Frameworks — Colorful Theme

A faithful reproduction of the fumadocs default theme with enhanced description support.

Available for all frameworks:

- Next.js: `import { colorful } from "@farming-labs/theme/colorful"` with `@import "@farming-labs/theme/colorful/css"`
- SvelteKit: `import { colorful } from "@farming-labs/svelte-theme/colorful"` with `@import "@farming-labs/svelte-theme/colorful/css"`
- Astro: `import { colorful } from "@farming-labs/astro-theme/colorful"` with `@import "@farming-labs/astro-theme/colorful/css"`
- Nuxt: `import { colorful } from "@farming-labs/nuxt-theme/colorful"` with `@import "@farming-labs/nuxt-theme/colorful/css"`

## Configuration

The `docs.config.ts` file is the single source of truth. Key options:

```tsx
export default defineDocs({
  entry: "docs", // docs root folder
  theme: fumadocs(), // theme preset

  nav: {
    // sidebar header
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

## For AI agents

This repo includes an **agent skill** so assistants can help with @farming-labs/docs setup and usage. The skill covers CLI (`init`, `--template`), manual setup per framework, themes, and theme CSS.

Install the skill with the [Skills CLI](https://skills.sh/) (format: `npx skills add <owner/repo>`):

```bash
npx skills add farming-labs/docs
```

- **Skill file:** [skills/farming-labs-docs/SKILL.md](./skills/farming-labs-docs/SKILL.md)
- **Full instructions:** [skills/README.md](./skills/README.md)

## Development

```bash
pnpm install
pnpm build
pnpm dev        # starts the example app
```

## License

MIT

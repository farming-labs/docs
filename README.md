# @farming-labs/docs

A modern, flexible MDX-based documentation framework. Write markdown, get a polished docs site — no boilerplate required.

### Quick Start
> **This package lets you build beautifull documentation to any Next.js, SvelteKit, Astro, or Nuxt project in minutes.**

- ✨ **Polished themes & search, zero setup**
- 🌍 **Choose your framework:** Next.js, SvelteKit, Astro, or Nuxt
- ⚡️ **Fast, fully static or server-rendered**
- 💡 **Type-safe config in code, not JSON**
- 📦 **Single install, zero lock-in**
- 🧬 **Write .mdx or .md — all features work out of the box**

**Get started:**

- Use the [CLI](#option-a-cli-recommended) _(recommended — sets up everything for you)_, or see [manual setup](#option-b-manual-setup) for each framework.
- [Reference docs](https://docs.farming-labs.dev/reference/) and [demos](https://github.com/farming-labs/docs/tree/main/example) cover config, custom themes, OG images, SEO, and more!
- Want to contribute? See the [Contributing guide](https://docs.farming-labs.dev/docs/contributing).



### Option A: CLI (recommended)

Run `init` inside an existing Next.js, SvelteKit, Astro, or Nuxt project:

```bash
npx @farming-labs/docs@latest init
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

**1. Create `docs.config.ts`**

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

Seven built-in themes (fumadocs, darksharp, pixel-border, colorful, greentree, darkbold, shiny), available on Next.js, SvelteKit, Astro, and Nuxt.

### Next.js

```tsx
import { fumadocs } from "@farming-labs/theme"; // default
import { darksharp } from "@farming-labs/theme/darksharp";
import { pixelBorder } from "@farming-labs/theme/pixel-border";
import { colorful } from "@farming-labs/theme/colorful";
import { greentree } from "@farming-labs/theme/greentree";
```

```css
@import "@farming-labs/theme/default/css";
/* or darksharp, pixel-border, colorful, greentree, etc. */
```

### SvelteKit

```ts
import { fumadocs } from "@farming-labs/svelte-theme";
```

```css
@import "@farming-labs/svelte-theme/fumadocs/css";
/* or darksharp, pixel-border, colorful, greentree, etc. */
```

### Astro

```ts
import { fumadocs } from "@farming-labs/astro-theme";
```

```css
@import "@farming-labs/astro-theme/css";
/* or pixel-border, darksharp, colorful, greentree, etc. */
```

### Nuxt

```ts
import { fumadocs } from "@farming-labs/nuxt-theme";
```

```css
@import "@farming-labs/nuxt-theme/fumadocs/css";
/* or darksharp, pixel-border, colorful, greentree, etc. */
```

## Token Efficiency — Why This Matters for AI

`@farming-labs/docs` keeps the framework footprint small so AI tools spend less time reading boilerplate and more time working with your actual content — while still giving you the full flexibility of a modern docs framework.

### One config, full control

Everything about your docs site — theme, colors, typography, sidebar, AI chat, metadata — lives in a single `docs.config.ts` file (~15 lines). There's a provider wrapper and a docs layout file, but they're minimal one-liners the CLI generates for you. The real configuration surface is that single file.

This matters because:

- **AI agents** (Cursor, Copilot, Claude) read your project files to help you. Fewer framework files = more token budget for your actual content.
- **One config file** means an AI can understand your entire docs setup by reading a single file, rather than tracing through multiple interconnected files.
- **Declarative config** is hard to break — an AI can change `theme: darksharp()` or add `ai: { enabled: true }` without worrying about import paths or component hierarchies.
- **llms.txt** is built in — your docs are automatically served in LLM-optimized format with zero extra config.

### The CLI does the heavy lifting

Starting from scratch? One command creates a fully themed docs site:

```bash
npx @farming-labs/docs@latest init --template next --name my-docs --theme pixel-border
```

Already have a project? Run `init` inside it — the CLI auto-detects your framework, generates config and minimal routing files, installs dependencies, and starts the dev server:

```bash
npx @farming-labs/docs@latest init
```

Pick from `next`, `nuxt`, `sveltekit`, or `astro`. Choose any of the 7 built-in themes. Your existing code is untouched.

## Configuration

The `docs.config.ts` file is the single source of truth. Key options:

```tsx
export default defineDocs({
  entry: "docs", // docs root folder
  theme: fumadocs(), // theme preset
  // staticExport: true, // for full static builds (Cloudflare Pages) — hides search & AI

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

This repo includes an **agent skill** so assistants can help with @farming-labs/docs setup and usage. The skill covers CLI (`init`, `--template`, `--name`), manual setup per framework, themes, and theme CSS.

Install skills with the [Skills CLI](https://skills.sh/) and pick your preferred skill(s) when prompted:

```bash
# npm
npx skills add farming-labs/docs

# pnpm
pnpx skills add farming-labs/docs

# yarn
yarn dlx skills add farming-labs/docs

# bun
bunx skills add farming-labs/docs
```

The CLI lists skills under `skills/farming-labs/` (e.g. `getting-started`, `cli`, `creating-themes`, `ask-ai`, `page-actions`, `configuration`). All skills conform to the [Agent Skills specification](https://agentskills.io/specification).

- **Skills index:** [skills/farming-labs/README.md](./skills/farming-labs/README.md)
- **Root skills README:** [skills/README.md](./skills/README.md)

## Development

```bash
pnpm install
pnpm build
pnpm dev        # starts the example app
```

## Contributing

We welcome contributions. See the **[Contributing guide](https://docs.farming-labs.dev/docs/contributing)** for how to report issues, suggest features, and submit pull requests.

## License

MIT

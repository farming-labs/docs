# @farming-labs/docs

A modern, flexible MDX-based documentation framework. Write markdown, get a polished docs site — no boilerplate required.

### Quick Start
> **This package lets you build beautiful documentation to any Next.js, TanStack Start, SvelteKit, Astro, or Nuxt project in minutes.**

- ✨ **Polished themes & search, zero setup**
- 🌍 **Choose your framework:** Next.js, TanStack Start, SvelteKit, Astro, or Nuxt
- ⚡️ **Fast, fully static or server-rendered**
- 💡 **Type-safe config in code, not JSON**
- 📦 **Single install, zero lock-in**
- 🧬 **Write .mdx or .md — all features work out of the box**
- 🧾 **Generated API reference from framework route handlers or a hosted OpenAPI JSON**
- 🧩 **Built-in MDX UI** — `Callout`, `Tabs`, `HoverLink`, and overridable built-ins via `components` and `theme.ui.components`
- 💬 **Built-in docs actions** — page feedback, copy/open page actions, and code-block copy callbacks

**Get started:**

- Use the [CLI](#option-a-cli-recommended) _(recommended — sets up everything for you)_, or see [manual setup](#option-b-manual-setup) for each framework.
- [Reference docs](https://docs.farming-labs.dev/docs/reference) and [examples](https://github.com/farming-labs/docs/tree/main/examples) cover config, custom themes, OG images, API reference, SEO, and more.
- Want to contribute? See the [Contributing guide](https://docs.farming-labs.dev/docs/contributing).

### Option A: CLI (recommended)

Run `init` inside an existing Next.js, TanStack Start, SvelteKit, Astro, or Nuxt project:

```bash
npx @farming-labs/docs init
```

The CLI will:

1. Detect your framework (Next.js, TanStack Start, SvelteKit, Astro, or Nuxt)
2. Ask you to pick a theme
3. Ask for the docs entry path (default: `docs`)
4. Optionally scaffold internationalized docs with locale folders like `docs/en`, `docs/fr`, or `docs/zh`
5. Generate config, layout, CSS, and sample pages
6. Install all required dependencies
7. Start the dev server and give you a live URL

If you enable i18n during init, the CLI asks you to:

- Multi-select common languages such as `en`, `fr`, `es`, `de`, `pt`, `ja`, `ko`, `zh`, and more
- Add extra locale codes manually (for example `pt-BR`)
- Pick a default locale

It then writes the `i18n` config and creates locale-aware starter content for each framework.

If you enable **API reference** during init, the CLI writes the `apiReference` block into
`docs.config` and scaffolds the route handler files for **TanStack Start**, **SvelteKit**,
**Astro**, and **Nuxt** so the generated reference works immediately. In **Next.js**,
`withDocs()` generates the API reference route automatically when `apiReference` is enabled.

If your backend is hosted somewhere else, you can switch the generated `apiReference` block to
remote mode later by setting `specUrl` to a hosted `openapi.json`.

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
  apiReference: {
    enabled: true,
    path: "api-reference",
  },
  feedback: {
    enabled: true,
  },
  pageActions: {
    copyMarkdown: true,
    openDocs: true,
  },
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

## API Reference

`apiReference` generates an API reference from each framework's route conventions or from a hosted
OpenAPI JSON document.

Use local route scanning when your API lives in the same app. Use `specUrl` when your backend is
hosted elsewhere and already exposes an `openapi.json`.

Current support:

- **Next.js:** `app/api/**/route.ts` and `src/app/api/**/route.ts`
- **TanStack Start:** `src/routes/api.*.ts` and nested route files under the configured route root
- **SvelteKit:** `src/routes/api/**/+server.ts` or `+server.js`
- **Astro:** `src/pages/api/**/*.ts` or `.js`
- **Nuxt:** `server/api/**/*.ts` or `.js`

```ts
export default defineDocs({
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    routeRoot: "api",
    exclude: ["/api/internal/health", "internal/debug"],
  },
  theme: fumadocs(),
});
```

Remote OpenAPI JSON:

```ts
export default defineDocs({
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    specUrl: "https://petstore3.swagger.io/api/v3/openapi.json",
  },
  theme: fumadocs(),
});
```

- `path` controls the public URL for the generated reference
- `specUrl` points to a hosted OpenAPI JSON document; when set, local route scanning is skipped
- `routeRoot` controls the filesystem route root to scan
- `exclude` accepts either URL-style paths (`"/api/hello"`) or route-root-relative entries (`"hello"` / `"hello/route.ts"`)
- when `specUrl` is set, `routeRoot` and `exclude` are ignored

### Next.js

Nothing else is required beyond `apiReference` in `docs.config.ts` and `withDocs()` in
`next.config.ts`. The route at `/{path}` is generated automatically.

### TanStack Start

Create `src/routes/api-reference.index.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { createTanstackApiReference } from "@farming-labs/tanstack-start/api-reference";
import docsConfig from "../../docs.config";

const handler = createTanstackApiReference(docsConfig);

export const Route = createFileRoute("/api-reference/")({
  server: {
    handlers: {
      GET: handler,
    },
  },
});
```

Create `src/routes/api-reference.$.ts` with the same handler and
`createFileRoute("/api-reference/$")`.

### SvelteKit

Create `src/routes/api-reference/+server.ts`:

```ts
import { createSvelteApiReference } from "@farming-labs/svelte/api-reference";
import config from "$lib/docs.config";

export const GET = createSvelteApiReference(config);
```

Create `src/routes/api-reference/[...slug]/+server.ts` with the same `GET` export.

### Astro

Create `src/pages/api-reference/index.ts`:

```ts
import { createAstroApiReference } from "@farming-labs/astro/api-reference";
import config from "../../lib/docs.config";

export const GET = createAstroApiReference(config);
```

Create `src/pages/api-reference/[...slug].ts` with the same `GET` export.

### Nuxt

Create `server/routes/api-reference/index.ts`:

```ts
import { defineApiReferenceHandler } from "@farming-labs/nuxt/api-reference";
import config from "~/docs.config";

export default defineApiReferenceHandler(config);
```

The same route files are used whether you scan local route handlers or use a remote `specUrl`. The
only difference is where the API reference data comes from.

Create `server/routes/api-reference/[...slug].ts` with the same default export.

See the full docs for more detail:

- [Configuration](https://docs.farming-labs.dev/docs/configuration#api-reference)
- [API Reference config](https://docs.farming-labs.dev/docs/reference#apireferenceconfig)

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

Nine built-in theme entrypoints (`fumadocs`, `darksharp`, `pixel-border`, `colorful`, `greentree`, `darkbold`, `shiny`, `concrete`, `hardline`) are available across Next.js, TanStack Start, SvelteKit, Astro, and Nuxt. `hardline` is the original hard-edge preset, and `concrete` is the louder brutalist poster-style variant.

### Next.js

```tsx
import { fumadocs } from "@farming-labs/theme"; // default
import { darksharp } from "@farming-labs/theme/darksharp";
import { pixelBorder } from "@farming-labs/theme/pixel-border";
import { colorful } from "@farming-labs/theme/colorful";
import { greentree } from "@farming-labs/theme/greentree";
import { concrete } from "@farming-labs/theme/concrete";
```

```css
@import "@farming-labs/theme/default/css";
/* or darksharp, pixel-border, colorful, greentree, concrete, hardline, etc. */
```

### SvelteKit

```ts
import { fumadocs } from "@farming-labs/svelte-theme";
import { concrete } from "@farming-labs/svelte-theme/concrete";
```

```css
@import "@farming-labs/svelte-theme/fumadocs/css";
/* or darksharp, pixel-border, colorful, greentree, concrete, hardline, etc. */
```

### Astro

```ts
import { fumadocs } from "@farming-labs/astro-theme";
import { concrete } from "@farming-labs/astro-theme/concrete";
```

```css
@import "@farming-labs/astro-theme/css";
/* or pixel-border, darksharp, colorful, greentree, concrete, hardline, etc. */
```

### Nuxt

```ts
import { fumadocs } from "@farming-labs/nuxt-theme";
import { concrete } from "@farming-labs/nuxt-theme/concrete";
```

```css
@import "@farming-labs/nuxt-theme/fumadocs/css";
/* or darksharp, pixel-border, colorful, greentree, concrete, hardline, etc. */
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
npx @farming-labs/docs init --template next --name my-docs --theme pixel-border
```

Already have a project? Run `init` inside it — the CLI auto-detects your framework, generates config and minimal routing files, installs dependencies, and starts the dev server:

```bash
npx @farming-labs/docs init
```

Pick from `next`, `tanstack-start`, `nuxt`, `sveltekit`, or `astro`. Choose any of the 8 built-in themes. Your existing code is untouched.

## Configuration

The `docs.config.ts` file is the single source of truth. Key options:

```tsx title="docs.config.ts"
export default defineDocs({
  entry: "docs", // docs root folder
  theme: fumadocs(), // theme preset
  apiReference: {
    enabled: true,
    path: "api-reference",
    // specUrl: "https://example.com/openapi.json", // optional: use a hosted OpenAPI JSON instead of local route scanning
  },
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

This repo includes **agent skills** so assistants can help with @farming-labs/docs setup and usage. The skills cover CLI (`init`, `--template`, `--name`, `--api-reference`), manual setup per framework, generated API reference wiring, themes, and theme CSS.

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

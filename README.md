# @farming-labs/docs

A modern, flexible MDX-based documentation framework. Write markdown, get a polished docs site — no boilerplate required.

## Packages

| Package | Description |
|---|---|
| `@farming-labs/docs` | Core config, types, CLI, and theme utilities |
| `@farming-labs/fumadocs` | Fumadocs-based theme with `default`, `darksharp`, and `pixel-border` variants |
| `@farming-labs/next` | Next.js adapter — `withDocs()` config wrapper and auto-generated routes |

## Quick Start

### Option A: CLI (recommended)

Run `init` inside an existing Next.js project:

```bash
npx @farming-labs/docs init
```

The CLI will:

1. Detect your framework (Next.js)
2. Ask you to pick a theme (`fumadocs`)
3. Ask for the docs entry path (default: `docs`)
4. Generate `docs.config.ts`, `next.config.ts`, `global.css`, and sample pages
5. Install all required dependencies
6. Start the dev server and give you a live URL

### Option B: Manual setup

```bash
pnpm add @farming-labs/docs @farming-labs/fumadocs @farming-labs/next
```

**1. Create `docs.config.tsx`**

```tsx
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/fumadocs";

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
@import "@farming-labs/fumadocs/default/css";
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

## Themes

Three built-in theme variants, all based on Fumadocs:

```tsx
import { fumadocs } from "@farming-labs/fumadocs";              // default
import { darksharp } from "@farming-labs/fumadocs/darksharp";   // sharp edges, all-black
import { pixelBorder } from "@farming-labs/fumadocs/pixel-border"; // better-auth inspired
```

Import the matching CSS in your `global.css`:

```css
@import "@farming-labs/fumadocs/default/css";
/* or */
@import "@farming-labs/fumadocs/darksharp/css";
/* or */
@import "@farming-labs/fumadocs/pixel-border/css";
```

## Configuration

The `docs.config.tsx` file is the single source of truth. Key options:

```tsx
export default defineDocs({
  entry: "docs",           // docs root folder under app/
  theme: fumadocs(),       // theme preset

  nav: {                   // sidebar header
    title: "My Docs",      // string or ReactNode
    url: "/docs",
  },

  components: {            // custom MDX components
    MyNote: MyNoteComponent,
  },

  icons: {                 // icon registry for frontmatter `icon` field
    rocket: <Rocket size={16} />,
    code: <Code size={16} />,
  },

  breadcrumb: { enabled: true },

  themeToggle: {
    enabled: true,         // show/hide dark mode toggle
    default: "dark",       // default theme when hidden
  },

  pageActions: {
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      providers: [
        { name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={url}" },
      ],
    },
    position: "below-title",
  },

  metadata: {
    titleTemplate: "%s – Docs",
    description: "My docs site",
  },

  typography: {
    font: {
      style: { sans: "system-ui", mono: "ui-monospace" },
      h1: { size: "2.25rem", weight: 700 },
      body: { size: "1rem", lineHeight: "1.75" },
    },
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

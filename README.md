# Farming Labs Docs Framework

Modern, flexible MDX-based docs framework with themes, components, and SEO support. Inspired by [Fumadocs](https://github.com/fuma-nama/fumadocs).

## Features

- **MDX pages** – Write docs in MDX with frontmatter
- **Nested pages** – File-based routing: `/docs/page.mdx`, `/docs/intro/page.mdx`
- **Theme system** – Colors, typography, layout, component defaults
- **Fumadocs preset** – Ready-to-use theme with overrides
- **Metadata & OG** – Title templates, descriptions, dynamic OG images
- **Framework agnostic** – Core config works with Next.js, Vite, etc.

## Package Structure

```
packages/docs/             # @farming-labs/docs
├── index.ts               # defineDocs, types, utils
└── theme/fumadocs/        # Fumadocs preset (fumadocs-ui)
    ├── index.ts           # fumadocs() preset
    └── mdx.ts             # getMDXComponents()
```

## Page Structure

Docs live under a single entry folder:

```
content/
  docs/
    page.mdx              # Root: /docs
    introduction/
      page.mdx            # /docs/introduction
    getting-started/
      page.mdx            # /docs/getting-started
```

**URL mapping:**
- `docs/page.mdx` → `/docs`
- `docs/introduction/page.mdx` → `/docs/introduction`
- `docs/getting-started/page.mdx` → `/docs/getting-started`

## Frontmatter

Each page supports frontmatter:

```yaml
---
title: "Introduction"
description: "Learn the basics of our framework"
tags: ["getting-started"]
ogImage: "/og/custom.png"
---

# Introduction
```

## Config (`docs.config.ts`)

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/docs/theme/fumadocs";

export default defineDocs({
  entry: "docs",

  theme: fumadocs({
    ui: {
      colors: { primary: "#22c55e" },
      components: { Callout: { variant: "outline" } },
    },
  }),

  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by Fumadocs preset",
  },

  og: {
    enabled: true,
    type: "dynamic",
    endpoint: "/api/og",
    defaultImage: "/og/default.png",
  },
});
```

## Theme System

`theme` is the single source of truth. `ui` inside theme controls:

| Key | Purpose |
|-----|---------|
| `colors` | primary, background, muted, border |
| `typography` | fontFamily, monoFontFamily, scale (h1, h2, body) |
| `layout` | contentWidth, sidebarWidth, toc, header |
| `components` | Default props for Callout, CodeBlock, Tabs, etc. |

**Use preset** (install `fumadocs-ui fumadocs-core`):
```ts
theme: fumadocs({ ui: { colors: { primary: "#22c55e" } } })
```

**Custom theme:**
```ts
const myTheme: DocsTheme = {
  name: "my-theme",
  ui: {
    colors: { primary: "#ff4d8d" },
    layout: { contentWidth: 900 },
    components: { Callout: { variant: "outline" } },
  },
};
theme: myTheme
```

## Components in MDX

Components are provided by your framework adapter (e.g. `mdx-components.tsx`). Default props come from `theme.ui.components`:

```mdx
<Callout type="info">
  This is a Fumadocs-style callout
</Callout>
```

## Examples

- **[Next.js](./examples/next)** – App Router, MDX, static generation

## Getting Started

```bash
pnpm install
pnpm build
cd examples/next && pnpm dev
```

## Reference

- [Fumadocs](https://github.com/fuma-nama/fumadocs) – Design inspiration
- [MDX](https://mdxjs.com/) – MDX spec

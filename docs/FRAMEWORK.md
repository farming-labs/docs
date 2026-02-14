# Farming Labs Docs Framework – Full Specification

This document merges the complete specification for the docs framework, including page structure, themes, components, metadata, and framework integration.

## 1. Pages & File Structure

Docs pages live under a single **entry** folder (default: `docs`).

### Structure

```
content/
  docs/
    page.mdx                 # Root page → /docs
    introduction/
      page.mdx               # → /docs/introduction
    getting-started/
      page.mdx               # → /docs/getting-started
    advanced/
      concepts/
        page.mdx             # → /docs/advanced/concepts
```

### URL Mapping

| File | URL |
|------|-----|
| `docs/page.mdx` | `/docs` |
| `docs/introduction/page.mdx` | `/docs/introduction` |
| `docs/advanced/concepts/page.mdx` | `/docs/advanced/concepts` |

### Frontmatter

```yaml
---
title: "Introduction"
description: "Learn the basics of our framework"
tags: ["getting-started"]
icon: "book"
ogImage: "/og/intro.png"
---

# Content
```

Used for:
- Page title (required)
- Meta description
- Tags / categorization
- Sidebar icon
- Per-page OG image override

---

## 2. Theme System

`theme` is the top-level key in `docs.config.ts`. `ui` inside theme replaces the old "tokens" concept.

### UIConfig

```ts
interface UIConfig {
  colors?: {
    primary?: string;
    background?: string;
    muted?: string;
    border?: string;
  };
  typography?: {
    fontFamily?: string;
    monoFontFamily?: string;
    scale?: { h1?: string; h2?: string; h3?: string; body?: string };
  };
  layout?: {
    contentWidth?: number;
    sidebarWidth?: number;
    toc?: { enabled?: boolean; depth?: number };
    header?: { height?: number; sticky?: boolean };
  };
  components?: {
    [key: string]: Record<string, any> | ((defaults: any) => any);
  };
}
```

### Users Can

1. **Use Fumadocs preset** – `fumadocs()`
2. **Extend via overrides** – `fumadocs({ ui: { colors: { primary: "#22c55e" } } })`
3. **Replace with custom theme** – Pass a full `DocsTheme` object

---

## 3. Fumadocs Preset

Install: `pnpm add fumadocs-ui fumadocs-core`

```ts
import { fumadocs } from "@farming-labs/docs/theme/fumadocs";

theme: fumadocs({
  ui: {
    colors: { primary: "#22c55e" },
    components: { Callout: { variant: "outline" } },
  },
});
```

**Includes:**
- Fumadocs-style colors, typography, layout
- Component default props (Callout, CodeBlock, Tabs)
- Deep-merge overrides

**Reference:** [Fumadocs GitHub](https://github.com/fuma-nama/fumadocs)

---

## 4. Components in MDX

No separate component registry. MDX uses components from your framework adapter (e.g. `mdx-components.tsx`). Default props come from `theme.ui.components`.

### Example Usage

```mdx
<Callout type="info">
  This is a Fumadocs-style callout
</Callout>

<CodeBlock language="ts">
{`console.log("Hello World")`}
</CodeBlock>
```

Component implementations are framework-specific; the config only defines default props.

---

## 5. Metadata & OG

Handled **outside** theme – content/SEO-specific.

```ts
metadata: {
  titleTemplate: "%s – Docs",
  description: "Awesome docs powered by Fumadocs preset",
  twitterCard: "summary_large_image",
},

og: {
  enabled: true,
  type: "dynamic",
  endpoint: "/api/og",
  defaultImage: "/og/default.png",
},
```

- **static** – Use `defaultImage` for all pages
- **dynamic** – Endpoint receives page data, returns OG image
- Frontmatter `ogImage` overrides per page

---

## 6. Framework Agnostic Design

The core package (`@farming-labs/docs`) provides:

- `defineDocs(config)` – Config definition
- `fumadocs(overrides)` – Theme preset
- `resolveTitle()`, `resolveOGImage()` – Metadata helpers
- Types: `DocsConfig`, `DocsTheme`, `UIConfig`, `PageFrontmatter`, etc.

**Framework adapters** (Next.js, Vite, etc.) handle:

- File discovery and MDX compilation
- Routing (e.g. App Router `[[...slug]]`)
- Passing `theme.ui` to layout/components
- OG image generation

---

## 7. Next.js Example

See [examples/next](../examples/next):

- `content/docs/` – MDX pages
- `docs.config.ts` – Framework config
- `app/docs/[[...slug]]/page.tsx` – Dynamic route
- `lib/docs.ts` – File discovery, frontmatter parsing
- `mdx-components.tsx` – Component mapping

```bash
cd examples/next && pnpm dev
```

---

## 8. Custom Theme Example

```ts
// my-theme.ts
import type { DocsTheme } from "@farming-labs/docs";

const myTheme: DocsTheme = {
  name: "my-theme",
  ui: {
    colors: { primary: "#ff4d8d" },
    layout: { contentWidth: 900 },
    components: { Callout: { variant: "outline" } },
  },
};

// docs.config.ts
import myTheme from "./my-theme";

export default defineDocs({
  theme: myTheme,
});
```

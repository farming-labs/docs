<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:49626196cddb16c7
settingsHash=fnv1a64:ea29d93dde491bab
outputHash=fnv1a64:44f89535b30a6f07
generatedAt=2026-08-14T12:45:39.242Z
-->
---
title: "Shadcn"
description: "Compact neutral theme matching the layout, typography, and controls of the shadcn/ui documentation"
canonical_url: "/docs/themes/shadcn"
markdown_url: "/docs/themes/shadcn.md"
last_updated: "2026-08-04"
---

# Shadcn Theme
URL: /docs/themes/shadcn
LLM index: /llms.txt
Description: Compact neutral theme matching the layout, typography, and controls of the shadcn/ui documentation
Related: /docs/themes, /docs/themes/threadline, /docs/customization/colors, /docs/themes/creating-themes

Apply via `shadcn` from `@farming-labs/theme/shadcn`, `theme: shadcn()`, and `@import "@farming-labs/theme/shadcn/css"` in global stylesheet. Expect 56px header, 288px sidebar, 640px reading column, 256px TOC, Geist typography, neutral surfaces, compact controls in light/dark mode. Verify `/shadcn/css` entrypoint and `shadcn()` factory are both configured.

Unofficial preset modeled on [shadcn/ui documentation](https://ui.shadcn.com/docs); recreates the shell and interactions without copying branding or content.

## Usage

```tsx title="docs.config.ts"
import { defineDocs } from "@farming-labs/docs";
import { shadcn } from "@farming-labs/theme/shadcn";

export default defineDocs({
  entry: "docs",
  theme: shadcn(),
});
```

```css title="app/global.css"
@import "tailwindcss";
@import "@farming-labs/theme/shadcn/css";
```

## Defaults

| Property | Value |
| --- | --- |
| Primary | Neutral black / white |
| Background | White (light), neutral near-black (dark) |
| Border radius | `0.625rem` |
| Content width | 640px |
| Sidebar width | 288px |
| TOC width | 256px |
| Header height | 56px |

## Style Notes

- Compact desktop navigation and quiet search controls
- Rounded active sidebar rows with subtle fading divider
- Narrow reading measure and restrained heading scale
- Borderless soft code blocks, callouts, cards, and page actions

---
name: creating-themes
description: Create and share a custom theme for @farming-labs/docs. Use when building a theme with createTheme(), extendTheme(), cherry-picking built-in defaults, publishing as npm package, or adding CSS overrides. Covers ui.colors, typography, layout, sidebar, radius, ui.components like HoverLink, and package layout for publishing.
---

# @farming-labs/docs — Creating and Sharing Themes

**Use this skill when:** the user wants to create a custom theme, extend an existing theme, or publish/share a theme (e.g. as npm). For general setup (init, install, docs.config), use the **getting-started** skill.

**Full guide:** [Creating your own theme](https://docs.farming-labs.dev/docs/themes/creating-themes).

---

## Quick: create a theme

```ts title="my-theme.ts"
import { createTheme } from "@farming-labs/docs";

export const myTheme = createTheme({
  name: "my-theme",
  ui: {
    colors: {
      primary: "#e11d48",
      background: "#09090b",
      foreground: "#fafafa",
      muted: "#71717a",
      border: "#27272a",
    },
    radius: "0.5rem",
  },
});
```

Use in `docs.config`:

```ts
import { defineDocs } from "@farming-labs/docs";
import { myTheme } from "./my-theme";

export default defineDocs({
  entry: "docs",
  theme: myTheme(),
});
```

Users can override: `theme: myTheme({ ui: { colors: { primary: "#3b82f6" } } })`.

---

## Extend an existing theme

Use `extendTheme()` to build on a built-in preset:

```ts
import { extendTheme } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export const myTheme = extendTheme(fumadocs(), {
  name: "my-variant",
  ui: {
    colors: { primary: "#22c55e" },
    sidebar: { style: "bordered" },
  },
});
```

For other frameworks use the same framework's theme package (e.g. `@farming-labs/svelte-theme`, `@farming-labs/astro-theme`, `@farming-labs/nuxt-theme`). You can extend any built-in: `fumadocs`, `darksharp`, `pixelBorder`, `colorful`, `greentree`, `darkbold`, `shiny`, `concrete`, `monolith` (`hardline` also remains available as an alias).

**Important:** `extendTheme()` returns a theme **instance** (not a factory). Use `createTheme()` when you want a reusable preset that others call as `myTheme()`.

---

## Config options (createTheme / extendTheme)

| Area | Key options |
|------|-------------|
| **name** | Unique string (e.g. `"my-theme"`) for debugging and CSS scoping. |
| **ui.colors** | `primary`, `primaryForeground`, `background`, `foreground`, `muted`, `mutedForeground`, `border`, `card`, `cardForeground`, `accent`, `accentForeground`, `secondary`, `secondaryForeground`, `popover`, `popoverForeground`, `ring`. Any valid CSS color (hex, rgb, hsl, oklch). |
| **ui.typography** | `font.style.sans`, `font.style.mono`, `font.h1`–`h4`, `font.body`, `font.small` (size, weight, lineHeight, letterSpacing). |
| **ui.radius** | Global radius: `"0.5rem"`, `"0px"`, `"0.75rem"`. |
| **ui.layout** | `contentWidth`, `sidebarWidth`, `tocWidth`, `toc.enabled`, `toc.depth`, `header.height`, `header.sticky`. |
| **ui.codeBlock** | `showLineNumbers`, `showCopyButton`, `theme`, `darkTheme`. |
| **ui.sidebar** | `style: "default" \| "bordered" \| "floating"`, `background`, `borderColor`. |
| **ui.card** | `bordered`, `background`. |
| **ui.components** | Built-in component defaults such as `Callout`, `Tabs`, or `HoverLink` (for example `HoverLink: { linkLabel: "Open page", showIndicator: false }`). |

Only set what you want to change; the rest is inherited.

---

## Cherry-pick from built-in themes

Mix defaults from different built-in themes:

```ts
import { DefaultUIDefaults } from "@farming-labs/theme/default";
import { DarksharpUIDefaults } from "@farming-labs/theme/darksharp";
import { PixelBorderUIDefaults } from "@farming-labs/theme/pixel-border";
import { createTheme } from "@farming-labs/docs";

export const myTheme = createTheme({
  name: "my-hybrid-theme",
  ui: {
    colors: PixelBorderUIDefaults.colors,
    typography: DefaultUIDefaults.typography,
    layout: DarksharpUIDefaults.layout,
    sidebar: { style: "floating" },
    components: {
      HoverLink: { linkLabel: "Open page", showIndicator: false },
    },
  },
});
```

Export your own defaults so others can extend: `export { MyThemeDefaults };`.

---

## Publishing as an npm package

### Package layout

```
my-fumadocs-theme/
  src/
    index.ts       ← createTheme() and exports
    theme.css      ← optional CSS overrides
  package.json
```

### package.json (minimal)

```json
{
  "name": "my-fumadocs-theme",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": { "import": "./dist/index.mjs", "types": "./dist/index.d.mts" },
    "./css": "./src/theme.css"
  },
  "peerDependencies": {
    "@farming-labs/docs": ">=0.0.1"
  }
}
```

If the theme has no CSS, omit the `"./css"` export. If it does, users import it in their global CSS (Next: `app/global.css`, SvelteKit: `src/app.css`, Nuxt: `css` in `nuxt.config.ts`, Astro: in layout or page).

### How users install and use

```bash
npm install my-fumadocs-theme
# or pnpm add / yarn add / bun add
```

```ts title="docs.config.ts"
import { myTheme } from "my-fumadocs-theme";

export default defineDocs({
  entry: "docs",
  theme: myTheme(),
});
```

```css title="app/global.css (if theme ships CSS)"
@import "tailwindcss";
@import "my-fumadocs-theme/css";
```

---

## Optional: custom CSS file

For pixel-level control (sidebar, code blocks, callouts), ship a `theme.css` that:

1. Imports a base preset: `@import "@farming-labs/theme/presets/black";` or `@import "@farming-labs/theme/presets/neutral";`
2. Overrides `--color-fd-*` and other variables in `:root` and `.dark`
3. Targets component selectors (e.g. `aside#nd-sidebar`, `a[data-active]`) as needed

See the [Creating your own theme](https://docs.farming-labs.dev/docs/themes/creating-themes) doc for the full list of selectors and presets.

---

## Resources

- **Full guide:** [docs.farming-labs.dev/docs/themes/creating-themes](https://docs.farming-labs.dev/docs/themes/creating-themes)
- **Themes overview:** [docs.farming-labs.dev/docs/themes](https://docs.farming-labs.dev/docs/themes)
- **Repo:** [github.com/farming-labs/docs](https://github.com/farming-labs/docs)

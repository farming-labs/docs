<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:9de8a42e8afba5f6
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:96ac54bdd0b8d244
generatedAt=2026-10-09T23:22:26.212Z
-->
# Themes
URL: /docs/themes
Description: Built-in themes and how to create your own
Related: /docs/themes/creating-themes, /docs/configuration, /docs/customization/colors, /docs/customization/typography

Select a factory and package subpath as a pair—for example, `pixelBorder` from `@farming-labs/theme/pixel-border` with `theme: pixelBorder()`—then import the matching CSS globally. Use `createTheme()` for custom factories and `extendTheme()` to derive from a preset. If visuals do not change, fix the CSS entrypoint; if the factory cannot be resolved, copy its exact export and import path from the table below.

## Using a Theme

```tsx title="docs.config.ts"
import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder(),
});
```

```css title="app/global.css"
@import "tailwindcss";
@import "@farming-labs/theme/pixel-border/css";
```

## Built-in Themes

| Theme | Import | Description |
|---|---|---|
| [Default](/docs/themes/default) | `@farming-labs/theme` | Neutral colors, standard radius |
| [Colorful](/docs/themes/colorful) | `@farming-labs/theme/colorful` | Warm amber accent, Inter typography |
| [Darksharp](/docs/themes/darksharp) | `@farming-labs/theme/darksharp` | All-black, sharp corners |
| [Pixel Border](/docs/themes/pixel-border) | `@farming-labs/theme/pixel-border` | Rounded borders and refined navigation |
| [Shiny](/docs/themes/shiny) | `@farming-labs/theme/shiny` | Polished purple accents; React adapters only |
| [DarkBold](/docs/themes/darkbold) | `@farming-labs/theme/darkbold` | Monochrome Geist theme; React adapters only |
| [Ledger](/docs/themes/ledger) | `@farming-labs/theme/ledger` | Product documentation shell with dark code panels |
| [Shadcn](/docs/themes/shadcn) | `@farming-labs/theme/shadcn` | Compact neutral documentation shell |
| [GreenTree](/docs/themes/greentree) | `@farming-labs/theme/greentree` | Emerald accent and Inter typography |
| [Concrete](/docs/themes/concrete) | `@farming-labs/theme/concrete` | Brutalist poster-style surfaces |
| [Command Grid](/docs/themes/command-grid) | `@farming-labs/theme/command-grid` | Paper-grid command documentation shell |
| [Hardline](/docs/themes/hardline) | `@farming-labs/theme/hardline` | Square corners and bold borders |
| [Threadline](/docs/themes/threadline) | `@farming-labs/theme/threadline` | Compact chat and agent docs shell; React adapters only |
| [Junction](/docs/themes/junction) | `@farming-labs/theme/junction` | Blueprint canvas, dark navigation spine, and numbered sections |

Junction supports Next.js, TanStack Start, Farm.js, SvelteKit, Astro, and Nuxt. Use the matching framework factory package and always pair it with `@farming-labs/theme/junction/css`. DarkBold, Shiny, and Threadline are limited to the React adapters and must not be offered in native SvelteKit, Astro, or Nuxt scaffolds.

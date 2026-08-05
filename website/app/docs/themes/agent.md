<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:4bb6c5241a575cbf
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:75c3aeaa240cd419
generatedAt=2026-08-04T11:33:15.461Z
-->
# Themes
URL: /docs/themes
Description: Built-in themes and how to create your own
Related: /docs/themes/creating-themes, /docs/configuration, /docs/customization/colors, /docs/customization/typography

Select factory and package subpath as a pair—e.g., `pixelBorder` from `@farming-labs/theme/pixel-border` with `theme: pixelBorder()`—then import `@farming-labs/theme/pixel-border/css` globally. Use `createTheme()` for custom factories and `extendTheme()` to derive from a preset. If visuals don't change, fix the CSS entrypoint; if the factory can't be resolved, copy its exact export and import path from the table below.

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
| [Pixel Border](/docs/themes/pixel-border) | `@farming-labs/theme/pixel-border` | Inspired by better-auth.com |
| [Shiny](/docs/themes/shiny) | `@farming-labs/theme/shiny` | Clerk-inspired, purple accents |
| [Threadline](/docs/themes/threadline) | `@farming-labs/theme/threadline` | Compact neutral shell for chat and agent docs |
| [DarkBold](/docs/themes/darkbold) | `@farming-labs/theme/darkbold` | Pure monochrome, Geist typography |
| [GreenTree](/docs/themes/greentree) | `@farming-labs/theme/greentree` | Mintlify-inspired, emerald green accent |
| [Concrete](/docs/themes/concrete) | `@farming-labs/theme/concrete` | Gray architectural surfaces |

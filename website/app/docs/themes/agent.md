<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:435214e238ba8714
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:d56b7fd0ce59bc24
generatedAt=2026-07-30T09:43:36.702Z
-->
# Themes

## Themes task

Task: Select and apply a built-in or custom theme to a Farming Labs docs site.

Expected result: docs.config and the global stylesheet reference the same theme and docs pages render its visual defaults.

Exact implementation:

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
## Themes prerequisites

- The docs app and its framework-specific global stylesheet already work.
- Choose a built-in preset before creating a custom theme unless requirements demand custom tokens.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs, @farming-labs/theme.

## Themes verification

- Build and open a docs page containing navigation, code, callouts, and tables. Expected: The production build succeeds and all elements use the selected theme without an unstyled flash.
- Failure: The selected theme has no visual effect.
- Recovery: Import the matching theme CSS in the global stylesheet and restart the framework dev server.
- Rollback: Restore the previous theme factory and matching CSS import.

## Themes agent guidance

Select the factory and package subpath as a pair—for example, `pixelBorder` from `@farming-labs/theme/pixel-border` with `theme: pixelBorder()`—then import the matching `@farming-labs/theme/pixel-border/css` globally.
Test navigation, code blocks, callouts, and tables after switching presets. Use `createTheme()` for a reusable custom factory and `extendTheme()` to derive a theme from an existing preset.
If config builds but visuals do not change, repair the CSS entrypoint; if the factory cannot be resolved, copy its exact export and import path from the built-in themes table.

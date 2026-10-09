<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:f1365c2a841b8ec8
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:d393b97012c677ea
generatedAt=2026-10-09T21:46:59.943Z
-->
# Themes
URL: /docs/themes
Description: Built-in themes and how to create your own
Related: /docs/themes/creating-themes, /docs/configuration, /docs/customization/colors, /docs/customization/typography

Select a factory and its package subpath as a pair, then import the matching shared CSS globally. Use `createTheme()` for a custom theme and `extendTheme()` to derive from a preset. All-framework presets include Junction, whose factory is `junction` from `@farming-labs/theme/junction` and whose CSS is `@farming-labs/theme/junction/css`. Junction uses dashed structural rails, compact technical typography, square geometry, and a restrained blue signal color. React-only presets are DarkBold, Shiny, and Threadline; do not offer them in native SvelteKit, Astro, or Nuxt scaffolds.

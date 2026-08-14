<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:c8e8eed91a75f7a3
settingsHash=fnv1a64:7a85fb928fd52635
outputHash=fnv1a64:e4b62340e869277c
generatedAt=2026-08-14T12:45:39.076Z
-->
# Creating Your Own Theme

## Creating Your Own Theme task

Task: Create, apply, and optionally publish a reusable Farming Labs docs theme.

Expected result: The custom theme loads from docs.config, its CSS is present globally, and a production build renders the intended tokens and components.

Exact implementation:

```ts
import { createTheme } from "@farming-labs/docs";

export const myTheme = createTheme({
  name: "my-theme",
  ui: {
    colors: {
      primary: "#e11d48",
      background: "#09090b",
      muted: "#71717a",
      border: "#27272a",
    },
  },
});
```

```ts
import { extendTheme } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export const myTheme = extendTheme(fumadocs(), {
  name: "my-fumadocs-variant",
  ui: {
    colors: { primary: "#22c55e", background: "#0c0c0c" },
    sidebar: { style: "bordered" },
  },
});
```
## Creating Your Own Theme prerequisites

- Begin with a working docs application and identify the framework-specific global stylesheet.
- Decide whether to create a new theme, extend one preset, or override only a few theme values.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs, @farming-labs/theme.

## Creating Your Own Theme verification

- Run the project production build and inspect representative navigation, code, callout, table, and search components. Expected: The build succeeds with no missing CSS import and every component uses the intended theme tokens.
- Failure: The theme configuration loads but pages look unstyled.
- Recovery: Import the theme's CSS from the framework global stylesheet and ensure its path matches the selected theme package.
- Rollback: Restore the previous theme factory and CSS import, then unpublish or deprecate an incorrect package version according to registry policy.

## Creating Your Own Theme agent guidance

Build reusable presets with `createTheme` from `@farming-labs/docs`, give each one a unique `name`, and call its factory as `theme: myTheme()` inside `defineDocs()`. In contrast, pass the `DocsTheme` instance from `extendTheme()` as `theme: myTheme` without calling it.
Validate the production build plus navigation, search, code, callouts, and tables. Config-only themes need no custom CSS; when a package ships custom CSS, export it as `./css` and import it from the consumer's global stylesheet.
For an unstyled config-only theme, verify that the intended factory or extended instance reaches `defineDocs()`. For a package that only fails for consumers, verify `.` and, when present, `./css` in `package.json` exports against the packed artifact.

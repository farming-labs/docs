# @farming-labs/theme

The React UI layer and shared theme preset package for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It provides the docs shell, root providers, MDX components, search and AI interfaces, theme
factories, and the CSS used across every Farming Labs framework integration.

## Where it fits

- **Next.js and TanStack Start:** supplies the React layout, providers, components, and CSS
- **SvelteKit, Astro, and Nuxt:** supplies shared preset CSS while the matching `*-theme` package
  supplies framework-native UI components
- **`@farming-labs/docs`:** supplies the shared configuration, content features, and CLI

## Install

For Next.js:

```bash
npm install @farming-labs/docs @farming-labs/next @farming-labs/theme
```

For TanStack Start:

```bash
npm install @farming-labs/docs @farming-labs/tanstack-start @farming-labs/theme
```

The setup CLI installs the correct package set automatically:

```bash
npx @farming-labs/docs@latest init
```

## Choose a theme

Use a theme factory in `docs.config.ts`:

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
});
```

Then import its CSS. The default `fumadocs()` preset uses the `default/css` entrypoint:

```css
@import "tailwindcss";
@import "@farming-labs/theme/default/css";
```

Other presets use matching factory and CSS subpaths:

```ts
import { hardline } from "@farming-labs/theme/hardline";
```

```css
@import "@farming-labs/theme/hardline/css";
```

Available preset subpaths include `default`, `darksharp`, `pixel-border`, `colorful`, `shiny`,
`darkbold`, `greentree`, `hardline`, `concrete`, `command-grid`, `ledger`, and `threadline`.

## Main entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `@farming-labs/theme` | Default theme, `RootProvider`, layout helpers, and React UI |
| `@farming-labs/theme/<preset>` | Theme factory for a preset |
| `@farming-labs/theme/<preset>/css` | Complete CSS for a preset |
| `@farming-labs/theme/mdx` | Farming Labs MDX component map |
| `@farming-labs/theme/search` | Legacy `createDocsSearchAPI()` compatibility helper |
| `@farming-labs/theme/ai` | AI search and chat UI |
| `@farming-labs/theme/tanstack` | TanStack Start provider and layout integration |

## Runtime requirements

The package currently declares Next.js 16+, React 19.2+, and React DOM 19.2+ as peers because its
root entrypoints provide the React and Next.js UI. SvelteKit, Astro, and Nuxt integrations consume
the shared CSS subpaths while rendering UI through their framework-native theme packages.

## Learn more

- [Themes](https://docs.farming-labs.dev/docs/themes)
- [Creating themes](https://docs.farming-labs.dev/docs/themes/creating-themes)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

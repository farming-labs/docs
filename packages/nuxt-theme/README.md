# @farming-labs/nuxt-theme

The Vue and Nuxt UI layer and theme preset package for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It renders the docs shell, page content, table of contents, breadcrumbs, search, AI chat, API
reference switcher, and theme controls. Content loading and Nitro handlers live in
`@farming-labs/nuxt`.

## Install

```bash
npm install @farming-labs/docs @farming-labs/nuxt @farming-labs/nuxt-theme @farming-labs/theme
```

The CLI can scaffold the complete Nuxt integration:

```bash
npx @farming-labs/docs@latest init
```

## Configure the theme

```ts
// docs.config.ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/nuxt-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  nav: { title: "Docs", url: "/docs" },
});
```

Add the matching shared CSS in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  css: ["@farming-labs/theme/default/css"],
});
```

## Render the docs UI

```vue
<script setup lang="ts">
import { DocsContent, DocsLayout } from "@farming-labs/nuxt-theme";
import config from "~/docs.config";

const { data } = await useFetch("/api/docs", {
  query: { pathname: useRoute().path },
});
</script>

<template>
  <DocsLayout :tree="data.tree" :config="config">
    <DocsContent :data="data" :config="config" />
  </DocsLayout>
</template>
```

## Main exports

- `DocsLayout`, `DocsContent`, and `DocsPage`
- `TableOfContents`, `Breadcrumb`, and `ThemeToggle`
- `SearchDialog`, `FloatingAIChat`, and `ApiReferenceSwitcher`
- Theme preset factories

Preset subpaths are `fumadocs`, `pixel-border`, `darksharp`, `colorful`, `greentree`, `hardline`,
`concrete`, `command-grid`, and `ledger`. The `fumadocs` preset uses
`@farming-labs/theme/default/css`; the other presets use the matching
`@farming-labs/theme/<preset>/css` entrypoint.

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [Themes](https://docs.farming-labs.dev/docs/themes)
- [Nuxt example](https://github.com/farming-labs/docs/tree/main/examples/nuxt)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

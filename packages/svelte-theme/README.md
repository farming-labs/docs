# @farming-labs/svelte-theme

The Svelte 5 UI layer and theme preset package for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs) on SvelteKit.

It renders the docs shell, page content, sidebar, table of contents, search, AI dialogs, page
actions, and theme controls. Content loading and route handlers live in `@farming-labs/svelte`.

## Install

```bash
npm install @farming-labs/docs @farming-labs/svelte @farming-labs/svelte-theme @farming-labs/theme
```

The CLI can scaffold the complete SvelteKit integration:

```bash
npx @farming-labs/docs@latest init
```

## Configure the theme

```ts
// src/lib/docs.config.ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/svelte-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  nav: { title: "Docs", url: "/docs" },
});
```

Import the matching shared CSS in `src/app.css`:

```css
@import "@farming-labs/theme/default/css";
```

## Render the docs UI

```svelte
<script>
  import { DocsLayout } from "@farming-labs/svelte-theme";
  import config from "$lib/docs.config";

  let { data, children } = $props();
</script>

<DocsLayout tree={data.tree} {config}>
  {@render children()}
</DocsLayout>
```

Use `DocsContent` from the same package in the page component. The `data` passed to these
components comes from `@farming-labs/svelte/server`.

## Main exports

- `DocsLayout`, `DocsContent`, `DocsSidebar`, and `DocsPage`
- `TableOfContents`, `Breadcrumb`, `MobileNav`, and `ThemeToggle`
- `SearchDialog`, `AskAIDialog`, and `FloatingAIChat`
- `Callout` and theme preset factories

Preset subpaths are `fumadocs`, `pixel-border`, `darksharp`, `colorful`, `greentree`, `hardline`,
`concrete`, `command-grid`, and `ledger`. The `fumadocs` preset uses
`@farming-labs/theme/default/css`; the other presets use the matching
`@farming-labs/theme/<preset>/css` entrypoint.

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [Themes](https://docs.farming-labs.dev/docs/themes)
- [SvelteKit example](https://github.com/farming-labs/docs/tree/main/examples/sveltekit)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

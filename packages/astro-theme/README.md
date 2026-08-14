# @farming-labs/astro-theme

The Astro-native UI layer and theme preset package for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It renders the docs shell, page content, search dialog, AI chat, and theme controls. Content
loading and route handlers live in `@farming-labs/astro`.

## Install

```bash
npm install @farming-labs/docs @farming-labs/astro @farming-labs/astro-theme @farming-labs/theme
```

The CLI can scaffold the complete Astro integration:

```bash
npx @farming-labs/docs@latest init
```

## Configure the theme

```ts
// src/lib/docs.config.ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/astro-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  nav: { title: "Docs", url: "/docs" },
});
```

## Render the docs UI

Astro components are exported from component subpaths:

```astro
---
import DocsLayout from "@farming-labs/astro-theme/src/components/DocsLayout.astro";
import DocsContent from "@farming-labs/astro-theme/src/components/DocsContent.astro";
import SearchDialog from "@farming-labs/astro-theme/src/components/SearchDialog.astro";
import "@farming-labs/theme/default/css";

import config from "../../lib/docs.config";
import { load } from "../../lib/docs.server";

const data = await load(Astro.url.pathname);
---

<DocsLayout tree={data.tree} config={config}>
  <DocsContent data={data} config={config} />
</DocsLayout>
<SearchDialog config={config} />
```

The server-side `load()` function comes from `@farming-labs/astro/server`.

## Themes and components

The package ships `DocsLayout`, `DocsContent`, `DocsPage`, `SearchDialog`, `FloatingAIChat`, and
`ThemeToggle` Astro components.

Preset subpaths are `fumadocs`, `pixel-border`, `darksharp`, `colorful`, `greentree`, `hardline`,
`concrete`, `command-grid`, and `ledger`. The `fumadocs` preset uses
`@farming-labs/theme/default/css`; the other presets use the matching
`@farming-labs/theme/<preset>/css` entrypoint.

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [Themes](https://docs.farming-labs.dev/docs/themes)
- [Astro example](https://github.com/farming-labs/docs/tree/main/examples/astro)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

# @farming-labs/farmjs

The official Farm.js runtime adapter for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

## Install

```bash
npm install @farming-labs/docs @farming-labs/farmjs @farming-labs/theme
```

## Configure Farm

Keep documentation settings in `docs.config.ts`, then enable the adapter from
`farm.config.ts`:

```ts
import { defineConfig } from "@farm.js/core";
import { withDocs } from "@farming-labs/farmjs/config";

export default withDocs(
  defineConfig({
    preset: "vercel",
  }),
);
```

Farm discovers `docs.config.ts` from the application root. The wrapper writes
an adapter runtime descriptor into Farm's `docs` configuration. Farm uses that
versioned contract to load page rendering, server behavior, and MDX integration
from `@farming-labs/farmjs` without selecting a docs theme itself. A different path can
be provided explicitly:

```ts
export default withDocs(defineConfig({}), {
  configPath: "config/docs.config.ts",
});
```

Code highlighting is compiled by the adapter's MDX pipeline. Pick a specific
Shiki palette at that boundary without replacing the rest of the adapter:

```ts
export default withDocs(defineConfig({}), {
  codeBlockThemes: {
    light: "github-light-default",
    dark: "vesper",
  },
});
```

Import the selected theme from the application-owned global stylesheet. This
also gives the application a normal place for project-specific overrides:

```css
/* src/app/globals.css */
@import "@farming-labs/theme/pixel-border/css";

:root {
  --color-fd-primary: #8b5cf6;
}
```

The theme factory in `docs.config.ts` and the CSS entrypoint must describe the
same theme. This is the same unified CSS entrypoint used by the Next.js,
TanStack Start, SvelteKit, Astro, and Nuxt integrations. The adapter does not
ship or inject a second Farm-specific theme stylesheet.

## Server wrapper

`withDocs()` is the normal integration. The lower-level server wrapper is
available for custom runtimes, route testing, and framework development:

```ts
import docsConfig from "./docs.config";
import { createDocsServer } from "@farming-labs/farmjs/server";

const docs = createDocsServer({
  ...docsConfig,
  rootDir: process.cwd(),
});

const response = await docs.handle(request);
```

`handle()` returns `null` for non-docs requests so it can run in Farm's request
pipeline without taking over application routes. The server also exposes
`load`, `GET`, `POST`, and `MCP` for custom routing.

## Entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `@farming-labs/farmjs/config` | Farm config wrapper |
| `@farming-labs/farmjs/server` | Page loader and API, agent, and MCP request handlers |
| `@farming-labs/farmjs/react` | React documentation page renderer |
| `@farming-labs/farmjs/content` | Content and navigation utilities |
| `@farming-labs/farmjs/vite` | MDX compilation plugin |
| `@farming-labs/farmjs/runtime` | Versioned Farm runtime contract |
| `@farming-labs/farmjs/api-reference` | Farm API-reference handler |

## License

MIT

# @farming-labs/astro

The Astro runtime adapter for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It loads Markdown and MDX content, builds navigation, renders page content on the server, and
provides Astro handlers for docs, search, AI, agent discovery, MCP, and API references.

## Package responsibilities

- `@farming-labs/docs` — shared config, types, content features, and CLI
- `@farming-labs/astro` — Astro content loading and server handlers
- `@farming-labs/astro-theme` — Astro layout and UI components
- `@farming-labs/theme` — shared preset CSS

## Install

The CLI can wire the complete Astro integration:

```bash
npx @farming-labs/docs@latest init
```

For manual installation:

```bash
npm install @farming-labs/docs @farming-labs/astro @farming-labs/astro-theme @farming-labs/theme
```

Dynamic docs routes also require an Astro server adapter such as `@astrojs/vercel`,
`@astrojs/netlify`, `@astrojs/node`, or `@astrojs/cloudflare`.

## Server integration

Preload content with Vite and create the docs server:

```ts
// src/lib/docs.server.ts
import { createDocsServer } from "@farming-labs/astro/server";
import config from "./docs.config";

const contentFiles = import.meta.glob("/docs/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, HEAD, POST, MCP } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});
```

Call `load(Astro.url.pathname)` from the docs page and render the result with components from
`@farming-labs/astro-theme`. The CLI generates the pages, API routes, public forwarding, theme
CSS import, and Astro adapter configuration.

## Main entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `@farming-labs/astro/server` | Docs server, loaders, API/MCP handlers, and API-reference helper |
| `@farming-labs/astro/content` | Content discovery and navigation utilities |
| `@farming-labs/astro/markdown` | Server-side Markdown rendering |
| `@farming-labs/astro/api-reference` | API-reference route handler |

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [Astro example](https://github.com/farming-labs/docs/tree/main/examples/astro)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

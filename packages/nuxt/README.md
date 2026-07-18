# @farming-labs/nuxt

The Nuxt and Nitro runtime adapter for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It loads Markdown and MDX content from Nitro storage, builds navigation, renders page content on
the server, and provides H3 handlers for docs, search, AI, agent discovery, MCP, and API references.

## Package responsibilities

- `@farming-labs/docs` — shared config, types, content features, and CLI
- `@farming-labs/nuxt` — Nitro content loading and server handlers
- `@farming-labs/nuxt-theme` — Vue layout and UI components
- `@farming-labs/theme` — shared preset CSS

## Install

The CLI can wire the complete Nuxt integration:

```bash
npx @farming-labs/docs@latest init
```

For manual installation:

```bash
npm install @farming-labs/docs @farming-labs/nuxt @farming-labs/nuxt-theme @farming-labs/theme
```

## Server integration

Create the main Nitro API handler:

```ts
// server/api/docs.ts
import { defineDocsHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsHandler(config, useStorage);
```

The generated setup also adds public-route middleware with `defineDocsPublicHandler()` and makes
the docs directory available through Nitro storage:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  css: ["@farming-labs/theme/default/css"],
  nitro: {
    moduleSideEffects: ["@farming-labs/nuxt/server"],
    serverAssets: [{ baseName: "docs", dir: "docs" }],
  },
});
```

Render the returned page data with `DocsLayout` and `DocsContent` from
`@farming-labs/nuxt-theme`.

## Main entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `@farming-labs/nuxt/server` | Nitro handlers, docs server, public forwarding, and MCP |
| `@farming-labs/nuxt/content` | Content discovery and navigation utilities |
| `@farming-labs/nuxt/markdown` | Server-side Markdown rendering |
| `@farming-labs/nuxt/api-reference` | API-reference route handler |

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [Nuxt example](https://github.com/farming-labs/docs/tree/main/examples/nuxt)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

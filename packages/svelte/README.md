# @farming-labs/svelte

The SvelteKit runtime adapter for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It loads Markdown, MDX, and SVX content, builds navigation, renders page content on the server, and
provides SvelteKit handlers for docs, search, AI, agent discovery, MCP, and API references.

## Package responsibilities

- `@farming-labs/docs` — shared config, types, content features, and CLI
- `@farming-labs/svelte` — SvelteKit content loading and server handlers
- `@farming-labs/svelte-theme` — Svelte layout and UI components
- `@farming-labs/theme` — shared preset CSS

## Install

The CLI can wire the complete SvelteKit integration:

```bash
npx @farming-labs/docs@latest init
```

For manual installation:

```bash
npm install @farming-labs/docs @farming-labs/svelte @farming-labs/svelte-theme @farming-labs/theme
```

## Server integration

Preload content with Vite and create the docs server:

```ts
// src/lib/docs.server.ts
import { createDocsServer } from "@farming-labs/svelte/server";
import config from "./docs.config";

const contentFiles = import.meta.glob("/docs/**/*.{md,mdx,svx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, POST, MCP } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});
```

Re-export `load` from the docs `+layout.server.ts` and `GET`/`POST` from the docs API route. Use
`DocsLayout` and `DocsContent` from `@farming-labs/svelte-theme` for presentation. The CLI
generates all of these files, including public agent and MCP forwarding.

## Main entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `@farming-labs/svelte/server` | Docs server, loaders, API/MCP handlers, and API-reference helper |
| `@farming-labs/svelte/content` | Content discovery and navigation utilities |
| `@farming-labs/svelte/markdown` | Server-side Markdown rendering |
| `@farming-labs/svelte/config` | Optional mdsvex configuration helper |
| `@farming-labs/svelte/api-reference` | API-reference route handler |

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [SvelteKit example](https://github.com/farming-labs/docs/tree/main/examples/sveltekit)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

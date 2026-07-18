# @farming-labs/tanstack-start

The TanStack Start adapter for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It compiles Markdown and MDX with Vite, loads documentation content on the server, builds
navigation and page metadata, exposes docs and MCP handlers, and renders pages with the Farming
Labs React theme.

## What this package does

- Adds the Farming Labs MDX pipeline to Vite
- Loads filesystem content and builds navigation trees on the server
- Provides handlers for pages, search, AI, agent discovery, MCP, and API references
- Supplies the `TanstackDocsPage` React renderer for TanStack Router routes

The shared config and CLI live in `@farming-labs/docs`. Providers, React UI, MDX components, and
theme CSS live in `@farming-labs/theme`.

## Install

The CLI can scaffold the full integration:

```bash
npx @farming-labs/docs@latest init
```

For manual installation:

```bash
npm install @farming-labs/docs @farming-labs/tanstack-start @farming-labs/theme
```

## Minimal setup

Add the docs MDX plugin before the TanStack Start plugin:

```ts
// vite.config.ts
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { docsMdx } from "@farming-labs/tanstack-start/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [docsMdx(), tanstackStart()],
});
```

Create the server integration:

```ts
// src/lib/docs.server.ts
import { createDocsServer } from "@farming-labs/tanstack-start/server";
import docsConfig from "../../docs.config";

export const docsServer = createDocsServer({
  ...docsConfig,
  rootDir: process.cwd(),
});
```

Render loaded page data with the React adapter:

```tsx
import { TanstackDocsPage } from "@farming-labs/tanstack-start/react";

<TanstackDocsPage config={docsConfig} data={loaderData} />;
```

A complete integration also needs docs and API routes, `RootProvider` from
`@farming-labs/theme/tanstack`, and the selected theme CSS. The CLI creates those files.

## Main entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `@farming-labs/tanstack-start/vite` | Vite MDX compilation plugin |
| `@farming-labs/tanstack-start/server` | Content loading and docs API/MCP handlers |
| `@farming-labs/tanstack-start/react` | `TanstackDocsPage` renderer |
| `@farming-labs/tanstack-start/content` | Lower-level content and navigation utilities |
| `@farming-labs/tanstack-start/api-reference` | API-reference route handler |

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [TanStack Start example](https://github.com/farming-labs/docs/tree/main/examples/tanstack-start)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

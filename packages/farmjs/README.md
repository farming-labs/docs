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
import { defineConfig } from "@farmjs/core";
import { withDocs } from "@farming-labs/farmjs/config";

export default withDocs(
  defineConfig({
    preset: "vercel",
  }),
);
```

Farm discovers `docs.config.ts` from the application root. A different path can
be provided explicitly:

```ts
export default withDocs(defineConfig({}), {
  configPath: "config/docs.config.ts",
});
```

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
| `@farming-labs/farmjs/api-reference` | Farm API-reference handler |

## License

MIT

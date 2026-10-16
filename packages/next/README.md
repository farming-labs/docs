# @farming-labs/next

The Next.js App Router adapter for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

It connects the shared docs configuration and theme to Next.js, compiles Markdown and MDX,
generates the standard docs routes, and provides Next-native runtime helpers for documentation
APIs, API references, MCP, and changelogs.

## What this package does

- Wraps `next.config.ts` with the Farming Labs MDX and routing integration
- Generates missing docs layouts, API routes, MCP routes, and enabled feature routes
- Adds machine-readable Markdown, agent discovery, sitemap, and `llms.txt` rewrites
- Provides App Router layout, metadata, API-reference, and changelog helpers
- Preserves user-authored files and existing Next.js configuration

The shared config and CLI live in `@farming-labs/docs`. React UI, MDX components, providers, and
theme CSS live in `@farming-labs/theme`.

## Install

The CLI can add docs to an existing Next.js project:

```bash
npx @farming-labs/docs@latest init
```

For manual installation:

```bash
npm install @farming-labs/docs @farming-labs/next @farming-labs/theme
```

## Minimal setup

Create `docs.config.ts` with `defineDocs()`, then wrap the Next.js config:

```ts
// next.config.ts
import { withDocs } from "@farming-labs/next/config";

export default withDocs();
```

Existing Next.js configuration can be passed directly:

```ts
export default withDocs({
  reactStrictMode: true,
});
```

Import the selected theme in your global stylesheet:

```css
@import "tailwindcss";
@import "@farming-labs/theme/default/css";
```

Write documentation pages under `app/docs/` or `src/app/docs/`. The CLI also adds the root
`RootProvider`, generated docs layout, and server routes needed for a complete setup.

## Extending MDX compilation

Pass adapter options as the third `withDocs` argument. Plugin module names (or absolute paths)
and JSON options work with both Webpack and Turbopack:

```ts
import { withDocs } from "@farming-labs/next/config";
import docsConfig from "./docs.config";

export default withDocs({}, docsConfig, {
  mdx: {
    remarkPlugins: ["remark-directive"],
    rehypePlugins: [["rehype-external-links", { target: "_blank" }]],
  },
});
```

Install the plugins in your application. Extra plugins run after the built-in plugins in their
respective phase; frontmatter, heading IDs, TOC, Markdown alternate links, and syntax highlighting
remain enabled. Put callbacks and other non-JSON configuration inside a local plugin module and
pass its absolute path, for example `import.meta.resolve("./plugins/highlight.mjs")` converted
with `fileURLToPath` from `node:url`.

For a migration with its own highlighter, set `mdx.codeHighlighter` to that plugin's module name
or `[module, options]` tuple. This replaces only the default code-highlighting step, so code is
highlighted once. The custom plugin owns its theme and code-block behavior. Omitting `mdx` keeps
the existing defaults. Use `undefined` as the second argument if you are not passing a live docs
config. These hooks do not configure Fumadocs collections or replace its source loader.

## Main entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `@farming-labs/next/config` | `withDocs()` Next.js configuration wrapper |
| `@farming-labs/next/layout` | App Router docs layout and metadata helpers |
| `@farming-labs/next/api` | Docs API and MCP route handlers |
| `@farming-labs/next/api-reference` | Generated API-reference routes and pages |
| `@farming-labs/next/changelog` | Generated changelog page helpers |

## Requirements

- Next.js 16 or newer
- React and React DOM 19.2 or newer
- `@farming-labs/docs` and `@farming-labs/theme`

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [Next.js example](https://github.com/farming-labs/docs/tree/main/examples/next)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

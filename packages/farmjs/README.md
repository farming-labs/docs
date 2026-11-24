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

Add the application's own MDX plugins in `mdx` in `docs.config.ts`. Each plugin is a
package name or a path relative to the application root, with optional JSON options:

```ts title="docs.config.ts"
export default defineDocs({
  entry: "docs",
  mdx: {
    remarkPlugins: ["./lib/remark-docs.mjs"],
    rehypePlugins: [["rehype-katex", { strict: false }]],
    codeHighlighter: "./lib/rehype-docs-code.mjs",
  },
});
```

- `remarkPlugins` and `rehypePlugins` run after the built-in plugins.
- `codeHighlighter` replaces only the syntax highlighter; metadata and the table
  of contents stay enabled.
- Node and edge targets compile pages with them.
- Production builds compile every page while `mdx` is set, and
  `buildCache: true` alongside it throws.
- `withDocs(config, { config: { mdx } })` replaces the file's `mdx`.

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

## Repeated production builds

The adapter reuses unchanged Markdown/MDX compilation and syntax highlighting
in production builds. It stores the compiled code and source maps under
`<Vite cacheDir>/farming-docs/mdx-v1.json`; Vite normally places `cacheDir` in
`node_modules/.vite`. Preserve that directory in your CI build cache to reuse
work across jobs. Deleting it only causes compilation to run again.

Cache entries are keyed by source, module path, mode, highlighting themes,
Node version, and a content fingerprint of the compiler implementation and
its dependencies. Vite still discovers and builds imports, components, CSS,
routes, and deployment output normally. Development and watch builds do not
use this cache. Missing, corrupt, incompatible, or unwritable cache files
fall back to compilation; compiler errors still fail the build.

The cache retains at most 1,024 modules and approximately 32 MiB of payload.
It does not cache rendered HTML or change client navigation or prerendering.
To diagnose a build without MDX cache reuse:

```ts
export default withDocs(defineConfig({}), { buildCache: false });
```

The lower-level `docsMdx({ buildCache: false })` option has the same behavior.

## Prerendered pages

Set `docs.prerender: true` in `farm.config.ts` to have `farm build` render every
docs page into a static file on Node and serverless targets:

```ts
export default withDocs(defineConfig({ docs: { prerender: true } }));
```

Farm asks the adapter's server entry for its page list (`listFarmDocsPages`).
Prerendered pages link their Markdown copy relative to the page, or under the
configured `sitemap`, `llmsTxt`, or `robots` `baseUrl`, so social cards need
that base URL to stay absolute. Client navigation reads a static page's data
from its HTML. A static file cannot negotiate `Accept: text/markdown`, so agents
use the `.md` URL the page links to. Markdown, search, `llms.txt`, and MCP keep
rendering on request.

## Guarded pages

Guard a docs page as you guard app pages: a `middleware.ts` in its folder, a
config middleware matcher, or an auth integration's protected routes. The
adapter declares the `guarded-pages` capability, so Farm serves such pages
with it and passes the app's guards to the runtime. A page a guard covers then
stays out of search, `llms.txt`, `llms-full.txt`, the sitemap, MCP, Ask AI, and
the content feed, which answer without running the guard. Its Markdown answers
at its own URL (`Accept: text/markdown`) and at a `.md` URL only when the guard
covers that URL too. Edge targets serve a snapshot that runs no guard, so Farm
stops an edge build that has guarded docs pages.

## Edge deployments

Farm edge targets use the adapter's build-time compiler automatically. It
precompiles pages, client-navigation data, CSS, Markdown, search, sitemap,
robots, and agent-discovery responses so the deployed Worker does not import
the Node server runtime.

The snapshot cannot preserve features that need live server callbacks or
mutable sessions. Disable the default MCP and production telemetry surfaces in
an edge-specific docs configuration:

```ts
import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
  mcp: false,
  telemetry: false,
});
```

An edge build also stops with an actionable error when Ask AI, feedback,
analytics, observability, i18n, or a function-backed custom search provider is
enabled. Use a Node target when those runtime features are required.

## Custom renderers

The adapter is a docs engine plus a UI. The engine is renderer-neutral: content,
navigation, search, Markdown, `llms.txt`, MCP, and the HTML document around each
page. The UI renders a page's body and hydrates it.

On React, `withDocs()` uses the React UI. On any other Farm renderer, a custom
one included, it uses `@farming-labs/farmjs/universal`, which builds the page
with the app's renderer:

```ts
import { defineConfig } from "@farm.js/core";
import { withDocs } from "@farming-labs/farmjs/config";
import { leaf } from "farm-leaf";

export default withDocs(defineConfig({ renderer: leaf() }));
```

The universal UI keeps the React UI's layout and stylesheet. It builds each page
from host elements with the `renderer` Farm passes it: `createElement()` and
`renderToString()` on the server, `createElement()` and `hydrateRoot()` in the
browser. Plain DOM listeners run folders, the theme toggle, the mobile sidebar,
and copy buttons. The Markdown compiles to HTML on the server, so no React
reaches the browser.

A renderer checks that it writes and hydrates these pages as the UI expects with
`@farming-labs/farmjs/testing`, from a Vitest file with a DOM environment:

```ts
// @vitest-environment jsdom
import { defineFarmDocsRendererConformance } from "@farming-labs/farmjs/testing";
import * as client from "../src/client.js";
import * as server from "../src/server.js";

defineFarmDocsRendererConformance({ name: "leaf", server, client });
```

A renderer that writes attributes for its own hydration lists them in
`hydrationAttributes`, such as `["data-hk"]` for Solid.

A UI written for one renderer replaces it through `ui`:

```ts
export default withDocs(defineConfig({ renderer: leaf() }), {
  ui: { module: "@acme/leaf-docs", renderer: "leaf" },
});
```

The UI module exports two functions, typed by `FarmDocsUIModule`:

```ts
import type { FarmDocsUIModule } from "@farming-labs/farmjs";
import { createElement } from "leaf";
import { hydrateRoot } from "leaf/dom";
import { renderToString } from "leaf/server";
import { DocsPage } from "./docs-page";

// On the server: the page body's HTML, which the engine puts in #farm-docs-root.
export const renderFarmDocsPage: FarmDocsUIModule["renderFarmDocsPage"] = ({ config, data }) =>
  renderToString(createElement(DocsPage, { config, data }));

// In the browser: Farm calls it on a page the docs server rendered.
export const hydrateFarmDocs: FarmDocsUIModule["hydrateFarmDocs"] = ({ config, data }) =>
  hydrateRoot(document.getElementById("farm-docs-root")!, createElement(DocsPage, { config, data }));
```

`data` is the page the engine loaded: its navigation `tree`, `title`,
`description`, `rawContent` (the page's Markdown), and the previous and next
pages. `createFarmDocsNavigator()` from `@farming-labs/farmjs/navigation` moves
between docs pages without a reload: it fetches the next page's `data` from the
engine and hands it to your UI.

Limits:

- It needs a Farm release that reads `ui` from the descriptor and passes
  `renderer` to it, the first after 0.1.81. Farm stops when `ui.renderer` is not
  the app's renderer.
- The universal UI has no search box, table of contents, or client navigation
  between docs pages, and theme components such as tabs render as static HTML.
- `ui.module` is a package name or an absolute path, since Farm imports it from
  entries it generates.
- The MDX components this package compiles are React's. The universal UI writes
  them to HTML on the server; a UI of your own renders `rawContent` itself.
- `shell` and edge targets render the React UI. `withDocs()` refuses `shell`
  with another UI, and Farm stops an edge build.
- `react`, `react-dom`, and `@farming-labs/theme` stay peer dependencies, so a
  package manager warns when they are missing. The server loads React to render
  the React UI and the universal UI's Markdown.

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
| `@farming-labs/farmjs/universal` | Documentation pages built with the app's renderer |
| `@farming-labs/farmjs/testing` | Docs conformance suite for a Farm renderer |
| `@farming-labs/farmjs/navigation` | Client navigation between docs pages, for any UI |
| `@farming-labs/farmjs/content` | Content and navigation utilities |
| `@farming-labs/farmjs/vite` | MDX compilation plugin |
| `@farming-labs/farmjs/runtime` | Versioned Farm runtime contract |
| `@farming-labs/farmjs/edge-compiler` | Build-time edge snapshot compiler used by Farm |
| `@farming-labs/farmjs/api-reference` | Farm API-reference handler |

## License

MIT

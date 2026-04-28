---
name: configuration
description: docs.config.ts options for @farming-labs/docs. Use when configuring entry, contentDir, theme, staticExport, nav, github, themeToggle, breadcrumb, sidebar, icons, components, search, changelog, feedback, readingTime, agent.compact, metadata, og, apiReference, MCP, onCopyClick, pageActions, or ai. Covers Next.js, TanStack Start, SvelteKit, Astro, Nuxt config file location.
---

# @farming-labs/docs — Configuration

All configuration lives in a single **docs.config.ts** (or **docs.config.tsx**) file. Use this skill when editing or explaining config options.

**Full docs:** [Configuration](https://docs.farming-labs.dev/docs/configuration), [API Reference](https://docs.farming-labs.dev/docs/reference).

---

## Config file location by framework

| Framework | Config path |
| --------- | ----------- |
| Next.js | Project root: `docs.config.ts` |
| TanStack Start | Project root: `docs.config.ts` or `docs.config.tsx` |
| SvelteKit | `src/lib/docs.config.ts` |
| Astro | `src/lib/docs.config.ts` |
| Nuxt | Project root: `docs.config.ts` |

TanStack Start, SvelteKit, Astro, and Nuxt require `contentDir` (path to markdown files) and `nav` (sidebar title and base URL) in addition to `entry` and `theme`.

---

## Main config options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `entry` | `string` | `"docs"` | URL path prefix for docs (e.g. `"docs"` → `/docs`) |
| `contentDir` | `string` | same as `entry` | Path to content files (TanStack Start, SvelteKit, Astro, Nuxt) |
| `staticExport` | `boolean` | `false` | Set `true` for full static builds; hides search and AI |
| `theme` | `DocsTheme` | — | Theme from a theme factory (e.g. `fumadocs()`, `pixelBorder()`) |
| `nav` | `{ title, url }` | — | Sidebar title and base URL (required for TanStack Start, SvelteKit, Astro, Nuxt) |
| `github` | `string \| GithubConfig` | — | GitHub repo for "Edit on GitHub" and `{githubUrl}` in page actions |
| `themeToggle` | `boolean \| ThemeToggleConfig` | `true` | Light/dark mode toggle |
| `breadcrumb` | `boolean \| BreadcrumbConfig` | `true` | Breadcrumb navigation |
| `sidebar` | `boolean \| SidebarConfig` | `true` | Sidebar visibility and style |
| `icons` | `Record<string, Component>` | — | Icon registry for frontmatter `icon` fields |
| `components` | `Record<string, Component>` | — | Custom MDX components and built-in overrides like `HoverLink` |
| `onCopyClick` | `(data: CodeBlockCopyData) => void` | — | Callback when user copies a code block (title, content, url, language) |
| `feedback` | `boolean \| FeedbackConfig` | `false` | Human page feedback UI plus optional agent feedback endpoints |
| `readingTime` | `boolean \| ReadingTimeConfig` | `false` | Opt-in estimated read-time label with per-page overrides |
| `agent` | `DocsAgentConfig` | — | Defaults for `docs agent compact` |
| `pageActions` | `PageActionsConfig` | — | Copy Markdown, Open in LLM (see `page-actions` skill) |
| `ai` | `AIConfig` | — | RAG-powered AI chat (see `ask-ai` skill) |
| `search` | `boolean \| DocsSearchConfig` | `true` | Built-in simple search, Typesense, Algolia, or a custom adapter |
| `changelog` | `boolean \| ChangelogConfig` | `false` | Generated changelog feed and entry pages from dated MDX entries (Next.js) |
| `mcp` | `boolean \| DocsMcpConfig` | enabled | Built-in MCP server over stdio, `/mcp`, and `/.well-known/mcp` |
| `apiReference` | `boolean \| ApiReferenceConfig` | `false` | Generated API reference pages from supported framework route conventions or a hosted OpenAPI JSON document |
| `metadata` | `DocsMetadata` | — | SEO: titleTemplate, description, etc. |
| `og` | `OGConfig` | — | Dynamic Open Graph images |

---

## Static export

For fully static builds (e.g. Cloudflare Pages, no server):

```ts
export default defineDocs({
  entry: "docs",
  staticExport: true,
  theme: fumadocs(),
});
```

- Search (Cmd+K) and AI chat are hidden in the layout.
- Next.js: with `output: "export"` in `next.config`, the `/api/docs` route is not generated.
- Do not deploy the docs API route when using static export.

---

## Machine-readable markdown routes

No separate `docs.config` flag is required for page-level markdown delivery.

Default behavior:

- the shared docs API supports `GET /api/docs?format=markdown&path=<slug>`
- **Next.js:** `withDocs()` also serves `/docs.md` and `/docs/<slug>.md`
- **TanStack Start:** current `init` scaffolds one `src/routes/$.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **SvelteKit:** current `init` scaffolds one `src/hooks.server.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **Astro:** current `init` scaffolds one `src/middleware.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **Nuxt:** current `init` scaffolds one `server/middleware/docs-public.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **Next.js:** `Accept: text/markdown` on `/docs/<slug>` returns the same markdown response; other adapters should use the `.md` URL or API format route
- embedded `<Agent>...</Agent>` blocks stay hidden in the normal UI and are included in the markdown fallback
- if a page folder has `agent.md`, that file becomes the markdown response for that page
- if `agent.md` is missing, the markdown response falls back to the normal page markdown
- page frontmatter `related` is rendered into a comma-separated machine-readable markdown metadata line beside `Description` for normal page markdown and embedded `<Agent>` fallback
- MCP `read_page("/docs/<slug>")` uses the same page source and sees the same override
- a sibling `agent.md` remains a full override; include any `Related:` line manually inside `agent.md` when needed
- `docs agent compact` can generate those sibling `agent.md` files from the resolved page output

Folder example:

```txt
app/docs/quickstart/
  page.mdx

app/docs/getting-started/quickstart/
  page.mdx

app/docs/getting-started/agent-ready-docs/
  page.mdx
  agent.md
```

Embedded agent-context example:

```mdx
# Quickstart

Human-facing instructions.

<Agent>
You are an implementation agent.
Keep the scaffolded paths and commands aligned with the actual project structure.
</Agent>
```

Related-page frontmatter example:

```mdx
---
title: "Installation"
description: "Install the framework"
related:
  - /docs/configuration
  - /docs/customization/agent-primitive
---
```

Useful checks:

```bash
curl "http://127.0.0.1:3000/api/docs?format=markdown&path=quickstart"
curl "http://127.0.0.1:3000/docs/quickstart.md"
curl "http://127.0.0.1:3000/docs/quickstart" -H "Accept: text/markdown" # Next.js
curl "http://127.0.0.1:3000/docs/getting-started/agent-ready-docs.md"
```

Call out content negotiation when relevant: in Next.js, `/docs/<slug>` remains the normal HTML page
for browsers, but agents/scripts can send `Accept: text/markdown` to the same URL and receive the
machine-readable markdown representation without appending `.md`. In other adapters, use
`/docs/<slug>.md` or the API format route.

---

## Agent compaction

Use `agent.compact` to configure defaults for `docs agent compact`, which writes sibling `agent.md`
files from resolved docs pages.

```ts
agent: {
  compact: {
    apiKeyEnv: "TOKEN_COMPANY_API_KEY",
    model: "bear-1.2",
    aggressiveness: 0.3,
    protectJson: true,
  },
},
```

Supported fields:

- `apiKey`
- `apiKeyEnv`
- `baseUrl`
- `model`
- `aggressiveness`
- `maxOutputTokens`
- `minOutputTokens`
- `protectJson`

Notes:

- `.env` and `.env.local` are loaded before the CLI resolves the key
- `apiKey: process.env.TOKEN_COMPANY_API_KEY` is supported in `docs.config.tsx`
- the command creates missing `agent.md` files and overwrites existing ones
- generated `agent.md` becomes the machine-readable source for `.md` routes,
  `GET /api/docs?format=markdown&path=...`, and MCP `read_page()`
- the human docs UI still renders the normal page
- page frontmatter `agent.tokenBudget` overrides `maxOutputTokens` for that page
- if no sibling `agent.md` exists, the command compacts the generated machine-readable page output
  first and then writes a new `agent.md`
- `docs agent compact --changed` only processes docs pages changed in the current git working
  tree, including staged, unstaged, and untracked docs changes
- if inherited `minOutputTokens` is greater than the page budget, the CLI clamps it down to the
  page budget before calling the compression API

Common commands:

```bash
pnpm exec docs agent compact installation configuration
pnpm exec docs agent compact installation --dry-run
pnpm exec docs agent compact --all
pnpm exec docs agent compact --changed
```

Per-page override example:

```md
---
title: "Installation"
agent:
  tokenBudget: 777
---
```

Use the `cli` skill or `/docs/cli` when the user needs the full command syntax instead of the
config shape.

---

## Reading time

Use `readingTime` when the user wants a small `5 min read` label on docs pages.

```ts
readingTime: {
  enabled: true,
  wordsPerMinute: 220,
},
```

Key points:

- it is **disabled by default**
- code blocks, inline code, links, images, HTML, and URLs are stripped before counting words
- page frontmatter can override it with `readingTime: false`, `readingTime: true`, or `readingTime: 8`
- page frontmatter wins even when the global `readingTime` config is off
- the label follows the page-actions slot: `above-title` keeps it directly under the actions row, and `below-title` keeps it in the below-title metadata area

---

## GitHub (Edit on GitHub and openDocs)

```ts
github: {
  url: "https://github.com/owner/repo",
  directory: "website",  // optional: subdirectory where docs content lives
}
```

Enables "Edit on GitHub" links and allows `{githubUrl}` in `pageActions.openDocs.providers`.

---

## Components and built-ins

`components` is merged into the default MDX component map, so you can both add your own
components and override built-ins such as `Callout`, `Tabs`, or `HoverLink`.

Use `theme.ui.components` when you want to keep a built-in like `HoverLink` but change its default
props globally (for example `linkLabel`, `showIndicator`, or `align`).

---

## Search

Search is enabled by default. If the user does nothing, the framework uses the built-in simple
adapter with section-based chunking.

```ts
search: true,
```

Built-in provider options:

- `simple` — zero-config docs search
- `typesense` — external Typesense backend with optional hybrid mode
- `algolia` — external Algolia backend
- `mcp` — use an MCP `search_docs` tool over Streamable HTTP
- `custom` — user-supplied adapter

Typesense example:

```ts
search: {
  provider: "typesense",
  baseUrl: process.env.TYPESENSE_URL!,
  collection: "docs",
  apiKey: process.env.TYPESENSE_SEARCH_API_KEY!,
  adminApiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  mode: "hybrid",
  embeddings: {
    provider: "ollama",
    model: "embeddinggemma",
  },
},
```

Algolia example:

```ts
search: {
  provider: "algolia",
  appId: process.env.ALGOLIA_APP_ID!,
  indexName: "docs",
  searchApiKey: process.env.ALGOLIA_SEARCH_API_KEY!,
  adminApiKey: process.env.ALGOLIA_ADMIN_API_KEY,
},
```

MCP example:

```ts
search: {
  provider: "mcp",
  endpoint: "/mcp",
},
mcp: {
  enabled: true,
},
```

Custom adapter example:

```ts
import { createCustomSearchAdapter, defineDocs } from "@farming-labs/docs";

search: createCustomSearchAdapter({
  name: "my-search",
  async search(query, context) {
    return context.documents.slice(0, query.limit ?? 10).map((doc) => ({
      id: doc.id,
      url: doc.url,
      content: doc.section ? `${doc.title} — ${doc.section}` : doc.title,
      description: doc.description,
      type: doc.type,
      section: doc.section,
    }));
  },
}),
```

Important notes:

- `chunking.strategy` defaults to `"section"` and can be changed to `"page"`
- Typesense and Algolia can sync the index on first request when `adminApiKey` is present
- `provider: "mcp"` supports relative endpoints like `/mcp` or `/.well-known/mcp` and absolute remote endpoints
- if `provider: "mcp"` points at the same relative MCP route, the built-in `search_docs` tool falls back to simple search internally so the route does not recurse forever
- On custom/manual Next routes, forward `search: docsConfig.search` into `createDocsAPI(...)`
- Use `pnpm dlx @farming-labs/docs search sync --typesense` or `--algolia` when you want to push external indexes from the CLI instead of waiting for the first request
- Search is hidden when `staticExport: true` because there is no docs API route

Testing tip:

- The Next example under `examples/next` is the easiest place to verify provider-backed search.
- Set `DOCS_SEARCH_PROVIDER=typesense`, `algolia`, or `mcp`, restart the app, and query
  `/api/docs?query=...` to confirm the active backend.

---

## Changelog

Use `changelog` to render a docs-native release feed from dated MDX entries.

```ts
changelog: {
  enabled: true,
  path: "changelogs",
  contentDir: "changelog",
  title: "Changelog",
  description: "Latest product updates and release notes.",
  search: true,
},
```

Important notes:

- Today, the turn-key generated changelog pages are wired in **Next.js** when you use `withDocs()`
- Source entries default to `app/docs/changelog/YYYY-MM-DD/page.mdx`
- Public pages render at `/docs/changelogs` and `/docs/changelogs/YYYY-MM-DD`
- No separate `__changelog.generated.tsx` file is required; the generated route files inline the dated entry imports
- Use `docs.config.tsx` if you pass a JSX `actionsComponent`

Useful entry frontmatter:

- `title`
- `description`
- `image`
- `authors`
- `version`
- `tags`
- `pinned`
- `draft`

---

## Page feedback

```ts
feedback: {
  enabled: true,
  onFeedback(data) {
    console.log(data.value, data.slug, data.url);
  },
}
```

- Use `feedback: true` to show the UI with no callback.
- **Next.js / TanStack Start / SvelteKit / Nuxt:** `feedback.onFeedback` runs from the built-in UI with no extra client bridge file.
- **Astro:** the built-in UI still works with `feedback: true`; optional analytics hooks can listen to `window.__fdOnFeedback__` or the `fd:feedback` event.

## Agent feedback endpoints

Use `feedback.agent` when agents or automation should be able to report docs understanding or
implementation outcomes back through the shared docs API.

```ts
feedback: {
  agent: {
    enabled: true,
    async onFeedback(data) {
      console.log(data.context?.page, data.payload);
    },
  },
}
```

Default behavior:

- `GET /.well-known/agent.json` is the preferred public agent discovery document, with `/.well-known/agent` as fallback and `/api/docs/agent/spec` as the canonical framework route
- the discovery document includes site identity, locale config, capability flags, search, markdown routes, `llms.txt`, root `skill.md` metadata, Skills CLI install metadata, MCP, and feedback routes
- `GET /skill.md` serves the root `skill.md` file when present, `GET /.well-known/skill.md` is the fallback alias, and `GET /api/docs?format=skill` is the shared API format
- `GET /api/docs/agent/feedback/schema` returns the machine-readable schema
- `POST /api/docs/agent/feedback` accepts `{ context?, payload }`
- the shared `/api/docs` handler remains the source of truth
- **Next.js:** `withDocs()` adds the public rewrites automatically
- **TanStack Start:** current `init` scaffolds one `src/routes/$.ts` public forwarder for well-known routes and `/skill.md`
- **SvelteKit:** current `init` scaffolds one `src/hooks.server.ts` public forwarder for well-known routes and `/skill.md`
- **Astro:** current `init` scaffolds one `src/middleware.ts` public forwarder for well-known routes and `/skill.md`
- **Nuxt:** current `init` scaffolds one `server/middleware/docs-public.ts` public forwarder for well-known routes and `/skill.md`
- `feedback.agent` alone does not enable the human footer UI

Default payload shape:

```json
{
  "context": {
    "page": "/docs/installation",
    "source": "md-route"
  },
  "payload": {
    "task": "install docs in an existing Next.js app",
    "understanding": "partial",
    "outcome": "implemented",
    "confidence": 0.78,
    "neededCodeReading": true,
    "missingContext": ["how the markdown route is resolved"],
    "docIssues": ["command example was unclear"],
    "suggestedImprovement": "Add one sentence about rewrite behavior."
  }
}
```

Customize the route or payload schema when needed:

```ts
feedback: {
  agent: {
    route: "/internal/docs/agent-feedback",
    schemaRoute: "/internal/docs/agent-feedback/schema",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        task: { type: "string" },
        outcome: { type: "string" },
      },
      required: ["task", "outcome"],
    },
  },
}
```

---

## MCP Server

MCP is enabled by default. Use `mcp` when you want to customize the built-in MCP server for local
agents and remote HTTP clients, or set `enabled: false` to opt out.

```ts
mcp: {
  route: "/api/docs/mcp",
}
```

Opt out explicitly:

```ts
mcp: {
  enabled: false,
}
```

Default behavior:

- **Public HTTP route:** `/mcp`
- **Well-known HTTP route:** `/.well-known/mcp`
- **Canonical HTTP route:** `/api/docs/mcp`
- **stdio command:** `pnpx @farming-labs/docs mcp`
- **Built-in tools:** `list_pages`, `get_navigation`, `search_docs`, `read_page`

Framework notes:
- **Next.js:** `withDocs()` auto-generates the default `/api/docs/mcp` route and public `/mcp` plus `/.well-known/mcp` rewrites
- **TanStack Start:** current `init` scaffolds one `src/routes/$.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **SvelteKit:** current `init` scaffolds one `src/hooks.server.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **Astro:** current `init` scaffolds one `src/middleware.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **Nuxt:** current `init` scaffolds one `server/middleware/docs-public.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **Custom routes:** set `mcp.route` in `docs.config` and update the framework public forwarder so the configured path and the actual endpoint stay aligned

Testing tip:

```bash
pnpm --dir examples/next dev
```

Then point an MCP client or inspector at `http://127.0.0.1:3000/mcp` or
`http://127.0.0.1:3000/.well-known/mcp` to verify the default route.

Hosted example:

- The docs site itself exposes MCP at `https://docs.farming-labs.dev/mcp` and
  `https://docs.farming-labs.dev/.well-known/mcp`
- Cursor can install it from a deeplink:
  `cursor://anysphere.cursor-deeplink/mcp/install?name=farming-labs-docs&config=eyJ1cmwiOiJodHRwczovL2RvY3MuZmFybWluZy1sYWJzLmRldi8ud2VsbC1rbm93bi9tY3AifQ==`

See the full guide: [docs.farming-labs.dev/docs/customization/mcp](https://docs.farming-labs.dev/docs/customization/mcp)

---

## API Reference

`apiReference` generates an API reference from framework route conventions or a hosted OpenAPI
JSON document.

Use local route scanning when your API routes live in the same project. Use `specUrl` when your
backend is hosted elsewhere and already exposes an `openapi.json`.

Current support:
- **Next.js:** `app/api/**/route.ts` and `src/app/api/**/route.ts`
- **TanStack Start:** `src/routes/api.*.ts` and nested route files inside the configured route root
- **SvelteKit:** `src/routes/api/**/+server.ts` or `+server.js`
- **Astro:** `src/pages/api/**/*.ts` or `.js`
- **Nuxt:** `server/api/**/*.ts` or `.js`

```ts
apiReference: {
  enabled: true,
  path: "api-reference",
  routeRoot: "api",
  exclude: ["/api/internal/health", "internal/debug"],
}
```

Remote spec example:

```ts
apiReference: {
  enabled: true,
  path: "api-reference",
  specUrl: "https://petstore3.swagger.io/api/v3/openapi.json",
}
```

Notes:
- **Next.js:** `withDocs()` auto-generates the `/{path}` route when `apiReference` is enabled
- **TanStack Start / SvelteKit / Astro / Nuxt:** `docs.config` controls scanning, remote spec rendering, and styling, but the app must still add the framework route handler for `/{path}`
- **CLI:** `init --api-reference` writes the `apiReference` block and scaffolds the non-Next route handler files automatically
- `path` controls the public URL for the generated reference
- `specUrl` points to a hosted OpenAPI JSON document; when set, local route scanning is skipped
- `routeRoot` controls the filesystem route root to scan
- `exclude` accepts either URL-style paths (`"/api/hello"`) or route-root-relative entries (`"hello"` / `"hello/route.ts"`)
- on Next.js static export (`output: "export"`), the generated API reference route is skipped automatically

When `specUrl` is set:

- `routeRoot` and `exclude` are ignored
- the API reference is rendered from the hosted OpenAPI JSON
- non-Next frameworks still need the `/{path}` handler files because they are what serve the generated API reference page

Minimal handler files for non-Next frameworks:

- **TanStack Start:** `src/routes/api-reference.index.ts` and `src/routes/api-reference.$.ts` using `createTanstackApiReference(config)`
- **SvelteKit:** `src/routes/api-reference/+server.ts` and `src/routes/api-reference/[...slug]/+server.ts` using `createSvelteApiReference(config)`
- **Astro:** `src/pages/api-reference/index.ts` and `src/pages/api-reference/[...slug].ts` using `createAstroApiReference(config)`
- **Nuxt:** `server/routes/api-reference/index.ts` and `server/routes/api-reference/[...slug].ts` using `defineApiReferenceHandler(config)`

---

## Theme toggle

```ts
themeToggle: {
  enabled: true,   // show toggle (default)
  default: "light" | "dark" | "system",
}
```

Set `enabled: false` to hide the toggle or force a single mode.

---

## Sidebar and breadcrumb

- **sidebar:** `true` (default) or `SidebarConfig` (style, banner, footer, `folderIndexBehavior`, etc.). Use `folderIndexBehavior: "toggle"` when all folder parents should only expand/collapse instead of navigating to their landing page. Use `folderIndexBehaviorOverrides` to do that selectively for specific folder landing-page URLs such as `"/docs/components"`.
- **breadcrumb:** `true` (default) or `BreadcrumbConfig` to show/hide or configure breadcrumb.

---

## Metadata and OG

- **metadata:** `titleTemplate`, `description`, `twitterCard`, etc. for SEO.
- **og:** `enabled`, `type` ("dynamic" | "static"), `endpoint` for dynamic OG image generation. See API reference and OG Images docs.

---

## Ordering (sidebar)

Use `ordering: "numeric"` (default) so sidebar order follows frontmatter `order` (numbers). Doc pages can set `order: 1`, `order: 2`, etc. in frontmatter to control order.

---

## Edge cases

1. **Next.js:** Must wrap config with `withDocs()` from `@farming-labs/next/config` in `next.config.ts`.
2. **TanStack Start:** `docs.config.ts` stays at project root; wire it into `createDocsServer()` and keep the theme CSS import in your global stylesheet aligned with the theme name in config.
3. **SvelteKit/Astro:** Server-side docs loader must receive config and (for AI) env vars; see framework docs.
4. **Nuxt:** `defineDocsHandler(config, useStorage)` in `server/api/docs.ts`; config is imported from root `docs.config.ts`.
5. **Feedback callbacks:** Astro cannot serialize config functions into client scripts; use the built-in custom event hooks if you need analytics there.
6. **MCP custom routes:** The defaults are `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`. If the user sets `mcp.route`, keep that path in config and update the framework public forwarder so aliases still reach the same handler when MCP is enabled.

---

## Resources

- **Configuration docs:** [docs.farming-labs.dev/docs/configuration](https://docs.farming-labs.dev/docs/configuration)
- **API Reference:** [docs.farming-labs.dev/docs/reference](https://docs.farming-labs.dev/docs/reference)
- **MCP Server:** [docs.farming-labs.dev/docs/customization/mcp](https://docs.farming-labs.dev/docs/customization/mcp)
- **Related skills:** `ask-ai`, `page-actions`, `getting-started`, `creating-themes`.

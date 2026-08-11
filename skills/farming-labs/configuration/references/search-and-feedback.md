# Search and feedback

Use this reference for search providers, audience-aware retrieval, changelog pages, human page
feedback, and machine feedback endpoints.

## Contents

- [Search](#search)
- [Provider configuration](#provider-configuration)
- [Changelog](#changelog)
- [Human page feedback](#human-page-feedback)
- [Agent feedback](#agent-feedback)
- [Discovery behavior](#discovery-behavior)

## Search

Search is enabled by default with section-based simple indexing.

```ts
search: true
```

The shared HTTP route is audience-aware:

- `GET /api/docs?query=<query>` returns shared plus human content.
- Add `audience=agent` for shared plus agent content.
- Omitted, `human`, and unknown values remain human-default.

Audience selection is public representation shaping, not authorization.

Opt into retrieval explanations when an agent needs to inspect why a result was selected:

```text
GET /api/docs?query=deploy&audience=agent&response=structured&explain=true
```

`explain=true` adds a bounded `explanation` to every result with matched terms and fields, the
selected provenance scope, filter decisions, ambiguity resolution, one-based rank, and ranking
reasons. The default and `explain=false` omit it. Provider-backed results identify provider-owned
ordering explicitly; the shared pipeline does not invent unavailable provider internals.

The built-in MCP `search_docs` tool accepts the same opt-in as `{ "query": "deploy", "explain":
true }`.

Providers:

- `simple`: zero configuration
- `typesense`: external Typesense with optional hybrid embeddings
- `algolia`: external Algolia
- `mcp`: an MCP `search_docs` tool
- `custom`: user-supplied adapter

`chunking.strategy` defaults to `"section"` and may be `"page"`. Search is hidden during static
export.

## Provider configuration

### Typesense

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
}
```

### Algolia

```ts
search: {
  provider: "algolia",
  appId: process.env.ALGOLIA_APP_ID!,
  indexName: "docs",
  searchApiKey: process.env.ALGOLIA_SEARCH_API_KEY!,
  adminApiKey: process.env.ALGOLIA_ADMIN_API_KEY,
}
```

### MCP

```ts
search: {
  provider: "mcp",
  endpoint: "/mcp",
},
mcp: { enabled: true },
```

Relative endpoints may be `/mcp`, `/.well-known/mcp`, or the canonical route. Same-origin local
aliases use internal search instead of loopback HTTP to avoid recursion. Remote endpoints and
custom tool names require `forwardAudience: true` only after their schema accepts the audience.

### Custom adapter

```ts
import { createCustomSearchAdapter } from "@farming-labs/docs";

const search = createCustomSearchAdapter({
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
});
```

Custom adapters receive `query.audience`, `context.audience`, and documents already shaped for
that projection. Provider-backed sync remains human-projected; agent requests are projected at
request time. On a manual Next route, pass the full config to `createDocsAPI(docsConfig)`.

Use the CLI to push external indexes:

```bash
pnpm dlx @farming-labs/docs search sync --typesense
pnpm dlx @farming-labs/docs search sync --algolia
```

## Changelog

```ts
changelog: {
  enabled: true,
  path: "changelogs",
  contentDir: "changelog",
  title: "Changelog",
  description: "Latest product updates.",
  search: true,
}
```

Turn-key generated changelog pages currently target Next.js with `withDocs()`. Source entries
default to `app/docs/changelog/YYYY-MM-DD/page.mdx`; public pages default to
`/docs/changelogs/YYYY-MM-DD`. Useful frontmatter includes `title`, `description`, `image`,
`authors`, `version`, `tags`, `pinned`, and `draft`. Use `docs.config.tsx` for JSX
`actionsComponent`.

## Human page feedback

```ts
feedback: {
  enabled: true,
  onFeedback(data) {
    console.log(data.value, data.slug, data.url);
  },
}
```

`feedback: true` shows the UI without a callback. Next.js, TanStack Start, SvelteKit, and Nuxt run
the callback through built-in wiring. Astro supports `feedback: true`; optional analytics use
`window.__fdOnFeedback__` or the `fd:feedback` event.

## Agent feedback

Agent feedback is enabled by default and is independent from the human footer.

```ts
feedback: {
  agent: {
    route: "/internal/docs/agent-feedback",
    schemaRoute: "/internal/docs/agent-feedback/schema",
    async onFeedback(data) {
      console.log(data.context?.page, data.payload);
    },
  },
}
```

Default shared routes:

- `GET /api/docs/agent/feedback/schema`
- `POST /api/docs/agent/feedback`
- MCP `submit_feedback` (when MCP and machine feedback are enabled)
- non-Next adapters also advertise the existing query-route form

Without a callback, POST returns `{ ok: true, handled: false }`. Customize `schema` with a JSON
Schema object when integrations need a smaller payload. Set `feedback: false` or
`feedback: { agent: false }` to opt out. `feedback.agent` alone does not enable the human UI.

## Discovery behavior

The Farming Labs manifest is served at `/.well-known/agent.json` with
`/.well-known/agent` as fallback and `/api/docs/agent/spec` as canonical framework route. It is
identified by:

- `$schema: "https://docs.farming-labs.dev/schema/agent-manifest.v1.json"`
- `format: "farming-labs-agent-manifest.v1"`

It is not A2A; `/.well-known/agent-card.json` is a separate opt-in standard surface. Discovery
cross-lists enabled search, Markdown, llms, OpenAPI, sitemap, robots, skills, MCP, and feedback
metadata. Runtime discovery responses include useful `Link` headers.

The runtime also serves root and well-known aliases for `AGENTS.md` and `skill.md`; current
non-Next forwarders expose them through the shared handler.

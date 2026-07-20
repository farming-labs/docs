# @farming-labs/docs

AI-native documentation for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.

Write MDX or Markdown, configure the docs site in TypeScript, and ship a polished documentation
experience for humans, IDEs, and agents without maintaining a pile of routing boilerplate.

## Core Features

- Framework adapters for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt
- One `docs.config.ts` file for routing, theme, search, metadata, feedback, and AI surfaces
- Built-in themes with shared MDX components such as `Callout`, `Tabs`, `HoverLink`, and `Prompt`
- Built-in search with simple, Typesense, Algolia, MCP, and custom provider options
- Generated API reference from framework route handlers or a hosted OpenAPI JSON document
- Next.js changelog pages from dated MDX entries
- Machine-readable docs through `.md` routes, JSON-LD structured data, `llms.txt`, sitemaps, `robots.txt`, `skill.md`, agent discovery, and MCP
- Complete static Agent Bundles with `docs agent export --public` and deterministic SHA-256 manifests
- Page-level agent compaction with `docs agent compact` and `agent.compact` defaults
- Agent and reader-facing docs scoring with `docs doctor --agent` and `docs doctor --site`

## Quick Start

Run the CLI inside an existing app:

```bash
npx @farming-labs/docs init
```

Or start a new project:

```bash
npx @farming-labs/docs init --template next --name my-docs
```

The CLI detects your framework, installs the right packages, creates `docs.config.ts`, adds the
theme CSS, scaffolds starter pages, and starts the dev server.

## Basic Config

All frameworks use `defineDocs()`:

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s - Docs",
    description: "My documentation site",
  },
});
```

Next.js projects also wrap `next.config.ts`:

```ts
import { withDocs } from "@farming-labs/next/config";

export default withDocs();
```

And import the theme CSS:

```css
@import "tailwindcss";
@import "@farming-labs/theme/default/css";
```

Other framework adapters follow the same shape: configure docs once, add the adapter route/helper,
and import the matching theme CSS.

## Content

Docs are plain Markdown or MDX files.

```txt
app/docs/
  page.mdx
  installation/
    page.mdx
  guides/
    deployment/
      page.mdx
```

Pages use frontmatter for metadata:

```mdx
---
title: "Installation"
description: "Get up and running"
---

# Installation

Your docs content here.
```

## Agent And LLM Surface

The framework exposes machine-readable docs in Next.js, with sitemap routes available when
`sitemap` is enabled:

- `/llms.txt`
- `/llms-full.txt`
- `/sitemap.xml`
- `/sitemap.md`
- `/.well-known/sitemap.md`
- `/skill.md`
- `/.well-known/skill.md`
- `/.well-known/agent.json`
- `/.well-known/agent`
- `/mcp`
- `/.well-known/mcp`
- `/docs/<slug>.md`
- `/docs/<slug>` with an unambiguous `Accept: text/markdown`
- `/docs/<slug>` with `Signature-Agent`
- Schema.org JSON-LD on each docs page
- generated `robots.txt` via `docs robots generate`

The canonical API routes remain available under `/api/docs`, including `/api/docs?format=skill`,
`/api/docs/mcp`, and `/api/docs/agent/spec`.
Canonical Next.js markdown reads with an unambiguous `Accept: text/markdown` or `Signature-Agent`
are handled by that same shared `/api/docs` route, so apps do not need a second markdown-only API
wrapper. For mixed HTML/Markdown accept lists, use the exact `.md` or `format=markdown` route.
The agent discovery JSON also includes structured-data capability metadata plus `robots.enabled`,
`robots.route`, and `robots.defaultRoute` so agents can find page metadata and the static crawl
policy without guessing.

## Agent Health Check

Use `docs doctor --agent` when you want to inspect the machine-facing quality of the docs site.
Use `docs doctor --site` when you want a reader-facing audit of navigation, descriptions,
structure, trust signals, and feedback.

```bash
pnpm exec docs doctor --agent
pnpm exec docs doctor --site
pnpm exec docs doctor --agent --json
pnpm exec docs doctor --agent --url https://docs.example.com
```

Expected output looks like:

```txt
@farming-labs/docs doctor — agent

Score: 82% (Agent-ready)
Framework: nextjs • Entry: docs • Content: app/docs
Explicit agent-friendly pages: 10/41 pages (24%)
Useful Agent blocks: 8/14 • 6/12 actionable pages task-complete
Golden tasks: 3/4 passed (88/100)
```

The command checks docs config resolution, content discovery, API route wiring, public agent routes,
`llms.txt`, sitemap routes, `robots.txt`, `skill.md`, MCP, search, feedback, page metadata, and
generated `agent.md` freshness. Its usefulness checks also detect repeated or generic `<Agent>`
blocks, incomplete task guidance, framework/version ambiguity, stale commands, missing related
pages, low-confidence config loading, and drift between discovery, config, and the public schema.

Configure `agent.evaluations.tasks` to run golden tasks for retrieval recall, citations,
framework/version selection, verified examples, generated answers, and context-budget usage.
Evaluations use the local `mcp-context` surface by default and make no implicit model or network
request. Projects can opt into their configured search or Ask AI context pipeline, an answer
callback or HTTP endpoint, and explicit runtime example verification. Managed external search,
HTTP answer requests, and runtime example execution require `allowNetwork: true`; an empty task
list is reported as unmeasured instead of receiving credit. Configured retrieval is bounded by
`searchTimeoutMs`, which defaults to 30 seconds per task.

Hosted checks request the public agent routes and verify the MCP initialize handshake. Use `--json`
when the result needs to feed CI, dashboards, GitHub Actions summaries, or another system.

## Common Tasks

Use the full docs for feature-specific setup:

- [Configuration](https://docs.farming-labs.dev/docs/configuration)
- [API reference](https://docs.farming-labs.dev/docs/reference)
- [Themes](https://docs.farming-labs.dev/docs/customization)
- [MCP server](https://docs.farming-labs.dev/docs/customization/mcp)
- [llms.txt](https://docs.farming-labs.dev/docs/customization/llms-txt)
- [Sitemaps](https://docs.farming-labs.dev/docs/customization/sitemaps)
- [Agent primitive](https://docs.farming-labs.dev/docs/customization/agent-primitive)
- [Examples](https://github.com/farming-labs/docs/tree/main/examples)

## Agent Skills

Installable Agent Skills live in [`skills/farming-labs`](./skills/farming-labs) and cover setup,
CLI usage, configuration, themes, Ask AI, and page actions.

## Development

```bash
pnpm install
pnpm build
pnpm dev
```

Useful checks:

```bash
pnpm test
pnpm typecheck
```

## Contributing

See the [Contributing guide](https://docs.farming-labs.dev/docs/contributing).

## License

MIT

# @farming-labs/docs

AI-native documentation for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.

Write MDX or Markdown, configure the docs site in TypeScript, and ship a polished documentation
experience for humans, IDEs, and agents without maintaining a pile of routing boilerplate.

## Core Features

- Framework adapters for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt
- One `docs.config.ts` file for routing, theme, search, metadata, feedback, and AI surfaces
- Built-in themes with shared MDX components such as `Callout`, `Tabs`, and `HoverLink`
- Built-in search with simple, Typesense, Algolia, MCP, and custom provider options
- Generated API reference from framework route handlers or a hosted OpenAPI JSON document
- Next.js changelog pages from dated MDX entries
- Machine-readable docs through `.md` routes, `llms.txt`, `skill.md`, agent discovery, and MCP
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

The framework exposes machine-readable docs by default in Next.js:

- `/llms.txt`
- `/llms-full.txt`
- `/skill.md`
- `/.well-known/skill.md`
- `/.well-known/agent.json`
- `/.well-known/agent`
- `/mcp`
- `/.well-known/mcp`
- `/docs/<slug>.md`
- `/docs/<slug>` with `Accept: text/markdown`

The canonical API routes remain available under `/api/docs`, including `/api/docs?format=skill`,
`/api/docs/mcp`, and `/api/docs/agent/spec`.

For a custom site-specific skill, place `skill.md` at the project root beside `docs.config.ts`.
When it is missing, the framework serves a generated fallback based on the docs config.

## Agent Compaction

Use `docs agent compact` when you want to generate or refresh sibling `agent.md` files from
resolved docs pages.

```bash
pnpm exec docs agent compact installation
pnpm exec docs agent compact --stale
pnpm exec docs agent compact --stale --include-missing
```

Optional defaults live in `docs.config.ts`:

```ts
agent: {
  compact: {
    apiKeyEnv: "TOKEN_COMPANY_API_KEY",
  },
},
```

Per-page token budgets live in frontmatter:

```md
---
title: "Installation"
agent:
  tokenBudget: 777
---
```

That page-level `agent.tokenBudget` override beats global `agent.compact.maxOutputTokens` defaults
and CLI `--max-output-tokens` for the same page. If the page already has a sibling `agent.md`, the
command compacts that file. Otherwise it compacts the generated machine-readable page first and
writes a new sibling `agent.md`.

Generated files carry hidden provenance metadata so the CLI can detect drift later:

- `docs agent compact --stale` refreshes only stale generated `agent.md` files
- `docs agent compact --stale --include-missing` also creates missing `agent.md` files for
  explicitly requested pages or pages that define `agent.tokenBudget`
- hand-edited generated `agent.md` files are treated as modified and skipped by `--stale`

The generated `agent.md` becomes the machine-readable source for `.md` routes,
`GET /api/docs?format=markdown&path=...`, and MCP `read_page()`.

## Agent Health Check

Use `docs doctor --agent` when you want to inspect the machine-facing quality of the docs site.
Use `docs doctor --site` when you want a reader-facing audit of navigation, descriptions,
structure, trust signals, and feedback.

```bash
pnpm exec docs doctor --agent
pnpm exec docs doctor --site
pnpm exec docs doctor --agent --json
```

Expected output looks like:

```txt
@farming-labs/docs doctor — agent

Score: 87/100 (Agent-ready)
Framework: nextjs • Entry: docs • Content: app/docs
Explicit agent-friendly pages: 10/41 pages (24%)
```

The command checks the agent surface end to end:

- docs config resolution
- docs content discovery
- docs API route wiring
- public agent routes
- agent discovery spec
- `llms.txt`
- `skill.md`
- MCP
- search
- agent feedback
- page metadata
- explicit agent-friendly pages
- generated `agent.md` freshness and `agent.compact` defaults

It is not required to run the framework, but it is very useful before claiming a docs site is
agent-ready or agent-optimized, and it works well as a CI check for the machine-facing docs layer.

`docs doctor --site` focuses on the reader-facing surface instead:

- docs config resolution
- docs content discovery
- navigation coverage
- page descriptions
- page structure
- search
- trust signals (`github` / `lastUpdated`)
- reader feedback
- reading-time cues

Use `--json` when the result needs to feed another system instead of a person reading the terminal:

```bash
pnpm exec docs doctor --agent --json
pnpm exec docs doctor --site --json
```

That JSON form is useful for:

- CI quality gates
- GitHub Actions summaries or PR comments
- dashboards that track docs quality over time
- automation that reruns `docs agent compact --stale`
- other agents that need structured readiness signals instead of terminal text

The JSON report itself is written to stdout. Separate loader notices, such as config fallback
warnings, are outside the JSON payload.

## Common Tasks

Use the full docs for feature-specific setup:

- [Configuration](https://docs.farming-labs.dev/docs/configuration)
- [API reference](https://docs.farming-labs.dev/docs/reference)
- [Themes](https://docs.farming-labs.dev/docs/customization)
- [MCP server](https://docs.farming-labs.dev/docs/customization/mcp)
- [llms.txt](https://docs.farming-labs.dev/docs/customization/llms-txt)
- [Agent primitive](https://docs.farming-labs.dev/docs/customization/agent-primitive)
- [Examples](https://github.com/farming-labs/docs/tree/main/examples)

## Agent Skills

This repo includes installable Agent Skills for assistants working with `@farming-labs/docs`.

```bash
npx skills add farming-labs/docs
```

Skills live in [`skills/farming-labs`](./skills/farming-labs) and cover setup, CLI usage,
configuration, themes, Ask AI, and page actions.

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

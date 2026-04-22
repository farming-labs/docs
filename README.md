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
- Machine-readable docs through `.md` routes, `llms.txt`, agent discovery, and MCP

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
- `/.well-known/agent.json`
- `/.well-known/agent`
- `/mcp`
- `/.well-known/mcp`
- `/docs/<slug>.md`
- `/docs/<slug>` with `Accept: text/markdown`

The canonical API routes remain available under `/api/docs`, including `/api/docs/mcp` and
`/api/docs/agent/spec`.

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

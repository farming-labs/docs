# @farming-labs/docs

AI-native documentation for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.

Write Markdown or MDX, configure your docs in TypeScript, and ship a polished documentation
experience for people, IDEs, and AI agents. `@farming-labs/docs` provides the shared configuration,
types, content pipeline, agent tooling, and CLI used by the Farming Labs framework adapters.

## Features

- One `docs.config.ts` file for routing, themes, search, metadata, feedback, and AI features
- Framework adapters for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt
- Built-in themes and MDX components such as `Callout`, `Tabs`, `HoverLink`, and `Prompt`
- Built-in search, generated API references, and Next.js changelog pages
- Machine-readable `.md` routes, `llms.txt`, sitemaps, JSON-LD, agent discovery, and MCP
- CLI workflows for scaffolding, upgrades, documentation health checks, and static agent files

## Quick start

Run the interactive setup inside an existing project:

```bash
npx @farming-labs/docs@latest init
```

Or bootstrap a new documentation project from a template:

```bash
npx @farming-labs/docs@latest init --template next --name my-docs
```

Available templates are `next`, `tanstack-start`, `sveltekit`, `astro`, and `nuxt`. The CLI installs
the packages for your framework, creates the config and starter pages, and adds the theme CSS.

## Framework packages

| Framework | Core and adapter | Theme |
| --- | --- | --- |
| Next.js | `@farming-labs/docs`, `@farming-labs/next` | `@farming-labs/theme` |
| TanStack Start | `@farming-labs/docs`, `@farming-labs/tanstack-start` | `@farming-labs/theme` |
| SvelteKit | `@farming-labs/docs`, `@farming-labs/svelte` | `@farming-labs/svelte-theme` |
| Astro | `@farming-labs/docs`, `@farming-labs/astro` | `@farming-labs/astro-theme` |
| Nuxt | `@farming-labs/docs`, `@farming-labs/nuxt` | `@farming-labs/nuxt-theme` |

## Basic configuration

Every framework uses `defineDocs()`. A minimal Next.js config looks like this:

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – Docs",
    description: "My documentation site",
  },
});
```

Next.js projects also wrap `next.config.ts`:

```ts
import { withDocs } from "@farming-labs/next/config";

export default withDocs();
```

Import your selected theme in the app's global stylesheet:

```css
@import "tailwindcss";
@import "@farming-labs/theme/default/css";
```

Import the CSS for the selected preset. The default `fumadocs()` preset uses
`@farming-labs/theme/default/css`. SvelteKit, Astro, and Nuxt import their theme helpers from the
corresponding packages shown above; the CLI wires up the right config and CSS automatically.

## Write content in Markdown or MDX

```mdx
---
title: "Installation"
description: "Get up and running"
---

# Installation

Your documentation starts here.
```

Routing is file-based, so a page such as `app/docs/guides/deployment/page.mdx` becomes
`/docs/guides/deployment` in Next.js. The CLI scaffolds the correct directory layout for every
supported framework.

## Documentation for agents

Farming Labs can expose the same docs in machine-readable forms, including:

- `llms.txt` and full-document feeds
- Markdown routes for individual pages
- `skill.md`, multi-skill discovery with hashed companion assets, `AGENTS.md`, and agent discovery endpoints
- A built-in Model Context Protocol (MCP) server
- Schema.org JSON-LD, sitemaps, and generated `robots.txt`
- Agent-focused health checks with `docs doctor --agent`

## Learn more

- [Documentation](https://docs.farming-labs.dev/docs)
- [Configuration reference](https://docs.farming-labs.dev/docs/configuration)
- [Themes](https://docs.farming-labs.dev/docs/themes)
- [Examples](https://github.com/farming-labs/docs/tree/main/examples)
- [GitHub repository](https://github.com/farming-labs/docs)

## License

MIT

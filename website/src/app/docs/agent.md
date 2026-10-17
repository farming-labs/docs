<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:f31c3c54e92a6a1e
settingsHash=fnv1a64:0a67cd1f3384201a
outputHash=fnv1a64:5a773c15e735f864
generatedAt=2026-08-20T10:20:45.454Z
-->
# Introduction

## Introduction task

Task: Select the correct Farming Labs docs workflow and bootstrap a supported project.

Expected result: The project has a working docs entry plus discoverable Markdown, search, sitemap, robots, and MCP capabilities appropriate to its config.

## Introduction prerequisites

- Identify whether the user is adding docs to an existing app or creating a new docs project.
- Identify the existing framework and package manager before choosing an adapter or command.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Introduction verification

- Open the configured docs entry and fetch /.well-known/agent.json from the same origin. Expected: The docs page renders and discovery advertises only the capabilities enabled by the resolved config.
- Failure: The initializer selects the wrong framework.
- Recovery: Stop before accepting generated changes and rerun with the documented explicit template or framework choice.
- Rollback: Restore dependency and lock files and remove only the scaffolded docs files created by initialization.

## Introduction agent guidance

You are reading the machine-readable entry page for `@farming-labs/docs`.

Before implementing from this docs site, fetch `/.well-known/agent.json` from the same origin. If
that is unavailable, fall back to `/.well-known/agent`. Treat that JSON as the source of truth for
the docs entry path, markdown route pattern, search endpoint, MCP endpoint, `llms.txt` routes,
OpenAPI schema route, `sitemap.xml` / `sitemap.md` / `/docs/sitemap.md` routes, `robots.txt` route, `AGENTS.md` route, `skill.md` route,
skills install command, JSON-LD structured data, locale handling, `Signature-Agent` support, and
feedback endpoints.

Recommended bootstrap flow:

1. Fetch `/.well-known/agent.json`, then fall back to `/.well-known/agent`.
2. Read `spec.skills.route` or `spec.skills.wellKnown` when a concise site skill is useful.
3. Use `spec.markdown.pagePattern`, `spec.markdown.acceptHeader`, or `spec.markdown.signatureAgentHeader` to read the exact docs pages you need as markdown.
4. Use `spec.search.endpoint` when you need to find the right page before reading it.

Do not scrape the HTML page when markdown, search, OpenAPI, sitemap, robots, MCP, or `llms.txt`
routes are available in the spec.
## Introduction Quick Start workflow

Quick Start distinguishes adding docs to an existing project from creating a fresh project. Run `pnpm dlx @farming-labs/docs init`; the existing-project flow auto-detects the current framework, while `init --template <framework> --name <dir>` creates a fresh project.

## Quick Start existing project auto-detects framework

For the Quick Start existing-project workflow, run `pnpm dlx @farming-labs/docs init` from the application root. It auto-detects Next.js, TanStack Start, SvelteKit, Astro, or Nuxt before it initializes Farming Labs docs with the matching adapter.

## Quick Start fresh project template

For the Quick Start fresh-project workflow, run `pnpm dlx @farming-labs/docs init --template <framework> --name <dir>`. This initializes Farming Labs docs with the selected framework and keeps the package manager consistent through verification.

## Quick Start framework selection

The existing-project command auto-detects the framework. Use the explicit `--template` value for a fresh docs project or when the user deliberately selects a supported framework.

## Quick Start initialization verification

After `pnpm dlx` initializes Farming Labs docs, start the generated application, open its docs entry, and confirm `/.well-known/agent.json` advertises the Markdown and MCP routes enabled by the resolved config.

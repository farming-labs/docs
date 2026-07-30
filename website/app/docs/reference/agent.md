<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:15d10d4a42682400
settingsHash=fnv1a64:aa433a28ef4afd1f
outputHash=fnv1a64:d4876e8116ad0a3a
generatedAt=2026-07-30T09:43:36.687Z
-->
# API Reference

## API Reference task

Task: Select and configure the exact typed Farming Labs docs option required by a project.

Expected result: The chosen defineDocs option has the documented type and default and the resolved runtime exposes matching behavior.
## API Reference prerequisites

- Identify the project framework and the exact capability being configured.
- Read the existing docs.config before changing nested options or callbacks.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## API Reference verification

- Run pnpm exec docs doctor --agent. Expected: Config loading confidence and discovery/config/schema consistency pass after the option change.
- Query MCP get_config_schema for the changed option. Expected: The returned type, default, and description match the option used in docs.config.
- Failure: TypeScript rejects a documented option.
- Recovery: Confirm all Farming Labs packages use the same version and use docs.config.tsx when JSX is present.
- Rollback: Restore the previous option value and any route wiring or environment variables added with it.

## API Reference agent guidance

Before changing configuration, inspect the existing `defineDocs()` call and select the exact
exported `DocsConfig` field or nested type documented below. Preserve the framework's config path:
`docs.config.ts[x]` for Next.js, TanStack Start, and Nuxt, or `src/lib/docs.config.ts` for SvelteKit
and Astro. The non-Next adapters can configure `contentDir` and `nav` explicitly, while Next.js
derives its content tree from `app/{entry}/`.

When MCP `get_config_schema` publishes the option, compare its type and default; otherwise verify
against the installed exported types and matching-version reference. Then run
`pnpm exec docs doctor --agent` for the resolved capability and discovery fields it audits. For
SvelteKit or Astro, append `--config src/lib/docs.config.ts`. If TypeScript rejects the documented
shape, first align all `@farming-labs/*` package versions and rename the config to `.tsx` when it
contains JSX. If diagnostics and public discovery disagree, restore the previous value and repair
the adapter route or stale static export before enabling the capability again.
## API Reference PageAgentFrontmatter fields

`PageAgentFrontmatter` defines `task`, `outcome`, `appliesTo`, `prerequisites`, `verification`, `rollback`, and `failureModes`; each failure mode pairs a `symptom` with its `resolution`.

## PageAgentFrontmatter task outcome appliesTo verification rollback failureModes

In `page-frontmatter.md`, the exact fields are `task`, `outcome`, `appliesTo`, `verification`, `rollback`, and `failureModes`. Each failure mode contains a `symptom` and a `resolution`; the recovery example uses `resolution: Confirm withDocs wraps the Next.js config`.

## PageAgentFrontmatter exact page-frontmatter.md example

```md title="page-frontmatter.md"
---
title: "Installation"
description: "Install the framework"
agent:
  tokenBudget: 777
  task: Install the framework
  outcome: The docs route renders locally.
  appliesTo:
    framework: nextjs
    version: ">=16"
    package: "@farming-labs/next"
  prerequisites:
    - The app uses the App Router
  files:
    - package.json
    - next.config.ts
  commands:
    - run: pnpm add @farming-labs/docs @farming-labs/next
      description: Install the required packages
  verification:
    - run: pnpm dev
      expect: The docs route returns HTTP 200
  failureModes:
    - symptom: The route returns 404
      resolution: Confirm withDocs wraps the Next.js config
---
```

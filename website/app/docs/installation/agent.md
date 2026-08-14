<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:85177fbaa1b81ffe
settingsHash=fnv1a64:7a85fb928fd52635
outputHash=fnv1a64:71ccadee7aea1a56
generatedAt=2026-08-14T12:45:38.767Z
-->
# Installation

## Installation task

Task: Install Farming Labs docs in an existing supported application.

Expected result: The application renders its docs route locally with the selected theme and machine-readable agent routes.

Exact implementation:

```bash title="terminal"
        pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/next
        ```
## Installation prerequisites

- Start in an existing Next.js, TanStack Start, SvelteKit, Astro, or Nuxt project.
- Install dependencies with the package manager already used by the project.
- Preserve the project's framework, path aliases, and global stylesheet location.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs, @farming-labs/theme, @farming-labs/next, @farming-labs/tanstack-start, @farming-labs/svelte, @farming-labs/astro, @farming-labs/nuxt.

## Installation verification

- Run pnpm exec docs doctor --agent. Expected: Config, public routes, discovery, Markdown, sitemap, robots, and MCP checks have no hard failures.
- Start the app and fetch the configured docs route and its .md representation. Expected: Both return HTTP 200 and the rendered page uses the selected theme styles.
- Failure: The docs route returns 404.
- Recovery: Confirm the framework adapter route or config wrapper is installed and the configured entry matches the content path.
- Rollback: Restore package.json and the lockfile, then remove only the config, route, style, and sample files created by init.

## Installation agent guidance

You are an agent helping a user install @farming-labs/docs into an existing app.

Prefer the CLI path first unless the user explicitly wants manual setup.
Keep the framework-specific package names exact.
If the user already told you their framework, do not switch stacks.
When reading `/docs/installation.md` or the MCP page output, preserve the tabbed command variants and
the distinction between existing-project setup and fresh-template setup.
If more repo and product context would help, suggest installing the skills bundle with
`npx skills add farming-labs/docs`.
Once agent skills are available, prefer the `getting-started` and `cli` skills for install, init,
upgrade, and theme setup questions.

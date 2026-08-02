# Init and package versions

Use this reference for scaffolding, framework templates, generated files, upgrade, or downgrade.

## Contents

- [Initialize a project](#initialize-a-project)
- [Init flags](#init-flags)
- [Existing-project output](#existing-project-output)
- [Upgrade](#upgrade)
- [Downgrade](#downgrade)
- [Troubleshooting](#troubleshooting)

## Initialize a project

From the project root:

```bash
npx @farming-labs/docs@latest init
pnpm dlx @farming-labs/docs@latest init
yarn dlx @farming-labs/docs@latest init
bunx @farming-labs/docs@latest init
```

Without flags, choose:

- **Existing project:** detect or select the framework, then choose a theme, entry path, aliases,
  stylesheet, optional API reference, optional i18n where supported, and optional Docs Cloud.
- **Fresh project:** choose a supported framework and project name, clone its template, and
  install with the selected package manager.

Prompts with placeholders use them as defaults. Press Enter to accept values such as `docs`,
`my-theme`, or `my-docs`.

Non-interactive bootstrap:

```bash
pnpm dlx @farming-labs/docs@latest init --template next --name my-docs
pnpm dlx @farming-labs/docs@latest init --template tanstack-start --name my-docs
pnpm dlx @farming-labs/docs@latest init --template nuxt --name my-docs
pnpm dlx @farming-labs/docs@latest init --template sveltekit --name my-docs
pnpm dlx @farming-labs/docs@latest init --template astro --name my-docs
```

`--template` plus `--name` skips the existing/fresh prompts.

## Init flags

| Flag | Effect |
| --- | --- |
| `--template <name>` | Bootstrap `next`, `tanstack-start`, `nuxt`, `sveltekit`, or `astro` |
| `--name <project>` | Output directory for template bootstrap |
| `--theme <name>` | Skip theme selection |
| `--entry <path>` | Skip entry prompt; default `docs` |
| `--api-reference` | Enable API reference config and routes |
| `--no-api-reference` | Explicitly skip API reference |
| `--api-route-root <path>` | Override detected API route root |
| `--cloud` | Add Docs Cloud support without prompting |
| `--no-cloud` | Skip Docs Cloud support |

Examples:

```bash
pnpm dlx @farming-labs/docs@latest init \
  --template next \
  --name my-docs \
  --theme pixel-border

pnpm dlx @farming-labs/docs@latest init \
  --theme shadcn \
  --entry docs \
  --api-reference \
  --api-route-root internal-api
```

Cloud setup writes only the environment-variable contract. Put these values in `.env.local` or
the shell:

```bash
DOCS_CLOUD_API_KEY=fl_key_...
NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID=docs_cloud_project_id
```

Never commit the raw key.

## Existing-project output

All adapters install `@farming-labs/docs`, their adapter package, and their theme package.

### Next.js

- root `docs.config.ts` and `next.config.ts`
- global/layout files and `app/docs` pages
- optional Fumadocs or Scalar API reference route
- `@farming-labs/next` and `@farming-labs/theme`

### TanStack Start

- root `docs.config.ts`
- `src/lib/docs.server.ts` and `docs.functions.ts`
- docs routes, shared docs API route, and one public `src/routes/$.ts` forwarder
- optional API reference route pair
- root route and Vite integration updates
- selected global CSS import
- `@farming-labs/tanstack-start` and `@farming-labs/theme`

The existing-project flow currently skips built-in TanStack i18n scaffolding so generated routes
remain minimal.

### SvelteKit

- `src/lib/docs.config.ts` and server wrapper
- docs routes, API route, and one `src/hooks.server.ts` public forwarder
- optional API reference route pair
- `src/app.css` and Markdown content
- `@farming-labs/svelte` and `@farming-labs/svelte-theme`

### Astro

- `src/lib/docs.config.ts` and server wrapper
- docs pages, API route, and one `src/middleware.ts` public forwarder
- optional API reference route pair
- global stylesheet and Markdown content
- `@farming-labs/astro` and `@farming-labs/astro-theme`

### Nuxt

- root `docs.config.ts` and `nuxt.config.ts`
- server API plus `server/middleware/docs-public.ts`
- optional API reference route pair
- catch-all docs page and Markdown content
- `@farming-labs/nuxt` and `@farming-labs/nuxt-theme`

Choosing **Create your own theme** scaffolds `themes/<name>.ts` and `.css` and wires both config and
global CSS.

Where supported, optional i18n asks for common or custom locale codes and a default, then writes
config, locale directories, and required wrapper files.

## Upgrade

Run from the app directory containing the framework dependency:

```bash
pnpm dlx @farming-labs/docs@latest upgrade --dry-run
pnpm dlx @farming-labs/docs@latest upgrade
```

Package manager detection walks upward for lockfiles or `package.json#packageManager`; if no signal
exists, the CLI prompts.

| Framework | Packages |
| --- | --- |
| Next.js | `docs`, `theme`, `next` |
| TanStack Start | `docs`, `theme`, `tanstack-start` |
| Nuxt | `docs`, `nuxt`, `nuxt-theme` |
| SvelteKit | `docs`, `svelte`, `svelte-theme` |
| Astro | `docs`, `astro`, `astro-theme` |

Use explicit framework selection when needed:

```bash
pnpm dlx @farming-labs/docs@latest upgrade --framework tanstack-start
```

Targets:

```bash
pnpm dlx @farming-labs/docs@latest upgrade --latest
pnpm dlx @farming-labs/docs@latest upgrade --beta
pnpm dlx @farming-labs/docs@latest upgrade --version 0.2.82
```

`upgrade@beta` and `upgrade@latest` remain supported shorthands.

## Downgrade

Without a target, install the highest published version lower than the installed one:

```bash
pnpm dlx @farming-labs/docs@latest downgrade
```

Use an exact lower version and preview first:

```bash
pnpm dlx @farming-labs/docs@latest downgrade --version 0.2.81 --dry-run
pnpm dlx @farming-labs/docs@latest downgrade --version 0.2.81
```

Equal or newer targets stop with guidance to use `upgrade --version`.

## Troubleshooting

- In a monorepo, run from the app package, not the repository root.
- A project must have a `package.json` with the framework dependency for detection.
- Pass `--framework` when detection selects the wrong app.
- Use `--beta` only when the user requests a beta.
- When testing unpublished TanStack packages on Node 22/Vercel, prefer `workspace:*` links so Vite
  does not resolve raw adapter TypeScript from `node_modules`.

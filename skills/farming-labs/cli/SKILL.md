---
name: cli
description: @farming-labs/docs CLI — scaffold, upgrade, sync external search indexes, and run MCP for docs. Use when running init, upgrade, search sync, mcp, or using flags like --template, --name, --theme, --entry, --api-reference, --api-route-root, --framework, --latest, --beta, or --config. Covers init flow (existing vs fresh), Create your own theme, optional defaults (Enter to accept), npm/pnpm/yarn/bun, and framework detection.
---

# @farming-labs/docs — CLI

The `@farming-labs/docs` CLI scaffolds, upgrades, syncs external search indexes, and can run the built-in MCP server for documentation projects. Use this skill when the user asks about CLI commands, init, upgrade, search sync, mcp, or scaffolding.

---

## Init (add docs or bootstrap project)

**Run without flags:** From the project root, run init. The CLI first asks: **Are you adding docs to an existing project or starting fresh?**

```bash
# npm
npx @farming-labs/docs@latest init

# pnpm
pnpm dlx @farming-labs/docs@latest init

# yarn
yarn dlx @farming-labs/docs@latest init

# bun
bunx @farming-labs/docs@latest init
```

- **Existing project** — Add docs to the current directory. CLI then detects framework (or prompts), asks for theme (including **Create your own theme**, which prompts for theme name and scaffolds `themes/<name>.ts` and `themes/<name>.css`), entry path (default `docs`), optional i18n scaffolding, path aliases, and global CSS. TanStack Start follows the same flow, but the CLI currently skips the built-in i18n scaffold there so the generated routes stay minimal and working. **Prompts that show a placeholder use it as the default** — press **Enter** to accept (e.g. entry path `docs`, theme name `my-theme`, project name `my-docs`).
- **Fresh project** — Bootstrap a new app. CLI asks for framework (Next.js, Nuxt, SvelteKit, Astro, TanStack Start), then project name (default `my-docs`; press Enter to accept), creates the folder, clones the template with degit, and runs install using the package manager you chose. You then `cd <name>` and run the matching dev command for that package manager.

If you use **`--template`** with **`--name`**, the CLI skips the existing-vs-fresh prompt and goes straight to bootstrap (same as choosing Fresh and then framework + name).

**Bootstrap without prompts (non-interactive):**

```bash
npx @farming-labs/docs@latest init --template next --name my-docs
npx @farming-labs/docs@latest init --template tanstack-start --name my-docs
npx @farming-labs/docs@latest init --template nuxt --name my-docs
npx @farming-labs/docs@latest init --template sveltekit --name my-docs
npx @farming-labs/docs@latest init --template astro --name my-docs
```

Replace `my-docs` with the desired folder name. Same pattern with `pnpm dlx`, `yarn dlx`, or `bunx`.

---

## Init flags

| Flag | Description |
| ---- | ----------- |
| `--template <name>` | Bootstrap a project: `next`, `tanstack-start`, `nuxt`, `sveltekit`, `astro`. Use with `--name`. Skips the existing-vs-fresh prompt. |
| `--name <project>` | Project folder name when using `--template` (e.g. `my-docs`). If omitted with `--template`, CLI prompts (default `my-docs`). |
| `--theme <name>` | Skip theme prompt. Values: e.g. `fumadocs`, `greentree`, `pixel-border`, `darksharp`, `colorful`, `darkbold`, `shiny`, `concrete`, `command-grid`, `hardline`. |
| `--entry <path>` | Skip entry path prompt. Default is `docs`. |
| `--api-reference` | Enable API reference scaffold during `init`. |
| `--no-api-reference` | Explicitly skip the API reference scaffold. |
| `--api-route-root <path>` | Override the detected API route root written to `apiReference.routeRoot` (e.g. `api`, `internal-api`). |

Example (non-interactive bootstrap with theme):

```bash
npx @farming-labs/docs@latest init --template next --name my-docs --theme pixel-border
```

Example (existing project with API reference):

```bash
npx @farming-labs/docs@latest init --theme greentree --entry docs --api-reference --api-route-root internal-api
```

---

## Upgrade

Upgrade all `@farming-labs/*` docs packages to the latest version. Run from the **project root**. The CLI auto-detects the framework from `package.json` and upgrades the correct packages.

For the package manager, the CLI first checks lockfiles in the current directory (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, `package-lock.json`). If no lockfile is found, it prompts the user to choose instead of defaulting to npm.

```bash
# npm
npx @farming-labs/docs@latest upgrade

# pnpm
pnpm dlx @farming-labs/docs@latest upgrade

# yarn
yarn dlx @farming-labs/docs@latest upgrade

# bun
bunx @farming-labs/docs@latest upgrade
```

| Framework | Packages upgraded |
| --------- | ----------------- |
| Next.js | `@farming-labs/docs`, `@farming-labs/theme`, `@farming-labs/next` |
| TanStack Start | `@farming-labs/docs`, `@farming-labs/theme`, `@farming-labs/tanstack-start` |
| Nuxt | `@farming-labs/docs`, `@farming-labs/nuxt`, `@farming-labs/nuxt-theme` |
| SvelteKit | `@farming-labs/docs`, `@farming-labs/svelte`, `@farming-labs/svelte-theme` |
| Astro | `@farming-labs/docs`, `@farming-labs/astro`, `@farming-labs/astro-theme` |

---

## Upgrade flags

**Explicit framework** (e.g. in a monorepo or when auto-detect fails):

```bash
npx @farming-labs/docs@latest upgrade --framework tanstack-start
# or
npx @farming-labs/docs@latest upgrade tanstack-start
```

Valid values: `next`, `tanstack-start`, `nuxt`, `sveltekit`, `astro`.

**Version channel:**

```bash
npx @farming-labs/docs@latest upgrade              # latest stable (default)
npx @farming-labs/docs@latest upgrade --latest     # same
npx @farming-labs/docs@latest upgrade --beta       # beta versions
npx @farming-labs/docs@latest upgrade@beta         # shorthand for --beta
npx @farming-labs/docs@latest upgrade@latest       # shorthand for --latest
```

If someone uses `pnpx @farming-labs/docs upgrade@beta`, treat it as the supported shorthand for upgrading to the latest beta dist-tag.

---

## MCP

Run the built-in docs MCP server over stdio from the current project:

```bash
# npm / pnpx
pnpx @farming-labs/docs mcp

# pnpm
pnpm exec docs mcp
```

By default the command reads `docs.config.ts[x]` from the project root and reuses the configured
`entry` and `contentDir`.

Use a custom config path when the file lives elsewhere:

```bash
pnpm exec docs mcp --config src/lib/docs.config.ts
```

The built-in MCP surface currently includes:

- `list_pages`
- `get_navigation`
- `search_docs`
- `read_page`

Use the docs config `mcp` block when you also want the HTTP route version at `/mcp` or `/.well-known/mcp`.

## Search Sync

Use `search sync` when you want to push docs content into Typesense or Algolia from the CLI instead
of waiting for the first search request to trigger indexing.

```bash
pnpm dlx @farming-labs/docs search sync --typesense
```

```bash
pnpm dlx @farming-labs/docs search sync --algolia
```

The command:

- reads `.env` / `.env.local` from the current project
- scans docs content using `entry` / `contentDir` from `docs.config`
- uploads normalized search documents to the selected backend
- also supports the generic form `pnpm dlx @farming-labs/docs search sync --provider typesense`
  or `--provider algolia`

Typesense env:

```bash
TYPESENSE_URL=https://your-cluster.a1.typesense.net
TYPESENSE_API_KEY=your-admin-capable-key
```

Optional:

```bash
TYPESENSE_COLLECTION=docs
TYPESENSE_MODE=hybrid
TYPESENSE_OLLAMA_MODEL=embeddinggemma
TYPESENSE_OLLAMA_BASE_URL=http://127.0.0.1:11434
```

Algolia env:

```bash
ALGOLIA_APP_ID=your-app-id
ALGOLIA_ADMIN_API_KEY=your-admin-key
ALGOLIA_SEARCH_API_KEY=your-search-key
```

For a working repo example, the Next example can switch between MCP, Typesense, and Algolia:

```bash
pnpm --dir examples/next dev
```

Useful checks:

```bash
pnpm --dir examples/next exec docs search sync --typesense --config docs.config.tsx
pnpm --dir examples/next exec docs search sync --algolia --config docs.config.tsx
```

Then verify:

- MCP: `http://127.0.0.1:3000/mcp` or `http://127.0.0.1:3000/.well-known/mcp`
- Search: `http://127.0.0.1:3000/api/docs?query=session`

---

## What init does (Existing project, per framework)

When the user chooses **Existing project**, the CLI detects (or prompts for) framework, then theme (including **Create your own theme** → prompts for theme name, scaffolds `themes/<name>.ts` and `themes/<name>.css`), path aliases, entry path (default `docs`; Enter to accept), optional API reference scaffold, optional i18n scaffolding, and global CSS. If API reference is enabled and the user does not pass `--api-route-root`, the CLI detects a sensible default route root (usually `api`) and shows it as the default in the prompt. Generated files:

- **Next.js:** `docs.config.ts`, `next.config.ts`, `app/global.css`, `app/layout.tsx`, `app/docs/layout.tsx`, sample MDX pages; installs `@farming-labs/docs`, `@farming-labs/theme`, `@farming-labs/next`; can start dev server. If API reference is enabled, the CLI also writes `app/api-reference/[[...slug]]/route.ts` (or `src/app/...`).
- **TanStack Start:** `docs.config.ts`, `src/lib/docs.server.ts`, `src/lib/docs.functions.ts`, `src/routes/<entry>/index.tsx`, `src/routes/<entry>/$.tsx`, `src/routes/api/docs.ts`, optional `src/routes/api-reference.index.ts` + `src/routes/api-reference.$.ts`, updates `src/routes/__root.tsx`, updates `vite.config.ts`, and wires theme CSS into the selected global stylesheet; installs `@farming-labs/docs`, `@farming-labs/theme`, `@farming-labs/tanstack-start`.
- **SvelteKit:** `src/lib/docs.config.ts`, `src/lib/docs.server.ts`, `src/routes/docs/*`, optional `src/routes/api-reference/+server.ts` + `src/routes/api-reference/[...slug]/+server.ts`, `src/app.css`, `docs/*.md`; installs svelte + svelte-theme packages.
- **Astro:** `src/lib/docs.config.ts`, `src/lib/docs.server.ts`, `src/pages/**`, API route, optional `src/pages/api-reference/index.ts` + `src/pages/api-reference/[...slug].ts`, `docs/*.md`; installs astro + astro-theme packages.
- **Nuxt:** `docs.config.ts`, `nuxt.config.ts`, `server/api/docs.get.ts`, `server/api/docs.post.ts`, `server/api/docs/load.get.ts`, optional `server/routes/api-reference/index.ts` + `server/routes/api-reference/[...slug].ts`, `pages/docs/[...slug].vue`, `docs/*.md`; installs nuxt + nuxt-theme packages.

**Create your own theme:** If the user selects this, the CLI prompts for a theme name (default `my-theme`; Enter to accept), then creates `themes/<name>.ts` and `themes/<name>.css` and wires them in `docs.config` and global CSS. See the `creating-themes` skill for the API.

**Optional i18n scaffold:** On existing projects, the CLI can scaffold query-param locale support. It asks whether to enable i18n, lets the user multi-select common languages like `en`, `fr`, `es`, `de`, `pt`, `ja`, `ko`, `zh`, `ar`, `hi`, and `ru`, accepts extra locale codes like `pt-BR`, and then asks for the default locale. It writes the `i18n` block to `docs.config`, generates locale folders such as `docs/en` and `docs/fr`, and scaffolds the extra wrapper/root files needed by each framework.

---

## Edge cases

1. **Monorepo** — Run `init` from the app package root (where `package.json` with the framework dependency lives). For `upgrade`, use `--framework` if auto-detect picks the wrong one.
2. **No package.json / wrong directory** — Init and upgrade must run in a directory that has (or will have) a `package.json` with the framework dependency.
3. **Beta** — Use `upgrade --beta` to get beta versions of the docs packages.
4. **TanStack Start local package development** — In this repo's examples and other monorepos, prefer local links such as `workspace:*` for `@farming-labs/docs`, `@farming-labs/theme`, and `@farming-labs/tanstack-start` while testing unpublished changes. On Node 22 / Vercel, this prevents the adapter Vite entry from resolving to raw TypeScript inside `node_modules`.

---

## Resources

- **Full CLI docs:** [docs.farming-labs.dev/docs/cli](https://docs.farming-labs.dev/docs/cli)
- **Getting started:** use the `getting-started` skill in this repo for install and theme CSS.

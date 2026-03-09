---
name: cli
description: @farming-labs/docs CLI — scaffold and upgrade docs. Use when running init, upgrade, or using flags like --template, --name, --theme, --entry, --framework, --latest, --beta. Covers npm, pnpm, yarn, bun commands and framework detection.
---

# @farming-labs/docs — CLI

The `@farming-labs/docs` CLI scaffolds and upgrades documentation projects. Use this skill when the user asks about CLI commands, init, upgrade, or scaffolding.

---

## Init (add docs or bootstrap project)

**Add docs to an existing app:** Run from the project root. The CLI detects the framework from `package.json` (next, @sveltejs/kit, astro, nuxt) and scaffolds config, routes, CSS, and sample pages.

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

If the CLI cannot auto-detect the framework, it will prompt you to choose one.

**Bootstrap a new project from scratch:** Use `--template` and `--name`. The CLI creates the project folder, installs dependencies, and can start the dev server.

```bash
npx @farming-labs/docs@latest init --template next --name my-docs
npx @farming-labs/docs@latest init --template nuxt --name my-docs
npx @farming-labs/docs@latest init --template sveltekit --name my-docs
npx @farming-labs/docs@latest init --template astro --name my-docs
```

Replace `my-docs` with the desired folder name. Same pattern with `pnpm dlx`, `yarn dlx`, or `bunx`.

---

## Init flags

| Flag | Description |
| ---- | ----------- |
| `--template <name>` | Bootstrap a project: `next`, `nuxt`, `sveltekit`, `astro`. Use with `--name`. |
| `--name <project>` | Project folder name when using `--template` (e.g. `my-docs`). |
| `--theme <name>` | Skip theme prompt. Values: e.g. `fumadocs`, `greentree`, `pixel-border`, `darksharp`, `colorful`, `darkbold`, `shiny`. |
| `--entry <path>` | Skip entry path prompt. Default is `docs`. |

Example (non-interactive bootstrap with theme):

```bash
npx @farming-labs/docs@latest init --template next --name my-docs --theme pixel-border
```

---

## Upgrade

Upgrade all `@farming-labs/*` docs packages to the latest version. Run from the **project root**. The CLI auto-detects the framework from `package.json` and upgrades the correct packages.

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
| Nuxt | `@farming-labs/docs`, `@farming-labs/nuxt`, `@farming-labs/nuxt-theme` |
| SvelteKit | `@farming-labs/docs`, `@farming-labs/svelte`, `@farming-labs/svelte-theme` |
| Astro | `@farming-labs/docs`, `@farming-labs/astro`, `@farming-labs/astro-theme` |

---

## Upgrade flags

**Explicit framework** (e.g. in a monorepo or when auto-detect fails):

```bash
npx @farming-labs/docs@latest upgrade --framework astro
# or
npx @farming-labs/docs@latest upgrade astro
```

Valid values: `next`, `nuxt`, `sveltekit`, `astro`.

**Version channel:**

```bash
npx @farming-labs/docs@latest upgrade              # latest stable (default)
npx @farming-labs/docs@latest upgrade --latest     # same
npx @farming-labs/docs@latest upgrade --beta       # beta versions
```

---

## What init does (per framework)

- **Next.js:** Detects `next` in dependencies; generates `docs.config.ts`, `next.config.ts`, `app/global.css`, `app/layout.tsx`, `app/docs/layout.tsx`, sample MDX pages; installs `@farming-labs/docs`, `@farming-labs/theme`, `@farming-labs/next`; can start dev server.
- **SvelteKit:** Detects `@sveltejs/kit`; generates `src/lib/docs.config.ts`, `src/lib/docs.server.ts`, `src/routes/docs/*`, `src/app.css`, `docs/*.md`; installs svelte + svelte-theme packages.
- **Astro:** Detects `astro`; generates `src/lib/docs.config.ts`, `src/lib/docs.server.ts`, `src/pages/**`, API route, `docs/*.md`; installs astro + astro-theme packages.
- **Nuxt:** Detects `nuxt`; generates `docs.config.ts`, `nuxt.config.ts`, `server/api/docs.ts`, `pages/docs/[...slug].vue`, `docs/*.md`; installs nuxt + nuxt-theme packages.

---

## Edge cases

1. **Monorepo** — Run `init` from the app package root (where `package.json` with the framework dependency lives). For `upgrade`, use `--framework` if auto-detect picks the wrong one.
2. **No package.json / wrong directory** — Init and upgrade must run in a directory that has (or will have) a `package.json` with the framework dependency.
3. **Beta** — Use `upgrade --beta` to get beta versions of the docs packages.

---

## Resources

- **Full CLI docs:** [docs.farming-labs.dev/docs/cli](https://docs.farming-labs.dev/docs/cli)
- **Getting started:** use the `getting-started` skill in this repo for install and theme CSS.

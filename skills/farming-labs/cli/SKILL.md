---
name: cli
description: @farming-labs/docs CLI — scaffold and upgrade docs. Use when running init, upgrade, or using flags like --template, --name, --theme, --entry, --framework, --latest, --beta. Covers init flow (existing vs fresh), Create your own theme, optional defaults (Enter to accept), npm/pnpm/yarn/bun, and framework detection.
---

# @farming-labs/docs — CLI

The `@farming-labs/docs` CLI scaffolds and upgrades documentation projects. Use this skill when the user asks about CLI commands, init, upgrade, or scaffolding.

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

- **Existing project** — Add docs to the current directory. CLI then detects framework (or prompts), asks for theme (including **Create your own theme**, which prompts for theme name and scaffolds `themes/<name>.ts` and `themes/<name>.css`), entry path (default `docs`), path aliases, and global CSS. **Prompts that show a placeholder use it as the default** — press **Enter** to accept (e.g. entry path `docs`, theme name `my-theme`, project name `my-docs`).
- **Fresh project** — Bootstrap a new app. CLI asks for framework (Next.js, Nuxt, SvelteKit, Astro), then project name (default `my-docs`; press Enter to accept), creates the folder, clones the template with degit, and runs install. You then `cd <name> && pnpm dev` (or npm/yarn/bun equivalent).

If you use **`--template`** with **`--name`**, the CLI skips the existing-vs-fresh prompt and goes straight to bootstrap (same as choosing Fresh and then framework + name).

**Bootstrap without prompts (non-interactive):**

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
| `--template <name>` | Bootstrap a project: `next`, `nuxt`, `sveltekit`, `astro`. Use with `--name`. Skips the existing-vs-fresh prompt. |
| `--name <project>` | Project folder name when using `--template` (e.g. `my-docs`). If omitted with `--template`, CLI prompts (default `my-docs`). |
| `--theme <name>` | Skip theme prompt. Values: e.g. `fumadocs`, `greentree`, `pixel-border`, `darksharp`, `colorful`, `darkbold`, `shiny`. |
| `--entry <path>` | Skip entry path prompt. Default is `docs`. |

Example (non-interactive bootstrap with theme):

```bash
npx @farming-labs/docs@latest init --template next --name my-docs --theme pixel-border
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

## What init does (Existing project, per framework)

When the user chooses **Existing project**, the CLI detects (or prompts for) framework, then theme (including **Create your own theme** → prompts for theme name, scaffolds `themes/<name>.ts` and `themes/<name>.css`), entry path (default `docs`; Enter to accept), path aliases, and global CSS. Generated files:

- **Next.js:** `docs.config.ts`, `next.config.ts`, `app/global.css`, `app/layout.tsx`, `app/docs/layout.tsx`, sample MDX pages; installs `@farming-labs/docs`, `@farming-labs/theme`, `@farming-labs/next`; can start dev server.
- **SvelteKit:** `src/lib/docs.config.ts`, `src/lib/docs.server.ts`, `src/routes/docs/*`, `src/app.css`, `docs/*.md`; installs svelte + svelte-theme packages.
- **Astro:** `src/lib/docs.config.ts`, `src/lib/docs.server.ts`, `src/pages/**`, API route, `docs/*.md`; installs astro + astro-theme packages.
- **Nuxt:** `docs.config.ts`, `nuxt.config.ts`, `server/api/docs.ts`, `pages/docs/[...slug].vue`, `docs/*.md`; installs nuxt + nuxt-theme packages.

**Create your own theme:** If the user selects this, the CLI prompts for a theme name (default `my-theme`; Enter to accept), then creates `themes/<name>.ts` and `themes/<name>.css` and wires them in `docs.config` and global CSS. See the `creating-themes` skill for the API.

---

## Edge cases

1. **Monorepo** — Run `init` from the app package root (where `package.json` with the framework dependency lives). For `upgrade`, use `--framework` if auto-detect picks the wrong one.
2. **No package.json / wrong directory** — Init and upgrade must run in a directory that has (or will have) a `package.json` with the framework dependency.
3. **Beta** — Use `upgrade --beta` to get beta versions of the docs packages.

---

## Resources

- **Full CLI docs:** [docs.farming-labs.dev/docs/cli](https://docs.farming-labs.dev/docs/cli)
- **Getting started:** use the `getting-started` skill in this repo for install and theme CSS.

---
name: getting-started
description: Get started with @farming-labs/docs — MDX-based documentation for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt. Use when setting up docs, scaffolding with the CLI, choosing themes, changelog, API reference, or writing docs.config. Covers init, manual setup per framework, theme CSS, defineDocs, changelog, apiReference, entry, contentDir, and common gotchas.
---

# @farming-labs/docs — Getting Started

**Always consult the project docs (and `/docs` routes when available) for the latest API and examples.**

@farming-labs/docs is a modern, flexible MDX-based documentation framework. Write markdown, get a polished docs site. Supported frameworks: **Next.js**, **TanStack Start**, **SvelteKit**, **Astro**, **Nuxt**.

---

## Quick reference

### CLI (see also the `cli` skill)

| Scenario | Command |
| -------- | ------- |
| Interactive init (existing or fresh) | `npx @farming-labs/docs@latest init` — first asks **Existing project** or **Fresh project**; then theme (or Create your own theme), entry path, etc. Prompts with a placeholder (e.g. `docs`, `my-docs`) accept **Enter** as default. |
| Add docs to existing app | Run `init` in project root; choose **Existing project** when prompted. |
| Start from scratch (bootstrap, no prompts) | `npx @farming-labs/docs@latest init --template <next \| tanstack-start \| nuxt \| sveltekit \| astro> --name <project-name>` |
| Add generated API reference during init | `npx @farming-labs/docs@latest init --api-reference` (optional `--api-route-root <path>`) |
| Upgrade docs packages | `npx @farming-labs/docs@latest upgrade` — auto-detects `next`, `tanstack-start`, `nuxt`, `sveltekit`, or `astro`; use `--framework` if detection is ambiguous. |

### Packages by framework

| Framework | Core + adapter | Theme package |
| --------- | -------------- | -------------- |
| Next.js | `@farming-labs/docs`, `@farming-labs/next` | `@farming-labs/theme` |
| TanStack Start | `@farming-labs/docs`, `@farming-labs/tanstack-start` | `@farming-labs/theme` |
| SvelteKit | `@farming-labs/docs`, `@farming-labs/svelte` | `@farming-labs/svelte-theme` |
| Astro | `@farming-labs/docs`, `@farming-labs/astro` | `@farming-labs/astro-theme` |
| Nuxt | `@farming-labs/docs`, `@farming-labs/nuxt` | `@farming-labs/nuxt-theme` |

### Built-in themes

Ten built-in theme entrypoints: `fumadocs` (default), `darksharp`, `pixel-border`, `colorful`, `greentree`, `darkbold`, `shiny`, `concrete`, `command-grid`, and `hardline`. `hardline` is the existing hard-edge preset, `concrete` is the louder brutalist poster-style variant, and `command-grid` is the mono-first paper-grid preset inspired by the better-cmdk landing page. The init CLI offers **Create your own theme** — it prompts for a theme name (default `my-theme`) and scaffolds `themes/<name>.ts` and `themes/<name>.css`. The theme name in config must match the theme's CSS import path (e.g. `greentree` → `@farming-labs/theme/greentree/css` for Next.js).

### Built-in UI features

- **MDX components** — built-ins like `Callout`, `Tabs`, and `HoverLink` are available without imports.
- **Page feedback** — enable with `feedback: true` or `feedback: { enabled: true, onFeedback() {} }`.
- **Page actions** — enable with `pageActions.copyMarkdown` and `pageActions.openDocs`.
- **Built-in changelog pages (Next.js)** — enable `changelog` to publish a release feed from dated MDX entries.
- **Built-in MCP server** — enabled by default at `/api/docs/mcp` and for local stdio tools. Opt out with `mcp: false` or `mcp: { enabled: false }`.
- **Machine-readable markdown routes** — Next.js serves `/docs/<slug>.md` automatically with `withDocs()`. Use embedded `<Agent>...</Agent>` blocks inside `page.mdx` when the normal page only needs extra machine context; add a sibling `agent.md` when the whole machine-readable page should be overridden. The shared docs API also supports `GET /api/docs?format=markdown&path=<slug>`.

### MCP quick test

To verify the HTTP MCP route in this repo, use the Next example:

```bash
pnpm --dir examples/next dev
```

Then point your MCP client or inspector at `http://127.0.0.1:3000/api/docs/mcp`.

---

## Critical: theme CSS

**Every setup must import the theme's CSS** in the global stylesheet. Without it, docs pages will not be styled.

- **Next.js:** `app/global.css` → `@import "@farming-labs/theme/<theme>/css";` (e.g. `default`, `greentree`, `pixel-border`).
- **TanStack Start:** `src/styles/app.css` (or your main global CSS file) → `@import "@farming-labs/theme/<theme>/css";`
- **SvelteKit:** `src/app.css` → `@import "@farming-labs/svelte-theme/<theme>/css";`
- **Astro:** Import in the docs layout or page file: `import "@farming-labs/astro-theme/<theme>/css";`
- **Nuxt:** `nuxt.config.ts` → `css: ["@farming-labs/nuxt-theme/<theme>/css"]`

Use the same theme name in `docs.config` and in the CSS import.

---

## Core config: defineDocs

All frameworks use a single config file (`docs.config.ts` or `docs.config.tsx`):

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme"; // or svelte-theme, astro-theme, nuxt-theme

export default defineDocs({
  entry: "docs",
  contentDir: "docs", // SvelteKit, Astro, Nuxt
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – Docs",
    description: "My documentation site",
  },
});
```

- **Next.js:** `docs.config.ts` at project root; wrap Next config with `withDocs()` from `@farming-labs/next/config`. Content lives under `app/docs/` (path derived from `entry`).
- **TanStack Start:** `docs.config.ts` or `docs.config.tsx` at project root; set `contentDir` and `nav`, create `/api/docs`, and load content from your `docs/` directory via `@farming-labs/tanstack-start/server`.
- **SvelteKit:** `src/lib/docs.config.ts`; routes under `src/routes/docs/`; set `contentDir` to the folder containing your markdown (e.g. `docs`).
- **Astro:** `src/lib/docs.config.ts`; pages under `src/pages/<entry>/`; set `contentDir`.
- **Nuxt:** `docs.config.ts` at project root; `server/api/docs.ts` and `pages/docs/[...slug].vue`; set `contentDir` and `nav`.

TanStack Start, SvelteKit, Astro, and Nuxt require `contentDir` (path to markdown files) and `nav` (sidebar title and base URL).

---

## API reference quick setup

`apiReference` generates an API reference from your framework's route handlers or from a hosted
OpenAPI JSON document.

```ts
export default defineDocs({
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    routeRoot: "api",
  },
  theme: fumadocs(),
});
```

Important framework behavior:

- **Next.js**: `withDocs()` auto-generates the `/{path}` route when `apiReference` is enabled.
- **TanStack Start, SvelteKit, Astro, Nuxt**: `docs.config` controls scanning and theming, but the app still needs the `/{path}` route handler.
- **CLI**: `init --api-reference` writes the config and scaffolds those handler files for you.

Remote OpenAPI JSON example:

```ts
export default defineDocs({
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    specUrl: "https://petstore3.swagger.io/api/v3/openapi.json",
  },
  theme: fumadocs(),
});
```

When `specUrl` is set, local route scanning is skipped. On TanStack Start, SvelteKit, Astro, and
Nuxt you still need the `/{path}` route handler because that route serves the generated API
reference page.

Minimal handler files for non-Next frameworks:

- **TanStack Start**: `src/routes/api-reference.index.ts` and `src/routes/api-reference.$.ts` using `createTanstackApiReference(config)`
- **SvelteKit**: `src/routes/api-reference/+server.ts` and `src/routes/api-reference/[...slug]/+server.ts` using `createSvelteApiReference(config)`
- **Astro**: `src/pages/api-reference/index.ts` and `src/pages/api-reference/[...slug].ts` using `createAstroApiReference(config)`
- **Nuxt**: `server/routes/api-reference/index.ts` and `server/routes/api-reference/[...slug].ts` using `defineApiReferenceHandler(config)`

Route scan conventions:

- **Next.js**: `app/api/**/route.ts` or `src/app/api/**/route.ts`
- **TanStack Start**: `src/routes/api.*.ts` and nested route files under the configured route root
- **SvelteKit**: `src/routes/api/**/+server.ts` or `+server.js`
- **Astro**: `src/pages/api/**/*.ts` or `.js`
- **Nuxt**: `server/api/**/*.ts` or `.js`

For the full option surface (`path`, `specUrl`, `routeRoot`, `exclude`), use the
`configuration` skill.

---

## Changelog quick setup

Today, the turn-key generated changelog route flow is available in **Next.js** with
`@farming-labs/next/config`.

```ts
export default defineDocs({
  entry: "docs",
  changelog: {
    enabled: true,
    path: "changelogs",
    contentDir: "changelog",
    title: "Changelog",
    description: "Latest product updates and release notes.",
    search: true,
  },
  theme: fumadocs(),
});
```

Default content structure:

```text
app/docs/changelog/
  2026-04-15/page.mdx
  2026-04-03/page.mdx
```

That publishes:

- `/docs/changelogs`
- `/docs/changelogs/2026-04-15`

Use entry frontmatter like:

```mdx
---
title: "OpenAPI mode is now the default"
description: "The docs example now ships with the faster API reference experience."
version: "v0.1.13"
tags: ["api-reference", "next"]
---
```

When you use `withDocs()`, the route files are generated automatically. There is no separate
`__changelog.generated.tsx` file to maintain.

---

## Doc content and frontmatter

Docs live under the `entry` directory (e.g. `docs/` or `app/docs/`). Each page is MDX or Markdown with frontmatter:

```mdx
---
title: "Installation"
description: "Get up and running"
icon: "rocket"
order: 1
---

# Installation

Content here.
```

Routing is file-based: `docs/getting-started/page.mdx` → `/docs/getting-started`. Use `order` in frontmatter to control sidebar order (numeric ordering).

---

## Path aliases and defaults (CLI)

When running `init` and choosing **Existing project**, the CLI asks about path aliases (Next: `@/`, SvelteKit: `$lib/`, Nuxt: `~/` vs relative paths). If the user chooses "no alias", generated code uses relative paths to `docs.config`, and `tsconfig` may omit the `paths` block.

**Optional defaults:** Prompts that show a placeholder (entry path `docs`, theme name `my-theme`, project name `my-docs`, global CSS path) use that value as the default — the user can press **Enter** to accept without typing.

---

## Static export

For fully static builds (e.g. Cloudflare Pages, no server), set `staticExport: true` in `defineDocs()`. This hides search and AI chat in the layout. Omit or do not deploy the docs API route so no server is required.

---

## Common gotchas

1. **Theme CSS missing** — Docs look unstyled until the theme CSS is imported in the global stylesheet (or Nuxt `css`).
2. **Wrong theme package** — Use the theme package for the same framework (e.g. `@farming-labs/svelte-theme` for SvelteKit, not `@farming-labs/theme`).
3. **From scratch** — Use `init --template <next|tanstack-start|nuxt|sveltekit|astro> --name <project>`; the CLI bootstraps a project with that name and runs install.
4. **Existing project** — Run `init` in the project root; the CLI detects the framework and scaffolds files.
5. **Static hosting** — Set `staticExport: true`; search and AI are then hidden.
6. **API reference on non-Next frameworks** — `apiReference` in `docs.config` is not enough by itself on TanStack Start, SvelteKit, Astro, or Nuxt; add the `/{path}` handler manually or let `init --api-reference` scaffold it, even when you use a remote `specUrl`.
7. **Changelog generation today** — The built-in generated changelog pages are currently wired in Next.js. Use the Next adapter if you want the turn-key `/docs/changelogs` flow.
8. **TanStack Start in a monorepo** — If the app and docs packages live in the same workspace, keep `@farming-labs/docs`, `@farming-labs/theme`, and `@farming-labs/tanstack-start` linked locally (for example `workspace:*`). This avoids Node 22 / Vercel loading raw adapter TypeScript from `node_modules`.

---

## Resources

- **Repo:** [github.com/farming-labs/docs](https://github.com/farming-labs/docs)
- **Docs site:** [docs.farming-labs.dev](https://docs.farming-labs.dev) (or the project's `/docs` route)
- **Other skills in this repo:** `cli`, `creating-themes`, `ask-ai`, `page-actions`, `configuration` under `skills/farming-labs/`.

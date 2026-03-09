---
name: getting-started
description: Get started with @farming-labs/docs — MDX-based documentation for Next.js, SvelteKit, Astro, and Nuxt. Use when setting up docs, scaffolding with the CLI, choosing themes, or writing docs.config. Covers init, manual setup per framework, theme CSS, defineDocs, entry, contentDir, and common gotchas.
---

# @farming-labs/docs — Getting Started

**Always consult the project docs (and `/docs` routes when available) for the latest API and examples.**

@farming-labs/docs is a modern, flexible MDX-based documentation framework. Write markdown, get a polished docs site. Supported frameworks: **Next.js**, **SvelteKit**, **Astro**, **Nuxt**.

---

## Quick reference

### CLI (see also the `cli` skill)

| Scenario | Command |
| -------- | ------- |
| Add docs to existing app | `npx @farming-labs/docs@latest init` |
| Start from scratch (bootstrap project) | `npx @farming-labs/docs@latest init --template <next \| nuxt \| sveltekit \| astro> --name <project-name>` |

### Packages by framework

| Framework | Core + adapter | Theme package |
| --------- | -------------- | -------------- |
| Next.js | `@farming-labs/docs`, `@farming-labs/next` | `@farming-labs/theme` |
| SvelteKit | `@farming-labs/docs`, `@farming-labs/svelte` | `@farming-labs/svelte-theme` |
| Astro | `@farming-labs/docs`, `@farming-labs/astro` | `@farming-labs/astro-theme` |
| Nuxt | `@farming-labs/docs`, `@farming-labs/nuxt` | `@farming-labs/nuxt-theme` |

### Built-in themes

Seven built-in themes: `fumadocs` (default), `darksharp`, `pixel-border`, `colorful`, `greentree`, `darkbold`, `shiny`. The theme name in config must match the theme's CSS import path (e.g. `greentree` → `@farming-labs/theme/greentree/css` for Next.js).

---

## Critical: theme CSS

**Every setup must import the theme's CSS** in the global stylesheet. Without it, docs pages will not be styled.

- **Next.js:** `app/global.css` → `@import "@farming-labs/theme/<theme>/css";` (e.g. `default`, `greentree`, `pixel-border`).
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
- **SvelteKit:** `src/lib/docs.config.ts`; routes under `src/routes/docs/`; set `contentDir` to the folder containing your markdown (e.g. `docs`).
- **Astro:** `src/lib/docs.config.ts`; pages under `src/pages/<entry>/`; set `contentDir`.
- **Nuxt:** `docs.config.ts` at project root; `server/api/docs.ts` and `pages/docs/[...slug].vue`; set `contentDir` and `nav`.

SvelteKit, Astro, and Nuxt require `contentDir` (path to markdown files) and `nav` (sidebar title and base URL).

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

## Path aliases (CLI)

When running `init`, the CLI may ask about path aliases:

- **Next.js:** `@/` (e.g. `@/docs.config`) vs relative paths.
- **SvelteKit:** `$lib/` vs relative.
- **Nuxt:** `~/` vs relative.

If the user chooses "no alias", generated code uses relative paths to `docs.config`, and `tsconfig` may omit the `paths` block.

---

## Static export

For fully static builds (e.g. Cloudflare Pages, no server), set `staticExport: true` in `defineDocs()`. This hides search and AI chat in the layout. Omit or do not deploy the docs API route so no server is required.

---

## Common gotchas

1. **Theme CSS missing** — Docs look unstyled until the theme CSS is imported in the global stylesheet (or Nuxt `css`).
2. **Wrong theme package** — Use the theme package for the same framework (e.g. `@farming-labs/svelte-theme` for SvelteKit, not `@farming-labs/theme`).
3. **From scratch** — Use `init --template <next|nuxt|sveltekit|astro> --name <project>`; the CLI bootstraps a project with that name and runs install.
4. **Existing project** — Run `init` in the project root; the CLI detects the framework and scaffolds files.
5. **Static hosting** — Set `staticExport: true`; search and AI are then hidden.

---

## Resources

- **Repo:** [github.com/farming-labs/docs](https://github.com/farming-labs/docs)
- **Docs site:** [docs.farming-labs.dev](https://docs.farming-labs.dev) (or the project's `/docs` route)
- **Other skills in this repo:** `cli`, `creating-themes`, `ask-ai`, `page-actions`, `configuration` under `skills/farming-labs/`.

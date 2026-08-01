---
name: getting-started
description: Get started with @farming-labs/docs — MDX-based documentation for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt. Use when setting up docs, scaffolding with the CLI, choosing themes, changelog, API reference, or writing docs.config. Covers init, manual setup per framework, theme CSS, defineDocs, changelog, apiReference, entry, contentDir, and common gotchas.
compatibility: Requires Node.js and npm, pnpm, Yarn, or Bun. Setup targets a supported Next.js, TanStack Start, SvelteKit, Astro, or Nuxt project; scaffolding and package installation require network access.
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

Install only the Farming Labs package set for the chosen framework. Do not ask users to install
Fumadocs or Scalar packages directly; API reference renderers are bundled by `@farming-labs/docs`
and the framework adapters.

### Built-in themes

Eleven built-in theme entrypoints: `fumadocs` (default), `darksharp`, `pixel-border`, `colorful`, `greentree`, `darkbold`, `shiny`, `ledger`, `concrete`, `command-grid`, and `hardline`. `hardline` is the existing hard-edge preset, `concrete` is the louder brutalist poster-style variant, `command-grid` is the mono-first paper-grid preset inspired by the better-cmdk landing page, and `ledger` is a Stripe Docs-inspired product docs shell. The init CLI offers **Create your own theme** — it prompts for a theme name (default `my-theme`) and scaffolds `themes/<name>.ts` and `themes/<name>.css`. The theme name in config must match the theme's CSS import path (e.g. `greentree` → `@farming-labs/theme/greentree/css` for Next.js).

### Built-in UI features

- **MDX components** — built-ins like `Callout`, `Tabs`, `HoverLink`, `Agent`, `Human`, and
  `Audience` are available without imports. Content is shared by default. Use `<Agent>` or
  `<Audience only="agent">` for agent-only context, and `<Human>` or
  `<Audience only="human">` for human-only context. Keep `Audience.only` static and avoid spread
  props; `docs review` reports declarations that static agent outputs cannot resolve consistently.
- **Page feedback** — enable with `feedback: true` or `feedback: { enabled: true, onFeedback() {} }`.
- **Agent discovery** — agents can use the RFC 9727 `/.well-known/api-catalog` linkset and the hashed `/.well-known/agent-skills/index.json` index. The existing `/.well-known/agent.json` manifest remains the preferred Farming Labs document, with `/.well-known/agent` as fallback and `/api/docs/agent/spec` as its canonical framework route. These resources cross-link one another, and dynamic responses expose discovery `Link` headers.
- **Generated AGENTS.md** — `GET /AGENTS.md`, `GET /.well-known/AGENTS.md`, and `GET /api/docs?format=agents` return coding-agent instructions by default. A root `AGENTS.md` or `AGENT.md` overrides the generated fallback; use `docs agents generate` for static exports.
- **Generated robots.txt** — use `docs robots generate` to write a static policy that allows docs routes, `.md` routes, `llms.txt`, sitemaps, `AGENTS.md`, `skill.md`, the API catalog, Agent Skills discovery, MCP aliases, existing agent discovery routes, and common AI crawler user agents. Existing files are preserved by default; use `--append` to add the managed block or `--force` to replace the file.
- **Structured data** — every docs page emits Schema.org `TechArticle` JSON-LD with title, description, canonical URL, freshness, and breadcrumbs. It reuses `sitemap.baseUrl`, `llmsTxt.baseUrl`, `robots.baseUrl`, or `ai.docsUrl`; no separate config flag is required.
- **Agent feedback endpoints** — add `feedback.agent` when agents should report structured `{ context?, payload }` feedback through `/api/docs/agent/feedback` and `/api/docs/agent/feedback/schema`.
- **Page actions** — enable with `pageActions.copyMarkdown` and `pageActions.openDocs`.
- **Built-in changelog pages (Next.js)** — enable `changelog` to publish a release feed from dated MDX entries.
- **Built-in MCP server** — enabled by default at `/mcp` and `/.well-known/mcp`, backed by `/api/docs/mcp`, and for local stdio tools. Next.js wires rewrites with `withDocs()`; TanStack Start/SvelteKit/Astro/Nuxt scaffold one public forwarder each. Opt out with `mcp: false` or `mcp: { enabled: false }`.
- **Machine-readable markdown routes** — `/docs.md` and `/docs/<slug>.md` return agent-ready markdown in Next.js and in the generated TanStack Start, SvelteKit, Astro, and Nuxt forwarding layer. Next.js also returns the same markdown from `/docs/<slug>` when the request sends an unambiguous `Accept: text/markdown`; mixed headers containing an HTML-capable range should use the exact `.md` URL or API format route. Markdown responses start with YAML frontmatter for `title`, optional `description`, `canonical_url`, `markdown_url`, and `last_updated` when a freshness date is known. Use embedded `<Agent>...</Agent>` or `<Audience only="agent">...</Audience>` blocks inside `page.mdx` when the normal page only needs extra machine context. Use `<Human>` or `<Audience only="human">` to keep presentation-only content out of agent context, and add a sibling `agent.md` when the whole machine-readable page should be overridden. The shared docs API also supports `GET /api/docs?format=markdown&path=<slug>`. Page frontmatter `related` appears as a comma-separated machine-readable markdown metadata line beside `Description` unless a sibling `agent.md` fully overrides the page.
- **Audience projection** — rendered HTML and public search use the human projection; Markdown,
  Ask AI, MCP, `llms-full.txt`, and static agent exports use the agent projection. Compact
  `llms.txt` contains discovery links to agent-projected Markdown, and sitemaps contain route
  metadata only. Audience filtering is not authentication, so never place secrets in an audience
  block or `agent.md`.

### MCP quick test

To verify the HTTP MCP route in this repo, use the Next example:

```bash
pnpm --dir examples/next dev
```

Then point your MCP client or inspector at `http://127.0.0.1:3000/mcp` or `http://127.0.0.1:3000/.well-known/mcp`.

---

## Critical: theme CSS

**Every setup must import the theme's CSS** in the global stylesheet. Without it, docs pages will not be styled.

- **Next.js:** `app/global.css` → `@import "@farming-labs/theme/<theme>/css";` (e.g. `default`, `greentree`, `pixel-border`).
- **TanStack Start:** `src/styles/app.css` (or your main global CSS file) → `@import "@farming-labs/theme/<theme>/css";`
- **SvelteKit:** `src/app.css` → `@import "@farming-labs/theme/<theme>/css";`
- **Astro:** Import in the docs layout or page file: `import "@farming-labs/theme/<theme>/css";`
- **Nuxt:** `nuxt.config.ts` → `css: ["@farming-labs/theme/<theme>/css"]`

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

## Optional generated pages

- **API reference:** Read [references/api-reference.md](references/api-reference.md) when enabling
  local route scanning, a hosted OpenAPI document, or non-Next handler routes.
- **Changelog:** Read [references/changelog.md](references/changelog.md) when adding the generated
  Next.js release feed and dated entry pages.

---

## Doc content and frontmatter

Docs live under the `entry` directory (e.g. `docs/` or `app/docs/`). Each page is MDX or Markdown with frontmatter:

```mdx
---
title: "Installation"
description: "Get up and running"
related:
  - /docs/configuration
  - /docs/customization/agent-primitive
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
2. **Wrong theme helper package** — Use the framework theme helper for `docs.config` (e.g. `@farming-labs/svelte-theme` for SvelteKit), while theme CSS imports come from the shared `@farming-labs/theme/<theme>/css` path.
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

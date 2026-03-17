---
name: configuration
description: docs.config.ts options for @farming-labs/docs. Use when configuring entry, contentDir, theme, staticExport, nav, github, themeToggle, breadcrumb, sidebar, icons, components, metadata, og, apiReference, onCopyClick, pageActions, or ai. Covers Next.js, TanStack Start, SvelteKit, Astro, Nuxt config file location.
---

# @farming-labs/docs — Configuration

All configuration lives in a single **docs.config.ts** (or **docs.config.tsx**) file. Use this skill when editing or explaining config options.

**Full docs:** [Configuration](https://docs.farming-labs.dev/docs/configuration), [API Reference](https://docs.farming-labs.dev/docs/reference).

---

## Config file location by framework

| Framework | Config path |
| --------- | ----------- |
| Next.js | Project root: `docs.config.ts` |
| TanStack Start | Project root: `docs.config.ts` or `docs.config.tsx` |
| SvelteKit | `src/lib/docs.config.ts` |
| Astro | `src/lib/docs.config.ts` |
| Nuxt | Project root: `docs.config.ts` |

TanStack Start, SvelteKit, Astro, and Nuxt require `contentDir` (path to markdown files) and `nav` (sidebar title and base URL) in addition to `entry` and `theme`.

---

## Main config options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `entry` | `string` | `"docs"` | URL path prefix for docs (e.g. `"docs"` → `/docs`) |
| `contentDir` | `string` | same as `entry` | Path to content files (TanStack Start, SvelteKit, Astro, Nuxt) |
| `staticExport` | `boolean` | `false` | Set `true` for full static builds; hides search and AI |
| `theme` | `DocsTheme` | — | Theme from a theme factory (e.g. `fumadocs()`, `pixelBorder()`) |
| `nav` | `{ title, url }` | — | Sidebar title and base URL (required for TanStack Start, SvelteKit, Astro, Nuxt) |
| `github` | `string \| GithubConfig` | — | GitHub repo for "Edit on GitHub" and `{githubUrl}` in page actions |
| `themeToggle` | `boolean \| ThemeToggleConfig` | `true` | Light/dark mode toggle |
| `breadcrumb` | `boolean \| BreadcrumbConfig` | `true` | Breadcrumb navigation |
| `sidebar` | `boolean \| SidebarConfig` | `true` | Sidebar visibility and style |
| `icons` | `Record<string, Component>` | — | Icon registry for frontmatter `icon` fields |
| `components` | `Record<string, Component>` | — | Custom MDX components (e.g. `Callout`) |
| `onCopyClick` | `(data: CodeBlockCopyData) => void` | — | Callback when user copies a code block (title, content, url, language) |
| `pageActions` | `PageActionsConfig` | — | Copy Markdown, Open in LLM (see `page-actions` skill) |
| `ai` | `AIConfig` | — | RAG-powered AI chat (see `ask-ai` skill) |
| `apiReference` | `boolean \| ApiReferenceConfig` | `false` | Generated API reference pages from supported framework route conventions |
| `metadata` | `DocsMetadata` | — | SEO: titleTemplate, description, etc. |
| `og` | `OGConfig` | — | Dynamic Open Graph images |

---

## Static export

For fully static builds (e.g. Cloudflare Pages, no server):

```ts
export default defineDocs({
  entry: "docs",
  staticExport: true,
  theme: fumadocs(),
});
```

- Search (Cmd+K) and AI chat are hidden in the layout.
- Next.js: with `output: "export"` in `next.config`, the `/api/docs` route is not generated.
- Do not deploy the docs API route when using static export.

---

## GitHub (Edit on GitHub and openDocs)

```ts
github: {
  url: "https://github.com/owner/repo",
  directory: "website",  // optional: subdirectory where docs content lives
}
```

Enables "Edit on GitHub" links and allows `{githubUrl}` in `pageActions.openDocs.providers`.

---

## API Reference

`apiReference` generates an API reference from framework route conventions.

Current support:
- **Next.js:** `app/api/**/route.ts` and `src/app/api/**/route.ts`
- **TanStack Start:** `src/routes/api.*.ts` and nested route files inside the configured route root
- **SvelteKit:** `src/routes/api/**/+server.ts` or `+server.js`
- **Astro:** `src/pages/api/**/*.ts` or `.js`
- **Nuxt:** `server/api/**/*.ts` or `.js`

```ts
apiReference: {
  enabled: true,
  path: "api-reference",
  routeRoot: "api",
  exclude: ["/api/internal/health", "internal/debug"],
}
```

Notes:
- `path` controls the public URL for the generated reference
- `routeRoot` controls the filesystem route root to scan
- `exclude` accepts either URL-style paths (`"/api/hello"`) or route-root-relative entries (`"hello"` / `"hello/route.ts"`)
- on Next.js static export (`output: "export"`), the generated API reference route is skipped automatically

---

## Theme toggle

```ts
themeToggle: {
  enabled: true,   // show toggle (default)
  default: "light" | "dark" | "system",
}
```

Set `enabled: false` to hide the toggle or force a single mode.

---

## Sidebar and breadcrumb

- **sidebar:** `true` (default) or `SidebarConfig` (style, banner, footer, etc.). See customization docs for banner/footer content.
- **breadcrumb:** `true` (default) or `BreadcrumbConfig` to show/hide or configure breadcrumb.

---

## Metadata and OG

- **metadata:** `titleTemplate`, `description`, `twitterCard`, etc. for SEO.
- **og:** `enabled`, `type` ("dynamic" | "static"), `endpoint` for dynamic OG image generation. See API reference and OG Images docs.

---

## Ordering (sidebar)

Use `ordering: "numeric"` (default) so sidebar order follows frontmatter `order` (numbers). Doc pages can set `order: 1`, `order: 2`, etc. in frontmatter to control order.

---

## Edge cases

1. **Next.js:** Must wrap config with `withDocs()` from `@farming-labs/next/config` in `next.config.ts`.
2. **TanStack Start:** `docs.config.ts` stays at project root; wire it into `createDocsServer()` and keep the theme CSS import in your global stylesheet aligned with the theme name in config.
3. **SvelteKit/Astro:** Server-side docs loader must receive config and (for AI) env vars; see framework docs.
4. **Nuxt:** `defineDocsHandler(config, useStorage)` in `server/api/docs.ts`; config is imported from root `docs.config.ts`.

---

## Resources

- **Configuration docs:** [docs.farming-labs.dev/docs/configuration](https://docs.farming-labs.dev/docs/configuration)
- **API Reference:** [docs.farming-labs.dev/docs/reference](https://docs.farming-labs.dev/docs/reference)
- **Related skills:** `ask-ai`, `page-actions`, `getting-started`, `creating-themes`.

<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:4d985abdc02e6e10
settingsHash=fnv1a64:aa433a28ef4afd1f
outputHash=fnv1a64:173fd105503fea58
generatedAt=2026-08-04T11:40:37.014Z
-->
# API Reference
URL: /docs/reference
LLM index: /llms.txt
Description: Complete reference for all configuration options
Related: /docs/configuration, /docs/cli, /docs/installation, /docs/customization/mcp

Inspect the existing `defineDocs()` call and select the exact exported `DocsConfig` field documented below. Config path: `docs.config.ts[x]` for Next.js, TanStack Start, and Nuxt; `src/lib/docs.config.ts` for SvelteKit and Astro. Non-Next adapters can configure `contentDir` and `nav` explicitly; Next.js derives its content tree from `app/{entry}/`.

When MCP `get_config_schema` publishes the option, compare its type and default; otherwise verify against installed exported types. Run `pnpm exec docs doctor --agent` for resolved capability and discovery fields. For SvelteKit or Astro, append `--config src/lib/docs.config.ts`. If TypeScript rejects the documented shape, align all `@farming-labs/*` package versions and rename config to `.tsx` when it contains JSX. If diagnostics and public discovery disagree, restore the previous value and repair the adapter route or stale static export before re-enabling.

All types exported from `@farming-labs/docs`.

---

## `defineDocs(config)`

```ts title="docs.config.ts"
import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
  // ...all options below
});
```

---

## `DocsConfig`

### `DocsLocalMcpSearchRuntimeConfig`

Runtime shape for whether the local MCP server is the search target. Exported from `@farming-labs/docs` and `@farming-labs/docs/server`.

| Property | Type | Description |
| -------- | ---- | ----------- |
| `enabled` | `boolean` | Whether the local MCP server is enabled |
| `route` | `string` | Canonical HTTP route for the local MCP endpoint (e.g. `"/api/docs/mcp"`) |
| `tools` | `{ searchDocs?: boolean }` | `searchDocs` controls whether `search_docs` is exposed |

### `DocsLocalMcpSearchRuntimeInput`

Accepted input for `resolveLocalDocsMcpSearchConfig`. Partial form of `DocsLocalMcpSearchRuntimeConfig` — all fields optional. Exported from `@farming-labs/docs` and `@farming-labs/docs/server`.

### `DocsSearchRequestResolutionOptions`

Options for the third parameter of `resolveSearchRequestConfig`. Exported from `@farming-labs/docs` and `@farming-labs/docs/server`.

| Property | Type | Description |
| -------- | ---- | ----------- |
| `localMcp` | `DocsLocalMcpSearchRuntimeInput \| null \| undefined` | When present, calls `resolveLocalDocsMcpSearchConfig` before the self-referential URL check |

### `resolveLocalDocsMcpSearchConfig`

Exported from `@farming-labs/docs` and `@farming-labs/docs/server`. Given a `McpDocsSearchConfig`, optional `DocsLocalMcpSearchRuntimeInput`, and optional request URL, returns a modified search config using direct simple search when the configured MCP endpoint resolves to the local server. Returns original config unchanged for external endpoints.

```ts
import { resolveLocalDocsMcpSearchConfig } from "@farming-labs/docs";

const resolved = resolveLocalDocsMcpSearchConfig(
  search,       // McpDocsSearchConfig
  mcp,          // DocsLocalMcpSearchRuntimeInput | null | undefined
  requestUrl,   // string | undefined
);
```

`resolveSearchRequestConfig` accepts an optional third `options: DocsSearchRequestResolutionOptions` argument. Pass `{ localMcp: config.mcp }` to enable local-MCP detection in custom server adapters.

Top-level configuration object passed to `defineDocs()`:

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `entry` | `string` | **required** | Docs source route and folder (e.g. `"docs"` -> `app/docs`) |
| `docsPath` | `string` | same as `entry` | Public docs route prefix in Next.js. Use `""` to serve docs from `/` |
| `contentDir` | `string` | same as `entry` | Path to content files. TanStack Start, SvelteKit, Astro, and Nuxt use it; Next.js uses `app/{entry}/` |
| `staticExport` | `boolean` | `false` | `true` for full static builds; hides search and AI |
| `theme` | `DocsTheme` | — | Theme preset (`fumadocs()`, `darksharp()`, `pixelBorder()`, etc.) |
| `github` | `string \| GithubConfig` | — | GitHub repo config for "Edit on GitHub" links |
| `nav` | `DocsNav` | — | Sidebar header title and URL |
| `themeToggle` | `boolean \| ThemeToggleConfig` | `true` | Light/dark mode toggle |
| `breadcrumb` | `boolean \| BreadcrumbConfig` | `true` | Breadcrumb navigation |
| `sidebar` | `boolean \| SidebarConfig` | `true` | Sidebar visibility and customization |
| `icons` | `Record<string, unknown>` | — | Shared icon registry for frontmatter `icon` fields and built-ins like `Prompt` |
| `components` | `Record<string, unknown>` | — | Custom MDX component overrides including built-ins like `HoverLink` and `Prompt` |
| `analytics` | `boolean \| DocsAnalyticsConfig` | `false` | Product/usage event stream for docs UI, search, AI, feedback, agent reads |

Page-level metadata for machine-readable docs workflows:

| Property | Type | Description |
| --- | --- | --- |
| `tokenBudget` | `number` | Approximate output token target for `docs agent compact` on this page |
| `task` | `string` | Concrete task the page helps an agent complete |
| `outcome` | `string` | Observable end state indicating completion |
| `appliesTo` | `{ framework?, version?, package? }` | Each accepts a string or string array |
| `prerequisites` | `string[]` | Setup or conditions that must already be true |
| `files` | `string[]` | Files the task is expected to read or change |
| `commands` | `(string \| PageAgentCommand)[]` | Command strings or `{ run, cwd?, description? }` objects |
| `sideEffects` | `string[]` | Material state changes or external effects |
| `verification` | `(string \| PageAgentVerification)[]` | Checks or `{ description?, run?, expect? }` objects |
| `rollback` | `string[]` | Steps that restore the prior state |
| `failureModes` | `(string \| PageAgentFailureMode)[]` | Symptoms or `{ symptom, resolution? }` objects |

## PageAgentFrontmatter field types

`PageAgentFrontmatter` defines `task`, `outcome`, `appliesTo`, `prerequisites`, `verification`, `rollback`, and `failureModes`; every structured failure mode pairs a `symptom` with its `resolution`.

## PageAgentFrontmatter failureModes resolution

In `page-frontmatter.md`, use `failureModes` for recoverable failures. The exact example resolves a missing route with `resolution: Confirm withDocs wraps the Next.js config`.

```md title="page-frontmatter.md"
---
title: "Installation"
agent:
  task: Install the framework
  outcome: The docs route renders locally.
  failureModes:
    - symptom: The route returns 404
      resolution: Confirm withDocs wraps the Next.js config
---
```

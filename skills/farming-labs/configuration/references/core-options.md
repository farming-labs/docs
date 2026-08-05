# Core configuration

Use this reference for top-level options, Docs Review, code-block validation, Docs Cloud, static
export, and reader-facing UI configuration.

## Contents

- [Top-level options](#top-level-options)
- [Docs Review](#docs-review)
- [Code-block validation](#code-block-validation)
- [Docs Cloud](#docs-cloud)
- [Static export](#static-export)
- [Reader-facing options](#reader-facing-options)
- [Framework edge cases](#framework-edge-cases)

## Top-level options

| Option | Default | Purpose |
| --- | --- | --- |
| `entry` | `"docs"` | Docs URL prefix |
| `contentDir` | `entry` | Content filesystem path; set explicitly outside Next.js |
| `theme` | required | Theme factory result such as `fumadocs()` |
| `nav` | framework-dependent | Sidebar title and base URL |
| `staticExport` | `false` | Disable server-only UI and produce statically truthful agent exports |
| `github` | unset | Repository URL and optional docs subdirectory |
| `themeToggle` | `true` | Light/dark/system control |
| `breadcrumb` | `true` | Breadcrumb visibility and behavior |
| `sidebar` | `true` | Sidebar visibility and folder behavior |
| `icons` | unset | Shared icon registry for frontmatter and built-ins |
| `components` | unset | Custom MDX components and built-in overrides |
| `onCopyClick` | unset | Code-copy callback |
| `codeBlocks` | unset | Fence planning and optional sandbox execution |
| `feedback` | human UI off | Human UI plus independently configured agent feedback |
| `telemetry` | production on | Coarse package/surface telemetry; loopback origins are ignored |
| `readingTime` | `false` | Estimated reading-time label |
| `agent` | unset | Compaction, evaluations, published skills, and A2A |
| `review` | `true` | Review scoring, CI workflow, and severities |
| `pageActions` | unset | Copy Markdown and Open in LLM actions |
| `ai` | unset | Ask AI configuration |
| `search` | `true` | Simple, Typesense, Algolia, MCP, or custom search |
| `cloud` | unset | Hosted preview/publish defaults |
| `llmsTxt` | `true` | Root and optional section llms files |
| `changelog` | `false` | Dated changelog feed |
| `mcp` | enabled | stdio and HTTP MCP |
| `apiReference` | `false` | Generated local or hosted-spec API reference |
| `sitemap` | `true` | XML and Markdown sitemaps |
| `robots` | `true` | Runtime/generated crawler policy |
| `metadata` | unset | SEO and JSON-LD inputs |
| `og` | unset | Dynamic or static Open Graph images |

Telemetry ignores `localhost`, `*.localhost`, IPv4 loopback, and IPv6 loopback or wildcard binding
addresses even when explicitly enabled.

## Docs Review

```ts
review: {
  ci: {
    name: "agent-docs-review",
    mode: "warn",
  },
  score: { threshold: 80 },
  rules: {
    agentContext: "warn",
    commandHealth: "warn",
    relatedCoverage: "suggestion",
    configConfidence: "warn",
    agentSurfaceDrift: "error",
    goldenTasks: "warn",
    agentSkills: "warn",
  },
}
```

`review` is enabled by default. The generated workflow calls
`farming-labs/docs/.github/workflows/docs-review-reusable.yml@main`; `review.ci.name` defaults to
`docs-review`.

Rule coverage:

- `agentContext`: structured contracts, duplicated/generic Agent blocks, completeness, ambiguity
- `commandHealth`: static package manager, script, working-directory, and known CLI checks
- `relatedCoverage`: missing related routes
- `configConfidence`: evaluated config versus partial static fallback
- `agentSurfaceDrift`: config, discovery, schema, contract, MCP tool, and route parity
- `goldenTasks`: failed or unmeasured configured evaluations
- `agentSkills`: SKILL.md budgets, references, compatibility, and script guidance

Set `review: false` to opt out. Use `mode: "block"` only when the configured score threshold should
fail CI.

## Code-block validation

```ts
codeBlocks: {
  validate: {
    planner: {
      provider: "openai",
      model: "gpt-4.1-mini",
      apiKeyEnv: "OPENAI_API_KEY",
    },
    runner: {
      provider: "vercel-sandbox",
      tokenEnv: "VERCEL_TOKEN",
    },
    envFile: [".env.local", ".env.test", ".env"],
    env: { OPENAI_API_KEY: "OPENAI_TEST_API_KEY" },
    missingEnv: "skip",
  },
}
```

Supported runners are `local`, `vercel-sandbox`, `e2b`, `daytona`, and reserved `cloud`. E2B
requires `e2b`; Daytona requires `@daytona/sdk`.

Fence metadata:

````md
```ts title="app/api/chat/route.ts" framework="nextjs" packageManager="pnpm" env="OPENAI_API_KEY" runnable
const apiKey = process.env.OPENAI_API_KEY;
```
````

Plan before running:

```bash
pnpm exec docs codeblocks validate --plan
pnpm exec docs codeblocks validate
```

Map runtime environment names to local test variables. Never place actual keys in config.

## Docs Cloud

Cloud commands mirror a serializable config subset into `docs.json`.

```ts
cloud: {
  apiKey: { env: "DOCS_CLOUD_API_KEY" },
  deploy: { enabled: true },
  publish: { mode: "draft-pr", baseBranch: "main" },
}
```

`docs cloud sync` only updates `docs.json`; `docs deploy` also validates the named key and deploys.
Store the key in `.env.local`, CI secrets, or the shell.

## Static export

```ts
export default defineDocs({
  entry: "docs",
  staticExport: true,
  theme: fumadocs(),
});
```

- Hide search and Ask AI because no server route is available.
- With Next.js `output: "export"`, do not generate the docs API route.
- `docs agent export --public` emits statically truthful discovery even if `staticExport` is
  omitted.
- Static bundles include the hashed Agent Skills index and artifacts.
- Static bundles omit RFC 9727 API catalog advertising because a generic file host cannot
  guarantee the required profiled media type.
- Publish the API catalog separately with host routing when static hosting must expose it.

## Reader-facing options

### Reading time

```ts
readingTime: {
  enabled: true,
  wordsPerMinute: 220,
}
```

It is off by default. Page frontmatter can set `readingTime: false`, `true`, or a numeric minute
override and wins over global config.

### GitHub

```ts
github: {
  url: "https://github.com/owner/repo",
  directory: "website",
}
```

This powers Edit on GitHub and `{githubUrl}` in page actions.

### Components and themes

- `components` adds or overrides MDX components such as `Callout`, `Tabs`, `HoverLink`, and
  `Prompt`.
- `theme.ui.components` retains a built-in but changes its default props.
- `icons` registers shared components for frontmatter and built-ins.
- `themeToggle` accepts `false`, `true`, or `{ enabled, default }`.
- `sidebar.folderIndexBehavior` supports normal navigation, `"toggle"`, or `"hidden"`.
- `folderIndexBehaviorOverrides` applies behavior to selected folder URLs.
- Page frontmatter `sidebar.folderIndexBehavior` overrides the global behavior.
- `breadcrumb` accepts a boolean or detailed config.
- `metadata` supplies title templates, descriptions, and social fields.
- `og` controls dynamic/static Open Graph images.
- `ordering: "numeric"` uses frontmatter `order`.

## Framework edge cases

- Next.js must wrap its framework config with `withDocs()` from `@farming-labs/next/config`.
- TanStack Start keeps config at the root and passes it to `createDocsServer()`.
- SvelteKit and Astro server loaders must receive config and required Ask AI environment values.
- Nuxt imports root config into `defineDocsHandler(config, useStorage)`.
- Astro cannot serialize feedback callbacks into client scripts; use the documented window/event
  hooks for analytics.
- A custom MCP route must be updated in both config and non-Next public forwarding.

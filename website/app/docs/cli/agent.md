<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:a519c682c3135a5e
settingsHash=fnv1a64:e50e89e221226fc3
outputHash=fnv1a64:1be0c86c619e1329
generatedAt=2026-08-04T11:32:04.375Z
-->
URL: /docs/cli
Description: Scaffold, upgrade, export static Agent Bundles, compact agent docs, validate code blocks, generate sitemaps and robots.txt, sync search, and run MCP
Related: /docs/configuration, /docs/guides/agent-friendly-docs, /docs/customization/sitemaps, /docs/customization/llms-txt

# CLI

## CLI task

Task: Plan and validate fenced MDX code blocks with the Farming Labs docs CLI.

Expected result: The validation plan identifies runnable examples before any execution occurs.

Exact implementation:

```bash title="terminal"
pnpm exec docs codeblocks validate --plan
pnpm exec docs codeblocks validate
pnpm exec docs codeblocks validate --json
```

Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

Choose the CLI workflow before changing files. Use `pnpm dlx @farming-labs/docs <command>` for a published release; use `pnpm exec docs <command>` only after dependencies are installed. For a non-interactive fresh scaffold: `init --template <framework> --name <dir>`; omit `--name` to be prompted.

After a mutating command, run `pnpm exec docs doctor --agent`; expected result is a loaded `docs.config.ts`, `docs.config.tsx`, or `src/lib/docs.config.ts` with no hard failure. For SvelteKit/Astro append `--config src/lib/docs.config.ts`. Prefer `--dry-run` for upgrade/compaction previews and `--check` for generated bundles, sitemaps, robots, or AGENTS files.

If `pnpm` cannot find `docs`, install dependencies or use `pnpm dlx`. If wrong config loads, return to project root or pass `--config <path>`.

**CLI commands:**
- `init` — create or add docs to a project
- `upgrade` — bump docs packages
- `agent export` — materialize static machine-readable bundle
- `agent compact` — generate sibling `agent.md` files from resolved docs pages
- `agents generate` — write root and static `AGENTS.md`
- `skills scaffold` — compile structured page `agent` contracts into an Agent Skill
- `doctor` — audit local docs readiness and optional hosted agent routes
- `review` — review docs changes locally or in GitHub Actions
- `codeblocks validate` — plan and validate runnable MDX code fences
- `mcp` — run built-in docs MCP server over stdio
- `search sync` — push docs content into Typesense or Algolia
- `sitemap generate` — write `sitemap.xml`, `sitemap.md`, and `docs/sitemap.md`
- `robots generate` — write or append agent-friendly `robots.txt`

## CLI runnable code-block validation

Plan fenced MDX examples with `pnpm exec docs codeblocks validate --plan`, then run the documented validation workflow before publishing.

## Quick Start

### From scratch
<Tabs items={["npm", "pnpm", "yarn", "bun"]}>
  <Tab value="npm">
    ```bash title="terminal"
    npx @farming-labs/docs init --template next --name my-docs
    npx @farming-labs/docs init --template tanstack-start --name my-docs
    npx @farming-labs/docs init --template nuxt --name my-docs
    npx @farming-labs/docs init --template sveltekit --name my-docs
    npx @farming-labs/docs init --template astro --name my-docs
    ```
  </Tab>
  <Tab value="pnpm">
    ```bash title="terminal"
    pnpm dlx @farming-labs/docs init --template next --name my-docs
    pnpm dlx @farming-labs/docs init --template tanstack-start --name my-docs
    pnpm dlx @farming-labs/docs init --template nuxt --name my-docs
    pnpm dlx @farming-labs/docs init --template sveltekit --name my-docs
    pnpm dlx @farming-labs/docs init --template astro --name my-docs
    ```
  </Tab>
  <Tab value="yarn">
    ```bash title="terminal"
    yarn dlx @farming-labs/docs init --template next --name my-docs
    yarn dlx @farming-labs/docs init --template tanstack-start --name my-docs
    yarn dlx @farming-labs/docs init --template nuxt --name my-docs
    yarn dlx @farming-labs/docs init --template sveltekit --name my-docs
    yarn dlx @farming-labs/docs init --template astro --name my-docs
    ```
  </Tab>
  <Tab value="bun">
    ```bash title="terminal"
    bunx @farming-labs/docs init --template next --name my-docs
    bunx @farming-labs/docs init --template tanstack-start --name my-docs
    bunx @farming-labs/docs init --template nuxt --name my-docs
    bunx @farming-labs/docs init --template sveltekit --name my-docs
    bunx @farming-labs/docs init --template astro --name my-docs
    ```
  </Tab>
</Tabs>

### Existing project

Run from app root. The CLI: (1) detects framework from `package.json`, (2) asks for theme, (3) asks where docs live (usually `docs`), (4) asks about aliases, CSS, optional i18n, (5) generates files and installs `@farming-labs/*` packages, (6) optionally adds Docs Cloud support.

### Upgrade
<Tabs items={["npm", "pnpm", "yarn", "bun"]}>
  <Tab value="npm">`npx @farming-labs/docs upgrade`</Tab>
  <Tab value="pnpm">`pnpm dlx @farming-labs/docs upgrade`</Tab>
  <Tab value="yarn">`yarn dlx @farming-labs/docs upgrade`</Tab>
  <Tab value="bun">`bunx @farming-labs/docs upgrade`</Tab>
</Tabs>

### MCP server locally

```bash title="terminal"
pnpx @farming-labs/docs mcp
pnpm exec docs mcp --config src/lib/docs.config.ts
```

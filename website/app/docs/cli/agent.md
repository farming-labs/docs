<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:ff98ba0ac661af3e
settingsHash=fnv1a64:e50e89e221226fc3
outputHash=fnv1a64:c95a0dd048e26147
generatedAt=2026-08-20T10:20:45.204Z
-->
URL: /docs/cli
LLM index: /llms.txt
Description: Scaffold, upgrade, export static Agent Bundles, compact agent docs, validate code blocks, generate sitemaps and robots.txt, sync search, and run MCP
Related: /docs/configuration, /docs/guides/agent-friendly-docs, /docs/customization/sitemaps, /docs/customization/llms-txt

# CLI

## CLI task

Task: Plan and validate fenced MDX code blocks with the Farming Labs docs CLI.

Expected result: The validation plan identifies runnable examples before any execution occurs, and
the follow-up validation reports each configured example without executing unrelated prose.

Applies to Next.js, TanStack Start, SvelteKit, Astro, and Nuxt projects using
`@farming-labs/docs` version `>=0.2.60`.

Prerequisites:

- Run commands from the docs project root with its package manager available.
- Install project dependencies before invoking the local `docs` binary.
- Review the plan before allowing configured runners to execute examples.

```bash title="terminal"
pnpm exec docs codeblocks validate --plan
pnpm exec docs codeblocks validate
pnpm exec docs codeblocks validate --json
```

Verification: confirm the plan lists the expected fenced examples and that validation exits without
an unhealthy or unverified command. Recovery: correct the reported file, line, command, or runner
configuration, then rerun `--plan` before executing validation again.

## Workflow selection

- Use `init` for a new docs app or to add docs to an existing supported app.
- Preview package changes with `upgrade --dry-run` before upgrading.
- Use `agent compact --stale` for generated page context and `agent export --check` for bundles.
- Use `doctor --agent` for site-wide readiness and `review --ci` for changed documentation.
- Use `mcp` for local stdio clients; hosted clients should connect to the configured HTTP route.

For a published release use `pnpm dlx @farming-labs/docs <command>`; use `pnpm exec docs <command>` only after installing dependencies. For non-interactive scaffold: `init --template <framework> --name <dir>`; omit `--name` to be prompted. Plain `init` asks whether to modify the current app or create a fresh project.

After a mutating command run `pnpm exec docs doctor --agent`; expected result is a loaded `docs.config.ts`, `docs.config.tsx`, or `src/lib/docs.config.ts` with no hard failure. For SvelteKit or Astro append `--config src/lib/docs.config.ts`. Prefer `--dry-run` for upgrade/compaction previews and `--check` for generated bundles, sitemaps, robots, or AGENTS files.

If `pnpm` cannot find `docs`, install dependencies or use `pnpm dlx`. If the wrong config loads, return to project root or pass `--config <path>`; do not copy flags between unrelated subcommands.

**Main commands:**
- `init` — create a new docs app or add docs to an existing app
- `upgrade` — bump docs packages
- `agent export` — materialize complete machine-readable surface for static hosting
- `agent compact` — generate sibling `agent.md` files from resolved docs pages
- `agents generate` — write root and static `AGENTS.md` instructions
- `skills scaffold` — compile structured page `agent` contracts into an installable Agent Skill
- `doctor` — audit local docs readiness and optional hosted agent routes
- `review` — review docs changes locally or in GitHub Actions
- `codeblocks validate` — plan and validate runnable MDX code fences
- `mcp` — run the built-in docs MCP server over stdio
- `search sync` — push docs content into Typesense or Algolia
- `sitemap generate` — write `sitemap.xml`, `sitemap.md`, and `docs/sitemap.md`
- `robots generate` — write or append an agent-friendly `robots.txt`

## Quick Start

### From scratch

```bash title="terminal"
pnpm dlx @farming-labs/docs init --template next --name my-docs
pnpm dlx @farming-labs/docs init --template tanstack-start --name my-docs
pnpm dlx @farming-labs/docs init --template nuxt --name my-docs
pnpm dlx @farming-labs/docs init --template sveltekit --name my-docs
pnpm dlx @farming-labs/docs init --template astro --name my-docs
```

### Existing project

```bash title="terminal"
pnpm dlx @farming-labs/docs init
```

The CLI: detects framework from `package.json`, asks for theme, entry path (default `docs`), aliases, global CSS, optional i18n, generates files, installs `@farming-labs/*` packages, optionally adds Docs Cloud support.

### Upgrade

```bash title="terminal"
pnpm dlx @farming-labs/docs upgrade
```

Pass `--framework` if detection is ambiguous.

### MCP server locally

```bash title="terminal"
pnpx @farming-labs/docs mcp
pnpm exec docs mcp --config src/lib/docs.config.ts
```

HTTP MCP route (start Next example first):
```txt
http://127.0.0.1:3000/mcp
http://127.0.0.1:3000/.well-known/mcp
```

### Search sync

```bash title="terminal"
pnpm dlx @farming-labs/docs search sync --typesense
```

Loads environment files and uploads configured docs.

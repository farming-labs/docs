<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:794d072d0a443798
settingsHash=fnv1a64:e50e89e221226fc3
outputHash=fnv1a64:2612254b737d2c09
generatedAt=2026-07-30T09:43:36.421Z
-->
# CLI

## CLI task

Task: Choose and run the appropriate Farming Labs docs CLI workflow for a project.

Expected result: The selected CLI operation completes and the resulting docs configuration passes the agent doctor.

Exact implementation:

```bash title="terminal"
pnpm exec docs codeblocks validate --plan
pnpm exec docs codeblocks validate
pnpm exec docs codeblocks validate --json
```
## CLI prerequisites

- Run commands from the docs project root with its package manager available.
- Install project dependencies before invoking the local docs binary with pnpm exec.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## CLI verification

- Run pnpm exec docs doctor --agent. Expected: The doctor loads docs.config and reports the enabled discovery surfaces without hard failures.
- Failure: pnpm cannot find the docs executable.
- Recovery: Install dependencies or invoke the published CLI with pnpm dlx @farming-labs/docs.
- Rollback: Restore generated configuration and public artifacts from version control if a mutating command produced the wrong result.

## CLI agent guidance

Choose the CLI workflow before changing files. For a published release use
`pnpm dlx @farming-labs/docs <command>`; use `pnpm exec docs <command>` only after the project has
installed its dependencies. For a non-interactive fresh scaffold, use
`init --template <framework> --name <dir>`; omit `--name` to be prompted. Plain `init` asks whether
to modify the current app or create a fresh project.

After a mutating command, run `pnpm exec docs doctor --agent`; the expected result is a loaded
`docs.config.ts`, `docs.config.tsx`, or `src/lib/docs.config.ts` with no hard failure for an enabled
agent surface. For SvelteKit or Astro, append `--config src/lib/docs.config.ts`. Prefer `--dry-run`
for upgrade or compaction previews and `--check` for generated agent bundles, sitemaps, robots, or
AGENTS files where the command documents that flag.

If `pnpm` cannot find `docs`, install dependencies or switch to the published `pnpm dlx` form. If
the wrong config is loaded, return to the project root or pass the command's documented
`--config <path>` option; do not copy flags between unrelated subcommands.
## CLI runnable code-block validation

Plan fenced MDX examples with `pnpm exec docs codeblocks validate --plan`, then run the documented validation workflow before publishing.

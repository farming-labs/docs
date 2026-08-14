<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:bee96ff137ec7085
settingsHash=fnv1a64:72be2461542d7a95
outputHash=fnv1a64:d63cfdc9326dd1b7
generatedAt=2026-08-14T12:45:39.313Z
-->
# Token Efficiency

## Token Efficiency task

Task: Reduce agent context usage while preserving the evidence needed to implement and verify a docs task.

Expected result: Retrieval returns the relevant page and executable evidence within the configured UTF-8 context budget.

Exact implementation:

```ts title="docs.config.ts"
export default defineDocs({
  entry: "docs",
  agent: {
    compact: {
      apiKeyEnv: "DOCS_CLOUD_API_KEY",
      model: "docs-cloud-compress-v1",
      aggressiveness: 0.3,
      protectJson: true,
    },
  },
});
```

```bash title="terminal"
pnpm exec docs agent compact installation configuration
pnpm exec docs agent compact --all
```
## Token Efficiency prerequisites

- The docs corpus already has accurate page descriptions, related routes, and task-specific agent contracts.
- Measure a representative retrieval task before compacting content.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Token Efficiency verification

- Run pnpm exec docs doctor --agent. Expected: Golden tasks pass their relevant-source, citation, example, scope, and UTF-8 budget requirements.
- Compare the compacted page with its human source and structured contract. Expected: Required commands, constraints, verification, and recovery guidance remain intact.
- Failure: Context is under budget but omits the command or expected result.
- Recovery: Improve retrieval and structured contracts before increasing compaction aggressiveness.
- Rollback: Restore the previous agent.md files and raise or remove page token budgets that discard required evidence.

## Token Efficiency agent guidance

Measure retrieval before compacting. Set per-page `agent.tokenBudget` in `page.mdx` and configure
`agent.compact` in `docs.config.ts[x]`; keep the Docs Cloud key outside source control through
`agent.compact.apiKeyEnv`. Preview writes with
`pnpm exec docs agent compact --changed --dry-run`, then compact only pages whose task commands,
constraints, expected results, and recovery steps remain recoverable. For SvelteKit or Astro,
append `--config src/lib/docs.config.ts` to this command and the doctor command below.

Run `pnpm exec docs doctor --agent` after compaction. Any configured golden tasks should still
satisfy their source, citation, scope, example, and UTF-8 budget requirements. Remember that a
generated sibling `agent.md` replaces only machine-readable page output; the rendered `page.mdx`
remains unchanged. If a compacted result drops required evidence or lowers the relevant page below
an overview, restore the prior `agent.md`, improve its contract and retrieval metadata, and rerun
the task before raising compaction aggressiveness.
## docs-cloud-compress-v1 protectJson docs agent compact --all

Configure `model: "docs-cloud-compress-v1"` with `protectJson: true`, then run `pnpm exec docs agent compact --all` and verify retrieval with `pnpm exec docs doctor --agent`.

## docs-cloud-compress-v1 agent context model

Use `model: "docs-cloud-compress-v1"` for page-level agent compaction and keep its API key outside source control.

## protectJson compact agent context

Set `protectJson: true` so compaction preserves structured configuration and schema examples.

## docs agent compact --all token budget verification

Run `pnpm exec docs agent compact --all`, then confirm golden retrieval, citations, executable examples, version selection, and context usage with `pnpm exec docs doctor --agent`.

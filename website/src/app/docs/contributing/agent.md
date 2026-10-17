<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:b5dc93bd0362d4de
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:0ba4aa7e16e15e72
generatedAt=2026-08-20T10:20:45.259Z
-->
# Contributing

## Contributing task

Task: Prepare a focused, tested contribution to the Farming Labs docs monorepo.

Expected result: The change follows repository conventions, includes proportional tests or docs, and is ready for pull-request review.

Exact implementation:

```bash title="terminal"
   pnpm --dir website dev
   ```
## Contributing prerequisites

- Read the repository AGENTS.md and the skill that matches the affected subsystem.
- Install the pinned pnpm workspace dependencies and identify the smallest affected package set.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs, @farming-labs/next, @farming-labs/tanstack-start, @farming-labs/svelte, @farming-labs/astro, @farming-labs/nuxt.

## Contributing verification

- Run formatting, lint, type checking, and the smallest relevant test suite required by the changed packages. Expected: Every required check exits successfully and the worktree contains only intentional changes.
- Failure: A package-specific test passes but another adapter regresses.
- Recovery: Run the shared conformance tests and the affected adapter type checks before requesting review.
- Rollback: Revert only the contribution's files and restore generated artifacts from their source templates.

## Contributing agent guidance

Start by reading the repository `AGENTS.md` and the matching file under
`skills/farming-labs/*/SKILL.md`, then branch from `main` with a focused `fix/`, `feat/`, or `chore/`
name. Install the pinned workspace dependencies from the repository root and keep edits inside the
smallest affected package, example, or `website/app/docs/` page set.

For a documentation preview, run `pnpm --dir website dev` and open the changed route. Core or
theme work may also require `pnpm build`; adapter agent-surface changes must run the shared
conformance test described at `/docs/guides/adapter-agent-conformance`. The expected handoff is a
clean, intentional diff with formatting, type checks, and the smallest relevant tests passing.

If a package test passes but another adapter regresses, run the shared conformance tests and the
affected adapter type check before review. If formatting touches unrelated files, remove those
mechanical changes instead of including them in the pull request.

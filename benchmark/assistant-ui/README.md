# assistant-ui custom documentation comparison

This is an experimental local port, not a finished migration. See [REPORT.md](REPORT.md) for the bounded comparison and known failures. It preserves the local assistant-ui docs components and content while comparing its Fumadocs MDX pipeline with the Farming Next adapter. The comparison is of content compilation with a shared custom shell, not the default Farming theme versus the Fumadocs UI theme.

The user's assistant-ui checkout is never edited. `snapshot.py` copies current tracked working files, including uncommitted contents, and records their hashes. The 22 workspace packages needed by docs are rebuilt from that snapshot. External packages use a read-only dependency view from an existing installed assistant-ui checkout. Exact installed versions must be recorded with any result; this is not a fresh install of the source lockfile.

## Scope

- 337 `/docs` pages, platform navigation metadata, original component map and generated type tables.
- The original docs Markdown and platform-aware Markdown handlers are retained for page actions.
- Search retains the examples, design and elements collections. Blog and careers declarations are retained because the original source module includes them.
- Other website routes, live AI backends and source-snapshot services are excluded from both fixtures. The auth-session and demo-usage endpoints are retained because the docs shell imports their types and calls them. This is not an end-to-end test of authenticated services or live demos.
- Real Google font files are downloaded once, including every subset, and served locally by both fixtures. Font downloads and `next/font` generation are outside the comparison. Font preload behavior therefore does not represent the original deployment.
- CSS scanning is explicitly bounded to app/component sources on both sides so dependency symlinks cannot send Tailwind into unrelated worktrees.
- Farming retains the Fumadocs source loader and small runtime collection adapter to preserve the existing sidebar/search interfaces; it replaces the MDX compiler with `withDocs` and `@next/mdx`. This is not a complete removal of Fumadocs packages.
- The port validates frontmatter/meta against the original schemas and preserves the configured Git last-modified lookup. The copied fixtures have no content history in their containing Git repository, so dates are unknown on both sides. Blog processed-Markdown exports are outside the tested docs scope.

## Migration compatibility work

`webpack-compat.py` adapts the current published interfaces for this experiment. It preserves the original Mermaid, image, code-tab, npm-tab, structured-data and highlighter plugins; avoids the broad Farming Fumadocs package aliases that break custom subpath imports; and gives the original site's Markdown rewrites precedence. These are fixture workarounds, not shipped core changes. The framework needs supported extension points before this can become a small, maintainable migration.

The fixture also pins its root `next` type import to its installed peer to avoid resolving the framework checkout's different development version. It deliberately does not alias `next/*`, which would override Next's internal virtual module aliases.

## Reproduction

Use a disposable Farming checkout with built core/theme/Next packages. Set `ASSISTANT_UI_SOURCE` and `ASSISTANT_UI_DEPS` to the source and installed dependency checkout. Read their AGENTS instructions before running the setup.

1. Run `python3 benchmark/assistant-ui/snapshot.py`. This refuses to overwrite an existing snapshot.
2. In the snapshot's `apps/docs`, run `node --import tsx scripts/generate-type-docs.mts`.
3. Run `python3 benchmark/assistant-ui/build-workspace.py`. It safely unlinks the snapshot's dependency-output symlinks and rebuilds all 22 required packages using their `aui-build` pipeline, including devtools CSS. Set a unique `WORKSPACE_BUILD_RUN_ID` when rerunning it.
4. Run `python3 benchmark/assistant-ui/port.py`, then `node benchmark/assistant-ui/collections.mjs`.
5. Run `python3 benchmark/assistant-ui/normalize-fixtures.py`, `python3 benchmark/assistant-ui/webpack-compat.py`, and `python3 benchmark/assistant-ui/prepare-workspace.py`. The latter uses explicit client-environment imports for the assistant-ui generative SDK, preserving its inferred types in Webpack.
6. Run `node benchmark/assistant-ui/audit.mjs` to record MDX imports/components and content hashes.
7. From either fixture, use Node with `--import tsx` to run `compiler.mjs fumadocs` or `compiler.mjs farming`. Set a unique `COMPILER_RUN_ID` for every comparison batch. This checks MDX transformation only; it does not execute imported components, bundle the app or render pages.
8. Run `python3 benchmark/assistant-ui/build.py fumadocs --id native-preflight --cold` and then the same command with `farming` and a new ID. The runner bounds disk use and duration, preserves logs and refuses duplicate IDs. Both use Webpack by default; never mix bundlers in a comparison. Farming collection generation runs inside its build command, so its cost is included. Record failures and cancellations separately from successful timings.
9. On a constrained machine, `--no-webpack-cache` can make correctness builds fit. Apply it equally. Results from this mode do not represent default build-cache performance. `benchmark.py --id repeated --pairs 3` runs six serial cold builds in this explicitly cache-disabled mode, alternating pair order and retaining resource snapshots.
10. Run `VERIFY_RUN_ID=verification node benchmark/assistant-ui/verify.mjs fumadocs`, then the same command for `farming`, using the same Node runtime. `compare-html.py` compares every docs page; `measure-output.py` records HTML/RSC sizes. Preserve earlier receipts before rerunning a measurement with the same output name.

Generated fixtures, logs, downloaded fonts, generated tables and raw measurements live in ignored `artifacts/`. Do not publish the user's uncommitted source snapshot.

## Gates before a migration can ship

- Keep production builds, type checking and all 337 route/content comparisons passing; they passed in the recorded run.
- All original MDX imports, code tabs, local images, Mermaid, platform filters and generated type tables.
- Keep browser navigation, desktop/mobile layout, search, copy controls and TOC passing. Fix the platform-switching sequence that currently fails in both fixtures.
- Explicit integration of excluded API/services and live-demo routes for a full deployment.
- Repeat on a dedicated builder with normal caching before claiming default deployment or warm-build performance. The recorded serial trials use disk caching disabled on both sides.

# Optional AI loading and follow-up scan

Merged [#554](https://github.com/farming-labs/docs/pull/554) and [#557](https://github.com/farming-labs/docs/pull/557) after CI, MCP conformance (where applicable), smoke and Vercel checks completed successfully.

The next change adds a small client loading boundary around the existing Next AI component. With AI disabled, initial gzip JavaScript decreases by **10,755 bytes (10.5 KiB, 2.3%)**. Other adapters and direct AI imports keep their existing entry point. No widget implementation, styling, option default or API contract changes.

## Measurements

- Before: merged main `70bf160db02ba2ed9bb46de3c830bd0222382f04`.
- After: `9c0d63fd2ad8e5d273a365c4c3d5c7d903638fca`.
- Same harness, corpus, dependencies, Node 24.21.0 and two static workers as the [prior comparison](../2026-10-16-post-merge/REPORT.md).
- Three trials for 100-page cold/warm/edit and 500-page cold builds, 12 builds per complete batch. Every sample remains in the linked JSON; source hashes match.
- The candidate ran in a later batch on a normal desktop. An initial attempt stopped after three completed builds when compiler cache writes failed with **ENOSPC**. Its [completed samples](./interrupted/raw-results.json) and [failed-build log](./interrupted/disk-full-build.log) are retained separately. Completed old benchmark build outputs were removed to reclaim space, then the entire candidate batch was rerun with a new run ID. No user project files were removed.

| Metric | Merged main | AI boundary |
| --- | ---: | ---: |
| 100-page initial JS, gzip bytes | 467,931 | 457,176 |
| 500-page initial JS, gzip bytes | 468,531 | 457,776 |
| 100-page static output, bytes | 1,963,557 | 1,963,963 |
| 500-page static output, bytes | 1,965,028 | 1,965,437 |
| Initial CSS, gzip bytes (both sizes) | 36,388 | 36,388 |
| All docs HTML bytes, 100 pages | 29,067,506 | 29,067,506 |
| All docs HTML bytes, 500 pages | 440,794,206 | 440,794,206 |

AI remains available as a separate chunk, so total emitted assets do not shrink. The [before](./before/ai-chunks.json) and [after](./after/ai-chunks.json) receipts identify the chunks containing the floating AI implementation and whether initial HTML loads them. The implementation is absent from the initial scripts after the change at both sizes.

**The timing results do not demonstrate a build-speed improvement.** They are worse in the completed candidate batch, which also followed disk exhaustion and cleanup. No improvement percentage is claimed for build time or memory. These are not dedicated-runner or Vercel measurements.

| Scenario | Before median (min–max), seconds | After median (min–max), seconds |
| --- | ---: | ---: |
| 100 cold | 26.16 (23.31–29.58) | 39.34 (28.76–39.75) |
| 100 warm | 8.13 (6.45–8.89) | 13.88 (10.92–20.86) |
| 100 edit | 6.61 (5.80–11.25) | 11.73 (10.30–15.61) |
| 500 cold | 52.90 (45.24–57.81) | 58.36 (55.73–97.42) |

## Validation

- 234 theme tests and 149 Next tests pass. Theme typecheck, both package builds, changed-file formatting and diff checks pass. Lint has no errors and six pre-existing warnings in layout tests.
- A new import guard fails on the original layout and passes after the change. Tests verify that importing the boundary does not initialize AI, and that streamed server rendering forwards all props for search, sidebar and floating modes.
- All 24 builds in the two complete batches pass; expected route counts, content, syntax highlighting, full sidebars and edited content are checked by the harness.
- The four retained production docs fixtures pass browser checks for search, navigation, copy, mobile sidebar and overflow, without uncaught page errors. Canceled Next prefetch requests are retained in the receipts.
- A separate production feature fixture covers sidebar AI, panel/modal/popover/full-modal chat and a mobile full-modal. Both revisions pass trigger, selected model forwarding, local SSE request/response rendering, response copy, feedback controls, Escape and client navigation. Floating conversations persist through close/reopen. This uses a deterministic local test endpoint, not an external LLM or a production AI provider.
- Configured AI search is shadowed by command search on **both** revisions; that existing failure is recorded, not counted as passing. Its correction is a separate change.

[Visual comparison](./visual-comparison.json): panel, modal, popover, sidebar AI, mobile full-modal, the existing search dialog, the 500-page desktop docs screenshot and the 100-page mobile screenshot match pixel-for-pixel. Desktop full-modal differs at only two pixels by at most two color levels, with unchanged geometry. The 500-page mobile difference is an anchor hover state. The 100-page desktop difference is code-token coloring: the same baseline revision produces different colors for the identical code block between its 100- and 500-page fixtures. Candidate coloring matches the prior API-isolation run and the current 500-page baseline. [Code-block hashes](./highlighting-comparison.json) preserve that evidence; no MDX/highlighter code was changed here.

HTML **byte counts** are unchanged; HTML itself contains different script names and the noted token-color variation. This coverage does not establish that every feature/theme/adapter is identical.

## Further findings and proposed work

| Finding now | Proposed change | Checks needed |
| --- | --- | --- |
| Default command search captures Cmd+K before configured AI search; reproduced in a production fixture. | Mount only the search implementation selected by config. Preserve ordinary command search with AI off or floating. | Next/TanStack/browser mode matrix; keyboard and button activation; search results; chat and mobile. |
| Static browser import chain reaches `browser → telemetry → agent → markdown-sections → @mdx-js/mdx`. | Separate browser telemetry event construction from server feature/discovery resolution, then measure the resulting bundle. | Privacy/opt-out/local-origin guards, server telemetry feature reporting, browser graph and production payloads. This trace alone does not establish removable byte cost. |
| Whole-site metadata maps repeat per page: 71,935 JSON bytes at 100 pages; 361,135 at 500. | Send current-page metadata through a page-level boundary. | Persistent client navigation, JSON-LD, dates, generated titles, locales, reading-time opt-in and static export. |
| Initial CSS is still 35.54 KiB gzip; optional feature styles remain included. | Separate optional CSS while retaining aggregate theme compatibility. | Theme/responsive matrix and enabled/disabled feature screenshots. |
| Existing desktop API playground is offscreen in the threadline example. | Correct the interaction between API-generated utility CSS and shared theme CSS. | Desktop/mobile placement, keyboard controls, real request/response and themes. |
| Identical highlighted code varies within the baseline fixture builds. | Isolate highlighter cache/concurrency behavior before changing compilation. | Repeated cold/warm/edit runs and token/color equality for identical code. Root cause is not yet established. |

## Data and reproduction

- Before: [raw](./before/raw-results.json), [summary](./before/summary.json), [timings](./before/timings.md), [payloads](./before/payloads.json), [docs browser](./before/verification.json), [AI browser](./before/ai-verification.json).
- After: [raw](./after/raw-results.json), [summary](./after/summary.json), [timings](./after/timings.md), [payloads](./after/payloads.json), [docs browser](./after/verification.json), [AI browser](./after/ai-verification.json).
- [Benchmark instructions](../../README.md). Build local packages at the selected source revision, then run `run.py --pages 100 500 --trials 3 --providers farming` with a unique run ID. Use the same explicit Node path for both revisions. Keep source/package builds fixed during timing and perform browser checks afterward.
- Ignored local fixture source, screenshots and logs are under `artifacts/lazy-ai-*`. The interrupted batch is not mixed into either complete-batch median.

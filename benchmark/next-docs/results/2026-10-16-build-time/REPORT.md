# Build-time improvements: compact metadata and focused imports

Three independent changes are combined for this measurement:

- [#560](https://github.com/farming-labs/docs/pull/560): compact page schema fields; expand JSON-LD only for the active page.
- [#561](https://github.com/farming-labs/docs/pull/561): browser telemetry imports no longer reach server discovery or the MDX compiler.
- [#562](https://github.com/farming-labs/docs/pull/562): the Markdown-alternate compiler plugin uses the focused core MDX entry, with older-core compatibility.

Each PR targets main independently. This branch is a reproducible combined measurement snapshot, not a fourth implementation PR. Optional-AI loading #558 and search-handler fix #559 are not included in either measured revision.

## Procedure

Before `70bf160db02ba2ed9bb46de3c830bd0222382f04`; combined runtime after `22efb712b1912d9c2898379851b38e5397fb8f6a` (cherry-picks of `89cd4bc4`, `a64934a0`, `8b439b7f`).

24 serial production builds: three trials of 100-page cold/warm/edit and 500-page cold for each revision. Order is before/after, after/before, before/after. Every revision's core/theme/Next packages are rebuilt before timing. Cold fixture caches are recreated; OS disk caches are not cleared. Content and timestamps are fixed; package installation/builds, tests and browser checks are outside the timer. No disk-full failures occurred.

Same Apple M1 desktop, Node 24.21.0, Next 16.3.8, React 19.2.4, Fumadocs core/UI 16.17.1, two static workers. This is not a dedicated CI runner or Vercel; the percentages describe these samples, not deployment guarantees. Combined effects are not attributed individually to #561 or #562.

## Build times

Seconds, median (min–max), three trials:

| Scenario | Merged main | Combined changes | Median change |
| --- | ---: | ---: | ---: |
| 100 / cold | 14.86 (14.26–20.61) | 13.94 (13.40–16.21) | 6.2% faster |
| 100 / warm | 5.56 (4.69–7.48) | 5.64 (5.33–5.80) | 1.4% slower |
| 100 / edit | 4.91 (4.90–4.98) | 4.76 (4.68–4.89) | 3.1% faster |
| 500 / cold | 33.79 (32.11–34.48) | 30.84 (29.88–32.58) | 8.7% faster |

Both cold-build sizes improve in all three individual before/after pairs. Cached builds are mixed and their median is slightly worse; do not claim a cached-build improvement. Keep the small sample size and desktop variability in mind.

Next-reported phase medians, seconds (not an exhaustive profiler and phases need not sum to wall time):

| Cold build | Before compile | After compile | Before static generation | After static generation |
| --- | ---: | ---: | ---: | ---: |
| 100 pages | 9.100 | 8.200 | 1.237 | 1.257 |
| 500 pages | 15.300 | 14.500 | 10.700 | 9.800 |

## Output sizes

Cold medians. HTML includes serialized React server-component data. Initial gzip uses unique scripts/styles referenced by the initial HTML, compressed locally with gzip level 9.

| Metric | Merged main | Combined changes | Reduction |
| --- | ---: | ---: | ---: |
| 100-page initial JS, KiB gzip | 456.97 | 294.64 | 35.5% |
| 500-page initial JS, KiB gzip | 457.55 | 295.11 | 35.5% |
| 100-page docs HTML, MiB | 27.73 | 22.73 | 18.0% |
| 500-page docs HTML, MiB | 420.61 | 298.57 | 29.0% |
| Initial CSS, KiB gzip | 35.54 | 35.54 | 0.0% |

For context, the immediately preceding rotating three-provider experiment measured native Fumadocs cold medians of **11.99 s at 100 pages** and **27.48 s at 500 pages**, 253.70 KiB initial JS gzip, 13.54 KiB CSS gzip, and 219.91 MiB HTML at 500 pages. Fumadocs was not rerun in this final paired batch, and the products retain different built-in features. These results do not establish an overall framework winner. [Full preceding comparison](https://github.com/farming-labs/docs/blob/codex/compact-page-schema/benchmark/next-docs/results/2026-10-16-compact-schema/REPORT.md).

## Validation and remaining work

- Combined core/theme/Next suites: **1,544 + 238 + 150 = 1,932 passing tests**. Each change also passes its package typechecks/builds and changed-file lint/format. Core published-browser graph and compiler import guards fail on the respective old code and pass after the fixes.
- All 24 production builds pass expected prerendered-route, full-sidebar, content, syntax-highlighting and edit-marker assertions.
- All 600 docs pages' JSON-LD matches across both revisions and all three cold trials; every docs page has one JSON-LD script. Compact fields preserve public agent instructions without exposing unused raw policy/token/rollback fields.
- Browser receipts check initial rendering, desktop/mobile client navigation, active-page JSON-LD title/URL/date/description, search/results, clipboard and mobile sidebar/overflow. Canceled prefetch requests are retained separately from page errors.
- All four production browser fixtures pass with no uncaught page errors. Three of four screenshots match pixel-for-pixel; the 100-page desktop screenshot differs at one pixel (exact colors retained in the visual receipt).
- Whole-site metadata and navigation still repeat per page. Compact metadata reduces the cost but does not eliminate quadratic growth; moving metadata to a page-level boundary remains the next larger structural improvement.
- CSS and the route architecture are unchanged. Replacing routing or changing highlighting without isolated evidence would add feature risk. Cached-build performance remains unresolved.

[Raw measurements](./raw-results.json), [browser checks](./verification.json), [source/schema hashes](./equivalence.json), [visual comparison](./visual-comparison.json). `reproduce.py` rebuilds and switches revisions in a clean disposable checkout and restores its original branch. Set `BENCH_NODE` to Node 24.21.0 and `BENCH_RUN_ID` to a new artifact name. The composite commit is published on `codex/build-time-combined`. Generated fixtures/logs/screenshots remain in ignored `benchmark/next-docs/artifacts/build-time-combined-paired`.

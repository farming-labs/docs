# Farm navigation frontmatter reuse

Numeric navigation sorting read a page's frontmatter to determine its order,
then read it again to construct the navigation node. The adapter now shares
frontmatter within one synchronous traversal. The map is discarded after each
traversal, so subsequent loads continue to observe source edits and deletions.

Baseline: `3f3e5e51e91c8fd56c7fc1e35f6530b90f211ce8`.
Candidate: `f7c631578d5c4d514e44ef72b98c97f7d8b11532`.
Apple M1, macOS, Node 24.21.0, seven alternating before/after pairs with warm
filesystem and gray-matter caches. Both implementations use the same installed
dependencies. Every returned navigation tree is checked for exact equality.

| Pages | Ordering | Source reads before → after | Median time before → after |
| --- | --- | ---: | ---: |
| 100 | Alphabetical | 100 → 100 | 5.44 → 2.10 ms |
| 100 | Numeric | 200 → 100 | 2.53 → 1.65 ms |
| 337 | Alphabetical | 337 → 337 | 4.31 → 4.42 ms |
| 337 | Numeric | 674 → 337 | 7.93 → 5.14 ms |
| 1,000 | Alphabetical | 1,000 → 1,000 | 13.34 → 13.03 ms |
| 1,000 | Numeric | 2,000 → 1,000 | 23.92 → 15.82 ms |

Numeric ordering halves source reads and takes about 34–35% less time in this
navigation-only microbenchmark. Alphabetical ordering eliminates no reads; its
100-page timing is noisy (before 2.14–8.28 ms, after 1.63–9.40 ms), and is not
evidence of a systematic improvement. All raw samples, including this control,
are retained in [the JSON result](./2026-10-17-navigation.json).

A production `createDocsServer().load()` probe with numeric ordering confirms
source reads of 201 → 101, 675 → 338, and 2,001 → 1,001 at the three page counts.
Two different page loads produce the same counts. The extra read is the active
page. Navigation is still rebuilt on each load; this change does not introduce
persistent or cross-request caching.

These are navigation construction measurements, not MDX compilation, full-build,
Vercel, first-visit latency, or Fumadocs comparisons. The Next adapter is unchanged.

## Reproduce

From the repository root after installing the locked workspace dependencies:

```sh
node packages/farmjs/scripts/benchmark-navigation.mjs \
  3f3e5e51e91c8fd56c7fc1e35f6530b90f211ce8 /tmp/navigation.json
```

## Correctness checks

- All 110 Farm tests pass, including real Vite cache reuse/invalidation tests.
- Core, theme, and Farm package builds pass.
- Regression tests cover numeric ties, explicit ordering, nested folders,
  index precedence, icons, hidden folder indexes, symbolic links, parse errors,
  repaired sources, and edits/additions/deletions between loads.
- Lint and formatting pass for the changed source and benchmark script.

No theme CSS, UI components, routing, or public API changes are included. These
checks cover the affected behavior, not an exhaustive visual equivalence claim.

# Compact page structured data

The layout now sends compact public page fields instead of fully expanded JSON-LD for every page. It builds the active page's JSON-LD during server rendering and client navigation. Existing direct JSON-LD overrides and legacy map props remain supported. No page content, CSS, UI markup, config default, routing, date policy or agent contract output was intentionally changed.

This reduces repeated serialization but does **not** remove whole-site maps or their quadratic scaling. Moving all metadata to a page-level boundary remains future work. Core and theme changes must be released together.

## Alternating production builds

Before: `70bf160db02ba2ed9bb46de3c830bd0222382f04`. After: `89cd4bc48a8ee6e68d7c408914316186f875f832`.

36 builds, three trials per scenario/provider, same corpus and dependencies, Node 24.21.0, Next 16.3.8, React 19.2.4, Fumadocs core/UI 16.17.1, two static workers. Order rotates: before/after/Fumadocs, after/Fumadocs/before, Fumadocs/before/after. Each framework revision is rebuilt before its measurements. Cold fixture caches are recreated; warm/edit follow that cold run. Package installation/builds and browser/tests are outside the timer. Content timestamps are fixed to avoid date differences. No disk-full failures occurred.

These are serial normal-desktop measurements, not a dedicated runner or Vercel. Filesystem/OS caches are not cleared. All samples, including the 56.72-second baseline outlier, are retained.

Seconds, median (min–max):

| Scenario | Before | Compact schema | Fumadocs |
| --- | ---: | ---: | ---: |
| 100 / cold | 17.28 (15.29–18.85) | 17.36 (13.67–18.95) | 11.99 (10.89–13.40) |
| 100 / warm | 5.83 (4.46–6.32) | 5.14 (4.24–5.22) | 3.82 (3.22–4.06) |
| 100 / edit | 5.40 (4.90–5.53) | 4.91 (4.91–5.93) | 4.72 (4.48–5.22) |
| 500 / cold | 42.43 (38.16–56.72) | 41.11 (36.60–43.22) | 27.48 (26.04–30.58) |

The 100-page cold median is effectively unchanged. The 500-page cold median decreases by about 3%, with substantially overlapping ranges; this is not strong evidence of a reliable overall build-speed gain. Warm/edit medians are lower in this sample. The firm improvement is less generated data, not a claim that the build-time problem is solved.

## Output

Cold medians; KiB/MiB use powers of 1024. HTML includes serialized React server-component data.

| Metric | Before | Compact schema | Fumadocs |
| --- | ---: | ---: | ---: |
| 100-page HTML, MiB | 27.73 | 22.89 | 16.66 |
| 500-page HTML, MiB | 420.61 | 299.35 | 219.91 |
| 100-page initial JS gzip, KiB | 456.97 | 458.78 | 253.70 |
| 500-page initial JS gzip, KiB | 457.55 | 459.36 | 253.70 |
| Initial CSS gzip, KiB | 35.54 | 35.54 | 13.54 |

500-page HTML is 28.8% smaller. The tradeoff is roughly 1.8 KiB more initial gzip JavaScript for the shared schema renderer. The payload and timing comparison retains the products' different built-in features; it is not feature-identical.

## Validation

- 238 theme tests pass; theme typecheck, core/theme/Next builds, changed-file lint/format and diff checks pass. Core metadata behavior is unchanged; a browser export exposes the existing pure builder.
- The new equivalence matrix covers root/nested routes, locales, base URLs, custom breadcrumbs, dates, Unicode, script escaping and agent HowTo output. Compact props exclude raw access policy, token-budget and rollback fields that were never present in public JSON-LD.
- All 36 production builds pass route-count, content, highlighting, sidebar and edit-marker assertions.
- Every generated docs page has one JSON-LD script. Sorted JSON-LD hashes match before/after across all three trials at both sizes (600 pages per cold trial).
- Mobile screenshots match pixel-for-pixel at both sizes. Desktop article regions match; remaining screenshot differences are confined to the sidebar. See `visual-comparison.json`.
- Browser verification is recorded separately in `verification.json`; it checks active-page JSON-LD after desktop/mobile client navigation as well as search, copying and responsive layout.

[Raw measurements](./raw-results.json). The reproduction script is `reproduce.py`; run it in this disposable checkout with the pinned dependencies installed. It switches source revisions and rebuilds packages, refuses tracked/untracked changes, and restores the original branch. Generated logs, screenshots and fixtures remain in ignored `benchmark/next-docs/artifacts/compact-schema-paired`.

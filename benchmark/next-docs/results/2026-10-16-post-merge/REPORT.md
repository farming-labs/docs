# Production build follow-up: merged optimizations and API isolation

The merged changes reduce shipped JavaScript, but Farming Labs still has larger browser payloads and generated HTML than native Fumadocs. The next measured change removes optional API renderers from ordinary docs imports: initial gzip JavaScript falls another **27.2%** and total static output falls **87.0%** in the 100-page fixture, without changing the banner markup or removing API features.

Build times improved in the observed follow-up batch. The separate timing batches and desktop variability prevent treating the difference as an isolated speedup guarantee or declaring an overall framework winner. Fumadocs still has a lower 500-page cold-build median and substantially smaller JS, CSS and HTML in these results.

## Revisions and procedure

- Historical baseline: `ef7f9102a3afade195b81553108b138de621189b`, 36 builds; [original report](../2026-10-16/REPORT.md) retained unchanged.
- Post-merge comparison: `4301cedd32168e3a30ac79f967c6e3e3074607c1`, after [#555](https://github.com/farming-labs/docs/pull/555) and [#556](https://github.com/farming-labs/docs/pull/556). Three providers, 36 builds.
- API-isolation candidate: `9c0f6861f9c0b8c4ac4c5a745606458e6460782b`, improvement PR [#557](https://github.com/farming-labs/docs/pull/557). Farming only, 12 builds. This change is not part of the post-merge baseline.

There are 48 new production builds and 84 recorded builds across the three batches. Each scenario has three trials. The 100-page scenarios are cold, unchanged warm and one-page edit builds; 500 pages uses cold builds only. Each provider runs serially, with rotating order in the three-provider batch. Candidate trials ran afterward in a separate batch; they were **not interleaved** with the baseline or Fumadocs. No package builds, source edits, browser checks or other benchmark builds overlapped timed runs.

The setup remains an Apple M1 (8 logical cores, 16 GiB RAM), macOS 26.2, Node 24.21.0, Next.js 16.3.8, React 19.2.4, Fumadocs core/UI 16.17.1, Fumadocs MDX 15.4.7, Tailwind 4.2.1 and two static workers. Exact dependency versions, source sizes and commands are retained with every run. Shared versions and generated content are unchanged. Source SHA-256 hashes match across providers and between the post-merge and candidate batches at both page counts.

These are normal desktop measurements, not Vercel measurements or a dedicated CI runner. Cold clears the app/compiler caches, not the operating-system disk cache. Gzip values are sums of local gzip-9 compression of unique initial scripts/styles. Products retain different additional features: Farming includes documentation/MCP APIs, page actions and metadata. AI, telemetry and review workflow generation are disabled; API reference is not configured. No runtime-compilation mode was introduced. All expected docs routes are prerendered.

## Build times

Seconds: **median (minimum–maximum)**, three trials in every cell. The candidate (*) is a separate later batch.

| Pages / scenario | Fumadocs | Farming, merged main | Fumadocs file routes | Farming, API isolation* |
| --- | ---: | ---: | ---: | ---: |
| 100 / cold | 16.80 (13.02–19.20) | 31.59 (19.22–31.70) | 18.80 (13.36–29.21) | 14.92 (14.78–15.19) |
| 100 / warm | 6.15 (4.03–8.53) | 10.91 (8.04–26.33) | 4.07 (3.60–8.06) | 4.50 (4.49–4.72) |
| 100 / edit | 8.27 (7.07–8.62) | 6.30 (5.67–11.69) | 6.71 (4.96–8.59) | 4.96 (4.69–5.64) |
| 500 / cold | 28.07 (25.35–45.34) | 56.89 (40.65–58.37) | 34.65 (33.57–35.49) | 33.98 (32.57–38.85) |

The candidate's 100-page median is below native Fumadocs in these samples, but their ranges overlap and the runs were in different batches. At 500 pages, candidate Farming remains slower than the native Fumadocs median and close to the file-route control. This evidence does not justify replacing the route architecture yet.

Memory did not improve uniformly: median sampled process-tree RSS at 100-page cold build is 2,810 MiB on merged Farming and 3,244 MiB on the candidate; at 500 pages it is 5,078 MiB and 4,050 MiB. These sums can double-count shared memory and are not exclusive physical memory or Vercel limits. Every sample, including outliers, is retained in [post-merge timings](./timings.md) and [candidate timings](../2026-10-16-api-isolation/timings.md).

## Output sizes

Cold-build medians. All-docs HTML includes serialized React server-component data. Server output includes API routes/shared code and excludes `.next/cache`. The candidate (*) is measured from its own revision.

| Pages / provider | Initial JS gzip, KiB | Initial CSS gzip, KiB | Static output, MiB | All docs HTML, MiB | Server output, MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 / Fumadocs | 253.70 | 13.54 | 1.07 | 16.66 | 73.60 |
| 100 / Farming merged main | 627.53 | 35.54 | 14.44 | 27.93 | 124.24 |
| 100 / Fumadocs file routes | 253.70 | 13.54 | 1.07 | 16.66 | 80.38 |
| 100 / Farming API isolation* | 456.97 | 35.54 | 1.87 | 27.72 | 107.36 |
| 500 / Fumadocs | 253.70 | 13.54 | 1.07 | 219.91 | 567.57 |
| 500 / Farming merged main | 627.53 | 35.54 | 14.44 | 421.43 | 1214.15 |
| 500 / Fumadocs file routes | 254.16 | 13.54 | 1.08 | 219.91 | 601.81 |
| 500 / Farming API isolation* | 457.55 | 35.54 | 1.87 | 420.37 | 1158.23 |

At 100 pages, the initial JS path is **796,598 → 642,590 → 467,934 gzip bytes** across the historical baseline, merged improvements and API-isolation candidate. That is 19.3% less after the merged changes, another 27.2% for this candidate, and 41.3% less than the original baseline. Candidate static output is **1,963,560 bytes**, down from **15,138,046** on merged main. CSS is unchanged by the candidate. Small HTML reductions reflect removed client references, not removed article content.

The stable byte reductions are stronger evidence for this change than timing percentages. The 500-page HTML remains around 420 MiB versus 220 MiB for native Fumadocs, so the remaining payload work is substantial.

## Implemented next improvement

The standard docs layout imported `withNextApiReferenceBanner` from the API-reference module. That module statically imported Scalar and the interactive Fumadocs OpenAPI renderer. An `apiReference` configuration check did not stop those imports from entering the build graph.

The candidate moves six existing navigation/banner helpers into a lightweight shared module. The normal docs layout imports that module directly. The API-reference entry point re-exports its existing public helper and retains its renderers. Helper bodies, DOM markup, styles, defaults and public configuration are unchanged.

In both retained production fixtures, the API renderer disappears from the docs client-reference manifest. Disabled AI code remains. [Before](./client-boundaries.json) and [after](../2026-10-16-api-isolation/client-boundaries.json) record matching feature modules and their initial shared-chunk counts. Those counts identify inclusion; they do not assign all bytes in a shared chunk to one feature.

## Verification and limitations

- All 36 post-merge and 12 candidate production builds/typechecks passed. Expected page counts, highlighted content, complete sidebars and edit markers were verified by the harness.
- All six post-merge and both candidate retained production sites passed browser smoke checks: HTTP/content, code clipboard, client navigation, search API/result navigation, mobile sidebar and horizontal overflow. No uncaught page errors were recorded. Receipts retain canceled Next prefetch requests (`net::ERR_ABORTED`) during navigation; these are not hidden.
- Candidate mobile screenshots at 100/500 pages and the 500-page desktop screenshot match post-merge screenshots pixel-for-pixel. The 100-page article region matches; sidebar interaction-state differences remain. [Comparison receipt](../2026-10-16-api-isolation/visual-comparison.json).
- All 149 Next unit tests, package typecheck, changed-file lint/format and package build pass. Optional-renderer import guards fail on the old layout and pass on the candidate. Tests also cover custom/default banners and URLs, sidebar disabled, config immutability, native/Fumadocs API paths and explicit Scalar output.
- The API-enabled development example passes docs/API switching without full reload, API code clipboard copy and a real local GET request/response through the **mobile** Fumadocs playground. AI was configured but no external AI call was made. This is additional development-example coverage, not a timed production fixture. [Receipt](../2026-10-16-api-isolation/enabled-api-verification.json).
- **Existing UI issue:** the threadline example's desktop API playground is positioned partly outside the viewport. It was reproduced at identical coordinates on merged main and the candidate; mobile submission succeeds on both. Desktop playground submission is not counted as passing. This deserves a separate CSS correctness fix with desktop/mobile and theme checks.

This coverage reduces regression risk; it does not prove every feature, theme, adapter or deployment configuration. The implementation change is confined to the Next adapter. Compiler caches were removed only after timing and verification; recorded sizes/results were retained.

## Remaining work, in priority order

| Priority | Current behavior / evidence | Proposed change | Required regression coverage |
| --- | --- | --- | --- |
| 1 | AI is disabled, but `docs-ai-features.mjs` remains in the client manifest with seven initially loaded shared chunks. | Introduce an actual optional client-loading boundary, then measure disabled and enabled configurations. Attribute bytes through measured graph changes. | Dialog/floating/trigger modes, initial rendering, client callbacks, keyboard focus, streaming and chat state. |
| 2 | Whole-site metadata maps serialize into each docs page: 71,935 JSON bytes at 100 pages and 361,135 at 500. Structured data is the largest map. | Pass only the current page's metadata through a page-level boundary while keeping shared navigation persistent. | Client navigation, JSON-LD, dates, reading-time opt-in, generated titles, locales, static export and page actions. |
| 3 | Initial CSS remains 35.54 KiB gzip versus 13.54 KiB for native Fumadocs. | Separate optional feature CSS while retaining compatible aggregate theme entry points. | Every bundled theme, responsive layouts, dialogs, search, API/AI enabled states and downstream CSS imports. |
| 4 | Desktop API playground positioning fails in the existing threadline example on both revisions. | Correct the stylesheet interaction in a separate UI fix. | Visible/reachable Send and Close controls, real request/response, keyboard focus, desktop/mobile and theme variants. |
| 5 | Timing ranges are wide and candidate/baseline batches are separate. | Run alternating A/B revisions on a dedicated runner before enforcing performance budgets. | Retain pinned versions, feature coverage, all samples and cache definitions; use bytes for deterministic early budgets. |

## Reproduce and inspect

Use the [benchmark README](../../README.md) to install/build the local packages at the selected revision. Keep this harness available while switching the framework source revision, and rebuild the packages before each batch. Package/dependency installation remains outside the timer.

```sh
python3 benchmark/next-docs/run.py --node /absolute/path/to/node24 \
  --pages 100 500 --trials 3 --providers fumadocs farming fumadocs-file-routes \
  --run-id post-merge-repeat
# At candidate revision, after rebuilding local packages:
python3 benchmark/next-docs/run.py --node /absolute/path/to/node24 \
  --pages 100 500 --trials 3 --providers farming --run-id api-isolation-repeat
```

- Post-merge: [raw samples](./raw-results.json), [summary](./summary.json), [payloads/source hashes](./payloads.json), [browser receipt](./verification.json).
- Candidate: [raw samples](../2026-10-16-api-isolation/raw-results.json), [summary](../2026-10-16-api-isolation/summary.json), [payloads/source hashes](../2026-10-16-api-isolation/payloads.json), [browser receipt](../2026-10-16-api-isolation/verification.json).
- Ignored local generated apps, build logs and screenshots are under `artifacts/post-merge-2026-10-16/` and `artifacts/isolated-api-2026-10-16/`. They are not part of the Git checkout; rerunning the harness regenerates them.

# Fumadocs and Farming Labs: production-build benchmark

Measured October 16, 2026 UTC, after merging [#552](https://github.com/farming-labs/docs/pull/552)
and [#553](https://github.com/farming-labs/docs/pull/553). Framework source is commit
`ef7f9102a3afade195b81553108b138de621189b`; it also includes #550 and #551.
No runtime or UI implementation changed as part of this benchmark.

## What this comparison means

This measures **Next.js production builds and generated output**, the shared platform of these two
setups. It does not measure other Farming Labs adapters, Vercel billing, deployment upload time,
Core Web Vitals, search latency or AI performance. Neither fixture needs credentials or network data.

All providers receive byte-identical generated MDX: six sections, six tables, six highlighted code
blocks and an internal link per page. They share Next 16.3.8, React 19.2.4, Fumadocs core/UI 16.17.1,
Shiki 4.5.0, MDX 3.1.1, Tailwind 4.2.1 and TypeScript 5.9.3. Native Fumadocs uses fumadocs-mdx
15.4.7. Farming Labs uses the locally built packages at the commit above, carrying version 0.2.120.
Exact dependency versions are retained in every raw measurement.

The machine was an Apple M1 with 8 logical CPUs and 16 GiB RAM, macOS 26.2, Node 24.21.0. Builds
ran serially with two static-generation workers; provider order rotated across three trials. This
was a normal desktop, not a dedicated runner. Timing variance is large and ranges overlap. The
medians are descriptive observations, not a statistically established universal speed ratio.

- **Fumadocs:** its conventional static catch-all route, source loader, default UI and search API.
- **Farming Labs:** `withDocs`, default theme and file-based MDX routes. AI, telemetry and review
  generation are disabled. Normal page metadata, page actions and generated docs/MCP APIs remain.
- **Fumadocs file-route control:** identical Fumadocs compiler, source, UI and search, but one Next
  route module per document. This tests route-structure effects without Farming Labs features.

These are comparable reader experiences, not feature-identical products. The file-route control
helps investigate routing, but cannot attribute every remaining difference to a particular import
or plugin. Installation and framework package builds are excluded from the timer.

## Build measurements

Median wall time, with min–max in parentheses; three trials per cell.

| Scenario | Fumadocs | Farming Labs | Fumadocs file-route control |
| --- | ---: | ---: | ---: |
| 100 pages, cold | **27.80s** (17.01–56.11) | **53.82s** (41.41–57.96) | **34.19s** (20.94–38.56) |
| 100 pages, warm | **9.81s** (6.08–12.99) | **15.29s** (8.22–23.45) | **7.83s** (4.41–11.46) |
| 100 pages, edit | **12.61s** (7.09–16.84) | **10.29s** (9.68–14.35) | **10.66s** (9.51–15.75) |
| 500 pages, cold | **60.84s** (40.64–94.43) | **103.58s** (71.00–122.02) | **50.00s** (47.79–52.39) |

Cold means no application build cache; the OS disk cache is not flushed. Warm retains the previous
build unchanged. Edit appends one paragraph to the first MDX page and retains caches. At 500 pages,
only cold builds were measured. Every timed build includes compilation, typechecking and static
generation. See [timing ranges and sampled-memory medians](./timings.md),
[raw samples](./raw-results.json) and [aggregates](./summary.json).

Cold-build stage medians, seconds:

| Pages | Provider | Compile | Typecheck | Static generation |
| ---: | --- | ---: | ---: | ---: |
| 100 | Fumadocs | 18.30 | 4.10 | 2.60 |
| 100 | Farming Labs | 29.10 | 12.10 | 5.30 |
| 100 | Fumadocs file-route control | 24.10 | 2.40 | 1.72 |
| 500 | Fumadocs | 39.00 | 3.40 | 13.20 |
| 500 | Farming Labs | 39.60 | 14.30 | 38.70 |
| 500 | Fumadocs file-route control | 27.90 | 3.60 | 10.00 |

Stage durations are Next.js log values, rounded by Next and potentially overlapping. They need not
sum to total wall time. Sampled peak tree RSS sums the build process and children; shared memory can
be counted more than once. It is not exclusive physical RAM or a Vercel memory-limit measurement.

## Generated output

| Pages | Provider | Initial JS gzip (KiB) | Initial CSS gzip (KiB) | Index HTML raw / gzip (KiB) |
| ---: | --- | ---: | ---: | ---: |
| 100 | Fumadocs | 253.7 | 13.5 | 169.9 / 13.2 |
| 100 | Farming Labs | 777.9 | 35.5 | 284.7 / 19.3 |
| 100 | Fumadocs file-route control | 253.7 | 13.5 | 169.4 / 13.2 |
| 500 | Fumadocs | 253.7 | 13.5 | 449.6 / 23.6 |
| 500 | Farming Labs | 777.9 | 35.5 | 861.7 / 40.1 |
| 500 | Fumadocs file-route control | 254.2 | 13.5 | 449.1 / 23.6 |

| Pages | Provider | All docs HTML (MiB) | Static assets (MiB) | Server output (MiB) | Build cache (MiB) |
| ---: | --- | ---: | ---: | ---: | ---: |
| 100 | Fumadocs | 16.7 | 1.1 | 73.6 | 73.4 |
| 100 | Farming Labs | 27.9 | 14.9 | 130.4 | 256.7 |
| 100 | Fumadocs file-route control | 16.7 | 1.1 | 80.4 | 98.1 |
| 500 | Fumadocs | 219.9 | 1.1 | 567.6 | 110.2 |
| 500 | Farming Labs | 421.4 | 14.9 | 1220.2 | 492.5 |
| 500 | Fumadocs file-route control | 219.9 | 1.1 | 601.8 | 229.1 |

Initial assets are files referenced by the `/docs` HTML, with local gzip-9 sizes, not network
transfer measurements. Server output includes prerendered HTML/RSC, shared code and APIs. Build
cache is separate. Output tables use the median of cold builds. Source bytes and all page counts
are validated; the [payload inspection](./payloads.json) records corpus hashes and script sizes.

## Improvements to pursue, one focused PR at a time

### 1. Narrow client imports and defer parser initialization

**Current:** the client callbacks module imports the complete docs config. The fixture imports
`defineDocs` from the broad core entry, while audience filtering and Markdown section parsing
construct MDX processors at module evaluation. The resulting browser graph deserves attention:
Farming Labs references roughly 778 KiB of gzipped initial JavaScript versus 254 KiB for Fumadocs.
This gap persists with AI disabled.

**Proposed:** introduce and internally use a small browser-safe config/callback boundary, and create
parsers only when parsing is actually requested. Preserve existing public imports. Inspect the
resulting bundle to confirm unused parser/runtime code is eliminated. The measured byte difference
is evidence of overhead; the exact savings attributable to each import still require an isolated
before/after change.

**Regression checks:** custom copy, feedback, analytics and AI callbacks; custom theme config/icons;
Markdown audience filtering; section extraction; and initial bundle-size budgets.

Sources: [client config import](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/next/src/client-callbacks.tsx#L4),
[eager audience parsers](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/docs/src/audience.ts#L264),
[eager section parser](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/docs/src/markdown-sections.ts#L117).

### 2. Deliver page-specific metadata with the page

**Current:** the shared layout passes last-updated, structured-data and description maps for every
page to `DocsPageClient`. The client selects one entry by pathname. Measured compact JSON for these
maps totals 71,935 bytes at 100 pages and 361,135 bytes at 500 pages, in a single page's React stream,
before HTML escaping or compression. Repeating whole-site maps across all static pages causes
quadratic growth in this part of the output. Shared navigation also grows with site size in both
products; the metadata maps are an additional cost.

**Proposed:** emit the current page's metadata through its MDX/page boundary and retain only shared
navigation at layout level. Use the existing page-specific client props where suitable. Design this
around static generation and Next's persistent layouts; simply reading request headers in a shared
layout would change rendering behavior and is not an acceptable shortcut.

**Regression checks:** navigation between pages without reload, direct links, JSON-LD, generated
titles/descriptions, last-updated labels, reading-time opt-in, locales and static export. Compare
serialized output as well as screenshots.

Sources: [whole-site props](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/fumadocs/src/docs-layout.tsx#L1241),
[per-path selection](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/fumadocs/src/docs-page-client.tsx#L604).

### 3. Separate optional API-reference and AI dependency paths

**Current:** the ordinary Next layout imports its API-reference banner helper from a module that
also imports Scalar and the OpenAPI page renderer. The theme layout statically imports its AI
component, although rendering is conditional. Build output still contains substantial extra code
with these features disabled. Static imports identify candidates; they do not by themselves prove
how many shipped bytes each feature contributes after bundling.

**Proposed:** move lightweight banner/config helpers into focused modules and isolate heavy feature
renderers behind the appropriate enabled route or component boundary. Attribute bundle changes
with a dedicated before/after build for each feature.

**Regression checks:** disabled-feature bundles plus enabled Scalar and Fumadocs API pages,
interactive API examples, AI dialog/floating modes, loading/error states and navigation.

Sources: [layout import](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/next/src/layout.tsx#L6),
[heavy API imports](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/next/src/api-reference.tsx#L3),
[AI import](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/fumadocs/src/docs-layout.tsx#L38).

### 4. Make optional feature CSS separable

**Current:** the default theme imports the full shared framework bundle and includes AI styling.
The fixture's initial CSS is about 35.5 KiB gzipped, versus 13.5 KiB for Fumadocs. Some extra CSS
supports additional visible functionality and should remain.

**Proposed:** offer focused feature CSS while keeping the existing aggregate entry compatible.
Measure actual unused styles before changing defaults. Prioritize JavaScript and metadata first,
because their measured absolute cost is larger.

**Regression checks:** every supported theme, light/dark mode, mobile navigation, search, page
actions and all optional AI/API components, with screenshot comparisons.

Source: [default theme CSS](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/fumadocs/styles/default.css#L1).

### 5. Investigate route structure with the control before changing architecture

**Current:** 100 docs produce 104 Farming Labs app-route entries, versus 4 for the Fumadocs catch-all
and 103 for its file-route control. All still prerender 100 actual docs pages. Route-module count
is different from page count.

**Proposed:** use the control's results and a compiler trace to decide whether an opt-in generated
content manifest/catch-all path is worthwhile. The timing ranges are too noisy to assign a fixed
cost per route or promise that a routing rewrite alone will close the gap.

**Regression checks:** existing authored routes/layouts, custom MDX components, metadata, locales,
redirects, static export and API routes. Keep file-based projects compatible.

### 6. Use this harness to verify each optimization

**Current:** smaller config/import microbenchmarks do not establish end-to-end build savings.
The previously merged content preparation, stable generated writes, redirect memoization and MDX
import changes are already present in this baseline; this run is not a before/after test of them.

**Proposed:** rerun the same fixture and versions before and after each focused PR. Track stable
payload/output budgets and use repeated timing samples on a dedicated runner for timing gates.
Run the full 36-build suite on demand; a small fixture is sufficient for routine correctness smoke
checks. Profile MDX/highlighting only if traces show remaining repeated work: both providers already
use Fumadocs' shared Shiki integration, so adding another highlighter cache is not yet justified.

## Additional UI finding

The Farming Labs fixture displays TOC labels such as `Section 1Copy Anchor Link`. The client builds
TOC titles from heading `textContent`, which includes the screen-reader text of Fumadocs' copy-anchor
button. The native Fumadocs fixture uses its compiled TOC and does not include that text.

A separate small correctness PR should exclude heading controls when deriving TOC text, or consume
compiler-provided TOC data where available. Preserve the copy button's accessible name, inline code
and formatted heading text, anchor IDs and client navigation. This issue exists in the measured
baseline; the benchmark does not introduce it or fix it.

Source: [DOM-derived TOC titles](https://github.com/farming-labs/docs/blob/ef7f9102a3afade195b81553108b138de621189b/packages/fumadocs/src/docs-page-client.tsx#L660).

## Verification and limits

- All 36 production builds and their TypeScript checks passed.
- Every build prerendered the expected 100 or 500 docs pages, with the complete sidebar and
  highlighted code. All nine edited builds included the changed paragraph.
- Hashes of the retained source corpora match across all three providers at each page count.
- Production-browser checks passed for all six retained sites in Chrome 155.0.8059.41: page loading,
  six visible code blocks, clipboard contents, navigation without a full reload, search through the
  API and result selection, mobile overflow and sidebar navigation. No uncaught browser errors were
  recorded. See [verification receipt](./verification.json).
- Screenshots were inspected for the native and Farming Labs fixtures. The TOC label issue above is
  a known baseline finding, so these smoke checks are not a claim of flawless UI or exhaustive
  feature coverage. Canceled RSC prefetches during navigation are retained in the receipt.
- Harness formatting/lint, Python syntax, and CLI path/mode validation passed. This change only adds
  the benchmark and report; it does not alter package implementation files.

Builds emitted nonfatal CSS-parser warnings about `::highlight(fd-search)`. The local run directory
retains build/server logs and screenshots; generated applications and caches are not committed.

All docs routes in these fixtures are prerendered. Production page requests therefore serve built
output in this setup; the measured build cost is not evidence that each production visit recompiles
MDX. Dynamic docs/search/MCP endpoints have separate runtime work, not timed by this benchmark.

No optimization here removes a feature or changes UI. Proposed changes need their own focused
validation before merging. These measurements establish a reproducible baseline and identify
where to investigate; they do not guarantee a particular Vercel speedup.

Reproduction commands and full measurement definitions are in the [harness README](../../README.md).
The Fumadocs baseline follows its official [Next integration](https://www.fumadocs.dev/docs/mdx/next)
and [collection setup](https://www.fumadocs.dev/docs/mdx/collections). Its
[performance guide](https://www.fumadocs.dev/docs/mdx/performance) discusses compilation/bundling
costs and alternative loading strategies.

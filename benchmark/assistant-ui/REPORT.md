# assistant-ui docs migration experiment — 2026-10-16

Latest follow-up: [current four-provider comparison](#current-migration-comparison-after-the-mdx-cache-fix) and [cache persistence follow-up](#follow-up-avoid-rewriting-an-unchanged-mdx-cache). Earlier experiments remain below with their own scope and provenance.

The isolated Farming port builds and preserves the tested docs content, but it is **slower in this experiment**: **113.45s versus 86.36s**, a **31.4%** increase. This is a constrained local Webpack comparison with disk caching disabled on both sides, not a default Vercel or Turbopack benchmark. The production assistant-ui checkout was not migrated or edited.

PRs [#560](https://github.com/farming-labs/docs/pull/560), [#561](https://github.com/farming-labs/docs/pull/561), and [#562](https://github.com/farming-labs/docs/pull/562) were squash-merged after their checks passed. The benchmark uses merged framework revision `bfe194fbea6c561e7bd76374a8ec0088e9d46e37`. The original migration harness remains on the local benchmark branch. The later follow-up below adds CI for the separate synthetic fixture.

## Vercel build investigation follow-up

The recurring deployment cost has a concrete infrastructure cause, separate from the MDX
compiler comparison: actual `farming-labs/docs-website` logs repeatedly reject a **1.68 GB
build cache** because that deployment's reported limit is **1.50 GB**. The next deployment then
starts cold. The website also built **five example applications** and all adapters before its own
Next build. `pnpm install --force` installs all 19 workspace projects and all optional platforms;
it was deliberately added in #383 to repair partial cached dependency graphs.

[PR #572](https://github.com/farming-labs/docs/pull/572) moves example builds to their existing CI
job and builds only core/theme/Next during website deployment. All five examples, package checks,
browser tests, the website build, both Vercel previews, and deployed smoke checks pass. Observed
website build-command time is **154.844 → 50.438 seconds** compared with the earlier #570 preview;
build-start to build-complete including install is **199.703 → 91.063 seconds**. Both report
4 cores / 8 GB and 67 website static pages. These are different deployments, not randomized
repeated compiler trials. Main's older production run took 272.727 seconds for its build command,
showing why a single timing must not be presented as a universal gain.

#572 alone still exceeds the cache limit. [PR #573](https://github.com/farming-labs/docs/pull/573),
stacked on #572, scopes deployment installation to the website dependency graph and root tooling,
while retaining the frozen lockfile and forced dependency repair. The first install selects
**5 of 19 projects** and **760 instead of 1,924 packages**. The cold preview successfully built
all 67 static pages and uploaded a **1.18 GB cache**, below the 1.50 GB limit. Its build pipeline
including installation took **82.206 seconds**, and its website build command took **53.411 seconds**.
A second cold run took **89.449 seconds** end-to-end and again uploaded 1.18 GB.
A Git-triggered rebuild with an identical source tree then **restored that cache**, compiled in
**2.5 seconds** (versus 21.3–23.1 seconds cold), and completed the full build pipeline in
**71.902 seconds**; its build command took **31.065 seconds**. All 67 pages were generated.
The cached comparison is one sample, and install/typecheck/prerender costs remain. The initial
CLI redeploy explicitly disabled caching and is correctly retained as the second cold sample.

Cache and restored-build verification are recorded in [the Vercel receipts](results/2026-10-16/vercel-build-follow-up/summary.json).

“Progressive compilation” needs a precise contract. Assistant-ui already has `async: true` for
its large collections, but its catch-all route still calls `source.generateParams()`, its shared
source imports six collections, and search loads structured data across four collections.
Fumadocs documents that async imports do not provide lazy bundling in Turbopack. Its dynamic
runtime mode forbids MDX imports/exports and relative file images; **120 of 337 audited docs
pages contain imports**, so switching the whole corpus would not preserve features. ISR can
reduce prerendering but does not by itself remove imported MDX from the bundler graph.

The safe order is: restore deploy-cache reuse; remove unnecessary builds; then measure
content-addressed compilation reuse with invalidation for plugins, imported files, config, and
Git metadata. Any runtime-compilation option needs compatibility detection, a bundled fallback,
complete search/Markdown output, and first-request latency measurements. No runtime compilation
mode or highlighter-output cache was shipped in this follow-up. A quick fenced-code census found
only 86 duplicate occurrences among 2,240 triple-backtick fences (3.8%, a text census rather than
an AST count), so that is not the main assistant-ui build bottleneck.

References: [Fumadocs lazy loading](https://www.fumadocs.dev/docs/mdx/async),
[Fumadocs performance](https://www.fumadocs.dev/docs/mdx/performance),
[Next CI caching](https://nextjs.org/docs/app/guides/ci-build-caching),
[pnpm force semantics](https://pnpm.io/10.x/cli/install).
Both PRs are ready for review; #573 depends on #572. Neither was merged. The scoped-install
preview passed **85 deployed agent-surface checks**, **41 hosted-readiness checks** (one existing
allowed warning), and **five live browser flows** covering rendered code, clipboard copy, client
navigation, search with anchor normalization, and mobile sidebar navigation. No browser runtime
exceptions were observed. No UI or application runtime source was changed.

No new assistant-ui timing is claimed. The existing controlled-scope comparisons below remain
our evidence against Fumadocs; these deployment improvements do not establish a framework win.

## PR follow-up and CI measurements

Seven new focused PRs are open; no new PR was merged in this follow-up. The earlier parser PR
[#563](https://github.com/farming-labs/docs/pull/563) remains draft. Full receipts, raw CI logs,
startup samples, and browser checks are under
[performance-pr-follow-up](results/2026-10-16/performance-pr-follow-up/summary.json).

| PR | Change | Measured result / verification |
| --- | --- | --- |
| [#564](https://github.com/farming-labs/docs/pull/564) | Preserve custom Markdown rewrite precedence | 81 config/redirect tests pass, including actual Next route matching |
| [#565](https://github.com/farming-labs/docs/pull/565) | Respect Webpack package exports and provider identity | 15 new resolver checks; 165 adapter tests pass |
| [#566](https://github.com/farming-labs/docs/pull/566) | Reuse config source within one setup pass | 15 → 1 config reads in the changelog fixture; 153 tests pass; later calls observe edits/deletions |
| [#567](https://github.com/farming-labs/docs/pull/567) | Defer search/AI dialog modules | 72,199 → 61,803 gzip bytes in the isolated browser fixture (14.4% smaller); 238 theme tests and 13 candidate browser flows pass |
| [#568](https://github.com/farming-labs/docs/pull/568) | Supported MDX plugin and highlighter hooks | 162 adapter tests pass, including real MDX compilation and Webpack/Turbopack loader-option parity |
| [#569](https://github.com/farming-labs/docs/pull/569) | Fresh-runner serial cold/warm/edit comparisons | Six smoke builds plus 36 repeated 100-page builds pass; raw samples retained |
| [#570](https://github.com/farming-labs/docs/pull/570) | Keep runtime modules out of config imports | Seven-trial median startup 225.05 → 46.56 ms (79.3% lower), 712 → 136 loaded modules; 1,546 core and 150 adapter tests pass |

The final startup batch measures import plus `withDocs()` setup in fresh Node 24.21.0 processes
with a warm OS filesystem cache. The baseline uses the same emitted config code with the broad
imports restored. An earlier seven-trial batch measured 200.68 → 45.72 ms. These are configuration
startup measurements, not whole-build timings. PR #570 is draft because its new import entry
requires publishing the corresponding core release before the adapter; the peer floor is raised
to core 0.2.121. The release itself was not performed.

The combined branch `bbaf0f1f` applies all eight PRs without conflicts and passes **1,550 core,
181 adapter, and 238 theme tests**, three package typechecks, formatting, and **13 browser flows**.
The browser fixture covers delayed-download cancellation, keyboard/button opening, localized
search and navigation, JSON/SSE AI responses, conversation retention, both sidebar dialogs,
and all four floating styles. It uses a local API fixture; it does not validate a live model service.

### Candidate against Fumadocs on the same CI runner

100 generated pages, three trials per mode, Node 24.21.0, Next 16.3.8, React 19.2.4,
Fumadocs core/UI 16.17.1, Fumadocs MDX 15.4.7; four vCPUs, two static workers, Ubuntu 24.04,
normal Turbopack filesystem caching. Installation and package builds are outside the timer.

| Build | Fumadocs median | Farming candidate median | Farming relative difference |
| --- | ---: | ---: | ---: |
| Cold | 19.64 s | 22.30 s | 13.5% slower |
| Warm | 5.50 s | 6.37 s | 15.9% slower |
| One-page edit | 8.06 s | 7.43 s | 7.9% faster |

Candidate cold sampled process-tree RSS is 2,981 MiB versus Fumadocs' 3,312 MiB; edit RSS is
1,743 versus 2,045 MiB. Warm RSS is higher: 1,409 versus 1,310 MiB. These sampled sums can
count shared memory more than once. Initial JS remains larger than Fumadocs: 291,534 versus
259,790 gzip bytes (12.2% more).

The separate baseline batch measured Farming 18.65/5.46/6.29 seconds and Fumadocs
15.26/4.39/6.30 seconds for cold/warm/edit. **Do not interpret the absolute difference between
batches as a regression or speedup:** GitHub assigned AMD EPYC 9V74 to the baseline and AMD EPYC
7763 to the candidate. Compare providers within each runner. All four retained corpora have the
same source hash. Farming's initial JS fell from 301,712 to 291,534 gzip bytes (3.4% smaller),
while cold-build docs HTML remained exactly 23,828,406 bytes. These artifact changes are comparable
across the runners, apart from small build-ID/compression variations. The synthetic fixture
disables AI; the payload reduction is measured for the combined changes, rather than attributed
byte-for-byte to one PR.

Runs: [baseline](https://github.com/farming-labs/docs/actions/runs/38974608558),
[candidate](https://github.com/farming-labs/docs/actions/runs/38974564321),
[smoke](https://github.com/farming-labs/docs/actions/runs/38973841403).

Remaining work: cold/warm compilation, file-route overhead (104 route modules versus 4 in the
catch-all Fumadocs fixture), initial client payload, and collection-bridge schema/Git-date reuse.
The new hooks remove MDX loader patching as a requirement but do not implement a native collection
adapter. The 337-page assistant-ui port needs a new full comparison after integration; its old
31.4% build gap has not been superseded by the synthetic results.

## Priorities to outperform the baseline

These are ordered by the measured build gap and the migration problems encountered here. Proposed gains are targets, not measurements. The original comparison requires a 23.9% reduction in Farming's own build time merely to reach parity. A target of 20% faster than Fumadocs would require a 39.1% reduction from that original Farming result. Recalculate those targets on a dedicated builder; this machine cannot establish a reliable deployment budget.

| Order | Current behavior / evidence | Proposed improvement | Acceptance check |
| --- | --- | --- | --- |
| 1 | Core heading and audience helpers load the full MDX compiler for parsing. The port's server graph has 848 additional normalized module/layer pairs. | Use the underlying parsers directly, then profile remaining Markdown serialization, YAML, schema, and OpenAPI dependencies. Keep enabled features and all default API routes. | Fewer traced dependencies, identical parser/render/API outputs, and a repeatable total-build improvement. First candidate: draft [#563](https://github.com/farming-labs/docs/pull/563). |
| 2 | The experimental collection bridge reads metadata, validates schemas, and looks up Git dates during config loading; median config load was 2.1s versus 0.084s. | Integrate collection generation with the build lifecycle and cache stable inputs. Invalidate on content additions/deletions, schemas, config, dependencies, and Git history; retain a conservative path for dynamic callbacks. | No-op and single-page rebuild measurements plus edit/add/delete/schema/Git-date correctness checks. This is currently a migration-bridge cost, not a cost demonstrated in every Farming site. |
| 3 | The custom shell requires loader-option patching to preserve images, Mermaid, highlighting, code/npm tabs, and structured data. | Provide a supported MDX extension and collection-adapter API. Profile reuse of existing parse results where equivalent work repeats. | Same custom components and generated content under Webpack and Turbopack; default-theme tests also pass. |
| 4 | Broad Fumadocs package aliases broke exported subpaths; generated Markdown rewrites intercepted existing handlers. The fixture needs workarounds. | Make aliases export-aware and define explicit route-override precedence. | Custom imports and existing Markdown handlers work without patches; automatic routes, providers, default themes, and OpenAPI remain functional. |
| 5 | Initial JavaScript is 1,242.11 KiB gzip versus 1,235.50 KiB. Both retain the same large assistant-ui shell. | Trace heavy client imports and defer optional dialogs/highlighters where interaction semantics permit. Profile shared type-table highlighting separately. | Initial JS falls below the matched baseline with no navigation, search, copy, accessibility, hydration, or interaction regression. Attribute shared app improvements to both frameworks. |
| 6 | Current evidence covers cold `.next` builds with Webpack disk caching disabled on a shared machine. Warm builds, fresh installs, default Turbopack/Vercel builds, and peak memory are unmeasured. | Establish a dedicated, reproducible comparison using identical corpus, routes, dependency versions, cache policy, and resource limits. | Repeated alternating cold, no-op, and one-page-edit builds; memory and artifact sizes; full feature checks. Target a meaningful improvement on both cold and cached builds before claiming superiority. |

### First candidate: parse without the compiler

Draft [PR #563](https://github.com/farming-labs/docs/pull/563), revision `4f191707`, replaces the compiler used by core parsing helpers with the same `unified`, `remark-parse`, and `remark-mdx` parsers. It preserves lazy reuse, GFM behavior, public APIs, and automatic routes. No feature was disabled for this experiment.

- Across 511 Markdown/MDX files, all **1,533 parser comparisons**, **1,022 audience projections**, and **511 section comparisons** match the previous implementation. This raw corpus scan is broader than the six configured collections' 510 compiled pages.
- The dependency trace consistently drops **122 absolute-path/layer pairs** and adds one parser module: **121 fewer**, from **12,331 to 12,210** (0.98%). Both candidate builds have the same absolute-path graph. MDX compiler modules fall from **20 to zero**. These counts exclude relative external-module labels and therefore differ from the earlier cross-framework normalization; do not directly subtract their totals.
- **1,548 core tests**, **83 theme API tests**, and **24 focused Next MDX tests** pass, along with core build/typecheck, changed-file lint/format, and frozen-lockfile validation. The initial core run's missing local adapter dependency links and outdated cache spy were corrected and the affected tests rerun.
- Both candidate production builds succeed. All **337 rendered docs pages**, **502 search records**, and the tested Markdown response still match. The same **16 browser checks pass**, with the existing platform-switcher failure retained. Desktop/mobile screenshots were inspected. Initial JavaScript and raw HTML/RSC totals are unchanged. Live services remain outside scope.
- **No total-build speedup is demonstrated.** The baseline run took **82.65s**; candidates took **92.80s** and **183.87s**. The first compilation phase was 60s versus 54s, but total time moved in the opposite direction. The third run encountered a separate CPU-heavy workload, while the machine also used roughly 9–10 GiB of swap. The planned six-run experiment was stopped after that build completed, and the original package output was restored. These runs are diagnostics, not a new Fumadocs comparison or a usable median.

The PR remains a draft pending reliable build-time evidence. Compact follow-up receipts are in [parse-only-follow-up.json](results/2026-10-16/parse-only-follow-up.json); the benchmark harness and local assistant-ui source are not included in the core PR.

## Measurements

| Metric | Native Fumadocs | Farming custom-shell port |
| --- | ---: | ---: |
| Cold `.next` build, median of 3 | 86.36s | 113.45s |
| Observed build range | 86.35–91.34s | 98.49–133.57s |
| Webpack compilation, median | 61.0s | 77.0s |
| Type checking, median | 4.5s | 4.8s |
| Static generation, median | 17.1s | 18.3s |
| Initial config load, median | 0.084s | 2.1s |
| Initial /docs JavaScript (gzip KiB) | 1235.50 | 1242.11 |
| Total HTML for 337 docs pages, MiB | 147.71 | 146.69 |
| Total RSC output for 337 docs pages, MiB | 82.00 | 81.22 |

Farming's HTML is 0.69% smaller and its RSC output is 0.95% smaller. Initial JavaScript is 6.61 KiB larger, or 0.54%. The JavaScript measurement sums the gzip-compressed scripts referenced by the initial `/docs` HTML; it does not include later lazy chunks. HTML/RSC totals are raw generated file sizes across every docs page. Phase medians are independent and should not be added to reconstruct a median total.

Raw build samples, in execution order: Fumadocs **91.339s**, Farming **133.570s**, Farming **113.451s**, Fumadocs **86.357s**, Fumadocs **86.349s**, Farming **98.490s**. All six builds passed compilation, TypeScript, and prerendering. Failed setup runs were excluded and remain in the local artifacts directory.

## What was preserved and tested

- All **337** docs URLs, rendered text, heading IDs, code-block counts, and image counts match between generated HTML outputs.
- All **502** search records match exactly after sorting by URL. The tested installation Markdown response also matches byte for byte.
- Both pass the same **16 browser/production checks**, including tabs, local MDX images, Mermaid SVGs, generated type tables, client navigation, search, page copying, code copying, TOC navigation, and mobile sidebar navigation. Neither produced a browser runtime exception in those checks.
- One additional check **fails on both**: starting from `/docs/installation#quick-start`, selecting React Native leaves the URL and selected platform on React. This is observed in the native source snapshot as well as the port; it has not been fixed or attributed to a framework regression.
- Network failures remain for excluded website routes, local Vercel analytics assets, and absent cloud configuration. The browser receipts retain them. Passing the docs checks does not mean every live service works.

The corpus includes 2,252 code blocks, 16 Mermaid blocks, and 120 docs pages with MDX imports. Six declared content collections compile 510 pages in total; only the 337 docs pages are rendered as website routes in this fixture. The same original assistant-ui components, styles, platform tree, generated API tables, and source schemas are used on both sides.

## Extra work found in the Farming port

The final build traces contain **11,529** normalized distinct module-path/layer pairs for Fumadocs and **12,377** for Farming: **848 more**. Added paths include Markdown parsers/serializers, schema validators, YAML utilities, and framework server modules. The port also generates an additional `/api/docs` route, while its custom shell uses the original search and Markdown handlers. These observations justify testing narrower server entrypoints and optional route generation; they do not prove that one route accounts for the entire timing gap.

The custom collection bridge runs schema validation and Git-date lookup from Next config through a child Node process. Its work is included in the build timer and contributes to the roughly two-second config load. This bridge is experimental migration code, not an intrinsic cost of every Farming site.

## Current behavior and proposed improvements

| Area | Current behavior found here | Proposed change and validation |
| --- | --- | --- |
| Core API generation | A Farming API route and its server dependencies are built even though this custom shell already has handlers. | Add a supported opt-out for custom shells or a smaller content-only server entrypoint when optional capabilities are disabled. A/B-test the dependency graph; preserve all default API behavior and enabled-feature tests. |
| Core MDX customization | Preserving the original highlighter, Mermaid, images, code tabs, npm tabs, and structured data requires patching loader options. | Expose supported MDX extension options and a collection adapter; verify both Webpack and Turbopack plus the same content/UI checks. |
| Core package aliases | The broad `fumadocs-core` alias breaks custom `source`, `page-tree`, and `highlight` imports in Webpack. | Resolve exported subpaths correctly and respect the application's dependency graph. Retest default themes, providers, and OpenAPI integrations. The fixture currently removes these broad aliases. |
| Core rewrite precedence | Automatic Markdown rewrites intercepted the original `/docs/*.md` handler and returned 404. | Preserve explicitly configured matching routes. The fixture currently puts original rewrites first; add coverage for Markdown negotiation and existing automatic routes before changing the core default. |
| Collection bridge | Metadata/schema/Git work repeats when Next reloads config. | Integrate generation with the build lifecycle and cache only with complete input invalidation, including additions, deletions, schema changes, and Git dates. |
| Shared assistant-ui rendering | API type tables import the full Shiki highlighter although they highlight TypeScript types. | Profile a smaller highlighter and repeated-type caching as a separate experiment. Both frameworks could benefit; this is not a demonstrated Farming-only win. |

The first performance experiment should isolate the additional API/dependency work. Keep the compatibility fixes and the existing feature checks while measuring that change; do not remove user-visible behavior to obtain a lower time.

## Method and limits

- Apple M1, arm64, 16 GiB RAM; Node **24.21.0**; Next **16.4.1**; React **19.3.0**; Fumadocs core **16.16.2** and MDX **15.4.6**; Shiki **4.5.0**.
- Three serial runs per provider, alternating pair order. Each removes its own `.next` directory. Webpack filesystem caching is disabled equally because normal-cache setup runs exhausted local disk space. OS and dependency caches are not cleared. No browser tests or other benchmark compilers ran alongside timed trials.
- This shared machine used several GiB of swap. The result describes this local configuration; repeat on a dedicated builder with normal caching before making deployment claims or evaluating warm rebuilds.
- The assistant-ui source is a snapshot of `ba593a83c66715c4633a8bb980647edcaf58e507` **including tracked uncommitted work**. Source inputs were hashed and remained unchanged through the six trials. No `.env` files were copied. The 22 required workspace packages were rebuilt from the snapshot; installed external dependencies were reused read-only from another local checkout, not freshly installed from the source lockfile.
- Common workspace builds and type-table generation are setup costs outside both build timers. Farming's collection generation runs inside its timer. Real font files, with all nine subsets, are served locally on both sides; font downloading and `next/font` generation are excluded. Tailwind scans are bounded equally.
- **103 non-scope route modules are excluded** from both fixtures. Marketing pages, live AI/backend services, and demos are not fully migrated or validated. Auth-session/demo-usage endpoints and docs Markdown handlers are retained where the shell depends on them. A complete deployment needs the excluded routes and real service configuration restored and tested.
- Farming retains Fumadocs core's source loader and the small collection runtime for the original sidebar/search interfaces. This compares the MDX pipelines under the original custom shell, not the two frameworks' default themes. Copied content has no usable Git history in the fixture; last-modified dates are therefore unknown on both sides. Blog processed-Markdown exports are outside the tested scope.

See [measurements.json](results/2026-10-16/measurements.json) for compact receipts and [README.md](README.md) for reproduction. Full logs, fixtures, traces, and screenshots remain in ignored `artifacts/`; they include local source and must not be published accidentally. The shared platform-switching failure and untested live services mean this remains an experiment, not a production-ready migration.

## Farm.js + Farming docs comparison — October 16 follow-up

Farm.js + Farming docs reduces cold application-build time in the measured request-rendered
configuration, but it does not yet solve the repeated-build complaint. Its unchanged and
one-page-edit builds remain slower than both Next.js configurations. No framework implementation
or production site was changed for this comparison.

The [completed CI run](https://github.com/farming-labs/docs/actions/runs/38985057198) passed
**36 builds and their production runtime checks**: 100 identical generated MDX pages, three
trials for each provider and mode, all on one Ubuntu runner with four AMD EPYC 7763 vCPUs,
15,989 MiB RAM, and Node 24.21.0. These are medians in seconds; ranges and every sample are in
the [summary](../farmjs-docs/results/2026-10-16/final/summary.json) and
[raw results](../farmjs-docs/results/2026-10-16/final/results.json).

| Configuration | Cold app build | Unchanged rebuild | One-page edit | Prerendered docs pages |
| --- | ---: | ---: | ---: | ---: |
| Fumadocs + Next.js | 20.41 | 5.72 | 8.06 | 100 |
| Farming docs + Next.js | 24.15 | 7.38 | 8.25 | 100 |
| Farming docs + Farm.js, Node output | 13.25 | 12.84 | 12.42 | 0 |
| Farming docs + Farm.js, Vercel output | 15.14 | 15.18 | 14.75 | 0 |

Farm's Node cold build is **35.0% faster than Fumadocs + Next** and **45.1% faster than
Farming docs + Next** here. Its unchanged rebuild is **124.7% slower than Fumadocs** and its
edit rebuild is **54.1% slower**. The Vercel-output cold build is 25.8% faster than Fumadocs;
the cached and edit builds are 165.7% and 83.0% slower. These Vercel rows build the actual
deployment artifact and exercise its emitted function locally through an HTTP/Web Request
bridge. They do not measure Vercel installation, deployment upload, CDN routing, or cloud
cold starts.

### Rendering policy and correctness limits

The Farm MDX fixtures emitted **zero static docs HTML files**, despite configured prerender
route rules. They compile their code at build time and render HTML on request. The Next
fixtures prerender all 100 pages. This is a comparison of the observed configurations, not
proof that Farm performs equivalent static work faster or supports progressive compilation.

A separate ten-page Farm static control used supported `ssg` route exports and did emit all
ten HTML pages. It built in 9.31 seconds on the smoke runner, but failed the client-navigation
check: selecting a sidebar page performed a full document reload. All ten content responses
had passed before this failure. The docs navigator requests JSON with a custom header at the
page URL; static HTML can satisfy that URL before the docs runtime handler runs, causing the
navigator's reload fallback. The [failure receipt](../farmjs-docs/results/2026-10-16/smoke/static-navigation-failure.json)
and build/server logs are retained. This failed configuration is excluded from the results
table and is not a recommended migration setting.

Every accepted build passed content checks for all 100 URLs, highlighted code, tables,
clipboard copy, client navigation without a document reload, search and search-result
navigation, mobile sidebar navigation, overflow checks, and edit visibility where applicable.
No browser page exceptions were recorded. Farm Node and Farm Vercel desktop/mobile screenshots
match byte-for-byte; Farm and Farming Next mobile screenshots also match. Their 100-page
desktop screenshots look consistent on inspection but are not byte-identical. The earlier
ten-page smoke fixture had byte-identical Farm/Next screenshots at both widths.
[Screenshots and hashes](../farmjs-docs/results/2026-10-16/final/visual-comparison.json) are retained.
These checks do not cover every framework feature: AI is disabled and there are no custom
assistant-ui components in this generated corpus.

| Cold-build/runtime measurement | Fumadocs + Next | Farming + Next | Farming + Farm Node | Farming + Farm Vercel |
| --- | ---: | ---: | ---: | ---: |
| Initially loaded browser JS, gzip bytes | 239,342 | 281,167 | 225,930 | 225,930 |
| Sampled peak process-tree RSS, MiB | 2,975 | 3,157 | 1,936 | 2,385 |
| Fresh-server first HTML response, ms | 220 | 551 | 173 | 188 |

Browser bytes count scripts actually loaded by the test browser, using the same gzip method
for all providers; this differs from the older report's HTML-referenced script metric.
Farm's measured payload is 5.6% smaller than Fumadocs and 19.6% smaller than Farming Next.
RSS can count shared memory multiple times. First-response timing starts after TCP readiness
and measures a complete local HTTP response, not server startup, browser LCP, or a Vercel
function cold start.

### Changes to prioritize in the core

| Priority | Current behavior / evidence | Proposed change | Required validation |
| --- | --- | --- | --- |
| 1 | Farm reports 2,400 + 5,085 module transforms across its SSR/client builds in each cold, unchanged, and edited build. The totals overlap and are not unique modules. Warm builds save little time. | Reuse compiled MDX and shared compiler/highlighter work across builds and, where equivalent, across client/server compilation. Profile persistent production bundle reuse separately. | Content/import/config/plugin-version edits, additions/deletions, and cache restoration must invalidate correctly; rerun all three modes and runtime checks. |
| 2 | Static docs HTML intercepts JSON navigation requests; the ten-page static control reloads the document. MDX route rules alone did not generate static docs HTML. | Give static docs a reliable page-data endpoint or emitted data files, and integrate docs pages with Farm's static route discovery. | Prerender every expected URL and preserve same-document navigation, search, copy, and mobile behavior in Node and Vercel output. Then repeat a matched static comparison. |
| 3 | The Farm adapter's config entry imports `docsMdx` and its compiler dependencies; Farm's generated server entry also imports user config. Farm's own docs separates the runtime adapter from the Vite plugin. | Make the supported `withDocs` integration keep compiler-only dependencies out of runtime configuration while preserving the public API. | Compare traced dependencies, artifact size, startup, and whole-build time; test plugin hooks and all supported rendering modes. No gain is claimed yet. |
| 4 | A local compatibility probe failed because this docs monorepo's global H3 v1 override conflicted with Nitro 3's H3 v2 imports. The pinned Farm source lockfile passed CI. | Scope dependency overrides by the compatible major and add a real Farm production integration smoke build to docs CI. | Exercise both Node and Vercel generated outputs using supported dependency versions. The old installed beta probe is not a failure of the pinned Farm source used above. |

Vite's documented dependency prebundling cache is for development; enabling it alone does not
establish production compilation reuse. See the [official Vite documentation](https://vite.dev/guide/dep-pre-bundling).
The first priority addresses repeated PR builds directly. The second is necessary before
claiming a feature-preserving static-build advantage.

### Real Farm Vercel deployment and reproducibility

An independently recorded [Farm docs deployment](https://docs-4cyxnttkf-kinfe123s-projects.vercel.app)
at source `22ea5fb` took **115.80 seconds** from the first build log to “Build Completed” on
two cores / 8 GB in iad1, with a restored cache and 106 page routes. Its command also built
workspace packages and generated Prisma output. Farm's own build log spans 78.28 seconds;
the two bundle phases reported 23.27 and 45.81 seconds, and Nitro reported 14.60 seconds.
Cache creation (118.26 seconds) and upload (10.01 seconds, 602.25 MB) occur after the
“Deployment completed” log and are not added to application-build time here.
[Filtered timing receipts](../farmjs-docs/results/2026-10-16/recorded-farm-vercel/summary.json)
retain those distinctions. Different hardware, source, content, and setup prevent comparing
this deployment's elapsed time directly with the synthetic table.

The final comparison uses docs framework source `bfe194fbea6c561e7bd76374a8ec0088e9d46e37`
and Farm source `7c76f2d597297be015df0c966d25b0f4fa7fc826` (core/CLI 0.1.1-beta.3), built
from source in CI. It does not include the separate unmerged performance PR stack. Next is
16.3.8, React 19.2.4, TypeScript 5.9.3, Fumadocs core/UI 16.17.1, and Fumadocs MDX 15.4.7.
Framework-internal build dependencies follow their respective lockfiles: for example, Farm's
Vite 8.1.5 build logs include internally generated Tailwind 4.1.18 CSS, while the application
dependency and Next PostCSS fixture use Tailwind 4.2.1. This compares the pinned integrations,
not one identical compiler dependency tree.
Dependency installation and framework package compilation are outside the timer; application
TypeScript checking is included for every provider. Farm runs `tsc --noEmit` before `farm build`.
Cold means a fresh generated app and its output/cache; OS and CLI-wide caches are not reset.
Provider order rotates across trials, and timed builds run serially. Each corpus contains
755,580 source bytes before the edit, with six code blocks and six tables per page.

The [earlier repeated run](https://github.com/farming-labs/docs/actions/runs/38984252093)
had 27 successful Node/Next rows and three rejected Vercel rows caused by the harness assuming
a Node function instead of Nitro's Web `fetch` handler. That harness bug was corrected for the
final successful run. The earlier AMD EPYC 9V45 runner was faster than the final EPYC 7763;
do not mix absolute times across runs. The final results above supersede the preliminary
numbers for the four-provider comparison.

Run the manual [workflow](../../.github/workflows/docs-build-benchmark.yml) on branch
`codex/farmjs-docs-benchmark` with `pages=100` and `trials=3`. The measured harness commit is
`8b214cdb0e8b7c3761b9f889f7d402602f34a44e`; subsequent receipt/report and formatting changes
do not change the measured framework source. The [runner](../farmjs-docs/run.py),
[fixture generator](../farmjs-docs/prepare.mjs), and [runtime checks](../farmjs-docs/verify.mjs)
are retained alongside every final build log and runtime JSON result. No benchmark PR was
created or merged in this follow-up.

**Scope:** this is a controlled Farm.js integration benchmark, not a completed Farm port of
assistant-ui. That site has 337 docs pages, 120 pages with MDX imports, custom collections,
and Next-dependent shell/components. Its full Farm migration and production feature parity
remain unverified; the earlier assistant-ui/Next timings above are unchanged.

## Farm.js repeated MDX compilation cache — October 16 implementation

[PR #574](https://github.com/farming-labs/docs/pull/574) adds persistent compilation reuse
inside `@farming-labs/farmjs`. Previously, an unchanged production build parsed, transformed,
and highlighted every MDX page again. The adapter now reuses compiled code and source maps
when its inputs match. Imported components, CSS, routes, bundling, and server packaging still
run through the existing build pipeline; the PR changes no UI components or rendering policy.

The [final comparison](https://github.com/farming-labs/docs/actions/runs/38990443258) passed
36 production builds and their runtime checks, using 100 generated pages and three trials
per mode/cache setting on one runner. The table shows medians including application
TypeScript checking. Cache-off and cache-on use identical framework code; only `buildCache`
changes. Every warm/edit build launches a fresh CLI process. Cache order alternates by trial,
and provider order reverses on trial two.

| Output | Mode | Cache off | Cache on | Change |
| --- | --- | ---: | ---: | ---: |
| Node | Cold | 9.58 s | 9.59 s | 0.1% slower |
| Node | Unchanged | 9.59 s | 7.12 s | 25.8% faster |
| Node | One-page edit | 9.59 s | 7.50 s | 21.8% faster |
| Vercel artifact | Cold | 9.78 s | 10.00 s | 2.3% slower |
| Vercel artifact | Unchanged | 9.60 s | 7.49 s | 21.9% faster |
| Vercel artifact | One-page edit | 9.58 s | 7.53 s | 21.5% faster |

Unchanged rebuilds improve by **25.8% on Node and 21.9% for Vercel output**. One-page edits improve by **21.8% and 21.5%**, respectively. Cold Node builds are effectively unchanged (+0.1%); cold Vercel builds cost 2.3% more. These cold-build costs are included rather than hidden.

Every enabled build retained 100 cache entries (about 6.5 MiB). Initially loaded
browser JavaScript and emitted application size match in all 18 corresponding cache-on/off
pairs. The cache stays outside deployment output. Ranges, RSS, typecheck/build splits, cache
sizes, and every sample are in the [final summary](../farmjs-docs/results/2026-10-16/cache-final/summary.json).

Sampled cold process-tree RSS rose from 2,416 to 2,473 MiB on Node and from 2,189 to
2,510 MiB for Vercel output. Unchanged-build RSS fell from 2,416 to 2,224 MiB and from
2,316 to 2,143 MiB, respectively. This is sampled process-tree memory, which may count
shared memory more than once; it is not a JavaScript heap measurement.

### Correctness and compatibility

All 36 builds served complete content for all 100 URLs. Browser checks cover highlighted code,
tables, clipboard copy, client navigation without a full reload, search and search-result
navigation, mobile sidebar navigation, desktop/mobile overflow, browser exceptions, and
fresh content after an edit. Cached and uncached desktop/mobile screenshots were inspected;
[visual comparison receipts](../farmjs-docs/results/2026-10-16/cache-final/visual-comparison.json)
record their hashes and pixel differences. These checks cover this fixture, not every possible
consumer feature. AI is disabled equally on both sides; custom assistant-ui components and its
full 337-page Farm migration remain outside this run.

The adapter suite passes 78 tests locally and on Linux, including real Vite production builds,
source-map/output equivalence, content/theme/mode/compiler invalidation, imported-component
edits and deletions, virtual-module exclusions, error propagation, cache opt-out, corrupt or
unwritable caches, bounded storage, and unchanged dev/watch behavior. The unchanged-build
regression fails when the cache wrapper is removed. A virtual-module test reproduced a failure
in the initial implementation before the final compatibility fix. The adapter package build,
TypeScript checks, focused lint, formatting, and PR checks pass.

### Cache retention and remaining costs

The default cache is `<Vite cacheDir>/farming-docs/mdx-v1.json`, normally under
`node_modules/.vite`. Preserve that directory between CI jobs. Stable project/dependency paths,
Node version, and compiler bytes are required for reuse; mismatches safely recompile. The
cache retains at most 1,024 modules and approximately 32 MiB. `buildCache: false` opts out.

Vercel's default static-build cache includes `node_modules`; an explicit Build Output API
`cache` list replaces that default selection, so custom lists must include the adapter's
cache directory. This follows the [default cache glob](https://github.com/vercel/vercel/blob/main/packages/build-utils/src/default-cache-path-glob.ts)
and [cache preparation implementation](https://github.com/vercel/vercel/blob/main/packages/static-build/src/index.ts#L868-L911).
Actual cross-deployment cache restoration on Vercel has not been measured in this experiment.

The Vercel rows build the deployment artifact and execute its emitted function locally.
Dependency installation, framework package compilation, upload, CDN routing, and cloud cold
starts are excluded. Both cache settings prerender zero docs HTML pages and render on request;
no work was removed by changing rendering policy. These new times must not be compared directly
with the earlier Fumadocs/Next table: the Farm version and runner differ. This PR demonstrates
repeated-build improvement, not an overall win against Fumadocs or complete incremental bundling.

The earlier cache comparison still transformed 2,398 and 5,090 modules in the two bundle graphs
with caching either off or on. Those overlapping counts are not unique modules. Compiled MDX
reuse reduces work within those transforms; the remaining bundle traversal, type checking, and
Nitro packaging are the next optimization targets. The static-navigation issue identified above
also remains separate and must be resolved before claiming equivalent static output performance.

### Provenance and reproduction

Measured docs/harness commit: `c6d48c341e53bba50aecd0377b5ad0f853d2691e`. Its package tree is
identical to implementation PR commit `cbb54e7854d9eb0aa4128c832b42e4cb54579dfd`.
Farm source is pinned to `85628bbea1bd7bfe1d0728d071b85335b4a208b1` (core/CLI 0.1.19).
The final runner used Ubuntu 24.04, four AMD EPYC 9V45 vCPUs, 15,989 MiB RAM, and Node 24.21.0; the Farm build logs report Vite 8.3.4.
Frameworks are built from their lockfiles outside the timers. Cold starts with a fresh generated
app and no app build cache; OS and CLI-wide caches are not cleared. The source corpus is 755,580
bytes with six code blocks and six tables per page. The edit adds one paragraph to one page.

Run `docs-build-benchmark.yml` on `codex/farmjs-docs-benchmark` with `pages=100`, `trials=3`,
`compare_cache=true`, and the pinned `farm_ref` above. Download its artifact and run
`python3 benchmark/farmjs-docs/compare-cache.py <artifact-directory> --out <summary.json>`.
[Final logs and runtime JSON](../farmjs-docs/results/2026-10-16/cache-final/) are retained.
The [initial completed run](https://github.com/farming-labs/docs/actions/runs/38989194053)
used the same A/B design before the virtual-module fix: unchanged builds improved 24.9%/24.4%
(Node/Vercel), edits improved 22.1%/21.1%, and cold builds cost 3.1%/3.3% more. Its
[receipts](../farmjs-docs/results/2026-10-16/cache-initial/summary.json) remain separate; the
final results above supersede it. No benchmark PR was created or merged.

## Follow-up: avoid rewriting an unchanged MDX cache

[PR #575](https://github.com/farming-labs/docs/pull/575) is merged after all applicable checks passed (`fca13817`), following merged #574 (`eacd4388`). The cache
previously serialized an entry twice on each hit and wrote the complete cache at each
build-end hook. The follow-up stores entry sizes, refreshes hit eviction order in memory,
and writes only after compiled entries change. Overlapping flushes are serialized so an
older snapshot cannot overwrite newer entries; failed writes can be retried. The cache
format, keys, compiled output, components, routes and rendering policy are unchanged.
Hit-only eviction-order changes are saved with the next content change.

The regular PR workflow now runs the Farm adapter suite alongside the other adapters,
reusing its existing core/theme build prerequisites. Previously the Farm tests were absent
from that job. All 81 tests pass locally and in the Linux PR test job; the package build/typecheck,
lint and formatting pass locally. The [Linux adapter log](../farmjs-docs/results/2026-10-16/cache-store/linux-adapter-tests.log) records the CI run.
Two new regressions fail against the merged baseline and pass with the fix;
[before/after test logs](../farmjs-docs/results/2026-10-16/cache-store/) are retained.

An **isolated cache-store experiment** uses 100 real compiled pages from the shared corpus,
a 6,758,451-byte cache, and two passes/flushes representing two bundle graphs. Ten trials
follow two warmups; baseline/candidate order alternates. This runs on the local Apple M1
with Node 24.21.0, explicit GC outside timing, and identical output assertions in all samples.

| Cache operation | Before, median | After, median | Bytes written before | Bytes written after |
| --- | ---: | ---: | ---: | ---: |
| Unchanged inputs | 129.89 ms | 43.72 ms | 13,516,902 | 0 |
| One changed entry | 124.67 ms | 75.42 ms | 13,517,106 | 6,758,553 |

These timings cover loading, cache lookups and persistence only. The changed compilation
result is prepared before timing; MDX compilation, bundling, type checking and deployment
are excluded. The absolute saving is about **86 ms / 49 ms** in this experiment. It is
not a demonstrated whole-build percentage improvement and must not be combined with the
Linux CI timings. All samples and ranges are in the
[cache-store summary](../farmjs-docs/results/2026-10-16/cache-store/summary.json); the
[reproduction script](../farmjs-docs/cache-store-benchmark.mjs) accepts the baseline Git ref,
candidate source file and output path. Baseline is merged #574 (`eacd4388`); the measured
implementation is `d9ed9ef4`. The later CI-only commit does not change the implementation.

### Remaining work found in the scan

1. **Reuse the remaining production bundle work.** Even unchanged builds still transform
   2,398 and 5,090 modules across the two overlapping bundle graphs. MDX cache reuse skips
   compilation inside those transforms, not graph traversal or bundling. A production
   bundle cache needs invalidation for component/CSS/dependency/config edits and deletions.
2. **Separate compiler configuration from runtime imports.** `withDocs` imports `docsMdx`,
   which imports the MDX/highlighter graph and broad core/server entrypoints. The pinned
   Farm source's generated server entry imports the user's Farm config
   (`universal-build.ts`, lines 5602 and 5794–5798 at `85628bbe`). The build logs show MDX
   compiler modules in the bundle. A narrower runtime path is a candidate; its full-build
   gain remains unmeasured. Preserve custom config factories and runtime MDX fallbacks.
3. **Prove equivalent static navigation before claiming a static-build win.** The Farm
   route-MDX fixtures render docs on request, whereas both Next fixtures prerender all
   100 docs pages. The earlier Farm static control failed the client-navigation gate.
   Fix the static page-data/navigation path before making equivalent-output comparisons.
4. **Verify real deployment cache restoration.** The successful repeated-build experiments
   retain the local cache directory across CLI processes. A real Vercel cold deployment,
   unchanged deployment and one-page edit must show restoration and fresh content. Local
   Vercel output generation/execution does not establish cloud pipeline improvement.
5. **Reduce the assistant-ui migration bridge cost on Next.** Its prior custom collection
   bridge contributed about two seconds of config work and the constrained Next port
   remained slower. Cache collection work only after testing content/schema/Git-history
   invalidation; the Farm-only MDX cache does not speed up that Next integration.

## Current migration comparison after the MDX cache fix

[Run 38991961334](https://github.com/farming-labs/docs/actions/runs/38991961334) completed
all **36 production builds** and their browser/route checks. It compares four integrations
on one runner after #574, with three trials per cold/unchanged/one-page-edit case.
These are medians including application type checking:

| Integration | Cold | Unchanged | One-page edit | Docs pages prerendered |
| --- | ---: | ---: | ---: | ---: |
| Fumadocs + Next | 15.24 s | 4.19 s | 6.29 s | 100 |
| Farming docs + Next | 18.65 s | 5.65 s | 6.28 s | 100 |
| Farming docs + Farm, Node output | 11.69 s | 8.78 s | 8.77 s | 0 |
| Farming docs + Farm, Vercel output | 11.68 s | 8.38 s | 8.77 s | 0 |

### What the migration helps, and where it does not

- **Switching only the docs layer on Next does not resolve the build complaint in this
  corpus.** Farming/Next is 22.4% slower cold and 34.9% slower unchanged; one-page edits
  are effectively tied (the 0.004-second median difference is not a meaningful win).
- **Switching the application framework to Farm improves the observed cold build:**
  about 23.3% faster than Fumadocs/Next, or about 37.3% faster than Farming/Next.
  This is conditional on the rendering setup: Farm emits zero static docs HTML pages
  and renders on request; Next emits all 100. It is not an equivalent-static-output win.
- **The repeated-build gap is not closed.** Farm Node and Vercel unchanged builds take
  2.10× and 2.00× the Fumadocs/Next time, respectively; one-page edits take about 1.40×.
  #574's separate cache-on/off experiment establishes a 21–26% rebuild improvement
  within Farm, but the absolute times from its different runner must not be mixed
  with this table.
- **Initially loaded browser JavaScript is smaller with Farm in this fixture:**
  211.43 KiB gzip versus 233.73 KiB for Fumadocs/Next (9.5% less). Farming/Next loads
  274.58 KiB (17.5% more than Fumadocs). These are browser-observed script responses
  after network idle, not sums of every emitted chunk. An edit adds about 0.05 KiB
  on Farm. No page-load speed or Core Web Vitals conclusion follows from bytes alone.

On unchanged Farm builds, type checking contributes a median 1.67 s for Node and
1.46 s for Vercel output. Logged bundle phases take roughly 2.8–3.2 s each and overlap;
they must not be added as sequential wall time. Nitro server packaging still takes
about 2.2 s. Both graphs transform the same 5,090 and 2,398 modules even when all 100
MDX entries are cached. Reusing bundle work and narrowing runtime/compiler imports
are the larger next targets; skipping unchanged cache writes is a smaller improvement.

The Next integrations also expose different default build graphs: Farming emits **104
route modules**, including `/api/docs` and `/api/docs/mcp`; Fumadocs emits **4 route
modules**, using one docs catch-all and `/api/search`. Both prerender 100 docs URLs.
This is a concrete next investigation for the Next adapter: test a shared docs route
without removing metadata, rewrites, per-page overrides or automatic APIs. Route count
is an observation, not proof that it explains the whole time gap. Extra Farming
capabilities were not disabled merely to improve the timing.

### Validation and limits

Every build served the correct complete article on all 100 URLs. All browser gates pass:
highlighted code, six tables, clipboard, same-document client navigation, search API and
result navigation, mobile sidebar, desktop/mobile overflow, browser errors and fresh edited
content. Eight representative desktop/mobile screenshots (five distinct images) were
inspected. Farm Node and Vercel screenshots match; the Farming/Next mobile screenshot
matches both. Fumadocs defaults differ in sidebar width, description visibility and TOC
title treatment. This is a shared source/feature corpus, not a pixel-identical cross-framework
UI assertion. [Screenshot receipts](../farmjs-docs/results/2026-10-16/migration-current/visual-receipts.json) retain hashes of all 72 captures.

AI is disabled equally, and this does not port assistant-ui's custom shell, live services
or its 120 MDX-importing pages. The earlier constrained 337-page assistant-ui/Next result
remains a separate experiment. A complete assistant-ui Farm migration and exact production
UI/functionality parity are still unverified.

The Vercel row builds an artifact and executes its emitted handler locally. Installation,
framework package compilation, upload, CDN behavior and real deployment cache restoration
are outside the timer. Fresh CLI/server processes run for every build, and the cache is
retained locally for warm/edit cases. This establishes MDX compilation reuse, not
progressive production bundling or an end-to-end Vercel deployment improvement.

### Reproduction and provenance

- 100 generated pages, 755,580 source bytes, six code blocks and six tables per page;
  three serial trials with provider order rotated across trials. Cold means a fresh
  generated app/cache; the OS cache is not reset.
- Ubuntu 24.04, four AMD EPYC 9V74 vCPUs, approximately 16 GiB RAM, Node 24.21.0.
  The first Fumadocs cold sample was 19.36 s; the other two were 15.11 s and 15.24 s.
  All samples and ranges are retained rather than discarding that slower trial.
- Measured docs/harness commit `5f3b8bd9a651cb3a0ed2eca3ea5eccea55a3af22`; its
  `packages/` tree is identical to merged #574 (`eacd4388`). Farm core/CLI 0.1.19
  at `85628bbea1bd7bfe1d0728d071b85335b4a208b1`.
- Next 16.3.8; Fumadocs core/UI 16.17.1 and MDX 15.4.7; React 19.2.4; TypeScript
  5.9.3; Farming packages 0.2.120 from the pinned source. Provider manifests, locked
  dependencies and logged internal bundler versions are retained in the build receipts.
- **#575 is not included in this four-provider timing run.** Its source change is
  separately measured in the cache-store experiment above and passes 81 adapter tests
  locally and in Linux CI. No whole-build gain is claimed for that follow-up.

The [summary and every sample](../farmjs-docs/results/2026-10-16/migration-current/summary.json),
[raw build/runtime receipts](../farmjs-docs/results/2026-10-16/migration-current/) and runner
details are saved on the existing benchmark branch. No benchmark PR was created or merged.


## Docs-only tree-shaking experiment: rejected as a build fix

[Run 38994924362](https://github.com/farming-labs/docs/actions/runs/38994924362)
compares main `fca13817` with only `sideEffects: ["**/*.css"]` added to the theme
and Next adapter manifests (candidate [#576](https://github.com/farming-labs/docs/pull/576)).
The harness is `78d4f658`; package sources and lockfile match main. All 27 serial
100-page production builds pass, with three rotated trials for cold, unchanged,
and one-page-edit builds. Installation and package compilation are outside the timer.

| Case | Main | Metadata candidate | Fumadocs |
| --- | ---: | ---: | ---: |
| Cold | 24.315 s | 23.976 s | 19.741 s |
| Unchanged | 7.208 s | 7.212 s | 5.711 s |
| One-page edit | 8.046 s | 8.262 s | 8.265 s |

The cold median changes by -1.4% with overlapping ranges, unchanged builds are
flat, and the edit median is +2.7%. These results do not establish a material build
improvement. Browser-observed initial JavaScript is essentially unchanged:
281,170 versus 281,167 gzip bytes, compared with Fumadocs' 239,343 bytes. The small
change in HTML-referenced asset totals is not a browser download reduction.
The candidate remains 21.5% slower cold and 26.3% slower unchanged than Fumadocs;
one-page edits are effectively tied. Do not claim this change beats Fumadocs.

Both Farming variants retain 104 route modules and both automatic API routes;
Fumadocs has four route modules. Both prerender all 100 docs pages. Every runtime
check passes: all URLs and complete content, highlighted code, tables, search,
client navigation, clipboard, mobile sidebar, and fresh edited content. Farming
also passes Markdown rewrites, Accept negotiation, llms.txt, llms-full.txt, and MCP
initialization. CSS hashes match across all 18 Farming builds, and all 18 paired
desktop/mobile screenshot comparisons are pixel-identical.

Both packages build and typecheck; 150 adapter and 238 theme tests pass locally.
The PR's full CI, two Vercel previews, deployment smoke and cross-framework MCP
checks also pass. A separate local Webpack check fails on both baseline and candidate
with the same pre-existing MDX metadata/server-client compilation error; this is
not a passing Webpack compatibility result.

The benchmark uses the locked Node 24.21.0, Next 16.3.8, React 19.2.4, and Fumadocs
16.17.1/MDX 15.4.7 setup. Cold means a fresh app/build cache, not a cleared OS cache.
This is a synthetic shared corpus, not the complete assistant-ui site or Vercel
installation/upload/cache-restore pipeline. Absolute times must not be combined
with earlier runners. See [all samples, ranges, phases and provenance](../next-docs/results/2026-10-16/tree-shaking/summary.json)
and [raw receipts](../next-docs/results/2026-10-16/tree-shaking/).


## Docs-only focused configuration imports: repeated-build improvement

Merged as `0d66fc16` on 2026-10-17 UTC. No npm release was performed.

[PR #570](https://github.com/farming-labs/docs/pull/570) at `2861e94d` adds a focused
Node-only core build entry and uses it in Next configuration. Existing exports retain
their identity. No route, UI component, content, search, Markdown or MCP feature is removed.
[Run 38999715849](https://github.com/farming-labs/docs/actions/runs/38999715849) completes
all 27 production builds and correctness gates on one runner, with 100 pages and three
rotated serial trials. Medians include application type checking:

| Build | Broad imports | Focused imports | Within-Farming change | Fumadocs |
| --- | ---: | ---: | ---: | ---: |
| Cold | 14.475 s | 14.230 s | -1.7% | 12.093 s |
| Unchanged | 4.379 s | 3.962 s | **-9.5%** | 3.344 s |
| One-page edit | 4.801 s | 4.385 s | **-8.7%** | 4.817 s |

This establishes a measured repeat-build improvement in this corpus. Unchanged-build
ranges are 4.370–4.388 s before and 3.958–3.980 s after. The cold ranges overlap, so the
small cold median shift is not a material cold-build claim. Edited-build medians improve,
but the baseline/candidate ranges slightly overlap; three trials do not establish a
universal guarantee. Every sample and range is retained.

The focused candidate remains **17.7% slower cold and 18.5% slower unchanged** than
Fumadocs. It is **9.0% faster for one-page edits** in this fixture. Browser-loaded
JavaScript stays at 281,170 gzip bytes, versus Fumadocs' 239,346 bytes. This is not an
overall claim that Farming is faster or smaller than Fumadocs.

The isolated configuration check on this runner uses seven alternating fresh Node
processes: median import/setup falls **213.28 → 47.86 ms (77.6%)**, and loaded modules
fall **712 → 136 (80.9%)**. The entry keeps the runtime, MDX and OpenAPI graph out of
configuration startup. This startup percentage must not be presented as a full-build gain.

### Verification and method

- Both variants use the same core code containing the new build entry. The harness
  restores the old broad imports in the otherwise identical emitted config body for the
  baseline. This isolates import selection rather than all source changes in the PR.
  Harness commit: `284a28ed`; package sources match PR head `2861e94d` exactly.
- Four AMD EPYC 9V45 vCPUs, Ubuntu 24.04, approximately 16 GiB RAM, Node 24.21.0.
  The dependency versions remain Next 16.3.8, React 19.2.4, Fumadocs core/UI 16.17.1,
  MDX 15.4.7, and source-built Farming 0.2.120 packages. These absolute timings must
  not be mixed with the preceding experiment's different runner.
- Each cold case starts from a fresh app/build cache; the OS cache is warm. Warm/edit
  cases retain their own Next cache. Installation and framework package compilation
  are outside the timer. Tests and browser checks run outside timed builds.
- All 100 docs URLs are statically generated and served with complete correct content.
  Farming keeps 104 route modules and both automatic API routes; Fumadocs uses four.
  Search, same-document navigation, code copying, highlighting, tables, mobile sidebar,
  no overflow, and fresh edited content pass after every build. Markdown URL rewrites,
  Accept negotiation, llms.txt, llms-full.txt and MCP initialization also pass for Farming.
- CSS hashes match across all 18 Farming builds. All nine mobile pairs and four desktop
  pairs match exactly. The other five desktop pairs differ only in the fading sidebar
  scrollbar, at x273–278/y704–843; the images were inspected and every pixel outside
  that rectangle matches. Raw counts, hashes and representative images are retained.
- 1,546 core tests and 150 adapter tests pass locally, along with both package builds
  and typechecks. Current-head CI, security audit, cross-framework MCP, both Vercel
  previews, deployment smoke and review checks pass. The earlier separate Webpack
  fixture failed on main and the metadata candidate; no new full Webpack claim is made.
- This remains a synthetic same-corpus test, not a complete assistant-ui port or proof
  of all possible custom configurations. AI is equally disabled in both fixture providers.
- Release core with the new build entry (0.2.121 or later) before the new adapter.
  The adapter declares that peer floor, and the repository's release script bumps the
  core and adapter together. No npm publish was performed during this work.

### Actual Vercel website work still outside the core benchmark

An authenticated CLI read of [the PR preview](https://vercel.com/farming-labs/docs-website/g2r6UCf89QB5kK1TLAwzL8wGQhrX)
shows a four-core/8-GiB runner and the following observed costs:

| Stage | Observed duration |
| --- | ---: |
| Forced install across all 19 workspace projects | 36.7 s reported |
| Complete website build script | 165.7 s timestamp span |
| Five example app builds within that script | 104.6 s timestamp span |
| Website's own Next build through Vercel build completion | 39.7 s timestamp span |
| Website compilation / typecheck / static generation | 25.1 / 8.3 / 2.6 s reported |

The example stage includes a second core rebuild from Astro and an automatic
Svelte Vercel-adapter install taking 12.5 s. The website build generates 67 routes;
its sitemap covers 53 docs pages. These are one observed deployment's stages, not a
controlled before/after savings estimate. No Vercel settings or website build scripts
were changed in this docs-core optimization. The existing website build/install-scope
PRs #572/#573 remain separate work.

The largest remaining consumer targets are the 104-vs-4 route graph and the remaining
client JavaScript overhead; neither should be reduced by dropping features, custom page
metadata/layouts or static output. For the repository's Vercel complaint, isolating the
website build from five example builds is the much larger observed pipeline opportunity.

[Summary, ranges and provenance](../next-docs/results/2026-10-16/config-imports/summary.json),
[startup measurements](../next-docs/results/2026-10-16/config-imports/config-startup.json),
[visual comparisons](../next-docs/results/2026-10-16/config-imports/pixel-comparison.json),
and [Vercel phase receipts](../next-docs/results/2026-10-16/config-imports/vercel-build-phases.txt)
are retained alongside raw build/runtime logs. No benchmark PR was created or modified.


### Follow-up: repeated core Markdown section processing (October 16)

Two independent core PRs preserve the public parser and rendered output:

- [#577](https://github.com/farming-labs/docs/pull/577), `423e2750`, computes section boundaries in one forward pass. The previous loop copied 12,497,500 heading references on a 5,000-heading document. Each heading now enters/leaves the open-section stack at most once. Seven alternating local full-parse trials show mixed timing results: valid 5,000-heading MDX is 300.56 → 297.51 ms; malformed-MDX fallback is 128.76 → 121.61 ms; 100-heading fallback is 4.14 → 4.51 ms. The deterministic improvement is eliminating quadratic allocation, not a proven deployment speedup.
- [#578](https://github.com/farming-labs/docs/pull/578), `130c1dfc`, reuses unchanged section parses with an in-process LRU keyed by exact Markdown body. It retains normalized source and section boundaries, not duplicated nested section content. Limits are 1,024 entries and 8,000,000 retained string characters (not a total heap-byte guarantee). Results are recreated for each caller; edits, audience projections, metadata, authorization, and query ranking retain their behavior. It does not persist MDX compilation between builds.

The cache-only comparison below uses main `0d66fc16` and `130c1dfc`, Node 24.21.0 on an Apple M1, and seven alternating serial warmed trials. Each trial measures a complete `performDocsSearch` call with the simple provider, `configure` query, and ten-result limit. Inputs are sorted real assistant-ui source files, with the same synthetic URLs and path-based titles on both sides; the 100-file case uses the first 100. Imports and source reads are outside the timer. These are core search measurements, not browser/network latency or Fumadocs comparisons.

| Warm corpus / audience | Before | Cached | Reduction |
| --- | ---: | ---: | ---: |
| 100 files / human | 289.11 ms | 35.76 ms | 87.6% |
| 100 files / agent | 307.38 ms | 39.26 ms | 87.2% |
| 511 files / human | 2,511.16 ms | 386.85 ms | 84.6% |
| 511 files / agent | 4,094.79 ms | 672.34 ms | 83.6% |

First human search over all 511 files, in three fresh Node processes per variant, measures 11.37 → 10.53 seconds median. The first request remains expensive; this is not an 84% cold-start improvement. Median retained JS heap after forced GC is 21,494,456 → 22,585,192 bytes (about 1.04 MiB extra on this corpus). All six result hashes match. Local scheduling and JIT variance apply; every sample is retained.

Validation: 1,548 core tests for the linear-boundary PR; 1,554 core and 150 Next tests for the cache PR; builds, typechecks, lint/format, and 4,599 comparisons per PR across 511 assistant-ui Markdown/MDX files. Comparisons cover unchanged, edited, malformed, repeated, and caller-mutated results. The cache suite tests eviction, character limits, oversized documents, empty sections, nested content, and CRLF normalization. A locally contended test run hit three timeouts; the full suite rerun with two workers passes, and the PR CI test job also passes.

Raw local data and runnable scripts are under `benchmark/next-docs/results/2026-10-16/sections/` and `benchmark/next-docs/benchmark-section-*.mjs`; the corpus fingerprint is `5a86ce7021ed6d38ea93de1327bd9ad56ab4b5eff7a86a20331c67c74707be0d`.

The combined source also passes all **1,556 core tests**. The separate [production comparison](https://github.com/farming-labs/docs/actions/runs/39002234194) completed on a fresh Ubuntu 24.04 runner with four AMD EPYC 7763 vCPUs, 15,989 MiB RAM, Node 24.21.0, Next 16.3.8, and the same 100-page / 755,580-byte corpus. Three trials rotate the serial variant order; cold means fresh app/.next with OS caches potentially warm. Installs and package builds are outside the timer. Source `2d8745ed` contains both PRs; the baseline restores the emitted section module from main `0d66fc16`, with other package/fixture settings unchanged.

| Production build median | Main | Both PRs | Fumadocs control |
| --- | ---: | ---: | ---: |
| Cold | 23.064 s | 23.442 s | 19.823 s |
| Unchanged repeat | 6.552 s | 6.752 s | 5.707 s |
| One-page edit | 7.594 s | 7.616 s | 8.260 s |

**No full-build improvement was observed.** Combined medians are 1.6% / 3.1% / 0.3% slower than main; all corresponding ranges overlap. Both Farming variants remain about 18% slower than Fumadocs for cold/repeat builds; the candidate is 7.8% faster on this one-page edit fixture, already an advantage in the baseline. These PRs do not establish an overall Fumadocs win and should be judged as core parsing/search improvements. Do not compare these absolute times with the earlier EPYC 9V45 configuration-import run.

All 27 builds and runtime checks passed: 100 correct static articles each, syntax highlighting, tables, client navigation, copy, search/result navigation, mobile sidebar, no overflow or browser exceptions, and edit freshness. Farming Markdown URLs, Accept negotiation, llms.txt/full, and MCP initialization also pass. Both Farming variants keep 104 route modules and both API routes; Fumadocs has four route modules. All 18 paired desktop/mobile screenshots are pixel-identical. CSS hashes match across every Farming build; browser-observed JS is 281,170 → 281,173 gzip bytes, effectively unchanged. AI is disabled equally in this fixture; this is not a full assistant-ui UI migration check.

[Full timing samples, logs, screenshots, runtime receipts, and summary](../next-docs/results/2026-10-16/sections/ci-39002234194-1/) are retained. The existing benchmark PR #569 remains untouched. The verified deployment-specific waste (five example apps and discarded oversized install caches) is still covered by existing open PRs #572 and #573; these new core PRs do not replace those fixes.

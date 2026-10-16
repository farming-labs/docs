# assistant-ui docs migration experiment — 2026-10-16

The isolated Farming port builds and preserves the tested docs content, but it is **slower in this experiment**: **113.45s versus 86.36s**, a **31.4%** increase. This is a constrained local Webpack comparison with disk caching disabled on both sides, not a default Vercel or Turbopack benchmark. The production assistant-ui checkout was not migrated or edited.

PRs [#560](https://github.com/farming-labs/docs/pull/560), [#561](https://github.com/farming-labs/docs/pull/561), and [#562](https://github.com/farming-labs/docs/pull/562) were squash-merged after their checks passed. The benchmark uses merged framework revision `bfe194fbea6c561e7bd76374a8ec0088e9d46e37`. No new benchmark PR was opened.

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

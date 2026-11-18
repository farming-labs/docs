# Highlighted-code cache in Next production builds

Measured November 18, 2026 on `403ddb6c` with the cache change applied. The question: can
build-time syntax highlighting cost less without giving up the JavaScript remark and rehype plugin
chain?

**Only by reusing output.** Generating code ahead of time for Shiki's grammars does not shorten its
startup, because the first highlight warms up the tokenizer, not the regular expressions. Storing
highlighted blocks under `.next/cache` halves MDX CPU time when the highlight cache survives and
Turbopack's cache does not. An empty cache costs 6–10% more MDX CPU. Wall-clock gains were 0.7 s
(7%) in the quieter run and within noise in the busier one.

## What the cache does

`@farming-labs/next/mdx-plugins/rehype-code` wraps Fumadocs' `rehypeCode`. When its options are
plain JSON, as `withDocs()` passes them, it stores each highlighted block's HAST fragment in
`<distDir>/cache/farming-labs/code-highlight/<scope>/`. The scope digests the Fumadocs, Shiki and
`@shikijs/*` versions and every highlighter option. The key is Fumadocs' own `lang:meta:code`. A
file whose blocks are all stored never starts Shiki. Every other remark and rehype plugin still
runs on every compile.

Blocks are stored only when the output depends on nothing but the block:

- Languages whose grammars inject into other scopes (`ts-tags`, `lit`, `es-tag-*`, Angular, Vue
  injections, Nix) are never stored. Once one is loaded, the languages it injects into are not
  stored or read for the rest of the process.
- Languages that embed other languages only if those are already loaded (`md`, `mdx`, `vue`,
  `svelte`, `astro`, `pug`, `haml`, `latex`, `asciidoc`, `wikitext`) are never stored.
- A block that took longer than Shiki's `tokenizeTimeLimit` (500 ms by default) between missing
  the cache and being stored is not stored. Shiki stops styling a line at that limit without
  reporting it, and the whole block is tokenized inside that interval, so a faster block cannot
  contain a cut-off line.
- Unknown languages are not stored. Custom grammars (`langs`), `langAlias`, `lazy: false`,
  `inline` and options that are not plain JSON turn the cache off.

## Setup

Apple M1, 8 logical CPUs, 16 GiB RAM, macOS, Node 24.21.0. Next 16.4.3 with Turbopack, Fumadocs
Core 16.17.8, Shiki 4.5.0 with the Oniguruma engine. The 100-page farming fixture from
`prepare.mjs`, which has 200 cacheable blocks (1.4 MB stored). Its Tailwind entry uses
`source(none)` with explicit sources, so Tailwind never scans `.next`.

This was a shared desktop, not a dedicated runner. Other agents were building at the same time.
Treat the medians as observations, not established ratios.

## 1. Shiki startup and precompiled grammars

`shiki-startup.mjs` times each step in 7 fresh processes per engine. Medians in milliseconds:

| Step | Oniguruma (default) | JavaScript engine | Precompiled grammars |
| --- | ---: | ---: | ---: |
| Import Shiki | 36.3 | 33.6 | 29.9 |
| Create the regex engine | 31.1 | 0 | 0.6 |
| Load TypeScript and shell grammars | 6.4 | 5.3 | 46.9 |
| First TypeScript highlight | 155.5 | 229.9 | 152.5 |
| **Until the first TypeScript block is highlighted** | **232.0** | **270.8** | **231.6** |
| Next 50 TypeScript blocks | 73.8 | 65.8 | 61.1 |
| Parse 50 stored blocks (7,372 bytes each) | 1.6 | 1.4 | 1.4 |

- `@shikijs/langs-precompiled` removes the 31 ms Oniguruma engine but spends it again loading the
  larger precompiled grammars. The first highlight still costs about 150 ms. Startup is unchanged.
- The JavaScript engine is slower to its first highlight, which is why the adapter defaults to
  Oniguruma.
- Parsing a stored block is about 45 times cheaper than highlighting it warm, and it skips startup.

## 2. Production builds

`code_highlight.py` builds two copies of the fixture. `base` removes `cacheDir` from the highlighter
options, `cand` keeps the default. Each round runs in a rotating order:

- `base-cold`, `base-cold-aa`: remove `.next` and build. The A/A pair measures noise.
- `cand-cold`: remove `.next` and build with an empty highlight cache.
- `cand-kept`: remove `.next` but restore a primed highlight cache, as when a host restores
  `.next/cache` but Turbopack's cache entry is gone or invalidated.
- `base-edit`, `base-edit-aa`, `cand-edit`: change one paragraph of a warm app and build.

MDX CPU is the sum of `process.cpuUsage()` across the loader calls in every worker. In every round,
each page's highlighted `<pre>` markup matched between variants.

### Run A: 7 measured rounds with an A/A pair ([builds.json](./builds.json))

The 1-minute load average was 7.1–26.1. The disk guard stopped the run inside round 8, so rounds
1–7 are measured and round 0 is the warmup. Medians with min–max:

| Build | Wall (s) | Compile (s) | MDX CPU (ms) |
| --- | ---: | ---: | ---: |
| `base-cold` | 11.71 (9.96–16.86) | 7.6 (6.1–10.2) | 9,645 (9,217–10,214) |
| `base-cold-aa` | 11.07 (10.31–15.34) | 6.6 (6.1–10.1) | 9,841 (9,343–10,489) |
| `cand-cold` | 13.46 (10.37–16.26) | 8.3 (6.1–11.0) | 10,262 (10,049–10,824) |
| `cand-kept` | 12.93 (9.31–16.32) | 7.4 (5.5–9.8) | 4,972 (4,815–6,346) |
| `base-edit` | 4.80 (4.22–7.39) | 1.05 (0.89–2.3) | 617 (524–692) |
| `base-edit-aa` | 4.89 (3.97–7.17) | 1.15 (0.84–2.8) | 579 (530–654) |
| `cand-edit` | 5.86 (4.75–8.76) | 2.1 (0.93–2.5) | 273 (223–306) |

Paired differences within a round, median with min–max:

| Pair | Wall (s) | Compile (s) | MDX CPU (ms) |
| --- | ---: | ---: | ---: |
| `base-cold-aa` − `base-cold` (noise) | −0.17 (−4.98 to +2.16) | −0.2 (−2.6 to +1.6) | +299 (−871 to +721) |
| `cand-cold` − `base-cold` | −0.13 (−3.40 to +6.31) | +0.2 (−1.7 to +4.3) | +914 (+69 to +1,308) |
| `cand-kept` − `base-cold` | −0.46 (−1.45 to +2.97) | −0.8 (−1.9 to +1.5) | −4,378 (−4,754 to −3,847) |
| `base-edit-aa` − `base-edit` (noise) | 0.00 (−2.93 to +2.38) | −0.04 (−1.25 to +1.80) | −22 (−97 to +29) |
| `cand-edit` − `base-edit` | +0.95 (−0.81 to +3.51) | +0.62 (−0.14 to +1.45) | −340 (−391 to −251) |

### Run B: 9 rounds without an A/A pair ([pre-repository-builds.json](./pre-repository-builds.json))

An earlier version of the same harness with the same plugin code, at a load average of 4.5–15.6.
It edits the second heading of page 1 instead of a paragraph.

| Build | Wall (s) | Compile (s) | MDX CPU (ms) |
| --- | ---: | ---: | ---: |
| `base-cold` | 9.52 (9.35–9.98) | 6.0 (5.7–6.2) | 9,156 (9,006–9,290) |
| `cand-cold` | 9.43 (9.24–9.57) | 6.0 (5.7–6.2) | 9,830 (9,476–9,904) |
| `cand-kept` | 8.85 (8.59–9.12) | 5.3 (5.2–5.5) | 4,741 (4,673–5,121) |
| `base-edit` | 5.30 (4.22–7.97) | 1.78 (0.82–2.5) | 532 (515–554) |
| `cand-edit` | 4.02 (3.98–5.32) | 0.74 (0.69–1.89) | 215 (211–252) |

Paired: `cand-kept` − `base-cold` was −0.67 s wall (−1.22 to −0.46) and −0.6 s compile (−0.9 to
−0.3), lower in all 9 rounds. `cand-cold` − `base-cold` was −0.26 s wall (−0.74 to +0.17) and
+615 ms MDX CPU (+320 to +791).

### Reading the builds

- **Highlight cache kept, Turbopack cache lost: MDX CPU −48% in both runs.** In the quieter run that
  was 0.7 s (7%) of wall time in every round. In the busier run the wall difference is inside the
  A/A range.
- **Empty cache: +6% to +10% MDX CPU.** That is the cost of writing 200 entries and inspecting
  grammars. It did not show in wall time in either run.
- **Edits: MDX CPU −55% to −60%,** about 0.3 s. Edit builds compile in one of two modes, about 0.9 s
  or 2.0–2.8 s, in both variants and in the A/A pair. In run A's logs, every slow build reaches
  Tailwind's generated CSS step about 1.5 s after the optimized build starts instead of about 0.35 s. The slow mode hit `cand-edit`
  in 5 of 7 rounds in run A (`base-edit` 1, `base-edit-aa` 2) and in 3 of 9 in run B (`base-edit`
  5). These samples cannot tell whether the cache changes edit wall time.
- **Warm builds with Turbopack's cache are unchanged.** Turbopack already skips MDX for unchanged
  files, so the highlight cache only matters when that cache is missing or invalidated.

## 3. Correctness

`code_highlight_parity.mjs` compiles the 100 corpus pages, the website's docs and 25 edge cases
through the adapter's plugin chain. One process compiles every file in order to fill the cache, as a
build worker would. Then each file is compiled alone in two fresh processes, without and with the
filled cache, with Shiki's time limit off on both sides (see below). All 178 outputs were
identical ([parity.json](./parity.json)). 158 files compiled from the cache without starting
Shiki. `edge/23`, an unknown language, fails with the same error with and without the cache.

The A/B builds also compared every page's highlighted markup in every round. All matched.

### Highlighting already depends on page order

This is not caused by the cache. Without the cache, a Next build worker's output for `md`, `mdx`,
`vue`, `svelte`, `astro` and the other lazily embedding languages depends on which languages earlier
pages loaded. TypeScript and JavaScript output changes after a page loads `ts-tags`, `lit` or an
`es-tag-*` grammar. Turbopack assigns pages to workers nondeterministically, so the same source can
highlight differently between builds. The cache never stores those languages, so it neither fixes
nor spreads the problem.

### Highlighting also depends on machine load

The first full parity run used the default options at a load average of 11–17, and 11 of 178 files
differed. In `corpus/31` the uncached process cut off the first line of its first TypeScript block:
the light theme's pass stopped after `{ ` and left the rest of the line unstyled, while the dark
pass finished. `edge/18`, a `ts-tags` block the cache never stores, differed between two fresh
processes. Shiki stops tokenizing a line after `tokenizeTimeLimit`, 500 ms by default, and does not
report it. A cold process on a busy machine reaches that limit on its first blocks.

Without the cache, such a build ships a few unstyled lines once. Before this was found, the cache
would have stored a cut-off block and reused it in every later build. It now skips any block that
took longer than the limit to highlight, and the parity check turns the limit off on both sides.

### Follow-up: both fixed

The plugin now highlights injecting and lazily embedding languages with highlighters of their own,
whose languages are fixed, and turns Shiki's time limit off by default. The parity check gained a
third comparison: each file's output in the ordered process must match its output in a fresh one.
It now runs with the default options.

| Plugin | Cache differences | Order differences | Files without Shiki |
| --- | ---: | ---: | ---: |
| As measured above, default options | 6 | 11 | 156 |
| Fixed, default options | 0 | 0 | 177 |

The six cache differences in the first row are `corpus` pages with cut-off lines. The order
differences add Markdown with nested code (`edge/22`) and two website pages. The fixed run is
[parity-stable.json](./parity-stable.json). More files skip Shiki because Markdown, MDX, Vue and
the other embedding languages are now stored. The build timings above predate this change.

## Not measured

- Builds after the two correctness fixes. Runs A and B used the plugin before it tracked injected
  grammars per process instead of per processor and before it skipped blocks slower than Shiki's
  time limit. Both fixes can only store fewer blocks.
- A deploy that restores `.next/cache` between builds, such as Vercel's build cache.
- 500 pages, a dedicated runner, Linux and Windows.

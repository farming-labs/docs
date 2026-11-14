# MDX compilation share of Next production builds

Measured November 12, 2026 on `b926605b` (v0.2.144). The question: would a faster content engine,
or a Rust rewrite of it, make docs builds meaningfully faster?

**No.** MDX compilation finishes within the first 2.5–7.5 seconds of a cold build. Replaying
byte-identical compiled MDX, so the build does no MDX work at all, lowered the 100-page compile
median from 11.4 s to 7.2 s. Shiki highlighting is about 60% of MDX cost. Parsing, the only part a
Rust compiler such as `mdxjs-rs` speeds up, is about 40%.

## What the adapters depend on

- `fumadocs-mdx` is not a framework dependency. The Next adapter compiles MDX with `@mdx-js/mdx`
  through `@next/mdx`. TanStack Start and Farm.js use `@mdx-js/rollup`.
- `fumadocs-core` contributes three MDX plugins: `rehype-code` (Shiki), `rehype-toc` and
  `remark-heading`. `fumadocs-ui` provides the default theme's layout, not content compilation.
- Svelte, Astro and Nuxt do not use MDX. They render Markdown with
  `@farming-labs/docs/markdown-rendering` and Shiki.

## Setup

Apple M1, 8 logical CPUs, 16 GiB RAM, macOS, Node 24.21.0. Next 16.4.3 with Turbopack, `@next/mdx`
16.1.6, `@mdx-js/mdx` 3.1.1, `fumadocs-core` 16.17.8, Shiki 4.5.0 with the Oniguruma engine. Two
static-generation workers, as in the [build benchmark](../../README.md).

Every measurement uses `corpusPage()` from `prepare.mjs`, the corpus of the Fumadocs comparison:
frontmatter, six sections, six tables, three TypeScript and three shell fences, and an internal
link per page. Sources total 755,580 bytes at 100 pages and 3,791,980 bytes at 500.

This was a shared desktop, not a dedicated runner. Other sessions were building at the same time.
Each sample records its 1-minute load average, which ranged from 5.1 to 25.2. Ranges are wide and
cells have two or three samples, so treat medians as observations, not established ratios.

## 1. Where MDX time goes, on one core

`mdx-compile.mjs` compiles every page with four configurations. After one warmup round, it measures
7 rounds at 100 pages and 5 at 500, rotating the order each round. CPU time from
`process.cpuUsage()` is the main metric because it varied less than wall time under load.

| Configuration, 500 pages | CPU median (min–max) | Per page |
| --- | ---: | ---: |
| Rust `mdxjs-rs`, parse only | 569 ms (420–736) | 1.14 ms |
| `@mdx-js/mdx`, parse only (GFM and frontmatter) | 3,930 ms (2,953–5,248) | 7.86 ms |
| Full plugin chain without Shiki | 3,724 ms (3,182–5,988) | 7.45 ms |
| Full plugin chain, as `next build` runs it | 9,425 ms (7,454–15,245) | 18.85 ms |

At 100 pages the same rows are 1.59, 9.75, 10.18 and 24.05 ms per page.

- **Shiki is the largest cost.** It is the difference between the last two rows: 5.7 of 9.4 seconds
  at 500 pages (60%), 1.4 of 2.4 seconds at 100 pages (58%).
- **The other plugins cost close to nothing.** Heading IDs, TOC data, the `metadata` export, code
  groups and Markdown alternates are within noise of bare parsing.
- **`mdxjs-rs` parses 6.1× (100 pages) to 6.9× (500 pages) faster** than `@mdx-js/mdx`. It has no
  JavaScript plugin API. `@next/mdx`'s `mdx-rs-loader` passes only parse and JSX options to the
  binding and ignores `remarkPlugins` and `rehypePlugins`. Adopting it would drop heading IDs, TOC
  data, the `metadata` export, Shiki highlighting and users' own `mdx.remarkPlugins`.
- **Shiki initialization costs 263–678 ms** on the first highlighted page. Every Turbopack loader
  worker pays it once.

## 2. MDX inside a real cold build

`mdx_ceiling.py timing` wraps the real loader with `mdx-timing-loader.cjs`. The wrapper records when
each page compiled, in which worker process, and the CPU time spent on it.

| Pages | Load | Wall | Compile phase | MDX window | Busiest worker | MDX CPU, all workers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 5.1 | 15.1 s | 10.1 s | 1.2–4.1 s | 2.5 s | 10.1 s |
| 100 | 7.7 | 11.6 s | 7.0 s | 0.7–2.5 s | 1.6 s | 9.5 s |
| 500 | 7.5 | 28.6 s | 15.1 s | 0.8–5.9 s | 4.3 s | 22.3 s |
| 500 | 7.5 | 86.3 s | 30.7 s | 1.1–7.5 s | 5.6 s | 24.4 s |

The MDX window is measured in seconds after `next build` started. The last build ran during heavy
outside contention: static generation took 26.7 s instead of 7.5 s. It is reported, not dropped.

Turbopack runs the loader in eight Node workers at the start of compilation. In all four builds,
Turbopack kept compiling for 4.9–23.8 seconds after the last MDX page finished. A page's median MDX
time inside the build (40–103 ms) is higher than on one core (19–24 ms). Each worker initializes
Shiki, and the workers compete with Turbopack's own threads.

The 28.6-second 500-page build spent 0.5 s loading configuration, 15.1 s compiling (53%), 2.6 s
type-checking (9%), 2.3 s collecting page data (8%), 7.5 s generating static pages (26%) and 0.6 s
finalizing. It has 504 route modules. The 100-page builds have 104.

## 3. Replaying compiled MDX (no MDX work)

`mdx_ceiling.py replay` stores the real loader's output in a record build, keyed by file path and
source hash, with `mdx-replay-loader.cjs`. Replay builds return those exact bytes instead of
compiling, so they measure a content engine that costs nothing. After the record build, the order
was real, replay, replay, real, real, replay. Load stayed between 10.8 and 12.6.

| 100 pages | Builds | Compile median (range) | Wall median (range) |
| --- | ---: | ---: | ---: |
| Real loader | 3 | 11.4 s (9.3–15.6) | 19.4 s (15.1–24.3) |
| Replayed output | 3 | 7.2 s (7.1–8.1) | 14.8 s (12.3–16.5) |

All seven builds prerendered 100 pages with identical visible-text hashes and Shiki line counts
on `/docs`, `/docs/page-0001` and the last page.

The real-loader builds in section 2, at lower load (5.1–7.7), compiled in 7.0 and 10.1 seconds. Part
of the 4.2-second gap here is contention making the loader workers slower. The saving at 100 pages
therefore lies between the busiest worker's time, 1.6–2.5 s, and this 4.2-second replay gap.

The 500-page replay run stopped after its record build and one real build (47.7 s wall, 24.2 s
compile). The disk guard found 2.9 GiB free. Its two rows are in
[`interrupted/replay-500.json`](./interrupted/replay-500.json) and support no comparison.

## What this means

- **A new content engine has little to win.** In JavaScript or Rust, the ceiling is about 2–4.5 s
  of a 12–19 s build at 100 pages. At 500 pages, MDX ends 5.9–7.5 s into the build; no replay
  comparison was completed there.
- **A Rust engine wins less than that ceiling.** It speeds up the 40% that is parsing. Matching
  Shiki's output and the plugin API would mean reimplementing both.
- **Build time is mostly elsewhere.** It goes to Turbopack compiling route modules and shared code,
  static generation and type-checking. The
  [post-merge report](../2026-10-16-post-merge/REPORT.md) lists the open items there.
- **Two smaller MDX options exist** if the slice ever matters: caching compiled loader output by
  content hash (the replay mechanism) and avoiding repeated Shiki initialization per worker. Neither
  is implemented or measured here.

## Rust options

None of these were built or measured. The savings are upper bounds derived from the shares above,
assuming each part takes the same share of MDX time inside a build as on one core. At 500 pages
the busiest MDX worker spent 4.3 s of a 28.6 s build.

| Rust piece | Replaces | Share of MDX CPU | Upper bound, 500 pages | Blocker |
| --- | --- | ---: | ---: | --- |
| `mdxjs-rs` parser, which already exists | `@mdx-js/mdx` parsing | ~40%, and Rust parses 6.9× faster | ~1.5 s | No JavaScript plugin API. Heading IDs, TOC data, the `metadata` export, code groups and Markdown alternates need Rust ports. Users' `mdx.remarkPlugins` need a JavaScript fallback. |
| A highlighter such as syntect or tree-sitter | Shiki | ~60% | ~2.6 s | Different grammars and theming. Token colors would stop matching Shiki's, so every existing code block would change. |
| Both, as one engine | All MDX work | 100% | ~4.3 s | Both blockers. The measured whole-slice saving is 4.2 s of compile time at 100 pages. |

Two cheaper changes target the same time, also not built:

- **Cache compiled MDX across builds**, keyed by source hash and plugin configuration. Replay builds
  behave like this cache at a 100% hit rate, and they cut the 100-page compile median by 4.2 s.
  Turbopack already reuses loader output when its own persistent cache hits, so this would only
  help on misses.
- **Highlight less often.** Cache highlighted code blocks by code, language and themes, and avoid
  initializing Shiki separately in each of the eight loader workers (263–678 ms each on first use).

**Recommendation: don't build a Rust content engine now.** Most build time is in Turbopack's route
compilation, which is already Rust, plus static generation and type-checking. Revisit if
`mdx_ceiling.py timing` on a real site shows MDX taking a much larger share than this corpus does.

## Limits and raw data

- [`compile-100.json`](./compile-100.json) and [`compile-500.json`](./compile-500.json) hold every
  single-core sample, [`timing.json`](./timing.json) every instrumented build and
  [`replay-100.json`](./replay-100.json) every replay build.
- These files were written by the pre-repository versions of the same scripts, using the same
  measurement logic. Their variant labels are the earlier names: "rust-mdxjs-rs (gfm, no plugins)"
  is "Rust `mdxjs-rs`, parse only", and so on. `reapedCpuSeconds` in the replay file counts only
  processes the build reaped, so it misses Turbopack's loader workers; it is not used.
- An earlier batch at load 24–39 showed no compile difference (37.8 s real, 38.2 s replayed). A reboot
  lost its raw results, so it is mentioned here and not used.
- Not measured: TanStack Start and Farm.js builds, which use the same plugin chain; Vercel; and a
  same-day Fumadocs comparison.
- Each build printed seven Turbopack warnings that dynamic filesystem access in
  `packages/docs/dist/api-reference.mjs` traces the whole project. The docs layout and the MCP route
  reach that module even with the API reference disabled. Its effect on traced output was not measured.

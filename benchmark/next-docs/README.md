# Next.js documentation build benchmark

This benchmark compares the Next.js documentation experience shipped by Farming Labs with a
Fumadocs site. It uses real production builds and the same generated MDX content, not mocked build
commands or comparisons of unrelated websites. It does not modify framework implementation files.

## Providers

- `fumadocs`: Fumadocs MDX, the Fumadocs source loader, one catch-all docs route using
  `generateStaticParams()`, Fumadocs UI, and the standard search route.
- `farming`: `withDocs()`, the default Farming Labs theme, file-based MDX pages, and generated
  documentation/MCP APIs. AI, telemetry, and review workflow generation are disabled. Other defaults
  are retained, including Markdown/discovery routes, page metadata and last-updated labels.
- `fumadocs-file-routes`: the same Fumadocs source, UI and search as the first provider, but with one
  Next.js route module per docs page. This control measures the cost of route structure separately
  from Farming Labs features. It is not the recommended Fumadocs catch-all setup.

All use the same installed Next.js, React, Fumadocs core/UI, Tailwind and Shiki versions. The extra
Fumadocs MDX dependency has its own exact version and npm lockfile in `deps/`. The generated content
has frontmatter, a title, six sections, six tables, three TypeScript fences, three shell fences and
an internal link. Every page has distinct content. Neither site downloads fonts, images or data
while building. Both use the default production Turbopack filesystem cache and two Next.js static
workers. Tailwind scanning is restricted to each fixture and its framework's own styles.

Fumadocs uses its normal MDX preset, including search structured-data extraction. Farming Labs uses
its own configured plugins and additional runtime routes. These are product comparisons with common
reader features, not claims that the two products provide identical features or use identical
compiler pipelines. Dependency installation and framework package builds are outside timed runs.

## Run

Start with the repository's dependencies installed and build the local packages:

```sh
pnpm --filter @farming-labs/docs build
pnpm --filter @farming-labs/theme build
pnpm --filter @farming-labs/next build
npm ci --prefix benchmark/next-docs/deps --legacy-peer-deps --ignore-scripts
python3 benchmark/next-docs/run.py --pages 100 500 --trials 3 \
  --providers fumadocs farming fumadocs-file-routes
```

Use `--node /absolute/path/to/node` to select a runtime. The measured run uses Node 24.21.0. The
runner requires a POSIX system with `ps` and Python 3; it has been exercised on macOS. It links
installed workspace packages into generated fixtures, and links the needed MDX loaders at the
workspace root for Turbopack resolution. Links and installed dependencies are ignored by Git.

A quick harness check is:

```sh
python3 benchmark/next-docs/run.py --pages 10 --trials 1 \
  --providers fumadocs farming fumadocs-file-routes --modes cold warm edit
```

Generated apps, logs and raw measurements are under `artifacts/<run-id>/`. Each new run needs a
unique ID. The runner deletes only its own previous fixture for a provider/trial, never existing
results or user projects. It aborts on a failed build or output validation. All expected docs pages
must be prerendered, contain content and highlighted code, and expose the complete sidebar. Edited
builds must include the edit marker in the generated HTML.

## Measurements

Each provider runs serially; provider order rotates across trials. No builds overlap. At 100 pages,
each trial runs:

1. **Cold:** fresh generated project; no `.next`, `.source` or TypeScript build cache.
2. **Warm:** unchanged rebuild retaining the output and caches from the cold build.
3. **Edit:** append one paragraph to the first page and rebuild, retaining caches.

At 500 pages the default run measures cold builds only. Adjust `--cold-only-above` to include warm
and edit builds at larger sizes. Cold means application-cache cold, not a purged operating-system
disk cache. The machine remains a normal desktop, so report all trials and ranges rather than
claiming a dedicated CI machine or Vercel timings.

- Wall time includes config evaluation, compilation, typechecking and prerendering. The process
  polling interval can add up to 0.2 seconds; report medians and ranges, not sub-millisecond claims.
- Peak **sum of process-tree RSS** is sampled every 0.2 seconds. It includes the build process and
  children, can double-count shared pages, and is not exclusive physical memory or a Vercel memory
  limit measurement.
- Stage durations are parsed only when Next.js prints them. They need not sum to wall time.
- Initial JS/CSS are the unique script and stylesheet files referenced by `/docs` HTML. Gzip sizes
  are sums of local gzip-9 compression, not measured network transfers. Lazy chunks are reported
  separately through total static output size.
- HTML sizes include serialized React server-component data. Total server output includes shared
  code and API routes, and intentionally excludes the `.next/cache` directory.
- Node/compiler versions, Git commit, source bytes, route counts, API paths and every sample are
  retained in JSON.

Aggregate without hiding outliers:

```sh
python3 benchmark/next-docs/analyze.py benchmark/next-docs/artifacts/<run-id>/results.json \
  --out benchmark/next-docs/results/<run-id>
```

After the timed runs finish, inspect payloads and verify the retained production sites:

```sh
python3 benchmark/next-docs/inspect_payloads.py benchmark/next-docs/artifacts/<run-id> \
  --out benchmark/next-docs/results/<run-id>/payloads.json
node benchmark/next-docs/verify.mjs benchmark/next-docs/artifacts/<run-id>
```

The browser check requires Playwright Chromium. Pass `chrome` as the final argument to use an
installed Google Chrome instead. It starts one production server at a time on port 43791, checks
content, clipboard copy, client navigation, search through the API and mobile navigation, then
stops its server. It writes screenshots, server logs and `verification.json` into the run directory.
Run it separately from timing measurements. The payload inspector hashes every source page and
fails if providers' retained corpora differ; it also counts metadata maps in the React stream.

Measured results and the prioritized improvement list are in
[the October 16, 2026 report](./results/2026-10-16/REPORT.md).

## Reference setup

The Fumadocs baseline follows its [Next.js integration](https://www.fumadocs.dev/docs/mdx/next),
[collection configuration](https://www.fumadocs.dev/docs/mdx/collections), source loader and static
catch-all pattern. Its [performance guide](https://www.fumadocs.dev/docs/mdx/performance) describes
how MDX compilation and bundling contribute to production builds. Installed package types and
source are used to validate the exact pinned API versions.

# Inkspan in docs core

With the parser shipped in Inkspan `0.1.0-beta.3`, docs extracted 745 human sections and 272 agent sections across 53 pages. The complete sections, audience tags, projections, and filesystem page records matched the baseline.

| Operation | Baseline median / p95 (ms) | Inkspan median / p95 (ms) | Baseline repeat median (ms) | Median speedup |
| --- | ---: | ---: | ---: | ---: |
| Human sections | 575 / 662 | 195 / 236 | 579 | 2.95× |
| Agent sections | 105 / 114 | 29 / 33 | 109 | 3.57× |
| Audience tags | 683 / 922 | 559 / 676 | 683 | 1.22× |
| Both audience projections | 1733 / 2145 | 1126 / 1318 | 1863 | 1.54× |
| First filesystem MCP scan | 2022 / 2504 | 1180 / 2011 | 2061 | 1.71× |

Measured on an Apple M1 with Node 24.21.0 and Darwin 25.2.0. Each variant ran once for warmup and nine times for measurement in interleaved order. Each section run started with an empty cache. The p95 is the slowest of the nine samples. The standalone JSX-expression fixture took 17.67 ms with Inkspan and 11.82 ms with the reference parser. Its reference repeat took 11.94 ms. See the [standalone benchmarks](https://github.com/farming-labs/inkspan/blob/main/docs/benchmarks.md) for other parser workloads.

## Run the integration benchmarks

Run from the docs integration checkout using Node 24.21.0 and pnpm 10.9.0. The primary package comparison uses the installed Inkspan entry and its portable condition. The docs comparison uses the compiled baseline and the installed candidate tarball.

```sh
bench_dir=$(mktemp -d)
git worktree add --detach "$bench_dir/baseline" 98d573f9dd8db503927330226b5e4cb6da23c42b
pnpm --dir "$bench_dir/baseline" --filter @farming-labs/docs... install --frozen-lockfile --ignore-scripts
pnpm --dir "$bench_dir/baseline" --filter @farming-labs/docs build
pnpm --filter @farming-labs/docs... install --frozen-lockfile --ignore-scripts
pnpm --filter @farming-labs/docs build
pnpm --dir packages/docs pack --pack-destination "$bench_dir"
mkdir "$bench_dir/consumer"
(cd "$bench_dir/consumer" && npm init --yes && npm install --ignore-scripts --legacy-peer-deps "$bench_dir"/farming-labs-docs-*.tgz)
baseline="$bench_dir/baseline/packages/docs/dist"
candidate="$bench_dir/consumer/node_modules/@farming-labs/docs/dist"
node benchmark/inkspan/run.mjs "$baseline" "$candidate" "$bench_dir/consumer" "$bench_dir/sections.json"
node benchmark/inkspan/audience.mjs "$baseline" "$candidate" "$bench_dir/audience.json"
git worktree remove "$bench_dir/baseline"
```

Both scripts store all timing samples and hashes. The sections harness optionally accepts a fifth argument pointing to a consumer of the previous packed prototype. The audience harness also measures the JavaScript parser with one-source reuse in isolation. It asserts that applying that single change to the baseline patched exactly one site. Run the standalone parser parity suite in the Inkspan checkout.

## Authored files in `docs review`

On the same 53 website pages, the packed CLI returned the same JSON report, including all 14 findings and their line numbers. An independent trace of one validation pass found 39 pages served by the Rust component index. The docs MDX visitor handled 13 pages, down from 52, and one page had no audience tags.

| Operation | Previous integration median / p95 (ms) | With frontmatter support median / p95 (ms) | Previous integration repeat median / p95 (ms) |
| --- | ---: | ---: | ---: |
| Audience validation on whole files | 1175 / 1659 | 1000 / 1153 | 1110 / 1790 |
| Complete `docs review` process | 5850 / 8058 | 4663 / 8891 | 4788 / 11658 |

Validation took 15% less time at the median. For the full CLI, the two baseline medians differed by 18%, and the candidate's p95 exceeded the first baseline's. The full-command speedup is inconclusive. Measurements used the same Apple M1 and Node version as above, with one warmup and nine interleaved measurements per variant. The harness hashes every result, including the complete CLI report. The input SHA-256 was `60012b73f2087fe188d61a713d15b9899c364eb172c6c65bb37703c6b2251cf3`.

Use the previous integration as the baseline and the installed candidate tarball from above. Give the review command two Git revisions so it can discover the changed files through its usual entry point.

```sh
git worktree add --detach "$bench_dir/previous" 3767e8e36c50eb80634909f11642fceb79f0dfc9
pnpm --dir "$bench_dir/previous" --filter @farming-labs/docs... install --frozen-lockfile --ignore-scripts
pnpm --dir "$bench_dir/previous" --filter @farming-labs/docs build
baseline="$bench_dir/previous/packages/docs/dist"
site="$bench_dir/review-site"
git init -q "$site"
git -C "$site" config user.name "Benchmark"
git -C "$site" config user.email "benchmark@example.invalid"
git -C "$site" -c commit.gpgsign=false commit --allow-empty -qm initial
mkdir -p "$site/app"
cp -R website/src/app/docs "$site/app/docs"
echo 'export default { entry: "docs", contentDir: "app/docs", review: { enabled: true } };' > "$site/docs.config.ts"
git -C "$site" add app/docs docs.config.ts
git -C "$site" -c commit.gpgsign=false commit -qm corpus
node benchmark/inkspan/audience.mjs "$baseline" "$candidate" "$bench_dir/review.json" "$site"
git worktree remove "$bench_dir/previous"
```

## Section lookups by anchor and title

On an Apple M1 running macOS 26.2 and Node 24.21.0, plain-text heading cleanup reduced the median for 424 cached section lookups by 21%. This workload asks for three existing anchors and one missing selector on each of 53 authored pages and 53 generated agent documents. A miss falls through to title matching. The 25% miss rate is a benchmark input. Successful anchor lookups and uncached parsing had similar medians across the implementations.

| Workload | Baseline median / p95 (ms) | Identical control | Plain-text heading cleanup |
| --- | ---: | ---: | ---: |
| 318 successful lookups | 8.04 / 15.49 | 9.37 / 16.00 | 8.09 / 16.79 |
| 424 lookups, including 106 misses | 11.84 / 20.24 | 12.56 / 17.57 | 9.37 / 19.62 |
| Parse 106 uncached documents | 144.12 / 168.66 | 144.43 / 164.26 | 143.82 / 174.38 |

Use `a0dc4434b57f61f2ccff8dbf6370901d4f24ebf2` for the baseline. Build it and pack the candidate as in the integration benchmark instructions above. The control is a second copy of the baseline's built files next to its original `dist` so both resolve the same installed dependencies.

```sh
cp -R "$baseline" "$baseline-control"
node benchmark/inkspan/section-lookups.mjs "$baseline" "$baseline-control" "$candidate" > "$bench_dir/section-lookups.json"
```

The harness compares complete section lists and individual lookups before timing. Each implementation gets three warmups and 24 timed samples over all six execution orders. Warm batches repeat 20 times for successful lookups and four times for the mixed workload. Each cold sample appends a unique paragraph to force a fresh parse. The output includes all samples and a corpus hash. No samples were discarded. Response time for a deployed search or MCP request was outside this measurement.

### Returning one cached section

A lookup now selects the requested heading from cached metadata before slicing its content. Against commit `e414ff4b78b105e321676d2623fe4ea64f09afd1`, this saved about 0.5 ms per 318 successful lookups in both runs, or 1.6 microseconds per lookup. Both runs used the harness, corpus, hardware and Node version above. Each cell is median / p95 in milliseconds.

| Run | Workload | Baseline | Identical control | Selected section |
| --- | --- | ---: | ---: | ---: |
| 1 | 318 successful lookups | 4.68 / 4.86 | 4.65 / 4.86 | 4.15 / 4.35 |
| 2 | 318 successful lookups | 4.70 / 5.04 | 4.74 / 5.32 | 4.19 / 5.81 |
| 1 | 424 lookups, including 106 misses | 6.98 / 7.25 | 7.01 / 7.47 | 6.34 / 6.57 |
| 2 | 424 lookups, including 106 misses | 7.29 / 8.02 | 7.28 / 8.19 | 6.60 / 7.09 |
| 1 | Parse 106 uncached documents | 169.24 / 223.37 | 169.42 / 196.66 | 175.20 / 252.80 |
| 2 | Parse 106 uncached documents | 211.01 / 319.72 | 196.35 / 270.30 | 189.49 / 260.95 |

The median improvement reproduced on both warm workloads. The p95 for successful lookups and the cold-parse timings changed direction between runs.

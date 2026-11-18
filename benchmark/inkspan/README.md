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

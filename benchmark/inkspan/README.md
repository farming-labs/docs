# Inkspan in docs core

Over 53 pages, docs extracted 744 human sections in 157.23 ms (4.29×) and 272 agent sections in 29.19 ms (3.84×). The first filesystem MCP scan took 1269.29 ms (1.92×). Each operation produced the baseline output. The [Inkspan benchmark report](https://github.com/farming-labs/inkspan/blob/main/docs/benchmarks.md) includes median, p95, controls, the small-expression regression, and standalone reproduction commands.

## Run the integration benchmarks

Run from the docs integration checkout using Node 24.21.0 and pnpm 10.9.0. The primary package comparison uses the installed Inkspan entry and its portable condition. The docs comparison uses the compiled baseline and the installed candidate tarball.

```sh
bench_dir=$(mktemp -d)
git worktree add --detach "$bench_dir/baseline" 6d442beb8cc94378a46b063fbab79c48ece769ed
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

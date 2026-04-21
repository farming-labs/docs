# Codex Benchmark Results

This folder contains tracked, human-readable summaries from real Codex benchmark runs.

Generated raw artifacts live under ignored folders:

- `benchmark/codex/artifacts/<run-id>/`
- `benchmark/codex/analysis/<run-id>/`

Those ignored artifacts include per-attempt workspaces, Codex JSON events, request logs, acceptance
logs, and generated summaries. They are useful for local audit, but too noisy to commit directly.

## Current Results

| Report | Scenario | Attempts | Error Result | Efficiency Result |
| ------ | -------- | -------- | ------------ | ----------------- |
| [real-codex-2026-04-21.md](./real-codex-2026-04-21.md) | `support-agent-prompting` | 3 per provider | tie | Farming Labs/docs won speed, fetches, bytes, and tokens |
| [versioned-agent-endpoint-2026-04-21.md](./versioned-agent-endpoint-2026-04-21.md) | `versioned-agent-endpoint` | 3 per provider | tie | Farming Labs/docs won speed, fetches, bytes, and tokens |

## Accurate Claim

Current data supports:

> Farming Labs/docs gave Codex a faster and lower-context implementation path while matching
> Mintlify-shaped docs on final correctness and error rate.

Current data does not support:

> Farming Labs/docs has lower error rate than Mintlify.

Both tracked real runs ended with equal error metrics. The stronger result today is efficiency, not
error-rate superiority.

## Reproduce Latest Stress Run

```bash
BENCHMARK_SCENARIO=versioned-agent-endpoint BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

Then inspect:

```txt
benchmark/codex/artifacts/<run-id>/summary.md
benchmark/codex/analysis/<run-id>/report.md
benchmark/codex/analysis/<run-id>/metric-log.jsonl
```

## Smoke Test

```bash
CODEX_BIN="$PWD/benchmark/codex/test-fixtures/fake-codex.mjs" \
  BENCHMARK_SCENARIO=versioned-agent-endpoint \
  node benchmark/codex/run.mjs
```

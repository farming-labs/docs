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
| [agent-primitive-error-retrieval-2026-04-21.md](./agent-primitive-error-retrieval-2026-04-21.md) | `versioned-agent-endpoint` | 2 valid Farming Labs/docs, 3 valid Mintlify | Farming Labs/docs won docs error rate and error-free rate; final correctness tied | Farming Labs/docs won first relevant page, raw fetches, unique resources, and tokens |

## Accurate Claim

Current data supports:

> Farming Labs/docs gave Codex a faster and lower-context implementation path while matching
> Mintlify-shaped docs on final correctness and error rate.

The latest agent-primitive run also supports this narrower retrieval-error claim:

> Farming Labs/docs reduced docs retrieval mistakes in the versioned endpoint scenario after the
> Mintlify fixture stopped using pseudo-agent primitives.

Current data does not support:

> Farming Labs/docs has lower error rate than Mintlify.

The stronger unsupported claim means lower final task, acceptance, or session error rate. The latest
run improves docs retrieval error rate, but final implementation correctness still tied on valid
attempts.

The `1` vs `3` docs-fetch result in the tracked reports is raw HTTP retrieval count. It means
Farming Labs/docs served the matching `<Agent>` runbook from `/docs.md`, while Mintlify-shaped docs
used discovery plus the target markdown page. It is reported as efficiency, not counted as an error
unless the agent misses the target facts or reads off-target pages first.

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

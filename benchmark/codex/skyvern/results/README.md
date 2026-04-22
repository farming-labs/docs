# Skyvern Benchmark Results

Tracked summaries for the Skyvern docs benchmark live here. Raw per-run workspaces, request logs,
Codex events, and generated summaries are ignored under:

```txt
benchmark/codex/skyvern/artifacts/<run-id>/
benchmark/codex/skyvern/analysis/<run-id>/
```

## Current Runs

| Report | Tasks | Run Type | Result |
| ------ | ----- | -------- | ------ |
| [error-free-summary-2026-04-22.md](./error-free-summary-2026-04-22.md) | 1-2 | real Codex samples | Farming Labs/docs observed Agent Error Pressure Score is `0.0 / 100`; Mintlify is `19.1 / 100` |
| [smoke-all-tasks-2026-04-21.md](./smoke-all-tasks-2026-04-21.md) | 1-10 | fake Codex harness | Farming Labs/docs validates the optimized one-fetch agent-runbook path for all tasks |
| [real-task-1-2026-04-22.md](./real-task-1-2026-04-22.md) | 1 | real Codex sample | Both providers passed acceptance; Farming Labs/docs scored `0.0 / 100` error pressure vs Mintlify at `18.1 / 100` |
| [real-task-2-2026-04-22.md](./real-task-2-2026-04-22.md) | 2 | real Codex sample | Both providers passed acceptance; Farming Labs/docs scored `0.0 / 100` error pressure vs Mintlify at `20.0 / 100` |

## Claim Boundary

The checked-in Skyvern benchmark is ready to run for all ten prompts, but only tasks 1-2 have tracked
real Codex samples so far. Do not claim an all-task real win until running:

```bash
SKYVERN_TASKS=1,2,3,4,5,6,7,8,9,10 \
  BENCHMARK_REPEATS=1 \
  node benchmark/codex/skyvern/run.mjs
```

Use the smoke run to validate the harness and the real runs for public performance claims.

# Skyvern Codex Benchmark

This benchmark mirrors the Skyvern Mintlify docs corpus and compares:

- `mintlify`: upstream Mintlify-shaped docs copied from `maniculehq/skyvern`.
- `farming-labs`: the same text docs mirrored into Farming Labs/docs with an agent-first layer.

Source:

- Repository: `https://github.com/maniculehq/skyvern`
- Commit: `87d270dbc010277d80653a977e7dd575a168c6d2`

The benchmark copies text docs (`.mdx`, `.md`, `.json`, `.css`) but intentionally excludes large
image/video assets because Codex consumes markdown routes, not rendered media.

## Agent Optimization

Farming Labs/docs adds:

- root `<Agent>` guidance in `/docs.md`,
- task-specific `/docs/agent-runbooks/task-N.md` pages for compact implementation guidance,
- a fallback `/docs/agent-runbook.md` page with one `<Agent>` runbook per benchmark task,
- `/.well-known/agent.json`,
- `/api/docs/agent/spec`,
- `/api/docs/agent/task/:id`,
- `/api/docs?query=...` targeted search,
- markdown routes for every mirrored page.

Mintlify keeps the same human-readable docs plus `/docs.md` and `llms.txt`, but does not receive a
fake agent-only primitive.

## Tasks

The task matrix is in [tasks.json](./tasks.json). It includes the ten Skyvern prompts, the user's
expected page list, the resolved current Skyvern pages, and acceptance tokens.

## Run

Smoke test without launching real Codex:

```bash
CODEX_BIN="$PWD/benchmark/codex/skyvern/test-fixtures/fake-codex.mjs" \
  SKYVERN_TASKS=1,2,3,4,5,6,7,8,9,10 \
  node benchmark/codex/skyvern/run.mjs
```

Real Codex run for all tasks:

```bash
SKYVERN_TASKS=1,2,3,4,5,6,7,8,9,10 \
  BENCHMARK_REPEATS=1 \
  BENCHMARK_ATTEMPT_TIMEOUT_MS=900000 \
  node benchmark/codex/skyvern/run.mjs
```

For a cheaper real sample:

```bash
SKYVERN_TASKS=1 BENCHMARK_REPEATS=1 node benchmark/codex/skyvern/run.mjs
```

Generated artifacts are ignored:

```txt
benchmark/codex/skyvern/artifacts/<run-id>/
benchmark/codex/skyvern/analysis/<run-id>/
```

## Metrics

The runner reports:

- time to full implementation,
- Agent Error Pressure Score, a 0-100 score where lower means less observed implementation risk,
- command/session/acceptance errors,
- docs retrieval error rate,
- error-free rate,
- time to first relevant page,
- raw docs fetches,
- unique docs resources,
- docs bytes,
- Codex input/output tokens.

The Agent Error Pressure Score is intentionally not a binary pass/fail number. It blends completion
failures, command/session instability, docs retrieval friction, and excess docs context so two
successful runs can still differ meaningfully when one required much more navigation or token load.
Report it with the task count and run id; it is an observed sample score, not a deterministic
guarantee for every future agent session.

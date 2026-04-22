# Skyvern Smoke Benchmark - 2026-04-21

Run id: `2026-04-21T22-26-10-631Z`

Command:

```bash
CODEX_BIN="$PWD/benchmark/codex/skyvern/test-fixtures/fake-codex.mjs" \
  SKYVERN_TASKS=1,2,3,4,5,6,7,8,9,10 \
  node benchmark/codex/skyvern/run.mjs
```

This is a harness smoke test, not a public performance claim. It verifies that all ten Skyvern
prompts, docs servers, task-specific acceptance checks, and provider layouts work end to end.

## Outcome

| Provider | Started | Valid | Invalid | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |
| -------- | ------- | ----- | ------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |
| farming-labs | 10 | 10 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| mintlify | 10 | 10 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |

## Efficiency

| Provider | Median Full Time | Median First Relevant | Raw Fetches | Unique Resources | Agent Instruction Fetches | Docs Bytes | Input Tokens | Output Tokens |
| -------- | ---------------- | --------------------- | ----------- | ---------------- | ------------------------- | ---------- | ------------ | ------------- |
| farming-labs | 0.129s | 0.046s | 2 | 2 | 2 | 3,745.9 | 1,200 | 500 |
| mintlify | 0.131s | 0.053s | 3 | 3 | 0 | 43,759.8 | 3,200 | 780 |

The fake harness intentionally uses the optimized Farming Labs/docs path: `/docs.md` plus the
task-specific `<Agent>` runbook. Mintlify uses `/docs.md`, `llms.txt`, and the first canonical target
page.

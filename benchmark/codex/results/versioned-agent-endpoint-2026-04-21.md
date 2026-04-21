# Versioned Agent Endpoint Benchmark - 2026-04-21

Run id: `2026-04-21T15-32-52-879Z`

Command:

```bash
BENCHMARK_SCENARIO=versioned-agent-endpoint BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

This run tested the fair error-rate stress scenario where both providers document a deprecated v1
support-agent contract and a current v2 support-agent contract. The implementation task was to build
the current endpoint. Acceptance fails if the artifact uses the v1 version, v1 schema, v1 header, or
omits v2-only fields such as `schema`, `safety`, or `handoff_to_human`.

## Outcome

| Provider | Attempts | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |
| -------- | -------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |
| farming-labs | 3 | 1 | 1 | 0 | 0 | 0 | 0 |
| mintlify | 3 | 1 | 1 | 0 | 0 | 0 | 0 |

## Speed And Retrieval

| Provider | Median Full Time | Median First Relevant | Mean Docs Fetches | Mean Docs Bytes | Mean Input Tokens | Mean Output Tokens |
| -------- | ---------------- | --------------------- | ---------------- | --------------- | ----------------- | ------------------ |
| farming-labs | 108.295s | 14.128s | 1 | 5,683 | 278,735.333 | 3,998.333 |
| mintlify | 140.883s | 30.163s | 3 | 6,630 | 338,962 | 4,467.667 |

## Wins And Ties

| Metric | Better | farming-labs | mintlify | Winner |
| ------ | ------ | ------ | ------ | ------ |
| Success rate | higher | 1 | 1 | tie |
| Task error rate | lower | 0 | 0 | tie |
| Acceptance error rate | lower | 0 | 0 | tie |
| Session error rate | lower | 0 | 0 | tie |
| Docs error rate | lower | 0 | 0 | tie |
| Error-free rate | higher | 1 | 1 | tie |
| Time to full implementation | lower | 108.295 | 140.883 | farming-labs |
| Time to first relevant page | lower | 14.128 | 30.163 | farming-labs |
| Mean weighted errors | lower | 0 | 0 | tie |
| Mean command errors | lower | 0 | 0 | tie |
| Mean noisy docs fetches | lower | 0 | 0 | tie |
| Mean off-target before relevant | lower | 0 | 0 | tie |
| Mean docs fetches | lower | 1 | 3 | farming-labs |
| Mean docs bytes | lower | 5,683 | 6,630 | farming-labs |
| Mean input tokens | lower | 278,735.333 | 338,962 | farming-labs |
| Mean output tokens | lower | 3,998.333 | 4,467.667 | farming-labs |

## Attempt Details

| Provider | Attempt | Success | Error-Free | Full Time | First Relevant | Docs Fetches | Input Tokens | Output Tokens |
| -------- | ------- | ------- | ---------- | --------- | -------------- | ------------ | ------------ | ------------- |
| farming-labs | 1 | true | true | 103.959s | 13.452s | 1 | 277,448 | 3,883 |
| farming-labs | 2 | true | true | 108.295s | 14.128s | 1 | 282,352 | 4,333 |
| farming-labs | 3 | true | true | 118.264s | 22.216s | 1 | 276,406 | 3,779 |
| mintlify | 1 | true | true | 144.17s | 72.39s | 3 | 268,434 | 3,775 |
| mintlify | 2 | true | true | 110.653s | 26.564s | 3 | 335,595 | 4,137 |
| mintlify | 3 | true | true | 140.883s | 30.163s | 3 | 412,857 | 5,491 |

## Reading

The fair v1/v2 stress test did not produce an error-rate win: both providers completed all three
attempts without task, acceptance, session, docs, command, noisy-page, or off-target errors.

Farming Labs/docs still won the efficiency metrics on the harder scenario. Codex reached the first
relevant page faster, needed one docs fetch instead of three, consumed fewer docs bytes, and used
fewer input/output tokens on average.

The important takeaway is that this benchmark is now stricter and honest: it can catch a v1
implementation, but this 3-run sample says the current task is still not hard enough to claim an
error-rate win over Mintlify.

Full ignored artifacts are available locally at:

- `benchmark/codex/artifacts/2026-04-21T15-32-52-879Z/summary.md`
- `benchmark/codex/analysis/2026-04-21T15-32-52-879Z/report.md`
- `benchmark/codex/analysis/2026-04-21T15-32-52-879Z/metric-log.jsonl`

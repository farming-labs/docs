# Real Codex Benchmark Run - 2026-04-21

Run id: `2026-04-21T14-03-47-935Z`

Command:

```bash
BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

This run used the real Codex execution path against the two provider-owned Next.js benchmark
projects:

- `benchmark/codex/farming-labs`
- `benchmark/codex/mintlify`

## Outcome

| Provider | Attempts | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |
| -------- | -------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |
| farming-labs | 3 | 1 | 1 | 0 | 0 | 0 | 0 |
| mintlify | 3 | 1 | 1 | 0 | 0 | 0 | 0 |

## Speed And Retrieval

| Provider | Median Full Time | Median First Relevant | Mean Docs Fetches | Mean Docs Bytes | Mean Input Tokens | Mean Output Tokens |
| -------- | ---------------- | --------------------- | ---------------- | --------------- | ----------------- | ------------------ |
| farming-labs | 89.279s | 17.897s | 1 | 3,274 | 227,209 | 3,466.667 |
| mintlify | 104.187s | 33.479s | 3 | 5,214 | 289,896.333 | 4,279 |

## Wins And Ties

| Metric | Better | farming-labs | mintlify | Winner |
| ------ | ------ | ------ | ------ | ------ |
| Success rate | higher | 1 | 1 | tie |
| Task error rate | lower | 0 | 0 | tie |
| Acceptance error rate | lower | 0 | 0 | tie |
| Session error rate | lower | 0 | 0 | tie |
| Docs error rate | lower | 0 | 0 | tie |
| Error-free rate | higher | 1 | 1 | tie |
| Time to full implementation | lower | 89.279 | 104.187 | farming-labs |
| Time to first relevant page | lower | 17.897 | 33.479 | farming-labs |
| Mean weighted errors | lower | 0 | 0 | tie |
| Mean command errors | lower | 0 | 0 | tie |
| Mean noisy docs fetches | lower | 0 | 0 | tie |
| Mean off-target before relevant | lower | 0 | 0 | tie |
| Mean docs fetches | lower | 1 | 3 | farming-labs |
| Mean docs bytes | lower | 3,274 | 5,214 | farming-labs |
| Mean input tokens | lower | 227,209 | 289,896.333 | farming-labs |
| Mean output tokens | lower | 3,466.667 | 4,279 | farming-labs |

## Attempt Details

| Provider | Attempt | Success | Error-Free | Full Time | First Relevant | Docs Fetches | Input Tokens | Output Tokens |
| -------- | ------- | ------- | ---------- | --------- | -------------- | ------------ | ------------ | ------------- |
| farming-labs | 1 | true | true | 102.015s | 17.897s | 1 | 298,492 | 4,086 |
| farming-labs | 2 | true | true | 89.279s | 17.622s | 1 | 206,044 | 3,144 |
| farming-labs | 3 | true | true | 79.348s | 20.098s | 1 | 177,091 | 3,170 |
| mintlify | 1 | true | true | 104.187s | 34.233s | 3 | 295,728 | 3,862 |
| mintlify | 2 | true | true | 103.633s | 33.479s | 3 | 270,703 | 4,173 |
| mintlify | 3 | true | true | 131.459s | 29.182s | 3 | 303,258 | 4,802 |

## Reading

The run did not show an error-rate win because both providers reached 100% success and 0% task,
acceptance, session, docs, command, noisy-page, and off-target-before-relevant errors.

The Farming Labs/docs advantage showed up in efficiency metrics: the agent needed one docs fetch
instead of three, reached the first relevant page faster, used fewer docs bytes, and used fewer
input/output tokens on average.

Full ignored artifacts are available locally at:

- `benchmark/codex/artifacts/2026-04-21T14-03-47-935Z/summary.md`
- `benchmark/codex/analysis/2026-04-21T14-03-47-935Z/report.md`
- `benchmark/codex/analysis/2026-04-21T14-03-47-935Z/metric-log.jsonl`

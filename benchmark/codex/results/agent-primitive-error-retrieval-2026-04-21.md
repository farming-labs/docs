# Agent Primitive Error-Retrieval Benchmark - 2026-04-21

Run id: `2026-04-21T16-18-25-008Z`

Command:

```bash
BENCHMARK_SCENARIO=versioned-agent-endpoint BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

This run tested the versioned endpoint scenario after removing pseudo-agent
`<Visibility for="agents">` blocks from the Mintlify fixture. Mintlify still had the same
human-readable implementation facts, root `/docs.md`, `llms.txt`, and markdown pages. Farming
Labs/docs used root `<Agent>` runbooks and the agent spec endpoint.

One Farming Labs/docs attempt was excluded from provider error-rate denominators because Codex lost
network connectivity, exited with code `1`, produced `0` token usage, and never wrote a final
message. The raw attempt is still listed below for auditability.

## Outcome

| Provider | Started | Valid | Invalid | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |
| -------- | ------- | ----- | ------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |
| farming-labs | 3 | 2 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| mintlify | 3 | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |

## Speed And Retrieval

| Provider | Median Full Time | Median First Relevant | Raw Fetches | Unique Resources | Discovery Fetches | Agent Instruction Fetches | Target/Fact Fetches | Docs Bytes | Input Tokens | Output Tokens |
| -------- | ---------------- | --------------------- | ----------- | ---------------- | ----------------- | ------------------------- | ------------------- | ---------- | ------------ | ------------- |
| farming-labs | 139.5s | 27.191s | 3 | 3 | 0 | 2 | 3 | 11,606 | 264,633 | 4,500 |
| mintlify | 116.696s | 34.719s | 5 | 5 | 1 | 0 | 1 | 6,985 | 299,109 | 4,664.333 |

## Reading

This is the first run that shows a fair error-side win, but the wording matters:

- Farming Labs/docs won `docs_error_rate`: `0` vs `1`.
- Farming Labs/docs won `error_free_rate`: `1` vs `0`.
- Farming Labs/docs tied final task, acceptance, and session error rate on valid attempts.
- Mintlify still passed final acceptance on every valid attempt.
- Farming Labs/docs reached the relevant implementation facts earlier and with fewer raw docs
  fetches, but used more docs bytes in this run because Codex fetched both `/docs.md` and the agent
  spec/search endpoints.

The defensible claim is:

> Farming Labs/docs reduced retrieval mistakes and preserved final correctness in this versioned
> endpoint scenario, while Mintlify-shaped docs still implemented the task correctly after reading
> off-target pages first.

Do not claim:

> Farming Labs/docs has lower final implementation failure rate than Mintlify.

That stronger claim still needs a valid repeated run where task, acceptance, or session errors are
lower for Farming Labs/docs.

Ignored raw artifacts are available locally at:

- `benchmark/codex/artifacts/2026-04-21T16-18-25-008Z/summary.md`
- `benchmark/codex/analysis/2026-04-21T16-18-25-008Z/report.md`
- `benchmark/codex/analysis/2026-04-21T16-18-25-008Z/metric-log.jsonl`

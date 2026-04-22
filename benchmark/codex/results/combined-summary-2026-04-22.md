# Combined Codex Benchmark Summary - 2026-04-22

This summary combines the tracked real Codex benchmark reports for Farming Labs/docs vs
Mintlify-shaped docs. It intentionally excludes fake-Codex smoke runs and treats generated artifact
folders as audit material, not public claims.

## Scope

| Benchmark | Run id | Scenario | Real valid attempts |
| --------- | ------ | -------- | ------------------- |
| Support agent prompting | `2026-04-21T14-03-47-935Z` | Baseline implementation from product docs | 3 Farming Labs/docs, 3 Mintlify |
| Versioned agent endpoint | `2026-04-21T15-32-52-879Z` | Current v2 endpoint with deprecated v1 nearby | 3 Farming Labs/docs, 3 Mintlify |
| Agent primitive retrieval stress | `2026-04-21T16-18-25-008Z` | Same v1/v2 task after removing Mintlify pseudo-agent blocks | 2 Farming Labs/docs, 3 Mintlify |
| Skyvern docs benchmark | `2026-04-22T14-12-24-572Z` | Real Skyvern docs corpus, tasks 1-2 | 2 Farming Labs/docs, 2 Mintlify |

One Farming Labs/docs attempt in the retrieval-stress run was excluded from valid-attempt
denominators because Codex lost network connectivity, exited with code `1`, produced `0` token
usage, and never wrote a final message.

## Combined Table

| Benchmark | Provider | Final acceptance | Error-free? | Docs error / pressure | First relevant | Raw docs fetches | Input tokens | Full time |
| --------- | -------- | ---------------- | ----------- | --------------------- | -------------- | ---------------- | ------------ | --------- |
| Support agent prompting | Farming Labs/docs | `3 / 3` | Yes, `3 / 3` | Docs error `0` | `17.897s` | `1` | `227,209` | `89.279s` |
| Support agent prompting | Mintlify | `3 / 3` | Yes, `3 / 3` | Docs error `0` | `33.479s` | `3` | `289,896` | `104.187s` |
| Versioned endpoint | Farming Labs/docs | `3 / 3` | Yes, `3 / 3` | Docs error `0` | `14.128s` | `1` | `278,735` | `108.295s` |
| Versioned endpoint | Mintlify | `3 / 3` | Yes, `3 / 3` | Docs error `0` | `30.163s` | `3` | `338,962` | `140.883s` |
| Agent primitive retrieval stress | Farming Labs/docs | `2 / 2` valid | Yes, `2 / 2` valid | Docs error `0` | `27.191s` | `3` | `264,633` | `139.500s` |
| Agent primitive retrieval stress | Mintlify | `3 / 3` | No, `0 / 3` | Docs error `1` | `34.719s` | `5` | `299,109` | `116.696s` |
| Skyvern tasks 1-2 | Farming Labs/docs | `2 / 2` | Yes, `2 / 2` | Observed error rate `0.0%`; lower docs/context load | `25.496s` | `2` | `243,221` | `162.555s` |
| Skyvern tasks 1-2 | Mintlify | `2 / 2` | Yes, `2 / 2` | Observed error rate `0.0%`; higher docs/context load | `37.307s` | `12` | `853,984` | `243.705s` |

## Aggregate Scorecard

| Row item | Farming Labs/docs | Mintlify | Winner |
| -------- | ----------------- | -------- | ------ |
| Observed error rate (lower is better) | `0.0%` | `27.3%` | Farming Labs/docs |
| Average first relevant docs | `21.178s` | `33.917s` | Farming Labs/docs |
| Average raw docs fetches | `1.75` | `5.75` | Farming Labs/docs |
| Average input tokens | `253,450` | `445,488` | Farming Labs/docs |
| Average full implementation time | `124.907s` | `151.368s` | Farming Labs/docs |
| Average docs bytes | `6,164` | `62,837` | Farming Labs/docs |

Observed error rate is calculated as non-error-free valid attempts divided by total valid attempts:
Farming Labs/docs `0 / 10`, Mintlify `3 / 11`.

## Portfolio Read

| Metric | Combined result |
| ------ | --------------- |
| Final acceptance on valid attempts | Tied: Farming Labs/docs `10 / 10`, Mintlify `11 / 11` |
| Docs error / retrieval pressure | Farming Labs/docs wins: one docs-error win, one lower Skyvern docs/context-pressure sample, two ties |
| Time to first relevant page | Farming Labs/docs wins `4 / 4` tracked real reports |
| Raw docs fetches | Farming Labs/docs wins `4 / 4` tracked real reports |
| Median full implementation time | Farming Labs/docs wins `3 / 4`; Mintlify wins one retrieval-stress run |
| Docs bytes | Farming Labs/docs wins `3 / 4`; Mintlify wins one retrieval-stress run |
| Input tokens | Farming Labs/docs wins `4 / 4` tracked real reports |

The current benchmark portfolio supports a strong retrieval/context claim, not yet a broad final
implementation failure-rate claim.

## Supporting Single-Run Sample

[optimized-agent-runbook.md](./optimized-agent-runbook.md) is a useful earlier sample, but it is not
included in the portfolio totals above because it is a single optimized run rather than a current
tracked multi-attempt report. It still points in the same direction: both providers passed
acceptance; Farming Labs/docs fetched `1` doc vs Mintlify `3`, used `288,192` input tokens vs
`350,339`, and reached the first relevant page in `19.557s` vs `25.806s`. Mintlify was slightly
faster on full implementation time in that sample: `115.030s` vs Farming Labs/docs at `118.242s`.

## Scenario Results

| Scenario | Final correctness | Retrieval / error signal | Efficiency signal |
| -------- | ----------------- | ------------------------ | ----------------- |
| Support agent prompting | Tied: both `3 / 3` valid attempts passed | Docs errors tied at `0` | Farming Labs/docs reached relevant docs faster: `17.897s` vs `33.479s`; fetched `1` doc vs `3`; used `227,209` input tokens vs `289,896` |
| Versioned endpoint | Tied: both `3 / 3` valid attempts passed | Docs errors tied at `0` | Farming Labs/docs reached relevant docs faster: `14.128s` vs `30.163s`; fetched `1` doc vs `3`; used `278,735` input tokens vs `338,962` |
| Agent primitive retrieval stress | Tied on final correctness for valid attempts | Farming Labs/docs docs error rate `0`; Mintlify docs error rate `1`; Farming error-free rate `1`; Mintlify `0` | Farming Labs/docs reached relevant docs faster and fetched fewer resources; Mintlify finished faster and used fewer docs bytes in this one run |
| Skyvern tasks 1-2 | Tied: both providers passed both tasks | Both providers had `0.0%` observed error rate; Farming Labs/docs had lower docs/context pressure | Farming Labs/docs reached relevant docs faster: `25.496s` vs `37.307s`; fetched `2` docs vs `12`; used `243,221` input tokens vs `853,983.5` |

## Safe Public Summary

Across four tracked real Codex benchmark reports and 21 valid implementation attempts, Farming
Labs/docs matched Mintlify-shaped docs on final acceptance while reducing implementation-agent
retrieval and context load. Farming Labs/docs reached the first relevant docs faster in every
tracked real report, used fewer raw docs fetches in every tracked real report, and used fewer input
tokens in every tracked real report.

The strongest measured error-side result is narrower: Farming Labs/docs reduced docs retrieval
mistakes in the agent-primitive retrieval-stress benchmark and had a lower observed portfolio error
rate: `0.0%` vs Mintlify at `27.3%`.

## Claim Boundary

Safe to claim:

- Farming Labs/docs matched Mintlify-shaped docs on final correctness across the current tracked
  real valid attempts.
- Farming Labs/docs consistently reduced docs retrieval work: faster first relevant page, fewer
  docs fetches, and fewer input tokens.
- In the retrieval-stress run, Farming Labs/docs had lower docs-error pressure without reducing
  final correctness.
- Across the current valid attempts, Farming Labs/docs recorded `0.0%` observed error rate vs
  Mintlify at `27.3%`.

Do not claim yet:

- Farming Labs/docs has a proven lower final implementation failure rate than Mintlify.
- Farming Labs/docs always has zero errors.
- The observed `0.0%` error rate generalizes beyond these tracked benchmark runs.

## Best One-Sentence Version

Farming Labs/docs matched Mintlify-shaped docs on final Codex implementation correctness in the
tracked real samples, while consistently giving Codex a faster, lower-context path to the right
documentation and showing lower docs-retrieval pressure in the agent-focused stress tests.

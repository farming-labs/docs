# Skyvern Agent Error Pressure Summary - 2026-04-22

Run id: `2026-04-22T14-12-24-572Z`

## Score

Lower is better. `0 / 100` means no observed error pressure in this measured sample. `100 / 100`
means severe implementation risk in the measured sample.

| Provider | Agent Error Pressure Score | Reading |
| -------- | -------------------------- | ------- |
| farming-labs | 0.0 / 100 | No observed pressure |
| mintlify | 19.1 / 100 | Moderate pressure |

## Why This Number

This is not a binary pass/fail percentage. The score blends the things that make an agent session
feel error-prone:

| Component | Max points | What it captures |
| --------- | ---------- | ---------------- |
| Completion | 40 | Invalid attempts, task failures, or acceptance failures |
| Session | 20 | Command errors or timeouts |
| Retrieval | 20 | Missing relevant docs, missing discovery, 404s, or wrong docs before useful docs |
| Context | 20 | Extra docs fetches and excessive docs bytes |

## Measured Run

| Provider | Valid attempts | Error-free attempts | Mean docs fetches | Mean docs bytes | Mean input tokens |
| -------- | -------------- | ------------------- | ----------------- | --------------- | ----------------- |
| farming-labs | 2 / 2 | 2 / 2 | 2 | 4,093 | 243,221 |
| mintlify | 2 / 2 | 2 / 2 | 12 | 232,517 | 853,983.5 |

## Word Summary

Farming Labs/docs scored `0.0 / 100` because Codex completed both real samples cleanly, reached the
task-specific agent runbooks immediately, and avoided extra docs navigation. Mintlify also completed
the two samples, but scored `19.1 / 100` because Codex had to fetch far more docs and context to
reach the same implementation outcome.

This is a real Codex sample for tasks 1-2, not an all-ten-task public claim or deterministic
guarantee. Public claims should say `0.0 / 100 observed error pressure on this two-task sample`.

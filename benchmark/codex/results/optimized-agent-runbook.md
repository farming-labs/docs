# Optimized Agent Runbook Result

Run ID: `2026-04-21T01-58-12-035Z`

This is a curated summary from an optimized Codex benchmark run. Raw run artifacts are generated
under ignored `artifacts/` folders and should not be committed.

The implementation target was an equivalent Next.js App Router artifact app for both providers. The
docs subject was Northstar CRM, a fictional product/internal-platform docs scenario. Future
scenarios can use any framework, SDK, API, CLI, or product docs as long as both providers expose
equivalent content and equivalent acceptance checks.

## Optimization

Farming Labs/docs used the built-in `<Agent>` primitive in the root `/docs.md` response as a
machine-only implementation runbook. Codex received the exact task match, files to create, constants,
policy lines, endpoint contract, homepage change, and acceptance command on the first docs fetch.

Mintlify used the baseline discovery path for the same content: `/docs.md` -> `/llms.txt` ->
targeted markdown page.

## Metrics

| Metric | farming-labs | mintlify | Winner |
| ------ | ----------------- | -------- | ------ |
| Time to full implementation | 118.242s | 115.030s | mintlify |
| Errors during session | 0 weighted errors | 0 weighted errors | tie |
| Input tokens | 288192 | 350339 | farming-labs |
| Output tokens | 3935 | 4285 | farming-labs |
| Docs fetches | 1 | 3 | farming-labs |
| Docs bytes | 1859 | 2907 | farming-labs |
| First relevant page | 19.557s, `/docs.md` | 25.806s, `/docs/core/support-agent-prompting.md` | farming-labs |

Both provider runs passed acceptance against equivalent provider-owned Next.js projects. Treat this as one
optimized sample run; repeat at least three times and compare medians before using the result
publicly.

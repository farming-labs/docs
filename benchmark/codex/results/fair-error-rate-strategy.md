# Fair Error-Rate Benchmark Strategy

We should not beat Mintlify by damaging the Mintlify fixture. The stronger claim is:

> With equivalent human docs, Farming Labs/docs reduces implementation-agent mistakes because it can
> expose machine-first guidance through agent primitives.

## What To Benchmark

The current support-agent benchmark is too easy for error-rate separation. Both providers reached
0% error. That is still useful, but it mostly proves Farming Labs/docs is more efficient.

To create an honest error-rate gap, use tasks that are realistic and naturally mistake-prone:

- Version ambiguity: old and new API contracts both exist, but only one is correct.
- Multi-file exactness: the feature requires coordinated edits across helper, route, and UI files.
- Negative constraints: the agent must avoid installs, docs edits, deprecated routes, or optional
  integrations.
- Cross-page dependency: the task requires two precise pages, not a whole-site crawl.
- Similar nearby pages: billing, ticketing, search, and prompt docs are all valid docs, but only one
  or two are target pages.

## How Farming Labs/docs Wins Fairly

Farming Labs/docs should use features Mintlify does not optimize for in the same way:

- `<Agent>` blocks for implementation-only runbooks.
- Root `/docs.md` as a task router.
- Agent spec endpoint for canonical pages, deprecated pages, and task-specific reading order.
- Markdown routes and `Accept: text/markdown` for reliable low-noise fetches.
- Skills or agent feedback schemas for repeatable implementation behavior.

The human docs should still contain the same facts. The win comes from reducing agent ambiguity, not
from withholding information.

## Benchmark Correction

Do not give the Mintlify fixture a fake agent primitive. It should get the normal tools a
Mintlify-shaped docs site can reasonably expose in this benchmark:

- root `/docs.md`,
- `llms.txt`,
- markdown page URLs,
- the same human-readable facts on the implementation pages.

Farming Labs/docs should use the real differentiator aggressively:

- root `<Agent>` runbooks,
- page-level `<Agent>` guidance,
- `/api/docs/agent/spec` with canonical and deprecated page metadata,
- exact file/export/constants/policy runbooks for implementation agents.

That keeps the benchmark fair but no longer hides the product advantage by adding
`<Visibility for="agents">`-style pseudo-primitives to the Mintlify fixture.

## Next Scenario To Build

Run `versioned-agent-endpoint`:

```bash
BENCHMARK_SCENARIO=versioned-agent-endpoint BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

- Both providers document `v1` and `v2`.
- Both providers clearly say `v2` is current.
- The benchmark task asks Codex to implement the current support-agent endpoint.
- Acceptance fails if the artifact uses any `v1` constant or response shape.

Expected measurable win:

- Lower `acceptance_error_rate` if agents pick the wrong version on Mintlify more often.
- Lower `docs_error_rate` if agents read deprecated/nearby pages before the canonical page.
- Lower `session_error_rate` if agents need fewer correction loops.

If error rates still tie, the benchmark should honestly report that and keep Farming Labs/docs wins
on retrieval speed, raw docs fetches, bytes, and token cost.

## Next Error-Rate Plays

If `versioned-agent-endpoint` still ties after repeated runs, add new scenarios that are naturally
error-prone for implementation agents while keeping Mintlify's factual docs complete:

- Current-vs-deprecated defaults where both pages are valid, but only the current page is correct
  for new work.
- Security-negative constraints where the agent must avoid a tempting implementation path, such as
  direct billing mutation or account deletion without handoff.
- Cross-page contracts where the final code needs facts from exactly two pages, and fetching the
  wrong nearby reference page usually causes an acceptance failure.
- Similar API names where `create_ticket`, `handoff_to_human`, and billing/refund APIs are all
  documented, but only one combination is valid.
- Framework routing traps where the docs include legacy Pages Router examples and current App
  Router examples, and acceptance fails if the wrong one is used.

The honest target is an acceptance-measured error-rate gap over at least three attempts, preferably
five to ten. Until then, claim the proven win: faster right-page retrieval and lower context/cost
with equal correctness.

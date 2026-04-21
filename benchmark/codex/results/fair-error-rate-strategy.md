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
on retrieval speed, docs fetches, bytes, and token cost.

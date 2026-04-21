# Benchmark Methodology

This benchmark measures how documentation provider shape affects coding-agent implementation work.
It is designed to be open-source, reproducible, and honest about what the data supports.

## Research Question

When the target app and implementation task are equivalent, does one docs provider help an
implementation agent:

- find the right page sooner,
- finish the task faster,
- use fewer raw docs fetches and tokens,
- avoid wrong pages,
- avoid implementation/session errors,
- pass acceptance checks more reliably?

The benchmark currently compares:

- `farming-labs`: a `@farming-labs/docs`-shaped project with agent primitives.
- `mintlify`: a Mintlify-shaped project with equivalent human-readable docs.

## Control Variables

Both provider projects use the same implementation framework:

- Next.js App Router.
- Same missing feature shape.
- Same acceptance script logic.
- Same docs subject, Northstar CRM, a fictional product/internal-platform docs corpus.
- Same task prompt, except for provider-specific docs base URL.
- Same local runner, same Codex executable, same machine.

The provider changes; the app task should not.

## Provider Differences Under Test

Farming Labs/docs is allowed to use agentic docs features because those are part of the product:

- root `/docs.md`,
- markdown routes,
- `Accept: text/markdown`,
- agent spec endpoint,
- `<Agent>` blocks for machine-first instructions,
- targeted search metadata.

Mintlify-shaped docs are allowed to use equivalent discoverability affordances available in this
fixture:

- root `/docs.md`,
- `llms.txt`,
- Markdown docs pages,
- equivalent human-readable facts.

Mintlify is not intentionally broken. Required facts are not hidden from Mintlify.

Farming Labs/docs is intentionally allowed to package the same facts into `<Agent>` blocks and the
agent spec endpoint. That can make one Farming Labs/docs request equivalent to several Mintlify
requests. The benchmark reports that as raw retrieval efficiency, not as an implementation error by
itself.

## Fairness Rules

- Do not add false or misleading docs to either provider.
- Do not add noisy pages only to one provider.
- Do not omit required facts from one provider.
- Do not tune acceptance to match one provider's preferred code style.
- Keep provider project baselines equivalent.
- Record ties honestly.
- Treat one-off runs as smoke samples; use repeated runs for claims.

## Scenarios

### `support-agent-prompting`

Baseline docs-to-implementation scenario.

Codex must implement a support-agent prompt helper, a POST route, and a homepage note from the docs.

Primary claim tested:

- Can the docs provider route Codex to the implementation contract quickly?

### `versioned-agent-endpoint`

Error-rate stress scenario.

Both providers document a deprecated `v1` support-agent contract and a current `v2` contract. Codex
must implement the current v2 endpoint. Acceptance fails if the artifact uses the v1 version,
schema, header, or omits v2-only fields such as `schema`, `safety`, or `handoff_to_human`.

Primary claim tested:

- Can the docs provider prevent version-confusion implementation errors?

## Metrics

Primary error metrics:

- `task_error_rate`: final artifact did not satisfy the success contract.
- `acceptance_error_rate`: final acceptance script failed.
- `session_error_rate`: acceptance failure, command errors, or missing artifact checks occurred.
- `docs_error_rate`: agent missed the relevant page or fetched off-target pages before it.
- `error_free_rate`: successful run with no command errors, missing checks, or off-target docs before
  the relevant page.

Efficiency metrics:

- `time_to_full_implementation_seconds`
- `time_to_first_relevant_page_seconds`
- `raw_docs_fetches`
- `unique_docs_resources`
- `normalized_retrieval_steps`
- `docs_bytes`
- `input_tokens`
- `output_tokens`

Retrieval quality metrics:

- `relevant_fetches`
- `agent_instruction_fetches`
- `discovery_fetches`
- `target_fetches`
- `supporting_fetches`
- `neutral_fetches`
- `wrong_or_noisy_fetches`
- `off_target_before_relevant`

`raw_docs_fetches` is the literal number of successful HTTP requests to the docs server. A
Farming Labs/docs run can be `1` when `/docs.md` contains the matching `<Agent>` runbook. A
Mintlify-shaped run can be `3` when Codex reads `/docs.md`, `/llms.txt`, and then the target
markdown page. That difference is expected and is the product capability under test.

`docs_error_rate` is stricter: it only counts a retrieval error when Codex misses the relevant
implementation facts or fetches neutral/noisy pages before the relevant page. Discovery requests
such as `/docs.md` and `/llms.txt` are not counted as wrong-page errors.

## How Runs Work

The runner:

1. Copies the provider project to an ignored artifact workspace.
2. Starts a local HTTP docs server.
3. Gives Codex only the local docs base URL and task prompt.
4. Records every docs HTTP request.
5. Runs Codex in the artifact workspace.
6. Runs `node scripts/acceptance.mjs`.
7. Computes per-attempt and aggregate metrics.
8. Writes summaries, metric logs, and comparison reports.

Attempts where Codex exits before producing model usage or a final message are marked as
infrastructure-invalid. They remain in per-attempt logs for auditability, but provider aggregate
error rates use valid attempts only.

Generated run artifacts are ignored by git because they contain many large per-run workspaces and
logs. Public tracked result summaries live under `benchmark/codex/results/`.

## Reproduce

Baseline scenario:

```bash
BENCHMARK_SCENARIO=support-agent-prompting BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

Versioned error-rate stress scenario:

```bash
BENCHMARK_SCENARIO=versioned-agent-endpoint BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

Fast smoke test without launching the real Codex app:

```bash
CODEX_BIN="$PWD/benchmark/codex/test-fixtures/fake-codex.mjs" \
  BENCHMARK_SCENARIO=versioned-agent-endpoint \
  node benchmark/codex/run.mjs
```

Regenerate analysis for a run:

```bash
node benchmark/codex/analyze.mjs benchmark/codex/artifacts/<run-id>/summary.json
```

## Current Public Claim

The checked-in results support this claim:

> Farming Labs/docs tied Mintlify-shaped docs on error rate in the current scenarios, while reaching
> the relevant implementation facts faster and using fewer raw docs fetches, docs bytes, and tokens.

The latest agent-primitive run supports this narrower claim:

> Farming Labs/docs reduced docs retrieval mistakes in the versioned endpoint scenario when
> Mintlify-shaped docs used only root markdown, `llms.txt`, and human-readable implementation pages.

The checked-in results do not support this claim yet:

> Farming Labs/docs has a lower implementation error rate than Mintlify.

That stronger claim needs a scenario where repeated valid runs show a lower task, acceptance, or
session error rate. A lower docs retrieval error rate is useful, but it is not the same as lower
final implementation failure.

## Publication Notes

For a public benchmark post, include:

- repo commit SHA,
- current date,
- Codex app/CLI version if available,
- `BENCHMARK_SCENARIO`,
- `BENCHMARK_REPEATS`,
- exact command,
- tracked report path,
- whether raw ignored artifacts are attached separately.

If raw artifacts are important for review, publish the generated `benchmark/codex/artifacts/<run-id>`
and `benchmark/codex/analysis/<run-id>` directories as a release asset or CI artifact rather than
committing all workspaces to the repo.

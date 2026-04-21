# Codex Benchmark

This runner compares two documentation-provider shapes for the same implementation task:

- [farming-labs](./farming-labs/README.md), representing `@farming-labs/docs`
- [mintlify](./mintlify/README.md), representing Mintlify-shaped docs

For the public methodology and current tracked results, see:

- [../METHODOLOGY.md](../METHODOLOGY.md)
- [results/README.md](./results/README.md)

Both providers document the same scenario content. The current scenario uses a fictional product
feature, but the harness is meant for any docs subject: framework docs, SDK docs, API docs, or an
internal platform guide.

The implementation app is **Next.js for both providers** in the current scenario. That is
intentional: the benchmark should change the docs provider, not the app framework. Each provider now
owns a concrete project instead of receiving a shared fixture plus package overlay:

- [farming-labs](./farming-labs/README.md)
- [mintlify](./mintlify/README.md)

Keep those projects equivalent across providers. They can have different package names and
benchmark metadata, but their starting app, task gap, and acceptance script should stay identical so
error-rate differences come from docs discovery and implementation guidance, not project drift.

This benchmark answers: "When the target app is equivalent, which docs shape helps an
implementation agent find the right information and finish with fewer errors?" It does not fully
answer: "Which docs framework is easier to install from zero?" That should be a separate
setup-friction scenario where the agent is asked to scaffold a docs site with each provider's real
package and the acceptance script validates the generated docs app. See
[scenarios/setup-friction.md](./scenarios/setup-friction.md) for that track.

## Fetch Targets

The runner serves provider-shaped docs from this repo on localhost. That keeps hosting/network noise
out of the score and measures the part we can optimize in the docs framework:

- Did Codex fetch the right page?
- How many docs requests did it need?
- Did it avoid wrong/noisy pages?
- How soon did it reach the relevant implementation page?

## Scenario Contract

Every scenario should define:

- The docs subject, such as a framework, SDK, API, or product.
- The implementation task Codex must complete.
- Equivalent docs content for `farming-labs` and `mintlify`.
- The provider-owned project baseline.
- The acceptance script that proves the implementation works.
- The relevant docs route(s) and noisy/wrong route(s) for scoring.

Farming Labs/docs should use its agentic primitive advantage: embed `<Agent>...</Agent>` guidance in
the right pages or root `/docs.md` so implementation agents get the exact runbook without showing
that content in the human UI.

## Run

```bash
node benchmark/codex/run.mjs
```

Fast smoke test without launching the real Codex app:

```bash
CODEX_BIN="$PWD/benchmark/codex/test-fixtures/fake-codex.mjs" node benchmark/codex/run.mjs
```

Optional environment variables:

```bash
BENCHMARK_PROVIDERS=farming-labs,mintlify
BENCHMARK_REPEATS=3
BENCHMARK_SCENARIO=support-agent-prompting
CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex
CODEX_INPUT_USD_PER_1M=0
CODEX_OUTPUT_USD_PER_1M=0
```

Available scenarios:

- `support-agent-prompting`: the baseline docs-to-implementation task.
- `versioned-agent-endpoint`: the error-rate stress task with deprecated v1 docs and current v2
  acceptance checks.

## Output

Each run writes implementation artifacts under:

```txt
benchmark/codex/artifacts/<run-id>/<provider>/attempt-<n>/
```

The runner also writes a cross-provider summary under:

```txt
benchmark/codex/artifacts/<run-id>/summary.md
```

Analysis outputs are dumped under:

```txt
benchmark/codex/analysis/<run-id>/metric-log.jsonl
benchmark/codex/analysis/<run-id>/aggregate.json
benchmark/codex/analysis/<run-id>/comparison.json
benchmark/codex/analysis/<run-id>/report.md
```

The implementation workspace itself is preserved at:

```txt
benchmark/codex/artifacts/<run-id>/<provider>/attempt-<n>/workspace/
```

Use `BENCHMARK_REPEATS=3` or higher when comparing error rate. The summary includes task error
rate, session error rate, docs error rate, error-free rate, and weighted errors.

The summary and report include a metric comparison table with a `Winner` column. Equal values are
marked as `tie`, which makes repeat runs easier to inspect when both providers pass but differ only
on docs fetch count, first relevant page timing, token usage, or noisy-page mistakes.

You can regenerate analysis from a summary with:

```bash
node benchmark/codex/analyze.mjs benchmark/codex/artifacts/<run-id>/summary.json
```

# Metrics

Each provider run records raw values first. We should not claim a win from one smoke run; use at
least three runs per provider and compare medians plus error rates.

## Primary Metrics

- `time_to_full_implementation_seconds`: wall-clock time from prompt start to passing acceptance.
- `weighted_errors`: acceptance failure, wrong primitive, missing docs discovery, wrong-page fetches,
  command failures, and other recoverable implementation mistakes.
- `task_error_rate`: fraction of attempts where the final artifact did not satisfy the success
  contract.
- `session_error_rate`: fraction of attempts with acceptance failure, command errors, or missing
  artifact checks.
- `docs_error_rate`: fraction of attempts where Codex missed the relevant page or fetched noisy docs
  before it.
- `error_free_rate`: fraction of attempts with success, no command errors, no missing artifact
  checks, and no noisy docs before the relevant page.
- `input_tokens` and `output_tokens`: model usage from Codex JSON events.
- `docs_fetches` and `total_docs_bytes`: how much documentation context was needed.
- `time_to_first_relevant_page_seconds`: how quickly Codex reached the core implementation page.
- `supporting_fetches`: helpful but non-target pages, such as agent context or escalation policy.
- `neutral_fetches`: orientation pages that are not wrong, but are not needed for the task.
- `wrong_or_noisy_fetches`: pages that should not be needed for the task, such as billing, theme,
  Slack, webhook, or rate-limit docs.
- `off_target_before_relevant`: neutral plus noisy pages fetched before the first target page.
- `page_timing_score`: starts at 100, rewards provider discovery use, penalizes wrong/noisy pages.
- `implementation_ease_score`: a compact pass/fail-weighted score for quick comparisons.

## Cost

The runner records token and byte proxies by default. If dollar estimates are needed, set:

```bash
CODEX_INPUT_USD_PER_1M=...
CODEX_OUTPUT_USD_PER_1M=...
```

Model pricing changes, so published reports should always include the raw token counts too.

## Repeat Runs

Use repeat runs for error-rate claims:

```bash
BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

The summary writes aggregate error rates first, then per-attempt detail rows for debugging. The
runner also dumps analysis files to:

```txt
benchmark/codex/analysis/<run-id>/metric-log.jsonl
benchmark/codex/analysis/<run-id>/aggregate.json
benchmark/codex/analysis/<run-id>/comparison.json
benchmark/codex/analysis/<run-id>/report.md
```

The generated report includes a win/tie table for time, error-rate, cost-proxy, and retrieval
metrics. A `tie` means the values were equal within the benchmark tolerance, not that the products
are generally equivalent.

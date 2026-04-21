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
- `raw_docs_fetches` and `total_docs_bytes`: literal HTTP docs requests and bytes.
- `unique_docs_resources`: unique docs resources fetched after normalizing repeated URLs.
- `normalized_retrieval_steps`: request count needed to reach the first relevant implementation
  facts.
- `time_to_first_relevant_page_seconds`: how quickly Codex reached the core implementation page.
- `agent_instruction_fetches`: requests that returned Farming Labs/docs machine-first task guidance
  such as root `<Agent>` runbooks or the agent spec endpoint.
- `discovery_fetches`: orientation requests such as `/docs.md`, `/llms.txt`, or skill pointers that
  route the agent but do not contain the full implementation contract.
- `target_fetches`: requests containing the full implementation facts for the active scenario.
- `supporting_fetches`: helpful but non-target pages, such as agent context or escalation policy.
- `neutral_fetches`: orientation pages that are not wrong, but are not needed for the task.
- `wrong_or_noisy_fetches`: pages that should not be needed for the task, such as billing, theme,
  Slack, webhook, or rate-limit docs.
- `off_target_before_relevant`: neutral plus noisy pages fetched before the first target page.
- `page_timing_score`: starts at 100, rewards provider discovery use, penalizes wrong/noisy pages.
- `implementation_ease_score`: a compact pass/fail-weighted score for quick comparisons.
- `valid_attempt`: whether Codex produced a real implementation attempt that should count in
  provider denominators.
- `infrastructure_failure`: Codex exited before producing model usage or a final message, usually
  because of network/session failure. These attempts stay in raw logs but are excluded from provider
  task, acceptance, session, docs, timing, and cost aggregates.

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

`BENCHMARK_REPEATS` means target valid attempts. The runner also supports
`BENCHMARK_INVALID_RETRIES=2` to replace infrastructure-invalid runs before giving up.

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

## Raw Fetches vs Errors

Do not read `1` raw docs fetch for Farming Labs/docs and `3` raw docs fetches for Mintlify-shaped
docs as a scoring bug. The raw count measures how many HTTP requests Codex needed to collect the
implementation facts. Farming Labs/docs can legally put those facts in one `<Agent>` runbook or
agent spec response. Mintlify-shaped docs usually require discovery plus a target markdown page.

That raw count is still separate from `docs_error_rate`. A Mintlify run that fetches `/docs.md`,
`/llms.txt`, and the correct target page has more raw fetches, but it is not a docs error unless it
misses the target facts or reads neutral/noisy pages before reaching them.

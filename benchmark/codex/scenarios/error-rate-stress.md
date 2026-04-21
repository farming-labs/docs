# Error-Rate Stress Scenario

Goal: create fair benchmarks where Farming Labs/docs can win on error rate without making Mintlify
look bad on purpose.

The benchmark should expose places where human-oriented docs are naturally weaker for coding
agents, while both providers still publish equivalent factual documentation.

## Fairness Rules

- Keep the same implementation project shape for both providers.
- Keep the same human-readable facts in both providers.
- Do not hide required implementation facts from Mintlify.
- Do not add false, broken, or intentionally misleading Mintlify docs.
- Do not add noisy pages only to Mintlify.
- Let Farming Labs/docs use `<Agent>`, agent spec, markdown routes, skills, or feedback schemas to
  repackage the same facts into a machine-first workflow.
- Score errors through acceptance checks and request logs, not subjective judgment.

## Weak Spots To Stress

### 1. Version Selection

Real docs often contain old and new API versions. The fair task is to document both versions and
clearly mark the current one in both providers.

Farming Labs/docs advantage:

- The agent spec can mark the current version as canonical.
- `<Agent>` can say which version to implement and which pages are deprecated.

Potential error metric:

- Agent implements a deprecated constant, route, or response shape.

### 2. Multi-File Exactness

Agents make more mistakes when the task requires coordinated edits across several files.

Farming Labs/docs advantage:

- `<Agent>` can list the exact files, exports, route names, and acceptance command in one runbook.

Potential error metric:

- Missing file, wrong export, wrong HTTP method, or incomplete homepage/API wiring.

### 3. Negative Constraints

Human docs often explain many valid options, but the benchmark task needs one safe path.

Farming Labs/docs advantage:

- Agent-only guidance can say what not to do without cluttering the public UI.

Potential error metric:

- Agent installs packages, changes docs files, changes unrelated routes, or uses a disallowed
  optional integration.

### 4. Right Page At The Right Time

Larger docs sites include nearby but non-target pages. They are not bad pages; they are simply not
the right page for the task.

Farming Labs/docs advantage:

- Root `/docs.md` and the agent spec can route the model directly to the target page.

Potential error metric:

- Neutral or noisy pages fetched before the target page.

### 5. Cross-Page Dependency

Some tasks need facts from two or three pages, but not the whole site.

Farming Labs/docs advantage:

- Agent primitives can name the minimal page set and the order to read them.

Potential error metric:

- Agent misses a required cross-page constraint, or fetches many irrelevant pages first.

## Recommended Next Benchmark

Add a `versioned-agent-endpoint` scenario. This scenario is implemented in the benchmark runner and
can be selected with:

```bash
BENCHMARK_SCENARIO=versioned-agent-endpoint BENCHMARK_REPEATS=3 node benchmark/codex/run.mjs
```

Task:

- Implement a Next.js route for a support-agent endpoint.
- The docs contain both `v1` and `v2` contracts.
- `v1` remains documented because some customers still use it.
- The task must implement `v2`.

Equivalent human docs for both providers:

- `core/support-agent-v1`
- `core/support-agent-v2`
- `migration/v1-to-v2`
- `reference/ticketing-api`
- `reference/billing-api`

Farming Labs/docs agent optimization:

- Root `<Agent>` runbook says: implement `v2`; do not use `v1`; read `support-agent-v2` first,
  then `migration/v1-to-v2` only if needed.
- Agent spec marks `core/support-agent-v2` as canonical for this task.

Acceptance should fail when:

- The implementation uses a `v1` constant.
- The route returns the `v1` response shape.
- The agent omits a `v2` required field.
- The agent edits unrelated docs/config files.
- The agent does not run the acceptance command.

This is fair because Mintlify can still document `v2` clearly. The difference being measured is
whether a docs framework can guide an implementation agent through version ambiguity with fewer
mistakes.

## Reporting

For this track, report these fields first:

- `task_error_rate`
- `acceptance_error_rate`
- `session_error_rate`
- `docs_error_rate`
- `mean_off_target_before_relevant`
- `mean_wrong_or_noisy_fetches`
- `median_first_relevant_seconds`

If error rates tie, use speed, fetch count, docs bytes, and token usage as secondary wins.

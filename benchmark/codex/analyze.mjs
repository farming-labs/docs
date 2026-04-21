#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const benchmarkRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(benchmarkRoot, "../..");

function json(data) {
  return JSON.stringify(data, null, 2);
}

const comparisonMetrics = [
  { key: "success_rate", label: "Success rate", better: "higher" },
  { key: "task_error_rate", label: "Task error rate", better: "lower" },
  { key: "acceptance_error_rate", label: "Acceptance error rate", better: "lower" },
  { key: "session_error_rate", label: "Session error rate", better: "lower" },
  { key: "docs_error_rate", label: "Docs error rate", better: "lower" },
  { key: "error_free_rate", label: "Error-free rate", better: "higher" },
  { key: "median_full_time_seconds", label: "Time to full implementation", better: "lower" },
  { key: "median_first_relevant_seconds", label: "Time to first relevant page", better: "lower" },
  { key: "mean_weighted_errors", label: "Mean weighted errors", better: "lower" },
  { key: "mean_command_errors", label: "Mean command errors", better: "lower" },
  { key: "mean_wrong_or_noisy_fetches", label: "Mean noisy docs fetches", better: "lower" },
  {
    key: "mean_off_target_before_relevant",
    label: "Mean off-target before relevant",
    better: "lower",
  },
  { key: "mean_docs_fetches", label: "Mean raw docs fetches", better: "lower" },
  { key: "mean_unique_docs_resources", label: "Mean unique docs resources", better: "lower" },
  { key: "mean_discovery_fetches", label: "Mean discovery fetches", better: "lower" },
  {
    key: "mean_agent_instruction_fetches",
    label: "Mean agent instruction fetches",
    better: "higher",
  },
  {
    key: "mean_normalized_retrieval_steps",
    label: "Mean normalized retrieval steps",
    better: "lower",
  },
  { key: "mean_docs_bytes", label: "Mean docs bytes", better: "lower" },
  { key: "mean_input_tokens", label: "Mean input tokens", better: "lower" },
  { key: "mean_output_tokens", label: "Mean output tokens", better: "lower" },
];

function formatMetricValue(value) {
  if (typeof value !== "number") return "n/a";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 3,
  });
}

function average(values) {
  const numericValues = values.filter((value) => typeof value === "number");
  if (numericValues.length === 0) return null;
  return Number(
    (numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(3),
  );
}

function median(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(3));
}

function rate(count, total) {
  if (total === 0) return 0;
  return Number((count / total).toFixed(3));
}

function isValidAttempt(result) {
  if (typeof result.valid_attempt === "boolean") return result.valid_attempt;
  const usage = result.usage ?? {};
  const totalTokens =
    (usage.input_tokens ?? 0) + (usage.cached_input_tokens ?? 0) + (usage.output_tokens ?? 0);

  return !(result.codex_exit_code !== 0 && totalTokens === 0);
}

function isInfrastructureFailure(result) {
  if (typeof result.infrastructure_failure === "boolean") {
    return result.infrastructure_failure;
  }

  return !isValidAttempt(result);
}

function compareAggregate(aggregate) {
  return comparisonMetrics.map((metric) => {
    const values = aggregate.map((result) => ({
      provider: result.provider,
      value: result[metric.key],
    }));
    const numericValues = values.filter((entry) => typeof entry.value === "number");

    if (numericValues.length === 0) {
      return { ...metric, winner: "tie", values };
    }

    const bestValue =
      metric.better === "higher"
        ? Math.max(...numericValues.map((entry) => entry.value))
        : Math.min(...numericValues.map((entry) => entry.value));
    const tiedProviders = numericValues.filter(
      (entry) => Math.abs(entry.value - bestValue) < 0.001,
    );

    return {
      ...metric,
      winner: tiedProviders.length > 1 ? "tie" : tiedProviders[0].provider,
      values,
    };
  });
}

function providerNamesFromComparison(comparison) {
  return comparison[0]?.values.map((entry) => entry.provider) ?? [];
}

function comparisonTable(comparison) {
  const providerNames = providerNamesFromComparison(comparison);
  return [
    `| Metric | Better | ${providerNames.join(" | ")} | Winner |`,
    `| ------ | ------ | ${providerNames.map(() => "------").join(" | ")} | ------ |`,
    ...comparison.map((result) => {
      const providerValues = providerNames.map((provider) => {
        const entry = result.values.find((value) => value.provider === provider);
        return formatMetricValue(entry?.value);
      });
      return `| ${result.label} | ${result.better} | ${providerValues.join(" | ")} | ${result.winner} |`;
    }),
  ];
}

function aggregateProviderResults(provider, providerResults) {
  const attemptsStarted = providerResults.length;
  const validResults = providerResults.filter(isValidAttempt);
  const attempts = validResults.length;
  const invalidAttempts = attemptsStarted - attempts;
  const successes = validResults.filter((result) => result.success).length;
  const errorFreeRuns = validResults.filter((result) => result.error_free).length;
  const acceptanceFailures = validResults.filter((result) => !result.acceptance_passed).length;
  const sessionErrorRuns = validResults.filter(
    (result) =>
      !result.acceptance_passed ||
      result.command_error_count > 0 ||
      result.missing_artifact_checks > 0,
  ).length;
  const docsErrorRuns = validResults.filter(
    (result) => !result.docs?.firstRelevantUrl || (result.docs?.offTargetBeforeRelevant ?? 0) > 0,
  ).length;

  return {
    provider,
    attempts_started: attemptsStarted,
    attempts,
    valid_attempts: attempts,
    invalid_attempts: invalidAttempts,
    invalid_attempt_rate: rate(invalidAttempts, attemptsStarted),
    success_rate: rate(successes, attempts),
    task_error_rate: rate(attempts - successes, attempts),
    error_free_rate: rate(errorFreeRuns, attempts),
    acceptance_error_rate: rate(acceptanceFailures, attempts),
    session_error_rate: rate(sessionErrorRuns, attempts),
    docs_error_rate: rate(docsErrorRuns, attempts),
    median_full_time_seconds: median(
      validResults.map((result) => result.time?.time_to_full_implementation_seconds),
    ),
    median_first_relevant_seconds: median(
      validResults.map((result) => result.time?.time_to_first_relevant_page_seconds),
    ),
    mean_weighted_errors: average(validResults.map((result) => result.weighted_errors)),
    mean_command_errors: average(validResults.map((result) => result.command_error_count)),
    mean_wrong_or_noisy_fetches: average(
      validResults.map((result) => result.docs?.wrongOrNoisyFetches),
    ),
    mean_docs_fetches: average(validResults.map((result) => result.docs?.docsFetches)),
    mean_unique_docs_resources: average(
      validResults.map((result) => result.docs?.uniqueDocsResources),
    ),
    mean_discovery_fetches: average(validResults.map((result) => result.docs?.discoveryFetches)),
    mean_agent_instruction_fetches: average(
      validResults.map((result) => result.docs?.agentInstructionFetches),
    ),
    mean_target_fetches: average(validResults.map((result) => result.docs?.targetFetches)),
    mean_normalized_retrieval_steps: average(
      validResults.map((result) => result.docs?.normalizedRetrievalSteps),
    ),
    mean_docs_bytes: average(validResults.map((result) => result.docs?.totalDocsBytes)),
    mean_supporting_fetches: average(validResults.map((result) => result.docs?.supportingFetches)),
    mean_neutral_fetches: average(validResults.map((result) => result.docs?.neutralFetches)),
    mean_off_target_before_relevant: average(
      validResults.map((result) => result.docs?.offTargetBeforeRelevant),
    ),
    mean_input_tokens: average(validResults.map((result) => result.usage?.input_tokens)),
    mean_output_tokens: average(validResults.map((result) => result.usage?.output_tokens)),
  };
}

function aggregateResults(summary) {
  if (!Array.isArray(summary.results) || summary.results.length === 0) {
    return summary.aggregate;
  }

  const providers = [...new Set(summary.results.map((result) => result.provider))];
  return providers.map((provider) =>
    aggregateProviderResults(
      provider,
      summary.results.filter((result) => result.provider === provider),
    ),
  );
}

function summaryMarkdown(summary, analysisDir, comparison) {
  return [
    `# Codex Benchmark Summary ${summary.run_id}`,
    "",
    "## Run",
    "",
    `- Scenario: \`${summary.scenario ?? "support-agent-prompting"}\``,
    `- Provider layout: \`${summary.project_layout ?? "benchmark/codex/<provider>"}\``,
    `- Target valid attempts per provider: \`${summary.repeats}\``,
    `- Invalid attempt retry budget: \`${summary.invalid_retries ?? 0}\``,
    `- Analysis output: \`${path.relative(repoRoot, analysisDir)}\``,
    "",
    "## Outcome",
    "",
    "| Provider | Started | Valid | Invalid | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |",
    "| -------- | ------- | ----- | ------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |",
    ...summary.aggregate.map(
      (result) =>
        `| ${result.provider} | ${result.attempts_started ?? result.attempts} | ${result.valid_attempts ?? result.attempts} | ${result.invalid_attempts ?? 0} | ${formatMetricValue(result.success_rate)} | ${formatMetricValue(result.error_free_rate)} | ${formatMetricValue(result.task_error_rate)} | ${formatMetricValue(result.acceptance_error_rate)} | ${formatMetricValue(result.session_error_rate)} | ${formatMetricValue(result.docs_error_rate)} |`,
    ),
    "",
    "## Speed And Retrieval",
    "",
    "| Provider | Median Full Time | Median First Relevant | Raw Fetches | Unique Resources | Discovery Fetches | Agent Instruction Fetches | Target/Fact Fetches | Docs Bytes | Input Tokens | Output Tokens |",
    "| -------- | ---------------- | --------------------- | ----------- | ---------------- | ----------------- | ------------------------- | ------------------- | ---------- | ------------ | ------------- |",
    ...summary.aggregate.map(
      (result) =>
        `| ${result.provider} | ${formatMetricValue(result.median_full_time_seconds)}s | ${formatMetricValue(result.median_first_relevant_seconds)}s | ${formatMetricValue(result.mean_docs_fetches)} | ${formatMetricValue(result.mean_unique_docs_resources)} | ${formatMetricValue(result.mean_discovery_fetches)} | ${formatMetricValue(result.mean_agent_instruction_fetches)} | ${formatMetricValue(result.mean_target_fetches)} | ${formatMetricValue(result.mean_docs_bytes)} | ${formatMetricValue(result.mean_input_tokens)} | ${formatMetricValue(result.mean_output_tokens)} |`,
    ),
    "",
    "## Wins And Ties",
    "",
    ...comparisonTable(comparison),
    "",
    "## Attempts",
    "",
    "| Provider | Attempt | Valid | Infra Failure | Success | Error-Free | Full Time | First Relevant | Raw Fetches | Unique Resources | Target Source | Input Tokens | Output Tokens | Weighted Errors |",
    "| -------- | ------- | ----- | ------------- | ------- | ---------- | --------- | -------------- | ----------- | ---------------- | ------------- | ------------ | ------------- | --------------- |",
    ...summary.results.map(
      (result) =>
        `| ${result.provider} | ${result.attempt} | ${isValidAttempt(result)} | ${isInfrastructureFailure(result)} | ${result.success} | ${result.error_free} | ${formatMetricValue(result.time?.time_to_full_implementation_seconds)}s | ${formatMetricValue(result.time?.time_to_first_relevant_page_seconds)}s | ${formatMetricValue(result.docs?.rawDocsFetches ?? result.docs?.docsFetches)} | ${formatMetricValue(result.docs?.uniqueDocsResources)} | ${result.docs?.firstRelevantSource ?? "none"} | ${formatMetricValue(result.usage?.input_tokens)} | ${formatMetricValue(result.usage?.output_tokens)} | ${formatMetricValue(result.weighted_errors)} |`,
    ),
    "",
    "Use `BENCHMARK_REPEATS=3` or higher before claiming an error-rate win.",
    "",
  ].join("\n");
}

async function latestSummaryFile() {
  const artifactsDir = path.join(benchmarkRoot, "artifacts");
  const entries = (await readdir(artifactsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const latest = entries.at(-1);
  if (!latest) throw new Error("No benchmark summaries found.");
  return path.join(artifactsDir, latest, "summary.json");
}

function metricLogEntry(result) {
  return {
    run_id: result.run_id,
    agent: result.agent,
    scenario: result.scenario,
    provider: result.provider,
    attempt: result.attempt,
    valid_attempt: isValidAttempt(result),
    infrastructure_failure: isInfrastructureFailure(result),
    success: result.success,
    error_free: result.error_free,
    acceptance_passed: result.acceptance_passed,
    weighted_errors: result.weighted_errors,
    command_error_count: result.command_error_count,
    missing_artifact_checks: result.missing_artifact_checks,
    docs_fetches: result.docs?.docsFetches,
    raw_docs_fetches: result.docs?.rawDocsFetches ?? result.docs?.docsFetches,
    unique_docs_resources: result.docs?.uniqueDocsResources,
    docs_bytes: result.docs?.totalDocsBytes,
    relevant_fetches: result.docs?.relevantFetches,
    target_fetches: result.docs?.targetFetches,
    discovery_fetches: result.docs?.discoveryFetches,
    search_fetches: result.docs?.searchFetches,
    agent_instruction_fetches: result.docs?.agentInstructionFetches,
    supporting_fetches: result.docs?.supportingFetches,
    neutral_fetches: result.docs?.neutralFetches,
    wrong_or_noisy_fetches: result.docs?.wrongOrNoisyFetches,
    normalized_retrieval_steps: result.docs?.normalizedRetrievalSteps,
    supporting_before_relevant: result.docs?.supportingBeforeRelevant,
    neutral_before_relevant: result.docs?.neutralBeforeRelevant,
    noisy_before_relevant: result.docs?.noisyBeforeRelevant,
    off_target_before_relevant: result.docs?.offTargetBeforeRelevant,
    first_relevant_url: result.docs?.firstRelevantUrl,
    first_relevant_source: result.docs?.firstRelevantSource,
    discovery_used: result.docs?.discoveryUsed,
    input_tokens: result.usage?.input_tokens,
    cached_input_tokens: result.usage?.cached_input_tokens,
    output_tokens: result.usage?.output_tokens,
    estimated_model_cost_usd: result.estimated_model_cost_usd,
    time_to_first_docs_fetch_seconds: result.time?.time_to_first_docs_fetch_seconds,
    time_to_first_relevant_page_seconds: result.time?.time_to_first_relevant_page_seconds,
    time_to_full_implementation_seconds: result.time?.time_to_full_implementation_seconds,
    project_dir: result.project_dir,
    artifact_dir: result.artifact_dir,
    workspace_dir: result.workspace_dir,
  };
}

const summaryFile = process.argv[2] ? path.resolve(process.argv[2]) : await latestSummaryFile();
if (!existsSync(summaryFile)) throw new Error(`Summary file not found: ${summaryFile}`);

const summary = JSON.parse(await readFile(summaryFile, "utf8"));
summary.aggregate = aggregateResults(summary);
const analysisDir = path.join(benchmarkRoot, "analysis", summary.run_id);
await mkdir(analysisDir, { recursive: true });

const metricRows = summary.results.map(metricLogEntry);
const comparison = compareAggregate(summary.aggregate);
await writeFile(
  path.join(analysisDir, "metric-log.jsonl"),
  `${metricRows.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
);
await writeFile(path.join(analysisDir, "aggregate.json"), json(summary.aggregate));
await writeFile(path.join(analysisDir, "comparison.json"), json(comparison));
await writeFile(
  path.join(path.dirname(summaryFile), "summary.md"),
  summaryMarkdown(summary, analysisDir, comparison),
);
await writeFile(
  path.join(analysisDir, "report.md"),
  [
    `# Benchmark Analysis ${summary.run_id}`,
    "",
    "| Provider | Started | Valid | Invalid | Task Error Rate | Acceptance Error Rate | Session Error Rate | Docs Error Rate | Error-Free Rate | Median Full Time (s) | Mean Weighted Errors |",
    "| -------- | ------- | ----- | ------- | --------------- | --------------------- | ------------------ | --------------- | --------------- | -------------------- | -------------------- |",
    ...summary.aggregate.map(
      (result) =>
        `| ${result.provider} | ${result.attempts_started} | ${result.valid_attempts} | ${result.invalid_attempts} | ${result.task_error_rate} | ${result.acceptance_error_rate} | ${result.session_error_rate} | ${result.docs_error_rate} | ${result.error_free_rate} | ${result.median_full_time_seconds ?? "n/a"} | ${result.mean_weighted_errors ?? "n/a"} |`,
    ),
    "",
    "## Metric Comparison",
    "",
    ...comparisonTable(comparison),
    "",
    "Raw per-attempt metrics are available in `metric-log.jsonl`.",
    "",
  ].join("\n"),
);

console.log(`Wrote analysis: ${path.relative(process.cwd(), analysisDir)}`);

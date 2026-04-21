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
  { key: "mean_agent_instruction_fetches", label: "Mean agent instruction fetches", better: "higher" },
  { key: "mean_target_fetches", label: "Mean target/fact fetches", better: "higher" },
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
    const tiedProviders = numericValues.filter((entry) => Math.abs(entry.value - bestValue) < 0.001);

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

function summaryMarkdown(summary, analysisDir, comparison) {
  return [
    `# Codex Benchmark Summary ${summary.run_id}`,
    "",
    "## Run",
    "",
    `- Scenario: \`${summary.scenario ?? "support-agent-prompting"}\``,
    `- Provider layout: \`${summary.project_layout ?? "benchmark/codex/<provider>"}\``,
    `- Attempts per provider: \`${summary.repeats}\``,
    `- Analysis output: \`${path.relative(repoRoot, analysisDir)}\``,
    "",
    "## Outcome",
    "",
    "| Provider | Attempts | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |",
    "| -------- | -------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |",
    ...summary.aggregate.map(
      (result) =>
        `| ${result.provider} | ${result.attempts} | ${formatMetricValue(result.success_rate)} | ${formatMetricValue(result.error_free_rate)} | ${formatMetricValue(result.task_error_rate)} | ${formatMetricValue(result.acceptance_error_rate)} | ${formatMetricValue(result.session_error_rate)} | ${formatMetricValue(result.docs_error_rate)} |`,
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
    "| Provider | Attempt | Success | Error-Free | Full Time | First Relevant | Raw Fetches | Unique Resources | Target Source | Input Tokens | Output Tokens | Weighted Errors |",
    "| -------- | ------- | ------- | ---------- | --------- | -------------- | ----------- | ---------------- | ------------- | ------------ | ------------- | --------------- |",
    ...summary.results.map(
      (result) =>
        `| ${result.provider} | ${result.attempt} | ${result.success} | ${result.error_free} | ${formatMetricValue(result.time?.time_to_full_implementation_seconds)}s | ${formatMetricValue(result.time?.time_to_first_relevant_page_seconds)}s | ${formatMetricValue(result.docs?.rawDocsFetches ?? result.docs?.docsFetches)} | ${formatMetricValue(result.docs?.uniqueDocsResources)} | ${result.docs?.firstRelevantSource ?? "none"} | ${formatMetricValue(result.usage?.input_tokens)} | ${formatMetricValue(result.usage?.output_tokens)} | ${formatMetricValue(result.weighted_errors)} |`,
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
const analysisDir = path.join(benchmarkRoot, "analysis", summary.run_id);
await mkdir(analysisDir, { recursive: true });

const metricRows = summary.results.map(metricLogEntry);
const comparison = summary.comparison ?? compareAggregate(summary.aggregate);
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
    "| Provider | Attempts | Task Error Rate | Acceptance Error Rate | Session Error Rate | Docs Error Rate | Error-Free Rate | Median Full Time (s) | Mean Weighted Errors |",
    "| -------- | -------- | --------------- | --------------------- | ------------------ | --------------- | --------------- | -------------------- | -------------------- |",
    ...summary.aggregate.map(
      (result) =>
        `| ${result.provider} | ${result.attempts} | ${result.task_error_rate} | ${result.acceptance_error_rate} | ${result.session_error_rate} | ${result.docs_error_rate} | ${result.error_free_rate} | ${result.median_full_time_seconds ?? "n/a"} | ${result.mean_weighted_errors ?? "n/a"} |`,
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

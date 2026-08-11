import { readFileSync } from "node:fs";
import type { DocsGoldenTasksReport } from "./agent-evals.js";
import type { DocsAgentFeedbackImprovementReport } from "./agent-feedback-loop.js";
import {
  DOCS_AGENT_FEEDBACK_EVALUATION_BASELINE_FORMAT,
  type DocsAgentFeedbackEvaluationBaseline,
} from "./agent-feedback-evaluations.js";
import type { DocsAgentGoldenTask } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

export function readDocsAgentFeedbackImprovementReport(
  filePath: string,
): DocsAgentFeedbackImprovementReport {
  const value = readJsonFile(filePath);
  if (
    !isRecord(value) ||
    value.format !== "farming-labs-agent-feedback-improvements.v1" ||
    !Array.isArray(value.clusters) ||
    typeof value.feedbackCount !== "number" ||
    typeof value.recurringClusterCount !== "number"
  ) {
    throw new Error("Input is not a supported agent feedback improvement report.");
  }
  return value as unknown as DocsAgentFeedbackImprovementReport;
}

export function readDocsAgentEvaluationTasksFile(filePath: string): DocsAgentGoldenTask[] {
  const value = readJsonFile(filePath);
  if (Array.isArray(value)) return value as DocsAgentGoldenTask[];
  if (!isRecord(value)) {
    throw new Error("Existing evaluation tasks must be a JSON object or array.");
  }
  if (Array.isArray(value.candidates)) {
    return value.candidates.flatMap((candidate) =>
      isRecord(candidate) && isRecord(candidate.task)
        ? [candidate.task as unknown as DocsAgentGoldenTask]
        : [],
    );
  }
  if (Array.isArray(value.tasks)) return value.tasks as DocsAgentGoldenTask[];
  if (
    isRecord(value.agent) &&
    isRecord(value.agent.evaluations) &&
    Array.isArray(value.agent.evaluations.tasks)
  ) {
    return value.agent.evaluations.tasks as DocsAgentGoldenTask[];
  }
  throw new Error("Could not find evaluation tasks in the existing JSON file.");
}

export function readDocsGoldenTasksReportFile(filePath: string): DocsGoldenTasksReport {
  const value = readJsonFile(filePath);
  const report = isRecord(value) && isRecord(value.evaluations) ? value.evaluations : value;
  if (
    !isRecord(report) ||
    !Array.isArray(report.tasks) ||
    typeof report.taskCount !== "number" ||
    !(typeof report.score === "number" || report.score === null)
  ) {
    throw new Error("Input does not contain a golden-task evaluation report.");
  }
  return report as unknown as DocsGoldenTasksReport;
}

export function readDocsAgentFeedbackEvaluationBaseline(
  filePath: string,
): DocsAgentFeedbackEvaluationBaseline {
  const value = readJsonFile(filePath);
  if (
    !isRecord(value) ||
    value.format !== DOCS_AGENT_FEEDBACK_EVALUATION_BASELINE_FORMAT ||
    typeof value.score !== "number" ||
    !Array.isArray(value.tasks)
  ) {
    throw new Error("Evaluation baseline format is not supported.");
  }
  return value as unknown as DocsAgentFeedbackEvaluationBaseline;
}

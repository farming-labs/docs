import type {
  DocsAgentFeedbackCluster,
  DocsAgentFeedbackImprovementReport,
} from "./agent-feedback-loop.js";
import type { DocsGoldenTasksReport } from "./agent-evals.js";
import { sha256DocsContent } from "./retrieval-digest.js";
import type { DocsAgentGoldenTask } from "./types.js";

export const DOCS_AGENT_FEEDBACK_EVALUATION_CANDIDATES_FORMAT =
  "farming-labs-agent-feedback-evaluation-candidates.v1" as const;
export const DOCS_AGENT_FEEDBACK_EVALUATION_BASELINE_FORMAT =
  "farming-labs-agent-feedback-evaluation-baseline.v1" as const;
export const DOCS_AGENT_FEEDBACK_EVALUATION_REGRESSION_FORMAT =
  "farming-labs-agent-feedback-evaluation-regression.v1" as const;

export interface DocsAgentFeedbackEvaluationCandidate {
  id: string;
  fingerprint: string;
  state: "candidate";
  task: DocsAgentGoldenTask;
  evidence: {
    clusterId: string;
    page: string;
    occurrences: number;
    outcomes: string[];
  };
  sanitization: { redactionCount: number };
  promotion: {
    target: "agent.evaluations.tasks";
    requiresHumanReview: true;
  };
}

export interface DocsAgentFeedbackEvaluationDuplicate {
  clusterId: string;
  taskId: string;
  fingerprint: string;
  reason: "existing-id" | "existing-fingerprint" | "duplicate-candidate";
}

export interface DocsAgentFeedbackEvaluationCandidateRegistry {
  format: typeof DOCS_AGENT_FEEDBACK_EVALUATION_CANDIDATES_FORMAT;
  generatedAt: string;
  sourceFeedbackCount: number;
  sourceClusterCount: number;
  candidateCount: number;
  duplicateCount: number;
  redactionCount: number;
  candidates: DocsAgentFeedbackEvaluationCandidate[];
  duplicates: DocsAgentFeedbackEvaluationDuplicate[];
  promotion: {
    mode: "review-required";
    automaticallyUpdatesConfig: false;
    automaticallyPublishes: false;
  };
}

export interface BuildDocsAgentFeedbackEvaluationCandidatesOptions {
  generatedAt?: string;
  existingTasks?: readonly DocsAgentGoldenTask[];
}

export interface DocsAgentFeedbackEvaluationTaskBaseline {
  id: string;
  passed: boolean;
  score: number;
}

export interface DocsAgentFeedbackEvaluationBaseline {
  format: typeof DOCS_AGENT_FEEDBACK_EVALUATION_BASELINE_FORMAT;
  generatedAt: string;
  score: number;
  taskCount: number;
  passedTaskCount: number;
  tasks: DocsAgentFeedbackEvaluationTaskBaseline[];
}

export interface DocsAgentFeedbackEvaluationRegression {
  kind: "missing-task" | "new-failure" | "pass-to-fail" | "score-drop" | "suite-score-drop";
  taskId?: string;
  message: string;
}

export interface DocsAgentFeedbackEvaluationRegressionReport {
  format: typeof DOCS_AGENT_FEEDBACK_EVALUATION_REGRESSION_FORMAT;
  passed: boolean;
  baselineScore: number;
  currentScore: number;
  scoreDelta: number;
  maxScoreDrop: number;
  regressions: DocsAgentFeedbackEvaluationRegression[];
}

export interface CompareDocsAgentFeedbackEvaluationOptions {
  /** Maximum allowed score decrease for the suite and each task. @default 0 */
  maxScoreDrop?: number;
  /** Treat newly added failing tasks as regressions. @default true */
  failOnNewFailures?: boolean;
}

const SECRET_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string | ((match: string) => string);
}> = [
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
    replacement: "[redacted-private-key]",
  },
  {
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/gu,
    replacement: "[redacted-token]",
  },
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/giu,
    replacement: "Bearer [redacted-token]",
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    replacement: "[redacted-email]",
  },
  {
    pattern: /([?&](?:api[_-]?key|password|secret|signature|token)=)[^&#\s]+/giu,
    replacement: (match) => `${match.slice(0, match.indexOf("=") + 1)}[redacted]`,
  },
];

function sanitizeText(value: unknown, maxLength: number): { value?: string; redactions: number } {
  if (typeof value !== "string") return { redactions: 0 };
  let output = value
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .trim()
    .replace(/\s+/g, " ");
  let redactions = 0;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    output = output.replace(pattern, (match) => {
      redactions += 1;
      return typeof replacement === "function" ? replacement(match) : replacement;
    });
  }
  return output ? { value: output.slice(0, maxLength), redactions } : { redactions };
}

function sanitizeStringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): { values: string[]; redactions: number } {
  if (!Array.isArray(value)) return { values: [], redactions: 0 };
  const values: string[] = [];
  let redactions = 0;
  for (const item of value.slice(0, maxItems)) {
    const sanitized = sanitizeText(item, maxLength);
    redactions += sanitized.redactions;
    if (sanitized.value && !values.includes(sanitized.value)) values.push(sanitized.value);
  }
  return { values, redactions };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "feedback-evaluation"
  );
}

function fingerprintTask(task: DocsAgentGoldenTask): string {
  const sources = [...(task.expect.relevantSources ?? [])].sort();
  return `sha256:${sha256DocsContent(
    JSON.stringify({
      query: task.query.trim().toLowerCase(),
      sources,
      filters: task.filters ?? null,
    }),
  )}`;
}

function sanitizeClusterTask(cluster: DocsAgentFeedbackCluster): {
  task?: DocsAgentGoldenTask;
  redactions: number;
} {
  const rawTask = cluster.goldenTask;
  if (!rawTask) return { redactions: 0 };
  const query = sanitizeText(rawTask.query, 500);
  const relevant = sanitizeStringList(rawTask.expect?.relevantSources, 20, 500);
  const citations = sanitizeStringList(rawTask.expect?.requiredCitations, 20, 500);
  const id = sanitizeText(rawTask.id, 120);
  const redactions = query.redactions + relevant.redactions + citations.redactions + id.redactions;
  if (!query.value || relevant.values.length === 0) return { redactions };
  const taskId = slugify(id.value ?? `feedback-${cluster.id}`);
  const topK =
    typeof rawTask.topK === "number" && Number.isFinite(rawTask.topK)
      ? Math.min(100, Math.max(1, Math.floor(rawTask.topK)))
      : 3;
  return {
    redactions,
    task: {
      id: taskId,
      query: query.value,
      tokenBudget:
        typeof rawTask.tokenBudget === "number" && Number.isFinite(rawTask.tokenBudget)
          ? Math.min(1_000_000, Math.max(1, Math.floor(rawTask.tokenBudget)))
          : 4_000,
      topK,
      expect: {
        relevantSources: relevant.values,
        requiredCitations: citations.values.length > 0 ? citations.values : relevant.values,
        minRecallAtK: 1,
        maxFirstRelevantRank: topK,
      },
    },
  };
}

export function buildDocsAgentFeedbackEvaluationCandidates(
  report: DocsAgentFeedbackImprovementReport,
  options: BuildDocsAgentFeedbackEvaluationCandidatesOptions = {},
): DocsAgentFeedbackEvaluationCandidateRegistry {
  if (report.format !== "farming-labs-agent-feedback-improvements.v1") {
    throw new Error("Input is not a supported agent feedback improvement report.");
  }
  const existingTasks = options.existingTasks ?? [];
  const existingIds = new Set(existingTasks.map((task) => task.id));
  const existingFingerprints = new Set(existingTasks.map(fingerprintTask));
  const candidateFingerprints = new Set<string>();
  const candidates: DocsAgentFeedbackEvaluationCandidate[] = [];
  const duplicates: DocsAgentFeedbackEvaluationDuplicate[] = [];
  let redactionCount = 0;

  for (const cluster of report.clusters) {
    const clusterId = sanitizeText(cluster.id, 200);
    const sanitized = sanitizeClusterTask(cluster);
    redactionCount += clusterId.redactions + sanitized.redactions;
    if (!sanitized.task) continue;
    const fingerprint = fingerprintTask(sanitized.task);
    const reason = existingIds.has(sanitized.task.id)
      ? "existing-id"
      : existingFingerprints.has(fingerprint)
        ? "existing-fingerprint"
        : candidateFingerprints.has(fingerprint)
          ? "duplicate-candidate"
          : undefined;
    if (reason) {
      duplicates.push({
        clusterId: slugify(clusterId.value ?? "feedback"),
        taskId: sanitized.task.id,
        fingerprint,
        reason,
      });
      continue;
    }
    candidateFingerprints.add(fingerprint);
    const page = sanitizeText(cluster.page, 500);
    const outcomes = sanitizeStringList(cluster.outcomes, 20, 200);
    redactionCount += page.redactions + outcomes.redactions;
    candidates.push({
      id: `candidate-${slugify(clusterId.value ?? "feedback")}`,
      fingerprint,
      state: "candidate",
      task: sanitized.task,
      evidence: {
        clusterId: slugify(clusterId.value ?? "feedback"),
        page: page.value ?? "(unknown page)",
        occurrences: Math.max(1, Math.floor(cluster.occurrences)),
        outcomes: outcomes.values,
      },
      sanitization: {
        redactionCount:
          sanitized.redactions + clusterId.redactions + page.redactions + outcomes.redactions,
      },
      promotion: {
        target: "agent.evaluations.tasks",
        requiresHumanReview: true,
      },
    });
  }

  candidates.sort((left, right) => left.id.localeCompare(right.id));
  return {
    format: DOCS_AGENT_FEEDBACK_EVALUATION_CANDIDATES_FORMAT,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceFeedbackCount: report.feedbackCount,
    sourceClusterCount: report.recurringClusterCount,
    candidateCount: candidates.length,
    duplicateCount: duplicates.length,
    redactionCount,
    candidates,
    duplicates,
    promotion: {
      mode: "review-required",
      automaticallyUpdatesConfig: false,
      automaticallyPublishes: false,
    },
  };
}

export function createDocsAgentFeedbackEvaluationBaseline(
  report: DocsGoldenTasksReport,
  generatedAt = new Date().toISOString(),
): DocsAgentFeedbackEvaluationBaseline {
  if (report.score === null || report.taskCount === 0) {
    throw new Error("Cannot create a baseline from an unmeasured evaluation report.");
  }
  return {
    format: DOCS_AGENT_FEEDBACK_EVALUATION_BASELINE_FORMAT,
    generatedAt,
    score: report.score,
    taskCount: report.taskCount,
    passedTaskCount: report.passedTaskCount,
    tasks: report.tasks
      .map((task) => ({ id: task.id, passed: task.passed, score: task.score }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function compareDocsAgentFeedbackEvaluationBaseline(
  current: DocsGoldenTasksReport,
  baseline: DocsAgentFeedbackEvaluationBaseline,
  options: CompareDocsAgentFeedbackEvaluationOptions = {},
): DocsAgentFeedbackEvaluationRegressionReport {
  if (current.score === null) throw new Error("Current evaluation report is unmeasured.");
  if (baseline.format !== DOCS_AGENT_FEEDBACK_EVALUATION_BASELINE_FORMAT) {
    throw new Error("Evaluation baseline format is not supported.");
  }
  const requestedScoreDrop = options.maxScoreDrop ?? 0;
  if (!Number.isFinite(requestedScoreDrop) || requestedScoreDrop < 0 || requestedScoreDrop > 100) {
    throw new Error("maxScoreDrop must be a number from 0 through 100.");
  }
  const maxScoreDrop = requestedScoreDrop;
  const regressions: DocsAgentFeedbackEvaluationRegression[] = [];
  const scoreDelta = round(current.score - baseline.score);
  if (scoreDelta < -maxScoreDrop) {
    regressions.push({
      kind: "suite-score-drop",
      message: `Suite score dropped from ${baseline.score} to ${current.score}.`,
    });
  }
  const currentById = new Map(current.tasks.map((task) => [task.id, task]));
  const baselineIds = new Set(baseline.tasks.map((task) => task.id));
  for (const expected of baseline.tasks) {
    const actual = currentById.get(expected.id);
    if (!actual) {
      regressions.push({
        kind: "missing-task",
        taskId: expected.id,
        message: `Baseline task ${expected.id} is missing from the current report.`,
      });
      continue;
    }
    if (expected.passed && !actual.passed) {
      regressions.push({
        kind: "pass-to-fail",
        taskId: expected.id,
        message: `Task ${expected.id} changed from passing to failing.`,
      });
    }
    if (actual.score < expected.score - maxScoreDrop) {
      regressions.push({
        kind: "score-drop",
        taskId: expected.id,
        message: `Task ${expected.id} score dropped from ${expected.score} to ${actual.score}.`,
      });
    }
  }
  if (options.failOnNewFailures !== false) {
    for (const task of current.tasks) {
      if (!baselineIds.has(task.id) && !task.passed) {
        regressions.push({
          kind: "new-failure",
          taskId: task.id,
          message: `New task ${task.id} is failing.`,
        });
      }
    }
  }
  return {
    format: DOCS_AGENT_FEEDBACK_EVALUATION_REGRESSION_FORMAT,
    passed: regressions.length === 0,
    baselineScore: baseline.score,
    currentScore: current.score,
    scoreDelta,
    maxScoreDrop,
    regressions,
  };
}

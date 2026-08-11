import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DocsGoldenTasksReport } from "./agent-evals.js";
import type { DocsAgentFeedbackImprovementReport } from "./agent-feedback-loop.js";
import {
  buildDocsAgentFeedbackEvaluationCandidates,
  compareDocsAgentFeedbackEvaluationBaseline,
  createDocsAgentFeedbackEvaluationBaseline,
} from "./agent-feedback-evaluations.js";
import { readDocsGoldenTasksReportFile } from "./agent-feedback-evaluations-node.js";

function feedbackReport(): DocsAgentFeedbackImprovementReport {
  const goldenTask = {
    id: "feedback-install",
    query: "Install with sk-secretToken123456 for person@example.com",
    tokenBudget: 4_000,
    topK: 3,
    expect: {
      relevantSources: ["/docs/install?token=private-value"],
      requiredCitations: ["/docs/install?token=private-value"],
      minRecallAtK: 1,
      maxFirstRelevantRank: 3,
    },
  };
  return {
    format: "farming-labs-agent-feedback-improvements.v1",
    generatedAt: "2026-08-12T00:00:00.000Z",
    feedbackCount: 3,
    failureCount: 3,
    recurringClusterCount: 2,
    clusters: [
      {
        id: "install",
        page: "/docs/install",
        task: "Install package",
        occurrences: 2,
        outcomes: ["blocked"],
        missingContext: [],
        docIssues: [],
        suggestedImprovements: [],
        goldenTask,
        issue: { title: "Install", body: "", labels: [] },
      },
      {
        id: "install-duplicate",
        page: "/docs/install",
        task: "Install package",
        occurrences: 1,
        outcomes: ["failed"],
        missingContext: [],
        docIssues: [],
        suggestedImprovements: [],
        goldenTask: { ...goldenTask, id: "another-id" },
        issue: { title: "Install", body: "", labels: [] },
      },
    ],
    goldenTasks: [goldenTask],
    issueDrafts: [],
    pullRequestDraft: { title: "Draft", body: "" },
  };
}

function evaluationReport(
  tasks: Array<{ id: string; passed: boolean; score: number }>,
  score: number,
): DocsGoldenTasksReport {
  return {
    status: tasks.every((task) => task.passed) ? "passed" : "failed",
    passed: tasks.every((task) => task.passed),
    score,
    taskCount: tasks.length,
    passedTaskCount: tasks.filter((task) => task.passed).length,
    failedTaskCount: tasks.filter((task) => !task.passed).length,
    quality: {} as DocsGoldenTasksReport["quality"],
    coverage: {} as DocsGoldenTasksReport["coverage"],
    tasks: tasks as unknown as DocsGoldenTasksReport["tasks"],
  };
}

describe("feedback-derived evaluation candidates", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("redacts sensitive feedback, deduplicates tasks, and requires review", () => {
    const registry = buildDocsAgentFeedbackEvaluationCandidates(feedbackReport(), {
      generatedAt: "2026-08-12T00:00:00.000Z",
    });

    expect(registry).toMatchObject({
      format: "farming-labs-agent-feedback-evaluation-candidates.v1",
      sourceClusterCount: 2,
      candidateCount: 1,
      duplicateCount: 1,
      promotion: {
        mode: "review-required",
        automaticallyUpdatesConfig: false,
        automaticallyPublishes: false,
      },
    });
    expect(registry.redactionCount).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(registry)).not.toContain("secretToken");
    expect(JSON.stringify(registry)).not.toContain("person@example.com");
    expect(JSON.stringify(registry)).not.toContain("private-value");
    expect(registry.candidates[0]).toMatchObject({
      state: "candidate",
      promotion: { target: "agent.evaluations.tasks", requiresHumanReview: true },
    });
    expect(registry.duplicates[0]?.reason).toBe("duplicate-candidate");
  });

  it("deduplicates candidates against existing task ids and fingerprints", () => {
    const first = buildDocsAgentFeedbackEvaluationCandidates(feedbackReport());
    const registry = buildDocsAgentFeedbackEvaluationCandidates(feedbackReport(), {
      existingTasks: [first.candidates[0]!.task],
    });
    expect(registry.candidateCount).toBe(0);
    expect(registry.duplicates.map((duplicate) => duplicate.reason)).toContain("existing-id");
  });

  it("creates baselines and detects pass, score, missing, and new-task regressions", () => {
    const baseline = createDocsAgentFeedbackEvaluationBaseline(
      evaluationReport(
        [
          { id: "install", passed: true, score: 100 },
          { id: "theme", passed: true, score: 90 },
        ],
        95,
      ),
      "2026-08-12T00:00:00.000Z",
    );
    const comparison = compareDocsAgentFeedbackEvaluationBaseline(
      evaluationReport(
        [
          { id: "install", passed: false, score: 70 },
          { id: "new-task", passed: false, score: 50 },
        ],
        60,
      ),
      baseline,
    );

    expect(comparison.passed).toBe(false);
    expect(comparison.regressions.map((regression) => regression.kind)).toEqual(
      expect.arrayContaining([
        "suite-score-drop",
        "pass-to-fail",
        "score-drop",
        "missing-task",
        "new-failure",
      ]),
    );
    expect(
      compareDocsAgentFeedbackEvaluationBaseline(
        evaluationReport(
          [
            { id: "install", passed: true, score: 100 },
            { id: "theme", passed: true, score: 90 },
          ],
          95,
        ),
        baseline,
      ).passed,
    ).toBe(true);
  });

  it("reads evaluation data from doctor JSON reports", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "docs-feedback-evals-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "doctor.json");
    writeFileSync(
      filePath,
      JSON.stringify({
        mode: "agent",
        evaluations: evaluationReport([{ id: "a", passed: true, score: 100 }], 100),
      }),
      "utf8",
    );
    expect(readDocsGoldenTasksReportFile(filePath)).toMatchObject({ score: 100, taskCount: 1 });
  });
});

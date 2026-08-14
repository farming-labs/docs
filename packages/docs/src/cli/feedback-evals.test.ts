import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocsAgentFeedbackImprovementReport } from "../agent-feedback-loop.js";
import type { DocsGoldenTasksReport } from "../agent-evals.js";
import {
  parseAgentFeedbackEvaluationsArgs,
  runAgentFeedbackEvaluations,
} from "./feedback-evals.js";

function feedbackReport(): DocsAgentFeedbackImprovementReport {
  const goldenTask = {
    id: "feedback-install",
    query: "Install existing app",
    expect: {
      relevantSources: ["/docs/install"],
      requiredCitations: ["/docs/install"],
    },
  };
  return {
    format: "farming-labs-agent-feedback-improvements.v1",
    generatedAt: "2026-08-12T00:00:00.000Z",
    feedbackCount: 2,
    failureCount: 2,
    recurringClusterCount: 1,
    clusters: [
      {
        id: "install",
        page: "/docs/install",
        task: "Install existing app",
        occurrences: 2,
        outcomes: ["blocked"],
        missingContext: [],
        docIssues: [],
        suggestedImprovements: [],
        goldenTask,
        issue: { title: "Install", body: "", labels: [] },
      },
    ],
    goldenTasks: [goldenTask],
    issueDrafts: [],
    pullRequestDraft: { title: "Draft", body: "" },
  };
}

function results(passed: boolean, score: number): DocsGoldenTasksReport {
  return {
    status: passed ? "passed" : "failed",
    passed,
    score,
    taskCount: 1,
    passedTaskCount: passed ? 1 : 0,
    failedTaskCount: passed ? 0 : 1,
    quality: {} as DocsGoldenTasksReport["quality"],
    coverage: {} as DocsGoldenTasksReport["coverage"],
    tasks: [{ id: "feedback-install", passed, score }] as DocsGoldenTasksReport["tasks"],
  };
}

describe("agent feedback evaluations CLI", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("parses candidate and regression flags", () => {
    expect(
      parseAgentFeedbackEvaluationsArgs([
        "--input",
        "feedback.json",
        "--existing",
        "tasks.json",
        "--write",
      ]),
    ).toEqual({
      existing: ["tasks.json"],
      input: "feedback.json",
      write: true,
    });
    expect(
      parseAgentFeedbackEvaluationsArgs([
        "--results",
        "doctor.json",
        "--baseline",
        "baseline.json",
        "--check",
        "--max-score-drop",
        "2.5",
      ]),
    ).toEqual({
      existing: [],
      results: "doctor.json",
      baseline: "baseline.json",
      check: true,
      maxScoreDrop: 2.5,
    });
  });

  it("writes review-required candidates", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-feedback-evals-cli-"));
    temporaryDirectories.push(rootDir);
    writeFileSync(path.join(rootDir, "feedback.json"), JSON.stringify(feedbackReport()), "utf8");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runAgentFeedbackEvaluations({ rootDir, input: "feedback.json", write: true });
    const registry = JSON.parse(
      readFileSync(path.join(rootDir, ".farming-labs", "agent-evaluation-candidates.json"), "utf8"),
    );
    expect(registry.candidateCount).toBe(1);
    expect(registry.promotion.mode).toBe("review-required");
  });

  it("writes a baseline and fails checks on regressions", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-feedback-regression-cli-"));
    temporaryDirectories.push(rootDir);
    writeFileSync(path.join(rootDir, "results.json"), JSON.stringify(results(true, 100)), "utf8");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runAgentFeedbackEvaluations({
      rootDir,
      results: "results.json",
      baseline: "baseline.json",
      writeBaseline: true,
    });
    expect(JSON.parse(readFileSync(path.join(rootDir, "baseline.json"), "utf8")).score).toBe(100);

    writeFileSync(path.join(rootDir, "results.json"), JSON.stringify(results(false, 60)), "utf8");
    await expect(
      runAgentFeedbackEvaluations({
        rootDir,
        results: "results.json",
        baseline: "baseline.json",
        check: true,
      }),
    ).rejects.toThrow("regression check failed");
  });

  it("rejects paths outside the project", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-feedback-evals-path-"));
    temporaryDirectories.push(rootDir);
    await expect(
      runAgentFeedbackEvaluations({ rootDir, input: "../feedback.json" }),
    ).rejects.toThrow("stay inside the project root");
  });
});

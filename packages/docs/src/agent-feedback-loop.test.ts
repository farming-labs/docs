import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeDocsAgentFeedback, readDocsAgentFeedbackFile } from "./agent-feedback-loop.js";

describe("agent feedback improvement loop", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("clusters recurring failures into issue and golden-task drafts", () => {
    const report = analyzeDocsAgentFeedback(
      [
        {
          context: { page: "/docs/install" },
          payload: {
            task: "Install the package in an existing Next.js app",
            outcome: "blocked",
            neededCodeReading: true,
            missingContext: ["Required peer dependencies"],
            docIssues: ["No existing-app example"],
          },
        },
        {
          context: { page: "/docs/install" },
          payload: {
            task: "How do I install the package in an existing Next.js app?",
            outcome: "partial",
            missingContext: ["Required peer dependencies"],
            suggestedImprovement: "Add a copyable existing-app command.",
          },
        },
        {
          context: { page: "/docs/theme" },
          payload: { task: "Change the theme", outcome: "implemented" },
        },
      ],
      { generatedAt: "2026-08-11T00:00:00.000Z" },
    );

    expect(report).toMatchObject({
      format: "farming-labs-agent-feedback-improvements.v1",
      feedbackCount: 3,
      failureCount: 2,
      recurringClusterCount: 1,
    });
    expect(report.clusters[0]).toMatchObject({
      page: "/docs/install",
      occurrences: 2,
      missingContext: ["Required peer dependencies"],
      goldenTask: {
        expect: {
          relevantSources: ["/docs/install"],
          requiredCitations: ["/docs/install"],
        },
      },
    });
    expect(report.issueDrafts[0]?.body).toContain("Add a copyable existing-app command.");
    expect(report.pullRequestDraft.body).toContain("Run docs doctor --agent");
  });

  it("reads array JSON and JSON Lines feedback exports", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "docs-feedback-"));
    temporaryDirectories.push(directory);
    const jsonPath = path.join(directory, "feedback.json");
    const jsonlPath = path.join(directory, "feedback.jsonl");
    const feedback = { context: { page: "/docs/a" }, payload: { task: "A", outcome: "blocked" } };
    writeFileSync(jsonPath, JSON.stringify({ feedback: [feedback] }), "utf8");
    writeFileSync(jsonlPath, `${JSON.stringify(feedback)}\n${JSON.stringify(feedback)}\n`, "utf8");

    expect(readDocsAgentFeedbackFile(jsonPath)).toHaveLength(1);
    expect(readDocsAgentFeedbackFile(jsonlPath)).toHaveLength(2);
  });
});

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAgentFeedbackImproveArgs, runAgentFeedbackImprove } from "./feedback.js";

describe("agent feedback CLI", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("parses feedback improvement flags", () => {
    expect(
      parseAgentFeedbackImproveArgs([
        "--input",
        "feedback.jsonl",
        "--min-occurrences",
        "3",
        "--write",
        "--output",
        "plan.json",
      ]),
    ).toEqual({
      input: "feedback.jsonl",
      minOccurrences: 3,
      write: true,
      output: "plan.json",
    });
    expect(() => parseAgentFeedbackImproveArgs(["--min-occurrences", "1"])).toThrow(
      "2 through 100",
    );
  });

  it("writes issue, golden-task, and PR drafts only with --write", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-feedback-cli-"));
    temporaryDirectories.push(rootDir);
    mkdirSync(path.join(rootDir, ".farming-labs"), { recursive: true });
    const feedback = {
      context: { page: "/docs/install" },
      payload: { task: "Install existing app", outcome: "blocked" },
    };
    writeFileSync(
      path.join(rootDir, ".farming-labs", "agent-feedback.jsonl"),
      `${JSON.stringify(feedback)}\n${JSON.stringify(feedback)}\n`,
      "utf8",
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runAgentFeedbackImprove({ rootDir, write: true });
    expect(report.recurringClusterCount).toBe(1);
    const written = JSON.parse(
      readFileSync(path.join(rootDir, ".farming-labs", "agent-feedback-improvements.json"), "utf8"),
    );
    expect(written.goldenTasks).toHaveLength(1);
    expect(written.issueDrafts).toHaveLength(1);
    expect(written.pullRequestDraft.title).toContain("recurring agent feedback");
  });
});

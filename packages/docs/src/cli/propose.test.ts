import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAgentMaintenanceProposeArgs, runAgentMaintenancePropose } from "./propose.js";

describe("agent maintenance proposal CLI", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("parses repeatable inputs and bounded thresholds", () => {
    expect(
      parseAgentMaintenanceProposeArgs([
        "--input",
        "search.jsonl",
        "--input",
        "support.json",
        "--min-occurrences",
        "3",
        "--write",
        "--output",
        "proposals.json",
      ]),
    ).toEqual({
      inputs: ["search.jsonl", "support.json"],
      minOccurrences: 3,
      write: true,
      output: "proposals.json",
    });
    expect(() => parseAgentMaintenanceProposeArgs(["--min-occurrences", "0"])).toThrow(
      "1 through 100",
    );
  });

  it("writes a proposal artifact without mutating source inputs", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-propose-cli-"));
    temporaryDirectories.push(rootDir);
    const inputPath = path.join(rootDir, "signals.jsonl");
    const input = `${JSON.stringify({
      source: "search",
      page: "/docs/install",
      topic: "existing install",
      summary: "Zero results",
      count: 3,
    })}\n`;
    writeFileSync(inputPath, input, "utf8");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runAgentMaintenancePropose({
      rootDir,
      inputs: ["signals.jsonl"],
      write: true,
    });
    expect(report.proposalCount).toBe(1);
    expect(report.execution.mode).toBe("draft-only");
    expect(readFileSync(inputPath, "utf8")).toBe(input);
    const written = JSON.parse(
      readFileSync(path.join(rootDir, ".farming-labs", "agent-maintenance-proposals.json"), "utf8"),
    );
    expect(written.issueDrafts).toHaveLength(1);
    expect(written.goldenTasks).toHaveLength(1);
    expect(written.execution.publishesChanges).toBe(false);
  });

  it("rejects paths outside the project root", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-propose-path-"));
    temporaryDirectories.push(rootDir);
    await expect(
      runAgentMaintenancePropose({ rootDir, inputs: ["../signals.json"] }),
    ).rejects.toThrow("stay inside the project root");
  });
});

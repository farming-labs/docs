import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeDocsAgentMaintenanceSignals,
  readDocsAgentMaintenanceSignalsFile,
} from "./agent-maintenance.js";

describe("agent maintenance proposals", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("combines multi-source signals into ranked, review-only drafts", () => {
    const report = analyzeDocsAgentMaintenanceSignals(
      [
        {
          source: "search",
          page: "/docs/install",
          topic: "install existing app",
          task: "Install in an existing app",
          summary: "Repeated zero-result query",
          count: 4,
          severity: "warning",
        },
        {
          source: "support",
          page: "/docs/install",
          topic: "install existing app",
          summary: "Users miss required peer dependencies",
          count: 2,
          severity: "error",
        },
        {
          source: "mcp",
          page: "/docs/install",
          topic: "install existing app",
          summary: "read_page lacks the existing-app example",
        },
      ],
      { generatedAt: "2026-08-12T00:00:00.000Z" },
    );

    expect(report).toMatchObject({
      format: "farming-labs-agent-maintenance-proposals.v1",
      signalCount: 3,
      representedOccurrences: 7,
      proposalCount: 1,
      execution: {
        mode: "draft-only",
        writesDocumentation: false,
        publishesChanges: false,
        requiresHumanReview: true,
      },
    });
    expect(report.proposals[0]).toMatchObject({
      page: "/docs/install",
      occurrenceCount: 7,
      severity: "error",
      sources: ["mcp", "search", "support"],
      goldenTask: { expect: { relevantSources: ["/docs/install"] } },
    });
    expect(report.proposals[0]?.recommendedActions.join(" ")).toContain("MCP tool");
    expect(report.issueDrafts[0]?.body).toContain("untrusted evidence");
  });

  it("reads generic JSONL, raw feedback, and feedback improvement reports", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "docs-maintenance-"));
    temporaryDirectories.push(directory);
    const jsonlPath = path.join(directory, "signals.jsonl");
    const feedbackPath = path.join(directory, "feedback.json");
    writeFileSync(
      jsonlPath,
      `${JSON.stringify({ source: "issue", summary: "Missing migration steps", page: "/docs/migrate" })}\n${JSON.stringify({ context: { page: "/docs/install" }, payload: { task: "Install", outcome: "blocked" } })}\n`,
      "utf8",
    );
    writeFileSync(
      feedbackPath,
      JSON.stringify({
        format: "farming-labs-agent-feedback-improvements.v1",
        clusters: [
          {
            page: "/docs/install",
            task: "Install existing app",
            occurrences: 3,
            missingContext: ["Peer dependencies"],
          },
        ],
      }),
      "utf8",
    );

    expect(readDocsAgentMaintenanceSignalsFile(jsonlPath)).toMatchObject([
      { source: "issue", page: "/docs/migrate" },
      { source: "agent-feedback", page: "/docs/install", severity: "error" },
    ]);
    expect(readDocsAgentMaintenanceSignalsFile(feedbackPath)).toEqual([
      expect.objectContaining({ source: "agent-feedback", count: 3, summary: "Peer dependencies" }),
    ]);
  });

  it("validates signal counts and supported sources", () => {
    expect(() =>
      analyzeDocsAgentMaintenanceSignals([{ source: "search", summary: "Bad count", count: 0 }]),
    ).toThrow("count must be an integer");
    expect(() =>
      analyzeDocsAgentMaintenanceSignals([
        { source: "unknown" as "search", summary: "Unknown source" },
      ]),
    ).toThrow("source is not supported");
  });
});

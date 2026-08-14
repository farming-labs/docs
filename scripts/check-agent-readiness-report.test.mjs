import assert from "node:assert/strict";
import test from "node:test";

import { validateAgentReadinessReport } from "./check-agent-readiness-report.mjs";

const baseline = {
  version: 1,
  allowedWarnings: [{ id: "known-warning", reason: "Tracked remediation.", required: true }],
};

test("accepts the exact warning baseline", () => {
  assert.deepEqual(
    validateAgentReadinessReport(
      {
        mode: "agent",
        checks: [
          { id: "healthy", status: "pass" },
          { id: "known-warning", status: "warn" },
        ],
      },
      baseline,
    ),
    {
      checks: 2,
      warnings: ["known-warning"],
      allowedWarnings: ["known-warning"],
      passed: true,
    },
  );
});

test("rejects failures and unexpected warnings", () => {
  assert.throws(
    () =>
      validateAgentReadinessReport(
        {
          mode: "agent",
          checks: [
            { id: "hard-failure", status: "fail" },
            { id: "new-warning", status: "warn" },
            { id: "known-warning", status: "warn" },
          ],
        },
        baseline,
      ),
    /failing checks: hard-failure; unexpected warnings: new-warning/u,
  );
});

test("rejects a required warning after it is resolved", () => {
  assert.throws(
    () =>
      validateAgentReadinessReport(
        { mode: "agent", checks: [{ id: "known-warning", status: "pass" }] },
        baseline,
      ),
    /resolved baseline warnings still marked required: known-warning/u,
  );
});

test("allows a non-required historical warning to disappear", () => {
  assert.equal(
    validateAgentReadinessReport(
      { mode: "agent", checks: [{ id: "healthy", status: "pass" }] },
      {
        version: 1,
        allowedWarnings: [
          { id: "historical-warning", reason: "Kept for context.", required: false },
        ],
      },
    ).passed,
    true,
  );
});

test("rejects a non-agent report and duplicate check IDs", () => {
  assert.throws(
    () => validateAgentReadinessReport({ mode: "site", checks: [] }, baseline),
    /must use mode "agent"/u,
  );
  assert.throws(
    () =>
      validateAgentReadinessReport(
        {
          mode: "agent",
          checks: [
            { id: "same", status: "pass" },
            { id: "same", status: "warn" },
          ],
        },
        baseline,
      ),
    /duplicate check IDs/u,
  );
});

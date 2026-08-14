#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read ${label} ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readBaseline(value) {
  const baseline = asRecord(value);
  if (!baseline || baseline.version !== 1 || !Array.isArray(baseline.allowedWarnings)) {
    throw new Error("Agent readiness warning baseline must use version 1 and allowedWarnings[].");
  }

  const entries = baseline.allowedWarnings.map((value, index) => {
    const entry = asRecord(value);
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      typeof entry.reason !== "string" ||
      !entry.reason.trim() ||
      (entry.required !== undefined && typeof entry.required !== "boolean")
    ) {
      throw new Error(`Agent readiness warning baseline entry ${index} is invalid.`);
    }
    return {
      id: entry.id.trim(),
      reason: entry.reason.trim(),
      required: entry.required === true,
    };
  });

  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new Error("Agent readiness warning baseline contains duplicate check IDs.");
  }
  return entries;
}

export function validateAgentReadinessReport(reportValue, baselineValue) {
  const report = asRecord(reportValue);
  if (!report || report.mode !== "agent" || !Array.isArray(report.checks)) {
    throw new Error('Agent readiness report must use mode "agent" and contain checks[].');
  }
  if (report.checks.length === 0) {
    throw new Error("Agent readiness report must contain at least one check.");
  }
  const checks = report.checks.map((value, index) => {
    const check = asRecord(value);
    if (
      !check ||
      typeof check.id !== "string" ||
      !check.id.trim() ||
      !["pass", "warn", "fail"].includes(check.status)
    ) {
      throw new Error(`Agent readiness report check ${index} is invalid.`);
    }
    return { id: check.id.trim(), status: check.status };
  });
  if (new Set(checks.map((check) => check.id)).size !== checks.length) {
    throw new Error("Agent readiness report contains duplicate check IDs.");
  }
  const baseline = readBaseline(baselineValue);
  const allowed = new Map(baseline.map((entry) => [entry.id, entry]));
  const failures = checks.filter((check) => check.status === "fail").map((check) => check.id);
  const warnings = checks.filter((check) => check.status === "warn").map((check) => check.id);
  const unexpectedWarnings = warnings.filter((id) => !allowed.has(id));
  const staleRequiredWarnings = baseline
    .filter((entry) => entry.required && !warnings.includes(entry.id))
    .map((entry) => entry.id);

  const issues = [];
  if (failures.length > 0) issues.push(`failing checks: ${failures.join(", ")}`);
  if (unexpectedWarnings.length > 0) {
    issues.push(`unexpected warnings: ${unexpectedWarnings.join(", ")}`);
  }
  if (staleRequiredWarnings.length > 0) {
    issues.push(
      `resolved baseline warnings still marked required: ${staleRequiredWarnings.join(", ")}`,
    );
  }
  if (issues.length > 0) {
    throw new Error(`Agent readiness policy failed (${issues.join("; ")}).`);
  }

  return {
    checks: checks.length,
    warnings,
    allowedWarnings: warnings.filter((id) => allowed.has(id)),
    passed: true,
  };
}

function main() {
  const reportPath = process.argv[2];
  const baselinePath = process.argv[3];
  if (!reportPath || !baselinePath) {
    throw new Error(
      "Usage: node scripts/check-agent-readiness-report.mjs <doctor.json> <warning-baseline.json>",
    );
  }
  const result = validateAgentReadinessReport(
    readJson(reportPath, "doctor report"),
    readJson(baselinePath, "warning baseline"),
  );
  console.log(
    `Agent readiness policy passed: ${result.checks} checks, ${result.warnings.length} allowed warning${result.warnings.length === 1 ? "" : "s"}.`,
  );
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectExecution) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

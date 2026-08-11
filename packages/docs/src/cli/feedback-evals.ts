import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  buildDocsAgentFeedbackEvaluationCandidates,
  compareDocsAgentFeedbackEvaluationBaseline,
  createDocsAgentFeedbackEvaluationBaseline,
  type DocsAgentFeedbackEvaluationCandidateRegistry,
  type DocsAgentFeedbackEvaluationRegressionReport,
} from "../agent-feedback-evaluations.js";
import {
  readDocsAgentEvaluationTasksFile,
  readDocsAgentFeedbackEvaluationBaseline,
  readDocsAgentFeedbackImprovementReport,
  readDocsGoldenTasksReportFile,
} from "../agent-feedback-evaluations-node.js";

export interface AgentFeedbackEvaluationsOptions {
  input?: string;
  existing?: string[];
  output?: string;
  write?: boolean;
  results?: string;
  baseline?: string;
  writeBaseline?: boolean;
  check?: boolean;
  maxScoreDrop?: number;
  allowNewFailures?: boolean;
  json?: boolean;
  help?: boolean;
  rootDir?: string;
}

export function parseAgentFeedbackEvaluationsArgs(
  argv: readonly string[],
): AgentFeedbackEvaluationsOptions {
  const options: AgentFeedbackEvaluationsOptions = { existing: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--write") options.write = true;
    else if (argument === "--write-baseline") options.writeBaseline = true;
    else if (argument === "--check") options.check = true;
    else if (argument === "--allow-new-failures") options.allowNewFailures = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (
      argument === "--input" ||
      argument === "--existing" ||
      argument === "--output" ||
      argument === "--results" ||
      argument === "--baseline" ||
      argument === "--max-score-drop"
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--input") options.input = value;
      else if (argument === "--existing") options.existing!.push(value);
      else if (argument === "--output") options.output = value;
      else if (argument === "--results") options.results = value;
      else if (argument === "--baseline") options.baseline = value;
      else {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          throw new Error("--max-score-drop must be a number from 0 through 100.");
        }
        options.maxScoreDrop = parsed;
      }
    } else {
      throw new Error(`Unknown agent feedback-evals flag: ${argument}`);
    }
  }
  return options;
}

function resolveProjectPath(rootDir: string, value: string): string {
  if (path.isAbsolute(value)) throw new Error("Evaluation paths must be project-relative.");
  const candidate = path.resolve(rootDir, value);
  const relative = path.relative(rootDir, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Evaluation paths must stay inside the project root.");
  }
  return candidate;
}

function writeJson(outputPath: string, value: unknown): void {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, outputPath);
}

async function runCandidateMode(
  rootDir: string,
  options: AgentFeedbackEvaluationsOptions,
): Promise<DocsAgentFeedbackEvaluationCandidateRegistry> {
  const report = readDocsAgentFeedbackImprovementReport(
    resolveProjectPath(rootDir, options.input ?? ".farming-labs/agent-feedback-improvements.json"),
  );
  const existingTasks = (options.existing ?? []).flatMap((filePath) =>
    readDocsAgentEvaluationTasksFile(resolveProjectPath(rootDir, filePath)),
  );
  const registry = buildDocsAgentFeedbackEvaluationCandidates(report, { existingTasks });
  if (options.write) {
    const outputPath = resolveProjectPath(
      rootDir,
      options.output ?? ".farming-labs/agent-evaluation-candidates.json",
    );
    writeJson(outputPath, registry);
    if (!options.json) {
      console.log(
        pc.green(
          `Wrote ${path.relative(rootDir, outputPath)} with ${registry.candidateCount} review-required candidate${registry.candidateCount === 1 ? "" : "s"}.`,
        ),
      );
    }
  }
  if (options.json || !options.write) console.log(JSON.stringify(registry, null, 2));
  return registry;
}

async function runRegressionMode(
  rootDir: string,
  options: AgentFeedbackEvaluationsOptions,
): Promise<DocsAgentFeedbackEvaluationRegressionReport | undefined> {
  if (!options.results || !options.baseline) {
    throw new Error("--results and --baseline are required for baseline or regression mode.");
  }
  const results = readDocsGoldenTasksReportFile(resolveProjectPath(rootDir, options.results));
  const baselinePath = resolveProjectPath(rootDir, options.baseline);
  if (options.writeBaseline) {
    const baseline = createDocsAgentFeedbackEvaluationBaseline(results);
    writeJson(baselinePath, baseline);
    if (!options.json) console.log(pc.green(`Wrote ${path.relative(rootDir, baselinePath)}.`));
    if (options.json) console.log(JSON.stringify(baseline, null, 2));
    return undefined;
  }
  const baseline = readDocsAgentFeedbackEvaluationBaseline(baselinePath);
  const comparison = compareDocsAgentFeedbackEvaluationBaseline(results, baseline, {
    maxScoreDrop: options.maxScoreDrop,
    failOnNewFailures: options.allowNewFailures !== true,
  });
  console.log(JSON.stringify(comparison, null, 2));
  if (options.check && !comparison.passed) {
    throw new Error(
      `Agent evaluation regression check failed with ${comparison.regressions.length} regression(s).`,
    );
  }
  return comparison;
}

export async function runAgentFeedbackEvaluations(
  options: AgentFeedbackEvaluationsOptions = {},
): Promise<
  | DocsAgentFeedbackEvaluationCandidateRegistry
  | DocsAgentFeedbackEvaluationRegressionReport
  | undefined
> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  if (options.writeBaseline && options.check) {
    throw new Error("--write-baseline and --check are separate operations.");
  }
  const regressionMode =
    options.results !== undefined ||
    options.baseline !== undefined ||
    options.writeBaseline === true ||
    options.check === true;
  if (regressionMode) return runRegressionMode(rootDir, options);
  return runCandidateMode(rootDir, options);
}

export function printAgentFeedbackEvaluationsHelp(): void {
  console.log(`${pc.bold("docs agent feedback-evals")} — promote feedback into reviewed evaluations and guard regressions

${pc.dim("Candidate usage:")}
  docs agent feedback-evals --input .farming-labs/agent-feedback-improvements.json
  docs agent feedback-evals --existing docs-evaluations.json --write

${pc.dim("Regression usage:")}
  docs agent feedback-evals --results doctor.json --baseline .farming-labs/agent-evaluation-baseline.json --write-baseline
  docs agent feedback-evals --results doctor.json --baseline .farming-labs/agent-evaluation-baseline.json --check

${pc.dim("Options:")}
  ${pc.cyan("--input <path>")}             Feedback improvement report
  ${pc.cyan("--existing <path>")}          Repeatable registry/config/task JSON used for deduplication
  ${pc.cyan("--write")}                    Write sanitized candidates
  ${pc.cyan("--output <path>")}            Candidate output (default: .farming-labs/agent-evaluation-candidates.json)
  ${pc.cyan("--results <path>")}           Golden-task or doctor JSON evaluation results
  ${pc.cyan("--baseline <path>")}          Baseline JSON path
  ${pc.cyan("--write-baseline")}           Create or replace the baseline from --results
  ${pc.cyan("--check")}                    Fail when results regress from the baseline
  ${pc.cyan("--max-score-drop <0-100>")}   Allowed suite/task score decrease (default: 0)
  ${pc.cyan("--allow-new-failures")}        Do not fail only because a newly added task fails
  ${pc.cyan("--json")}                     Print written candidate/baseline JSON

Candidates are redacted, deduplicated, and never added to docs.config without human review.
`);
}

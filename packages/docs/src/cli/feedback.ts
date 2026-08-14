import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  analyzeDocsAgentFeedback,
  readDocsAgentFeedbackFile,
  type DocsAgentFeedbackImprovementReport,
} from "../agent-feedback-loop.js";

export interface AgentFeedbackImproveOptions {
  input?: string;
  output?: string;
  minOccurrences?: number;
  write?: boolean;
  json?: boolean;
  help?: boolean;
  rootDir?: string;
}

export function parseAgentFeedbackImproveArgs(
  argv: readonly string[],
): AgentFeedbackImproveOptions {
  const options: AgentFeedbackImproveOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--write") options.write = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (
      argument === "--input" ||
      argument === "--output" ||
      argument === "--min-occurrences"
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--input") options.input = value;
      else if (argument === "--output") options.output = value;
      else {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 2 || parsed > 100) {
          throw new Error("--min-occurrences must be an integer from 2 through 100.");
        }
        options.minOccurrences = parsed;
      }
    } else {
      throw new Error(`Unknown agent feedback flag: ${argument}`);
    }
  }
  return options;
}

function resolveProjectPath(rootDir: string, value: string): string {
  if (path.isAbsolute(value)) throw new Error("Feedback paths must be project-relative.");
  const candidate = path.resolve(rootDir, value);
  const relative = path.relative(rootDir, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Feedback paths must stay inside the project root.");
  }
  return candidate;
}

function writeReport(outputPath: string, report: DocsAgentFeedbackImprovementReport): void {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, outputPath);
}

export async function runAgentFeedbackImprove(
  options: AgentFeedbackImproveOptions = {},
): Promise<DocsAgentFeedbackImprovementReport> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const input = options.input ?? ".farming-labs/agent-feedback.jsonl";
  const output = options.output ?? ".farming-labs/agent-feedback-improvements.json";
  const feedback = readDocsAgentFeedbackFile(resolveProjectPath(rootDir, input));
  const report = analyzeDocsAgentFeedback(feedback, {
    minOccurrences: options.minOccurrences,
  });

  if (options.write) {
    const outputPath = resolveProjectPath(rootDir, output);
    writeReport(outputPath, report);
    if (!options.json) {
      console.log(
        pc.green(
          `Wrote ${path.relative(rootDir, outputPath)} with ${report.recurringClusterCount} recurring cluster${report.recurringClusterCount === 1 ? "" : "s"}.`,
        ),
      );
    }
  }
  if (options.json || !options.write) console.log(JSON.stringify(report, null, 2));
  return report;
}

export function printAgentFeedbackImproveHelp(): void {
  console.log(`${pc.bold("docs agent feedback")} — turn agent feedback into improvement drafts

${pc.dim("Usage:")}
  docs agent feedback --input .farming-labs/agent-feedback.jsonl
  docs agent feedback --input feedback.json --write

${pc.dim("Options:")}
  ${pc.cyan("--input <path>")}             JSON array/object or JSON Lines feedback export
  ${pc.cyan("--min-occurrences <2-100>")} Recurrence threshold (default: 2)
  ${pc.cyan("--write")}                    Write the improvement report
  ${pc.cyan("--output <path>")}            Output path (default: .farming-labs/agent-feedback-improvements.json)
  ${pc.cyan("--json")}                     Print JSON when writing
`);
}

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  analyzeDocsAgentMaintenanceSignals,
  parseDocsAgentMaintenanceSignals,
  type DocsAgentMaintenanceProposalReport,
} from "../agent-maintenance.js";

export interface AgentMaintenanceProposeOptions {
  inputs?: string[];
  output?: string;
  minOccurrences?: number;
  write?: boolean;
  json?: boolean;
  help?: boolean;
  rootDir?: string;
}

export function parseAgentMaintenanceProposeArgs(
  argv: readonly string[],
): AgentMaintenanceProposeOptions {
  const options: AgentMaintenanceProposeOptions = { inputs: [] };
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
      if (argument === "--input") options.inputs!.push(value);
      else if (argument === "--output") options.output = value;
      else {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
          throw new Error("--min-occurrences must be an integer from 1 through 100.");
        }
        options.minOccurrences = parsed;
      }
    } else {
      throw new Error(`Unknown agent propose flag: ${argument}`);
    }
  }
  return options;
}

function resolveProjectPath(rootDir: string, value: string): string {
  if (path.isAbsolute(value)) throw new Error("Maintenance paths must be project-relative.");
  const candidate = path.resolve(rootDir, value);
  const relative = path.relative(rootDir, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Maintenance paths must stay inside the project root.");
  }
  return candidate;
}

function writeReport(outputPath: string, report: DocsAgentMaintenanceProposalReport): void {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, outputPath);
}

export async function runAgentMaintenancePropose(
  options: AgentMaintenanceProposeOptions = {},
): Promise<DocsAgentMaintenanceProposalReport> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const inputs =
    options.inputs && options.inputs.length > 0
      ? options.inputs
      : [".farming-labs/agent-feedback-improvements.json"];
  const signals = inputs.flatMap((input) =>
    parseDocsAgentMaintenanceSignals(readFileSync(resolveProjectPath(rootDir, input), "utf8")),
  );
  const report = analyzeDocsAgentMaintenanceSignals(signals, {
    minOccurrences: options.minOccurrences,
  });

  if (options.write) {
    const outputPath = resolveProjectPath(
      rootDir,
      options.output ?? ".farming-labs/agent-maintenance-proposals.json",
    );
    writeReport(outputPath, report);
    if (!options.json) {
      console.log(
        pc.green(
          `Wrote ${path.relative(rootDir, outputPath)} with ${report.proposalCount} reviewable proposal${report.proposalCount === 1 ? "" : "s"}.`,
        ),
      );
    }
  }
  if (options.json || !options.write) console.log(JSON.stringify(report, null, 2));
  return report;
}

export function printAgentMaintenanceProposeHelp(): void {
  console.log(`${pc.bold("docs agent propose")} — turn recurring signals into reviewable maintenance drafts

${pc.dim("Usage:")}
  docs agent propose --input .farming-labs/agent-feedback-improvements.json
  docs agent propose --input search-signals.jsonl --input support-signals.json --write

${pc.dim("Options:")}
  ${pc.cyan("--input <path>")}             Repeatable JSON/JSONL signal or feedback report
  ${pc.cyan("--min-occurrences <1-100>")} Proposal threshold (default: 2)
  ${pc.cyan("--write")}                    Write the draft-only proposal report
  ${pc.cyan("--output <path>")}            Output path (default: .farming-labs/agent-maintenance-proposals.json)
  ${pc.cyan("--json")}                     Print JSON when writing

Signal sources: agent-feedback, ask-ai, git, issue, mcp, search, support.
The command never edits documentation, creates issues, publishes branches, or merges changes.
`);
}

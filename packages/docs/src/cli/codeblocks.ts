import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  resolveDocsCodeBlocksValidateConfig,
  validateCodeBlocks,
  type DocsCodeBlocksValidationReport,
} from "../code-blocks.js";
import type { DocsCodeBlocksValidateConfig } from "../types.js";
import {
  extractNestedObjectLiteral,
  loadDocsConfigModule,
  readTopLevelStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";

export interface CodeBlocksValidateOptions {
  configPath?: string;
  json?: boolean;
  plan?: boolean;
  run?: boolean;
}

export interface ParsedCodeBlocksValidateArgs extends CodeBlocksValidateOptions {
  help?: boolean;
}

function parseInlineFlag(arg: string): { key: string; value?: string } {
  const [rawKey, value] = arg.slice(2).split("=", 2);
  return { key: rawKey.trim(), value };
}

export function parseCodeBlocksValidateArgs(argv: string[]): ParsedCodeBlocksValidateArgs {
  const parsed: ParsedCodeBlocksValidateArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--plan") {
      parsed.plan = true;
      continue;
    }

    if (arg === "--run") {
      parsed.run = true;
      continue;
    }

    if (arg.startsWith("--config=")) {
      const value = parseInlineFlag(arg).value;
      if (!value) throw new Error("Missing value for --config.");
      parsed.configPath = value;
      continue;
    }

    if (arg === "--config") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --config.");
      parsed.configPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown codeblocks validate flag: ${arg}.`);
  }

  return parsed;
}

export function printCodeBlocksValidateHelp() {
  console.log(`
${pc.bold("@farming-labs/docs codeblocks validate")}

${pc.dim("Usage:")}
  pnpm exec docs codeblocks validate
  pnpm exec docs codeblocks validate --plan
  pnpm exec docs codeblocks validate --json
  pnpm exec docs codeblocks validate --config docs.config.ts

${pc.dim("Options:")}
  ${pc.cyan("--plan")}             Build the execution plan without running code
  ${pc.cyan("--run")}              Force execution even when config mode is ${pc.dim('"plan"')}
  ${pc.cyan("--json")}             Print machine-readable output
  ${pc.cyan("--config <path>")}    Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}
  ${pc.cyan("-h, --help")}         Show this help message
`);
}

export async function runCodeBlocksValidate(options: CodeBlocksValidateOptions = {}) {
  const rootDir = process.cwd();
  const loaded = await loadDocsConfigModule(rootDir, options.configPath);
  const configPath = loaded?.path ?? resolveDocsConfigPath(rootDir, options.configPath);
  const configContent = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  const entry =
    loaded?.config.entry ?? readTopLevelStringProperty(configContent, "entry") ?? "docs";
  const contentDir =
    loaded?.config.contentDir ?? resolveDocsContentDir(rootDir, configContent, entry);
  const validateInput =
    loaded?.config.codeBlocks?.validate ?? readStaticCodeBlocksValidateConfig(configContent);
  const config = resolveDocsCodeBlocksValidateConfig(validateInput);

  if (!config.enabled) {
    const disabledReport: DocsCodeBlocksValidationReport = {
      summary: { total: 0, planned: 0, pass: 0, skip: 0, fail: 0 },
      config,
      targets: [],
      plans: [],
      results: [],
    };
    if (options.json) {
      console.log(JSON.stringify(disabledReport, null, 2));
    } else {
      console.log(
        pc.yellow(
          "codeBlocks.validate is disabled. Add `codeBlocks: { validate: true }` to docs.config.ts.",
        ),
      );
    }
    return disabledReport;
  }

  const report = await validateCodeBlocks({
    rootDir,
    contentDir,
    config: {
      ...config,
      mode: options.run ? "report" : config.mode,
    },
    planOnly: options.plan,
  });

  if (options.json) {
    console.log(JSON.stringify(redactReport(report), null, 2));
  } else {
    printCodeBlocksReport(report, options.plan === true || config.mode === "plan");
  }

  if (!options.plan && report.summary.fail > 0) {
    process.exitCode = 1;
  }

  return report;
}

function readStaticCodeBlocksValidateConfig(
  content: string,
): boolean | DocsCodeBlocksValidateConfig | undefined {
  const block = extractNestedObjectLiteral(content, ["codeBlocks"]);
  if (!block) return undefined;
  if (/\bvalidate\s*:\s*true\b/.test(block)) return true;
  if (/\bvalidate\s*:\s*false\b/.test(block)) return false;
  if (/\bvalidate\s*:\s*\{/.test(block)) {
    return true;
  }
  return undefined;
}

function printCodeBlocksReport(report: DocsCodeBlocksValidationReport, planOnly: boolean) {
  const label = planOnly ? "Code block plan" : "Code block validation";
  console.log(pc.bold(label));
  console.log(
    [
      ...(report.summary.planned > 0 ? [`${pc.cyan(`${report.summary.planned} planned`)}`] : []),
      `${pc.green(`${report.summary.pass} pass`)}`,
      `${pc.yellow(`${report.summary.skip} skip`)}`,
      `${report.summary.fail > 0 ? pc.red(`${report.summary.fail} fail`) : pc.dim("0 fail")}`,
      `${report.targets.length} code blocks`,
    ].join(pc.dim(" • ")),
  );

  if (report.results.length === 0) return;
  console.log();

  for (const result of report.results) {
    const status =
      result.status === "PLAN"
        ? pc.cyan(result.status)
        : result.status === "PASS"
          ? pc.green(result.status)
          : result.status === "FAIL"
            ? pc.red(result.status)
            : pc.yellow(result.status);
    const location = `${result.target.relativePath}:${result.target.lineStart}`;
    const detail = result.reason ?? result.plan.reason ?? result.plan.template;
    console.log(`${status} ${pc.cyan(location)} ${pc.dim(detail)}`);
  }
}

function redactReport(report: DocsCodeBlocksValidationReport): DocsCodeBlocksValidationReport {
  return {
    ...report,
    config: {
      ...report.config,
      planner: {
        ...report.config.planner,
        apiKey: report.config.planner.apiKey ? "[REDACTED]" : undefined,
      },
    },
    results: report.results.map((result) => ({
      ...result,
      stdout: trimOutput(result.stdout),
      stderr: trimOutput(result.stderr),
    })),
  };
}

function trimOutput(value?: string): string | undefined {
  if (!value) return value;
  return value.length > 4000 ? `${value.slice(0, 4000)}...` : value;
}

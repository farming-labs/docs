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
  readBooleanProperty,
  readNumberProperty,
  readStringProperty,
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
  const loaded = await loadDocsConfigModule(rootDir, options.configPath, {
    silent: options.json,
  });
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
      console.log(JSON.stringify(redactReport(disabledReport), null, 2));
    } else {
      console.log(
        pc.yellow(
          "codeBlocks.validate is disabled. Add `codeBlocks: { validate: true }` to docs.config.ts.",
        ),
      );
    }
    return disabledReport;
  }

  const effectiveConfig = {
    ...config,
    mode: options.run ? ("report" as const) : config.mode,
  };
  const planOnly = options.plan === true || effectiveConfig.mode === "plan";
  const report = await validateCodeBlocks({
    rootDir,
    contentDir,
    config: effectiveConfig,
    planOnly: options.plan,
  });

  if (options.json) {
    console.log(JSON.stringify(redactReport(report), null, 2));
  } else {
    printCodeBlocksReport(report, planOnly);
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

  const validateBlock = extractNestedObjectLiteral(content, ["codeBlocks", "validate"]);
  if (validateBlock) {
    const config: DocsCodeBlocksValidateConfig = {};
    const enabled = readBooleanProperty(validateBlock, "enabled");
    const mode = readStringProperty(validateBlock, "mode");
    const missingEnv = readStringProperty(validateBlock, "missingEnv");
    const unsupportedLanguage = readStringProperty(validateBlock, "unsupportedLanguage");
    const envFile = readStringArrayProperty(validateBlock, "envFile");

    if (enabled !== undefined) config.enabled = enabled;
    if (mode === "plan" || mode === "report") config.mode = mode;
    if (missingEnv === "skip" || missingEnv === "warn" || missingEnv === "error") {
      config.missingEnv = missingEnv;
    }
    if (
      unsupportedLanguage === "skip" ||
      unsupportedLanguage === "warn" ||
      unsupportedLanguage === "error"
    ) {
      config.unsupportedLanguage = unsupportedLanguage;
    }
    if (envFile) config.envFile = envFile;

    const plannerBlock = extractNestedObjectLiteral(content, ["codeBlocks", "validate", "planner"]);
    const planner = readStaticPlannerConfig(plannerBlock);
    if (planner) config.planner = planner;

    const runnerBlock = extractNestedObjectLiteral(content, ["codeBlocks", "validate", "runner"]);
    const runner = readStaticRunnerConfig(runnerBlock);
    if (runner) config.runner = runner;

    const envBlock = extractNestedObjectLiteral(content, ["codeBlocks", "validate", "env"]);
    const env = readStringRecord(envBlock);
    if (env && Object.keys(env).length > 0) config.env = env;

    return config;
  }

  if (/\bvalidate\s*:\s*\{/.test(block)) return true;
  return undefined;
}

function readStaticPlannerConfig(
  block?: string,
): DocsCodeBlocksValidateConfig["planner"] | undefined {
  if (!block) return undefined;
  const provider = readStringProperty(block, "provider");
  const model = readStringProperty(block, "model");
  const baseUrl = readStringProperty(block, "baseUrl");
  const baseUrlEnv = readStringProperty(block, "baseUrlEnv");
  const apiKeyEnv = readStringProperty(block, "apiKeyEnv");

  if (
    provider !== "metadata" &&
    provider !== "openai" &&
    provider !== "openai-compatible" &&
    provider !== "cloud"
  ) {
    return undefined;
  }

  return {
    provider,
    ...(model ? { model } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(baseUrlEnv ? { baseUrlEnv } : {}),
    ...(apiKeyEnv ? { apiKeyEnv } : {}),
  };
}

function readStaticRunnerConfig(
  block?: string,
): DocsCodeBlocksValidateConfig["runner"] | undefined {
  if (!block) return undefined;
  const provider = readStringProperty(block, "provider");
  const tokenEnv = readStringProperty(block, "tokenEnv");
  const projectIdEnv = readStringProperty(block, "projectIdEnv");
  const teamIdEnv = readStringProperty(block, "teamIdEnv");
  const projectJson = readStringProperty(block, "projectJson");
  const runtime = readStringProperty(block, "runtime");
  const timeoutMs = readNumberProperty(block, "timeoutMs");

  if (provider !== "local" && provider !== "vercel-sandbox" && provider !== "cloud") {
    return undefined;
  }

  return {
    provider,
    ...(tokenEnv ? { tokenEnv } : {}),
    ...(projectIdEnv ? { projectIdEnv } : {}),
    ...(teamIdEnv ? { teamIdEnv } : {}),
    ...(projectJson ? { projectJson } : {}),
    ...(runtime === "node24" || runtime === "node22" || runtime === "python3.13"
      ? { runtime }
      : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

function readStringArrayProperty(content: string, key: string): string[] | undefined {
  const single = readStringProperty(content, key);
  if (single) return [single];

  const match = content.match(new RegExp(`\\b${key}\\b\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return undefined;

  const values = [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
  return values.length > 0 ? values : undefined;
}

function readStringRecord(block?: string): Record<string, string> | undefined {
  if (!block) return undefined;

  const record: Record<string, string> = {};
  const patterns = [
    /(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:\s*["']([^"']+)["']/g,
    /(?:^|,)\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(block))) {
      record[match[1]] = match[2];
    }
  }

  return record;
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

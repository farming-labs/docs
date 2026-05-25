import { execFile } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  DocsCodeBlocksPlannerConfig,
  DocsCodeBlocksPlannerProvider,
  DocsCodeBlocksRunnerConfig,
  DocsCodeBlocksRunnerProvider,
  DocsCodeBlocksValidateConfig,
  DocsCodeBlocksValidationMode,
  DocsCodeBlocksValidationPolicy,
} from "./types.js";

const execFileAsync = promisify(execFile);

const DEFAULT_ENV_FILES = [".env.local", ".env.test", ".env"];
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;

export interface DocsCodeBlockMeta {
  language?: string;
  meta: Record<string, string | boolean>;
}

export interface DocsCodeBlockTarget {
  id: string;
  filePath: string;
  relativePath: string;
  lineStart: number;
  lineEnd: number;
  language?: string;
  title?: string;
  framework?: string;
  packageManager?: string;
  runnable: boolean;
  env: string[];
  meta: Record<string, string | boolean>;
  code: string;
}

export interface DocsCodeBlocksResolvedPlannerConfig {
  provider: DocsCodeBlocksPlannerProvider;
  model?: string;
  baseUrl?: string;
  baseUrlEnv?: string;
  apiKey?: string;
  apiKeyEnv?: string;
}

export interface DocsCodeBlocksResolvedRunnerConfig {
  provider: DocsCodeBlocksRunnerProvider;
  tokenEnv: string;
  projectIdEnv: string;
  teamIdEnv: string;
  projectJson: string | false;
  runtime: "node24" | "node22" | "python3.13";
  apiUrlEnv: string;
  targetEnv: string;
  timeoutMs: number;
}

export interface DocsCodeBlocksResolvedValidateConfig {
  enabled: boolean;
  planner: DocsCodeBlocksResolvedPlannerConfig;
  runner: DocsCodeBlocksResolvedRunnerConfig;
  envFile: string[];
  env: Record<string, string>;
  missingEnv: DocsCodeBlocksValidationPolicy;
  unsupportedLanguage: DocsCodeBlocksValidationPolicy;
  mode: DocsCodeBlocksValidationMode;
}

export interface DocsCodeBlockCommand {
  cmd: string;
  args: string[];
}

export interface DocsCodeBlockExecutionPlan {
  id: string;
  target: DocsCodeBlockTarget;
  action: "execute" | "validate-syntax" | "skip";
  template: string;
  runtime?: string;
  filePath?: string;
  command?: DocsCodeBlockCommand;
  requiredEnv: string[];
  reason?: string;
  planner: DocsCodeBlocksPlannerProvider;
}

export type DocsCodeBlockValidationStatus = "PLAN" | "PASS" | "SKIP" | "FAIL";

export interface DocsCodeBlockValidationResult {
  id: string;
  target: DocsCodeBlockTarget;
  plan: DocsCodeBlockExecutionPlan;
  status: DocsCodeBlockValidationStatus;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  reason?: string;
}

export interface DocsCodeBlocksValidationReport {
  summary: {
    total: number;
    planned: number;
    pass: number;
    skip: number;
    fail: number;
  };
  config: DocsCodeBlocksResolvedValidateConfig;
  targets: DocsCodeBlockTarget[];
  plans: DocsCodeBlockExecutionPlan[];
  results: DocsCodeBlockValidationResult[];
}

interface CollectTargetsOptions {
  rootDir: string;
  contentDir: string;
}

interface LoadedValidationEnv {
  env: Record<string, string>;
  missing: string[];
}

interface VercelSandboxCredentials {
  token?: string;
  projectId?: string;
  teamId?: string;
  missing: string[];
}

type OptionalModuleImporter = (specifier: string) => Promise<unknown>;

declare global {
  var __DOCS_CODE_BLOCKS_MODULE_IMPORTER__: OptionalModuleImporter | undefined;
}

export function resolveDocsCodeBlocksValidateConfig(
  input?: boolean | DocsCodeBlocksValidateConfig,
): DocsCodeBlocksResolvedValidateConfig {
  if (input === false || input === undefined) {
    return {
      enabled: false,
      planner: { provider: "metadata" },
      runner: {
        provider: "local",
        tokenEnv: "VERCEL_TOKEN",
        projectIdEnv: "VERCEL_PROJECT_ID",
        teamIdEnv: "VERCEL_TEAM_ID",
        projectJson: ".vercel/project.json",
        runtime: "node24",
        apiUrlEnv: "DAYTONA_API_URL",
        targetEnv: "DAYTONA_TARGET",
        timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
      },
      envFile: DEFAULT_ENV_FILES,
      env: {},
      missingEnv: "skip",
      unsupportedLanguage: "skip",
      mode: "report",
    };
  }

  const config = input === true ? {} : input;
  const planner = normalizePlannerConfig(config.planner);
  const runner = normalizeRunnerConfig(config.runner);
  const envFile = Array.isArray(config.envFile)
    ? config.envFile
    : typeof config.envFile === "string"
      ? [config.envFile]
      : DEFAULT_ENV_FILES;

  return {
    enabled: config.enabled ?? true,
    planner,
    runner,
    envFile,
    env: config.env ?? {},
    missingEnv: config.missingEnv ?? "skip",
    unsupportedLanguage: config.unsupportedLanguage ?? "skip",
    mode: config.mode ?? "report",
  };
}

export function parseCodeFenceInfo(info: string): DocsCodeBlockMeta {
  const trimmed = info.trim();
  if (!trimmed) return { meta: {} };

  const firstTokenMatch = trimmed.match(/^(\S+)/);
  const firstToken = firstTokenMatch?.[1] ?? "";
  const language = firstToken && !firstToken.includes("=") ? firstToken : undefined;
  const attributeSource = language ? trimmed.slice(firstToken.length).trim() : trimmed;
  const meta: Record<string, string | boolean> = {};
  const attributePattern = /([A-Za-z_:][\w:.-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(attributeSource))) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    meta[key] = value ?? true;
  }

  return { language, meta };
}

export function extractCodeBlocksFromMarkdown(input: {
  source: string;
  filePath: string;
  relativePath?: string;
}): DocsCodeBlockTarget[] {
  const blocks: DocsCodeBlockTarget[] = [];
  const lines = input.source.split("\n");
  let openFence:
    | {
        marker: string;
        info: string;
        code: string[];
        lineStart: number;
      }
    | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!openFence) {
      const openMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
      if (!openMatch) continue;

      openFence = {
        marker: openMatch[1],
        info: openMatch[2]?.trim() ?? "",
        code: [],
        lineStart: index + 1,
      };
      continue;
    }

    if (isClosingFence(trimmed, openFence.marker)) {
      const parsed = parseCodeFenceInfo(openFence.info);
      const meta = parsed.meta;
      const blockIndex = blocks.length + 1;
      const relativePath = input.relativePath ?? input.filePath;

      blocks.push({
        id: `${relativePath}#code-${blockIndex}`,
        filePath: input.filePath,
        relativePath,
        lineStart: openFence.lineStart,
        lineEnd: index + 1,
        language: parsed.language,
        title: readStringMeta(meta, "title"),
        framework: readStringMeta(meta, "framework"),
        packageManager: readStringMeta(meta, "packageManager"),
        runnable: readBooleanMeta(meta, "runnable") ?? false,
        env: readEnvMeta(meta),
        meta,
        code: openFence.code.join("\n"),
      });
      openFence = undefined;
      continue;
    }

    openFence.code.push(line);
  }

  return blocks;
}

export function collectCodeBlockTargets(options: CollectTargetsOptions): DocsCodeBlockTarget[] {
  const root = path.resolve(options.rootDir);
  const contentRoot = path.resolve(root, options.contentDir);
  if (!existsSync(contentRoot)) return [];

  const files = walkMarkdownFiles(contentRoot);
  return files.flatMap((filePath) => {
    const source = readFileSync(filePath, "utf-8");
    const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
    return extractCodeBlocksFromMarkdown({ source, filePath, relativePath });
  });
}

export async function planCodeBlockTargets(
  targets: DocsCodeBlockTarget[],
  config: DocsCodeBlocksResolvedValidateConfig,
): Promise<DocsCodeBlockExecutionPlan[]> {
  if (config.planner.provider === "metadata") {
    return targets.map((target) => buildMetadataExecutionPlan(target, config));
  }

  if (config.planner.provider === "cloud") {
    throw new Error("Hosted cloud code block planning is not available in this package yet.");
  }

  return planWithOpenAICompatibleProvider(targets, config);
}

export async function validateCodeBlockPlans(input: {
  plans: DocsCodeBlockExecutionPlan[];
  rootDir: string;
  config: DocsCodeBlocksResolvedValidateConfig;
}): Promise<DocsCodeBlockValidationResult[]> {
  const validationEnv = loadValidationEnv(input.rootDir, input.config);
  const preflight = input.plans.map((plan) => preflightPlan(plan, input.config, validationEnv));
  const runnable = preflight.filter((result) => result.status !== "SKIP" && !result.reason);

  const skippedOrFailed = preflight.filter((result) => result.status === "SKIP" || result.reason);
  const plansToRun = runnable.map((result) => result.plan);

  if (plansToRun.length === 0) {
    return skippedOrFailed;
  }

  const runResults = await runPlansWithConfiguredRunner(
    plansToRun,
    input.rootDir,
    input.config,
    validationEnv.env,
  );

  return [...skippedOrFailed, ...runResults].sort((a, b) => a.id.localeCompare(b.id));
}

export async function validateCodeBlocks(input: {
  rootDir: string;
  contentDir: string;
  config: DocsCodeBlocksResolvedValidateConfig;
  planOnly?: boolean;
}): Promise<DocsCodeBlocksValidationReport> {
  const targets = collectCodeBlockTargets({
    rootDir: input.rootDir,
    contentDir: input.contentDir,
  });
  const plans = await planCodeBlockTargets(targets, input.config);
  const results =
    input.planOnly || input.config.mode === "plan"
      ? plans.map((plan) => ({
          id: plan.id,
          target: plan.target,
          plan,
          status: plan.action === "skip" ? ("SKIP" as const) : ("PLAN" as const),
          reason: plan.reason ?? (plan.action === "skip" ? "planned skip" : "planned"),
        }))
      : await validateCodeBlockPlans({
          plans,
          rootDir: input.rootDir,
          config: input.config,
        });

  const summary = results.reduce(
    (acc, result) => {
      acc.total += 1;
      if (result.status === "PLAN") acc.planned += 1;
      if (result.status === "PASS") acc.pass += 1;
      if (result.status === "SKIP") acc.skip += 1;
      if (result.status === "FAIL") acc.fail += 1;
      return acc;
    },
    { total: 0, planned: 0, pass: 0, skip: 0, fail: 0 },
  );

  return {
    summary,
    config: input.config,
    targets,
    plans,
    results,
  };
}

function normalizePlannerConfig(
  input?: DocsCodeBlocksPlannerProvider | DocsCodeBlocksPlannerConfig,
): DocsCodeBlocksResolvedPlannerConfig {
  if (!input) return { provider: "metadata" };
  if (typeof input === "string") return { provider: input };
  return { provider: input.provider ?? "metadata", ...input };
}

function normalizeRunnerConfig(
  input?: DocsCodeBlocksRunnerProvider | DocsCodeBlocksRunnerConfig,
): DocsCodeBlocksResolvedRunnerConfig {
  const config = typeof input === "string" ? { provider: input } : (input ?? {});
  const provider = config.provider ?? "local";
  return {
    provider,
    tokenEnv: config.tokenEnv ?? defaultRunnerTokenEnv(provider),
    projectIdEnv: config.projectIdEnv ?? "VERCEL_PROJECT_ID",
    teamIdEnv: config.teamIdEnv ?? "VERCEL_TEAM_ID",
    projectJson: config.projectJson === undefined ? ".vercel/project.json" : config.projectJson,
    runtime: config.runtime ?? "node24",
    apiUrlEnv: config.apiUrlEnv ?? "DAYTONA_API_URL",
    targetEnv: config.targetEnv ?? "DAYTONA_TARGET",
    timeoutMs: config.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
  };
}

function defaultRunnerTokenEnv(provider: DocsCodeBlocksRunnerProvider): string {
  if (provider === "e2b") return "E2B_API_KEY";
  if (provider === "daytona") return "DAYTONA_API_KEY";
  return "VERCEL_TOKEN";
}

function buildMetadataExecutionPlan(
  target: DocsCodeBlockTarget,
  config: DocsCodeBlocksResolvedValidateConfig,
): DocsCodeBlockExecutionPlan {
  const language = normalizeLanguage(target.language);
  const template = target.framework ?? templateFromLanguage(language);
  const requiredEnv = target.env;

  if (readBooleanMeta(target.meta, "partial") || looksPartial(target.code)) {
    return skipPlan(target, template, requiredEnv, "partial fragment", config.planner.provider);
  }

  if (!language) {
    if (!target.runnable) {
      return skipPlan(
        target,
        "unknown",
        requiredEnv,
        "code block is not marked runnable",
        config.planner.provider,
      );
    }
    if (looksLikeShellCommand(target.code)) {
      return shellPlan(target, "shell", requiredEnv, config.planner.provider);
    }
    return skipPlan(
      target,
      "unknown",
      requiredEnv,
      "missing language and not obviously runnable",
      config.planner.provider,
    );
  }

  if (!target.runnable) {
    return skipPlan(
      target,
      template,
      requiredEnv,
      "code block is not marked runnable",
      config.planner.provider,
    );
  }

  if (isShellLanguage(language))
    return shellPlan(target, template, requiredEnv, config.planner.provider);
  if (language === "json")
    return syntaxPlan(target, "json", "node", requiredEnv, config.planner.provider);

  if (language === "javascript" || language === "js" || language === "jsx") {
    return executePlan(
      target,
      template,
      "node",
      "js",
      { cmd: "node", args: [] },
      requiredEnv,
      config.planner.provider,
    );
  }

  if (language === "typescript" || language === "ts" || language === "tsx") {
    return executePlan(
      target,
      template,
      "tsx",
      "ts",
      { cmd: "npx", args: ["--yes", "tsx"] },
      requiredEnv,
      config.planner.provider,
    );
  }

  if (language === "python" || language === "py") {
    return executePlan(
      target,
      template,
      "python3",
      "py",
      { cmd: "python3", args: [] },
      requiredEnv,
      config.planner.provider,
    );
  }

  if (language === "ruby" || language === "rb") {
    return executePlan(
      target,
      template,
      "ruby",
      "rb",
      { cmd: "ruby", args: [] },
      requiredEnv,
      config.planner.provider,
    );
  }

  if (language === "elixir" || language === "ex" || language === "exs") {
    return executePlan(
      target,
      template,
      "elixir",
      "exs",
      { cmd: "elixir", args: [] },
      requiredEnv,
      config.planner.provider,
    );
  }

  if (language === "yaml" || language === "yml") {
    return skipPlan(
      target,
      "yaml",
      requiredEnv,
      "YAML syntax validation requires a YAML parser",
      config.planner.provider,
    );
  }

  if (!target.runnable) {
    return skipPlan(
      target,
      template,
      requiredEnv,
      "code block is not marked runnable",
      config.planner.provider,
    );
  }

  return skipPlan(
    target,
    template,
    requiredEnv,
    `unsupported language: ${target.language}`,
    config.planner.provider,
  );
}

function executePlan(
  target: DocsCodeBlockTarget,
  template: string,
  runtime: string,
  extension: string,
  command: DocsCodeBlockCommand,
  requiredEnv: string[],
  planner: DocsCodeBlocksPlannerProvider,
): DocsCodeBlockExecutionPlan {
  const filePath = `snippet-${slugify(target.id)}.${extension}`;
  return {
    id: target.id,
    target,
    action: "execute",
    template,
    runtime,
    filePath,
    command: { cmd: command.cmd, args: [...command.args, filePath] },
    requiredEnv,
    planner,
  };
}

function shellPlan(
  target: DocsCodeBlockTarget,
  template: string,
  requiredEnv: string[],
  planner: DocsCodeBlocksPlannerProvider,
): DocsCodeBlockExecutionPlan {
  const filePath = `snippet-${slugify(target.id)}.sh`;
  return {
    id: target.id,
    target,
    action: "execute",
    template,
    runtime: "bash",
    filePath,
    command: { cmd: "bash", args: [filePath] },
    requiredEnv,
    planner,
  };
}

function syntaxPlan(
  target: DocsCodeBlockTarget,
  template: string,
  runtime: string,
  requiredEnv: string[],
  planner: DocsCodeBlocksPlannerProvider,
): DocsCodeBlockExecutionPlan {
  const filePath = `snippet-${slugify(target.id)}.json`;
  return {
    id: target.id,
    target,
    action: "validate-syntax",
    template,
    runtime,
    filePath,
    command: {
      cmd: "node",
      args: [
        "-e",
        `JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))`,
        filePath,
      ],
    },
    requiredEnv,
    planner,
  };
}

function skipPlan(
  target: DocsCodeBlockTarget,
  template: string,
  requiredEnv: string[],
  reason: string,
  planner: DocsCodeBlocksPlannerProvider,
): DocsCodeBlockExecutionPlan {
  return {
    id: target.id,
    target,
    action: "skip",
    template,
    requiredEnv,
    reason,
    planner,
  };
}

async function planWithOpenAICompatibleProvider(
  targets: DocsCodeBlockTarget[],
  config: DocsCodeBlocksResolvedValidateConfig,
): Promise<DocsCodeBlockExecutionPlan[]> {
  const baseUrl =
    config.planner.baseUrl ??
    (config.planner.baseUrlEnv ? process.env[config.planner.baseUrlEnv] : undefined) ??
    (config.planner.provider === "openai" ? "https://api.openai.com/v1" : undefined);
  const apiKey =
    config.planner.apiKey ??
    (config.planner.apiKeyEnv ? process.env[config.planner.apiKeyEnv] : undefined);

  if (!baseUrl) {
    throw new Error("codeBlocks.validate planner requires baseUrl or baseUrlEnv.");
  }
  if (!apiKey) {
    throw new Error(
      `codeBlocks.validate planner requires an API key. Set ${config.planner.apiKeyEnv ?? "apiKeyEnv"} in your environment.`,
    );
  }

  const metadataPlans = targets.map((target) => buildMetadataExecutionPlan(target, config));
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.planner.model ?? "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You produce JSON execution plans for documentation code blocks. Do not rewrite snippets. If the snippet is partial, missing setup, or unsafe, choose action skip. Return only JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            contract: {
              plans:
                "array of {id, action: execute|validate-syntax|skip, template, runtime?, reason?, requiredEnv?: string[]}",
            },
            codeBlocks: targets.map((target) => ({
              id: target.id,
              language: target.language,
              title: target.title,
              framework: target.framework,
              packageManager: target.packageManager,
              runnable: target.runnable,
              env: target.env,
              meta: target.meta,
              code: target.code.slice(0, 8000),
            })),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Planner request failed with ${response.status} ${response.statusText}.`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";

  let parsed: { plans?: Array<Partial<DocsCodeBlockExecutionPlan> & { id?: string }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Planner returned non-JSON content.");
  }

  const byId = new Map(metadataPlans.map((plan) => [plan.id, plan]));
  for (const plan of parsed.plans ?? []) {
    if (!plan.id || !byId.has(plan.id)) continue;
    const fallback = byId.get(plan.id)!;
    byId.set(plan.id, {
      ...fallback,
      action: isPlanAction(plan.action) ? plan.action : fallback.action,
      template:
        typeof plan.template === "string" && plan.template ? plan.template : fallback.template,
      runtime: typeof plan.runtime === "string" && plan.runtime ? plan.runtime : fallback.runtime,
      requiredEnv: Array.isArray(plan.requiredEnv)
        ? plan.requiredEnv.filter((value): value is string => typeof value === "string")
        : fallback.requiredEnv,
      reason: typeof plan.reason === "string" ? plan.reason : fallback.reason,
      planner: config.planner.provider,
    });
  }

  return metadataPlans.map((plan) => byId.get(plan.id)!);
}

function preflightPlan(
  plan: DocsCodeBlockExecutionPlan,
  config: DocsCodeBlocksResolvedValidateConfig,
  validationEnv: LoadedValidationEnv,
): DocsCodeBlockValidationResult {
  if (plan.action === "skip") {
    return {
      id: plan.id,
      target: plan.target,
      plan,
      status: "SKIP",
      reason: plan.reason,
    };
  }

  const missingEnv = plan.requiredEnv.filter((key) => !validationEnv.env[key]);
  if (missingEnv.length > 0) {
    const reason = `missing env: ${missingEnv.join(", ")}`;
    return {
      id: plan.id,
      target: plan.target,
      plan,
      status: config.missingEnv === "error" ? "FAIL" : "SKIP",
      reason,
    };
  }

  if (!plan.command || !plan.filePath) {
    return {
      id: plan.id,
      target: plan.target,
      plan,
      status: config.unsupportedLanguage === "error" ? "FAIL" : "SKIP",
      reason: "no executable command in plan",
    };
  }

  return {
    id: plan.id,
    target: plan.target,
    plan,
    status: "PASS",
  };
}

async function runPlansLocally(
  plans: DocsCodeBlockExecutionPlan[],
  config: DocsCodeBlocksResolvedValidateConfig,
  env: Record<string, string>,
): Promise<DocsCodeBlockValidationResult[]> {
  const tempDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-"));
  try {
    return await Promise.all(
      plans.map(async (plan) => {
        if (!plan.command || !plan.filePath) {
          return skippedResult(plan, "no executable command in plan");
        }

        writeFileSync(path.join(tempDir, plan.filePath), plan.target.code, "utf-8");
        try {
          const result = await execFileAsync(plan.command.cmd, plan.command.args, {
            cwd: tempDir,
            env: { ...process.env, ...env },
            timeout: config.runner.timeoutMs,
            maxBuffer: 1024 * 1024,
          });
          return {
            id: plan.id,
            target: plan.target,
            plan,
            status: "PASS" as const,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: 0,
          };
        } catch (error) {
          const err = error as {
            stdout?: string;
            stderr?: string;
            code?: number;
            signal?: string;
            message?: string;
          };
          return {
            id: plan.id,
            target: plan.target,
            plan,
            status: "FAIL" as const,
            stdout: err.stdout,
            stderr: err.stderr,
            exitCode: typeof err.code === "number" ? err.code : null,
            reason: err.signal ? `terminated by ${err.signal}` : err.message,
          };
        }
      }),
    );
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

async function runPlansWithConfiguredRunner(
  plans: DocsCodeBlockExecutionPlan[],
  rootDir: string,
  config: DocsCodeBlocksResolvedValidateConfig,
  env: Record<string, string>,
): Promise<DocsCodeBlockValidationResult[]> {
  switch (config.runner.provider) {
    case "local":
      return runPlansLocally(plans, config, env);
    case "vercel-sandbox":
      return runPlansInVercelSandbox(plans, rootDir, config, env);
    case "e2b":
      return runPlansInE2B(plans, config, env);
    case "daytona":
      return runPlansInDaytona(plans, config, env);
    case "cloud":
      return plans.map((plan) =>
        skippedResult(plan, "cloud runner is not available in this package yet"),
      );
  }
}

async function runPlansInVercelSandbox(
  plans: DocsCodeBlockExecutionPlan[],
  rootDir: string,
  config: DocsCodeBlocksResolvedValidateConfig,
  env: Record<string, string>,
): Promise<DocsCodeBlockValidationResult[]> {
  const credentials = await resolveVercelSandboxCredentials(rootDir, config);
  if (credentials.missing.length > 0) {
    return plans.map((plan) => skippedResult(plan, `missing ${credentials.missing.join(", ")}`));
  }

  try {
    const { Sandbox } = (await import("@vercel/sandbox")) as unknown as {
      Sandbox: {
        create(input: {
          runtime?: string;
          timeout?: number;
          env?: Record<string, string>;
          token?: string;
          projectId?: string;
          teamId?: string;
        }): Promise<{
          writeFiles(files: Array<{ path: string; content: Buffer }>): Promise<void>;
          runCommand(input: {
            cmd: string;
            args?: string[];
            cwd?: string;
            env?: Record<string, string>;
          }): Promise<{
            exitCode: number | null;
            stdout(): Promise<string>;
            stderr(): Promise<string>;
          }>;
          stop(): Promise<unknown>;
        }>;
      };
    };

    const sandbox = await Sandbox.create({
      runtime: config.runner.runtime,
      timeout: Math.max(
        config.runner.timeoutMs * Math.max(1, plans.length),
        config.runner.timeoutMs,
      ),
      env,
      token: credentials.token,
      projectId: credentials.projectId,
      teamId: credentials.teamId,
    });

    try {
      return await Promise.all(
        plans.map(async (plan) => {
          if (!plan.command || !plan.filePath) {
            return skippedResult(plan, "no executable command in plan");
          }

          await sandbox.writeFiles([
            {
              path: plan.filePath,
              content: Buffer.from(plan.target.code),
            },
          ]);

          const command = await sandbox.runCommand({
            cmd: plan.command.cmd,
            args: plan.command.args,
            cwd: "/vercel/sandbox",
            env,
          });
          const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);

          return {
            id: plan.id,
            target: plan.target,
            plan,
            status: command.exitCode === 0 ? ("PASS" as const) : ("FAIL" as const),
            stdout,
            stderr,
            exitCode: command.exitCode,
            reason: command.exitCode === 0 ? undefined : `exit code ${command.exitCode}`,
          };
        }),
      );
    } finally {
      await sandbox.stop().catch(() => {});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return plans.map((plan) => skippedResult(plan, `vercel-sandbox unavailable: ${message}`));
  }
}

async function runPlansInE2B(
  plans: DocsCodeBlockExecutionPlan[],
  config: DocsCodeBlocksResolvedValidateConfig,
  env: Record<string, string>,
): Promise<DocsCodeBlockValidationResult[]> {
  const token = process.env[config.runner.tokenEnv];
  if (!token) {
    return plans.map((plan) => skippedResult(plan, `missing ${config.runner.tokenEnv}`));
  }

  const module = await importOptionalModule("e2b");
  if (!module) {
    return plans.map((plan) =>
      skippedResult(plan, 'e2b unavailable: install the "e2b" package'),
    );
  }

  try {
    const E2BSandbox =
      readProviderExport(module, "default") ?? readProviderExport(module, "Sandbox");
    if (!hasCreateMethod(E2BSandbox)) {
      return plans.map((plan) => skippedResult(plan, "e2b unavailable: missing Sandbox.create"));
    }

    const sandbox = await withTemporaryEnv("E2B_API_KEY", token, () => E2BSandbox.create());
    try {
      return await Promise.all(
        plans.map(async (plan) => {
          if (!plan.command || !plan.filePath) {
            return skippedResult(plan, "no executable command in plan");
          }

          const command = buildSandboxShellCommand(plan);
          const runner = readObject(sandbox).commands;
          if (!hasRunMethod(runner)) {
            return skippedResult(plan, "e2b unavailable: missing commands.run");
          }

          try {
            const result = await runner.run(command, {
              envs: env,
              timeoutMs: config.runner.timeoutMs,
            });
            return sandboxCommandResult(plan, result);
          } catch (error) {
            return failedSandboxResult(plan, error);
          }
        }),
      );
    } finally {
      await cleanupProviderSandbox(sandbox);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return plans.map((plan) => skippedResult(plan, `e2b unavailable: ${message}`));
  }
}

async function runPlansInDaytona(
  plans: DocsCodeBlockExecutionPlan[],
  config: DocsCodeBlocksResolvedValidateConfig,
  env: Record<string, string>,
): Promise<DocsCodeBlockValidationResult[]> {
  const token = process.env[config.runner.tokenEnv];
  if (!token) {
    return plans.map((plan) => skippedResult(plan, `missing ${config.runner.tokenEnv}`));
  }

  const module = await importOptionalModule("@daytona/sdk");
  if (!module) {
    return plans.map((plan) =>
      skippedResult(plan, 'daytona unavailable: install the "@daytona/sdk" package'),
    );
  }

  try {
    const Daytona = readProviderExport(module, "Daytona");
    if (!hasConstructor(Daytona)) {
      return plans.map((plan) => skippedResult(plan, "daytona unavailable: missing Daytona SDK"));
    }

    const apiUrl = process.env[config.runner.apiUrlEnv];
    const target = process.env[config.runner.targetEnv];
    const daytona = new Daytona({
      apiKey: token,
      ...(apiUrl ? { apiUrl } : {}),
      ...(target ? { target } : {}),
    });
    if (!hasCreateMethod(daytona)) {
      return plans.map((plan) => skippedResult(plan, "daytona unavailable: missing create"));
    }

    const sandbox = await daytona.create({
      ephemeral: true,
      language: "typescript",
      ...(Object.keys(env).length > 0 ? { envVars: env } : {}),
    });
    try {
      return await Promise.all(
        plans.map(async (plan) => {
          if (!plan.command || !plan.filePath) {
            return skippedResult(plan, "no executable command in plan");
          }

          const processApi = readObject(sandbox).process;
          if (!hasExecuteCommandMethod(processApi)) {
            return skippedResult(plan, "daytona unavailable: missing process.executeCommand");
          }

          try {
            const result = await processApi.executeCommand(buildSandboxShellCommand(plan));
            return sandboxCommandResult(plan, result);
          } catch (error) {
            return failedSandboxResult(plan, error);
          }
        }),
      );
    } finally {
      await cleanupProviderSandbox(sandbox);
      await cleanupProviderSandbox(daytona);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return plans.map((plan) => skippedResult(plan, `daytona unavailable: ${message}`));
  }
}

async function resolveVercelSandboxCredentials(
  rootDir: string,
  config: DocsCodeBlocksResolvedValidateConfig,
): Promise<VercelSandboxCredentials> {
  const projectJson = readVercelProjectJson(rootDir, config.runner.projectJson);
  const token = process.env[config.runner.tokenEnv];

  if (!token && process.env.VERCEL_OIDC_TOKEN) {
    return { missing: [] };
  }

  if (!token) {
    return { missing: [config.runner.tokenEnv] };
  }

  const envProjectId = process.env[config.runner.projectIdEnv];
  const envTeamId = process.env[config.runner.teamIdEnv];
  const needsDiscovery =
    !(envProjectId && envTeamId) && !(projectJson?.projectId && projectJson?.orgId);
  const discoveredProject = needsDiscovery ? await discoverVercelSandboxProject(token) : undefined;
  const projectId = envProjectId ?? projectJson?.projectId ?? discoveredProject?.projectId;
  const teamId = envTeamId ?? projectJson?.orgId ?? discoveredProject?.teamId;
  const missing = [
    projectId ? undefined : "Vercel project id",
    teamId ? undefined : "Vercel team id",
  ].filter((value): value is string => Boolean(value));

  return { token, projectId, teamId, missing };
}

async function discoverVercelSandboxProject(
  token: string,
): Promise<{ projectId?: string; teamId?: string } | undefined> {
  try {
    const response = await fetch("https://api.vercel.com/v9/projects?limit=1", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return undefined;

    const payload = (await response.json()) as {
      projects?: Array<{ id?: unknown; accountId?: unknown }>;
    };
    const project = payload.projects?.[0];
    if (!project) return undefined;

    return {
      projectId: typeof project.id === "string" ? project.id : undefined,
      teamId: typeof project.accountId === "string" ? project.accountId : undefined,
    };
  } catch {
    return undefined;
  }
}

function readVercelProjectJson(
  rootDir: string,
  projectJson: string | false,
): { projectId?: string; orgId?: string } | undefined {
  if (projectJson === false) return undefined;
  const fullPath = path.resolve(rootDir, projectJson);
  if (!existsSync(fullPath)) return undefined;

  try {
    const parsed = JSON.parse(readFileSync(fullPath, "utf-8")) as {
      projectId?: unknown;
      orgId?: unknown;
    };
    return {
      projectId: typeof parsed.projectId === "string" ? parsed.projectId : undefined,
      orgId: typeof parsed.orgId === "string" ? parsed.orgId : undefined,
    };
  } catch {
    return undefined;
  }
}

async function importOptionalModule(specifier: string): Promise<unknown | undefined> {
  const importer =
    globalThis.__DOCS_CODE_BLOCKS_MODULE_IMPORTER__ ??
    ((id: string) => import(id) as Promise<unknown>);

  try {
    return await importer(specifier);
  } catch {
    return undefined;
  }
}

function buildSandboxShellCommand(plan: DocsCodeBlockExecutionPlan): string {
  const command = plan.command;
  const filePath = plan.filePath;
  if (!command || !filePath) return "";

  const sandboxDir = "/tmp/docs-codeblocks";
  const encodedCode = Buffer.from(plan.target.code, "utf-8").toString("base64");
  const writeFileCommand = [
    "printf",
    "%s",
    encodedCode,
    "|",
    "base64",
    "-d",
    ">",
    filePath,
  ]
    .map((part) => (part === "|" || part === ">" ? part : shellEscape(part)))
    .join(" ");

  return [
    `mkdir -p ${shellEscape(sandboxDir)}`,
    `cd ${shellEscape(sandboxDir)}`,
    writeFileCommand,
    shellJoin([command.cmd, ...command.args]),
  ].join(" && ");
}

function shellJoin(parts: string[]): string {
  return parts.map(shellEscape).join(" ");
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function withTemporaryEnv<T>(
  key: string,
  value: string,
  callback: () => Promise<T>,
): Promise<T> {
  const previous = process.env[key];
  process.env[key] = value;
  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
}

function sandboxCommandResult(
  plan: DocsCodeBlockExecutionPlan,
  result: unknown,
): DocsCodeBlockValidationResult {
  const record = readObject(result);
  const error = readStringValue(record.error);
  const exitCode =
    readNumberValue(record.exitCode) ??
    readNumberValue(record.code) ??
    readNumberValue(record.exit_code) ??
    (error ? 1 : 0);
  const stdout =
    readStringValue(record.stdout) ??
    readStringValue(record.result) ??
    readStringValue(record.text) ??
    "";
  const stderr = readStringValue(record.stderr) ?? error ?? "";

  return {
    id: plan.id,
    target: plan.target,
    plan,
    status: exitCode === 0 ? ("PASS" as const) : ("FAIL" as const),
    stdout,
    stderr,
    exitCode,
    reason: exitCode === 0 ? undefined : `exit code ${exitCode}`,
  };
}

function failedSandboxResult(
  plan: DocsCodeBlockExecutionPlan,
  error: unknown,
): DocsCodeBlockValidationResult {
  const record = readObject(error);
  return {
    id: plan.id,
    target: plan.target,
    plan,
    status: "FAIL",
    stdout: readStringValue(record.stdout),
    stderr: readStringValue(record.stderr),
    exitCode: readNumberValue(record.exitCode) ?? readNumberValue(record.code) ?? null,
    reason: error instanceof Error ? error.message : String(error),
  };
}

async function cleanupProviderSandbox(value: unknown): Promise<void> {
  const record = readObject(value);
  for (const methodName of ["kill", "close", "stop", "delete", "remove", "destroy"]) {
    const method = record[methodName];
    if (typeof method !== "function") continue;
    await Promise.resolve(method.call(value)).catch(() => {});
    return;
  }
}

function readProviderExport(module: unknown, name: string): unknown {
  return readObject(module)[name];
}

function readObject(value: unknown): Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? (value as Record<string, unknown>)
    : {};
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function hasCreateMethod(value: unknown): value is {
  create(input?: unknown): Promise<unknown>;
} {
  return typeof readObject(value).create === "function";
}

function hasRunMethod(value: unknown): value is {
  run(command: string, options?: unknown): Promise<unknown>;
} {
  return typeof readObject(value).run === "function";
}

function hasExecuteCommandMethod(value: unknown): value is {
  executeCommand(command: string): Promise<unknown>;
} {
  return typeof readObject(value).executeCommand === "function";
}

function hasConstructor(value: unknown): value is new (input?: unknown) => {
  create(input?: unknown): Promise<unknown>;
} {
  return typeof value === "function";
}

function loadValidationEnv(
  rootDir: string,
  config: DocsCodeBlocksResolvedValidateConfig,
): LoadedValidationEnv {
  const fileEnv: Record<string, string> = {};
  for (const file of config.envFile) {
    const fullPath = path.resolve(rootDir, file);
    if (!existsSync(fullPath)) continue;
    Object.assign(fileEnv, parseEnvFile(readFileSync(fullPath, "utf-8")));
  }

  const resolved: Record<string, string> = {};
  const missing: string[] = [];
  for (const [runtimeKey, sourceKey] of Object.entries(config.env)) {
    const value = process.env[sourceKey] ?? fileEnv[sourceKey];
    if (value === undefined) {
      missing.push(runtimeKey);
      continue;
    }
    resolved[runtimeKey] = value;
  }

  return { env: resolved, missing };
}

function parseEnvFile(source: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals <= 0) continue;
    const key = trimmed.slice(0, equals).trim();
    const value = trimmed
      .slice(equals + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function readStringMeta(meta: Record<string, string | boolean>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readBooleanMeta(meta: Record<string, string | boolean>, key: string): boolean | undefined {
  const value = meta[key];
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "true" || normalized === "1" || normalized === "yes")
    return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return true;
}

function readEnvMeta(meta: Record<string, string | boolean>): string[] {
  const direct = meta.env;
  const values = new Set<string>();
  if (typeof direct === "string") {
    for (const item of direct.split(/[,\s]+/)) {
      const trimmed = item.trim();
      if (trimmed) values.add(trimmed);
    }
  }

  for (const [key, value] of Object.entries(meta)) {
    if (!key.startsWith("env:") && !key.startsWith("env.")) continue;
    const envName = key.slice(4).trim();
    if (envName && value !== false) values.add(envName);
  }

  return [...values];
}

function walkMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  const ignored = new Set([".git", ".next", ".nuxt", ".svelte-kit", "dist", "node_modules", "out"]);

  function visit(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (ignored.has(entry)) continue;
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        visit(fullPath);
      } else if (/\.(?:md|mdx)$/i.test(entry)) {
        files.push(fullPath);
      }
    }
  }

  visit(root);
  return files.sort();
}

function normalizeLanguage(language?: string): string | undefined {
  return language?.trim().toLowerCase();
}

function isClosingFence(trimmedLine: string, marker: string): boolean {
  return new RegExp(`^${marker[0]}{${marker.length},}[ \\t]*$`).test(trimmedLine);
}

function isShellLanguage(language: string): boolean {
  return ["bash", "sh", "shell", "zsh", "curl"].includes(language);
}

function templateFromLanguage(language?: string): string {
  if (!language) return "unknown";
  if (isShellLanguage(language)) return "shell";
  if (language === "js" || language === "javascript" || language === "jsx") return "node";
  if (language === "ts" || language === "typescript" || language === "tsx") return "typescript";
  if (language === "py" || language === "python") return "python";
  return language;
}

function looksLikeShellCommand(code: string): boolean {
  return /^(?:\s*(?:npm|pnpm|yarn|bun|npx|curl|git|node|python3?|deno|uv|pip)\b)/m.test(code);
}

function looksPartial(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return true;
  return /^\.\.\.$/m.test(trimmed) || /\/\/\s*\.\.\.|#\s*\.\.\./.test(trimmed);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "snippet"
  );
}

function isPlanAction(value: unknown): value is DocsCodeBlockExecutionPlan["action"] {
  return value === "execute" || value === "validate-syntax" || value === "skip";
}

function skippedResult(
  plan: DocsCodeBlockExecutionPlan,
  reason: string,
): DocsCodeBlockValidationResult {
  return {
    id: plan.id,
    target: plan.target,
    plan,
    status: "SKIP",
    reason,
  };
}

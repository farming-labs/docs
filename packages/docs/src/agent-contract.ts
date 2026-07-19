import type {
  PageAgentAppliesTo,
  PageAgentCommand,
  PageAgentFailureMode,
  PageAgentFrontmatter,
  PageAgentVerification,
} from "./types.js";

export interface PageAgentFrontmatterIssue {
  path: string;
  message: string;
}

export const PAGE_AGENT_STRUCTURED_CONTRACT_FIELDS = [
  "task",
  "outcome",
  "appliesTo",
  "prerequisites",
  "files",
  "commands",
  "sideEffects",
  "verification",
  "rollback",
  "failureModes",
] as const;

export const PAGE_AGENT_CONTRACT_FIELDS = [
  "tokenBudget",
  ...PAGE_AGENT_STRUCTURED_CONTRACT_FIELDS,
] as const;
export const PAGE_AGENT_CONTRACT_FIELD_SCHEMA = {
  tokenBudget: "number",
  task: "string",
  outcome: "string",
  appliesTo: {
    framework: "string|string[]",
    version: "string|string[]",
    package: "string|string[]",
  },
  prerequisites: "string[]",
  files: "string[]",
  commands: "Array<string|{run,cwd?,description?}>",
  sideEffects: "string[]",
  verification: "Array<string|{description?,run?,expect?}>",
  rollback: "string[]",
  failureModes: "Array<string|{symptom,resolution?}>",
} as const;
const APPLIES_TO_FIELDS = ["framework", "version", "package"] as const;
const COMMAND_FIELDS = ["run", "cwd", "description"] as const;
const VERIFICATION_FIELDS = ["description", "run", "expect"] as const;
const FAILURE_MODE_FIELDS = ["symptom", "resolution"] as const;

export const PAGE_AGENT_CONTRACT_START_MARKER = "<!-- farming-labs:agent-contract:start -->";
export const PAGE_AGENT_CONTRACT_END_MARKER = "<!-- farming-labs:agent-contract:end -->";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const text = normalizeString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
  }

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStringOrList(value: unknown): string[] | undefined {
  const single = normalizeString(value);
  if (single) return [single];
  return normalizeStringList(value);
}

function normalizeAppliesTo(value: unknown): PageAgentAppliesTo | undefined {
  if (!isRecord(value)) return undefined;
  const framework = normalizeStringOrList(value.framework);
  const version = normalizeStringOrList(value.version);
  const packageNames = normalizeStringOrList(value.package);
  if (!framework && !version && !packageNames) return undefined;

  return {
    ...(framework ? { framework } : {}),
    ...(version ? { version } : {}),
    ...(packageNames ? { package: packageNames } : {}),
  };
}

function normalizeCommands(value: unknown): Array<string | PageAgentCommand> | undefined {
  if (!Array.isArray(value)) return undefined;
  const commands: Array<string | PageAgentCommand> = [];

  for (const item of value) {
    const shorthand = normalizeString(item);
    if (shorthand) {
      commands.push(shorthand);
      continue;
    }
    if (!isRecord(item)) continue;

    const run = normalizeString(item.run);
    if (!run) continue;
    const cwd = normalizeString(item.cwd);
    const description = normalizeString(item.description);
    commands.push({
      run,
      ...(cwd ? { cwd } : {}),
      ...(description ? { description } : {}),
    });
  }

  return commands.length > 0 ? commands : undefined;
}

function normalizeVerification(value: unknown): Array<string | PageAgentVerification> | undefined {
  if (!Array.isArray(value)) return undefined;
  const verification: Array<string | PageAgentVerification> = [];

  for (const item of value) {
    const shorthand = normalizeString(item);
    if (shorthand) {
      verification.push(shorthand);
      continue;
    }
    if (!isRecord(item)) continue;

    const description = normalizeString(item.description);
    const run = normalizeString(item.run);
    const expect = normalizeString(item.expect);
    if (!description && !run && !expect) continue;
    verification.push({
      ...(description ? { description } : {}),
      ...(run ? { run } : {}),
      ...(expect ? { expect } : {}),
    });
  }

  return verification.length > 0 ? verification : undefined;
}

function normalizeFailureModes(value: unknown): Array<string | PageAgentFailureMode> | undefined {
  if (!Array.isArray(value)) return undefined;
  const failureModes: Array<string | PageAgentFailureMode> = [];

  for (const item of value) {
    const shorthand = normalizeString(item);
    if (shorthand) {
      failureModes.push(shorthand);
      continue;
    }
    if (!isRecord(item)) continue;

    const symptom = normalizeString(item.symptom);
    if (!symptom) continue;
    const resolution = normalizeString(item.resolution);
    failureModes.push({ symptom, ...(resolution ? { resolution } : {}) });
  }

  return failureModes.length > 0 ? failureModes : undefined;
}

function normalizeTokenBudget(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.ceil(value);
}

/**
 * Normalize untrusted page frontmatter into the stable agent contract shape.
 * Invalid fields are omitted so malformed author input cannot break page delivery.
 */
export function normalizePageAgentFrontmatter(value: unknown): PageAgentFrontmatter | undefined {
  if (!isRecord(value)) return undefined;

  const tokenBudget = normalizeTokenBudget(value.tokenBudget);
  const task = normalizeString(value.task);
  const outcome = normalizeString(value.outcome);
  const appliesTo = normalizeAppliesTo(value.appliesTo);
  const prerequisites = normalizeStringList(value.prerequisites);
  const files = normalizeStringList(value.files);
  const commands = normalizeCommands(value.commands);
  const sideEffects = normalizeStringList(value.sideEffects);
  const verification = normalizeVerification(value.verification);
  const rollback = normalizeStringList(value.rollback);
  const failureModes = normalizeFailureModes(value.failureModes);

  const normalized: PageAgentFrontmatter = {
    ...(tokenBudget !== undefined ? { tokenBudget } : {}),
    ...(task ? { task } : {}),
    ...(outcome ? { outcome } : {}),
    ...(appliesTo ? { appliesTo } : {}),
    ...(prerequisites ? { prerequisites } : {}),
    ...(files ? { files } : {}),
    ...(commands ? { commands } : {}),
    ...(sideEffects ? { sideEffects } : {}),
    ...(verification ? { verification } : {}),
    ...(rollback ? { rollback } : {}),
    ...(failureModes ? { failureModes } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function hasStructuredPageAgentContract(value: unknown): boolean {
  const normalized = normalizePageAgentFrontmatter(value);
  if (!normalized) return false;
  return PAGE_AGENT_STRUCTURED_CONTRACT_FIELDS.some((field) => normalized[field] !== undefined);
}

function addStringIssue(
  issues: PageAgentFrontmatterIssue[],
  object: Record<string, unknown>,
  field: string,
) {
  if (!(field in object)) return;
  if (!normalizeString(object[field])) {
    issues.push({ path: `agent.${field}`, message: "must be a non-empty string" });
  }
}

function addStringListIssues(
  issues: PageAgentFrontmatterIssue[],
  object: Record<string, unknown>,
  field: string,
) {
  if (!(field in object)) return;
  const value = object[field];
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path: `agent.${field}`, message: "must be a non-empty string array" });
    return;
  }
  value.forEach((item, index) => {
    if (!normalizeString(item)) {
      issues.push({
        path: `agent.${field}[${index}]`,
        message: "must be a non-empty string",
      });
    }
  });
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}

function closestKnownField(field: string, allowed: readonly string[]): string | undefined {
  const ranked = allowed
    .map((candidate) => ({ candidate, distance: editDistance(field, candidate) }))
    .sort(
      (left, right) =>
        left.distance - right.distance || left.candidate.localeCompare(right.candidate),
    );
  const closest = ranked[0];
  if (!closest) return undefined;
  const threshold = Math.max(1, Math.min(3, Math.floor(closest.candidate.length / 3)));
  return closest.distance <= threshold ? closest.candidate : undefined;
}

function addUnknownKeyIssues(
  issues: PageAgentFrontmatterIssue[],
  object: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
) {
  for (const field of Object.keys(object)) {
    if (allowed.includes(field)) continue;
    const suggestion = closestKnownField(field, allowed);
    issues.push({
      path: `${path}.${field}`,
      message: suggestion
        ? `is not recognized; did you mean "${path}.${suggestion}"?`
        : "is not recognized",
    });
  }
}

/** Return author-facing validation issues without throwing. */
export function getPageAgentFrontmatterIssues(value: unknown): PageAgentFrontmatterIssue[] {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    return [{ path: "agent", message: "must be an object" }];
  }

  const issues: PageAgentFrontmatterIssue[] = [];
  addUnknownKeyIssues(issues, value, PAGE_AGENT_CONTRACT_FIELDS, "agent");
  if (
    "tokenBudget" in value &&
    (typeof value.tokenBudget !== "number" ||
      !Number.isFinite(value.tokenBudget) ||
      value.tokenBudget <= 0)
  ) {
    issues.push({ path: "agent.tokenBudget", message: "must be a positive finite number" });
  }

  addStringIssue(issues, value, "task");
  addStringIssue(issues, value, "outcome");

  if ("appliesTo" in value) {
    if (!isRecord(value.appliesTo)) {
      issues.push({ path: "agent.appliesTo", message: "must be an object" });
    } else {
      addUnknownKeyIssues(issues, value.appliesTo, APPLIES_TO_FIELDS, "agent.appliesTo");
      for (const field of ["framework", "version", "package"] as const) {
        if (!(field in value.appliesTo)) continue;
        const fieldValue = value.appliesTo[field];
        if (!normalizeStringOrList(fieldValue)) {
          issues.push({
            path: `agent.appliesTo.${field}`,
            message: "must be a non-empty string or string array",
          });
          continue;
        }
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach((item, index) => {
            if (!normalizeString(item)) {
              issues.push({
                path: `agent.appliesTo.${field}[${index}]`,
                message: "must be a non-empty string",
              });
            }
          });
        }
      }
      if (!normalizeAppliesTo(value.appliesTo)) {
        issues.push({
          path: "agent.appliesTo",
          message: "must include framework, version, or package",
        });
      }
    }
  }

  for (const field of ["prerequisites", "files", "sideEffects", "rollback"] as const) {
    addStringListIssues(issues, value, field);
  }

  if ("commands" in value) {
    if (!Array.isArray(value.commands) || value.commands.length === 0) {
      issues.push({ path: "agent.commands", message: "must be a non-empty array" });
    } else {
      value.commands.forEach((command, index) => {
        if (normalizeString(command)) return;
        if (!isRecord(command)) {
          issues.push({
            path: `agent.commands[${index}]`,
            message: "must be a command string or an object with a non-empty run field",
          });
          return;
        }
        addUnknownKeyIssues(issues, command, COMMAND_FIELDS, `agent.commands[${index}]`);
        if (!normalizeString(command.run)) {
          issues.push({
            path: `agent.commands[${index}]`,
            message: "must be a command string or an object with a non-empty run field",
          });
          return;
        }
        for (const field of ["cwd", "description"] as const) {
          if (field in command && !normalizeString(command[field])) {
            issues.push({
              path: `agent.commands[${index}].${field}`,
              message: "must be a non-empty string",
            });
          }
        }
      });
    }
  }

  if ("verification" in value) {
    if (!Array.isArray(value.verification) || value.verification.length === 0) {
      issues.push({ path: "agent.verification", message: "must be a non-empty array" });
    } else {
      value.verification.forEach((step, index) => {
        if (normalizeString(step)) return;
        if (!isRecord(step)) {
          issues.push({
            path: `agent.verification[${index}]`,
            message: "must be a string or an object with description, run, or expect",
          });
          return;
        }
        addUnknownKeyIssues(issues, step, VERIFICATION_FIELDS, `agent.verification[${index}]`);
        if (!normalizeVerification([step])) {
          issues.push({
            path: `agent.verification[${index}]`,
            message: "must be a string or an object with description, run, or expect",
          });
          return;
        }
        for (const field of ["description", "run", "expect"] as const) {
          if (field in step && !normalizeString(step[field])) {
            issues.push({
              path: `agent.verification[${index}].${field}`,
              message: "must be a non-empty string",
            });
          }
        }
      });
    }
  }

  if ("failureModes" in value) {
    if (!Array.isArray(value.failureModes) || value.failureModes.length === 0) {
      issues.push({ path: "agent.failureModes", message: "must be a non-empty array" });
    } else {
      value.failureModes.forEach((mode, index) => {
        if (normalizeString(mode)) return;
        if (!isRecord(mode)) {
          issues.push({
            path: `agent.failureModes[${index}]`,
            message: "must be a string or an object with a non-empty symptom field",
          });
          return;
        }
        addUnknownKeyIssues(issues, mode, FAILURE_MODE_FIELDS, `agent.failureModes[${index}]`);
        if (!normalizeString(mode.symptom)) {
          issues.push({
            path: `agent.failureModes[${index}]`,
            message: "must be a string or an object with a non-empty symptom field",
          });
          return;
        }
        if ("resolution" in mode && !normalizeString(mode.resolution)) {
          issues.push({
            path: `agent.failureModes[${index}].resolution`,
            message: "must be a non-empty string",
          });
        }
      });
    }
  }

  return issues;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function renderYamlStringList(lines: string[], indent: string, key: string, values: string[]) {
  lines.push(`${indent}${key}:`);
  for (const value of values) lines.push(`${indent}  - ${yamlString(value)}`);
}

function renderYamlObjectList(
  lines: string[],
  indent: string,
  key: string,
  values: Array<string | object>,
  fields: string[],
) {
  lines.push(`${indent}${key}:`);
  for (const value of values) {
    if (typeof value === "string") {
      lines.push(`${indent}  - ${yamlString(value)}`);
      continue;
    }
    const record = value as Record<string, unknown>;
    const firstField = fields.find((field) => normalizeString(record[field]));
    if (!firstField) continue;
    lines.push(`${indent}  - ${firstField}: ${yamlString(normalizeString(record[firstField])!)}`);
    for (const field of fields) {
      const fieldValue = normalizeString(record[field]);
      if (field === firstField || !fieldValue) continue;
      lines.push(`${indent}    ${field}: ${yamlString(fieldValue)}`);
    }
  }
}

/** Render normalized `agent` YAML in a stable field order. */
export function renderPageAgentFrontmatterYamlLines(value: unknown, indentation = 0): string[] {
  const agent = normalizePageAgentFrontmatter(value);
  if (!agent) return [];

  const indent = " ".repeat(Math.max(0, indentation));
  const child = `${indent}  `;
  const lines = [`${indent}agent:`];
  if (agent.tokenBudget !== undefined) lines.push(`${child}tokenBudget: ${agent.tokenBudget}`);
  if (agent.task) lines.push(`${child}task: ${yamlString(agent.task)}`);
  if (agent.outcome) lines.push(`${child}outcome: ${yamlString(agent.outcome)}`);
  if (agent.appliesTo) {
    lines.push(`${child}appliesTo:`);
    const appliesIndent = `${child}  `;
    for (const field of ["framework", "version", "package"] as const) {
      const values = normalizeStringOrList(agent.appliesTo[field]);
      if (values) renderYamlStringList(lines, appliesIndent, field, values);
    }
  }
  if (agent.prerequisites) renderYamlStringList(lines, child, "prerequisites", agent.prerequisites);
  if (agent.files) renderYamlStringList(lines, child, "files", agent.files);
  if (agent.commands) {
    renderYamlObjectList(lines, child, "commands", agent.commands, ["run", "cwd", "description"]);
  }
  if (agent.sideEffects) renderYamlStringList(lines, child, "sideEffects", agent.sideEffects);
  if (agent.verification) {
    renderYamlObjectList(lines, child, "verification", agent.verification, [
      "description",
      "run",
      "expect",
    ]);
  }
  if (agent.rollback) renderYamlStringList(lines, child, "rollback", agent.rollback);
  if (agent.failureModes) {
    renderYamlObjectList(lines, child, "failureModes", agent.failureModes, [
      "symptom",
      "resolution",
    ]);
  }
  return lines;
}

function inlineCode(value: string): string {
  const longestRun = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  const padding = value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${padding}${value}${padding}${fence}`;
}

function renderTextList(lines: string[], title: string, values: string[], code = false) {
  lines.push("", `### ${title}`, "");
  for (const value of values) lines.push(`- ${code ? inlineCode(value) : value}`);
}

/** Render the structured contract as deterministic, compact machine-readable Markdown. */
export function renderPageAgentContractMarkdown(value: unknown): string {
  const agent = normalizePageAgentFrontmatter(value);
  if (!agent || !hasStructuredPageAgentContract(agent)) return "";

  const lines = [PAGE_AGENT_CONTRACT_START_MARKER, "## Agent Contract"];
  if (agent.task) lines.push("", `Task: ${agent.task}`);
  if (agent.outcome) lines.push(`Outcome: ${agent.outcome}`);

  if (agent.appliesTo) {
    lines.push("", "### Applies To", "");
    for (const [label, field] of [
      ["Framework", "framework"],
      ["Version", "version"],
      ["Package", "package"],
    ] as const) {
      const values = normalizeStringOrList(agent.appliesTo[field]);
      if (values) lines.push(`- ${label}: ${values.map(inlineCode).join(", ")}`);
    }
  }

  if (agent.prerequisites) renderTextList(lines, "Prerequisites", agent.prerequisites);
  if (agent.files) renderTextList(lines, "Files", agent.files, true);

  if (agent.commands) {
    lines.push("", "### Commands", "");
    for (const command of agent.commands) {
      if (typeof command === "string") {
        lines.push(`- ${inlineCode(command)}`);
        continue;
      }
      const details = [
        command.cwd ? `cwd ${inlineCode(command.cwd)}` : undefined,
        command.description,
      ].filter(Boolean);
      lines.push(`- ${inlineCode(command.run)}${details.length ? ` — ${details.join("; ")}` : ""}`);
    }
  }

  if (agent.sideEffects) renderTextList(lines, "Side Effects", agent.sideEffects);

  if (agent.verification) {
    lines.push("", "### Verification", "");
    for (const step of agent.verification) {
      if (typeof step === "string") {
        lines.push(`- ${step}`);
        continue;
      }
      const summary =
        step.description ??
        (step.run ? `Run ${inlineCode(step.run)}` : (step.expect ?? "Verification step"));
      lines.push(`- ${summary}`);
      if (step.run && step.description) lines.push(`  - Run: ${inlineCode(step.run)}`);
      if (step.expect && step.expect !== summary) lines.push(`  - Expected: ${step.expect}`);
    }
  }

  if (agent.rollback) renderTextList(lines, "Rollback", agent.rollback);

  if (agent.failureModes) {
    lines.push("", "### Failure Modes", "");
    for (const mode of agent.failureModes) {
      if (typeof mode === "string") {
        lines.push(`- ${mode}`);
        continue;
      }
      lines.push(`- ${mode.symptom}${mode.resolution ? ` — Recovery: ${mode.resolution}` : ""}`);
    }
  }

  lines.push(PAGE_AGENT_CONTRACT_END_MARKER);
  return lines.join("\n");
}

/** Remove generated contract blocks while preserving handwritten guidance. */
export function stripGeneratedPageAgentContractMarkdown(markdown: string): string {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const output: string[] = [];
  let fence: MarkdownFence | undefined;
  let pendingBlock: string[] | undefined;
  let skipEmptySeparator = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (pendingBlock) {
      pendingBlock.push(line);
      if (isGeneratedAgentContractMarker(line, PAGE_AGENT_CONTRACT_END_MARKER)) {
        pendingBlock = undefined;
        skipEmptySeparator = true;
      }
      continue;
    }

    if (!fence && isGeneratedAgentContractMarker(line, PAGE_AGENT_CONTRACT_START_MARKER)) {
      pendingBlock = [line];
      continue;
    }

    if (skipEmptySeparator && line.length === 0) continue;
    skipEmptySeparator = false;
    output.push(line);
    fence = advanceMarkdownFence(line, fence);
  }

  // A lone start marker may be handwritten content or an example. Only remove
  // complete generated blocks so malformed input is never truncated.
  if (pendingBlock) output.push(...pendingBlock);

  while (output[0] === "") output.shift();
  return output.join(newline);
}

interface MarkdownFence {
  character: "`" | "~";
  length: number;
}

function isGeneratedAgentContractMarker(line: string, marker: string): boolean {
  if (line.trim() !== marker) return false;
  const markerIndex = line.indexOf(marker);
  return markerIndex <= 3 && /^ *$/.test(line.slice(0, markerIndex));
}

function advanceMarkdownFence(
  line: string,
  fence: MarkdownFence | undefined,
): MarkdownFence | undefined {
  if (fence) {
    const closing = /^ {0,3}(`+|~+)[\t ]*$/.exec(line)?.[1];
    if (closing?.[0] === fence.character && closing.length >= fence.length) {
      return undefined;
    }
    return fence;
  }

  const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!opening?.[1]) return undefined;
  if (opening[1][0] === "`" && opening[2]?.includes("`")) return undefined;
  return {
    character: opening[1][0] as MarkdownFence["character"],
    length: opening[1].length,
  };
}

function isAgentContractHeadingText(value: string): boolean {
  return value.trim().toLowerCase() === "agent contract";
}

function hasPageAgentContractHeading(markdown: string): boolean {
  let fence: MarkdownFence | undefined;
  let previousLine: string | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const nextFence = advanceMarkdownFence(line, fence);
    if (fence || nextFence) {
      fence = nextFence;
      previousLine = undefined;
      continue;
    }

    const atx = /^ {0,3}#{1,6}(?:[\t ]+|$)(.*)$/.exec(line);
    const atxText = atx?.[1]?.replace(/[\t ]+#+[\t ]*$/, "").trim();
    if (atxText && isAgentContractHeadingText(atxText)) return true;

    if (
      previousLine &&
      /^ {0,3}(?:=+|-+)[\t ]*$/.test(line) &&
      isAgentContractHeadingText(previousLine)
    ) {
      return true;
    }

    previousLine =
      line.trim().length > 0 && !/^ {4}/.test(line) && !/^ {0,3}\t/.test(line) ? line : undefined;
  }

  return false;
}

/** Insert one generated contract unless the document already has handwritten contract guidance. */
export function upsertPageAgentContractMarkdown(markdown: string, value: unknown): string {
  const cleaned = stripGeneratedPageAgentContractMarkdown(markdown);
  const contract = renderPageAgentContractMarkdown(value);
  if (!contract || hasPageAgentContractHeading(cleaned)) return cleaned;
  return cleaned ? `${contract}\n\n${cleaned.replace(/^\r?\n+/, "")}` : contract;
}

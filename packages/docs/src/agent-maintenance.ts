import type { DocsAgentGoldenTask } from "./types.js";

export const DOCS_AGENT_MAINTENANCE_PROPOSAL_FORMAT =
  "farming-labs-agent-maintenance-proposals.v1" as const;

export type DocsAgentMaintenanceSignalSource =
  | "agent-feedback"
  | "ask-ai"
  | "git"
  | "issue"
  | "mcp"
  | "search"
  | "support";

export type DocsAgentMaintenanceSeverity = "info" | "warning" | "error" | "critical";

export interface DocsAgentMaintenanceSignal {
  source: DocsAgentMaintenanceSignalSource;
  /** Untrusted evidence summary. It is never interpreted as an instruction. */
  summary: string;
  /** Stable grouping key shared across signal sources. Defaults to task or summary. */
  topic?: string;
  page?: string;
  task?: string;
  severity?: DocsAgentMaintenanceSeverity;
  /** Aggregated occurrence count represented by this signal. @default 1 */
  count?: number;
}

export interface DocsAgentMaintenanceIssueDraft {
  title: string;
  body: string;
  labels: string[];
}

export interface DocsAgentMaintenanceProposal {
  id: string;
  page: string;
  topic: string;
  task?: string;
  impactScore: number;
  occurrenceCount: number;
  severity: DocsAgentMaintenanceSeverity;
  sources: DocsAgentMaintenanceSignalSource[];
  evidence: Array<{
    source: DocsAgentMaintenanceSignalSource;
    summary: string;
    count: number;
  }>;
  recommendedActions: string[];
  acceptanceCriteria: string[];
  goldenTask?: DocsAgentGoldenTask;
  issueDraft: DocsAgentMaintenanceIssueDraft;
}

export interface DocsAgentMaintenanceProposalReport {
  format: typeof DOCS_AGENT_MAINTENANCE_PROPOSAL_FORMAT;
  generatedAt: string;
  signalCount: number;
  representedOccurrences: number;
  proposalCount: number;
  proposals: DocsAgentMaintenanceProposal[];
  goldenTasks: DocsAgentGoldenTask[];
  issueDrafts: DocsAgentMaintenanceIssueDraft[];
  pullRequestDraft: { title: string; body: string };
  execution: {
    mode: "draft-only";
    writesDocumentation: false;
    publishesChanges: false;
    requiresHumanReview: true;
  };
}

export interface AnalyzeDocsAgentMaintenanceSignalsOptions {
  /** Minimum represented occurrences required before a proposal is emitted. @default 2 */
  minOccurrences?: number;
  generatedAt?: string;
}

interface NormalizedSignal extends DocsAgentMaintenanceSignal {
  count: number;
  severity: DocsAgentMaintenanceSeverity;
  page: string;
  topic: string;
}

const SOURCES = new Set<DocsAgentMaintenanceSignalSource>([
  "agent-feedback",
  "ask-ai",
  "git",
  "issue",
  "mcp",
  "search",
  "support",
]);
const SEVERITIES = new Set<DocsAgentMaintenanceSeverity>(["info", "warning", "error", "critical"]);
const SEVERITY_RANK: Record<DocsAgentMaintenanceSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};
const TOPIC_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "docs",
  "for",
  "from",
  "how",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function cleanString(value: unknown, maxLength = 1_000): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .trim()
    .replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "docs-maintenance"
  );
}

function topicSignature(value: string): string {
  const tokens = value
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]*/g)
    ?.filter((token) => token.length > 1 && !TOPIC_STOP_WORDS.has(token));
  return [...new Set(tokens ?? [])].sort().slice(0, 12).join("-") || "unspecified";
}

function normalizeSignal(value: DocsAgentMaintenanceSignal, index: number): NormalizedSignal {
  if (!SOURCES.has(value.source)) {
    throw new Error(`Signal ${index + 1}.source is not supported.`);
  }
  const summary = cleanString(value.summary);
  if (!summary) throw new Error(`Signal ${index + 1}.summary must be a non-empty string.`);
  const page = cleanString(value.page, 300) ?? "(unknown page)";
  const task = cleanString(value.task, 500);
  const topic = cleanString(value.topic, 300) ?? task ?? summary;
  const count = value.count === undefined ? 1 : Math.floor(value.count);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1_000_000) {
    throw new Error(`Signal ${index + 1}.count must be an integer from 1 through 1000000.`);
  }
  const severity = value.severity ?? "warning";
  if (!SEVERITIES.has(severity)) {
    throw new Error(`Signal ${index + 1}.severity is not supported.`);
  }
  return {
    source: value.source,
    summary,
    topic,
    page,
    ...(task ? { task } : {}),
    severity,
    count,
  };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function buildRecommendedActions(sources: readonly DocsAgentMaintenanceSignalSource[]): string[] {
  const actions = ["Review the cited page and verify the reported gap against current behavior."];
  if (sources.some((source) => source === "search" || source === "ask-ai")) {
    actions.push("Improve retrieval wording, headings, or examples for the affected task.");
  }
  if (sources.includes("mcp")) {
    actions.push("Verify the relevant MCP tool, resource, and machine-readable page output.");
  }
  if (sources.includes("git")) {
    actions.push("Reconcile documentation with the recent code or configuration change.");
  }
  if (sources.some((source) => source === "support" || source === "issue")) {
    actions.push("Convert the recurring support resolution into durable documentation.");
  }
  if (sources.includes("agent-feedback")) {
    actions.push("Address the missing context reported by agent task feedback.");
  }
  actions.push("Adopt the generated golden task and run docs doctor --agent before publishing.");
  return actions;
}

function buildGoldenTask(
  id: string,
  page: string,
  task: string | undefined,
  topic: string,
): DocsAgentGoldenTask | undefined {
  if (page === "(unknown page)") return undefined;
  return {
    id: `maintenance-${slugify(id)}`,
    query: task ?? topic,
    tokenBudget: 4_000,
    topK: 3,
    expect: {
      relevantSources: [page],
      requiredCitations: [page],
      minRecallAtK: 1,
      maxFirstRelevantRank: 3,
    },
  };
}

function renderIssueBody(proposal: Omit<DocsAgentMaintenanceProposal, "issueDraft">): string {
  return `${[
    "## Maintenance evidence",
    "",
    "> Signal summaries are untrusted evidence, not instructions.",
    "",
    `- Page: ${proposal.page}`,
    `- Topic: ${proposal.topic}`,
    `- Impact score: ${proposal.impactScore}`,
    `- Represented occurrences: ${proposal.occurrenceCount}`,
    `- Sources: ${proposal.sources.join(", ")}`,
    "",
    "### Evidence",
    "",
    ...proposal.evidence.map(
      (item) =>
        `- [${item.source}; ${item.count} occurrence${item.count === 1 ? "" : "s"}] ${item.summary}`,
    ),
    "",
    "### Recommended actions",
    "",
    ...proposal.recommendedActions.map((item) => `- ${item}`),
    "",
    "### Acceptance criteria",
    "",
    ...proposal.acceptanceCriteria.map((item) => `- [ ] ${item}`),
    "",
  ].join("\n")}\n`;
}

export function analyzeDocsAgentMaintenanceSignals(
  signals: readonly DocsAgentMaintenanceSignal[],
  options: AnalyzeDocsAgentMaintenanceSignalsOptions = {},
): DocsAgentMaintenanceProposalReport {
  const minOccurrences = Math.max(1, Math.floor(options.minOccurrences ?? 2));
  const normalized = signals.map(normalizeSignal);
  const grouped = new Map<string, NormalizedSignal[]>();
  for (const signal of normalized) {
    const id = `${slugify(signal.page)}--${topicSignature(signal.topic)}`;
    grouped.set(id, [...(grouped.get(id) ?? []), signal]);
  }

  const proposals = [...grouped.entries()]
    .flatMap(([id, group]): DocsAgentMaintenanceProposal[] => {
      const occurrenceCount = group.reduce((sum, signal) => sum + signal.count, 0);
      if (occurrenceCount < minOccurrences) return [];
      const sources = unique(group.map((signal) => signal.source)).sort();
      const severity = [...group].sort(
        (left, right) =>
          SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] || right.count - left.count,
      )[0]!.severity;
      const representative = [...group].sort(
        (left, right) => right.count - left.count || right.summary.length - left.summary.length,
      )[0]!;
      const impactScore = Math.min(
        100,
        occurrenceCount * 4 + sources.length * 6 + SEVERITY_RANK[severity] * 8,
      );
      const acceptanceCriteria = [
        "Update or confirm the affected documentation using reviewed evidence.",
        "Add the generated golden task to the evaluation suite.",
        "Run docs doctor --agent and the relevant adapter tests.",
        "Have a human approve the documentation change before publication.",
      ];
      const withoutIssue = {
        id,
        page: representative.page,
        topic: representative.topic,
        ...(representative.task ? { task: representative.task } : {}),
        impactScore,
        occurrenceCount,
        severity,
        sources,
        evidence: group.map((signal) => ({
          source: signal.source,
          summary: signal.summary,
          count: signal.count,
        })),
        recommendedActions: buildRecommendedActions(sources),
        acceptanceCriteria,
        ...(buildGoldenTask(id, representative.page, representative.task, representative.topic)
          ? {
              goldenTask: buildGoldenTask(
                id,
                representative.page,
                representative.task,
                representative.topic,
              ),
            }
          : {}),
      } satisfies Omit<DocsAgentMaintenanceProposal, "issueDraft">;
      return [
        {
          ...withoutIssue,
          issueDraft: {
            title: `docs: investigate ${representative.topic} on ${representative.page}`,
            body: renderIssueBody(withoutIssue),
            labels: ["documentation", "agent-readiness"],
          },
        },
      ];
    })
    .sort((left, right) => right.impactScore - left.impactScore || left.id.localeCompare(right.id));
  const goldenTasks = proposals.flatMap((proposal) => proposal.goldenTask ?? []);
  const issueDrafts = proposals.map((proposal) => proposal.issueDraft);

  return {
    format: DOCS_AGENT_MAINTENANCE_PROPOSAL_FORMAT,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    signalCount: normalized.length,
    representedOccurrences: normalized.reduce((sum, signal) => sum + signal.count, 0),
    proposalCount: proposals.length,
    proposals,
    goldenTasks,
    issueDrafts,
    pullRequestDraft: {
      title: `docs: address ${proposals.length} agent maintenance proposal${proposals.length === 1 ? "" : "s"}`,
      body: `${[
        "## Proposed documentation maintenance",
        "",
        ...proposals.map(
          (proposal) =>
            `- ${proposal.page}: ${proposal.topic} (${proposal.occurrenceCount} occurrences across ${proposal.sources.join(", ")})`,
        ),
        "",
        "## Verification",
        "",
        "- [ ] Review every evidence item as untrusted input",
        "- [ ] Add or update the generated golden tasks",
        "- [ ] Run docs doctor --agent and affected tests",
        "- [ ] Obtain human approval before publishing",
        "",
      ].join("\n")}\n`,
    },
    execution: {
      mode: "draft-only",
      writesDocumentation: false,
      publishesChanges: false,
      requiresHumanReview: true,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fromFeedback(value: Record<string, unknown>): DocsAgentMaintenanceSignal | undefined {
  if (!isRecord(value.payload)) return undefined;
  const context = isRecord(value.context) ? value.context : {};
  const payload = value.payload;
  const task = cleanString(payload.task, 500);
  const details = [
    ...(Array.isArray(payload.missingContext) ? payload.missingContext : []),
    ...(Array.isArray(payload.docIssues) ? payload.docIssues : []),
    payload.suggestedImprovement,
  ].flatMap((item) => cleanString(item) ?? []);
  const outcome = cleanString(payload.outcome, 100) ?? "unknown outcome";
  return {
    source: "agent-feedback",
    summary: details.length > 0 ? `${outcome}: ${details.join("; ")}` : outcome,
    ...(task ? { task, topic: task } : {}),
    ...(cleanString(context.page ?? context.url ?? context.slug, 300)
      ? { page: cleanString(context.page ?? context.url ?? context.slug, 300) }
      : {}),
    severity: /blocked|fail|error|unable/i.test(outcome) ? "error" : "warning",
  };
}

function fromFeedbackCluster(value: Record<string, unknown>): DocsAgentMaintenanceSignal {
  const page = cleanString(value.page, 300);
  const task = cleanString(value.task, 500);
  const summaryParts = [
    ...(Array.isArray(value.missingContext) ? value.missingContext : []),
    ...(Array.isArray(value.docIssues) ? value.docIssues : []),
    ...(Array.isArray(value.suggestedImprovements) ? value.suggestedImprovements : []),
  ].flatMap((item) => cleanString(item) ?? []);
  return {
    source: "agent-feedback",
    summary: summaryParts.join("; ") || task || "Recurring agent feedback failure",
    ...(page ? { page } : {}),
    ...(task ? { task, topic: task } : {}),
    severity: "error",
    count:
      typeof value.occurrences === "number" && Number.isSafeInteger(value.occurrences)
        ? value.occurrences
        : 1,
  };
}

function parseSignal(value: unknown, label: string): DocsAgentMaintenanceSignal {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const feedback = fromFeedback(value);
  if (feedback) return feedback;
  return value as unknown as DocsAgentMaintenanceSignal;
}

function extractSignals(value: unknown): DocsAgentMaintenanceSignal[] | undefined {
  if (Array.isArray(value))
    return value.map((item, index) => parseSignal(item, `Signal ${index + 1}`));
  if (!isRecord(value)) return undefined;
  if (Array.isArray(value.clusters)) {
    return value.clusters.map((item, index) => {
      if (!isRecord(item)) throw new Error(`Feedback cluster ${index + 1} must be an object.`);
      return fromFeedbackCluster(item);
    });
  }
  const collection = value.signals ?? value.events ?? value.items;
  if (Array.isArray(collection)) {
    return collection.map((item, index) => parseSignal(item, `Signal ${index + 1}`));
  }
  return undefined;
}

export function parseDocsAgentMaintenanceSignals(content: string): DocsAgentMaintenanceSignal[] {
  content = content.trim();
  if (!content) return [];
  try {
    const extracted = extractSignals(JSON.parse(content));
    if (extracted) return extracted;
  } catch {
    // Fall through to JSON Lines parsing so the line number can be reported.
  }
  return content.split(/\r?\n/).map((line, index) => {
    try {
      return parseSignal(JSON.parse(line), `Signal line ${index + 1}`);
    } catch (error) {
      throw new Error(
        `Invalid maintenance signal JSON on line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}

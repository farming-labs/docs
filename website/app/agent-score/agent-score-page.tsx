"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Gauge,
  Github,
  GithubIcon,
  Globe,
  Link2,
  ListOrdered,
  Loader2,
  Search,
  Type,
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import PixelCard from "@/components/ui/pixel-card";
import { SidebarThemeToggle } from "@/components/sidebar-theme-toggle";
import { cn } from "@/lib/utils";
import type { AgentScoreCheck, AgentScoreReport } from "@/lib/agent-score";
import leaderboardTableStyles from "./leaderboard-table.module.css";

type LeaderboardEntry = {
  id: string;
  url: string;
  name: string;
  score: number;
  grade: AgentScoreReport["grade"];
  framework?: string | null;
  checks?: AgentScoreCheck[] | null;
  recommendations?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type ScoreStatus = AgentScoreCheck["status"];

type BreakdownItem = {
  id: string;
  title: string;
  detail: string;
  status: ScoreStatus;
  score: number;
  maxScore: number;
};

type CheckGroup = {
  id: string;
  title: string;
  checks: AgentScoreCheck[];
};

type StandardBreakdownDefinition = {
  id: string;
  title: string;
  sourceTitle: string;
};

const FAIL_SCORE_RATIO = 0.5;
const PASS_SCORE_RATIO = 0.9;
const FARMING_LABS_DOCS_UPGRADE_RECOMMENDATION =
  "Because this site uses @farming-labs/docs, upgrade to the latest version with `npx @farming-labs/docs upgrade --latest`, redeploy, then rescore before working through the remaining checks.";

const STANDARD_BREAKDOWN_DEFINITIONS: StandardBreakdownDefinition[] = [
  {
    id: "content-discoverability",
    title: "Discovery",
    sourceTitle: "Content Discoverability",
  },
  {
    id: "markdown-availability",
    title: "Markdown",
    sourceTitle: "Markdown Availability",
  },
  {
    id: "page-size",
    title: "Page Size",
    sourceTitle: "Page Size and Truncation Risk",
  },
  {
    id: "content-structure",
    title: "Structure",
    sourceTitle: "Content Structure",
  },
  {
    id: "url-stability",
    title: "URL Stability",
    sourceTitle: "URL Stability and Redirects",
  },
  {
    id: "observability",
    title: "Observability",
    sourceTitle: "Observability and Content Health",
  },
  {
    id: "authentication",
    title: "Public Access",
    sourceTitle: "Authentication and Access",
  },
];

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; report: AgentScoreReport }
  | { status: "error"; message: string };

type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "warning"; message: string }
  | { status: "error"; message: string };

const EXAMPLE_URLS = ["https://docs.farming-labs.dev", "https://orm.farming-labs.dev"] as const;
const SCORE_PAGE_ROUTE = "/score";
const SCORE_SECTION_ID = "score";
const LEADERBOARD_SECTION_ID = "leaderboard";
const SELECTED_SITE_PARAM = "site";
const SCORE_INPUT_PARAM = "url";
const AF_DOCS_MARKDOWN_URL_CHECK_ID = "afdocs:markdown-url-support";
const STRICT_MARKDOWN_ROUTE_CHECK_ID = "agent:adjacent-markdown-routes";
const COMBINED_MARKDOWN_ROUTE_CHECK_ID = "agent:md-routes";

const SCORE_LOADING_STEPS = [
  "Resolving docs site",
  "Reading agent discovery",
  "Checking context files",
  "Reviewing agent access",
  "Discovering MCP tools",
  "Testing search and feedback",
  "Calculating final score",
] as const;

function fallbackApiErrorMessage(response: Response, body: string): string {
  const compactBody = body.trim().replace(/\s+/g, " ");
  const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
  return compactBody ? `${status}: ${compactBody.slice(0, 240)}` : status;
}

async function readApiJson<T extends object>(response: Response): Promise<T & { error?: string }> {
  const body = await response.text();
  if (!body.trim()) return {} as T & { error?: string };

  try {
    return JSON.parse(body) as T & { error?: string };
  } catch {
    return { error: fallbackApiErrorMessage(response, body) } as T & { error?: string };
  }
}

const BREAKDOWN_HELP_ITEMS = [
  {
    title: "Discovery",
    detail: "Checks whether agents can find the machine entrypoints before reading full pages.",
  },
  {
    title: "Markdown",
    detail:
      "Checks whether agents can read clean markdown through .md routes, markdown mirrors, or negotiation.",
  },
  {
    title: "Page Size",
    detail: "Checks whether HTML and markdown stay small enough for agent context windows.",
  },
  {
    title: "Structure",
    detail:
      "Checks headings, code fences, and serialized content so agents can parse the page reliably.",
  },
  {
    title: "URL Stability",
    detail: "Checks status codes and redirects so agents do not cache or cite unstable URLs.",
  },
  {
    title: "Observability",
    detail: "Checks parity, cache headers, and freshness signals between HTML and markdown.",
  },
  {
    title: "Public Access",
    detail:
      "Checks that sampled docs pages are readable without auth gates. Percentages are point-weighted, so a PASS can be just below 100.",
  },
  {
    title: "MCP",
    detail:
      "Checks whether MCP clients can initialize and list docs tools instead of scraping pages.",
  },
] as const;

function leaderboardEntryMatchesQuery(entry: LeaderboardEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    deriveLeaderboardDisplayName(entry),
    deriveLeaderboardSiteDomain(entry.url),
    entry.name,
    entry.url,
    entry.grade,
    String(entry.score),
    `${entry.score}/100`,
    shortenUrl(entry.url),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

const DOCS_HOST_PREFIXES = new Set(["dev", "developer", "developers", "doc", "docs"]);
const SECOND_LEVEL_TLDS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);
const COMPOUND_DOMAIN_SUFFIXES = ["domain", "docs", "auth", "api", "ai", "cloud", "labs"];

function deriveLeaderboardDisplayName(entry: Pick<LeaderboardEntry, "name" | "url">): string {
  const hostLabel = domainLabelFromUrl(entry.url);
  const source = hostLabel || entry.name;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(source)) return source;

  const words = source
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .flatMap(splitCompoundDomainWord)
    .map((part) => part.replace(/[^a-z\d]+/gi, ""))
    .filter(Boolean);

  return (words.length > 0 ? words.join(" ") : source).toUpperCase();
}

function domainLabelFromUrl(value: string): string | undefined {
  const baseDomain = deriveLeaderboardSiteDomain(value);
  if (!baseDomain) return undefined;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(baseDomain)) return baseDomain;
  return baseDomain.split(".")[0];
}

function deriveLeaderboardSiteDomain(value: string): string | undefined {
  for (const candidate of [value, `https://${value}`]) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return host;

      let labels = host.split(".").filter(Boolean);
      if (labels.length > 2 && DOCS_HOST_PREFIXES.has(labels[0] ?? "")) {
        labels = labels.slice(1);
      }

      if (labels.length >= 3) {
        const secondLevel = labels[labels.length - 2];
        const tld = labels[labels.length - 1];
        if (tld && tld.length === 2 && SECOND_LEVEL_TLDS.has(secondLevel ?? "")) {
          return labels.slice(-3).join(".");
        }
      }

      return labels.length > 1 ? labels.slice(-2).join(".") : labels[0];
    } catch {
      // Try the protocol-prefixed candidate next.
    }
  }

  return undefined;
}

function splitCompoundDomainWord(value: string): string[] {
  const lower = value.toLowerCase();
  const suffix = COMPOUND_DOMAIN_SUFFIXES.find(
    (candidate) => lower.endsWith(candidate) && lower.length > candidate.length + 1,
  );

  if (!suffix) return [value];
  return [value.slice(0, -suffix.length), suffix].filter(Boolean);
}

function siteLookupKeys(value: string): Set<string> {
  const keys = new Set<string>();
  const trimmed = value.trim();
  if (!trimmed) return keys;

  keys.add(trimmed.toLowerCase().replace(/\/+$/, ""));

  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      const url = new URL(candidate);
      const path = url.pathname.replace(/\/+$/, "");
      keys.add(`${url.origin}${path}`.toLowerCase());
      keys.add(`${url.hostname.replace(/^www\./i, "")}${path}`.toLowerCase());
    } catch {
      // Keep the raw key above for non-URL values such as entry ids.
    }
  }

  return keys;
}

function siteDomainLookupKey(value: string): string | undefined {
  return deriveLeaderboardSiteDomain(value)?.toLowerCase();
}

function cleanScoreUrlValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      const url = new URL(candidate);
      const path = url.pathname.replace(/\/+$/, "");
      return `${url.hostname.replace(/^www\./i, "")}${path && path !== "/" ? path : ""}`;
    } catch {
      // Fall back below for values that are intentionally not URLs.
    }
  }

  return trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function findLeaderboardEntryBySelection(
  entries: LeaderboardEntry[],
  selection: string,
): LeaderboardEntry | undefined {
  const selectionKeys = siteLookupKeys(selection);
  const exactEntry = entries.find((entry) => {
    if (entry.id === selection) return true;
    const entryKeys = new Set([
      ...siteLookupKeys(entry.url),
      ...siteLookupKeys(entry.name),
      ...siteLookupKeys(shortenUrl(entry.url)),
    ]);
    return [...selectionKeys].some((key) => entryKeys.has(key));
  });

  if (exactEntry) return exactEntry;

  const selectionDomain = siteDomainLookupKey(selection);
  if (!selectionDomain) return undefined;

  return entries.find((entry) =>
    [entry.url, entry.name, shortenUrl(entry.url)]
      .map(siteDomainLookupKey)
      .some((key) => key === selectionDomain),
  );
}

function statusFromScore(score: number, maxScore: number): ScoreStatus {
  if (maxScore <= 0) return "fail";
  const ratio = Math.max(0, Math.min(1, score / maxScore));
  if (ratio < FAIL_SCORE_RATIO) return "fail";
  if (ratio < PASS_SCORE_RATIO) return "warn";
  return "pass";
}

function statusLabel(status: ScoreStatus): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

function scorePercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round(Math.max(0, Math.min(1, score / maxScore)) * 100);
}

function averageScorePercent(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((total, value) => total + value, 0) / valid.length);
}

function averageCheckPercent(checks: AgentScoreCheck[]): number | undefined {
  if (checks.length === 0) return undefined;
  return averageScorePercent(checks.map((check) => scorePercent(check.score, check.maxScore)));
}

function displayStatusForCheck(check: AgentScoreCheck): ScoreStatus {
  return statusFromScore(check.score, check.maxScore);
}

function scoreTargetForPrompt(report: AgentScoreReport): number {
  if (report.score >= 90) return 100;
  if (report.score >= 75) return 90;
  return 80;
}

function categoryTitleFromCheck(check: AgentScoreCheck): string | undefined {
  if (!check.id.startsWith("afdocs:")) return undefined;
  return check.detail.split(":").at(0)?.trim();
}

function extraChecksForStandardCategory(
  categoryId: string,
  checks: AgentScoreCheck[],
): AgentScoreCheck[] {
  if (categoryId === "markdown-availability") {
    return checks.filter((check) => check.id === STRICT_MARKDOWN_ROUTE_CHECK_ID);
  }
  return [];
}

function averageCategoryWithExtraChecks(
  categoryScore: number,
  extraChecks: AgentScoreCheck[],
): number {
  const extraPercent = averageCheckPercent(extraChecks);
  return typeof extraPercent === "number"
    ? averageScorePercent([categoryScore, extraPercent])
    : categoryScore;
}

function buildPinnedStandardBreakdownItem(
  definition: StandardBreakdownDefinition,
  report: AgentScoreReport,
): BreakdownItem {
  const checks = report.checks.filter(
    (check) => categoryTitleFromCheck(check) === definition.sourceTitle,
  );
  const extraChecks = extraChecksForStandardCategory(definition.id, report.checks);
  const scoredCategory = report.standard.categories.find(
    (category) => category.id === definition.id,
  );

  if (scoredCategory) {
    const categoryScore = scoredCategory.score ?? 0;
    const score = averageCategoryWithExtraChecks(categoryScore, extraChecks);
    return {
      id: `standard:${definition.id}`,
      title: definition.title,
      detail: scoredCategory.grade
        ? `${definition.sourceTitle}: AFDocs category grade ${scoredCategory.grade}${
            extraChecks.length > 0 ? ", plus hosted route probes." : "."
          }`
        : `${definition.sourceTitle}: AFDocs did not score this category on this run.`,
      status: statusFromScore(score, 100),
      score,
      maxScore: 100,
    };
  }

  const rawScore = checks.reduce((total, check) => total + check.score, 0);
  const rawMaxScore = checks.reduce((total, check) => total + check.maxScore, 0);
  const score = rawMaxScore > 0 ? scorePercent(rawScore, rawMaxScore) : 0;

  return {
    id: `standard:${definition.id}`,
    title: definition.title,
    detail:
      checks.length > 0
        ? `${definition.sourceTitle}: ${checks.length} stored check${
            checks.length === 1 ? "" : "s"
          } in this category.`
        : `${definition.sourceTitle}: no stored check data for this category.`,
    status: rawMaxScore > 0 ? statusFromScore(rawScore, rawMaxScore) : "warn",
    score,
    maxScore: 100,
  };
}

function buildMcpBreakdownItem(report: AgentScoreReport): BreakdownItem {
  const check = report.checks.find((item) => item.id === "framework:mcp");
  if (!check) {
    return {
      id: "framework:mcp",
      title: "MCP",
      detail: "MCP was not stored on this saved score. Recalculate to include MCP weighting.",
      status: "warn",
      score: 0,
      maxScore: 6,
    };
  }

  return {
    id: check.id,
    title: "MCP",
    detail: "Tool-enabled docs access through Model Context Protocol.",
    status: displayStatusForCheck(check),
    score: check.score,
    maxScore: check.maxScore,
  };
}

function buildPrimaryBreakdownItems(report: AgentScoreReport): BreakdownItem[] {
  const mcpItem = buildMcpBreakdownItem(report);
  return [
    ...STANDARD_BREAKDOWN_DEFINITIONS.map((definition) =>
      buildPinnedStandardBreakdownItem(definition, report),
    ),
    mcpItem,
  ];
}

function groupTitleForCheck(check: AgentScoreCheck): string {
  if (check.id === "framework:mcp") return "MCP";
  if (
    check.id === STRICT_MARKDOWN_ROUTE_CHECK_ID ||
    check.id === COMBINED_MARKDOWN_ROUTE_CHECK_ID
  ) {
    return "Markdown";
  }
  if (check.id.startsWith("framework:")) return "Framework surfaces";
  if (check.id.startsWith("afdocs:")) {
    const category = categoryTitleFromCheck(check);
    const definition = STANDARD_BREAKDOWN_DEFINITIONS.find((item) => item.sourceTitle === category);
    if (definition) return definition.title;
    if (category) return category;
    return "AFDocs standard";
  }
  return "Agent probes";
}

function groupIdFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function groupCalloutForId(id: string): string | null {
  if (id !== "framework-surfaces") return null;
  return "@farming-labs/docs extras on top of the AFDocs standard. These checks validate the discovery spec, full-context files, sitemap routes, robots.txt policy, AGENTS.md, skill.md, MCP, search, feedback, JSON-LD, and markdown alternate links when the site advertises them.";
}

function groupChecksForDetails(checks: AgentScoreCheck[]): CheckGroup[] {
  const groups: CheckGroup[] = [];
  const byId = new Map<string, CheckGroup>();

  for (const check of checksForDetails(checks)) {
    const title = groupTitleForCheck(check);
    const id = groupIdFromTitle(title) || "agent-probes";
    const existing = byId.get(id);

    if (existing) {
      existing.checks.push(check);
      continue;
    }

    const group = { id, title, checks: [check] };
    byId.set(id, group);
    groups.push(group);
  }

  return groups;
}

function stripAfDocsCategoryPrefix(detail: string): string {
  return detail.replace(/^[^:]+:\s*/, "");
}

function combinedMarkdownRouteCheck(checks: AgentScoreCheck[]): AgentScoreCheck | undefined {
  const afDocsCheck = checks.find((check) => check.id === AF_DOCS_MARKDOWN_URL_CHECK_ID);
  const strictCheck = checks.find((check) => check.id === STRICT_MARKDOWN_ROUTE_CHECK_ID);
  if (!afDocsCheck && !strictCheck) return undefined;

  const afDocsPercent = afDocsCheck
    ? scorePercent(afDocsCheck.score, afDocsCheck.maxScore)
    : undefined;
  const strictPercent = strictCheck
    ? scorePercent(strictCheck.score, strictCheck.maxScore)
    : undefined;
  const values = [afDocsPercent, strictPercent].filter(
    (value): value is number => typeof value === "number",
  );
  const score = averageScorePercent(values);

  return {
    id: COMBINED_MARKDOWN_ROUTE_CHECK_ID,
    title: ".md routes",
    detail: [
      afDocsCheck
        ? `Published markdown URLs: ${stripAfDocsCategoryPrefix(afDocsCheck.detail)}`
        : undefined,
      strictCheck ? `Same-path .md routes: ${strictCheck.detail}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
    status: statusFromScore(score, 100),
    score,
    maxScore: 100,
    recommendation:
      score >= PASS_SCORE_RATIO * 100
        ? undefined
        : "Serve clean markdown through discoverable .md URLs, preferably matching each docs page route.",
  };
}

function checksForDetails(checks: AgentScoreCheck[]): AgentScoreCheck[] {
  const combined = combinedMarkdownRouteCheck(checks);
  return [
    ...checks.filter(
      (check) =>
        check.id !== AF_DOCS_MARKDOWN_URL_CHECK_ID && check.id !== STRICT_MARKDOWN_ROUTE_CHECK_ID,
    ),
    ...(combined ? [combined] : []),
  ];
}

function groupScorePercent(group: CheckGroup): number {
  if (group.id === "markdown") {
    const combined = group.checks.find((check) => check.id === COMBINED_MARKDOWN_ROUTE_CHECK_ID);
    if (combined) return scorePercent(combined.score, combined.maxScore);

    const afDocsChecks = group.checks.filter((check) => check.id.startsWith("afdocs:"));
    const adjacentChecks = group.checks.filter(
      (check) => check.id === STRICT_MARKDOWN_ROUTE_CHECK_ID,
    );
    const afDocsPercent = averageCheckPercent(afDocsChecks);
    const adjacentPercent = averageCheckPercent(adjacentChecks);
    const values = [afDocsPercent, adjacentPercent].filter(
      (value): value is number => typeof value === "number",
    );
    if (values.length > 0) return averageScorePercent(values);
  }

  const groupScore = group.checks.reduce((total, check) => total + check.score, 0);
  const groupMaxScore = group.checks.reduce((total, check) => total + check.maxScore, 0);
  return scorePercent(groupScore, groupMaxScore);
}

function usesFarmingLabsDocsFramework(
  framework: string | null | undefined,
  checks: AgentScoreCheck[],
): boolean {
  return (
    /@farming-labs\/docs|(^|[/@\s-])farming-labs[/\s-]docs\b/i.test(framework ?? "") ||
    checks.some((check) => check.id === "framework:agent-discovery")
  );
}

function shouldRecommendFarmingLabsDocsUpgrade(
  score: number,
  framework: string | null | undefined,
  checks: AgentScoreCheck[],
): boolean {
  return score < 90 && usesFarmingLabsDocsFramework(framework, checks);
}

function withFarmingLabsDocsUpgradeRecommendation(
  score: number,
  framework: string | null | undefined,
  checks: AgentScoreCheck[],
  recommendations: string[],
): string[] {
  if (!shouldRecommendFarmingLabsDocsUpgrade(score, framework, checks)) return recommendations;
  return Array.from(new Set([FARMING_LABS_DOCS_UPGRADE_RECOMMENDATION, ...recommendations]));
}

function formatImprovementsClipboardText(report: AgentScoreReport): string {
  const lines: string[] = [];
  lines.push(`Docs: ${report.baseUrl}`);
  lines.push(`Agent readiness: ${report.score}/100 — ${report.grade}`);
  lines.push("");

  const weak = report.checks.filter((c) => displayStatusForCheck(c) !== "pass");
  if (weak.length === 0) {
    lines.push("Hosted checks all passed on this run.");
    return lines.join("\n");
  }

  const target = scoreTargetForPrompt(report);
  lines.push("Implementation prompt:");
  lines.push(
    `Improve this docs site for agent readiness. Target at least ${target}/100 on the hosted scorer, then rerun the score and update the leaderboard entry.`,
  );
  lines.push("");
  const usesFarmingLabsDocs = usesFarmingLabsDocsFramework(report.framework, report.checks);
  const shouldUpgradeFarmingLabsDocs = shouldRecommendFarmingLabsDocsUpgrade(
    report.score,
    report.framework,
    report.checks,
  );
  lines.push("Use @farming-labs/docs as the source of truth:");
  if (shouldUpgradeFarmingLabsDocs) {
    lines.push("- Upgrade packages first: https://docs.farming-labs.dev/docs/cli#upgrade");
  }
  lines.push(
    "- Follow the agent-friendly guide: https://docs.farming-labs.dev/docs/guides/agent-friendly-docs",
  );
  lines.push("- Validate with doctor: https://docs.farming-labs.dev/docs/cli#doctor");
  lines.push("- Configure discovery surfaces: https://docs.farming-labs.dev/docs/configuration");
  lines.push("- MCP setup: https://docs.farming-labs.dev/docs/customization/mcp");
  lines.push("");
  lines.push("Start from the project root:");
  lines.push("```bash");
  if (shouldUpgradeFarmingLabsDocs) {
    lines.push("npx @farming-labs/docs upgrade --latest");
  }
  if (usesFarmingLabsDocs) {
    lines.push(`pnpm exec docs doctor --agent --url ${report.baseUrl} --json`);
  } else {
    lines.push(`npx afdocs check ${report.baseUrl}`);
  }
  lines.push("```");
  lines.push("");
  lines.push(
    "Do not call this done until the hosted score reaches the target or every remaining blocker is documented with the exact failing check.",
  );
  lines.push("");

  lines.push("Checks that still need attention:");
  for (const c of weak) {
    const note = (c.recommendation ?? c.detail).trim();
    lines.push(`• ${c.title} (${statusLabel(displayStatusForCheck(c))})`);
    if (note) {
      lines.push(`  ${note}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push("");
    lines.push("Suggested next steps:");
    for (const r of report.recommendations) {
      lines.push(`• ${r}`);
    }
  }

  return lines.join("\n");
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fallback below */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function shortenUrl(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "");
    const path = url.pathname.replace(/\/+$/, "");
    return path && path !== "" ? `${host}${path}` : host;
  } catch {
    return value;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function checksFromLeaderboardEntry(entry: LeaderboardEntry): AgentScoreCheck[] {
  if (!Array.isArray(entry.checks)) return [];
  return entry.checks
    .filter(
      (check): check is AgentScoreCheck =>
        typeof check?.id === "string" &&
        typeof check.title === "string" &&
        typeof check.detail === "string" &&
        typeof check.score === "number" &&
        typeof check.maxScore === "number",
    )
    .map((check) => ({
      ...check,
      status: statusFromScore(check.score, check.maxScore),
    }));
}

function recommendationsFromLeaderboardEntry(
  entry: LeaderboardEntry,
  checks: AgentScoreCheck[],
): string[] {
  if (Array.isArray(entry.recommendations)) {
    return withFarmingLabsDocsUpgradeRecommendation(
      entry.score,
      entry.framework,
      checks,
      entry.recommendations.filter((item): item is string => typeof item === "string"),
    );
  }

  const recommendations = Array.from(
    new Set(
      checks
        .filter((check) => displayStatusForCheck(check) !== "pass")
        .map((check) => check.recommendation)
        .filter((item): item is string => Boolean(item)),
    ),
  );
  return withFarmingLabsDocsUpgradeRecommendation(
    entry.score,
    entry.framework,
    checks,
    recommendations,
  );
}

function reportFromLeaderboardEntry(entry: LeaderboardEntry): AgentScoreReport {
  const checks = checksFromLeaderboardEntry(entry);
  const rawScore = checks.reduce((total, check) => total + check.score, 0);
  const rawMaxScore = checks.reduce((total, check) => total + check.maxScore, 0);
  const summary = checks.reduce(
    (counts, check) => {
      counts[displayStatusForCheck(check)] += 1;
      return counts;
    },
    { pass: 0, warn: 0, fail: 0 } satisfies Record<ScoreStatus, number>,
  );

  return {
    url: entry.url,
    baseUrl: entry.url,
    name: entry.name,
    framework: entry.framework ?? undefined,
    score: entry.score,
    maxScore: 100,
    rawScore: rawMaxScore > 0 ? rawScore : entry.score,
    rawMaxScore: rawMaxScore > 0 ? rawMaxScore : 100,
    grade: entry.grade,
    standard: {
      score: entry.score,
      grade: entry.grade,
      pass: summary.pass,
      warn: summary.warn,
      fail: summary.fail,
      skip: 0,
      categories: [],
      diagnostics: [],
    },
    checks,
    recommendations: recommendationsFromLeaderboardEntry(entry, checks),
    generatedAt: entry.updatedAt,
  };
}

function readCurrentScoreParams(): { selectedSite: string | null; inputUrl: string | null } {
  if (typeof window === "undefined") return { selectedSite: null, inputUrl: null };
  const params = new URL(window.location.href).searchParams;
  return {
    selectedSite: params.get(SELECTED_SITE_PARAM),
    inputUrl: params.get(SCORE_INPUT_PARAM),
  };
}

function writeScoreUrl(
  value: string,
  options: { source: "leaderboard" | "input"; mode?: "push" | "replace" },
): void {
  if (typeof window === "undefined") return;

  const next = new URL(window.location.href);
  const cleanValue =
    options.source === "leaderboard"
      ? (deriveLeaderboardSiteDomain(value) ?? cleanScoreUrlValue(value))
      : cleanScoreUrlValue(value);
  const activeParam = options.source === "leaderboard" ? SELECTED_SITE_PARAM : SCORE_INPUT_PARAM;

  next.pathname = SCORE_PAGE_ROUTE;
  next.search = cleanValue ? `?${activeParam}=${cleanValue}` : "";
  next.hash = "";

  const state = { agentScoreUrl: cleanValue, agentScoreSource: options.source };
  const href = `${next.pathname}${next.search}`;

  if (options.mode === "replace") {
    window.history.replaceState(state, "", href);
    return;
  }

  window.history.pushState(state, "", href);
}

function replaceCleanScoreUrl(value: string, options: { source: "leaderboard" | "input" }): void {
  writeScoreUrl(value, { ...options, mode: "replace" });
}

export function AgentScorePage() {
  const [url, setUrl] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardNotConfigured, setLeaderboardNotConfigured] = useState(false);
  const [locationVersion, setLocationVersion] = useState(0);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const leaderboardRef = useRef<HTMLElement | null>(null);
  const hydratedSelectionRef = useRef<string | null>(null);
  const autoScoredInputRef = useRef<string | null>(null);

  const scrollToResults = useCallback(() => {
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const scrollToLeaderboard = useCallback(() => {
    leaderboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch("/api/agent-score/leaderboard?limit=100", {
        cache: "no-store",
      });
      const data = await readApiJson<{
        entries?: LeaderboardEntry[];
        notConfigured?: boolean;
      }>(response);
      setLeaderboardNotConfigured(Boolean(data.notConfigured));
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      setEntries([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const calculateScore = useCallback(
    async (
      target: string,
      options: { historyMode?: "push" | "replace" | "none"; scroll?: boolean } = {},
    ) => {
      const trimmed = target.trim();
      if (!trimmed) return;

      setSubmitState({ status: "idle" });
      setFetchState({ status: "loading" });

      try {
        const response = await fetch("/api/agent-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await readApiJson<Partial<AgentScoreReport>>(response);
        if (!response.ok) {
          setFetchState({
            status: "error",
            message: data.error ?? "Failed to score the URL. Make sure it is publicly reachable.",
          });
          return;
        }

        if (
          typeof data.baseUrl !== "string" ||
          typeof data.score !== "number" ||
          !Array.isArray(data.checks)
        ) {
          setFetchState({
            status: "error",
            message: data.error ?? "The scorer returned an unexpected response.",
          });
          return;
        }

        const report = data as AgentScoreReport;
        setFetchState({ status: "success", report });
        hydratedSelectionRef.current = null;

        if (options.historyMode !== "none") {
          writeScoreUrl(report.baseUrl, {
            source: "input",
            ...(options.historyMode === "replace" ? { mode: "replace" as const } : {}),
          });
        }

        if (options.scroll !== false) {
          scrollToResults();
        }
      } catch (error) {
        setFetchState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Request failed before reaching the scorer.",
        });
      }
    },
    [scrollToResults],
  );

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const { selectedSite, inputUrl } = readCurrentScoreParams();
    if (inputUrl) {
      setUrl(inputUrl);
      replaceCleanScoreUrl(inputUrl, { source: "input" });
    } else if (!selectedSite && window.location.pathname !== SCORE_PAGE_ROUTE) {
      window.history.replaceState({}, "", SCORE_PAGE_ROUTE);
    }

    function handlePopState(): void {
      hydratedSelectionRef.current = null;
      setLocationVersion((version) => version + 1);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const { selectedSite, inputUrl } = readCurrentScoreParams();
    if (!inputUrl || selectedSite) return;

    const cleanInput = cleanScoreUrlValue(inputUrl);
    if (!cleanInput) return;
    if (leaderboardLoading) return;

    const savedEntry = findLeaderboardEntryBySelection(entries, inputUrl);
    if (savedEntry) {
      const cleanEntryUrl = cleanScoreUrlValue(savedEntry.url);
      const currentClean =
        fetchState.status === "success" ? cleanScoreUrlValue(fetchState.report.baseUrl) : "";
      if (currentClean === cleanEntryUrl) {
        autoScoredInputRef.current = cleanInput;
        hydratedSelectionRef.current = cleanEntryUrl;
        setUrl(savedEntry.url);
        replaceCleanScoreUrl(savedEntry.url, { source: "leaderboard" });
        scrollToResults();
        return;
      }

      autoScoredInputRef.current = cleanInput;
      hydratedSelectionRef.current = cleanEntryUrl;
      setUrl(savedEntry.url);
      setSubmitState({ status: "idle" });
      setFetchState({ status: "success", report: reportFromLeaderboardEntry(savedEntry) });
      replaceCleanScoreUrl(savedEntry.url, { source: "leaderboard" });
      scrollToResults();
      return;
    }

    const currentClean =
      fetchState.status === "success" ? cleanScoreUrlValue(fetchState.report.baseUrl) : "";
    if (currentClean === cleanInput) {
      autoScoredInputRef.current = cleanInput;
      return;
    }
    if (fetchState.status === "loading" && autoScoredInputRef.current === cleanInput) return;

    autoScoredInputRef.current = cleanInput;
    setUrl(inputUrl);
    void calculateScore(inputUrl, { historyMode: "replace", scroll: false });
  }, [calculateScore, entries, fetchState, leaderboardLoading, locationVersion, scrollToResults]);

  useEffect(() => {
    if (leaderboardLoading || entries.length === 0) return;

    const { selectedSite, inputUrl } = readCurrentScoreParams();
    if (inputUrl && !selectedSite && fetchState.status === "idle") {
      setUrl(inputUrl);
    }
    if (!selectedSite || hydratedSelectionRef.current === selectedSite) return;

    const entry = findLeaderboardEntryBySelection(entries, selectedSite);
    if (!entry) {
      setUrl(selectedSite);
      return;
    }

    hydratedSelectionRef.current = cleanScoreUrlValue(entry.url);
    setUrl(entry.url);
    setSubmitState({ status: "idle" });
    setFetchState({ status: "success", report: reportFromLeaderboardEntry(entry) });
    replaceCleanScoreUrl(entry.url, { source: "leaderboard" });
    scrollToResults();
  }, [entries, fetchState.status, leaderboardLoading, locationVersion, scrollToResults]);

  async function handleCalculate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await calculateScore(url);
  }

  async function submitLeaderboardEntry(): Promise<void> {
    if (fetchState.status !== "success") return;

    setSubmitState({ status: "loading" });

    try {
      const response = await fetch("/api/agent-score/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: fetchState.report.baseUrl,
        }),
      });
      const data = await readApiJson<{
        error?: string;
        warning?: string;
        stored?: boolean;
        action?: "created" | "updated";
        previousScore?: number;
        report?: AgentScoreReport;
      }>(response);

      if (!response.ok) {
        setSubmitState({
          status: "error",
          message: data.error ?? "Failed to submit. Please try again.",
        });
        return;
      }

      if (data.report) {
        setFetchState({ status: "success", report: data.report });
      }

      if (data.stored === false) {
        setSubmitState({
          status: "warning",
          message: data.warning ?? "Score received but not stored.",
        });
        return;
      }

      setSubmitState({
        status: "success",
        message:
          data.action === "updated"
            ? data.previousScore !== undefined
              ? `Leaderboard score updated from ${data.previousScore}/100 to ${data.report?.score ?? fetchState.report.score}/100.`
              : "Leaderboard score updated."
            : "Submitted to the leaderboard.",
      });
      loadLeaderboard();
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Request failed before reaching the leaderboard.",
      });
    }
  }

  function showLeaderboardEntry(entry: LeaderboardEntry): void {
    hydratedSelectionRef.current = cleanScoreUrlValue(entry.url);
    setUrl(entry.url);
    setSubmitState({ status: "idle" });
    setFetchState({ status: "success", report: reportFromLeaderboardEntry(entry) });
    writeScoreUrl(entry.url, { source: "leaderboard" });
    scrollToResults();
  }

  const currentReport = fetchState.status === "success" ? fetchState.report : null;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-white text-black dark:bg-black dark:text-white">
      <div className="pointer-events-none fixed inset-0 z-[1] hidden lg:block">
        <div className="mx-auto h-full max-w-[90%]">
          <div className="relative h-full">
            <div className="absolute inset-y-0 left-0 w-px bg-black/10 dark:bg-white/8" />
            <div className="absolute inset-y-0 right-0 w-px bg-black/10 dark:bg-white/8" />
          </div>
        </div>
      </div>
      <div className="absolute left-0 right-0 top-14 z-[1] h-px bg-black/10 dark:bg-white/8" />

      <header className="relative z-10 px-0 md:px-6 py-0">
        <div className="mx-auto flex max-w-[90%] items-center justify-between">
          <div className="flex items-center gap-2 pb-8 pt-5 text-xs font-medium uppercase text-black/65 dark:text-white/80 md:pb-0">
            <Link
              href="/"
              className="font-mono text-black/45 transition-colors hover:text-black hover:no-underline dark:text-white/45 dark:hover:text-white"
            >
              Home <span className="ml-2 text-black/25 dark:text-white/25">/</span>
            </Link>
            <Activity className="size-3.5" strokeWidth={1.8} />
            <p className="font-mono uppercase tracking-[0.22em]">Agent Score</p>
          </div>

          <Link
            href="https://github.com/farming-labs/docs"
            className="group mt-6 hidden font-mono text-[11px] uppercase tracking-[0.2em] text-black/35 transition-colors hover:text-black hover:no-underline dark:text-white/35 dark:hover:text-white md:inline-flex md:items-center md:gap-1.5"
          >
            <GithubIcon className="size-3" /> / GitHub
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[92%] space-y-16 pb-20 pt-4 sm:max-w-[90%] sm:space-y-20 sm:pt-6 md:px-0 md:pt-14">
        <HeroSection
          url={url}
          onUrlChange={setUrl}
          onSubmit={handleCalculate}
          onLeaderboardClick={scrollToLeaderboard}
          loading={fetchState.status === "loading"}
        />

        {fetchState.status === "error" ? (
          <section>
            <div className="border border-red-500/30 bg-red-500/5 px-5 py-4 font-mono text-[12px] uppercase tracking-[0.16em] text-red-600 dark:text-red-400">
              {fetchState.message}
            </div>
          </section>
        ) : null}

        {currentReport ? (
          <section id={SCORE_SECTION_ID} ref={resultsRef} className="relative space-y-6">
            <ScoreOverview
              report={currentReport}
              submitBusy={submitState.status === "loading"}
              onSubmitLeaderboard={() => void submitLeaderboardEntry()}
            />

            <ChecksBreakdown checks={currentReport.checks} />

            {currentReport.recommendations.length > 0 ? (
              <Recommendations items={currentReport.recommendations} />
            ) : null}

            {submitState.status === "error" ? (
              <div className="border border-red-500/30 bg-red-500/5 px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-red-600 dark:text-red-400">
                {submitState.message}
              </div>
            ) : null}
            {submitState.status === "warning" ? (
              <div className="border border-amber-500/30 bg-amber-500/5 px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                {submitState.message}
              </div>
            ) : null}

            {submitState.status === "success" ? (
              <div className="border border-black/15 bg-black/2 px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-black/75 dark:border-white/15 dark:bg-white/3 dark:text-white/75">
                {submitState.message}
              </div>
            ) : null}
          </section>
        ) : null}

        <LeaderboardSection
          sectionRef={leaderboardRef}
          entries={entries}
          loading={leaderboardLoading}
          notConfigured={leaderboardNotConfigured}
          onSelectEntry={showLeaderboardEntry}
        />

        <CtaSection />
      </main>

      <FooterSection />
    </div>
  );
}

function SpiralLoadingIcon({ className }: { className?: string }) {
  const dots = [
    [6, 6],
    [17, 6],
    [28, 6],
    [39, 6],
    [50, 6],
    [6, 17],
    [17, 17],
    [28, 17],
    [39, 17],
    [50, 17],
    [6, 28],
    [17, 28],
    [28, 28],
    [39, 28],
    [50, 28],
    [6, 39],
    [17, 39],
    [28, 39],
    [39, 39],
    [50, 39],
    [6, 50],
    [17, 50],
    [28, 50],
    [39, 50],
    [50, 50],
  ] as const;
  const delays = [
    2221, 2317, 869, 966, 1062, 2124, 772, 97, 193, 1159, 2028, 676, 0, 290, 1255, 1931, 579, 483,
    386, 1352, 1834, 1738, 1641, 1545, 1448,
  ] as const;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <circle id="agent-score-spiral-base" r="2.4" fill="currentColor" opacity="0.12" />
        <circle id="agent-score-spiral-light" r="3.1" />
      </defs>
      <style>{`
        .agent-score-spiral-light {
          fill: currentColor;
          opacity: 0;
          animation: agent-score-spiral 2800ms cubic-bezier(0.25, 1, 0.5, 1) infinite both;
        }
        @keyframes agent-score-spiral {
          0% { opacity: 0; }
          4% { opacity: 1; }
          26% { opacity: 0.08; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .agent-score-spiral-light { animation: none; opacity: 0.45; }
        }
      `}</style>
      {dots.map(([x, y]) => (
        <use key={`base-${x}-${y}`} href="#agent-score-spiral-base" x={x} y={y} />
      ))}
      {dots.map(([x, y], index) => (
        <use
          key={`light-${x}-${y}`}
          className="agent-score-spiral-light"
          href="#agent-score-spiral-light"
          x={x}
          y={y}
          style={{ animationDelay: `${delays[index]}ms` }}
        />
      ))}
    </svg>
  );
}

function HeroSection({
  url,
  onUrlChange,
  onSubmit,
  onLeaderboardClick,
  loading,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onLeaderboardClick: () => void;
  loading: boolean;
}) {
  const [activeLoadingStep, setActiveLoadingStep] = useState(0);
  const loadingLabel = SCORE_LOADING_STEPS[activeLoadingStep] ?? SCORE_LOADING_STEPS[0];

  useEffect(() => {
    if (!loading) {
      setActiveLoadingStep(0);
      return;
    }

    setActiveLoadingStep(0);
    const interval = window.setInterval(() => {
      setActiveLoadingStep((current) => Math.min(current + 1, SCORE_LOADING_STEPS.length - 1));
    }, 1150);

    return () => window.clearInterval(interval);
  }, [loading]);

  return (
    <section className="relative grid gap-10 pb-10 lg:grid-cols-[minmax(0,6fr)_minmax(360px,3fr)] lg:items-stretch lg:gap-0 lg:pb-0">
      <div className="pointer-events-none absolute bottom-0 left-[calc(50%-50vw)] right-[calc(50%-50vw)] h-px bg-black/10 dark:bg-white/10" />
      <div className="relative min-w-0 overflow-hidden lg:flex">
        <div className="pointer-events-none absolute -top-6 bottom-0 left-0 z-20 hidden w-px bg-black/10 dark:bg-white/5 sm:block md:-top-24" />
        <div className="absolute inset-0 hidden overflow-hidden opacity-45 sm:block" aria-hidden>
          <AnimatedBackground />
        </div>

        <div className="relative z-10 flex max-w-3xl flex-col pt-1 sm:pt-0 lg:min-h-full lg:justify-end">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
            Agent readiness score
          </p>

          <h1 className="max-w-[14ch] font-semibold leading-[0.96] tracking-[-0.06em] text-black dark:text-white text-[2.15rem] sm:max-w-5xl sm:leading-none sm:tracking-[-0.05em] sm:text-5xl lg:text-6xl">
            How agent-ready is your docs site?
          </h1>

          <p className="mt-3 max-w-[34rem] text-[15px] leading-6 text-black/55 dark:text-white/45 sm:mt-6 sm:text-lg sm:leading-relaxed">
            The same checks the{" "}
            <code className="font-mono text-black/70 dark:text-white/70">
              docs doctor --agent --url
            </code>{" "}
            CLI runs, in one click. We probe discovery, llms.txt, sitemap, robots, AGENTS.md,
            skill.md, .md routes, and MCP, then give you a score and a breakdown.
          </p>

          <div className="mt-6 flex font-pixel flex-wrap gap-1.5 sm:gap-2">
            {[
              "Discovery",
              "llms.txt",
              "Sitemap",
              "Robots",
              "AGENTS.md",
              "Skill",
              "Markdown",
              "MCP",
            ].map((signal) => (
              <span
                key={signal}
                className="inline-flex items-center border border-black/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-black/45 dark:border-white/10 dark:text-white/45 sm:px-2.5 sm:text-[10px] sm:tracking-[0.2em]"
              >
                {signal}
              </span>
            ))}
          </div>

          <div className="-mb-px mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Link
              href="/docs/cli"
              className="group inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-white transition-all hover:bg-black/90 hover:no-underline dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90 sm:w-auto"
            >
              Read CLI docs
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={onLeaderboardClick}
              className="group inline-flex mb-[2px] md:border-b-0 w-full items-center justify-center gap-2 border border-black/15 bg-white px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-black transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:bg-black/50 dark:text-white dark:hover:bg-white/[0.05] sm:w-auto"
            >
              <ListOrdered className="size-3.5" aria-hidden />
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      <div className="relative gap-2 lg:flex lg:flex-col lg:self-stretch">
        <PixelCard className="w-full shrink-0 border-b border-t border-black/10 bg-white/95 p-0 sm:border-b-0 sm:border-t-0 sm:pt-14 lg:-mt-[39px] dark:border-white/10 dark:bg-black/40">
          <div className="border-b border-black/10 px-5 py-3 dark:border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-wide text-black/45 dark:text-white/45">
              Calculate the score
            </p>
            <h2 className="mt-2 text-xl font-normal font-pixel tracking-normal text-black dark:text-white">
              Drop in any docs URL.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-black/55 dark:text-white/45">
              We hit the public endpoints in your browser&apos;s name. Nothing is stored unless you
              submit it.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 p-5">
            <div>
              <label
                htmlFor="agent-score-url"
                className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
              >
                Docs URL
              </label>
              <div className="flex">
                <div className="flex items-center border border-r-0 border-black/10 bg-black/[0.02] px-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                  <Search className="size-3.5 text-black/35 dark:text-white/35" />
                </div>
                <input
                  id="agent-score-url"
                  type="text"
                  inputMode="url"
                  required
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  placeholder="docs.example.com or example.com/docs"
                  className="w-full min-w-0 rounded-none border border-black/10 bg-transparent px-3 py-2 font-mono text-sm text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/35 dark:text-white/35">
                try
              </span>
              {EXAMPLE_URLS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => onUrlChange(example)}
                  className="border border-black/10 bg-black/[0.02] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-black/55 transition-colors hover:border-black/25 hover:text-black dark:border-white/10 dark:bg-white/[0.02] dark:text-white/55 dark:hover:border-white/25 dark:hover:text-white"
                >
                  {shortenUrl(example)}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? loadingLabel : "Calculate score"}
              className="group inline-flex min-h-11 w-full items-center justify-between gap-3 border border-black bg-black px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              <span aria-live="polite" className="min-w-0 truncate text-left">
                {loading ? loadingLabel : "Calculate score"}
              </span>
              <span className="inline-flex size-5 shrink-0 items-center justify-center" aria-hidden>
                {loading ? (
                  <SpiralLoadingIcon className="size-4 shrink-0" />
                ) : (
                  <Gauge className="size-3.5 transition-transform duration-300 group-hover:rotate-12" />
                )}
              </span>
            </button>

            <p className="text-[11px] leading-relaxed text-black/45 dark:text-white/40">
              Equivalent to{" "}
              <code className="font-mono text-black/70 dark:text-white/70">
                docs doctor --agent --url &lt;your-url&gt; --json
              </code>
              .
            </p>
          </form>
        </PixelCard>

        <div
          aria-hidden
          className="hidden -mt-2 border-x border-black/5 lg:flex lg:min-h-0 lg:flex-1 lg:items-center dark:border-white/5"
        >
          <div className="-mx-px w-[calc(100%+2px)]">
            <hr className="h-px w-full border-black/5 dark:border-white/5" />
            <div className="relative border border-l z-20 h-10 w-full bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.45),rgba(0,0,0,0.45)_1px,transparent_1px,transparent_6px)] opacity-[0.08] dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_1px,transparent_1px,transparent_6px)] dark:opacity-[0.1]" />
            <hr className="h-px w-full border-black/5 dark:border-white/5" />
          </div>
        </div>
      </div>
    </section>
  );
}

function BreakdownImprovementStrip({
  report,
  itemCount,
}: {
  report: AgentScoreReport;
  itemCount: number;
}) {
  const payload = useMemo(() => formatImprovementsClipboardText(report), [report]);
  const [copied, setCopied] = useState(false);

  const smCols = 3;
  const remainderSm = itemCount % smCols;
  const spanSm = remainderSm === 0 ? smCols : smCols - remainderSm;

  const smColSpanClass =
    spanSm >= 3 ? "sm:col-span-3" : spanSm === 2 ? "sm:col-span-2" : "sm:col-span-1";

  return (
    <div
      className={cn(
        "col-span-1 flex h-full flex-col justify-end gap-3 bg-white px-3 py-3 dark:bg-black sm:min-h-0 sm:justify-between sm:px-4 sm:py-2",
        smColSpanClass,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-black/55 dark:text-white/55">
          Improvement Instructions
        </p>
      </div>
      <div className="w-full flex justify-end items-end">
        <button
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(payload);
            if (ok) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2200);
            }
          }}
          aria-label={
            copied
              ? "Improvements copied to clipboard"
              : "Copy improvement notes for docs backlog to clipboard"
          }
          className="inline-flex shrink-0 w-[200px] items-center justify-center gap-2 border border-black/15 bg-black/2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black transition-colors hover:bg-black/5 dark:border-white/15 dark:bg-white/3 dark:text-white dark:hover:bg-white/6 sm:px-4 sm:py-2.5"
        >
          {copied ? (
            <Check className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Copy className="size-3.5 shrink-0" aria-hidden />
          )}
          {copied ? "Copied" : "Copy improvements"}
        </button>
      </div>
    </div>
  );
}

function ScoreOverview({
  report,
  submitBusy,
  onSubmitLeaderboard,
}: {
  report: AgentScoreReport;
  submitBusy: boolean;
  onSubmitLeaderboard: () => void;
}) {
  const breakdownItems = useMemo(() => buildPrimaryBreakdownItems(report), [report]);

  return (
    <PixelCard className="border-black/10 p-0 bg-white/95 dark:border-white/10 dark:bg-black/35">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-stretch lg:gap-0">
        <div className="flex flex-col p-6 justify-between gap-5 border-b border-black/10 pb-5 dark:border-white/10 lg:border-b-0 lg:pr-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
              Score
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-6xl font-semibold tracking-[-0.06em] text-black dark:text-white sm:text-7xl">
                {report.score}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-black/35 dark:text-white/35">
                / 100
              </span>
            </div>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.24em] text-black/65 dark:text-white/65">
              {report.grade}
            </p>
          </div>

          <div className="space-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black/50 dark:text-white/50">
            <div className="flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
              <span className="text-black/40 dark:text-white/40">Target</span>
              <a
                href={report.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[60%] truncate text-right text-black hover:underline dark:text-white"
              >
                {report.baseUrl.replace(/^https?:\/\//, "")}
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-black/40 dark:text-white/40">Result</span>
              <span className="text-black dark:text-white">{report.score} / 100%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-black/40 dark:text-white/40">Generated</span>
              <span className="text-black dark:text-white">{formatDate(report.generatedAt)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSubmitLeaderboard}
            disabled={submitBusy}
            aria-label={submitBusy ? "Submitting score" : "Submit to leaderboard"}
            className="group inline-flex min-h-10 w-full items-center justify-between gap-3 border border-black bg-black px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            <span aria-live="polite" className="min-w-0 truncate text-left">
              {submitBusy ? "Submitting score" : "Submit to leaderboard"}
            </span>
            <span className="inline-flex size-5 shrink-0 items-center justify-center" aria-hidden>
              {submitBusy ? (
                <SpiralLoadingIcon className="size-4 shrink-0" />
              ) : (
                <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              )}
            </span>
          </button>
        </div>

        <div className="min-w-0 px-0 py-0 border-t border-black/10 pt-0 dark:border-white/10 lg:flex lg:flex-col lg:border-l lg:border-black/10 lg:border-t-0 lg:pl-0 lg:pt-0 lg:dark:border-white/10">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-black/10 dark:bg-white/10 sm:grid-cols-3">
            {breakdownItems.map((item) => (
              <ScoreCheckCard key={item.id} item={item} />
            ))}
            <BreakdownImprovementStrip report={report} itemCount={breakdownItems.length} />
          </div>
        </div>
      </div>
    </PixelCard>
  );
}

function ScoreCheckCard({ item }: { item: BreakdownItem }) {
  const percent = scorePercent(item.score, item.maxScore);

  return (
    <div className="relative flex min-h-[5rem] flex-col gap-1.5 bg-white px-3 py-2.5 dark:bg-black sm:min-h-0 sm:px-2.5 sm:py-2">
      <div className="flex items-center justify-between gap-2">
        <p
          title={item.detail}
          className="min-w-0 truncate font-mono text-[9.5px] uppercase tracking-wide text-black/55 dark:text-white/55"
        >
          # {item.title}
        </p>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] tabular-nums text-black/60 dark:text-white/60">
          {statusLabel(item.status)}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mt-4">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums tracking-[-0.03em] text-black dark:text-white">
            {percent}%
          </span>
          <span className="font-mono text-[10px] tabular-nums tracking-[0.16em] text-black/35 dark:text-white/35">
            /100%
          </span>
        </div>
      </div>

      <div className="relative mt-auto h-px w-full bg-black/10 dark:bg-white/10" aria-hidden>
        <span
          className="absolute inset-y-0 left-0 bg-black dark:bg-white"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ChecksBreakdown({ checks }: { checks: AgentScoreCheck[] }) {
  const groups = useMemo(() => groupChecksForDetails(checks), [checks]);

  return (
    <div className="border border-black/10 dark:border-white/10">
      <div className="border-b border-black/10 px-5 py-3 dark:border-white/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
          Per-check details
        </p>
        <h2 className="mt-1 text-xl font-normal font-pixel tracking-normal text-black dark:text-white">
          All probes, grouped by breakdown.
        </h2>
      </div>

      <details className="group border-b border-black/10 dark:border-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-left marker:hidden">
          <span className="inline-flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
            <CircleHelp className="size-3.5 shrink-0" aria-hidden />
            What do these checks mean?
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-black/35 transition-transform group-open:rotate-90 dark:text-white/35"
            aria-hidden
          />
        </summary>
        <div className="grid gap-px bg-black/10 dark:bg-white/10 sm:grid-cols-2 lg:grid-cols-4 border-t border-black/10 dark:border-white/[0.02]">
          {BREAKDOWN_HELP_ITEMS.map((item) => (
            <div key={item.title} className="bg-white px-4 py-3 dark:bg-black">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/65 dark:text-white/65">
                {item.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-black/55 dark:text-white/45">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </details>

      <div
        className="hidden border-b border-l-2 border-l-transparent border-black/10 px-5 py-2 sm:grid sm:grid-cols-[88px_minmax(180px,1.2fr)_minmax(0,3fr)] sm:gap-x-8 dark:border-white/10"
        aria-hidden
      >
        {["Status", "Check", "Detail"].map((label) => (
          <span
            key={label}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-black/35 dark:text-white/35"
          >
            {label}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {groups.map((group) => {
          const groupPercent = groupScorePercent(group);
          const groupStatus = statusFromScore(groupPercent, 100);
          const groupCallout = groupCalloutForId(group.id);

          return (
            <li key={group.id}>
              <div className="grid gap-y-2 border-l-2 border-l-transparent bg-black/[0.025] px-5 py-3 dark:bg-white/[0.025] sm:grid-cols-[88px_minmax(180px,1.2fr)_minmax(0,3fr)] sm:items-center sm:gap-x-8">
                <span
                  className={cn(
                    "inline-flex w-fit items-center justify-center border bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums dark:bg-black",
                    groupStatus === "pass" &&
                      "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70",
                    groupStatus === "warn" &&
                      "border-orange-500/60 text-orange-600 dark:border-orange-400/60 dark:text-orange-400",
                    groupStatus === "fail" &&
                      "border-red-500/60 text-red-600 dark:border-red-400/60 dark:text-red-400",
                  )}
                >
                  {statusLabel(groupStatus)}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] uppercase leading-snug tracking-[0.2em] text-black/80 dark:text-white/80">
                    {group.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums text-black/35 dark:text-white/35">
                    {groupPercent}% / 100%
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-black/55 dark:text-white/45">
                  {group.checks.length} check{group.checks.length === 1 ? "" : "s"} in this section.
                </p>
              </div>

              {groupCallout ? (
                <div className="border-l-2 border-l-black/20 bg-black/[0.015] px-5 py-3 text-sm leading-relaxed text-black/55 dark:border-l-white/20 dark:bg-white/[0.015] dark:text-white/45">
                  {groupCallout}
                </div>
              ) : null}

              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {group.checks.map((check) => {
                  const status = displayStatusForCheck(check);

                  return (
                    <li
                      key={check.id}
                      className={cn(
                        "relative grid gap-y-2 border-l-2 border-l-transparent px-5 py-4 sm:grid-cols-[88px_minmax(180px,1.2fr)_minmax(0,3fr)] sm:items-start sm:gap-x-8",
                        status === "warn" && "border-l-orange-500 dark:border-l-orange-400",
                        status === "fail" && "border-l-red-500 dark:border-l-red-400",
                      )}
                    >
                      <div className="flex items-start sm:items-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center border bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums dark:bg-black",
                            status === "pass" &&
                              "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70",
                            status === "warn" &&
                              "border-orange-500/60 text-orange-600 dark:border-orange-400/60 dark:text-orange-400",
                            status === "fail" &&
                              "border-red-500/60 text-red-600 dark:border-red-400/60 dark:text-red-400",
                          )}
                        >
                          {statusLabel(status)}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 sm:gap-1.5">
                        <span className="font-mono text-[11px] uppercase leading-snug tracking-[0.2em] text-black/80 dark:text-white/80">
                          {check.title}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums text-black/35 dark:text-white/35">
                          {scorePercent(check.score, check.maxScore)}% / 100%
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <p className="text-sm leading-relaxed text-black/65 dark:text-white/55">
                          {check.detail}
                        </p>
                        {check.recommendation ? (
                          <p className="inline-flex items-start gap-1.5 text-[12px] leading-snug text-black/45 dark:text-white/40">
                            <ChevronRight className="mt-0.5 size-3 shrink-0 text-black/35 dark:text-white/35" />
                            {check.recommendation}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Recommendations({ items }: { items: string[] }) {
  return (
    <div className="border border-black/10 bg-black/[0.02] px-4 py-4 dark:border-white/10 dark:bg-white/[0.02]">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
        Next steps
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm leading-relaxed text-black/65 dark:text-white/55"
          >
            <ChevronRight className="mt-1 size-3.5 shrink-0 text-black/45 dark:text-white/45" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeaderboardSection({
  sectionRef,
  entries,
  loading,
  notConfigured,
  onSelectEntry,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  entries: LeaderboardEntry[];
  loading: boolean;
  notConfigured: boolean;
  onSelectEntry: (entry: LeaderboardEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const ranked = useMemo(() => entries.slice(0, 100), [entries]);
  const filtered = useMemo(
    () => ranked.filter((e) => leaderboardEntryMatchesQuery(e, query)),
    [ranked, query],
  );
  const queryActive = query.trim().length > 0;

  return (
    <section id={LEADERBOARD_SECTION_ID} ref={sectionRef} className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
            Leaderboard
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
            Most agent-ready docs sites.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/55 dark:text-white/45">
            Ranked by verified scores from the hosted probes. Submit yours from the results card
            above.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:max-w-md lg:w-72 lg:max-w-none lg:shrink-0">
          <label htmlFor="leaderboard-search" className="sr-only">
            Search leaderboard by name, site, URL, score, or grade
          </label>
          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-black/35 dark:text-white/35"
              aria-hidden
            />
            <input
              id="leaderboard-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, URL, score…"
              className="w-full border border-black/10 bg-black/2 py-2 pl-9 pr-3 font-mono text-xs text-black outline-none placeholder:text-black/35 focus:border-black/25 dark:border-white/10 dark:bg-white/3 dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/25"
            />
          </div>
        </div>
      </div>
      <div className="h-px bg-black/10 -mt-6 dark:bg-white/10 w-full" />
      {notConfigured ? (
        <div className="border border-black/10 bg-black/[0.02] px-4 py-4 font-mono text-[11px] uppercase tracking-[0.16em] text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
          Leaderboard database is not configured yet. Hosting deploys with{" "}
          <code className="text-black dark:text-white">DATABASE_URL</code> will start collecting
          entries automatically.
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 font-mono text-xs text-black/45 dark:text-white/45">
          <Loader2 className="size-3.5 animate-spin" />
          Loading the leaderboard…
        </div>
      ) : ranked.length === 0 ? (
        <div className="border border-black/10 px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-black/45 dark:border-white/10 dark:text-white/45">
          No entries yet. Calculate your score above and submit to claim the first spot.
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-black/10 px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-black/45 dark:border-white/10 dark:text-white/45">
          No entries match &ldquo;{query.trim()}&rdquo;. Try another URL, site name, or score.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-mono text-[11px] leading-relaxed text-black/45 dark:text-white/45">
            {queryActive ? (
              <>
                Showing{" "}
                <span className="tabular-nums text-black/70 dark:text-white/70">
                  {filtered.length}
                </span>{" "}
                {filtered.length === 1 ? "site" : "sites"}
                {ranked.length > filtered.length ? (
                  <>
                    {" "}
                    <span className="text-black/35 dark:text-white/35">
                      (of <span className="tabular-nums">{ranked.length}</span> total)
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <></>
            )}
          </p>
          <div className="border md:border-l-0 md:border-r-0 border-black/10 dark:border-white/10">
            <table
              className={cn(
                "w-full table-fixed border-collapse",
                leaderboardTableStyles.leaderboardTable,
              )}
            >
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  {(
                    [
                      {
                        label: "Rank",
                        Icon: ListOrdered,
                        align: "left" as const,
                        extra: "w-[3.25rem] sm:w-[4rem]",
                      },
                      {
                        label: "Name",
                        Icon: Type,
                        align: "left" as const,
                        extra: "w-[46%] md:w-[24%]",
                      },
                      {
                        label: "Site",
                        Icon: Globe,
                        align: "left" as const,
                        extra: "hidden w-[26%] md:table-cell",
                      },
                      {
                        label: "URL",
                        Icon: Link2,
                        align: "left" as const,
                        extra: "hidden w-[30%] lg:table-cell",
                      },
                      {
                        label: "Score",
                        Icon: Gauge,
                        align: "right" as const,
                        extra: "w-[5.25rem] whitespace-nowrap px-3 sm:w-[6.5rem] sm:px-5",
                      },
                    ] as const
                  ).map(({ label, Icon, align, extra }) => (
                    <th key={label} scope="col" className={cn("px-4 py-3", extra)}>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45",
                          align === "right" ? "justify-end" : "justify-start",
                        )}
                      >
                        <Icon className="size-3 shrink-0 opacity-80" aria-hidden />
                        <span>{label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_tr:nth-child(even)]:bg-black/[0.025] dark:[&_tr:nth-child(even)]:bg-white/[0.025]">
                {filtered.map((entry) => (
                  <LeaderboardRow
                    key={entry.id}
                    entry={entry}
                    rank={ranked.findIndex((e) => e.id === entry.id) + 1}
                    onSelect={() => onSelectEntry(entry)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function LeaderboardRow({
  entry,
  rank,
  onSelect,
}: {
  entry: LeaderboardEntry;
  rank: number;
  onSelect: () => void;
}) {
  const handleUrlClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    onSelect();
  };
  const displayName = deriveLeaderboardDisplayName(entry);
  const siteDomain = deriveLeaderboardSiteDomain(entry.url) ?? shortenUrl(entry.url);

  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={`Show saved agent score report for ${displayName}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer border-b border-black/10 transition-colors last:border-b-0 hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black/40 dark:border-white/10 dark:hover:bg-white/[0.05] dark:focus-visible:outline-white/40"
    >
      <td className="align-middle px-4 py-3 font-mono text-[12px] uppercase tracking-[0.16em] tabular-nums text-black/70 dark:text-white/70">
        {String(rank).padStart(2, "0")}
      </td>
      <td className="max-w-[14rem] align-middle px-4 py-3">
        <p className="truncate font-mono text-[13px] font-semibold tracking-[0.12em] text-black dark:text-white">
          {displayName}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-black/45 dark:text-white/45">
          <span className="uppercase tracking-[0.14em]">{entry.grade}</span>
        </p>
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleUrlClick}
          className="mt-1 block truncate font-mono text-[10px] text-black/45 underline-offset-2 hover:underline md:hidden dark:text-white/45"
        >
          {shortenUrl(entry.url)}
        </a>
      </td>
      <td className="hidden max-w-[14rem] align-middle px-4 py-3 md:table-cell">
        <p className="truncate font-mono text-[12px] text-black/65 dark:text-white/65">
          {siteDomain}
        </p>
      </td>
      <td className="hidden max-w-[18rem] align-middle px-4 py-3 lg:table-cell">
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleUrlClick}
          className="block truncate font-mono text-[11px] text-black/55 underline-offset-2 hover:underline dark:text-white/55"
        >
          {shortenUrl(entry.url)}
        </a>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-[14px] font-pixel font-semibold tabular-nums tracking-wide text-black/80 sm:px-5 dark:text-white/70">
        {entry.score} / 100
      </td>
    </tr>
  );
}

function CtaSection() {
  return (
    <section>
      <PixelCard
        showTexture={false}
        className="border-black/10 bg-white px-5 py-7 text-black hover:bg-white sm:px-8 sm:py-8 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-black"
      >
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/55">
              Local doctor
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
              Want a deeper, repo-aware audit? Run the CLI.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/60 dark:text-white/70">
              The web scorer probes the public agent surfaces. The local doctor also inspects your
              config, framework wiring, page metadata, agent.md coverage, and compaction freshness.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
            <Link
              href="/docs/cli"
              className="group inline-flex items-center gap-2 border border-black bg-black px-5 py-3 font-mono text-[10px] uppercase tracking-normal text-white transition-all hover:bg-black/90 hover:no-underline dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Read CLI docs
              <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
            </Link>
            <Link
              href="https://github.com/farming-labs/docs"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-normal text-black/55 transition-colors hover:text-black hover:no-underline dark:text-white/65 dark:hover:text-white"
            >
              <Github className="size-3.5" />
              View on GitHub
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </PixelCard>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="relative z-10">
      <div className="absolute bottom-10 left-0 h-px w-full bg-black/[8%] dark:bg-white/[8%]" />
      <div className="absolute bottom-24 left-0 h-px w-full bg-black/[8%] dark:bg-white/[8%]" />
      <div className="mx-auto max-w-[92%] py-12 sm:max-w-[90%]">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-stretch">
          <div className="w-full">
            <span className="font-mono text-xs uppercase tracking-tighter text-black/40 dark:text-white/40">
              <Link
                href="https://github.com/farming-labs/docs"
                target="_blank"
                className="font-mono lowercase text-black/30 transition-colors hover:text-black/50 hover:underline hover:underline-offset-2 hover:decoration-dotted hover:decoration-black/30 hover:no-underline dark:text-white/30 dark:hover:text-white/50 dark:hover:decoration-white/30"
              >
                @farming-labs/docs
              </Link>
            </span>
            <p className="mt-1 font-mono text-[10px] uppercase text-black/30 dark:text-white/30">
              Built by{" "}
              <Link
                href="https://farming-labs.dev"
                target="_blank"
                className="font-mono uppercase text-black/30 underline decoration-black/30 decoration-dotted underline-offset-2 transition-colors hover:text-black/50 hover:no-underline dark:text-white/30 dark:decoration-white/30 dark:hover:text-white/50"
              >
                Farming-Labs
              </Link>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-start gap-3 sm:items-end sm:justify-center">
            <div className="flex w-full max-w-full items-center justify-start gap-6 sm:justify-end">
              <Link
                href="/docs"
                className="font-mono text-xs uppercase text-black/30 transition-colors hover:text-black/60 hover:no-underline dark:text-white/30 dark:hover:text-white/60"
              >
                Documentation
              </Link>
              <Link
                href="https://github.com/farming-labs/docs"
                target="_blank"
                className="font-mono text-xs uppercase text-black/30 transition-colors hover:text-black/60 hover:no-underline dark:text-white/30 dark:hover:text-white/60"
              >
                GitHub
              </Link>
              <Link
                href="https://www.npmjs.com/package/@farming-labs/docs"
                target="_blank"
                className="font-mono text-xs uppercase text-black/30 transition-colors hover:text-black/60 hover:no-underline dark:text-white/30 dark:hover:text-white/60"
              >
                npm
              </Link>
            </div>
          </div>
          <div className="relative hidden sm:flex sm:items-center sm:pl-4 sm:pr-3">
            <span
              aria-hidden
              className="absolute -inset-y-2 left-0 w-px bg-black/10 dark:bg-white/10"
            />
            <SidebarThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}

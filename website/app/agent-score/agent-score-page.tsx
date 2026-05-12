"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Github,
  GithubIcon,
  Loader2,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import PixelCard from "@/components/ui/pixel-card";
import { SidebarThemeToggle } from "@/components/sidebar-theme-toggle";
import { cn } from "@/lib/utils";
import type { AgentScoreCheck, AgentScoreReport } from "@/lib/agent-score";

type LeaderboardEntry = {
  id: string;
  url: string;
  name: string;
  score: number;
  grade: string;
  framework: string | null;
  submitterName: string | null;
  submitterUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

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

const EXAMPLE_URLS = [
  "https://docs.farming-labs.dev",
  "https://better-auth.com/docs",
  "https://shadcn-svelte.com",
] as const;

const RANK_BADGES: Record<number, { icon: typeof Crown; tint: string }> = {
  0: { icon: Crown, tint: "text-yellow-500 dark:text-yellow-300" },
  1: { icon: Trophy, tint: "text-zinc-500 dark:text-zinc-300" },
  2: { icon: Award, tint: "text-amber-700 dark:text-amber-400" },
};

function statusLabel(status: AgentScoreCheck["status"]): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

function formatImprovementsClipboardText(report: AgentScoreReport): string {
  const lines: string[] = [];
  lines.push(`Docs: ${report.baseUrl}`);
  lines.push(`Agent readiness: ${report.score}/100 — ${report.grade}`);
  lines.push("");

  const weak = report.checks.filter((c) => c.status !== "pass");
  if (weak.length === 0) {
    lines.push("Hosted checks all passed on this run.");
    return lines.join("\n");
  }

  lines.push("Checks that still need attention:");
  for (const c of weak) {
    const note = (c.recommendation ?? c.detail).trim();
    lines.push(`• ${c.title} (${statusLabel(c.status)})`);
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

export function AgentScorePage() {
  const [url, setUrl] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterUrl, setSubmitterUrl] = useState("");
  const [overrideName, setOverrideName] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardNotConfigured, setLeaderboardNotConfigured] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch("/api/agent-score/leaderboard?limit=25", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        entries?: LeaderboardEntry[];
        notConfigured?: boolean;
      };
      setLeaderboardNotConfigured(Boolean(data.notConfigured));
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      setEntries([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  async function handleCalculate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitState({ status: "idle" });
    setShowSubmit(false);
    setFetchState({ status: "loading" });

    try {
      const response = await fetch("/api/agent-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await response.json()) as { error?: string } & AgentScoreReport;
      if (!response.ok) {
        setFetchState({
          status: "error",
          message: data.error ?? "Failed to score the URL. Make sure it is publicly reachable.",
        });
        return;
      }
      setFetchState({ status: "success", report: data });
      setOverrideName("");
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (error) {
      setFetchState({
        status: "error",
        message: error instanceof Error ? error.message : "Request failed before reaching the scorer.",
      });
    }
  }

  async function handleSubmitToLeaderboard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fetchState.status !== "success") return;

    setSubmitState({ status: "loading" });

    try {
      const response = await fetch("/api/agent-score/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: fetchState.report.baseUrl,
          name: overrideName.trim() || undefined,
          submitterName: submitterName.trim() || undefined,
          submitterUrl: submitterUrl.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        warning?: string;
        stored?: boolean;
        report?: AgentScoreReport;
      };

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
        message: "Submitted! Refreshing the leaderboard now.",
      });
      setShowSubmit(false);
      setSubmitterName("");
      setSubmitterUrl("");
      setOverrideName("");
      loadLeaderboard();
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Request failed before reaching the leaderboard.",
      });
    }
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
          <section ref={resultsRef} className="relative space-y-6">
            <ScoreOverview
              report={currentReport}
              onSubmitClick={() => {
                setShowSubmit(true);
                setSubmitState({ status: "idle" });
              }}
              submitOpen={showSubmit}
            />

            <ChecksBreakdown checks={currentReport.checks} />

            {currentReport.recommendations.length > 0 ? (
              <Recommendations items={currentReport.recommendations} />
            ) : null}

            {showSubmit ? (
              <SubmitForm
                onSubmit={handleSubmitToLeaderboard}
                state={submitState}
                submitterName={submitterName}
                onSubmitterName={setSubmitterName}
                submitterUrl={submitterUrl}
                onSubmitterUrl={setSubmitterUrl}
                overrideName={overrideName}
                onOverrideName={setOverrideName}
                defaultName={currentReport.name}
                onClose={() => setShowSubmit(false)}
              />
            ) : null}

            {submitState.status === "success" ? (
              <div className="border border-emerald-500/30 bg-emerald-500/5 px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                {submitState.message}
              </div>
            ) : null}
          </section>
        ) : null}

        <LeaderboardSection
          entries={entries}
          loading={leaderboardLoading}
          notConfigured={leaderboardNotConfigured}
        />

        <CtaSection />
      </main>

      <FooterSection />
    </div>
  );
}

function HeroSection({
  url,
  onUrlChange,
  onSubmit,
  loading,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
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
            CLI runs, in one click. We probe discovery, llms.txt, sitemap, robots, skill.md, .md
            routes, and MCP, then give you a score and a breakdown.
          </p>

          <div className="mt-6 flex flex-wrap gap-1.5 sm:gap-2">
            {["Discovery", "llms.txt", "Sitemap", "Robots", "Skill", "Markdown", "MCP"].map(
              (signal) => (
                <span
                  key={signal}
                  className="inline-flex items-center border border-black/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-black/45 dark:border-white/10 dark:text-white/45 sm:px-2.5 sm:text-[10px] sm:tracking-[0.2em]"
                >
                  {signal}
                </span>
              ),
            )}
          </div>

          <div className="-mb-px mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Link
              href="/docs/cli"
              className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-black/45 transition-colors hover:text-black hover:no-underline dark:text-white/45 dark:hover:text-white"
            >
              Read the doctor docs
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
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
                  type="url"
                  required
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  placeholder="https://docs.example.com"
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
              className="group inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Probing endpoints
                </>
              ) : (
                <>
                  Calculate score
                  <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
                </>
              )}
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

function BreakdownImprovementStrip({ report }: { report: AgentScoreReport }) {
  const payload = useMemo(() => formatImprovementsClipboardText(report), [report]);
  const [copied, setCopied] = useState(false);

  const smCols = 3;
  const remainderSm = report.checks.length % smCols;
  const spanSm = remainderSm === 0 ? smCols : smCols - remainderSm;

  const smColSpanClass =
    spanSm >= 3 ? "sm:col-span-3" : spanSm === 2 ? "sm:col-span-2" : "sm:col-span-1";

  return (
    <div
      className={cn(
        "col-span-2 flex h-full flex-col justify-end gap-3 bg-white px-3 py-3 dark:bg-black sm:min-h-0 sm:justify-between sm:px-4 sm:py-2",
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
          {copied ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Copy className="size-3.5 shrink-0" aria-hidden />}
          {copied ? "Copied" : "Copy improvements"}
        </button>
      </div>
    </div>
  );
}

function ScoreOverview({
  report,
  onSubmitClick,
  submitOpen,
}: {
  report: AgentScoreReport;
  onSubmitClick: () => void;
  submitOpen: boolean;
}) {
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
            {report.framework ? (
              <div className="flex items-center justify-between">
                <span className="text-black/40 dark:text-white/40">Framework</span>
                <span className="text-black dark:text-white">{report.framework}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-black/40 dark:text-white/40">Raw</span>
              <span className="text-black dark:text-white">
                {report.rawScore} / {report.rawMaxScore}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-black/40 dark:text-white/40">Generated</span>
              <span className="text-black dark:text-white">{formatDate(report.generatedAt)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSubmitClick}
            disabled={submitOpen}
            className="group inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            <Trophy className="size-3.5" />
            Submit to leaderboard
            <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
          </button>
        </div>

        <div className="min-w-0 px-0 py-0 border-t border-black/10 pt-8 dark:border-white/10 lg:flex lg:flex-col lg:border-l lg:border-black/10 lg:border-t-0 lg:pl-0 lg:pt-0 lg:dark:border-white/10">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-black/10 dark:bg-white/10 sm:grid-cols-3">
            {report.checks.map((check) => (
              <ScoreCheckCard key={check.id} check={check} />
            ))}
            <BreakdownImprovementStrip report={report} />
          </div>
        </div>
      </div>
    </PixelCard>
  );
}

function ScoreCheckCard({ check }: { check: AgentScoreCheck }) {
  const ratio = check.maxScore > 0 ? check.score / check.maxScore : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className="relative flex min-h-0 flex-col gap-1.5 bg-white px-2 py-2 dark:bg-black sm:px-2.5 sm:py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">
          {check.title}
        </p>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] tabular-nums text-black/60 dark:text-white/60">
          {statusLabel(check.status)}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-4">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums tracking-[-0.03em] text-black dark:text-white">
            {check.score}
          </span>
          <span className="font-mono text-[10px] tabular-nums tracking-[0.16em] text-black/35 dark:text-white/35">
            /{check.maxScore}
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums tracking-[0.18em] text-black/40 dark:text-white/40">
          {percent}%
        </span>
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
  return (
    <div className="border border-black/10 dark:border-white/10">
      <div className="border-b border-black/10 px-5 py-3 dark:border-white/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
          Per-check details
        </p>
        <h2 className="mt-1 text-xl font-normal font-pixel tracking-normal text-black dark:text-white">
          What was probed.
        </h2>
      </div>

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
        {checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              "relative grid gap-y-2 border-l-2 border-l-transparent px-5 py-4 sm:grid-cols-[88px_minmax(180px,1.2fr)_minmax(0,3fr)] sm:items-start sm:gap-x-8",
              check.status === "warn" && "border-l-orange-500 dark:border-l-orange-400",
              check.status === "fail" && "border-l-red-500 dark:border-l-red-400",
            )}
          >
            <div className="flex items-start sm:items-center">
              <span
                className={cn(
                  "inline-flex items-center justify-center border bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums dark:bg-black",
                  check.status === "pass" &&
                  "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70",
                  check.status === "warn" &&
                  "border-orange-500/60 text-orange-600 dark:border-orange-400/60 dark:text-orange-400",
                  check.status === "fail" &&
                  "border-red-500/60 text-red-600 dark:border-red-400/60 dark:text-red-400",
                )}
              >
                {statusLabel(check.status)}
              </span>
            </div>

            <div className="flex flex-col gap-1 sm:gap-1.5">
              <span className="font-mono text-[11px] uppercase leading-snug tracking-[0.2em] text-black/80 dark:text-white/80">
                {check.title}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums text-black/35 dark:text-white/35">
                {check.score} / {check.maxScore} pts
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
        ))}
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

function SubmitForm({
  onSubmit,
  state,
  submitterName,
  onSubmitterName,
  submitterUrl,
  onSubmitterUrl,
  overrideName,
  onOverrideName,
  defaultName,
  onClose,
}: {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  state: SubmitState;
  submitterName: string;
  onSubmitterName: (value: string) => void;
  submitterUrl: string;
  onSubmitterUrl: (value: string) => void;
  overrideName: string;
  onOverrideName: (value: string) => void;
  defaultName: string;
  onClose: () => void;
}) {
  const loading = state.status === "loading";
  return (
    <PixelCard className="border-black/10 bg-white/95 dark:border-white/10 dark:bg-black/35">
      <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
            Submit to leaderboard
          </p>
          <h3 className="mt-1 text-lg font-normal font-pixel tracking-normal text-black dark:text-white">
            Share your score with everyone.
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-black/55 dark:text-white/45">
            We re-run the same checks server-side and store the verified result. Name fields are
            opt-in; leave them blank to submit anonymously.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close submit form"
          className="border border-black/10 p-1.5 text-black/45 transition-colors hover:border-black/30 hover:text-black dark:border-white/10 dark:text-white/45 dark:hover:border-white/30 dark:hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="leaderboard-display-name"
            className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
          >
            Display name <span className="normal-case opacity-60">(optional)</span>
          </label>
          <input
            id="leaderboard-display-name"
            type="text"
            value={overrideName}
            onChange={(event) => onOverrideName(event.target.value)}
            placeholder={defaultName}
            className="w-full rounded-none border border-black/10 bg-transparent px-3 py-2 text-sm text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="leaderboard-submitter-name"
              className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
            >
              Your name <span className="normal-case opacity-60">(optional)</span>
            </label>
            <input
              id="leaderboard-submitter-name"
              type="text"
              value={submitterName}
              onChange={(event) => onSubmitterName(event.target.value)}
              placeholder="Ada Lovelace"
              className="w-full rounded-none border border-black/10 bg-transparent px-3 py-2 text-sm text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
            />
          </div>
          <div>
            <label
              htmlFor="leaderboard-submitter-url"
              className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
            >
              Profile URL <span className="normal-case opacity-60">(optional)</span>
            </label>
            <input
              id="leaderboard-submitter-url"
              type="url"
              value={submitterUrl}
              onChange={(event) => onSubmitterUrl(event.target.value)}
              placeholder="https://github.com/you"
              className="w-full rounded-none border border-black/10 bg-transparent px-3 py-2 text-sm text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
            />
          </div>
        </div>

        {state.status === "error" ? (
          <p className="border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-red-600 dark:text-red-400">
            {state.message}
          </p>
        ) : null}
        {state.status === "warning" ? (
          <p className="border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="group inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Verifying score
            </>
          ) : (
            <>
              <Check className="size-3.5" />
              Submit verified score
            </>
          )}
        </button>
      </form>
    </PixelCard>
  );
}

function LeaderboardSection({
  entries,
  loading,
  notConfigured,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
  notConfigured: boolean;
}) {
  const ranked = useMemo(() => entries.slice(0, 100), [entries]);

  return (
    <section id="leaderboard" className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
            Leaderboard
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
            Most agent-ready docs sites.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/55 dark:text-white/45">
            Ranked by the verified score returned by the doctor probes. Submit your own to land on
            the board.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/35 dark:text-white/35">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </div>
      </div>

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
      ) : (
        <div className="border border-black/10 dark:border-white/10">
          <div className="hidden border-b border-black/10 px-4 py-2 dark:border-white/10 sm:grid sm:grid-cols-[60px_minmax(0,1.6fr)_minmax(0,1fr)_90px_120px_140px] sm:items-center sm:gap-4">
            {[
              "Rank",
              "Site",
              "URL",
              "Grade",
              "Framework",
              "Submitter",
            ].map((label) => (
              <span
                key={label}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/40 dark:text-white/40"
              >
                {label}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {ranked.map((entry, index) => (
              <LeaderboardRow key={entry.id} entry={entry} rank={index} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const Badge = RANK_BADGES[rank];
  const tint = Badge?.tint ?? "text-black/45 dark:text-white/45";
  const Icon = Badge?.icon;
  return (
    <li className="group grid items-center gap-2 px-4 py-3 transition-colors hover:bg-black/[0.02] sm:grid-cols-[60px_minmax(0,1.6fr)_minmax(0,1fr)_90px_120px_140px] sm:gap-4 dark:hover:bg-white/[0.02]">
      <div className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.16em] text-black/70 dark:text-white/70">
        {Icon ? <Icon className={cn("size-3.5", tint)} /> : null}
        <span className="tabular-nums">{String(rank + 1).padStart(2, "0")}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-[13px] text-black dark:text-white">{entry.name}</p>
        <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-black/35 dark:text-white/35">
          <span className="text-base font-semibold normal-case tracking-tight text-black dark:text-white">
            {entry.score}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{entry.grade}</span>
        </p>
      </div>
      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate font-mono text-[11px] text-black/55 hover:underline dark:text-white/55"
      >
        {shortenUrl(entry.url)}
      </a>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55 sm:inline">
        {entry.grade}
      </span>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55 sm:inline">
        {entry.framework ?? "—"}
      </span>
      <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55 sm:inline">
        {entry.submitterUrl ? (
          <a
            href={entry.submitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-black hover:underline dark:text-white"
          >
            {entry.submitterName ?? shortenUrl(entry.submitterUrl)}
          </a>
        ) : (
          (entry.submitterName ?? "anonymous")
        )}
      </span>
    </li>
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

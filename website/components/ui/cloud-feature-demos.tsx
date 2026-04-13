"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  FileText,
  GitPullRequest,
  Hash,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const editorLines = [
  "---",
  'title: "Getting Started"',
  'description: "Set up in five minutes"',
  'sidebar: "runtime"',
  "---",
  "",
  "## Install",
  "",
  "Run `pnpm dlx @farming-labs/docs init` to scaffold the docs app.",
  "",
  "Add search, page actions, and AI config from the same control plane.",
] as const;

const mobileEditorLines = [
  "---",
  'title: "Getting Started"',
  'description: "Set up in five minutes"',
  'sidebar: "runtime"',
  "---",
  "",
  "## Install",
  "",
  "Run `pnpm dlx @farming-labs/docs init`.",
] as const;

const searchScenarios = [
  {
    query: "billing webhook retries",
    results: [
      { title: "Retry policy", meta: "Guide · section hit", type: "heading" },
      { title: "Webhook delivery", meta: "Reference · API docs", type: "page" },
      { title: "Troubleshooting retries", meta: "Support · docs health", type: "page" },
    ],
  },
  {
    query: "session configuration",
    results: [
      { title: "Session configuration", meta: "Guide · section hit", type: "heading" },
      { title: "Session storage", meta: "Reference · runtime", type: "page" },
      { title: "Cookie options", meta: "API docs · configuration", type: "page" },
    ],
  },
  {
    query: "algolia sync",
    results: [
      { title: "Algolia provider", meta: "Configuration · search", type: "page" },
      { title: "Search sync command", meta: "CLI · indexing", type: "heading" },
      { title: "Hybrid retrieval", meta: "AI · search", type: "page" },
    ],
  },
] as const;

const mobileSearchScenarios = [
  {
    query: "webhook retries",
    results: [
      { title: "Retry policy", meta: "Guide · retries", type: "heading" },
      { title: "Webhook delivery", meta: "API · delivery", type: "page" },
    ],
  },
  {
    query: "session config",
    results: [
      { title: "Session config", meta: "Guide · runtime", type: "heading" },
      { title: "Session storage", meta: "Reference · storage", type: "page" },
    ],
  },
  {
    query: "algolia sync",
    results: [
      { title: "Algolia provider", meta: "Config · search", type: "page" },
      { title: "Sync command", meta: "CLI · indexing", type: "heading" },
    ],
  },
] as const;

const editorPauseTicks = 64;
const searchTypeMs = 38;
const searchResultStaggerMs = 210;
const searchCyclePauseMs = 1650;

function useIsSmallScreen() {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsSmallScreen(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isSmallScreen;
}

export function CloudEditorDemo() {
  const isSmallScreen = useIsSmallScreen();
  const [frame, setFrame] = useState(0);

  const lines = isSmallScreen ? mobileEditorLines : editorLines;
  const totalChars = lines.reduce((sum, line) => sum + line.length + 1, 0);
  const frameDelay = isSmallScreen ? 32 : 24;

  useEffect(() => {
    const cycleLength = totalChars + editorPauseTicks;
    const intervalId = setInterval(() => {
      setFrame((value) => (value + 1) % cycleLength);
    }, frameDelay);

    return () => {
      clearInterval(intervalId);
    };
  }, [frameDelay, totalChars]);

  const typedCount = Math.min(frame, totalChars);

  let remaining = typedCount;
  const visibleLines = lines.map((line) => {
    const visibleCount = Math.max(0, Math.min(line.length, remaining));
    const text = line.slice(0, visibleCount);
    const active = remaining >= 0 && remaining <= line.length;
    remaining -= line.length + 1;
    return { full: line, text, active };
  });

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden border border-black/10 bg-white/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:gap-3 sm:p-4 dark:border-white/10 dark:bg-black/50 dark:shadow-none">
      <div className="flex flex-col gap-2 border-b border-black/10 pb-2.5 sm:pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
            docs/getting-started.mdx
          </p>
          <p className="mt-1 text-[13px] leading-5 text-black/65 sm:text-sm dark:text-white/55">
            Frontmatter, markdown, and nav updates in one editor.
          </p>
        </div>
        <span className="inline-flex w-fit border border-black/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:border-white/10 dark:text-white/45">
          draft
        </span>
      </div>

      <div className="grid min-h-0 gap-3">
        <div className="grid min-h-0 grid-cols-[28px_minmax(0,1fr)] border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-[34px_minmax(0,1fr)]">
          <div className="border-r border-black/10 bg-black/[0.035] px-1.5 py-2.5 font-mono text-[9px] leading-5 text-black/30 sm:px-2 sm:py-3 sm:text-[10px] sm:leading-6 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/25">
            {lines.map((_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>

          <div className="min-h-0 overflow-hidden px-2.5 py-2.5 font-mono text-[10px] leading-5 text-black/65 sm:px-3 sm:py-3 sm:text-[11px] sm:leading-6 dark:text-white/55">
            {visibleLines.map((line, index) => (
              <div key={`${line.full}-${index}`} className="min-h-5 whitespace-pre-wrap sm:min-h-6">
                <span className={getEditorLineClass(line.full)}>
                  {line.text || (line.full === "" ? " " : "")}
                </span>
                {line.active ? (
                  <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-black/45 sm:h-3.5 sm:w-[7px] dark:bg-white/45" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <DemoPill icon={GitPullRequest} label="Open PR" />
        <DemoPill icon={ShieldCheck} label="Review ready" className="hidden sm:inline-flex" />
      </div>
    </div>
  );
}

export function CloudSearchDemo() {
  const isSmallScreen = useIsSmallScreen();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [visibleResults, setVisibleResults] = useState(0);

  const scenarios = isSmallScreen ? mobileSearchScenarios : searchScenarios;
  const scenario = scenarios[scenarioIndex];
  const results = scenario.results;
  const typeMs = isSmallScreen ? 30 : searchTypeMs;
  const resultStaggerMs = isSmallScreen ? 150 : searchResultStaggerMs;
  const cyclePauseMs = isSmallScreen ? 1100 : searchCyclePauseMs;

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    setTypedLength(0);
    setVisibleResults(0);

    for (let i = 1; i <= scenario.query.length; i++) {
      timers.push(setTimeout(() => setTypedLength(i), i * typeMs));
    }

    const resultsStart = scenario.query.length * typeMs + (isSmallScreen ? 180 : 260);

    scenario.results.forEach((_, index) => {
      timers.push(
        setTimeout(
          () => {
            setVisibleResults(index + 1);
          },
          resultsStart + index * resultStaggerMs,
        ),
      );
    });

    timers.push(
      setTimeout(
        () => {
          setScenarioIndex((value) => (value + 1) % scenarios.length);
        },
        resultsStart + results.length * resultStaggerMs + cyclePauseMs,
      ),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [cyclePauseMs, isSmallScreen, resultStaggerMs, scenarioIndex, typeMs]);

  const activeResultIndex = visibleResults > 0 ? visibleResults - 1 : 0;

  return (
    <div className="relative grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden border border-black/10 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] sm:gap-3 sm:p-4 dark:border-white/10 dark:bg-black/70 dark:shadow-none">
      <div className="border border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-black/75">
        <div className="flex items-center gap-2 px-2.5 py-2 sm:px-3">
          <span className="flex size-4 shrink-0 items-center justify-center text-black/45 dark:text-white/45">
            <Search className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-black/55 sm:text-[11px] sm:tracking-[0.18em] dark:text-white/50">
            {scenario.query.slice(0, typedLength)}
            {typedLength < scenario.query.length ? (
              <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-black/45 sm:h-3.5 sm:w-[7px] dark:bg-white/45" />
            ) : null}
          </span>
          <kbd className="hidden border border-black/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-black/40 sm:inline-flex dark:border-white/10 dark:text-white/35">
            cmd k
          </kbd>
          <span className="hidden size-5 items-center justify-center border border-black/10 text-black/35 sm:flex dark:border-white/10 dark:text-white/35">
            <X className="size-3" />
          </span>
        </div>
      </div>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5 sm:gap-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/40 sm:text-[10px] sm:tracking-[0.18em] dark:text-white/35">
          Documentation
        </div>

        <div className="space-y-2">
          {results.map((row, index) => {
            const visible = index < visibleResults;
            const active = index === activeResultIndex;
            return (
              <div
                key={`${scenario.query}-${row.title}`}
                className={cn(
                  "grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2 border px-2 py-2.5 transition-all duration-500 sm:grid-cols-[32px_minmax(0,1fr)_auto_auto] sm:gap-3 sm:px-3 sm:py-2 sm:duration-700",
                  active
                    ? "border-black/20 bg-black/[0.05] text-black shadow-[0_0_0_1px_rgba(0,0,0,0.03)] dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
                    : "border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-black/75 dark:text-white",
                  visible
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center border sm:size-8",
                    active
                      ? "border-black/15 text-black/65 dark:border-white/15 dark:text-white/75"
                      : "border-black/10 text-black/45 dark:border-white/10 dark:text-white/45",
                  )}
                >
                  {row.type === "heading" ? (
                    <Hash className="size-3 sm:size-3.5" />
                  ) : (
                    <FileText className="size-3 sm:size-3.5" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium leading-5 sm:text-base">{row.title}</p>
                  <p
                    className={cn(
                      "mt-1 truncate font-mono text-[9px] uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.18em]",
                      active
                        ? "text-black/45 dark:text-white/45"
                        : "text-black/45 dark:text-white/45",
                    )}
                  >
                    {row.meta}
                  </p>
                </div>

                <span
                  className={cn(
                    "hidden size-7 items-center justify-center border sm:flex",
                    active
                      ? "border-black/15 text-black/55 dark:border-white/15 dark:text-white/65"
                      : "border-black/10 text-black/40 dark:border-white/10 dark:text-white/40",
                  )}
                >
                  <ExternalLink className="size-3.5" />
                </span>

                <ChevronRight
                  className={cn(
                    "hidden size-4 sm:block",
                    active
                      ? "text-black/45 dark:text-white/45"
                      : "text-black/35 dark:text-white/35",
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-black/10 pt-2.5 sm:pt-3 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DemoPill icon={Search} label="Section hits" />
            <DemoPill icon={Bot} label="Cited answers" className="hidden sm:inline-flex" />
            <DemoPill
              icon={ShieldCheck}
              label="Healthy index"
              className="hidden sm:inline-flex"
            />
          </div>
          <div className="hidden flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-black/40 sm:flex dark:text-white/35">
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="size-3" />
              select
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="size-3" />
              <ArrowDown className="size-3" />
              navigate
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoPill({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Search;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-black/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-black/50 sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em] dark:border-white/10 dark:text-white/45",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function getEditorLineClass(line: string) {
  if (line === "---") return "text-black/35 dark:text-white/30";
  if (line.startsWith("title:") || line.startsWith("description:") || line.startsWith("sidebar:")) {
    return "text-black/75 dark:text-white/65";
  }
  if (line.startsWith("##")) return "font-semibold text-black dark:text-white";
  if (line.includes("`")) return "text-black/70 dark:text-white/60";
  return "text-black/60 dark:text-white/55";
}

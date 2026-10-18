"use client";

import { Fragment, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  FileText,
  GitPullRequest,
  Hash,
  Search,
  ShieldCheck,
  Sparkles,
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

type SearchResult = {
  title: string;
  path: readonly [string, string];
  type: "heading" | "page";
};

const searchScenarios: ReadonlyArray<{
  query: string;
  sources: number;
  answer: string;
  results: readonly SearchResult[];
}> = [
  {
    query: "webhook retries",
    sources: 4,
    answer: "Failed deliveries retry with exponential backoff. Set the attempt limit per endpoint.",
    results: [
      { title: "Retry policy", path: ["Guides", "Webhooks"], type: "heading" },
      { title: "Webhook delivery", path: ["API", "Events"], type: "page" },
      { title: "Troubleshooting retries", path: ["Support", "Docs health"], type: "page" },
    ],
  },
  {
    query: "session configuration",
    sources: 3,
    answer: "Sessions are set in the auth config: cookie name, lifetime, and storage adapter.",
    results: [
      { title: "Session configuration", path: ["Guides", "Auth"], type: "heading" },
      { title: "Session storage", path: ["Reference", "Runtime"], type: "page" },
      { title: "Cookie options", path: ["API", "Configuration"], type: "page" },
    ],
  },
  {
    query: "algolia sync",
    sources: 5,
    answer: "Each deploy pushes changed pages to the Algolia index, so results never go stale.",
    results: [
      { title: "Algolia provider", path: ["Configuration", "Search"], type: "page" },
      { title: "Search sync command", path: ["CLI", "Indexing"], type: "heading" },
      { title: "Hybrid retrieval", path: ["AI", "Search"], type: "page" },
    ],
  },
];

const searchScopes = ["All", "Guides", "API", "AI"] as const;

const editorTotalChars = editorLines.reduce((sum, line) => sum + line.length + 1, 0);
const editorPauseTicks = 64;
const searchTypeMs = 42;
const searchResultStaggerMs = 220;
const searchAnswerDelayMs = 240;
const searchCursorStepMs = 900;
const searchCyclePauseMs = 2400;

// Fixed-ratio trays clip anything taller than they are; fade the overflow out instead of
// letting it run into the controls below.
const fadeOutBottom = "[mask-image:linear-gradient(to_bottom,#000_calc(100%-1rem),transparent)]";

export function CloudEditorDemo() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const cycleLength = editorTotalChars + editorPauseTicks;
    const intervalId = setInterval(() => {
      setFrame((value) => (value + 1) % cycleLength);
    }, 24);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const typedCount = Math.min(frame, editorTotalChars);

  let remaining = typedCount;
  const visibleLines = editorLines.map((line) => {
    const visibleCount = Math.max(0, Math.min(line.length, remaining));
    const text = line.slice(0, visibleCount);
    const active = remaining >= 0 && remaining <= line.length;
    remaining -= line.length + 1;
    return { full: line, text, active };
  });

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden border border-black/10 bg-white/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-4 dark:border-white/10 dark:bg-black/50 dark:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] uppercase tracking-normal text-black/45 dark:text-white/45">
            docs/getting-started.mdx
          </p>
          <p className="mt-1 truncate text-sm text-black/65 dark:text-white/55">
            Frontmatter, markdown, and nav updates in one editor.
          </p>
        </div>
        <span className="inline-flex shrink-0 border border-black/10 px-2 py-1 font-mono text-[11px] uppercase tracking-normal text-black/45 dark:border-white/10 dark:text-white/45">
          draft
        </span>
      </div>

      <div className="relative min-h-0 overflow-hidden border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]">
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[34px] border-r border-black/10 bg-black/[0.035] dark:border-white/10 dark:bg-white/[0.02]"
        />
        <div
          className={cn(
            "relative py-3 font-mono text-[11px] leading-6 text-black/65 dark:text-white/55",
            fadeOutBottom,
          )}
        >
          {visibleLines.map((line, index) => (
            <div key={`${line.full}-${index}`} className="grid grid-cols-[34px_minmax(0,1fr)]">
              <span className="select-none px-2 text-[10px] text-black/30 dark:text-white/25">
                {index + 1}
              </span>
              <span className="min-h-6 whitespace-pre-wrap break-words px-3">
                <span className={getEditorLineClass(line.full)}>
                  {line.text || (line.full === "" ? " " : "")}
                </span>
                {line.active ? (
                  <span className="ml-0.5 inline-block h-3.5 w-[7px] translate-y-0.5 animate-pulse bg-black/45 dark:bg-white/45" />
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DemoPill icon={GitPullRequest} label="Open PR" />
        <DemoPill icon={ShieldCheck} label="Review ready" />
      </div>
    </div>
  );
}

export function CloudSearchDemo() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [visibleResults, setVisibleResults] = useState(0);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  useEffect(() => {
    const scenario = searchScenarios[scenarioIndex];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    setTypedLength(0);
    setVisibleResults(0);
    setAnswerVisible(false);
    setActiveResultIndex(0);

    for (let i = 1; i <= scenario.query.length; i++) {
      timers.push(setTimeout(() => setTypedLength(i), i * searchTypeMs));
    }

    // The Ask AI row lands as soon as the query is typed, then the matching sections.
    const answerAt = scenario.query.length * searchTypeMs + 180;
    timers.push(setTimeout(() => setAnswerVisible(true), answerAt));

    const resultsStart = answerAt + searchAnswerDelayMs;
    scenario.results.forEach((_, index) => {
      timers.push(
        setTimeout(
          () => setVisibleResults(index + 1),
          resultsStart + index * searchResultStaggerMs,
        ),
      );
    });

    const settledAt = resultsStart + (scenario.results.length - 1) * searchResultStaggerMs;
    timers.push(setTimeout(() => setActiveResultIndex(1), settledAt + searchCursorStepMs));
    timers.push(
      setTimeout(
        () => setScenarioIndex((value) => (value + 1) % searchScenarios.length),
        settledAt + searchCyclePauseMs,
      ),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [scenarioIndex]);

  const scenario = searchScenarios[scenarioIndex];
  const typing = typedLength < scenario.query.length;
  const queryWords = scenario.query.split(" ");

  // The tray keeps a fixed aspect ratio, so its width tracks its height. Narrow trays get
  // one-line rows so the Ask AI row and all three results fit; wider ones add detail.
  return (
    <div className="@container flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-black/10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#0a0a0a] dark:shadow-none">
      <div className="flex items-center gap-2.5 border-b border-black/10 px-3.5 py-2 @min-[26rem]:py-2.5 @min-[31rem]:py-3 dark:border-white/10">
        <Search className="size-4 shrink-0 text-black/40 dark:text-white/40" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-black/85 dark:text-white/85">
          {scenario.query.slice(0, typedLength)}
          <span
            className={cn(
              "ml-px inline-block h-4 w-px translate-y-[3px] bg-black/70 dark:bg-white/70",
              typing ? "opacity-100" : "animate-pulse",
            )}
          />
        </span>
        <kbd className="shrink-0 border border-black/10 px-1.5 py-0.5 font-mono text-[10px] text-black/40 dark:border-white/10 dark:text-white/40">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-1 border-b border-black/10 px-2.5 py-1 @min-[31rem]:py-1.5 dark:border-white/10">
        {searchScopes.map((scope, index) => (
          <span
            key={scope}
            className={cn(
              "px-2 py-1 font-mono text-[10px] uppercase tracking-normal",
              index === 0
                ? "bg-black/[0.06] text-black/75 dark:bg-white/[0.08] dark:text-white/80"
                : "text-black/40 dark:text-white/35",
            )}
          >
            {scope}
          </span>
        ))}
        <span className="ml-auto truncate pr-1 font-mono text-[10px] uppercase tracking-normal text-black/35 tabular-nums dark:text-white/30">
          {visibleResults} results
        </span>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden px-1.5 pt-1.5 pb-3 @min-[31rem]:pt-2",
          fadeOutBottom,
        )}
      >
        <div
          key={scenario.query}
          className={cn(
            "mx-1 flex items-center gap-2.5 border border-black/10 bg-black/[0.025] px-2 py-1.5 transition-[opacity,transform] duration-300 @min-[31rem]:gap-3 @min-[31rem]:py-2 dark:border-white/10 dark:bg-white/[0.03]",
            answerVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            "@min-[35rem]:items-start",
          )}
        >
          <span className="flex size-6 shrink-0 items-center justify-center border border-black/15 bg-white text-black/70 @min-[31rem]:size-7 dark:border-white/15 dark:bg-black dark:text-white/80">
            <Sparkles className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-black/85 dark:text-white/90">
              Ask AI about “{scenario.query}”
            </span>
            <span className="mt-0.5 hidden truncate font-mono text-[10px] uppercase tracking-normal text-black/40 @min-[26rem]:block dark:text-white/35">
              Cited answer · {scenario.sources} sources
            </span>
            <span className="mt-2 hidden @min-[35rem]:block">
              <span className="block text-[12px] leading-5 text-black/60 dark:text-white/55">
                {scenario.answer}
              </span>
              <span className="mt-1.5 flex gap-1">
                {Array.from({ length: scenario.sources }, (_, index) => (
                  <span
                    key={index}
                    className="inline-flex h-4 min-w-4 items-center justify-center border border-black/15 px-1 font-mono text-[9px] text-black/50 dark:border-white/15 dark:text-white/50"
                  >
                    {index + 1}
                  </span>
                ))}
              </span>
            </span>
          </span>
          <kbd className="hidden shrink-0 border border-black/10 px-1.5 py-0.5 font-mono text-[10px] text-black/40 @min-[24rem]:inline-block dark:border-white/10 dark:text-white/40">
            tab
          </kbd>
        </div>

        <p className="hidden px-2 pt-3 pb-1 font-mono text-[10px] uppercase tracking-normal text-black/35 @min-[26rem]:block dark:text-white/30">
          Documentation
        </p>
        <ul className="pt-1 @min-[26rem]:pt-0">
          {scenario.results.map((row, index) => {
            const visible = index < visibleResults;
            const active = visible && index === activeResultIndex;
            return (
              <li
                key={`${scenario.query}-${row.title}`}
                className={cn(
                  "relative flex items-center gap-2.5 px-2 py-1.5 transition-[opacity,transform,background-color] duration-300 @min-[31rem]:gap-3 @min-[31rem]:py-2",
                  active && "bg-black/[0.045] dark:bg-white/[0.06]",
                  visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-1.5 left-0 w-0.5 bg-black/70 transition-opacity dark:bg-white/75",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="flex size-6 shrink-0 items-center justify-center border border-black/10 text-black/50 @min-[31rem]:size-7 dark:border-white/10 dark:text-white/50">
                  {row.type === "heading" ? (
                    <Hash className="size-3.5" />
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline gap-3 @min-[31rem]:block">
                  <span
                    className={cn(
                      "block shrink-0 truncate text-[13px] font-medium transition-colors",
                      active
                        ? "text-black/80 dark:text-white/80"
                        : "text-black/55 dark:text-white/55",
                    )}
                  >
                    <HighlightedText text={row.title} words={queryWords} />
                  </span>
                  <span className="ml-auto block min-w-0 truncate text-right font-mono text-[10px] uppercase tracking-normal text-black/40 @min-[31rem]:mt-0.5 @min-[31rem]:text-left dark:text-white/35">
                    {row.path[0]} › {row.path[1]}
                  </span>
                </span>
                <CornerDownLeft
                  className={cn(
                    "hidden size-3.5 shrink-0 text-black/40 transition-opacity @min-[24rem]:block dark:text-white/40",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-3 border-t border-black/10 px-3.5 py-2 font-mono text-[10px] uppercase tracking-normal text-black/40 dark:border-white/10 dark:text-white/35">
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft className="size-3" />
          open
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowUp className="size-3" />
          <ArrowDown className="size-3" />
          move
        </span>
        <span className="ml-auto inline-flex min-w-0 items-center gap-1.5">
          <span className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping bg-black/30 dark:bg-white/40" />
            <span className="relative inline-flex size-1.5 bg-black/55 dark:bg-white/70" />
          </span>
          <span className="truncate">Index healthy</span>
        </span>
      </div>
    </div>
  );
}

function HighlightedText({ text, words }: { text: string; words: readonly string[] }) {
  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="bg-transparent text-black dark:text-white">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function DemoPill({ icon: Icon, label }: { icon: typeof Search; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-black/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-normal text-black/50 dark:border-white/10 dark:text-white/45">
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

import type { CSSProperties, ReactNode } from "react";
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Copy,
  CornerDownLeft,
  FileText,
  Gauge,
  Hash,
  Play,
  Search,
  Sparkles,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { SimpleIcon, type SimpleIconName } from "@/components/marketing/brand-icons";
import { ShellCommand } from "@/components/marketing/shell-command";
import { cn } from "@/lib/utils";

/* Each figure is a small window sitting in a Tray. */
const frame =
  "relative z-10 flex h-full w-full min-w-0 flex-col overflow-hidden rounded-md border border-mk-line bg-mk-bg shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_rgb(0_0_0/0.05)] dark:shadow-[0_12px_32px_rgb(0_0_0/0.4)]";

function Window({
  children,
  title,
  meta,
  icon,
  className,
}: {
  children: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn(frame, className)}>
      <figcaption className="flex h-10 shrink-0 items-center justify-between gap-4 border-b border-mk-line px-4 font-mono text-[11px] tracking-normal text-mk-fg/45">
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        {meta ? <span className="shrink-0 uppercase text-mk-fg/30">{meta}</span> : null}
      </figcaption>
      {children}
    </figure>
  );
}

function TrafficLights() {
  return (
    <span aria-hidden className="flex gap-1.5">
      <span className="size-2.5 rounded-full bg-mk-fg/20" />
      <span className="size-2.5 rounded-full bg-mk-fg/14" />
      <span className="size-2.5 rounded-full bg-mk-fg/10" />
    </span>
  );
}

function typeStyle(text: string, duration: number, lines = 6) {
  return {
    "--mk-type-steps": text.length,
    "--mk-type-duration": `${duration}s`,
    "--mk-type-lines": lines,
  } as CSSProperties;
}

export function AskAiVisual() {
  return (
    <Window
      icon={<Sparkles aria-hidden className="size-3" strokeWidth={1.5} />}
      meta="cited"
      title="Ask AI · docs.acme.dev"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
        <div className="ml-auto max-w-[85%] rounded-md bg-mk-fg/[0.07] px-3 py-2 text-[13px] leading-5 text-mk-fg/85">
          How do I expose my docs to agents?
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-normal text-mk-fg/40">
            <Bot aria-hidden className="size-3" strokeWidth={1.5} />
            Docs assistant
            <span aria-hidden className="mk-pulse-dot ml-0.5 size-1.5 rounded-full bg-mk-ok" />
          </div>
          <div
            className="mk-type-output mt-2 space-y-1 text-[13px] leading-5 text-mk-fg/70"
            style={typeStyle("", 9, 4)}
          >
            <p>
              MCP is on by default:{" "}
              <code className="font-mono text-[12px] text-mk-fg">search_docs</code> and{" "}
              <code className="font-mono text-[12px] text-mk-fg">read_page</code> at{" "}
              <code className="font-mono text-[12px] text-mk-fg">/mcp</code>
              <sup className="font-mono text-[9px] text-mk-fg/50"> [1]</sup>
            </p>
            <p>
              Every page also answers at its{" "}
              <code className="font-mono text-[12px] text-mk-fg">.md</code> URL
              <sup className="font-mono text-[9px] text-mk-fg/50"> [2]</sup>
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2 font-mono text-[10px] text-mk-fg/50">
              <span className="rounded border border-mk-line px-1.5 py-0.5">
                1 · customization/mcp
              </span>
              <span className="rounded border border-mk-line px-1.5 py-0.5">2 · llms-txt</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-11 shrink-0 items-center justify-between border-t border-mk-line px-4 text-[12px] text-mk-fg/35">
        <span>Ask a question…</span>
        <kbd className="rounded border border-mk-line px-1.5 py-0.5 font-mono text-[10px]">⌘ I</kbd>
      </div>
    </Window>
  );
}

const curlCommand = "curl acme.dev/docs/quickstart.md";

export function AgentReadableVisual() {
  return (
    <Window
      icon={<TrafficLights />}
      meta="zsh"
      title={
        <span className="flex items-center gap-1.5">
          <Terminal aria-hidden className="size-3" strokeWidth={1.5} /> agent session
        </span>
      }
    >
      <pre className="min-h-0 flex-1 overflow-hidden p-5 font-mono text-[11px] leading-5 tracking-normal">
        <code className="block">
          <span className="block whitespace-nowrap text-mk-fg/50">
            <span>$ </span>
            <span className="mk-type text-mk-fg" style={typeStyle(curlCommand, 10)}>
              <ShellCommand command={curlCommand} prompt={false} />
            </span>
            <span aria-hidden className="mk-type-cursor" />
          </span>
          <span className="mk-type-output mt-2 block" style={typeStyle(curlCommand, 10, 8)}>
            <span className="block text-mk-fg"># Quickstart</span>
            <span className="block text-mk-fg/55">&gt; Install the CLI, then run init.</span>
            <span className="block">&nbsp;</span>
            <span className="block text-mk-fg/80">## 1. Install</span>
            <span className="block text-mk-fg/45">```bash</span>
            <span className="block text-mk-fg/70">pnpm dlx @farming-labs/docs init</span>
            <span className="block text-mk-fg/45">```</span>
            <span className="mt-2 block border-t border-dashed border-mk-line pt-2 text-mk-fg/40">
              <span className="text-mk-ok">200</span> · text/markdown · 1.8 kB
            </span>
          </span>
        </code>
      </pre>
    </Window>
  );
}

const searchAdapters = ["Simple", "Typesense", "Algolia", "MCP"] as const;

const searchResults = [
  { icon: FileText, title: "Sidebar", path: "/docs/configuration", active: true },
  { icon: Hash, title: "Collapsible groups", path: "/docs/customization/sidebar" },
  { icon: Hash, title: "Banner and footer slots", path: "/docs/configuration" },
] as const;

export function SearchVisual() {
  return (
    <figure className={frame}>
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-mk-line px-4">
        <Search aria-hidden className="size-3.5 text-mk-fg/45" strokeWidth={1.6} />
        <span className="flex-1 text-[14px] text-mk-fg">
          sidebar
          <span aria-hidden className="mk-type-cursor !h-[1em] !w-px" />
        </span>
        <kbd className="rounded border border-mk-line px-1.5 py-0.5 font-mono text-[10px] text-mk-fg/40">
          ESC
        </kbd>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2">
        <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-mk-fg/40">Pages</p>
        {searchResults.map((result) => {
          const Icon = result.icon;
          const active = "active" in result && result.active;
          return (
            <div
              key={result.title}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-2 text-[13px]",
                active ? "bg-mk-fg/[0.07] text-mk-fg" : "text-mk-fg/60",
              )}
            >
              <Icon aria-hidden className="size-3.5 shrink-0 opacity-60" strokeWidth={1.5} />
              <span className="truncate">{result.title}</span>
              <span className="ml-auto hidden truncate font-mono text-[10px] text-mk-fg/35 sm:block">
                {result.path}
              </span>
              {active ? (
                <CornerDownLeft
                  aria-hidden
                  className="size-3 shrink-0 opacity-50"
                  strokeWidth={1.5}
                />
              ) : null}
            </div>
          );
        })}
        <p className="px-2 pb-1 pt-3 text-[11px] font-medium text-mk-fg/40">Ask AI</p>
        <div className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] text-mk-fg/60">
          <Sparkles aria-hidden className="size-3.5 shrink-0 opacity-60" strokeWidth={1.5} />
          <span className="truncate">“How do I customize the sidebar?”</span>
        </div>
      </div>
      <div className="flex h-10 shrink-0 items-center gap-1 border-t border-mk-line px-2 font-mono text-[11px] uppercase tracking-normal">
        {searchAdapters.map((adapter, index) => (
          <span
            key={adapter}
            className={cn(
              "rounded px-2 py-1",
              index === 1 ? "bg-mk-fg text-mk-bg" : "text-mk-fg/40",
            )}
          >
            {adapter}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function ApiReferenceVisual() {
  return (
    <figure className={frame}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-mk-line px-3 font-mono text-[11px]">
        <span className="rounded bg-mk-fg px-1.5 py-0.5 text-[10px] font-medium text-mk-bg">
          GET
        </span>
        <span className="min-w-0 truncate text-mk-fg/70">
          /v1/projects/<span className="text-mk-fg">{"{id}"}</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-md border border-mk-line px-2 py-1 text-[10px] uppercase text-mk-fg/70">
          <Play aria-hidden className="size-2.5" strokeWidth={2} /> Send
        </span>
      </div>
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] border-b border-mk-line font-mono text-[11px]">
        {[
          ["id", "path", "prj_8f2a1c"],
          ["include", "query", "members"],
        ].map(([name, location, value], index) => (
          <div key={name} className="contents">
            <span
              className={cn(
                "flex h-9 items-center gap-2 border-r border-mk-line px-3 text-mk-fg/70",
                index === 0 && "border-b",
              )}
            >
              {name} <span className="text-[9px] uppercase text-mk-fg/30">{location}</span>
            </span>
            <span
              className={cn(
                "flex h-9 items-center px-3 text-mk-fg",
                index === 0 && "border-b border-mk-line",
              )}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-mk-line px-3 font-mono text-[11px] uppercase text-mk-fg/40">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-mk-ok" />
          <span className="text-mk-fg/70">200 OK</span> · 84ms
        </span>
        <span className="flex gap-3">
          <span className="text-mk-fg/70">curl</span>
          <span>TS</span>
          <span>Python</span>
        </span>
      </div>
      <pre className="min-h-0 flex-1 overflow-hidden px-4 py-3 font-mono text-[11px] leading-5">
        <code className="block text-mk-fg/40">
          {"{"}
          {"\n  "}
          <span className="text-mk-fg/60">&quot;id&quot;</span>:{" "}
          <span className="text-mk-fg">&quot;prj_8f2a1c&quot;</span>,{"\n  "}
          <span className="text-mk-fg/60">&quot;name&quot;</span>:{" "}
          <span className="text-mk-fg">&quot;Acme Docs&quot;</span>,{"\n  "}
          <span className="text-mk-fg/60">&quot;members&quot;</span>: [
          <span className="text-mk-fg">&quot;ada&quot;</span>]{"\n}"}
        </code>
      </pre>
    </figure>
  );
}

const openTargets: ReadonlyArray<{ label: string; icon: SimpleIconName }> = [
  { label: "Open in ChatGPT", icon: "openai" },
  { label: "Open in Claude", icon: "anthropic" },
  { label: "Open in Cursor", icon: "cursor" },
  { label: "View as Markdown", icon: "markdown" },
];

export function PageActionsVisual() {
  return (
    <Window
      icon={<FileText aria-hidden className="size-3" strokeWidth={1.5} />}
      meta="mdx"
      title="docs / configuration"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[20px] font-semibold tracking-[-0.03em] text-mk-fg">Configuration</p>
            <p className="mt-1 text-[13px] text-mk-fg/45">Every option in docs.config.ts</p>
          </div>
          <div className="flex shrink-0 items-stretch overflow-hidden rounded-md border border-mk-line text-[12px] text-mk-fg/75">
            <span className="flex items-center gap-1.5 px-2.5 py-1.5">
              <Copy aria-hidden className="size-3" strokeWidth={1.6} /> Copy page
            </span>
            <span className="flex items-center border-l border-mk-line bg-mk-fg/[0.06] px-1.5 text-mk-fg">
              <ChevronDown aria-hidden className="size-3" strokeWidth={1.6} />
            </span>
          </div>
        </div>
        <div aria-hidden className="mt-5 space-y-2.5">
          <div className="h-2 w-[86%] rounded-sm bg-mk-fg/[0.08]" />
          <div className="h-2 w-[72%] rounded-sm bg-mk-fg/[0.08]" />
          <div className="h-2 w-[60%] rounded-sm bg-mk-fg/[0.06]" />
        </div>
        <div className="absolute right-5 top-[4.75rem] w-52 overflow-hidden rounded-md border border-mk-line bg-mk-bg p-1 shadow-[0_16px_40px_rgb(0_0_0/0.12)] dark:shadow-[0_16px_40px_rgb(0_0_0/0.5)]">
          {openTargets.map((target, index) => (
            <div
              key={target.label}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded px-2 text-[12.5px]",
                index === 1 ? "bg-mk-fg/[0.07] text-mk-fg" : "text-mk-fg/65",
              )}
            >
              <SimpleIcon className="size-3.5 opacity-75" name={target.icon} />
              <span className="truncate">{target.label}</span>
              <ArrowUpRight aria-hidden className="ml-auto size-3 opacity-40" strokeWidth={1.5} />
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}

const scoreChecks: ReadonlyArray<{ label: string; status: "pass" | "warn" }> = [
  { label: "llms.txt", status: "pass" },
  { label: "Markdown routes", status: "pass" },
  { label: "MCP endpoint", status: "pass" },
  { label: "Cache headers", status: "warn" },
];

export function AgentScoreVisual() {
  const segments = 24;
  const filled = 23;

  return (
    <a
      aria-label="Score your docs for agent readiness"
      className={cn(
        frame,
        "group hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg",
      )}
      href="/score"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-mk-line px-4 font-mono text-[11px] text-mk-fg/45">
        <span className="flex items-center gap-2">
          <Gauge aria-hidden className="size-3" strokeWidth={1.5} /> agent score · acme.dev
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-3.5 transition-transform duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={1.5}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="flex items-end justify-between gap-4">
          <p className="flex items-baseline gap-1 text-mk-fg">
            <span className="text-5xl font-semibold tabular-nums tracking-[-0.06em]">96</span>
            <span className="font-mono text-[11px] text-mk-fg/40">/100</span>
          </p>
          <div aria-hidden className="mb-2 flex gap-[3px]">
            {Array.from({ length: segments }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-4 w-1 rounded-[1px]",
                  index < filled ? "bg-mk-fg/80" : "bg-mk-fg/12",
                )}
              />
            ))}
          </div>
        </div>
        <ul className="grid overflow-hidden rounded-md border border-mk-line">
          {scoreChecks.map((check) => (
            <li
              key={check.label}
              className="flex h-8 items-center justify-between gap-3 border-b border-mk-line px-3 text-[12.5px] text-mk-fg/70 last:border-b-0"
            >
              <span className="truncate">{check.label}</span>
              {check.status === "pass" ? (
                <Check aria-label="pass" className="size-3.5 text-mk-ok" strokeWidth={2} />
              ) : (
                <TriangleAlert
                  aria-label="warning"
                  className="size-3.5 text-amber-500"
                  strokeWidth={1.8}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </a>
  );
}

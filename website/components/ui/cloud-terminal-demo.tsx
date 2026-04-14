"use client";

import { useState } from "react";
import { CheckCircle2, CloudSyncIcon, GitBranch, Sparkles, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TerminalAnimationBackgroundGradient,
  TerminalAnimationBlinkingCursor,
  TerminalAnimationCommandBar,
  TerminalAnimationContainer,
  TerminalAnimationContent,
  TerminalAnimationOutput,
  TerminalAnimationRoot,
  TerminalAnimationTabList,
  TerminalAnimationTabTrigger,
  TerminalAnimationTrailingPrompt,
  TerminalAnimationWindow,
  type TabContent,
  type TerminalLine,
} from "@/components/ui/terminal-animation";

const cloudTerminalTabs: TabContent[] = [
  {
    label: "sync",
    command: "pnpm dlx @farming-labs/docs cloud sync",
    lines: [
      { text: "", delay: 60 },
      {
        text: "Connected repository: farming-labs/docs",
        color: "text-black/65 dark:text-white/62",
        delay: 220,
      },
      {
        text: "Scanning docs pages and API routes...",
        color: "text-black/50 dark:text-white/48",
        delay: 180,
      },
      {
        text: "Indexed 842 sections into the graph",
        color: "text-emerald-700 dark:text-[#9bf7d2]",
        delay: 260,
      },
      {
        text: "Synced nav, metadata, and page actions",
        color: "text-black/55 dark:text-white/52",
        delay: 170,
      },
      {
        text: "Dashboard synced for cloud-preview",
        color: "text-violet-700 dark:text-[#bba6ff]",
        delay: 250,
      },
    ],
  },
  {
    label: "draft pr",
    command: "pnpm dlx @farming-labs/docs cloud --draft-pr",
    lines: [
      { text: "", delay: 60 },
      {
        text: "Generating markdown from the synced graph...",
        color: "text-black/50 dark:text-white/48",
        delay: 220,
      },
      {
        text: "Wrote docs/cloud/search.mdx",
        color: "text-black/60 dark:text-white/58",
        delay: 170,
      },
      {
        text: "Wrote docs/cloud/deployments.mdx",
        color: "text-black/60 dark:text-white/58",
        delay: 160,
      },
      {
        text: "Updated docs/changelog/page.mdx",
        color: "text-black/60 dark:text-white/58",
        delay: 160,
      },
      {
        text: "Created branch: cloud/docs-sync-142",
        color: "text-sky-700 dark:text-[#7cc5ff]",
        delay: 220,
      },
      {
        text: "Opened draft PR #142 with 6 MDX updates",
        color: "text-emerald-700 dark:text-[#9bf7d2]",
        delay: 260,
      },
    ],
  },
  {
    label: "deploy",
    command: "pnpm dlx @farming-labs/docs deploy",
    lines: [
      { text: "", delay: 60 },
      {
        text: "Uploading docs bundle and generated MDX...",
        color: "text-black/50 dark:text-white/48",
        delay: 220,
      },
      { text: "Provisioning live URL", color: "text-black/55 dark:text-white/52", delay: 160 },
      {
        text: "Production: https://acme.docs.app",
        color: "text-violet-700 dark:text-[#bba6ff]",
        delay: 280,
      },
      {
        text: "Dashboard linked to deployment metadata",
        color: "text-black/60 dark:text-white/58",
        delay: 170,
      },
      {
        text: "Search, AI, and release status synced",
        color: "text-black/60 dark:text-white/58",
        delay: 170,
      },
      {
        text: "Deploy completed successfully",
        color: "text-emerald-700 dark:text-[#9bf7d2]",
        delay: 280,
      },
    ],
  },
];

const tabIcons = [CloudSyncIcon, GitBranch, UploadCloud] as const;
const projectPrompt = {
  arrow: "➜",
  name: "acme-docs",
  branch: "git:(main)",
  dirty: "✗",
} as const;

export function CloudTerminalDemo() {
  const [animationKey, setAnimationKey] = useState(0);

  return (
    <TerminalAnimationRoot
      key={animationKey}
      tabs={cloudTerminalTabs}
      defaultActiveTab={0}
      autoRotate
      rotationPauseMs={1800}
      hideCursorOnComplete={false}
      className="relative overflow-hidden rounded-none"
    >
      <TerminalAnimationBackgroundGradient className="opacity-50" />

      <button
        type="button"
        onClick={() => setAnimationKey((value) => value + 1)}
        className="absolute right-0 top-2 z-20 inline-flex cursor-pointer items-center justify-center gap-1 border border-black/10 bg-white/75 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-black/60 transition-colors hover:bg-white sm:right-3 sm:top-3 sm:gap-1.5 sm:px-2.5 sm:text-[10px] dark:border-white/10 dark:bg-black/45 dark:text-white/78 dark:hover:bg-black/65"
      >
        <CheckCircle2 className="size-3" />
        <span className="hidden sm:inline">replay</span>
      </button>

      <TerminalAnimationContainer className="relative z-10 mb-5 sm:mb-0 pt-8 px-0 sm:pt-0">
        <TerminalAnimationWindow className="h-[23rem] rounded-none border border-black/10 bg-white/92 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:h-[24rem] sm:border-t-0 dark:border-white/5 dark:bg-[#0b0b0d] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <TerminalAnimationContent className="h-[18.75rem] overflow-hidden px-3 py-3 sm:h-[18.5rem] sm:px-5 sm:py-5">
            <div className="flex flex-col items-start gap-1.5 leading-relaxed sm:flex-row sm:items-center sm:gap-2">
              <TerminalPrompt />
              <TerminalAnimationCommandBar
                className="min-w-0 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-black/80 sm:text-xs dark:text-white/84"
                cursor={
                  <TerminalAnimationBlinkingCursor className="h-[14px] w-[5px] bg-black/45 dark:bg-white/65" />
                }
              />
            </div>

            <TerminalAnimationOutput
              className="mt-2 space-y-1 overflow-hidden sm:mt-3"
              renderLine={(line: TerminalLine, _index: number, visible: boolean) => {
                if (!visible) return null;

                return (
                  <div className="leading-relaxed">
                    <span
                      className={cn(
                        "font-mono text-[10px] leading-relaxed sm:text-xs",
                        line.color ?? "text-black/55 dark:text-white/56",
                      )}
                    >
                      {line.text || "\u00A0"}
                    </span>
                  </div>
                );
              }}
            />

            <TerminalAnimationTrailingPrompt className="mt-2 flex items-center gap-2 leading-relaxed sm:mt-3">
              <TerminalPrompt />
              <TerminalAnimationBlinkingCursor className="h-[14px] w-[5px] bg-black/45 dark:bg-white/65" />
            </TerminalAnimationTrailingPrompt>
          </TerminalAnimationContent>

          <div className="border-t border-black/10 px-3 py-3 dark:border-white/10">
            <TerminalAnimationTabList className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
              {cloudTerminalTabs.map((tab, index) => {
                const Icon = tabIcons[index] ?? Sparkles;

                return (
                  <TerminalAnimationTabTrigger
                    key={tab.label}
                    index={index}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-1 rounded-none border px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors sm:w-auto sm:justify-start sm:gap-1.5 sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em]",
                      "data-[state=active]:border-black/15 data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:border-white/20 dark:data-[state=active]:bg-white dark:data-[state=active]:text-black",
                      "data-[state=inactive]:border-black/10 data-[state=inactive]:text-black/45 data-[state=inactive]:hover:border-black/16 data-[state=inactive]:hover:text-black/75 dark:data-[state=inactive]:border-white/10 dark:data-[state=inactive]:text-white/45 dark:data-[state=inactive]:hover:border-white/16 dark:data-[state=inactive]:hover:text-white/75",
                    )}
                  >
                    <Icon className="size-3" />
                    {tab.label}
                  </TerminalAnimationTabTrigger>
                );
              })}
            </TerminalAnimationTabList>
          </div>
        </TerminalAnimationWindow>
      </TerminalAnimationContainer>
    </TerminalAnimationRoot>
  );
}

function TerminalPrompt() {
  return (
    <span className="inline-flex max-w-full shrink-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[9px] sm:text-[11px]">
      <span className="select-none text-emerald-600 dark:text-[#7ce38b]">{projectPrompt.arrow}</span>
      <span className="text-sky-700 dark:text-[#8bb8ff]">{projectPrompt.name}</span>
      <span className="text-violet-700 dark:text-[#d8a7ff]">{projectPrompt.branch}</span>
      <span className="select-none text-rose-500 dark:text-[#ff8f8f]">{projectPrompt.dirty}</span>
    </span>
  );
}

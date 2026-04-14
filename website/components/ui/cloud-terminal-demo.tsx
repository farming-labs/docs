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
      { text: "Connected repository: farming-labs/docs", color: "text-white/62", delay: 220 },
      { text: "Scanning docs pages and API routes...", color: "text-white/48", delay: 180 },
      { text: "Indexed 842 sections into the graph", color: "text-[#9bf7d2]", delay: 260 },
      { text: "Synced nav, metadata, and page actions", color: "text-white/52", delay: 170 },
      { text: "Dashboard synced for cloud-preview", color: "text-[#bba6ff]", delay: 250 },
    ],
  },
  {
    label: "draft pr",
    command: "pnpm dlx @farming-labs/docs cloud --draft-pr",
    lines: [
      { text: "", delay: 60 },
      {
        text: "Generating markdown from the synced graph...",
        color: "text-white/48",
        delay: 220,
      },
      { text: "Wrote docs/cloud/search.mdx", color: "text-white/58", delay: 170 },
      { text: "Wrote docs/cloud/deployments.mdx", color: "text-white/58", delay: 160 },
      { text: "Updated docs/changelog/page.mdx", color: "text-white/58", delay: 160 },
      { text: "Created branch: cloud/docs-sync-142", color: "text-[#7cc5ff]", delay: 220 },
      { text: "Opened draft PR #142 with 6 MDX updates", color: "text-[#9bf7d2]", delay: 260 },
    ],
  },
  {
    label: "deploy",
    command: "pnpm dlx @farming-labs/docs deploy",
    lines: [
      { text: "", delay: 60 },
      {
        text: "Uploading docs bundle and generated MDX...",
        color: "text-white/48",
        delay: 220,
      },
      { text: "Provisioning live URL", color: "text-white/52", delay: 160 },
      { text: "Production: https://acme.docs.app", color: "text-[#bba6ff]", delay: 280 },
      { text: "Dashboard linked to deployment metadata", color: "text-white/58", delay: 170 },
      { text: "Search, AI, and release status synced", color: "text-white/58", delay: 170 },
      { text: "Deploy completed successfully", color: "text-[#9bf7d2]", delay: 280 },
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
      alwaysDark
      className="relative overflow-hidden rounded-none"
    >
      <TerminalAnimationBackgroundGradient className="opacity-50" />

      <button
        type="button"
        onClick={() => setAnimationKey((value) => value + 1)}
        className="absolute right-0 top-2 z-20 inline-flex cursor-pointer items-center justify-center gap-1 border border-white/10 bg-black/45 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/78 transition-colors hover:bg-black/65 sm:right-3 sm:top-3 sm:gap-1.5 sm:px-2.5 sm:text-[10px]"
      >
        <CheckCircle2 className="size-3" />
        <span className="hidden sm:inline">replay</span>
      </button>

      <TerminalAnimationContainer className="relative z-10 mb-5 sm:mb-0 pt-8 px-0 sm:pt-0">
        <TerminalAnimationWindow className="h-[23rem] rounded-none border-white/5 bg-[#0b0b0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-[24rem] sm:border-t-0">
          <TerminalAnimationContent className="h-[18.75rem] overflow-hidden px-3 py-3 sm:h-[18.5rem] sm:px-5 sm:py-5">
            <div className="flex flex-col items-start gap-1.5 leading-relaxed sm:flex-row sm:items-center sm:gap-2">
              <TerminalPrompt />
              <TerminalAnimationCommandBar
                className="min-w-0 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-white/84 sm:text-xs"
                cursor={<TerminalAnimationBlinkingCursor className="h-[14px] w-[5px]" />}
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
                        line.color ?? "text-white/56",
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
              <TerminalAnimationBlinkingCursor className="h-[14px] w-[5px]" />
            </TerminalAnimationTrailingPrompt>
          </TerminalAnimationContent>

          <div className="border-t border-white/10 px-3 py-3">
            <TerminalAnimationTabList className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
              {cloudTerminalTabs.map((tab, index) => {
                const Icon = tabIcons[index] ?? Sparkles;

                return (
                  <TerminalAnimationTabTrigger
                    key={tab.label}
                    index={index}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-1 rounded-none border px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors sm:w-auto sm:justify-start sm:gap-1.5 sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em]",
                      "data-[state=active]:border-white/20 data-[state=active]:bg-white data-[state=active]:text-black",
                      "data-[state=inactive]:border-white/10 data-[state=inactive]:text-white/45 data-[state=inactive]:hover:border-white/16 data-[state=inactive]:hover:text-white/75",
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
      <span className="select-none text-[#7ce38b]">{projectPrompt.arrow}</span>
      <span className="text-[#8bb8ff]">{projectPrompt.name}</span>
      <span className="text-[#d8a7ff]">{projectPrompt.branch}</span>
      <span className="select-none text-[#ff8f8f]">{projectPrompt.dirty}</span>
    </span>
  );
}

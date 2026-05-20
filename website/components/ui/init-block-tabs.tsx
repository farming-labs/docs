"use client";

import { useState } from "react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import CopyCommand from "@/components/ui/copy-command";
import CopyCommandTemplate from "@/components/ui/copy-command-template";
import { AGENT_FRIENDLY_DOCS_PROMPT } from "@/lib/agent-friendly-docs-prompt";

const TAB_EXISTING = "existing";
const TAB_SCRATCH = "scratch";
const TAB_AGENT_PROMPT = "agent-prompt";

const TABS = [
  { id: TAB_AGENT_PROMPT, label: "Agent prompt" },
  { id: TAB_EXISTING, label: "Existing project" },
  { id: TAB_SCRATCH, label: "From scratch" },
] as const;

type QuickStartTab = (typeof TABS)[number]["id"];

export default function InitBlockTabs() {
  const [active, setActive] = useState<QuickStartTab>(TAB_AGENT_PROMPT);

  return (
    <>
      <div className="flex w-full items-center gap-0 overflow-x-auto border border-b-0 border-black/[8%] dark:border-white/[8%] -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`relative shrink-0 px-4 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors ${
              active === tab.id
                ? "text-black dark:text-white"
                : "text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"
            }`}
          >
            {tab.label}
            {active === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-black dark:bg-white" />
            )}
          </button>
        ))}
      </div>

      <div className="relative flex min-h-[126px] flex-col overflow-hidden border border-t-black/[8%] border-black/[8%] bg-black/[0.02] dark:border-t-white/[8%] dark:border-white/[8%] dark:bg-white/[0.02]">
        <div className="-pl-20 dark:block hidden">
          <AnimatedBackground />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-white/70 dark:from-black/70 via-white/85 dark:via-black/85 to-white/95 dark:to-black/95 md:from-white/10 dark:md:from-black/10 md:via-white/50 dark:md:via-black/50 md:to-white/80 dark:md:to-black/80 pointer-events-none opacity-100 md:mix-blend-overlay" />
        <div
          className="absolute inset-0 z-[999] pointer-events-none opacity-80 md:opacity-80 mix-blend-overlay"
          style={{
            backgroundImage: "url(/shades.png)",
            backgroundRepeat: "repeat",
            backgroundSize: "100% 100%",
          }}
        />
        {active === TAB_EXISTING && (
          <>
            <div className="relative z-[999] p-5 sm:p-4 pb-0 sm:pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="flex-1">
                  <p className="text-sm text-black/60 dark:text-white/60 mb-1">
                    Easily scaffold your docs with the CLI. It auto-detects your framework and
                    scaffolds everything.
                  </p>
                  <p className="text-[11px] font-mono text-black/30 dark:text-white/30 uppercase tracking-wider">
                    Setup beautiful documentation in seconds
                  </p>
                </div>
              </div>
            </div>
            <div className="relative z-[999] -mb-px mt-auto flex justify-end">
              <CopyCommand
                className="backdrop-blur-sm md:backdrop-blur-none border-r-0 border-b-0 sm:border-b"
                command="pnpx @farming-labs/docs init"
              />
            </div>
          </>
        )}
        {active === TAB_SCRATCH && (
          <>
            <div className="relative z-[999] p-5 sm:p-4 pb-0 sm:pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="flex-1">
                  <p className="text-sm text-black/60 dark:text-white/60 mb-1">
                    Use the same command with{" "}
                    <code className="text-black/80 dark:text-white/80 font-mono text-xs">
                      --template
                    </code>
                  </p>
                  <p className="text-[11px] font-mono text-black/30 dark:text-white/30 uppercase tracking-wider">
                    Copy the command when the template you want is shown
                  </p>
                </div>
              </div>
            </div>
            <div className="relative z-[999] -mb-px mt-auto flex justify-end">
              <CopyCommandTemplate className="backdrop-blur-sm md:backdrop-blur-none border-r-0 border-b-0 sm:border-b" />
            </div>
          </>
        )}
        {active === TAB_AGENT_PROMPT && (
          <>
            <div className="relative z-[999] p-5 sm:p-4 pb-0 sm:pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="flex-1">
                  <p className="text-sm text-black/60 dark:text-white/60 mb-1">
                    Copy a ready-to-paste prompt for agent-friendly docs that stay human-first and
                    expose the right machine-readable surfaces.
                  </p>
                  <p className="text-[11px] font-mono text-black/30 dark:text-white/30 uppercase tracking-wider">
                    Raw prompt, no website or brand inputs
                  </p>
                </div>
              </div>
            </div>
            <div className="relative z-[999] -mb-px mt-auto flex justify-end">
              <CopyCommand
                className="backdrop-blur-sm md:backdrop-blur-none border-r-0 border-b-0 sm:border-b"
                command="Copy agent-friendly docs prompt"
                copyText={AGENT_FRIENDLY_DOCS_PROMPT}
                icon="sparkles"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

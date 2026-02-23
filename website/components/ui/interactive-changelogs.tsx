"use client";

import { Copy, GitPullRequest, Hash, Check } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

const releases = [
  {
    version: "v0.0.1",
    title: "v0.0.1: Initial Release",
    date: "Feb 19, 2026",
    excerpt:
      "The first release of @farming-labs/docs — a modern, flexible MDX documentation framework with built-in themes, AI search, multi-framework support, and a live theme customizer.",
    changes: [
      { category: "Core Framework", items: [
        "MDX-based documentation with file-system routing",
        "Built-in full-text search with AI-powered answers",
        "Theme system with createTheme and extendTheme helpers",
        "Configurable sidebar ordering (numeric, alphabetical, manual)",
        "Table of contents with configurable depth and style",
        "Page actions (copy page, edit on GitHub)",
        "Configurable \"Last updated\" positioning (footer or below title)",
        "Page navigation cards (previous / next)",
        "Breadcrumb navigation",
      ]},
      { category: "Built-in Themes", items: [
        "Default — neutral palette with indigo accent",
        "Colorful — warm amber accent, Inter typography, directional TOC",
        "Darksharp — all-black with sharp corners, zero border-radius",
        "Pixel Border — refined dark UI inspired by better-auth.com",
        "Shiny — Clerk-inspired, purple accents, polished light/dark design",
        "DarkBold — Vercel-inspired monochrome with Geist typography",
        "GreenTree — Mintlify-inspired, emerald green accent, compact sidebar",
      ]},
      { category: "Theme Customizer", items: [
        "Interactive customizer panel with live preview",
        "Color pickers for primary, background, foreground, muted, border, ring",
        "Layout controls (sidebar width, content width, TOC width)",
        "Sidebar style toggle (default, bordered)",
        "TOC style toggle (default, directional)",
        "AI mode selection (floating, search, sidebar-icon)",
        "Export-to-code — generates docs.config.tsx and global.css snippets",
        "Preset switching with 6 built-in presets",
        "\"Explore more themes\" link to dedicated themes page",
        "Cache-busted preset CSS loading",
      ]},
      { category: "AI Features", items: [
        "Floating AI chat button with configurable position",
        "Full-modal AI chat dialog",
        "Sidebar-icon AI mode (Ask AI next to search bar)",
        "Pure AI modal without search tabs",
        "Suggested questions configuration",
        "Custom loading component support",
      ]},
      { category: "Multi-Framework Support", items: [
        "Next.js — first-class support with App Router",
        "Svelte — community adapter with svelte:head CSS injection",
        "Astro — community adapter with set:html style injection",
        "Nuxt — community adapter with useHead() computed CSS",
        "Configurable sidebar width working across all frameworks",
      ]},
      { category: "Themes Page & Documentation", items: [
        "Dedicated /themes showcase page with \"Try it live\" links",
        "Individual docs pages for all 7 themes with usage, defaults, and customization",
        "Creating custom themes guide",
        "Extending existing themes guide",
      ]},
    ],
  },
];

export function Component() {
  const [copiedVersion, setCopiedVersion] = useState<string | null>(null);

  function copyLink(version: string) {
    const url = `${window.location.origin}/changelog#${version}`;
    navigator.clipboard.writeText(url);
    setCopiedVersion(version);
    setTimeout(() => setCopiedVersion(null), 2000);
  }

  return (
    <section className="relative w-full overflow-hidden bg-white dark:bg-black text-black dark:text-white min-h-dvh">
      {/* shader header */}
      <div className="relative w-full overflow-hidden">
        <AnimatedBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />

        <div className="relative container mx-auto max-w-5xl px-6 py-16 text-left">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80 dark:text-white/80">
              <GitPullRequest className="size-4" />
              <p className="font-mono uppercase">Changelog</p>
            </div>
            <h1 className="text-4xl tracking-tight font-bold text-white dark:text-white leading-snug">
              Latest Enhancements
              <br /> & Platform News
            </h1>
            <p className="text-white/60 dark:text-white/50 text-sm max-w-lg mt-1">
              All notable changes to @farming-labs/docs are documented here.
              Click a version anchor to get a shareable link.
            </p>
          </div>
        </div>
      </div>

      {/* version quick-nav */}
      <div className="border-y border-black/[8%] dark:border-white/[8%] bg-black/[2%] dark:bg-white/[2%]">
        <div className="container mx-auto max-w-5xl px-6 py-3 flex items-center gap-4 overflow-x-auto">
          <span className="text-[11px] uppercase tracking-wider text-black/30 dark:text-white/30 font-mono shrink-0">
            Jump to
          </span>
          {releases.map((r) => (
            <a
              key={r.version}
              href={`#${r.version}`}
              className="text-[12px] font-mono text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors shrink-0 hover:no-underline"
            >
              {r.version}
            </a>
          ))}
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-6">
        {releases.map((item, idx) => (
          <div
            key={idx}
            id={item.version}
            className="relative flex flex-col lg:flex-row w-full py-16 gap-6 lg:gap-0 scroll-mt-20"
          >
            <div className="lg:sticky top-20 h-fit shrink-0">
              <div className="lg:w-40">
                <a
                  href={`#${item.version}`}
                  className="group flex items-center gap-1.5 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors hover:no-underline"
                >
                  <Hash className="size-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  <span className="text-sm font-mono font-semibold">
                    {item.version}
                  </span>
                </a>
                <time className="text-black/40 dark:text-white/40 text-sm font-medium block mt-1">
                  {item.date}
                </time>
              </div>
            </div>

            <div className="flex max-w-prose flex-col gap-5 lg:mx-auto flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl lg:text-3xl font-medium">
                    {item.title}
                  </h3>
                  <p className="text-black/50 dark:text-white/50 text-sm font-medium leading-relaxed mt-2">
                    {item.excerpt}
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 shrink-0 mt-1"
                        onClick={() => copyLink(item.version)}
                      >
                        {copiedVersion === item.version ? (
                          <Check className="size-4 text-green-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{copiedVersion === item.version ? "Copied!" : "Copy link"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="space-y-6">
                {item.changes.map((group, gIdx) => (
                  <div key={gIdx}>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-black/70 dark:text-white/70 mb-2 font-mono">
                      {group.category}
                    </h4>
                    <ul className="space-y-1.5">
                      {group.items.map((line, lIdx) => (
                        <li
                          key={lIdx}
                          className="flex items-start gap-2 text-sm text-black/60 dark:text-white/60 leading-relaxed"
                        >
                          <span className="mt-2 size-1 rounded-full bg-black/30 dark:bg-white/30 shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {idx < releases.length - 1 && (
              <div className="bg-black/[6%] dark:bg-white/[6%] absolute bottom-0 left-0 right-0 h-px" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

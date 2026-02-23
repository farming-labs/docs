"use client";

import { ArrowLeft, Copy, GitPullRequest, Hash, Check, Tag, Pin } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import Link from "next/link";

interface Release {
  version: string;
  title: string;
  date: string;
  excerpt: string;
  isBeta?: boolean;
  pinned?: boolean;
  changes: { category: string; items: string[] }[];
}

const releases: Release[] = [
  {
    version: "v0.0.1",
    title: "v0.0.1: Initial Release",
    date: "Feb 19, 2026",
    pinned: true,
    excerpt:
      "The first stable release of @farming-labs/docs — a modern, flexible MDX documentation framework with 7 built-in themes, AI search, multi-framework support, a live theme customizer, and an interactive changelog.",
    changes: [
      {
        category: "Highlights",
        items: [
          "7 built-in themes: Default, Colorful, Darksharp, Pixel Border, Shiny, DarkBold, GreenTree",
          "Live theme customizer with preset switching and export-to-code",
          "AI-powered search with floating, search, and sidebar-icon modes",
          "Multi-framework: Next.js, Svelte, Astro, Nuxt",
          "Interactive changelog with version-anchored links",
          "Dedicated /themes showcase page",
          "Mobile-responsive sidebar (layout config scoped to desktop)",
        ],
      },
    ],
  },

  {
    version: "v0.0.2-beta.16-20",
    title: "beta.16–20: Polish, Docs & Mobile Fixes",
    date: "Feb 18–19, 2026",
    isBeta: true,
    excerpt:
      "Final stretch of betas — CSS specificity fixes, theme documentation, changelog page, and mobile sidebar improvements.",
    changes: [
      {
        category: "Documentation & Pages",
        items: [
          "Interactive /changelog page with animated header and version-anchored links",
          "Individual docs pages for all 7 themes with usage, defaults, and customization",
          "Updated main themes overview to list all 7 themes with links",
          '"Explore more themes" link in customizer navigating to /docs/themes',
        ],
      },
      {
        category: "Bug Fixes",
        items: [
          "Scoped --fd-sidebar-width and --fd-toc-width to desktop via @media (min-width: 1024px)",
          "Fixed pixel-border bleedthrough: search button, sidebar folders, breadcrumbs, scrollbars, selection colors",
          "Cache-busted preset CSS fetches to prevent stale styles",
          "Comprehensive rounded-* class overrides for theme isolation",
        ],
      },
    ],
  },
  {
    version: "v0.0.2-beta.11-15",
    title: "beta.11–15: GreenTree, AI Sidebar & Customizer",
    date: "Feb 15–17, 2026",
    isBeta: true,
    excerpt:
      "Introduced the GreenTree theme, AI sidebar-icon mode, configurable last-updated positioning, and customizer integration.",
    changes: [
      {
        category: "GreenTree Theme",
        items: [
          "Mintlify-inspired preset with emerald accent #0D9373",
          "Inter typography, non-collapsible sidebar categories, compact 240px width",
          "Integrated into customizer with sidebar-icon AI mode preset",
        ],
      },
      {
        category: "AI Features",
        items: [
          "New sidebar-icon AI mode — Ask AI button next to the search bar",
          "Pure AI modal dialog without search tabs",
          "Dynamic DOM injection for customizer preview",
        ],
      },
      {
        category: "Configuration",
        items: [
          'lastUpdated.position: "footer" | "below-title" (default: footer)',
          "Footer position renders Last updated to the right of Edit on GitHub",
        ],
      },
    ],
  },
  {
    version: "v0.0.2-beta.5-10",
    title: "beta.5–10: Themes, Layout & Cross-Framework",
    date: "Feb 11–14, 2026",
    isBeta: true,
    excerpt:
      "Added Shiny and DarkBold themes, configurable sidebar/TOC width, page actions alignment, and cross-framework layout support.",
    changes: [
      {
        category: "New Themes",
        items: [
          "Shiny — Clerk-inspired, purple accent hsl(256, 100%, 64%), polished light/dark design",
          "DarkBold — Vercel-inspired monochrome, Geist typography, tight letter-spacing",
        ],
      },
      {
        category: "Layout & Configuration",
        items: [
          "ui.layout.sidebarWidth and ui.layout.tocWidth config options with CSS variable injection",
          'pageActions.alignment: "left" | "right" (default: left)',
          "Transparent backgrounds for search and Ask AI button triggers",
        ],
      },
      {
        category: "Cross-Framework",
        items: [
          "Svelte: CSS injection via <svelte:head>",
          "Astro: CSS injection via set:html style block",
          "Nuxt: CSS injection via useHead() computed property",
        ],
      },
    ],
  },
  {
    version: "v0.0.2-beta.1-4",
    title: "beta.1–4: Core, Themes & Customizer",
    date: "Feb 7–10, 2026",
    isBeta: true,
    excerpt:
      "The foundational betas — MDX docs engine, file-system routing, search, four initial themes, the /themes showcase, and the live theme customizer.",
    changes: [
      {
        category: "Core Framework",
        items: [
          "MDX-based documentation with file-system routing",
          "Built-in full-text search with AI-powered answers",
          "createTheme and extendTheme helpers",
          "Configurable sidebar ordering (numeric, alphabetical, manual)",
          "Table of contents, page actions, breadcrumbs, nav cards",
          "Next.js first-class support with Svelte, Astro, Nuxt adapters",
        ],
      },
      {
        category: "Initial Themes",
        items: [
          "Default — neutral palette with indigo accent #6366f1",
          "Darksharp — all-black with sharp corners, zero border-radius",
          "Pixel Border — refined dark UI inspired by better-auth.com",
          "Colorful — warm amber accent, Inter typography, directional TOC",
        ],
      },
      {
        category: "Theme Customizer & Showcase",
        items: [
          "Live customizer with color pickers, layout controls, sidebar/TOC style toggles",
          "Export-to-code: generates docs.config.tsx and global.css snippets",
          "Preset switching with 6 built-in presets",
          'Dedicated /themes showcase page with "Try it live" links',
        ],
      },
    ],
  },
];

const majorReleases = releases.filter((r) => !r.isBeta);
const pinnedReleases = releases.filter((r) => r.pinned);
const unpinnedReleases = releases.filter((r) => !r.pinned);
const orderedReleases = [...pinnedReleases, ...unpinnedReleases];

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
      <div className="absolute max-w-[90%] mx-auto top-6 left-6 md:left-24 flex text-xs font-medium z-[999] gap-2">
        <Link
          href={"/"}
          className="hover:text-white transition-colors hover:no-underline font-mono uppercase text-black/50 dark:text-white/50"
        >
          Home <span className="ml-2 text-black/50 dark:text-white/50">/</span>
        </Link>
        <GitPullRequest className="size-4" />
        <p className="font-mono uppercase">Changelog</p>
      </div>
      <div className="absolute w-full top-14 right-0 z-[999] h-px bg-white/[8%]" />
      <div className="relative max-w-full md:max-w-[90%] mx-auto overflow-hidden">
        <AnimatedBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/60" />
        <div className="relative container h-full mx-auto max-w-full px-6 pt-20 md:pt-32 pb-6 text-left">
          <div className="absolute left-0 md:left-0 top-0 h-full w-px bg-white/[8%]" />
          <div className="absolute right-0 md:right-0 top-0 h-full w-px bg-white/[8%]" />
          <div className="flex flex-col gap-3 h-full">

            <div className="flex flex-col gap-2 justify-end items-start">
              <h1 className="text-4xl tracking-tighter md:font-bold text-white dark:text-white leading-snug">
                Latest Updates
                <br /> & Improvements
              </h1>
              <p className="text-white/60 dark:text-white/50 text-sm max-w-lg mt-1">
                All notable changes to{" "}
                <code className="font-mono text-white/80 dark:text-white/80">
                  @farming-labs/docs
                </code>{" "}
                are documented here & other related libraries complementing it
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* version quick-nav — major releases only */}
      <div className="border-y border-black/[8%] dark:border-white/[8%] bg-black/[2%] dark:bg-white/[2%]">
        <div className="container mx-auto max-w-5xl px-6 py-3 flex items-center gap-4 overflow-x-auto">
          <span className="text-[11px] uppercase tracking-wider text-black/30 dark:text-white/30 font-mono shrink-0">
            Jump to:
          </span>
          {majorReleases.map((r) => (
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

      {/* releases — pinned first, then the rest */}
      <div className="container mx-auto max-w-5xl px-6">
        {orderedReleases.map((item, idx) => (
          <div
            key={item.version}
            id={item.version}
            className={`relative flex flex-col lg:flex-row w-full gap-6 lg:gap-0 scroll-mt-20 ${item.isBeta ? "py-10" : "py-16"
              }`}
          >
            <div className="lg:sticky top-20 h-fit shrink-0">
              <div className="lg:w-40">
                <a
                  href={`#${item.version}`}
                  className="group flex items-center gap-1.5 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors hover:no-underline"
                >
                  <Hash className="size-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  <span
                    className={`font-mono font-semibold ${item.isBeta ? "text-xs" : "text-sm"}`}
                  >
                    {item.version}
                  </span>
                </a>
                <time className="text-black/40 font-mono text-[11px] uppercase dark:text-white/40 tracking-tight block mt-1">
                  {item.date}
                </time>
                {item.pinned && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400/80">
                    <Pin className="size-2.5" />
                    pinned
                  </span>
                )}
                {item.isBeta && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400/70">
                    <Tag className="size-2.5" />
                    beta
                  </span>
                )}
              </div>
            </div>

            <div className="flex max-w-prose flex-col gap-4 lg:mx-auto flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    className={`font-medium ${item.isBeta ? "text-lg lg:text-xl" : "text-2xl lg:text-3xl"}`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-black/50 dark:text-white/50 text-sm font-medium leading-relaxed mt-2">
                    {item.excerpt}
                  </p>
                </div>
              </div>

              <div className={item.isBeta ? "space-y-4" : "space-y-6"}>
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

            {idx < orderedReleases.length - 1 && (
              <div
                className={`absolute bottom-0 left-0 right-0 h-px ${item.isBeta && orderedReleases[idx + 1]?.isBeta
                  ? "bg-black/[4%] dark:bg-white/[4%]"
                  : "bg-black/[8%] dark:bg-white/[8%]"
                  }`}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

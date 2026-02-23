"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { highlight } from "sugar-high";

type PresetKey = "default" | "colorful" | "darksharp" | "pixel-border" | "shiny" | "darkbold";
type SidebarStyle = "default" | "bordered" | "floating";
type TocStyle = "default" | "directional";

interface Colors {
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
  ring: string;
}

type AIMode = "floating" | "search" | "sidebar-icon";
type AIPosition = "bottom-right" | "bottom-left" | "bottom-center";
type AIFloatingStyle = "panel" | "modal" | "popover" | "full-modal";

interface ThemeState {
  preset: PresetKey;
  colors: Colors;
  radius: string;
  sidebar: SidebarStyle;
  toc: { enabled: boolean; depth: number; style: TocStyle };
  ai: {
    enabled: boolean;
    mode: AIMode;
    position: AIPosition;
    floatingStyle: AIFloatingStyle;
  };
  breadcrumb: boolean;
  themeToggle: { enabled: boolean; default: "light" | "dark" | "system" };
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: Record<
  PresetKey,
  {
    label: string;
    desc: string;
    cssImport: string;
    themeImport: { from: string; name: string };
    colors: Colors;
    sidebar: SidebarStyle;
    toc: { style: TocStyle };
    radius: string;
    ai?: { mode: AIMode };
  }
> = {
  default: {
    label: "Default",
    desc: "Neutral palette, indigo accent",
    cssImport: "@farming-labs/theme/default/css",
    themeImport: { from: "@farming-labs/theme", name: "fumadocs" },
    colors: {
      primary: "#6366f1",
      primaryForeground: "#ffffff",
      background: "#0c0c0c",
      foreground: "#fafafa",
      muted: "#262626",
      mutedForeground: "#a3a3a3",
      border: "#262626",
      card: "#141414",
      ring: "#6366f1",
    },
    sidebar: "default",
    toc: { style: "default" },
    radius: "0.5rem",
  },
  colorful: {
    label: "Colorful",
    desc: "Warm amber accent, tree-line TOC",
    cssImport: "@farming-labs/theme/colorful/css",
    themeImport: { from: "@farming-labs/theme/colorful", name: "colorful" },
    colors: {
      // Match examples/next colorful baseline exactly
      primary: "hsl(45, 100%, 60%)",
      primaryForeground: "hsl(0, 0%, 5%)",
      background: "hsl(0, 0%, 7.04%)",
      foreground: "hsl(0, 0%, 92%)",
      muted: "hsl(0, 0%, 12.9%)",
      mutedForeground: "hsla(0, 0%, 70%, 0.8)",
      border: "hsla(0, 0%, 40%, 20%)",
      card: "hsl(0, 0%, 9.8%)",
      ring: "hsl(45, 90%, 55%)",
    },
    sidebar: "bordered",
    toc: { style: "directional" },
    radius: "0.75rem",
  },
  darksharp: {
    label: "Darksharp",
    desc: "All-black, sharp edges",
    cssImport: "@farming-labs/theme/darksharp/css",
    themeImport: { from: "@farming-labs/theme/darksharp", name: "darksharp" },
    colors: {
      primary: "#fafaf9",
      primaryForeground: "#0c0a09",
      background: "#000000",
      foreground: "#fafaf9",
      muted: "#1c1917",
      mutedForeground: "#a8a29e",
      border: "#292524",
      card: "#0c0a09",
      ring: "#fafaf9",
    },
    sidebar: "default",
    toc: { style: "default" },
    radius: "0.2rem",
  },
  "pixel-border": {
    label: "Pixel Border",
    desc: "Clean dark UI, visible borders",
    cssImport: "@farming-labs/theme/pixel-border/css",
    themeImport: {
      from: "@farming-labs/theme/pixel-border",
      name: "pixelBorder",
    },
    colors: {
      primary: "#fbfbfa",
      primaryForeground: "#0a0a0a",
      background: "#050505",
      foreground: "#fafafa",
      muted: "#262626",
      mutedForeground: "#8c8c8c",
      border: "#262626",
      card: "#0d0d0d",
      ring: "#fbfbfa",
    },
    sidebar: "bordered",
    toc: { style: "default" },
    radius: "0px",
  },
  shiny: {
    label: "Shiny",
    desc: "Clerk-inspired, polished purple",
    cssImport: "@farming-labs/theme/shiny/css",
    themeImport: { from: "@farming-labs/theme/shiny", name: "shiny" },
    colors: {
      primary: "hsl(256, 100%, 72%)",
      primaryForeground: "#ffffff",
      background: "hsl(240, 10%, 7%)",
      foreground: "hsl(0, 0%, 95%)",
      muted: "hsl(240, 5%, 16%)",
      mutedForeground: "hsl(240, 4%, 58%)",
      border: "hsl(240, 5%, 18%)",
      card: "hsl(240, 8%, 10%)",
      ring: "hsl(256, 85%, 65%)",
    },
    sidebar: "default",
    toc: { style: "default" },
    radius: "0.75rem",
  },
  darkbold: {
    label: "DarkBold",
    desc: "Pure monochrome, Geist typography",
    cssImport: "@farming-labs/theme/darkbold/css",
    themeImport: { from: "@farming-labs/theme/darkbold", name: "darkbold" },
    colors: {
      primary: "#ffffff",
      primaryForeground: "#000000",
      background: "#0a0a0a",
      foreground: "#ededed",
      muted: "#1a1a1a",
      mutedForeground: "#888888",
      border: "#333333",
      card: "#111111",
      ring: "#ffffff",
    },
    sidebar: "default",
    toc: { style: "default" },
    radius: "0.5rem",
  },
};

const PRIMARY_SWATCHES = [
  { color: "#ef4444", name: "Red" },
  { color: "#f97316", name: "Orange" },
  { color: "#eab308", name: "Yellow" },
  { color: "#22c55e", name: "Green" },
  { color: "#14b8a6", name: "Teal" },
  { color: "#3b82f6", name: "Blue" },
  { color: "#6366f1", name: "Indigo" },
  { color: "#8b5cf6", name: "Violet" },
  { color: "#ec4899", name: "Pink" },
  { color: "#fafafa", name: "White" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToContrastFg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 140 ? "#0a0a0a" : "#fafafa";
}

// ─── Code Generators ──────────────────────────────────────────────────────────

function generateCSS(state: ThemeState): string {
  const preset = PRESETS[state.preset];
  const lines: string[] = [];
  lines.push(`@import "tailwindcss";`);
  lines.push(`@import "${preset.cssImport}";`);
  lines.push(``);

  const overrides: string[] = [];
  const dc = state.colors;
  const pc = preset.colors;
  if (dc.primary !== pc.primary) overrides.push(`  --color-fd-primary: ${dc.primary};`);
  if (dc.primaryForeground !== pc.primaryForeground)
    overrides.push(`  --color-fd-primary-foreground: ${dc.primaryForeground};`);
  if (dc.background !== pc.background) overrides.push(`  --color-fd-background: ${dc.background};`);
  if (dc.foreground !== pc.foreground) overrides.push(`  --color-fd-foreground: ${dc.foreground};`);
  if (dc.muted !== pc.muted) overrides.push(`  --color-fd-muted: ${dc.muted};`);
  if (dc.mutedForeground !== pc.mutedForeground)
    overrides.push(`  --color-fd-muted-foreground: ${dc.mutedForeground};`);
  if (dc.border !== pc.border) overrides.push(`  --color-fd-border: ${dc.border};`);
  if (dc.card !== pc.card) overrides.push(`  --color-fd-card: ${dc.card};`);
  if (dc.ring !== pc.ring) overrides.push(`  --color-fd-ring: ${dc.ring};`);

  if (overrides.length > 0) {
    lines.push(`/* Custom color overrides */`);
    lines.push(`:root {`);
    lines.push(...overrides);
    lines.push(`}`);
  }

  return lines.join("\n");
}

function generateConfig(state: ThemeState): string {
  const preset = PRESETS[state.preset];
  const { themeImport } = preset;
  const lines: string[] = [];

  lines.push(`import { defineDocs } from "@farming-labs/docs";`);
  lines.push(`import { ${themeImport.name} } from "${themeImport.from}";`);
  lines.push(``);
  lines.push(`export default defineDocs({`);
  lines.push(`  entry: "docs",`);

  const uiOverrides: string[] = [];
  if (state.sidebar !== preset.sidebar)
    uiOverrides.push(`      sidebar: { style: "${state.sidebar}" },`);

  const tocParts: string[] = [];
  if (!state.toc.enabled) tocParts.push(`enabled: false`);
  if (state.toc.depth !== 3) tocParts.push(`depth: ${state.toc.depth}`);
  if (state.toc.style !== preset.toc.style) tocParts.push(`style: "${state.toc.style}"`);
  if (tocParts.length > 0) uiOverrides.push(`      toc: { ${tocParts.join(", ")} },`);

  if (uiOverrides.length > 0) {
    lines.push(`  theme: ${themeImport.name}({`);
    lines.push(`    ui: {`);
    lines.push(`      layout: {`);
    uiOverrides.forEach((l) => lines.push(l));
    lines.push(`      },`);
    lines.push(`    },`);
    lines.push(`  }),`);
  } else {
    lines.push(`  theme: ${themeImport.name}(),`);
  }

  if (state.ai.enabled) {
    lines.push(`  ai: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    mode: "${state.ai.mode}",`);
    if (state.ai.mode === "floating") {
      lines.push(`    position: "${state.ai.position}",`);
      lines.push(`    floatingStyle: "${state.ai.floatingStyle}",`);
    }
    lines.push(`  },`);
  }

  lines.push(`  breadcrumb: { enabled: ${state.breadcrumb} },`);

  if (state.themeToggle.enabled) {
    lines.push(`  themeToggle: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    default: "${state.themeToggle.default}",`);
    lines.push(`  },`);
  }

  lines.push(`});`);
  return lines.join("\n");
}

// ─── CSS Variable Injection (user color overrides on top of preset CSS) ──────

function buildColorCSS(colors: Colors): string {
  const parts: string[] = [];

  parts.push(`:root, .dark, :root.dark, :root.light, .light {
  --color-fd-primary: ${colors.primary} !important;
  --color-fd-primary-foreground: ${colors.primaryForeground} !important;
  --color-fd-ring: ${colors.ring} !important;
}`);

  parts.push(`.dark, :root.dark {
  --color-fd-background: ${colors.background} !important;
  --color-fd-foreground: ${colors.foreground} !important;
  --color-fd-muted: ${colors.muted} !important;
  --color-fd-muted-foreground: ${colors.mutedForeground} !important;
  --color-fd-border: ${colors.border} !important;
  --color-fd-card: ${colors.card} !important;
}`);

  // Isolate customizer drawer from theme radius/font overrides
  parts.push(`[data-customizer] [class*="rounded-md"] { border-radius: 0.375rem !important; }
[data-customizer] [class*="rounded-lg"] { border-radius: 0.5rem !important; }
[data-customizer] [class*="rounded-full"] { border-radius: 9999px !important; }
[data-customizer] [class*="rounded-[4px]"] { border-radius: 4px !important; }
[data-customizer] [class*="rounded-[3px]"] { border-radius: 3px !important; }
[data-customizer] input { border-radius: 0.375rem !important; }
[data-customizer] button { font-size: inherit !important; letter-spacing: inherit !important; text-transform: inherit !important; }
[data-customizer] pre { border-radius: 0 !important; }
#cz-theme-toggle { border-radius: 9999px !important; border: 1px solid var(--color-fd-border) !important; padding: 0.25rem !important; }
#cz-theme-toggle span { border-radius: 9999px !important; }`);

  return parts.join("\n");
}

// ─── Live Config CSS (TOC, breadcrumb, AI position/visibility) ──────

function buildConfigCSS(state: ThemeState): string {
  const rules: string[] = [];

  // TOC visibility
  if (!state.toc.enabled) {
    rules.push(`#nd-toc { display: none !important; }`);
    rules.push(`#nd-docs-layout { --fd-toc-width: 0px !important; }`);
  }

  // TOC style switching — purely CSS-driven via data-cz-toc-style attribute.
  // BOTH rule sets are always present; only the one matching the current
  // attribute value applies. This guarantees mutual exclusivity.
  rules.push(`
    /* ── DEFAULT: straight left-border, inset shadow on active ────── */
    #nd-toc[data-cz-toc-style="default"] [role="none"],
    #nd-toc[data-cz-toc-style="default"] [style*="--fd-top"],
    #nd-toc[data-cz-toc-style="default"] [style*="--fd-height"],
    #nd-toc[data-cz-toc-style="default"] svg.absolute,
    #nd-toc[data-cz-toc-style="default"] > div > div:first-child:not([class*="flex-col"]) {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      opacity: 0 !important;
    }
    #nd-toc[data-cz-toc-style="default"] > div > div[class*="flex"][class*="flex-col"],
    #nd-toc[data-cz-toc-style="default"] > div[class*="relative"] > div[class*="flex"][class*="flex-col"] {
      border-left: 1px solid var(--color-fd-border) !important;
      padding-left: 0 !important;
    }
    #nd-toc[data-cz-toc-style="default"] > div > div[class*="flex"][class*="flex-col"] > a,
    #nd-toc[data-cz-toc-style="default"] > div[class*="relative"] > div[class*="flex"][class*="flex-col"] > a {
      border-left: none !important;
      margin-left: 0 !important;
      padding-inline-start: 12px !important;
      box-shadow: none !important;
    }
    #nd-toc[data-cz-toc-style="default"] > div > div[class*="flex"][class*="flex-col"] > a::before,
    #nd-toc[data-cz-toc-style="default"] > div[class*="relative"] > div[class*="flex"][class*="flex-col"] > a::before {
      display: none !important;
    }
    #nd-toc[data-cz-toc-style="default"] div[class*="absolute"][class*="w-px"] {
      display: none !important;
    }
    #nd-toc[data-cz-toc-style="default"] > div > div[class*="flex"][class*="flex-col"] > a[data-active="true"],
    #nd-toc[data-cz-toc-style="default"] > div[class*="relative"] > div[class*="flex"][class*="flex-col"] > a[data-active="true"],
    #nd-toc[data-cz-toc-style="default"] a[data-active="true"] {
      box-shadow: inset 2px 0 0 var(--color-fd-primary) !important;
      color: var(--color-fd-primary) !important;
    }

    /* ── DIRECTIONAL: tree-line SVG, per-link line segments ───────── */
    #nd-toc[data-cz-toc-style="directional"] > div > div[class*="flex"][class*="flex-col"],
    #nd-toc[data-cz-toc-style="directional"] > div[class*="relative"] > div[class*="flex"][class*="flex-col"] {
      border-left: none !important;
      padding-left: 0 !important;
    }
    #nd-toc[data-cz-toc-style="directional"] > div > div[class*="flex"][class*="flex-col"] > a,
    #nd-toc[data-cz-toc-style="directional"] > div[class*="relative"] > div[class*="flex"][class*="flex-col"] > a {
      border-left: none !important;
      margin-left: 0 !important;
      box-shadow: none !important;
    }
    #nd-toc[data-cz-toc-style="directional"] > div > div[class*="flex"][class*="flex-col"] > a::before,
    #nd-toc[data-cz-toc-style="directional"] > div[class*="relative"] > div[class*="flex"][class*="flex-col"] > a::before {
      display: none !important;
    }
    #nd-toc[data-cz-toc-style="directional"] [role="none"],
    #nd-toc[data-cz-toc-style="directional"] [style*="--fd-top"],
    #nd-toc[data-cz-toc-style="directional"] [style*="--fd-height"] {
      display: block !important;
      visibility: visible !important;
      height: auto !important;
      overflow: visible !important;
      opacity: 1 !important;
    }
    #nd-toc[data-cz-toc-style="directional"] svg.absolute,
    #nd-toc[data-cz-toc-style="directional"] > div > div:first-child:not([class*="flex-col"]) {
      display: block !important;
      visibility: visible !important;
      height: auto !important;
      overflow: visible !important;
      opacity: 1 !important;
    }
    #nd-toc[data-cz-toc-style="directional"] div[class*="absolute"][class*="w-px"] {
      display: block !important;
    }
  `);

  // TOC depth filtering
  if (state.toc.enabled && state.toc.depth === 2) {
    rules.push(`
      #nd-toc a[style*="padding-inline-start: 26px"],
      #nd-toc a[style*="padding-inline-start: 36px"] { display: none !important; }
    `);
  } else if (state.toc.enabled && state.toc.depth === 3) {
    rules.push(`
      #nd-toc a[style*="padding-inline-start: 36px"] { display: none !important; }
    `);
  }

  // Breadcrumb visibility
  if (!state.breadcrumb) {
    rules.push(`.fd-breadcrumb, nav[aria-label="Breadcrumb"] { display: none !important; }`);
  }

  // Prev/next nav cards — #nd-page > div:last-child contains the cards
  const r = state.radius;
  rules.push(`
    #nd-page > div:last-child > a {
      border-radius: ${r} !important;
      border-color: var(--color-fd-border) !important;
    }
    #nd-page > div:last-child > a:hover {
      background: var(--color-fd-accent) !important;
    }
    .fd-page-footer {
      border-color: var(--color-fd-border) !important;
    }
    #nd-page .fd-page-footer a {
      border-radius: ${r} !important;
    }
  `);

  // AI visibility
  if (!state.ai.enabled) {
    rules.push(`
      .fd-ai-floating-btn, .fd-ai-floating-trigger,
      .fd-ai-fm-input-bar, .fd-ai-fm-trigger-btn,
      .fd-ai-dialog, .fd-ai-overlay,
      .fd-ai-fm-overlay, .fd-ai-fm-topbar,
      div[class*="fd-ai"] { display: none !important; }
    `);
  }

  // sidebar-icon AI mode: hide floating button, show sidebar Ask AI button
  if (state.ai.enabled && state.ai.mode === "sidebar-icon") {
    rules.push(`
      .fd-ai-floating-btn, .fd-ai-floating-trigger,
      .fd-ai-fm-input-bar, .fd-ai-fm-trigger-btn { display: none !important; }
      .fd-sidebar-ai-btn-injected {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 36px !important;
        min-width: 36px !important;
        height: 36px !important;
        border-radius: 8px !important;
        border: 1px solid var(--color-fd-border) !important;
        background: transparent !important;
        color: var(--color-fd-muted-foreground) !important;
        cursor: pointer !important;
        transition: background-color 150ms, color 150ms, border-color 150ms !important;
        flex-shrink: 0 !important;
      }
      .fd-sidebar-ai-btn-injected:hover {
        background: var(--color-fd-accent) !important;
        color: var(--color-fd-primary) !important;
        border-color: var(--color-fd-primary) !important;
      }
      .fd-cz-search-ai-row {
        display: flex !important;
        gap: 6px !important;
        align-items: stretch !important;
        width: 100% !important;
        padding: 0 !important;
      }
      .fd-cz-search-ai-row > button:first-child {
        flex: 1 !important;
        min-width: 0 !important;
      }
    `);
  }

  // AI position override — only apply to closed trigger, not the open input bar
  if (state.ai.enabled && state.ai.mode === "floating") {
    const pos = state.ai.position;
    if (pos === "bottom-right") {
      rules.push(`
        .fd-ai-fm-input-bar--closed, .fd-ai-floating-btn, .fd-ai-floating-trigger {
          bottom: 24px !important; right: 24px !important; left: auto !important; transform: none !important;
        }
      `);
    } else if (pos === "bottom-left") {
      rules.push(`
        .fd-ai-fm-input-bar--closed, .fd-ai-floating-btn, .fd-ai-floating-trigger {
          bottom: 24px !important; left: 24px !important; right: auto !important; transform: none !important;
        }
      `);
    } else if (pos === "bottom-center") {
      rules.push(`
        .fd-ai-fm-input-bar--closed, .fd-ai-floating-btn, .fd-ai-floating-trigger {
          bottom: 24px !important; left: 50% !important; right: auto !important; transform: translateX(-50%) !important;
        }
      `);
    }
    rules.push(`
      .fd-ai-fm-input-bar--open {
        bottom: 16px !important; left: 50% !important; right: auto !important; transform: translateX(-50%) !important;
      }
    `);
  }

  return rules.join("\n");
}

// ─── Preset CSS cache ────────────────────────────────────────────────────────

const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-full"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-full"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;

async function fetchPresetCSS(preset: PresetKey): Promise<string> {
  try {
    const res = await fetch(`/themes/${preset}.css?v=${Date.now()}`);
    const css = await res.text();
    return css;
  } catch {
    return "";
  }
}

// ─── Detect current site config ──────────────────────────────────────────────

function detectCurrentPreset(): PresetKey {
  if (typeof window === "undefined") return "pixel-border";
  const style = getComputedStyle(document.documentElement);
  const bg = style.getPropertyValue("--color-fd-background").trim();
  if (bg === "#000000" || bg === "rgb(0, 0, 0)") return "darksharp";
  return "pixel-border";
}

function buildInitialState(presetKey?: PresetKey): ThemeState {
  const key = presetKey ?? detectCurrentPreset();
  const p = PRESETS[key] ?? PRESETS["pixel-border"];
  return {
    preset: key,
    colors: { ...p.colors },
    radius: p.radius,
    sidebar: p.sidebar,
    toc: { enabled: true, depth: 3, style: p.toc.style },
    ai: {
      enabled: true,
      mode: p.ai?.mode ?? "floating",
      position: "bottom-right",
      floatingStyle: "panel",
    },
    breadcrumb: true,
    themeToggle: { enabled: false, default: "dark" },
  };
}

// ─── Drawer sub-components ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 mb-2.5 select-none">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30 shrink-0">
          {title}
        </span>
        <div className="flex-1 h-px bg-white/[6%]" />
      </div>
      {children}
    </div>
  );
}

function ColorSwatch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2 mb-1.5 group">
      <button
        onClick={() => ref.current?.click()}
        className="size-5 rounded-[4px] border border-white/10 shrink-0 cursor-pointer transition-transform hover:scale-110"
        style={{ background: value }}
      />
      <input
        ref={ref}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute opacity-0 w-0 h-0"
      />
      <span className="text-[11px] text-white/40 w-[72px] shrink-0 select-none">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
        }}
        className="flex-1 min-w-0 bg-white/[3%] border border-white/[8%] rounded-md text-[11px] font-mono text-white/60 px-2 py-1 outline-none focus:border-white/20 transition-colors"
      />
    </div>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex mt-5 items-center justify-between cursor-pointer text-[12px] text-white/60 mb-2 select-none hover:text-white/80 transition-colors">
      {label}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-8 h-[18px] rounded-full transition-colors cursor-pointer"
        style={{ background: checked ? "var(--cz-accent, #6366f1)" : "rgba(255,255,255,0.1)" }}
      >
        <span
          className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-[left] duration-150"
          style={{ left: checked ? 15 : 2 }}
        />
      </button>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="flex items-center justify-between mb-2 relative">
      <span className="text-[12px] text-white/60 select-none">{label}</span>
      <span
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-white/[3%] border border-white/[8%] rounded-sm text-[11px] text-white/70 px-2.5 py-1.5 cursor-pointer outline-none hover:border-white/15 hover:bg-white/[5%] transition-colors min-w-[120px] justify-between"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-40 transition-transform"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-[100] min-w-[140px] py-1 border border-white/[10%] rounded-lg shadow-xl overflow-hidden"
          style={{ background: "#111113", backdropFilter: "blur(12px)" }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] cursor-pointer transition-colors"
                style={{
                  color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  className="size-1 rounded-full shrink-0"
                  style={{
                    background: active ? "var(--cz-accent, #6366f1)" : "transparent",
                  }}
                />
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Code Block ───────────────────────────────────────────────────────────────

const SH_VARS = {
  "--sh-class": "#7dd3fc",
  "--sh-identifier": "#e2e8f0",
  "--sh-sign": "#64748b",
  "--sh-string": "#86efac",
  "--sh-keyword": "#c084fc",
  "--sh-comment": "#475569",
  "--sh-jsxliterals": "#fda4af",
  "--sh-property": "#93c5fd",
  "--sh-entity": "#fcd34d",
} as React.CSSProperties;

function CodeOutput({ cssCode, configCode }: { cssCode: string; configCode: string }) {
  const [tab, setTab] = useState<"css" | "config">("css");
  const [copied, setCopied] = useState(false);
  const code = tab === "css" ? cssCode : configCode;
  const fileName = tab === "css" ? "global.css" : "docs.config.ts";

  const highlighted = useMemo(() => highlight(code), [code]);

  const lines = useMemo(() => highlighted.split("\n"), [highlighted]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex items-center border-b shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)" }}
      >
        {(["css", "config"] as const).map((t) => {
          const active = tab === t;
          const label = t === "css" ? "global.css" : "docs.config.ts";
          return (
            <span
              key={t}
              onClick={() => setTab(t)}
              className="relative flex items-center gap-1.5 px-3.5 py-2.5 text-[10px] font-mono transition-colors cursor-pointer border-r"
              style={{
                borderRightColor: "rgba(255,255,255,0.05)",
                color: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                background: active ? "rgba(255,255,255,0.04)" : "transparent",
              }}
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ background: t === "css" ? "#38bdf8" : "#a78bfa" }}
              />
              {label}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: t === "css" ? "#38bdf8" : "#a78bfa" }}
                />
              )}
            </span>
          );
        })}
        <div className="flex-1" />
        {/* Copy button */}
        <span
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 mr-2 text-[10px] font-mono uppercase rounded-none transition-all cursor-pointer border"
          style={{
            borderColor: copied ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.07)",
            color: copied ? "#4ade80" : "rgba(255,255,255,0.4)",
            background: copied ? "transparent/90" : "transparent",
          }}
        >
          {copied ? (
            <>
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              Copy
            </>
          )}
        </span>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto" style={{ ...SH_VARS, background: "rgba(0,0,0,0.2)" }}>
        {/* file path breadcrumb */}
        <div
          className="sticky top-0 flex items-center gap-1.5 px-4 py-1.5 text-[9px] font-mono border-b"
          style={{
            background: "rgba(0,0,0,0.35)",
            borderColor: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(4px)",
          }}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {fileName}
        </div>

        {/* Line-numbered code */}
        <div className="flex min-w-0 py-3">
          {/* Line numbers */}
          <div
            className="select-none shrink-0 text-right pr-4 pl-4 text-[10.5px] leading-[1.75] font-mono"
            style={{ color: "rgba(255,255,255,0.12)", minWidth: "3rem" }}
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="shrink-0 w-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          <pre
            className="flex-1 pl-4 pr-4 text-[10.5px] leading-[1.75] font-mono overflow-x-auto"
            style={{ margin: 0, background: "transparent" }}
          >
            <code
              dangerouslySetInnerHTML={{ __html: highlighted }}
              style={{ display: "block", whiteSpace: "pre" }}
            />
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Main Drawer Component ────────────────────────────────────────────────────

export function ThemeCustomizer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Only inject theme CSS when on the docs section — prevents bleeding onto the landing page
  const isDocsPage = pathname.startsWith("/docs");
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<"customize" | "code">("customize");

  const themeParam = searchParams.get("theme") as PresetKey | null;
  const [state, setState] = useState<ThemeState>(() => buildInitialState());
  const [hasCustomized, setHasCustomized] = useState(false);
  const [presetCSS, setPresetCSS] = useState("");
  const appliedRef = useRef(false);

  const loadPresetCSS = useCallback(async (key: PresetKey) => {
    const css = await fetchPresetCSS(key);
    setPresetCSS(css);
  }, []);

  useEffect(() => {
    if (themeParam && PRESETS[themeParam] && !appliedRef.current) {
      appliedRef.current = true;
      const p = PRESETS[themeParam];
      setState((s) => ({
        ...s,
        preset: themeParam,
        colors: { ...p.colors },
        radius: p.radius,
        sidebar: p.sidebar,
        toc: { ...s.toc, style: p.toc.style },
        ai: { ...s.ai, mode: p.ai?.mode ?? "floating" },
      }));
      setOpen(true);
      setHasCustomized(true);
      loadPresetCSS(themeParam);
    }
  }, [themeParam, loadPresetCSS]);

  // Load preset CSS on first open when no URL param triggered it
  useEffect(() => {
    if (open && !presetCSS) {
      loadPresetCSS(state.preset);
    }
  }, [open, presetCSS, state.preset, loadPresetCSS]);

  const setPreset = useCallback(
    (key: PresetKey) => {
      const p = PRESETS[key];
      setState((s) => ({
        ...s,
        preset: key,
        colors: { ...p.colors },
        radius: p.radius,
        sidebar: p.sidebar,
        toc: { ...s.toc, style: p.toc.style },
        ai: { ...s.ai, mode: p.ai?.mode ?? "floating" },
      }));
      setHasCustomized(true);
      loadPresetCSS(key);
    },
    [loadPresetCSS],
  );

  const setColor = useCallback((field: keyof Colors, value: string) => {
    setHasCustomized(true);
    setState((s) => {
      const next = { ...s, colors: { ...s.colors, [field]: value } };
      if (field === "primary") {
        next.colors.primaryForeground = hexToContrastFg(value);
        next.colors.ring = value;
      }
      return next;
    });
  }, []);

  // Inject/remove Ask AI button next to search when sidebar-icon mode is active
  useEffect(() => {
    if (!hasCustomized || !isDocsPage) return;

    const inject = () => {
      const existing = document.querySelector(".fd-cz-search-ai-row");
      if (state.ai.enabled && state.ai.mode === "sidebar-icon") {
        if (existing) return;
        const sidebar = document.querySelector("#nd-docs-layout aside");
        if (!sidebar) return;
        const searchBtn =
          sidebar.querySelector('button[class*="bg-fd-secondary"]') ??
          sidebar.querySelector("button:has(> svg)");
        if (!searchBtn || !searchBtn.parentElement) return;
        const wrapper = document.createElement("div");
        wrapper.className = "fd-cz-search-ai-row";
        searchBtn.parentElement.insertBefore(wrapper, searchBtn);
        wrapper.appendChild(searchBtn);
        const aiBtn = document.createElement("button");
        aiBtn.className = "fd-sidebar-ai-btn-injected";
        aiBtn.title = "Ask AI";
        aiBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`;
        aiBtn.onclick = () => {
          const searchTrigger = document.querySelector<HTMLButtonElement>(
            "button[data-search-full]",
          );
          if (searchTrigger) {
            searchTrigger.click();
            return;
          }
          const omniBtn = document.querySelector<HTMLButtonElement>(
            '[class*="fd-ai"], .fd-ai-floating-btn',
          );
          if (omniBtn) omniBtn.click();
        };
        wrapper.appendChild(aiBtn);
      } else {
        if (existing) {
          const searchBtn = existing.querySelector("button:not(.fd-sidebar-ai-btn-injected)");
          if (searchBtn && existing.parentElement) {
            existing.parentElement.insertBefore(searchBtn, existing);
          }
          existing.remove();
        }
      }
    };

    inject();
    const timer = setTimeout(inject, 300);
    return () => clearTimeout(timer);
  }, [state.ai.enabled, state.ai.mode, hasCustomized, isDocsPage, presetCSS]);

  const cssCode = useMemo(() => generateCSS(state), [state]);
  const configCode = useMemo(() => generateConfig(state), [state]);
  const colorCSS = useMemo(() => buildColorCSS(state.colors), [state.colors]);
  const configCSS = useMemo(() => buildConfigCSS(state), [state]);

  // Live theme toggle: switch light/dark mode when config changes
  useEffect(() => {
    if (!hasCustomized) return;

    const activeClass = "bg-fd-accent text-fd-accent-foreground";
    const inactiveClass = "text-fd-muted-foreground";
    const iconClass = "size-6.5 p-1.5 rounded-full cursor-pointer";

    if (state.themeToggle.enabled) {
      const mode = state.themeToggle.default;
      if (mode === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.documentElement.style.colorScheme = "light";
      } else {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      }

      let toggleContainer = document.getElementById("cz-theme-toggle");
      if (!toggleContainer) {
        toggleContainer = document.createElement("div");
        toggleContainer.id = "cz-theme-toggle";
        toggleContainer.setAttribute("data-theme-toggle", "");
        toggleContainer.className = "inline-flex items-center rounded-full border p-1 ms-auto";
        toggleContainer.style.cssText = "border-color: var(--color-fd-border);";

        const sunBtn = document.createElement("span");
        sunBtn.id = "cz-sun-icon";
        sunBtn.className = iconClass;
        sunBtn.innerHTML = SUN_SVG;
        sunBtn.style.cursor = "pointer";

        const moonBtn = document.createElement("span");
        moonBtn.id = "cz-moon-icon";
        moonBtn.className = iconClass;
        moonBtn.innerHTML = MOON_SVG;
        moonBtn.style.cursor = "pointer";

        toggleContainer.appendChild(sunBtn);
        toggleContainer.appendChild(moonBtn);

        toggleContainer.addEventListener("click", () => {
          const isCurrentlyDark = document.documentElement.classList.contains("dark");
          if (isCurrentlyDark) {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
            document.documentElement.style.colorScheme = "light";
            setState((s) => ({ ...s, themeToggle: { ...s.themeToggle, default: "light" } }));
          } else {
            document.documentElement.classList.remove("light");
            document.documentElement.classList.add("dark");
            document.documentElement.style.colorScheme = "dark";
            setState((s) => ({ ...s, themeToggle: { ...s.themeToggle, default: "dark" } }));
          }
        });

        const existingToggleRow = document.querySelector(
          "aside .flex.text-fd-muted-foreground.items-center",
        );
        if (existingToggleRow) {
          existingToggleRow.appendChild(toggleContainer);
        } else {
          const footerContainer = document.querySelector("aside .flex.flex-col.border-t");
          if (footerContainer) {
            let toggleRow = footerContainer.querySelector(".flex.items-center");
            if (!toggleRow) {
              toggleRow = document.createElement("div");
              toggleRow.className = "flex text-fd-muted-foreground items-center";
              footerContainer.insertBefore(toggleRow, footerContainer.firstChild);
            }
            toggleRow.appendChild(toggleContainer);
          } else {
            const sidebar =
              document.querySelector("aside#nd-sidebar > div") ??
              document.querySelector("aside > div");
            if (sidebar) {
              const footer = document.createElement("div");
              footer.className = "flex flex-col border-t p-4 pt-2";
              const row = document.createElement("div");
              row.className = "flex text-fd-muted-foreground items-center";
              row.appendChild(toggleContainer);
              footer.appendChild(row);
              sidebar.appendChild(footer);
            }
          }
        }
      }

      const sunIcon = document.getElementById("cz-sun-icon");
      const moonIcon = document.getElementById("cz-moon-icon");
      const isLight = state.themeToggle.default === "light";
      if (sunIcon) sunIcon.className = `${iconClass} ${isLight ? activeClass : inactiveClass}`;
      if (moonIcon) moonIcon.className = `${iconClass} ${!isLight ? activeClass : inactiveClass}`;
      toggleContainer.style.display = "inline-flex";
    } else {
      const toggleContainer = document.getElementById("cz-theme-toggle");
      if (toggleContainer) toggleContainer.style.display = "none";
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    }
  }, [hasCustomized, state.themeToggle.enabled, state.themeToggle.default]);

  // Set TOC style attribute and aggressively clean stale inline styles
  useEffect(() => {
    const toc = document.getElementById("nd-toc");
    if (!toc) return;

    if (!hasCustomized) {
      toc.removeAttribute("data-cz-toc-style");
      return;
    }

    const newStyle = state.toc.enabled ? state.toc.style : "hidden";
    toc.setAttribute("data-cz-toc-style", newStyle);

    toc.querySelectorAll<HTMLElement>("*").forEach((el) => {
      el.style.removeProperty("display");
      el.style.removeProperty("border-left");
      el.style.removeProperty("padding-left");
      el.style.removeProperty("box-shadow");
      el.style.removeProperty("margin-left");
    });
  }, [hasCustomized, state.toc.style, state.toc.enabled, state.preset]);

  // Direct DOM manipulation for nav cards + edit link border-radius
  useEffect(() => {
    if (!hasCustomized) return;
    const ndPage = document.getElementById("nd-page");
    if (!ndPage) return;

    const lastDiv = ndPage.querySelector(":scope > div:last-child");
    if (lastDiv) {
      lastDiv.querySelectorAll<HTMLAnchorElement>(":scope > a").forEach((a) => {
        a.style.borderRadius = state.radius;
        a.style.borderColor = "var(--color-fd-border)";
      });
    }

    const footer = ndPage.querySelector<HTMLElement>(".fd-page-footer");
    if (footer) {
      footer.style.setProperty("border-color", "var(--color-fd-border)", "important");
      footer.querySelectorAll<HTMLAnchorElement>("a").forEach((a) => {
        a.style.setProperty("border-radius", state.radius, "important");
      });
    }
  }, [hasCustomized, state.radius, state.preset]);

  const handleReset = useCallback(() => {
    setHasCustomized(false);
    setPresetCSS("");
    setState(buildInitialState());
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    const toggleBtn = document.getElementById("cz-theme-toggle");
    if (toggleBtn) toggleBtn.remove();
    router.replace("/docs", { scroll: false });
  }, [router]);

  return (
    <>
      {isDocsPage && (open || hasCustomized) && presetCSS && (
        <style dangerouslySetInnerHTML={{ __html: presetCSS }} />
      )}
      {isDocsPage && (open || hasCustomized) && (
        <style dangerouslySetInnerHTML={{ __html: colorCSS }} />
      )}
      {isDocsPage && (open || hasCustomized) && configCSS && (
        <style dangerouslySetInnerHTML={{ __html: configCSS }} />
      )}

      <button
        onClick={() => {
          setOpen((v) => {
            if (!v) setHasCustomized(true);
            return !v;
          });
        }}
        className="fixed z-[10010] bottom-20 right-5 size-8 rounded-full border border-white/[8%] bg-black/60 backdrop-blur-md cursor-pointer transition-all duration-200 hover:scale-110 hover:border-white/20 hover:bg-black/80 flex items-center justify-center group"
        title={open ? "Close customizer" : "Customize theme"}
      >
        {open ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:stroke-white/80 group-hover:rotate-12 transition-all"
          >
            <circle cx="13.5" cy="6.5" r="2.5" />
            <circle cx="17.5" cy="10.5" r="2.5" />
            <circle cx="8.5" cy="7.5" r="2.5" />
            <circle cx="6.5" cy="12.5" r="2.5" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[10009] bg-black/30 backdrop-blur-[2px] transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        data-customizer
        className="fixed top-0 right-0 z-[10010] h-dvh flex flex-col transition-transform duration-300 ease-out"
        style={{
          width: 400,
          transform: open ? "translateX(0)" : "translateX(100%)",
          ["--cz-accent" as string]: state.colors.primary,
        }}
      >
        <div className="flex flex-col h-full bg-[#0a0a0b] border-l border-white/[6%] shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[6%]">
            <div>
              <div className="text-[13px] font-mono uppercase text-white">Customize</div>
              <div className="text-[10px] text-white/30 mt-0.5">Live preview on these docs</div>
            </div>
            <div className="flex items-center gap-1">
              <span
                onClick={handleReset}
                className="text-[10px] uppercase font-mono px-3 py-1 rounded-none border border-white/[8%] text-white/40 hover:text-white/70 hover:border-white/15 transition-colors cursor-pointer"
              >
                Reset
              </span>
              <button
                onClick={() => setOpen(false)}
                className="size-7 rounded-none flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[5%] transition-colors cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] border-b border-white/[6%]">
            <span
              onClick={() => setActiveView("customize")}
              className="text-[12px] font-mono uppercase py-2.5 transition-colors cursor-pointer text-center"
              style={{
                background: activeView === "customize" ? "rgba(255,255,255,0.06)" : "transparent",
                color:
                  activeView === "customize" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
                fontWeight: activeView === "customize" ? 500 : 400,
              }}
            >
              Customize
            </span>
            <div className="w-px bg-white/[6%]" />
            <span
              onClick={() => setActiveView("code")}
              className="text-[12px] uppercase font-mono py-2.5 transition-colors cursor-pointer text-center"
              style={{
                background: activeView === "code" ? "rgba(255,255,255,0.06)" : "transparent",
                color: activeView === "code" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
                fontWeight: activeView === "code" ? 500 : 400,
              }}
            >
              Export Code
            </span>
          </div>
          {/* Content */}
          <div
            className={`flex-1 min-h-0 ${activeView === "code" ? "flex flex-col overflow-hidden" : "overflow-y-auto overflow-x-hidden"}`}
          >
            {activeView === "customize" ? (
              <div className="px-4 py-3">
                {/* Presets */}
                <Section title="Preset">
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                      const p = PRESETS[key];
                      const active = state.preset === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setPreset(key)}
                          className="text-left rounded-sm px-3 py-2.5 border border-white/[6%] transition-all cursor-pointer"
                          style={{
                            borderColor: active
                              ? `${p.colors.primary}60`
                              : "rgba(255,255,255,0.06)",
                            background: active ? `${p.colors.primary}08` : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <div
                              className="size-2.5 rounded-[3px]"
                              style={{ background: p.colors.primary }}
                            />
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: active ? p.colors.primary : "rgba(255,255,255,0.7)" }}
                            >
                              {p.label}
                            </span>
                          </div>
                          <div className="text-[9px] text-white/25 leading-tight">{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                  <a
                    href="/themes"
                    className="mt-2 flex items-center justify-center gap-1.5 rounded-sm px-3 py-2 border border-white/[6%] text-[11px] text-white/50 hover:text-white/80 hover:border-white/15 transition-all cursor-pointer"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                      <path d="M2 12h20" />
                    </svg>
                    Explore more themes
                  </a>
                </Section>

                {/* Primary Color Quick Swatches */}
                <Section title="Primary Color">
                  <div className="flex flex-wrap mt-2 gap-1 mb-2">
                    {PRIMARY_SWATCHES.map((s) => (
                      <button
                        key={s.color}
                        title={s.name}
                        onClick={() => setColor("primary", s.color)}
                        className="size-5 rounded-[4px] cursor-pointer transition-transform hover:scale-110"
                        style={{
                          background: s.color,
                          border:
                            state.colors.primary === s.color
                              ? "2px solid white"
                              : "1px solid rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>
                  <ColorSwatch
                    label="Primary"
                    value={state.colors.primary}
                    onChange={(v) => setColor("primary", v)}
                  />
                </Section>

                {/* Colors */}
                <Section title="Colors">
                  <ColorSwatch
                    label="Background"
                    value={state.colors.background}
                    onChange={(v) => setColor("background", v)}
                  />
                  <ColorSwatch
                    label="Foreground"
                    value={state.colors.foreground}
                    onChange={(v) => setColor("foreground", v)}
                  />
                  <ColorSwatch
                    label="Muted Text"
                    value={state.colors.mutedForeground}
                    onChange={(v) => setColor("mutedForeground", v)}
                  />
                  <ColorSwatch
                    label="Border"
                    value={state.colors.border}
                    onChange={(v) => setColor("border", v)}
                  />
                  <ColorSwatch
                    label="Card"
                    value={state.colors.card}
                    onChange={(v) => setColor("card", v)}
                  />
                  <ColorSwatch
                    label="Muted BG"
                    value={state.colors.muted}
                    onChange={(v) => setColor("muted", v)}
                  />
                  <ColorSwatch
                    label="Ring"
                    value={state.colors.ring}
                    onChange={(v) => setColor("ring", v)}
                  />
                </Section>

                {/* Layout */}
                <Section title="Layout">
                  <SelectField
                    label="Sidebar"
                    value={state.sidebar}
                    options={[
                      { value: "default", label: "Default" },
                      { value: "bordered", label: "Bordered" },
                      { value: "floating", label: "Floating" },
                    ]}
                    onChange={(v) => {
                      setHasCustomized(true);
                      setState((s) => ({ ...s, sidebar: v as SidebarStyle }));
                    }}
                  />
                  <SelectField
                    label="TOC Style"
                    value={state.toc.style}
                    options={[
                      { value: "default", label: "Default" },
                      { value: "directional", label: "Directional (tree)" },
                    ]}
                    onChange={(v) => {
                      setHasCustomized(true);
                      setState((s) => ({ ...s, toc: { ...s.toc, style: v as TocStyle } }));
                    }}
                  />
                  <SelectField
                    label="TOC Depth"
                    value={String(state.toc.depth)}
                    options={[
                      { value: "2", label: "H2 only" },
                      { value: "3", label: "H2 + H3" },
                      { value: "4", label: "H2 – H4" },
                    ]}
                    onChange={(v) => {
                      setHasCustomized(true);
                      setState((s) => ({ ...s, toc: { ...s.toc, depth: Number(v) } }));
                    }}
                  />
                  <ToggleSwitch
                    label="TOC Visible"
                    checked={state.toc.enabled}
                    onChange={(v) => {
                      setHasCustomized(true);
                      setState((s) => ({ ...s, toc: { ...s.toc, enabled: v } }));
                    }}
                  />
                </Section>

                {/* AI */}
                <Section title="Ask AI">
                  <ToggleSwitch
                    label="Enabled"
                    checked={state.ai.enabled}
                    onChange={(v) => {
                      setHasCustomized(true);
                      setState((s) => ({ ...s, ai: { ...s.ai, enabled: v } }));
                    }}
                  />
                  {state.ai.enabled && (
                    <>
                      <SelectField
                        label="Mode"
                        value={state.ai.mode}
                        options={[
                          { value: "floating", label: "Floating" },
                          { value: "search", label: "Search" },
                          { value: "sidebar-icon", label: "Sidebar Icon" },
                        ]}
                        onChange={(v) => {
                          setHasCustomized(true);
                          setState((s) => ({
                            ...s,
                            ai: { ...s.ai, mode: v as AIMode },
                          }));
                        }}
                      />
                      {state.ai.mode === "floating" && (
                        <>
                          <SelectField
                            label="Floating Style"
                            value={state.ai.floatingStyle}
                            options={[
                              { value: "panel", label: "Panel" },
                              { value: "modal", label: "Modal" },
                              { value: "popover", label: "Popover" },
                              { value: "full-modal", label: "Full Modal" },
                            ]}
                            onChange={(v) => {
                              setHasCustomized(true);
                              setState((s) => ({
                                ...s,
                                ai: { ...s.ai, floatingStyle: v as AIFloatingStyle },
                              }));
                            }}
                          />
                          <SelectField
                            label="Position"
                            value={state.ai.position}
                            options={[
                              { value: "bottom-right", label: "Bottom Right" },
                              { value: "bottom-left", label: "Bottom Left" },
                              { value: "bottom-center", label: "Bottom Center" },
                            ]}
                            onChange={(v) => {
                              setHasCustomized(true);
                              setState((s) => ({
                                ...s,
                                ai: { ...s.ai, position: v as AIPosition },
                              }));
                            }}
                          />
                        </>
                      )}
                    </>
                  )}
                </Section>

                {/* Features */}
                <Section title="Features">
                  <ToggleSwitch
                    label="Breadcrumb"
                    checked={state.breadcrumb}
                    onChange={(v) => {
                      setHasCustomized(true);
                      setState((s) => ({ ...s, breadcrumb: v }));
                    }}
                  />
                </Section>
              </div>
            ) : (
              <CodeOutput cssCode={cssCode} configCode={configCode} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

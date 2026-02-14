/**
 * Darksharp fumadocs theme preset — all-black, sharp edges, zero-radius look.
 * Inspired by better-auth.com documentation style.
 *
 * @example
 * ```ts
 * import { darksharp } from "@farming-labs/fumadocs/darksharp";
 *
 * export default defineDocs({
 *   entry: "docs",
 *   theme: darksharp({ ui: { colors: { primary: "#ffffff" } } }),
 * });
 * ```
 *
 * CSS: `@import "@farming-labs/fumadocs/darksharp/css";`
 */

import { deepMerge } from "@farming-labs/docs";
import type { DocsTheme } from "@farming-labs/docs";

const DarksharpUIDefaults = {
  colors: {
    primary: "#fafaf9", // near-white primary for dark mode
    background: "#000000",
    muted: "#a8a29e",
    border: "#292524",
  },
  typography: {
    fontFamily: "Geist, system-ui, sans-serif",
    monoFontFamily: "Geist Mono, monospace",
    scale: {
      h1: "2rem",
      h2: "1.5rem",
      h3: "1.25rem",
      body: "1rem",
    },
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 280,
    toc: { enabled: true, depth: 3 },
    header: { height: 56, sticky: true },
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" },
  },
};

const baseDarksharpTheme: DocsTheme = {
  name: "fumadocs-darksharp",
  ui: DarksharpUIDefaults,
};

/**
 * Create a fumadocs darksharp theme config.
 * All-black background, near-zero border-radius, minimal & sharp aesthetic.
 */
export function darksharp(overrides: Partial<DocsTheme> = {}): DocsTheme {
  return deepMerge(
    baseDarksharpTheme as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as DocsTheme;
}

export { DarksharpUIDefaults };

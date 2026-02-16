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

import { createTheme } from "@farming-labs/docs";
import type { DocsTheme } from "@farming-labs/docs";

/**
 * Darksharp UI defaults — all-black, sharp edges, zero-radius aesthetic.
 *
 * Theme authors can import and extend:
 * ```ts
 * import { DarksharpUIDefaults } from "@farming-labs/fumadocs/darksharp";
 * ```
 */
const DarksharpUIDefaults = {
  colors: {
    primary: "#fafaf9",
    background: "#000000",
    muted: "#a8a29e",
    border: "#292524",
  },
  typography: {
    font: {
      style: {
        sans: "Geist, system-ui, sans-serif",
        mono: "Geist Mono, monospace",
      },
      h1: { size: "2rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" },
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

/**
 * Darksharp theme preset factory.
 *
 * Built with `createTheme` — the same helper theme authors use.
 * All-black background, near-zero border-radius, minimal & sharp aesthetic.
 *
 * @example
 * ```ts
 * import { darksharp } from "@farming-labs/fumadocs/darksharp";
 * export default defineDocs({ theme: darksharp() });
 * ```
 */
export const darksharp = createTheme({
  name: "fumadocs-darksharp",
  ui: DarksharpUIDefaults,
});

export { DarksharpUIDefaults };

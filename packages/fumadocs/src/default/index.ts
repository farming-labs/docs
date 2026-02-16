/**
 * Default fumadocs theme preset — neutral colors, standard radius.
 *
 * @example
 * ```ts
 * import { fumadocs } from "@farming-labs/fumadocs/default";
 *
 * export default defineDocs({
 *   entry: "docs",
 *   theme: fumadocs({ ui: { colors: { primary: "#22c55e" } } }),
 * });
 * ```
 *
 * CSS: `@import "@farming-labs/fumadocs/default/css";`
 */

import { createTheme } from "@farming-labs/docs";
import type { DocsTheme } from "@farming-labs/docs";

/**
 * Default UI configuration — neutral palette, standard border-radius.
 *
 * Theme authors can import this and extend it:
 * ```ts
 * import { DefaultUIDefaults } from "@farming-labs/fumadocs/default";
 * ```
 */
const DefaultUIDefaults = {
  colors: {
    primary: "#6366f1",
    background: "#ffffff",
    muted: "#64748b",
    border: "#e5e7eb",
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    monoFontFamily: "JetBrains Mono, monospace",
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
    header: { height: 72, sticky: true },
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" },
  },
};

/**
 * Default fumadocs theme preset factory.
 *
 * Built with `createTheme` — the same helper theme authors use.
 * Merges user overrides on top of sensible defaults.
 *
 * @example
 * ```ts
 * import { fumadocs } from "@farming-labs/fumadocs/default";
 * export default defineDocs({ theme: fumadocs({ ui: { colors: { primary: "#22c55e" } } }) });
 * ```
 */
export const fumadocs = createTheme({
  name: "fumadocs-default",
  ui: DefaultUIDefaults,
});

export { DefaultUIDefaults };

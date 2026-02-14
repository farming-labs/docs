/**
 * Fumadocs theme preset for @farming-labs/docs.
 *
 * @example
 * ```ts
 * import { fumadocs } from "@farming-labs/fumadocs";
 * theme: fumadocs({ ui: { colors: { primary: "#22c55e" } } })
 * ```
 */

import { deepMerge } from "@farming-labs/docs";
import type { DocsTheme, UIConfig } from "@farming-labs/docs";

const FumadocsUIDefaults: UIConfig = {
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

const baseFumadocsTheme: DocsTheme = {
  name: "fumadocs",
  ui: FumadocsUIDefaults,
};

export function fumadocs(overrides: Partial<DocsTheme> = {}): DocsTheme {
  return deepMerge(
    baseFumadocsTheme as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as DocsTheme;
}

export { FumadocsUIDefaults };

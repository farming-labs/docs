/**
 * DarkBold theme preset.
 * Pure monochrome design, Geist typography, clean minimalism.
 *
 * CSS: `@import "@farming-labs/theme/darkbold/css";`
 */
import { createTheme } from "@farming-labs/docs";

const DarkBoldUIDefaults = {
  colors: {
    primary: "#000",
    background: "#fff",
    muted: "#666",
    border: "#eaeaea",
  },
  typography: {
    font: {
      style: {
        sans: "Geist, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        mono: "Geist Mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      },
      h1: { size: "2.5rem", weight: 600, lineHeight: "1.2", letterSpacing: "-0.06em" },
      h2: { size: "2rem", weight: 600, lineHeight: "1.25", letterSpacing: "-0.04em" },
      h3: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.02em" },
      h4: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.6" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" },
    },
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 260,
    toc: { enabled: true, depth: 3, style: "default" as const },
    header: { height: 64, sticky: true },
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" },
  },
};

export const darkbold = createTheme({
  name: "darkbold",
  ui: DarkBoldUIDefaults,
});

export { DarkBoldUIDefaults };

/**
 * Shiny theme preset — Clerk docs-inspired, clean, polished UI with
 * purple accents and a professional light/dark design.
 *
 * CSS: `@import "@farming-labs/theme/shiny/css";`
 */
import { createTheme } from "@farming-labs/docs";

const ShinyUIDefaults = {
  colors: {
    primary: "hsl(256, 100%, 64%)",
    background: "#f7f7f8",
    muted: "#73738c",
    border: "#e5e5ea",
  },
  typography: {
    font: {
      style: {
        sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      },
      h1: { size: "2rem", weight: 600, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.01em" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "0.9375rem", weight: 400, lineHeight: "1.7" },
      small: { size: "0.8125rem", weight: 400, lineHeight: "1.5" },
    },
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 280,
    toc: { enabled: true, depth: 3, style: "default" as const },
    header: { height: 64, sticky: true },
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" },
  },
};

export const shiny = createTheme({
  name: "shiny",
  ui: ShinyUIDefaults,
});

export { ShinyUIDefaults };

/**
 * GreenTree theme preset.
 * Mintlify-inspired design with emerald green accent, Inter typography.
 *
 * CSS: `@import "@farming-labs/theme/greentree/css";`
 */
import { createTheme } from "@farming-labs/docs";

const GreenTreeUIDefaults = {
  colors: {
    primary: "#0D9373",
    background: "#fff",
    muted: "#505351",
    border: "#DFE1E0",
  },
  typography: {
    font: {
      style: {
        sans: "Inter, -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
        mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      },
      h1: { size: "2.25rem", weight: 500, lineHeight: "1.2", letterSpacing: "-0.025em" },
      h2: { size: "1.875rem", weight: 600, lineHeight: "1.25", letterSpacing: "-0.02em" },
      h3: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.01em" },
      h4: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.7" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" },
    },
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 240,
    toc: { enabled: true, depth: 3, style: "default" as const },
    header: { height: 56, sticky: true },
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" },
  },
};

export const greentree = createTheme({
  name: "greentree",
  ui: GreenTreeUIDefaults,
});

export { GreenTreeUIDefaults };

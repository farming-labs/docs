/**
 * Hardline theme preset.
 * Hard edges, strong borders, and high-contrast typography.
 *
 * CSS: `@import "@farming-labs/theme/hardline/css";`
 */
import { createTheme } from "@farming-labs/docs";

const HardlineUIDefaults = {
  colors: {
    primary: "#ffd335",
    background: "#f2efe8",
    muted: "#4b4944",
    border: "#121212",
  },
  typography: {
    font: {
      style: {
        sans: "'IBM Plex Sans', 'Space Grotesk', system-ui, sans-serif",
        mono: "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace",
      },
      h1: { size: "2.6rem", weight: 800, lineHeight: "1.05", letterSpacing: "-0.03em" },
      h2: { size: "1.95rem", weight: 800, lineHeight: "1.15", letterSpacing: "-0.02em" },
      h3: { size: "1.45rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.015em" },
      h4: { size: "1.15rem", weight: 700, lineHeight: "1.3" },
      body: { size: "1rem", weight: 500, lineHeight: "1.65" },
      small: { size: "0.875rem", weight: 500, lineHeight: "1.45" },
    },
  },
  radius: "0px",
  layout: {
    contentWidth: 860,
    sidebarWidth: 300,
    toc: { enabled: true, depth: 3, style: "default" as const },
    header: { height: 64, sticky: true },
  },
  sidebar: {
    style: "bordered" as const,
  },
  components: {
    Callout: { variant: "outline", icon: true },
    CodeBlock: { showCopyButton: true },
    HoverLink: { linkLabel: "Open page", showIndicator: true },
    Tabs: { style: "underline" as const },
  },
};

export const hardline = createTheme({
  name: "hardline",
  ui: HardlineUIDefaults,
});

export { HardlineUIDefaults };

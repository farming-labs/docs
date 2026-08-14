/**
 * Command Grid theme preset.
 * Better-cmdk-inspired light theme over the concrete base, without offset shadows.
 *
 * CSS: `@import "@farming-labs/theme/command-grid/css";`
 */
import { createTheme } from "@farming-labs/docs";

const CommandGridUIDefaults = {
  colors: {
    primary: "#141414",
    background: "#f8f6ed",
    muted: "#3d3d3d",
    border: "#141210",
  },
  typography: {
    font: {
      style: {
        sans: "var(--font-ibm-plex-mono), 'IBM Plex Mono', 'Geist Mono', ui-monospace, monospace",
        mono: "var(--font-ibm-plex-mono), 'IBM Plex Mono', 'Geist Mono', ui-monospace, monospace",
      },
      h1: { size: "3.3rem", weight: 400, lineHeight: "0.86", letterSpacing: "0.01em" },
      h2: { size: "2.4rem", weight: 400, lineHeight: "0.92", letterSpacing: "0.012em" },
      h3: { size: "1.42rem", weight: 600, lineHeight: "1.18", letterSpacing: "-0.01em" },
      h4: { size: "1.05rem", weight: 600, lineHeight: "1.34", letterSpacing: "0em" },
      body: { size: "0.98rem", weight: 400, lineHeight: "1.7" },
      small: { size: "0.8rem", weight: 500, lineHeight: "1.45", letterSpacing: "0.02em" },
    },
  },
  radius: "0px",
  layout: {
    contentWidth: 900,
    sidebarWidth: 304,
    toc: { enabled: true, depth: 3, style: "directional" as const },
    header: { height: 64, sticky: true },
  },
  sidebar: {
    style: "bordered" as const,
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    HoverLink: { linkLabel: "Open page", showIndicator: false },
    Tabs: { style: "default" as const },
  },
};

export const commandGrid = createTheme({
  name: "command-grid",
  ui: CommandGridUIDefaults,
});

export { CommandGridUIDefaults };

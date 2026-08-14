/**
 * Concrete theme preset.
 * Brutalist-inspired layout with poster typography, square corners, and offset shadows.
 *
 * CSS: `@import "@farming-labs/theme/concrete/css";`
 */
import { createTheme } from "@farming-labs/docs";

const ConcreteUIDefaults = {
  colors: {
    primary: "#ff5b31",
    background: "#f6ead9",
    muted: "#5a4c42",
    border: "#141210",
  },
  typography: {
    font: {
      style: {
        sans: "'Archivo', 'IBM Plex Sans', 'Space Grotesk', system-ui, sans-serif",
        mono: "'Space Mono', 'IBM Plex Mono', ui-monospace, monospace",
      },
      h1: { size: "2.85rem", weight: 900, lineHeight: "0.98", letterSpacing: "-0.05em" },
      h2: { size: "2.05rem", weight: 850, lineHeight: "1.04", letterSpacing: "-0.035em" },
      h3: { size: "1.52rem", weight: 800, lineHeight: "1.14", letterSpacing: "-0.02em" },
      h4: { size: "1.16rem", weight: 750, lineHeight: "1.28", letterSpacing: "-0.01em" },
      body: { size: "1.02rem", weight: 550, lineHeight: "1.68" },
      small: { size: "0.83rem", weight: 600, lineHeight: "1.42", letterSpacing: "0.02em" },
    },
  },
  radius: "0px",
  layout: {
    contentWidth: 896,
    sidebarWidth: 316,
    toc: { enabled: true, depth: 3, style: "directional" as const },
    header: { height: 68, sticky: true },
  },
  sidebar: {
    style: "bordered" as const,
  },
  components: {
    Callout: { variant: "outline", icon: true },
    CodeBlock: { showCopyButton: true },
    HoverLink: { linkLabel: "View doc", showIndicator: false },
    Tabs: { style: "default" as const },
  },
};

export const concrete = createTheme({
  name: "concrete",
  ui: ConcreteUIDefaults,
});

export { ConcreteUIDefaults };

import { createTheme } from "@farming-labs/docs";

const ColorfulUIDefaults = {
  colors: {
    primary: "hsl(40, 96%, 40%)",
    background: "#ffffff",
    muted: "#64748b",
    border: "#e5e7eb",
  },
  typography: {
    font: {
      style: {
        sans: "Inter, system-ui, sans-serif",
        mono: "JetBrains Mono, monospace",
      },
      h1: { size: "1.875rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" },
    },
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 260,
    toc: { enabled: true, depth: 3, style: "directional" },
    header: { height: 56, sticky: true },
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" },
  },
};

export const colorful = createTheme({
  name: "fumadocs-colorful",
  ui: ColorfulUIDefaults,
});

export { ColorfulUIDefaults };

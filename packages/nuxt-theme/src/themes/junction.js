import { createTheme } from "@farming-labs/docs";

const JunctionUIDefaults = {
  colors: {
    primary: "#0057ff",
    primaryForeground: "#ffffff",
    background: "#fbfbf8",
    foreground: "#111111",
    muted: "#efefea",
    mutedForeground: "#666660",
    border: "#d8d8d0",
    card: "#ffffff",
    cardForeground: "#111111",
    accent: "#e8efff",
    accentForeground: "#003fb8",
    secondary: "#f1f1ec",
    secondaryForeground: "#222220",
    popover: "#ffffff",
    popoverForeground: "#111111",
    ring: "#0057ff",
  },
  typography: {
    font: {
      style: {
        sans: "var(--font-geist-sans, Geist, ui-sans-serif, system-ui, sans-serif)",
        mono: "var(--font-geist-mono, 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace)",
      },
      h1: { size: "2.25rem", weight: 560, lineHeight: "1.12", letterSpacing: "-0.04em" },
      h2: { size: "1.5rem", weight: 560, lineHeight: "1.3", letterSpacing: "-0.025em" },
      h3: { size: "1.125rem", weight: 600, lineHeight: "1.45", letterSpacing: "-0.012em" },
      h4: { size: "1rem", weight: 600, lineHeight: "1.5", letterSpacing: "0" },
      body: { size: "0.9375rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.75rem", weight: 500, lineHeight: "1.5", letterSpacing: "0.02em" },
    },
  },
  radius: "0.125rem",
  layout: {
    contentWidth: 840,
    sidebarWidth: 248,
    tocWidth: 224,
    toc: { enabled: true, depth: 3, style: "directional" },
    header: { height: 56, sticky: true },
  },
  sidebar: { style: "bordered" },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true, showLineNumbers: false },
    HoverLink: { linkLabel: "Open page", showIndicator: false },
    Tabs: { style: "underline" },
  },
};

export const junction = createTheme({ name: "junction", ui: JunctionUIDefaults });
export { JunctionUIDefaults };

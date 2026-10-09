import { createTheme } from "@farming-labs/docs";

const JunctionUIDefaults = {
  colors: {
    primary: "#145cff",
    primaryForeground: "#ffffff",
    background: "#edf4ff",
    foreground: "#081425",
    muted: "#dbe7f8",
    mutedForeground: "#53657e",
    border: "#9eb8d8",
    card: "#fbfdff",
    cardForeground: "#081425",
    accent: "#d5e5ff",
    accentForeground: "#0b45bd",
    secondary: "#dce8f8",
    secondaryForeground: "#142741",
    popover: "#ffffff",
    popoverForeground: "#081425",
    ring: "#145cff",
  },
  typography: {
    font: {
      style: {
        sans: "var(--font-geist-sans, Geist, ui-sans-serif, system-ui, sans-serif)",
        mono: "var(--font-geist-mono, 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace)",
      },
      h1: { size: "3.75rem", weight: 760, lineHeight: "0.98", letterSpacing: "-0.065em" },
      h2: { size: "2rem", weight: 680, lineHeight: "1.16", letterSpacing: "-0.035em" },
      h3: { size: "1.125rem", weight: 600, lineHeight: "1.45", letterSpacing: "-0.012em" },
      h4: { size: "1rem", weight: 600, lineHeight: "1.5", letterSpacing: "0" },
      body: { size: "0.9375rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.75rem", weight: 500, lineHeight: "1.5", letterSpacing: "0.02em" },
    },
  },
  radius: "0px",
  layout: {
    contentWidth: 920,
    sidebarWidth: 264,
    tocWidth: 240,
    toc: { enabled: true, depth: 3, style: "directional" },
    header: { height: 60, sticky: true },
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

import { createTheme } from "@farming-labs/docs";

const LedgerUIDefaults = {
  colors: {
    primary: "#5f6cf6",
    primaryForeground: "#ffffff",
    background: "#f6f8fb",
    foreground: "#30364a",
    muted: "#eef3fb",
    mutedForeground: "#677187",
    border: "#dbe3ef",
    card: "#ffffff",
    cardForeground: "#30364a",
    accent: "#edf2ff",
    accentForeground: "#30364a",
    secondary: "#eef3fb",
    secondaryForeground: "#30364a",
    popover: "#ffffff",
    popoverForeground: "#30364a",
    ring: "#5f6cf6",
  },
  typography: {
    font: {
      style: {
        sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
        mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      },
      h1: { size: "2.25rem", weight: 700, lineHeight: "1.18", letterSpacing: "0" },
      h2: { size: "1.625rem", weight: 700, lineHeight: "1.28", letterSpacing: "0" },
      h3: { size: "1.25rem", weight: 700, lineHeight: "1.35", letterSpacing: "0" },
      h4: { size: "1.0625rem", weight: 700, lineHeight: "1.4", letterSpacing: "0" },
      body: { size: "0.9375rem", weight: 400, lineHeight: "1.7" },
      small: { size: "0.8125rem", weight: 400, lineHeight: "1.5" },
    },
  },
  radius: "0.5rem",
  layout: {
    contentWidth: 820,
    sidebarWidth: 292,
    tocWidth: 236,
    toc: { enabled: true, depth: 3, style: "default" },
    header: { height: 64, sticky: true },
  },
  sidebar: {
    style: "bordered",
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    HoverLink: { linkLabel: "Open page", showIndicator: false },
    Tabs: { style: "default" },
  },
};

export const ledger = createTheme({
  name: "ledger",
  ui: LedgerUIDefaults,
});

export { LedgerUIDefaults };

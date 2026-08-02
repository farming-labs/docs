/**
 * Unofficial shadcn/ui docs-inspired theme preset.
 * Recreates the compact neutral documentation shell without shadcn branding
 * or content.
 *
 * CSS: `@import "@farming-labs/theme/shadcn/css";`
 */
import { createTheme } from "@farming-labs/docs";

const ShadcnUIDefaults = {
  colors: {
    primary: "oklch(0 0 0)",
    primaryForeground: "oklch(0.985 0 0)",
    background: "oklch(1 0 0)",
    foreground: "oklch(0 0 0)",
    muted: "oklch(0.97 0 0)",
    mutedForeground: "oklch(0.556 0 0)",
    border: "oklch(0.922 0 0)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0 0 0)",
    accent: "oklch(0.97 0 0)",
    accentForeground: "oklch(0.205 0 0)",
    secondary: "oklch(0.97 0 0)",
    secondaryForeground: "oklch(0.205 0 0)",
    popover: "oklch(1 0 0)",
    popoverForeground: "oklch(0 0 0)",
    ring: "oklch(0.708 0 0)",
  },
  typography: {
    font: {
      style: {
        sans: "'Geist', 'Geist Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        mono: "'Geist Mono', 'Geist Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      h1: { size: "1.875rem", weight: 600, lineHeight: "1.2", letterSpacing: "-0.025em" },
      h2: { size: "1.25rem", weight: 600, lineHeight: "1.4", letterSpacing: "-0.015em" },
      h3: { size: "1.125rem", weight: 600, lineHeight: "1.45", letterSpacing: "-0.01em" },
      h4: { size: "1rem", weight: 600, lineHeight: "1.5", letterSpacing: "0" },
      body: { size: "0.9375rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.8rem", weight: 500, lineHeight: "1.5" },
    },
  },
  radius: "0.625rem",
  layout: {
    contentWidth: 640,
    sidebarWidth: 288,
    tocWidth: 256,
    toc: { enabled: true, depth: 4, style: "default" as const },
    header: { height: 56, sticky: true },
  },
  sidebar: {
    style: "default" as const,
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    HoverLink: { linkLabel: "Open page", showIndicator: false },
    Tabs: { style: "underline" as const },
  },
};

export const shadcn = createTheme({
  name: "shadcn",
  ui: ShadcnUIDefaults,
});

export { ShadcnUIDefaults };

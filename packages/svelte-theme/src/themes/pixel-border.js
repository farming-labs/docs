import { createTheme } from "@farming-labs/docs";

const PixelBorderUIDefaults = {
  colors: {
    primary: "oklch(0.985 0.001 106.423)",
    background: "hsl(0 0% 2%)",
    muted: "hsl(0 0% 55%)",
    border: "hsl(0 0% 15%)",
  },
  typography: {
    font: {
      style: {
        sans: "system-ui, -apple-system, sans-serif",
        mono: "ui-monospace, monospace",
      },
      h1: { size: "2.25rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.01em" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" },
    },
  },
  layout: {
    contentWidth: 860,
    sidebarWidth: 286,
    toc: { enabled: true, depth: 3 },
    header: { height: 56, sticky: true },
  },
  components: {},
};

export const pixelBorder = createTheme({
  name: "fumadocs-pixel-border",
  ui: PixelBorderUIDefaults,
});

export { PixelBorderUIDefaults };

import { defineDocs, createTheme } from "@farming-labs/docs";

const defaultTheme = createTheme({
  name: "fumadocs-default",
  ui: {
    colors: {
      primary: "#6366f1",
    },
    typography: {
      font: {
        style: {
          sans: "system-ui, -apple-system, sans-serif",
          mono: "ui-monospace, monospace",
        },
        h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.025em" },
        h2: { size: "1.5rem", weight: 600, letterSpacing: "-0.015em" },
        h3: { size: "1.25rem", weight: 600 },
        body: { size: "0.975rem", lineHeight: "1.8" },
      },
    },
  },
});

export default defineDocs({
  entry: "docs",
  theme: defaultTheme(),
  nav: {
    title: "Example Docs",
    url: "/docs",
  },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by @farming-labs/docs (SvelteKit)",
  },
});

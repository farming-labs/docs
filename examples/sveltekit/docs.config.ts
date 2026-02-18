import { defineDocs, createTheme } from "@farming-labs/docs";

const pixelBorder = createTheme({
  name: "fumadocs-pixel-border",
  ui: {
    colors: {
      primary: "oklch(0.985 0.001 106.423)",
      background: "hsl(0 0% 2%)",
    },
    typography: {
      font: {
        style: {
          sans: "system-ui, -apple-system, sans-serif",
          mono: "ui-monospace, monospace",
        },
        h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.02em" },
        h2: { size: "1.5rem", weight: 600, letterSpacing: "-0.01em" },
        h3: { size: "1.25rem", weight: 600 },
        body: { size: "1rem", lineHeight: "1.75" },
      },
    },
  },
});

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: pixelBorder(),
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/sveltekit/docs",
  },
  ai: {
    enabled: true,
    model: "gpt-4o-mini",
    maxResults: 5,
    aiLabel: "DocsBot",
    floatingStyle: "full-modal",
    mode: "floating",
    position: "bottom-right",
    packageName: "@farming-labs/docs",
    docsUrl: "https://docs.farming-labs.dev",
    suggestedQuestions: [
      "How do I get started?",
      "What databases are supported?",
      "How do I configure authentication?",
      "How do I set up social sign-on?",
    ],
  },
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

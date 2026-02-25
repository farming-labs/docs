import { defineDocs } from "@farming-labs/docs";
import { greentree } from "@farming-labs/nuxt-theme/greentree";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: greentree({
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
  }),
  nav: {
    title: "Example Docs",
    url: "/docs",
  },
  ai: {
    enabled: true,
    model: "gpt-4o-mini",
    maxResults: 5,
    aiLabel: "DocsBot",
    floatingStyle: "full-modal",
    mode: "floating",

    position: "bottom-right",
    suggestedQuestions: [
      "How do I get started?",
      "What databases are supported?",
      "How do I configure authentication?",
      "How do I set up social sign-on?",
    ],
  },
  themeToggle: { enabled: true, default: "dark" },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by @farming-labs/docs (Nuxt)",
  },
  ordering: "numeric",
});

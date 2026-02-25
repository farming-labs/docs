import { colorful } from "@farming-labs/astro-theme/colorful";
import { defineDocs } from "@farming-labs/docs";
import { greentree } from "@farming-labs/theme/greentree";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: colorful({
    ui: {
      components: { Callout: { variant: "outline" } },
      layout: {
        toc: { enabled: true, depth: 3, style: "default" },
        sidebarWidth: 300,
      },
      sidebar: { style: "default" },
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
  }),
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/astro/docs",
  },
  ai: {
    enabled: true,
    model: "gpt-4o-mini",
    maxResults: 5,
    aiLabel: "DocsBot",
    apiKey: import.meta.env.OPENAI_API_KEY,
    mode: "floating",
    floatingStyle: "modal",
    packageName: "@farming-labs/docs",
    docsUrl: "https://docs.farming-labs.dev",
    suggestedQuestions: [
      "How do I get started?",
      "What databases are supported?",
      "How do I configure authentication?",
      "How do I set up social sign-on?",
    ],
  },
  ordering: "numeric",
  nav: {
    title: "Example Docs",
    url: "/docs",
  },
  sidebar: { flat: false },
  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
    }
  },
  themeToggle: { enabled: false, default: "dark" },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by @farming-labs/docs (Astro)",
  },
});

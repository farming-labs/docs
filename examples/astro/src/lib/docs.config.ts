import { colorful } from "@farming-labs/astro-theme/colorful";
import { defineDocs } from "@farming-labs/docs";

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
    model: {
      models: [
        { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
        { id: "gpt-4o", label: "GPT-4o (quality)" },
      ],
      defaultModel: "gpt-4o-mini",
    },
    maxResults: 5,
    aiLabel: "DocsBot",
    apiKey: import.meta.env.OPENAI_API_KEY,
    mode: "floating",
    floatingStyle: "full-modal",
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
  sidebar: { flat: false, collapsible: true },
  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      providers: [
        {
          name: "ChatGPT",
          urlTemplate:
            "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it.",
        },
        {
          name: "Claude",
          urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it.",
        },
      ],
    },
  },
  llmsTxt: { enabled: true, baseUrl: "https://docs.farming-labs.dev" },
  lastUpdated: { enabled: true, position: "below-title" },
  themeToggle: { enabled: true, default: "dark" },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by @farming-labs/docs (Astro)",
  },
});

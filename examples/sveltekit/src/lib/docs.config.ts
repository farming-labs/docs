import { defineDocs } from "@farming-labs/docs";
import { hardline } from "@farming-labs/svelte-theme/hardline";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: hardline(),
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/sveltekit/docs",
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
  readingTime: { enabled: true, wordsPerMinute: 220 },
  themeToggle: { enabled: true, default: "dark" },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by @farming-labs/docs (SvelteKit)",
  },
  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      target: "markdown",
      providers: ["chatgpt", "claude", "cursor"],
    },
  },
  lastUpdated: { enabled: true, position: "below-title" },
  llmsTxt: { enabled: true, baseUrl: "https://docs.farming-labs.dev" },
  ordering: "numeric",
});

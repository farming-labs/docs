import { u as useStorage } from "../../nitro/nitro.mjs";
import { defineDocsHandler } from "@farming-labs/nuxt/server";
import { createTheme, defineDocs } from "@farming-labs/docs";
import "node:http";
import "node:https";
import "node:events";
import "node:buffer";
import "node:fs";
import "node:path";
import "node:crypto";
import "node:url";

const ColorfulUIDefaults = {
  colors: {
    primary: "hsl(40, 96%, 40%)",
    background: "#ffffff",
    muted: "#64748b",
    border: "#e5e7eb",
  },
  typography: {
    font: {
      style: {
        sans: "Inter, system-ui, sans-serif",
        mono: "JetBrains Mono, monospace",
      },
      h1: { size: "1.875rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" },
    },
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 260,
    toc: { enabled: true, depth: 3, style: "default" },
    header: { height: 56, sticky: true },
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" },
  },
};

const colorful = createTheme({
  name: "fumadocs-colorful",
  ui: ColorfulUIDefaults,
});

const config = defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: colorful({
    ui: {
      // colors: {
      //   primary: "oklch(0.985 0.001 106.423)",
      //   background: "hsl(0 0% 2%)",
      // },
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
    titleTemplate: "%s \u2013 Docs",
    description: "Awesome docs powered by @farming-labs/docs (Nuxt)",
  },
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
  ordering: "numeric",
});

const docs = defineDocsHandler(config, useStorage);

export { docs as default };
//# sourceMappingURL=docs.mjs.map

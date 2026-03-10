import { createTheme, defineDocs } from "@farming-labs/docs";
import "clsx";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
import "sugar-high";
const DefaultUIDefaults = {
  colors: {
    primary: "#6366f1",
    background: "#ffffff",
    muted: "#64748b",
    border: "#e5e7eb"
  },
  typography: {
    font: {
      style: {
        sans: "Inter, system-ui, sans-serif",
        mono: "JetBrains Mono, monospace"
      },
      h1: { size: "2rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 280,
    toc: { enabled: true, depth: 3 },
    header: { height: 72, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
createTheme({
  name: "fumadocs-default",
  ui: DefaultUIDefaults
});
const PixelBorderUIDefaults = {
  colors: {
    primary: "oklch(0.985 0.001 106.423)",
    background: "hsl(0 0% 2%)",
    muted: "hsl(0 0% 55%)",
    border: "hsl(0 0% 15%)"
  },
  typography: {
    font: {
      style: {
        sans: "system-ui, -apple-system, sans-serif",
        mono: "ui-monospace, monospace"
      },
      h1: { size: "2.25rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.01em" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 860,
    sidebarWidth: 286,
    toc: { enabled: true, depth: 3 },
    header: { height: 56, sticky: true }
  },
  components: {}
};
createTheme({
  name: "fumadocs-pixel-border",
  ui: PixelBorderUIDefaults
});
const DarksharpUIDefaults = {
  colors: {
    primary: "#fafaf9",
    background: "#000000",
    muted: "#a8a29e",
    border: "#292524"
  },
  typography: {
    font: {
      style: {
        sans: "Geist, system-ui, sans-serif",
        mono: "Geist Mono, monospace"
      },
      h1: { size: "2rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 280,
    toc: { enabled: true, depth: 3 },
    header: { height: 56, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
createTheme({
  name: "fumadocs-darksharp",
  ui: DarksharpUIDefaults
});
const ColorfulUIDefaults = {
  colors: {
    primary: "hsl(40, 96%, 40%)",
    background: "#ffffff",
    muted: "#64748b",
    border: "#e5e7eb"
  },
  typography: {
    font: {
      style: {
        sans: "Inter, system-ui, sans-serif",
        mono: "JetBrains Mono, monospace"
      },
      h1: { size: "1.875rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 260,
    toc: { enabled: true, depth: 3, style: "default" },
    header: { height: 56, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
createTheme({
  name: "fumadocs-colorful",
  ui: ColorfulUIDefaults
});
const GreenTreeUIDefaults = {
  colors: {
    primary: "#0D9373",
    background: "#fff",
    muted: "#505351",
    border: "#DFE1E0"
  },
  typography: {
    font: {
      style: {
        sans: "Inter, -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
        mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
      },
      h1: { size: "2.25rem", weight: 500, lineHeight: "1.2", letterSpacing: "-0.025em" },
      h2: { size: "1.875rem", weight: 600, lineHeight: "1.25", letterSpacing: "-0.02em" },
      h3: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.01em" },
      h4: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.7" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 240,
    toc: { enabled: true, depth: 3, style: "default" },
    header: { height: 56, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
const greentree = createTheme({
  name: "greentree",
  ui: GreenTreeUIDefaults
});
const config = defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: greentree({
    ui: {
      colors: {
        primary: "oklch(0.985 0.001 106.423)",
        background: "hsl(0 0% 2%)"
      },
      typography: {
        font: {
          style: {
            sans: "system-ui, -apple-system, sans-serif",
            mono: "ui-monospace, monospace"
          },
          h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.02em" },
          h2: { size: "1.5rem", weight: 600, letterSpacing: "-0.01em" },
          h3: { size: "1.25rem", weight: 600 },
          body: { size: "1rem", lineHeight: "1.75" }
        }
      }
    }
  }),
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/sveltekit/docs"
  },
  ai: {
    enabled: true,
    model: {
      models: [
        { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
        { id: "gpt-4o", label: "GPT-4o (quality)" }
      ],
      defaultModel: "gpt-4o-mini"
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
      "How do I set up social sign-on?"
    ]
  },
  nav: {
    title: "Example Docs",
    url: "/docs"
  },
  themeToggle: { enabled: true, default: "dark" },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by @farming-labs/docs (SvelteKit)"
  },
  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      providers: [
        {
          name: "ChatGPT",
          urlTemplate: "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
        },
        {
          name: "Claude",
          urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
        }
      ]
    }
  },
  lastUpdated: { enabled: true, position: "below-title" },
  llmsTxt: { enabled: true, baseUrl: "https://docs.farming-labs.dev" },
  ordering: "numeric"
});
export {
  config as c
};

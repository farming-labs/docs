import { defineDocs } from "@farming-labs/docs";
import { colorful } from "@farming-labs/theme/colorful";
import { pixelBorder } from "@farming-labs/theme/pixel-border";
import {
  BookOpen,
  Rocket,
  Terminal,
  FileText,
  Settings,
  Palette,
  Layers,
  Zap,
  Code,
  Lightbulb
} from "lucide-react";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder({
    ui: {
      layout: { toc: { enabled: true, depth: 3, style: "directional" } },
      sidebar: { style: "floating" },
      typography: {
        font: {
          style: {
            sans: "var(--font-geist-sans, system-ui, -apple-system, sans-serif)",
            mono: "var(--font-geist-mono, ui-monospace, monospace)",
          },
        h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.025em" },
          h2: { size: "1.5rem", weight: 600, letterSpacing: "-0.015em" },
          h3: { size: "1.25rem", weight: 600 },
          body: { size: "0.975rem", lineHeight: "1.8" },
        },
      },
    },
  }),
  nav: {
    title: (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="text-xs uppercase font-mono tracking-tighter">
          @farming-labs/docs
        </span>
      </div>
    ),
    url: "/docs",
  },
  icons: {
    book: <BookOpen size={16} />,
    rocket: <Rocket size={16} />,
    terminal: <Terminal size={16} />,
    file: <FileText size={16} />,
    settings: <Settings size={16} />,
    palette: <Palette size={16} />,
    layers: <Layers size={16} />,
    zap: <Zap size={16} />,
    code: <Code size={16} />,
    lightbulb: <Lightbulb size={16} />,
  },
  github: {
    url: "https://github.com/farming-labs/docs",
    directory: "website",
  },

  breadcrumb: { enabled: true },

  pageActions: {
    copyMarkdown: { enabled: true },
  },

  metadata: {
    titleTemplate: "%s – @farming-labs/docs",
    description: "A modern, flexible MDX documentation framework.",
  },
  ordering: "numeric", 
  ai: {
    enabled: true,
    mode: "floating",
    position: "bottom-right",
    floatingStyle: "full-modal",
    apiKey: process.env.OPENAI_API_KEY,
    aiLabel: "DocsBot",
    suggestedQuestions: [
      "How do I get started?",
      "What themes are available?",
      "How do I create a custom component?",
      "How do I configure the sidebar?",
    ],
    loadingComponent: ({ name }) => (
      <div className="flex justify-start gap-2 items-center">
        <div className="flex gap-1 items-end text-sm text-fd-muted-foreground">
          <div className="flex gap-1 items-center opacity-70">
            <span className="inline-block size-1 bg-fd-primary rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="inline-block size-1 opacity-80 bg-fd-primary rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="inline-block size-1 bg-fd-primary rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    ),
  },
  themeToggle: {
    enabled: false,
    default: "dark",
  },
});

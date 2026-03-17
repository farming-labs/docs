import { defineDocs } from "@farming-labs/docs";
import { Rocket, BookOpen, Sparkles } from "lucide-react";
import { MyNote } from "./src/components/my-note";
import { colorful } from "@farming-labs/theme/colorful";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    exclude: ["/api/docs"],
  },
  theme: colorful({
    ui: {
      components: { Callout: { variant: "outline" } },
      layout: {
        toc: { enabled: true, depth: 3, style: "default" },
        sidebarWidth: 300,
      },
      typography: {
        font: {
          style: {
            sans: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
        <Rocket size={14} />
        <span className="uppercase font-mono tracking-tighter">Example Docs</span>
      </div>
    ),
    url: "/docs",
  },
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/tanstack-start/docs",
  },
  icons: {
    rocket: <Rocket size={16} />,
    book: <BookOpen size={16} />,
    sparkles: <Sparkles size={16} />,
  },
  components: {
    MyNote,
  },
  sidebar: { flat: true },
  breadcrumb: { enabled: true },
  lastUpdated: { position: "below-title" },
  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: { enabled: true },
  },
  llmsTxt: { baseUrl: "https://docs.farming-labs.dev" },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "TanStack Start example powered by @farming-labs/docs",
  },
  themeToggle: {
    enabled: true,
    default: "dark",
  },
});

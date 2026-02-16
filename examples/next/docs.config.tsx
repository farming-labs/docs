import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/fumadocs/pixel-border";
import { MyNote } from "./app/components/my-note";
import {
  BookOpen,
  Rocket,
  Terminal,
  FileText,
  Settings,
  Lightbulb,
  FolderOpen,
  Puzzle,
  Link,
  Shield,
  Database,
  Code,
  Key,
  Users,
  Mail
} from "lucide-react";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder({
    ui: {
      components: { Callout: { variant: "outline" }},
      layout: { toc: { enabled: true, depth: 3 } },
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
        <Rocket size={14} />
        <span style={{ fontWeight: 600 }} className="uppercase">Example Docs</span>
      </div>
    ),
    url: "/docs",
  },

  components: {
    MyNote,
  },
  icons: {
    book: <BookOpen size={16} />,
    rocket: <Rocket size={16} />,
    terminal: <Terminal size={16} />,
    file: <FileText size={16} />,
    settings: <Settings size={16} />,
    lightbulb: <Lightbulb size={16} />,
    folder: <FolderOpen size={16} />,
    puzzle: <Puzzle size={16} />,
    link: <Link size={13} />,
    shield: <Shield size={16} />,
    database: <Database size={16} />,
    code: <Code size={16} />,
    key: <Key size={16} />,
    users: <Users size={16} />,
    email: <Mail size={13} />,
  },

  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by Fumadocs preset",
  },
  themeToggle: {
    enabled: false,
    default: "dark",
  },
  og: {
    enabled: true,
    type: "dynamic",
    endpoint: "/api/og",
    defaultImage: "/og/default.png",
  },
});

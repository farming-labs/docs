import { defineDocs } from "@farming-labs/docs";
import { darksharp } from "@farming-labs/fumadocs/darksharp";
import { MyNote } from "./app/components/my-note";
import {
  BookOpen,
  Rocket,
  Terminal,
  FileText,
  Settings,
  Lightbulb,
  FolderOpen,
} from "lucide-react";

export default defineDocs({
  entry: "docs",
  theme: darksharp({
    ui: {
      components: { Callout: { variant: "outline" } },
      layout: { toc: { enabled: true, depth: 3 } },
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

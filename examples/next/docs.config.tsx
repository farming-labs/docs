import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/fumadocs";
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
  theme: fumadocs({
    ui: {
      colors: { primary: "#22c55e" },
      components: { Callout: { variant: "outline" } },
      layout: { toc: { enabled: true, depth: 3 } },
    },
  }),

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

  og: {
    enabled: true,
    type: "dynamic",
    endpoint: "/api/og",
    defaultImage: "/og/default.png",
  },
});

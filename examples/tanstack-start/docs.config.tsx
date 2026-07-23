import { defineDocs } from "@farming-labs/docs";
import { Rocket, BookOpen, Sparkles } from "lucide-react";
import { MyNote } from "./src/components/my-note";
import { hardline } from "@farming-labs/theme/hardline";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: hardline(),
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
  readingTime: { enabled: true, wordsPerMinute: 220 },
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
  tweaks: { reader: true, author: process.env.NODE_ENV !== "production" },
});

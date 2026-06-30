import { defineDocs } from "@farming-labs/docs";
import { threadline, threadlinePageActions } from "@farming-labs/theme/threadline";
import {
  BookOpen,
  Code,
  Database,
  FileText,
  FolderOpen,
  Key,
  Lightbulb,
  Link,
  Mail,
  Puzzle,
  Rocket,
  Settings,
  Shield,
  Terminal,
  Users,
} from "lucide-react";
import { ChangelogActions } from "./app/components/changelog-actions";
import { MyNote } from "./app/components/my-note";

export default defineDocs({
  entry: "docs",
  cloud: {
    apiKey: {
      env: "DOCS_CLOUD_API_KEY",
    },
  },
  ai: {
    enabled: true,
    provider: "docs-cloud",
  },
  analytics: {
    cloud: true,
    includeInputs: false,
  },
  theme: threadline(),
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/fumadocs-cloud",
  },
  changelog: {
    enabled: true,
    path: "changelogs",
    contentDir: "changelog",
    title: "Changelog",
    description:
      "Track the latest updates, bug fixes, and shipped improvements across @farming-labs/docs.",
    search: false,
    actionsComponent: ChangelogActions,
  },
  nav: {
    title: (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Rocket size={14} />
        <span className="uppercase font-mono tracking-tighter">Fumadocs Cloud</span>
      </div>
    ),
    url: "/docs",
  },
  components: {
    MyNote,
  },
  icons: {
    book: <BookOpen size={16} />,
    code: <Code size={16} />,
    database: <Database size={16} />,
    email: <Mail size={13} />,
    file: <FileText size={16} />,
    folder: <FolderOpen size={16} />,
    key: <Key size={16} />,
    lightbulb: <Lightbulb size={16} />,
    link: <Link size={13} />,
    puzzle: <Puzzle size={16} />,
    rocket: <Rocket size={16} />,
    settings: <Settings size={16} />,
    shield: <Shield size={16} />,
    terminal: <Terminal size={16} />,
    users: <Users size={16} />,
  },
  sidebar: {
    flat: true,
  },
  breadcrumb: {
    enabled: true,
  },
  lastUpdated: false,
  pageActions: threadlinePageActions,
  ordering: "numeric",
  metadata: {
    titleTemplate: "%s - Fumadocs Cloud Example",
    description: "Example Fumadocs setup using the merged Docs Cloud API route.",
  },
  themeToggle: {
    enabled: true,
    default: "light",
  },
});

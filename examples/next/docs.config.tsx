import { defineDocs, type DocsSearchConfig } from "@farming-labs/docs";
import { MyNote } from "./app/components/my-note";
import { ChangelogActions } from "./app/components/changelog-actions";
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
  Mail,
} from "lucide-react";
import { hardline } from "@farming-labs/theme/hardline";

const typesenseBaseUrl = process.env.TYPESENSE_URL ?? process.env.TYPESENSE_BASE_URL;
const typesenseCollection = process.env.TYPESENSE_COLLECTION ?? "docs";
const typesenseSearchApiKey = process.env.TYPESENSE_SEARCH_API_KEY ?? process.env.TYPESENSE_API_KEY;
const typesenseAdminApiKey = process.env.TYPESENSE_ADMIN_API_KEY ?? process.env.TYPESENSE_API_KEY;
const typesenseMode: "keyword" | "hybrid" =
  process.env.TYPESENSE_MODE === "hybrid" ? "hybrid" : "keyword";
const algoliaAppId = process.env.ALGOLIA_APP_ID;
const algoliaIndexName = process.env.ALGOLIA_INDEX_NAME ?? "docs";
const algoliaSearchApiKey = process.env.ALGOLIA_SEARCH_API_KEY;
const algoliaAdminApiKey = process.env.ALGOLIA_ADMIN_API_KEY;
const docsSearchProvider = process.env.DOCS_SEARCH_PROVIDER;

const searchConfig: DocsSearchConfig | undefined =
  (docsSearchProvider === "typesense" ||
    (!docsSearchProvider && typesenseBaseUrl && typesenseSearchApiKey)) &&
  typesenseBaseUrl &&
  typesenseSearchApiKey
    ? {
        provider: "typesense" as const,
        baseUrl: typesenseBaseUrl,
        collection: typesenseCollection,
        apiKey: typesenseSearchApiKey,
        adminApiKey: typesenseAdminApiKey,
        mode: typesenseMode,
        ...(typesenseMode === "hybrid" &&
        process.env.TYPESENSE_OLLAMA_MODEL &&
        (process.env.TYPESENSE_OLLAMA_BASE_URL || "http://127.0.0.1:11434")
          ? {
              embeddings: {
                provider: "ollama" as const,
                model: process.env.TYPESENSE_OLLAMA_MODEL,
                baseUrl: process.env.TYPESENSE_OLLAMA_BASE_URL,
              },
            }
          : {}),
      }
    : (docsSearchProvider === "algolia" ||
          (!docsSearchProvider && algoliaAppId && algoliaSearchApiKey)) &&
        algoliaAppId &&
        algoliaSearchApiKey
      ? {
          provider: "algolia" as const,
          appId: algoliaAppId,
          indexName: algoliaIndexName,
          searchApiKey: algoliaSearchApiKey,
          adminApiKey: algoliaAdminApiKey,
        }
      : docsSearchProvider === "mcp"
        ? {
            provider: "mcp" as const,
            endpoint: "/api/docs/mcp",
          }
        : undefined;

export default defineDocs({
  entry: "docs",
  ...(searchConfig ? { search: searchConfig } : {}),
  observability: {
    console: "debug",
  },
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/next",
  },
  cloud: {
    apiKey: {
      env: "DOCS_CLOUD_API_KEY",
    },
    deploy: {
      enabled: true,
    },
    publish: {
      mode: "draft-pr",
      baseBranch: "main",
    },
  },
  theme: hardline(),
  ai: {
    enabled: true,
    // mode: "sidebar-icon",
    mode: "floating",
    position: "bottom-right",
    floatingStyle: "full-modal",
    apiKey: process.env.OPENAI_API_KEY,
    model: {
      models: [
        { id: "gpt-4o-mini", label: "GPT-4o mini (fast)", provider: "openai" },
        { id: "gpt-4o", label: "GPT-4o (quality)", provider: "openai" },
      ],
      defaultModel: "gpt-4o-mini",
    },
    aiLabel: "AI",
    suggestedQuestions: [
      "How do I get started?",
      "What themes are available?",
      "How do I create a custom component?",
      "How do I configure the sidebar?",
    ],
    loader: "shimmer-dots",
  },
  agent: {
    compact: {
      apiKeyEnv: "DOCS_CLOUD_API_KEY",
      model: "docs-cloud-compress-v1",
      aggressiveness: 0.3,
    },
  },
  apiReference: {
    enabled: true,
    path: "api-reference",
    renderer: "fumadocs",
    exclude: ["/api/docs", "/api/docs/mcp", "/api/search", "/api/og"],
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
    title: "Example Docs",
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

  sidebar: { flat: true },
  breadcrumb: { enabled: true },

  readingTime: { enabled: true, wordsPerMinute: 220 },
  lastUpdated: { enabled: true, position: "below-title" },

  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      target: "markdown",
      providers: ["chatgpt", "claude", "cursor"],
    },
  },
  ordering: "numeric",
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by Fumadocs preset",
  },
  themeToggle: {
    enabled: true,
    default: "dark",
  },
  og: {
    enabled: true,
    type: "dynamic",
    endpoint: "/api/og",
    defaultImage: "/og/default.png",
  },
});

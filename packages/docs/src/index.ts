/**
 * @farming-labs/docs
 *
 * Modern, flexible MDX-based docs framework with themes and SEO support.
 * Inspired by Fumadocs: https://github.com/fuma-nama/fumadocs
 *
 * Framework-agnostic core - works with Next.js, Vite, etc.
 */

import type { DocsConfig } from "./types.js";

export { defineDocs } from "./define-docs.js";
export { resolveChangelogConfig } from "./changelog.js";
export { deepMerge } from "./utils.js";
export { createTheme, extendTheme } from "./create-theme.js";
export { resolveDocsI18n, resolveDocsLocale, resolveDocsPath } from "./i18n.js";
export { resolveTitle, resolveOGImage, buildPageOpenGraph, buildPageTwitter } from "./metadata.js";
export {
  buildDocsSearchDocuments,
  createAlgoliaSearchAdapter,
  createCustomSearchAdapter,
  createMcpSearchAdapter,
  createSimpleSearchAdapter,
  createTypesenseSearchAdapter,
  performDocsSearch,
  resolveSearchRequestConfig,
} from "./search.js";
export type {
  DocsConfig,
  ChangelogConfig,
  ChangelogFrontmatter,
  ApiReferenceConfig,
  ApiReferenceRenderer,
  DocsI18nConfig,
  DocsMcpConfig,
  DocsMcpToolsConfig,
  DocsNav,
  DocsTheme,
  DocsMetadata,
  OGConfig,
  OpenGraphImage,
  PageOpenGraph,
  PageTwitter,
  UIConfig,
  FontStyle,
  TypographyConfig,
  PageFrontmatter,
  ThemeToggleConfig,
  BreadcrumbConfig,
  SidebarConfig,
  SidebarComponentProps,
  SidebarTree,
  SidebarNode,
  SidebarPageNode,
  SidebarFolderNode,
  PageActionsConfig,
  CopyMarkdownConfig,
  OpenDocsConfig,
  OpenDocsProvider,
  GithubConfig,
  AIConfig,
  OrderingItem,
  LastUpdatedConfig,
  LlmsTxtConfig,
  CodeBlockCopyData,
  DocsFeedbackValue,
  DocsFeedbackData,
  DocsAgentFeedbackContext,
  DocsAgentFeedbackData,
  FeedbackConfig,
  AgentFeedbackConfig,
  DocsSearchAdapter,
  DocsSearchAdapterContext,
  DocsSearchAdapterFactory,
  DocsSearchChunkingConfig,
  DocsSearchConfig,
  DocsSearchDocument,
  DocsSearchQuery,
  DocsSearchResult,
  DocsSearchResultType,
  DocsSearchSourcePage,
  SimpleDocsSearchConfig,
  AlgoliaDocsSearchConfig,
  TypesenseDocsSearchConfig,
  CustomDocsSearchConfig,
  DocsSearchEmbeddingsConfig,
  McpDocsSearchConfig,
} from "./types.js";
export type { ChangelogEntrySummary, ResolvedChangelogConfig } from "./changelog.js";
export type { ResolvedDocsI18n, DocsPathMatch } from "./i18n.js";

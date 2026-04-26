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
  estimateReadingTimeMinutes,
  resolveReadingTimeFromContent,
  resolveReadingTimeFromSource,
  resolveReadingTimeOptions,
} from "./reading-time.js";
export { normalizeDocsRelated, renderDocsRelatedMarkdownLines } from "./related.js";
export {
  DEFAULT_AGENT_FEEDBACK_ROUTE,
  DEFAULT_AGENT_SPEC_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
  DEFAULT_DOCS_API_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE,
  DEFAULT_LLMS_TXT_ROUTE,
  DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE,
  DEFAULT_MCP_PUBLIC_ROUTE,
  DEFAULT_MCP_ROUTE,
  DEFAULT_MCP_WELL_KNOWN_ROUTE,
  DEFAULT_SKILL_MD_ROUTE,
  DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
  buildDocsAgentDiscoverySpec,
  findDocsMarkdownPage,
  isDocsAgentDiscoveryRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsSkillRequest,
  normalizeDocsPathSegment,
  normalizeDocsUrlPath,
  renderDocsMarkdownDocument,
  renderDocsSkillDocument,
  resolveDocsAgentMdxContent,
  resolveDocsLlmsTxtFormat,
  resolveDocsSkillFormat,
  resolveDocsMarkdownRequest,
} from "./agent.js";
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
  DocsRelatedItem,
  ResolvedDocsRelatedLink,
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
  ReadingTimeConfig,
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
export type {
  DocsAgentDiscoverySpecOptions,
  DocsAgentFeedbackDiscoveryConfig,
  DocsLlmsDiscoveryConfig,
  DocsMarkdownPage,
  DocsSkillDocumentOptions,
} from "./agent.js";

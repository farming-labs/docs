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
export { createDocsCloudAnalytics } from "./cloud-analytics.js";
export {
  DOCS_AGENT_TRACE_EVENT_TYPES,
  createDocsAgentTraceContext,
  createDocsAgentTraceId,
  emitDocsAgentTraceEvent,
  emitDocsAnalyticsEvent,
  emitDocsObservabilityEvent,
  resolveDocsAnalyticsConfig,
  resolveDocsObservabilityConfig,
} from "./analytics.js";
export { resolveChangelogConfig } from "./changelog.js";
export { deepMerge } from "./utils.js";
export { createTheme, extendTheme } from "./create-theme.js";
export { resolveDocsI18n, resolveDocsLocale, resolveDocsPath } from "./i18n.js";
export { resolveTitle, resolveOGImage, buildPageOpenGraph, buildPageTwitter } from "./metadata.js";
export {
  estimateReadingTimeMinutes,
  resolvePageReadingTime,
  resolveReadingTimeFromContent,
  resolveReadingTimeFromSource,
  resolveReadingTimeOptions,
} from "./reading-time.js";
export { normalizeDocsRelated, renderDocsRelatedMarkdownLines } from "./related.js";
export {
  applySidebarFolderIndexBehavior,
  resolvePageSidebarFolderIndexBehavior,
  resolveSidebarFolderIndexBehavior,
  resolveSidebarFolderIndexBehaviorForPath,
} from "./sidebar.js";
export {
  GENERATED_AGENT_PROVENANCE_MARKER,
  GENERATED_AGENT_PROVENANCE_VERSION,
  hashGeneratedAgentContent,
  normalizeGeneratedAgentContent,
  parseGeneratedAgentDocument,
  serializeGeneratedAgentDocument,
  stripGeneratedAgentProvenance,
} from "./agent-provenance.js";
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
  DEFAULT_SITEMAP_MANIFEST_PATH,
  DEFAULT_SITEMAP_MD_ROUTE,
  DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE,
  DEFAULT_SITEMAP_XML_ROUTE,
  buildDocsSitemapManifest,
  createDocsSitemapResponse,
  readDocsSitemapManifest,
  readDocsSitemapManifestFromContentMap,
  renderDocsSitemapMarkdown,
  renderDocsSitemapXml,
  resolveDocsSitemapConfig,
  resolveDocsSitemapRequest,
  toDocsSitemapMarkdownUrl,
} from "./sitemap.js";
export type {
  DocsSitemapFormat,
  DocsSitemapManifest,
  DocsSitemapManifestPage,
  DocsSitemapPageInput,
  DocsSitemapResolvedConfig,
} from "./sitemap.js";
export {
  buildDocsSearchDocuments,
  buildDocsAskAIContext,
  createAlgoliaSearchAdapter,
  createCustomSearchAdapter,
  createMcpSearchAdapter,
  createSimpleSearchAdapter,
  createTypesenseSearchAdapter,
  formatDocsAskAIPackageHints,
  inferDocsAskAIPackageHints,
  performDocsSearch,
  resolveAskAISearchRequestConfig,
  resolveSearchRequestConfig,
} from "./search.js";
export type { GeneratedAgentProvenance, GeneratedAgentSourceKind } from "./agent-provenance.js";
export type {
  DocsConfig,
  DocsSitemapConfig,
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
  PageSidebarFrontmatter,
  ThemeToggleConfig,
  BreadcrumbConfig,
  SidebarConfig,
  SidebarComponentProps,
  SidebarFolderIndexBehavior,
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
  DocsAskAIActionData,
  DocsAskAIActionType,
  DocsAskAIFeedbackConfig,
  DocsAskAIFeedbackData,
  DocsAskAIFeedbackMessage,
  DocsAskAIFeedbackValue,
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
  DocsAskAIMcpConfig,
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
  DocsAnalyticsConfig,
  DocsAnalyticsEvent,
  DocsAnalyticsEventInput,
  DocsAnalyticsEventType,
  DocsAnalyticsInput,
  DocsAnalyticsSource,
  DocsObservabilityConfig,
  DocsObservabilityEvent,
  DocsObservabilityEventInput,
  DocsAgentTraceEventInput,
  DocsAgentTraceEventType,
  DocsAgentTraceStatus,
} from "./types.js";
export type {
  DocsAgentTraceContext,
  ResolvedDocsAnalyticsConfig,
  ResolvedDocsObservabilityConfig,
} from "./analytics.js";
export type { DocsCloudAnalyticsOptions } from "./cloud-analytics.js";
export type { ChangelogEntrySummary, ResolvedChangelogConfig } from "./changelog.js";
export type { ResolvedDocsI18n, DocsPathMatch } from "./i18n.js";
export type {
  DocsAgentDiscoverySpecOptions,
  DocsAgentFeedbackDiscoveryConfig,
  DocsLlmsDiscoveryConfig,
  DocsMarkdownPage,
  DocsSkillDocumentOptions,
} from "./agent.js";

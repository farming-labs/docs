import type { DocsConfig } from "./types.js";

/**
 * Define docs configuration. Validates and returns the config.
 */
export function defineDocs(config: DocsConfig): DocsConfig {
  return {
    entry: config.entry ?? "docs",
    contentDir: config.contentDir,
    i18n: config.i18n,
    theme: config.theme,
    nav: config.nav,
    github: config.github,
    themeToggle: config.themeToggle,
    breadcrumb: config.breadcrumb,
    sidebar: config.sidebar,
    components: config.components,
    onCopyClick: config.onCopyClick,
    feedback: config.feedback,
    search: config.search,
    mcp: config.mcp,
    icons: config.icons,
    pageActions: config.pageActions,
    lastUpdated: config.lastUpdated,
    readingTime: config.readingTime,
    llmsTxt: config.llmsTxt,
    ai: config.ai,
    ordering: config.ordering,
    metadata: config.metadata,
    og: config.og,
    changelog: config.changelog,
    apiReference: config.apiReference,
    agent: config.agent,
  };
}

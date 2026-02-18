import type { DocsConfig } from "./types.js";

/**
 * Define docs configuration. Validates and returns the config.
 */
export function defineDocs(config: DocsConfig): DocsConfig {
  return {
    entry: config.entry ?? "docs",
    contentDir: config.contentDir,
    theme: config.theme,
    nav: config.nav,
    github: config.github,
    themeToggle: config.themeToggle,
    breadcrumb: config.breadcrumb,
    sidebar: config.sidebar,
    components: config.components,
    icons: config.icons,
    pageActions: config.pageActions,
    ai: config.ai,
    metadata: config.metadata,
    og: config.og,
  };
}

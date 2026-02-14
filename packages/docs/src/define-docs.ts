import type { DocsConfig } from "./types.js";

/**
 * Define docs configuration. Validates and returns the config.
 */
export function defineDocs(config: DocsConfig): DocsConfig {
  return {
    entry: config.entry ?? "docs",
    theme: config.theme,
    nav: config.nav,
    themeToggle: config.themeToggle,
    breadcrumb: config.breadcrumb,
    sidebar: config.sidebar,
    components: config.components,
    icons: config.icons,
    metadata: config.metadata,
    og: config.og,
  };
}

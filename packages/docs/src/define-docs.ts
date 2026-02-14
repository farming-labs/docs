import type { DocsConfig } from "./types.js";

/**
 * Define docs configuration. Validates and returns the config.
 */
export function defineDocs(config: DocsConfig): DocsConfig {
  return {
    entry: config.entry ?? "docs",
    theme: config.theme,
    components: config.components,
    icons: config.icons,
    metadata: config.metadata,
    og: config.og,
  };
}

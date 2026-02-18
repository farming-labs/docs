/**
 * @farming-labs/svelte
 *
 * SvelteKit adapter for the @farming-labs/docs framework.
 * Provides content loading, navigation tree building, and search
 * for SvelteKit-based documentation sites.
 */

export { loadDocsContent, loadDocsNavTree, flattenNavTree, type NavNode, type NavTree, type PageNode, type FolderNode } from "./content.js";
export { createMdsvexConfig } from "./config.js";

/**
 * @farming-labs/astro
 *
 * Astro adapter for the @farming-labs/docs framework.
 * Provides content loading, navigation tree building, search,
 * and server-side markdown rendering for Astro-based documentation sites.
 */

export {
  loadDocsContent,
  loadDocsNavTree,
  flattenNavTree,
  type NavNode,
  type NavTree,
  type PageNode,
  type FolderNode,
} from "./content.js";
export { renderMarkdown } from "./markdown.js";
export { createDocsServer, type DocsServer } from "./server.js";

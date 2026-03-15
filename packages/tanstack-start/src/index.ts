/**
 * @farming-labs/tanstack-start
 *
 * TanStack Start adapter for the @farming-labs/docs framework.
 * Provides content loading, navigation tree building, search,
 * and server-side helpers for TanStack Start-based documentation sites.
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
export { createDocsServer, type DocsServer, type DocsServerLoadResult } from "./server.js";
export { docsMdx } from "./vite.js";

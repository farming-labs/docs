/**
 * Search API — backward-compatible re-export.
 *
 * New projects should use `createDocsAPI` from `@farming-labs/fumadocs/api`
 * which provides a unified handler for both search (GET) and AI chat (POST).
 *
 * This module is kept for backward compatibility with existing projects
 * that import `createDocsSearchAPI` from `@farming-labs/fumadocs/search`.
 *
 * @example
 * ```ts
 * // Recommended (new): app/api/docs/route.ts
 * import { createDocsAPI } from "@farming-labs/fumadocs/api";
 * export const { GET, POST } = createDocsAPI();
 *
 * // Legacy: app/api/search/route.ts
 * import { createDocsSearchAPI } from "@farming-labs/fumadocs/search";
 * export const { GET } = createDocsSearchAPI();
 * ```
 */

import { createDocsAPI } from "./docs-api.js";

/**
 * @deprecated Use `createDocsAPI` from `@farming-labs/fumadocs/api` instead.
 * This function is kept for backward compatibility.
 */
export function createDocsSearchAPI(options?: {
  entry?: string;
  language?: string;
}) {
  return createDocsAPI({ entry: options?.entry, language: options?.language });
}

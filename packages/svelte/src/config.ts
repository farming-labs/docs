/**
 * Mdsvex configuration helper for @farming-labs/docs.
 *
 * Returns a pre-configured mdsvex options object that handles
 * frontmatter extraction and syntax highlighting.
 *
 * @example
 * ```js
 * // svelte.config.js
 * import { createMdsvexConfig } from "@farming-labs/svelte/config";
 *
 * const mdsvexConfig = createMdsvexConfig();
 *
 * export default {
 *   extensions: [".svelte", ".svx"],
 *   preprocess: [mdsvex(mdsvexConfig)],
 * };
 * ```
 */

export interface MdsvexConfigOptions {
  extensions?: string[];
  highlighter?: unknown;
}

export function createMdsvexConfig(options?: MdsvexConfigOptions) {
  return {
    extensions: options?.extensions ?? [".svx", ".md"],
    smartypants: { dashes: "oldschool" as const },
    layout: undefined,
  };
}

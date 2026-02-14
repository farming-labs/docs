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
export { deepMerge } from "./utils.js";
export { resolveTitle, resolveOGImage } from "./metadata.js";
export type {
  DocsConfig,
  DocsTheme,
  DocsMetadata,
  OGConfig,
  UIConfig,
  PageFrontmatter,
} from "./types.js";

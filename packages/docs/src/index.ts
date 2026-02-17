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
export { createTheme, extendTheme } from "./create-theme.js";
export { resolveTitle, resolveOGImage } from "./metadata.js";
export type {
  DocsConfig,
  DocsNav,
  DocsTheme,
  DocsMetadata,
  OGConfig,
  UIConfig,
  FontStyle,
  TypographyConfig,
  PageFrontmatter,
  ThemeToggleConfig,
  BreadcrumbConfig,
  SidebarConfig,
  PageActionsConfig,
  CopyMarkdownConfig,
  OpenDocsConfig,
  OpenDocsProvider,
  GithubConfig,
} from "./types.js";

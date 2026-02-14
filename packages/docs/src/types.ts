/**
 * Theme / UI configuration types for the docs framework.
 * Inspired by Fumadocs: https://github.com/fuma-nama/fumadocs
 */

export interface UIConfig {
  colors?: {
    primary?: string;
    background?: string;
    muted?: string;
    border?: string;
  };
  typography?: {
    fontFamily?: string;
    monoFontFamily?: string;
    scale?: {
      h1?: string;
      h2?: string;
      h3?: string;
      body?: string;
    };
  };
  layout?: {
    contentWidth?: number;
    sidebarWidth?: number;
    toc?: {
      enabled?: boolean;
      depth?: number;
    };
    header?: {
      height?: number;
      sticky?: boolean;
    };
  };
  /** Default props/variants for MDX components (Callout, CodeBlock, Tabs, etc.) */
  components?: {
    [key: string]: Record<string, unknown> | ((defaults: unknown) => unknown);
  };
}

export interface DocsTheme {
  name?: string;
  ui?: UIConfig;
}

export interface DocsMetadata {
  titleTemplate?: string;
  description?: string;
  twitterCard?: "summary" | "summary_large_image";
}

export interface OGConfig {
  enabled?: boolean;
  type?: "static" | "dynamic";
  endpoint?: string;
  defaultImage?: string;
}

export interface PageFrontmatter {
  title: string;
  description?: string;
  tags?: string[];
  icon?: string;
  /** Path to custom OG image for this page */
  ogImage?: string;
}

export interface DocsConfig {
  /** Entry folder for docs (e.g. "docs" → /docs) */
  entry: string;
  /** Theme configuration - single source of truth for UI */
  theme?: DocsTheme;
  /**
   * Custom MDX component overrides.
   *
   * Pass your own React components to replace defaults (e.g. Callout, CodeBlock).
   * Components must match the expected props interface.
   *
   * @example
   * ```ts
   * import { MyCallout } from "./components/my-callout";
   *
   * export default defineDocs({
   *   entry: "docs",
   *   theme: fumadocs(),
   *   components: {
   *     Callout: MyCallout,
   *   },
   * });
   * ```
   */
  components?: Record<string, unknown>;
  /**
   * Icon registry for sidebar items.
   *
   * Map string labels to React elements. Reference them in page frontmatter
   * with `icon: "label"` and the matching icon renders in the sidebar.
   *
   * @example
   * ```tsx
   * import { Book, Terminal, Rocket } from "lucide-react";
   *
   * export default defineDocs({
   *   entry: "docs",
   *   theme: fumadocs(),
   *   icons: {
   *     book: <Book />,
   *     terminal: <Terminal />,
   *     rocket: <Rocket />,
   *   },
   * });
   * ```
   *
   * Then in `page.mdx` frontmatter:
   * ```yaml
   * ---
   * title: "CLI Reference"
   * icon: "terminal"
   * ---
   * ```
   */
  icons?: Record<string, unknown>;
  /** SEO metadata - separate from theme */
  metadata?: DocsMetadata;
  /** Open Graph image handling */
  og?: OGConfig;
}

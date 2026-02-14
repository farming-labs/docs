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

export interface DocsNav {
  /**
   * Sidebar title — a plain string or a React element (e.g. a div with an icon).
   *
   * @example
   * ```tsx
   * // Simple string
   * nav: { title: "My Docs" }
   *
   * // React element with icon
   * nav: {
   *   title: <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
   *     <Rocket size={18} /> Example Docs
   *   </div>
   * }
   * ```
   */
  title?: unknown; // ReactNode — typed as unknown to stay framework-agnostic
  /** URL the title links to. Defaults to `/{entry}`. */
  url?: string;
}

export interface ThemeToggleConfig {
  /**
   * Whether to show the light/dark theme toggle in the sidebar.
   * @default true
   */
  enabled?: boolean;
  /**
   * The default / forced theme when the toggle is hidden.
   * Only applies when `enabled` is `false`.
   * @default "system"
   *
   * @example
   * ```ts
   * // Hide toggle, force dark mode
   * themeToggle: { enabled: false, default: "dark" }
   * ```
   */
  default?: "light" | "dark" | "system";
  /**
   * Toggle mode — show only light/dark, or include a system option.
   * @default "light-dark"
   */
  mode?: "light-dark" | "light-dark-system";
}

export interface DocsConfig {
  /** Entry folder for docs (e.g. "docs" → /docs) */
  entry: string;
  /** Theme configuration - single source of truth for UI */
  theme?: DocsTheme;
  /**
   * Sidebar navigation header.
   * Customise the title shown at the top of the sidebar.
   */
  nav?: DocsNav;
  /**
   * Theme toggle (light/dark mode switcher) in the sidebar.
   *
   * - `true` or `undefined` → toggle is shown (default)
   * - `false` → toggle is hidden, defaults to system theme
   * - `{ enabled: false, default: "dark" }` → toggle hidden, force dark
   *
   * @example
   * ```ts
   * // Hide toggle, force dark mode
   * themeToggle: { enabled: false, default: "dark" }
   *
   * // Show toggle with system option
   * themeToggle: { mode: "light-dark-system" }
   * ```
   */
  themeToggle?: boolean | ThemeToggleConfig;
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

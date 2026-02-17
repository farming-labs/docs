/**
 * Theme / UI configuration types for the docs framework.
 * Inspired by Fumadocs: https://github.com/fuma-nama/fumadocs
 */

/**
 * Fine-grained UI configuration for docs themes.
 *
 * Theme authors define defaults for these values in their `createTheme` call.
 * End users can override any value when calling the theme factory.
 *
 * @example
 * ```ts
 * const myTheme = createTheme({
 *   name: "my-theme",
 *   ui: {
 *     colors: { primary: "#6366f1", background: "#0a0a0a" },
 *     radius: "0px",
 *     codeBlock: { showLineNumbers: true, theme: "github-dark" },
 *     sidebar: { width: 280, style: "bordered" },
 *   },
 * });
 * ```
 */
/**
 * Font style configuration for a single text element (heading, body, etc.).
 *
 * @example
 * ```ts
 * h1: { size: "2.25rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" }
 * ```
 */
export interface FontStyle {
  /** CSS `font-size` value (e.g. "2.25rem", "36px", "clamp(1.8rem, 3vw, 2.5rem)") */
  size?: string;
  /** CSS `font-weight` value (e.g. 700, "bold", "600") */
  weight?: string | number;
  /** CSS `line-height` value (e.g. "1.2", "1.5", "28px") */
  lineHeight?: string;
  /** CSS `letter-spacing` value (e.g. "-0.02em", "0.05em") */
  letterSpacing?: string;
}

/**
 * Typography configuration for the docs.
 *
 * @example
 * ```ts
 * typography: {
 *   font: {
 *     style: { sans: "Inter, sans-serif", mono: "JetBrains Mono, monospace" },
 *     h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.02em" },
 *     h2: { size: "1.75rem", weight: 600 },
 *     body: { size: "1rem", lineHeight: "1.75" },
 *   },
 * }
 * ```
 */
export interface TypographyConfig {
  /**
   * Font configuration.
   */
  font?: {
    /**
     * Font family definitions.
     */
    style?: {
      /** Sans-serif font family — used for body text, headings, and UI elements. */
      sans?: string;
      /** Monospace font family — used for code blocks, inline code, and terminal output. */
      mono?: string;
    };
    /** Heading 1 (`<h1>`) style overrides */
    h1?: FontStyle;
    /** Heading 2 (`<h2>`) style overrides */
    h2?: FontStyle;
    /** Heading 3 (`<h3>`) style overrides */
    h3?: FontStyle;
    /** Heading 4 (`<h4>`) style overrides */
    h4?: FontStyle;
    /** Body text style */
    body?: FontStyle;
    /** Small text style (captions, meta text) */
    small?: FontStyle;
  };
}

export interface UIConfig {
  /**
   * Theme color tokens.
   *
   * These are mapped to `--color-fd-*` CSS variables at runtime.
   * Accepts any valid CSS color value (hex, rgb, oklch, hsl, etc.).
   *
   * @example
   * ```ts
   * colors: {
   *   primary: "oklch(0.72 0.19 149)",       // green primary
   *   primaryForeground: "#ffffff",           // white text on primary
   *   accent: "hsl(220 80% 60%)",            // blue accent
   * }
   * ```
   */
  colors?: {
    primary?: string;
    primaryForeground?: string;
    background?: string;
    foreground?: string;
    muted?: string;
    mutedForeground?: string;
    border?: string;
    card?: string;
    cardForeground?: string;
    accent?: string;
    accentForeground?: string;
    secondary?: string;
    secondaryForeground?: string;
    popover?: string;
    popoverForeground?: string;
    ring?: string;
  };
  /**
   * Typography settings — font families, heading sizes, weights, etc.
   *
   * @example
   * ```ts
   * typography: {
   *   font: {
   *     style: { sans: "Inter, sans-serif", mono: "JetBrains Mono, monospace" },
   *     h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.02em" },
   *     body: { size: "1rem", lineHeight: "1.75" },
   *   },
   * }
   * ```
   */
  typography?: TypographyConfig;
  /**
   * Global border-radius. Maps to CSS `--radius`.
   * Use "0px" for sharp corners, "0.5rem" for rounded, etc.
   */
  radius?: string;
  /** Layout dimensions */
  layout?: {
    contentWidth?: number;
    sidebarWidth?: number;
    tocWidth?: number;
    toc?: {
      enabled?: boolean;
      depth?: number;
    };
    header?: {
      height?: number;
      sticky?: boolean;
    };
  };
  /** Code block rendering config */
  codeBlock?: {
    /** Show line numbers in code blocks @default false */
    showLineNumbers?: boolean;
    /** Show copy button @default true */
    showCopyButton?: boolean;
    /** Shiki theme name for syntax highlighting */
    theme?: string;
    /** Dark mode shiki theme (for dual-theme setups) */
    darkTheme?: string;
  };
  /** Sidebar styling hints (consumed by theme CSS) */
  sidebar?: {
    /**
     * Visual style of the sidebar.
     * - "default" — standard fumadocs sidebar
     * - "bordered" — visible bordered sections (like better-auth)
     * - "floating" — floating card sidebar
     */
    style?: "default" | "bordered" | "floating";
    /** Background color override */
    background?: string;
    /** Border color override */
    borderColor?: string;
  };
  /** Card styling */
  card?: {
    /** Whether cards have visible borders @default true */
    bordered?: boolean;
    /** Card background color override */
    background?: string;
  };
  /** Default props/variants for MDX components (Callout, CodeBlock, Tabs, etc.) */
  components?: {
    [key: string]: Record<string, unknown> | ((defaults: unknown) => unknown);
  };
}

/**
 * A docs theme configuration.
 *
 * Theme authors create these with `createTheme()`. The `name` identifies the
 * theme (useful for CSS scoping, debugging, analytics). The `ui` object holds
 * all visual configuration.
 *
 * @example
 * ```ts
 * import { createTheme } from "@farming-labs/docs";
 *
 * export const myTheme = createTheme({
 *   name: "my-theme",
 *   ui: {
 *     colors: { primary: "#ff4d8d" },
 *     radius: "0px",
 *   },
 * });
 * ```
 */
export interface DocsTheme {
  /** Unique name for this theme (used for CSS scoping and debugging) */
  name?: string;
  /** UI configuration — colors, typography, layout, components */
  ui?: UIConfig;
  /**
   * @internal
   * User-provided color overrides tracked by `createTheme`.
   * Only these colors are emitted as inline CSS variables at runtime.
   * Preset defaults stay in the theme's CSS file.
   */
  _userColorOverrides?: Record<string, string>;
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

export interface BreadcrumbConfig {
  /**
   * Whether to show the breadcrumb navigation above page content.
   * @default true
   */
  enabled?: boolean;
  /**
   * Custom breadcrumb component. Receives the default breadcrumb as children
   * so you can wrap/modify it.
   *
   * @example
   * ```tsx
   * breadcrumb: {
   *   component: ({ items }) => <MyBreadcrumb items={items} />,
   * }
   * ```
   */
  component?: unknown; // ReactNode or Component — typed as unknown to stay framework-agnostic
}

export interface SidebarConfig {
  /**
   * Whether to show the sidebar.
   * @default true
   */
  enabled?: boolean;
  /**
   * Custom sidebar component to completely replace the default sidebar.
   * Receives the page tree and config as context.
   *
   * @example
   * ```tsx
   * sidebar: {
   *   component: MySidebar,
   * }
   * ```
   */
  component?: unknown; // ReactNode — typed as unknown to stay framework-agnostic
  /**
   * Sidebar footer content (rendered below navigation items).
   */
  footer?: unknown; // ReactNode
  /**
   * Sidebar banner content (rendered above navigation items).
   */
  banner?: unknown; // ReactNode
  /**
   * Whether the sidebar is collapsible on desktop.
   * @default true
   */
  collapsible?: boolean;
}

/**
 * A single "Open in …" provider shown in the Open dropdown.
 *
 * @example
 * ```ts
 * { name: "Claude", icon: <ClaudeIcon />, urlTemplate: "https://claude.ai?url={url}" }
 * ```
 */
export interface OpenDocsProvider {
  /** Display name (e.g. "ChatGPT", "Claude", "Cursor") */
  name: string;
  /** Icon element rendered next to the name */
  icon?: unknown; // ReactNode
  /**
   * URL template. `{url}` is replaced with the current page URL.
   * `{mdxUrl}` is replaced with the `.mdx` variant of the page URL.
   *
   * @example "https://claude.ai/new?q=Read+this+doc:+{url}"
   */
  urlTemplate: string;
}

/**
 * Configuration for the "Open in …" dropdown that lets users
 * send the current page to an LLM or external tool.
 *
 * @example
 * ```ts
 * openDocs: {
 *   enabled: true,
 *   providers: [
 *     { name: "ChatGPT", icon: <ChatGPTIcon />, urlTemplate: "https://chatgpt.com/?q={url}" },
 *     { name: "Claude", icon: <ClaudeIcon />, urlTemplate: "https://claude.ai/new?q={url}" },
 *   ],
 * }
 * ```
 */
export interface OpenDocsConfig {
  /** Whether to show the "Open" dropdown. @default false */
  enabled?: boolean;
  /**
   * List of LLM / tool providers to show in the dropdown.
   * If not provided, a sensible default list is used.
   */
  providers?: OpenDocsProvider[];
}

/**
 * Configuration for the "Copy Markdown" button that copies
 * the current page's content as Markdown to the clipboard.
 */
export interface CopyMarkdownConfig {
  /** Whether to show the "Copy Markdown" button. @default false */
  enabled?: boolean;
}

/**
 * Page-level action buttons shown above the page content
 * (e.g. "Copy Markdown", "Open in …" dropdown).
 *
 * @example
 * ```ts
 * pageActions: {
 *   copyMarkdown: { enabled: true },
 *   openDocs: {
 *     enabled: true,
 *     providers: [
 *       { name: "Claude", urlTemplate: "https://claude.ai/new?q={url}" },
 *     ],
 *   },
 * }
 * ```
 */
export interface PageActionsConfig {
  /** "Copy Markdown" button */
  copyMarkdown?: boolean | CopyMarkdownConfig;
  /** "Open in …" dropdown with LLM / tool providers */
  openDocs?: boolean | OpenDocsConfig;
  /**
   * Where to render the page action buttons relative to the page title.
   *
   * - `"below-title"` — render below the first `<h1>` heading (default)
   * - `"above-title"` — render above the page title / content
   *
   * @default "below-title"
   */
  position?: "above-title" | "below-title";
}

/**
 * GitHub repository configuration for "Edit on GitHub" links
 * and source file references.
 *
 * @example
 * ```ts
 * // Simple repo (not a monorepo)
 * github: {
 *   url: "https://github.com/Kinfe123/my-docs",
 * }
 *
 * // Monorepo — docs site lives in "website/" subdirectory
 * github: {
 *   url: "https://github.com/farming-labs/docs",
 *   directory: "website",
 *   branch: "main",
 * }
 * ```
 *
 * Or as a simple string (branch defaults to "main", no directory prefix):
 * ```ts
 * github: "https://github.com/Kinfe123/my-docs"
 * ```
 */
export interface GithubConfig {
  /** Repository URL (e.g. "https://github.com/farming-labs/docs") */
  url: string;
  /** Branch name. @default "main" */
  branch?: string;
  /**
   * Subdirectory inside the repo where the docs site lives.
   * Use this for monorepos where the docs app is not at the repo root.
   *
   * @example "website" → links point to `website/app/docs/…/page.mdx`
   */
  directory?: string;
}

/**
 * Configuration for "Ask AI" — a RAG-powered chat that lets users
 * ask questions about the documentation content.
 *
 * The AI handler searches relevant doc pages, builds context, and
 * streams a response from an LLM (OpenAI-compatible API).
 *
 * The API key is **never** stored in the config. It is read from the
 * `OPENAI_API_KEY` environment variable at runtime on the server.
 *
 * @example
 * ```ts
 * ai: {
 *   enabled: true,
 *   model: "gpt-4o-mini",
 *   systemPrompt: "You are a helpful assistant for our developer docs.",
 * }
 * ```
 */
export interface AIConfig {
  /**
   * Whether to enable "Ask AI" functionality.
   * When enabled, the unified `/api/docs` route handler will accept
   * POST requests for AI chat.
   * @default false
   */
  enabled?: boolean;

  /**
   * How the AI chat UI is presented.
   *
   * - `"search"` — AI tab integrated into the Cmd+K search dialog (default)
   * - `"floating"` — A floating chat widget (bubble button + slide-out panel)
   *
   * @default "search"
   *
   * @example
   * ```ts
   * // Floating chat bubble in the bottom-right corner
   * ai: {
   *   enabled: true,
   *   mode: "floating",
   *   position: "bottom-right",
   * }
   * ```
   */
  mode?: "search" | "floating";

  /**
   * Position of the floating chat button on screen.
   * Only used when `mode` is `"floating"`.
   *
   * - `"bottom-right"` — bottom-right corner (default)
   * - `"bottom-left"` — bottom-left corner
   * - `"bottom-center"` — bottom center
   *
   * @default "bottom-right"
   */
  position?: "bottom-right" | "bottom-left" | "bottom-center";

  /**
   * Visual style of the floating chat when opened.
   * Only used when `mode` is `"floating"`.
   *
   * - `"panel"` — A tall panel that slides up from the button position (default).
   *   Stays anchored near the floating button. No backdrop overlay.
   *
   * - `"modal"` — A centered modal dialog with a backdrop overlay,
   *   similar to the Cmd+K search dialog. Feels more focused and immersive.
   *
   * - `"popover"` — A compact popover near the button. Smaller than the
   *   panel, suitable for quick questions without taking much screen space.
   *
   * @default "panel"
   *
   * @example
   * ```ts
   * ai: {
   *   enabled: true,
   *   mode: "floating",
   *   position: "bottom-right",
   *   floatingStyle: "modal",
   * }
   * ```
   */
  floatingStyle?: "panel" | "modal" | "popover";

  /**
   * Custom trigger component for the floating chat button.
   * Only used when `mode` is `"floating"`.
   *
   * Pass a React element to replace the default sparkles button.
   * The element receives an `onClick` handler automatically.
   *
   * @example
   * ```tsx
   * ai: {
   *   enabled: true,
   *   mode: "floating",
   *   triggerComponent: <button className="my-chat-btn">💬 Help</button>,
   * }
   * ```
   */
  triggerComponent?: React.ReactNode;

  /**
   * The LLM model to use for chat completions.
   * Must be compatible with the OpenAI Chat Completions API.
   * @default "gpt-4o-mini"
   */
  model?: string;

  /**
   * Custom system prompt prepended to the AI conversation.
   * The documentation context is automatically appended after this prompt.
   *
   * @default "You are a helpful documentation assistant. Answer questions
   * based on the provided documentation context. Be concise and accurate.
   * If the answer is not in the context, say so honestly."
   */
  systemPrompt?: string;

  /**
   * Base URL for an OpenAI-compatible API endpoint.
   * Use this to point to a self-hosted model, Azure OpenAI, or any
   * compatible provider (e.g. Groq, Together, OpenRouter).
   * @default "https://api.openai.com/v1"
   */
  baseUrl?: string;

  /**
   * Environment variable name for the API key.
   * The handler reads `process.env[apiKeyEnv]` at runtime.
   * @default "OPENAI_API_KEY"
   */
  apiKeyEnv?: string;

  /**
   * Maximum number of search results to include as context for the AI.
   * More results = more context but higher token usage.
   * @default 5
   */
  maxResults?: number;
}

export interface DocsConfig {
  /** Entry folder for docs (e.g. "docs" → /docs) */
  entry: string;
  /** Theme configuration - single source of truth for UI */
  theme?: DocsTheme;
  /**
   * GitHub repository URL or config. Enables "Edit on GitHub" links
   * on each docs page footer, pointing to the source `.mdx` file.
   *
   * @example
   * ```ts
   * // Simple — branch defaults to "main"
   * github: "https://github.com/Kinfe123/my-docs"
   *
   * // Monorepo — docs site lives in "website/" subdirectory
   * github: {
   *   url: "https://github.com/farming-labs/docs",
   *   directory: "website",
   * }
   *
   * // Custom branch
   * github: {
   *   url: "https://github.com/Kinfe123/my-docs",
   *   branch: "develop",
   * }
   * ```
   */
  github?: string | GithubConfig;
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
   * Breadcrumb navigation above page content.
   *
   * - `true` or `undefined` → breadcrumb is shown (default)
   * - `false` → breadcrumb is hidden
   * - `{ enabled: false }` → breadcrumb is hidden
   * - `{ component: MyBreadcrumb }` → custom breadcrumb component
   */
  breadcrumb?: boolean | BreadcrumbConfig;
  /**
   * Sidebar customisation.
   *
   * - `true` or `undefined` → default sidebar
   * - `false` → sidebar is hidden
   * - `{ component: MySidebar }` → custom sidebar component
   * - `{ footer: <MyFooter />, banner: <MyBanner /> }` → add footer/banner
   */
  sidebar?: boolean | SidebarConfig;
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
  /**
   * Page action buttons shown above the content area.
   * Includes "Copy Markdown" and "Open in …" (LLM dropdown).
   *
   * @example
   * ```ts
   * pageActions: {
   *   copyMarkdown: { enabled: true },
   *   openDocs: {
   *     enabled: true,
   *     providers: [
   *       { name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={url}" },
   *       { name: "Claude", urlTemplate: "https://claude.ai/new?q={url}" },
   *     ],
   *   },
   * }
   * ```
   */
  pageActions?: PageActionsConfig;
  /**
   * AI-powered "Ask AI" chat for documentation.
   *
   * When enabled, the unified API route handler (`/api/docs`) accepts
   * POST requests for AI chat. The handler uses RAG (Retrieval-Augmented
   * Generation) — it searches relevant docs, builds context, and streams
   * a response from an LLM.
   *
   * The API key is read from `process.env.OPENAI_API_KEY` (or a custom
   * env var via `apiKeyEnv`). **Never** put the key in the config file.
   *
   * @example
   * ```ts
   * // Enable with defaults (gpt-4o-mini, OPENAI_API_KEY env var)
   * ai: { enabled: true }
   *
   * // Custom model + system prompt
   * ai: {
   *   enabled: true,
   *   model: "gpt-4o",
   *   systemPrompt: "You are an expert on our SDK. Be concise.",
   * }
   *
   * // Use a different provider (e.g. Groq)
   * ai: {
   *   enabled: true,
   *   baseUrl: "https://api.groq.com/openai/v1",
   *   apiKeyEnv: "GROQ_API_KEY",
   *   model: "llama-3.1-70b-versatile",
   * }
   * ```
   */
  ai?: AIConfig;
  /** SEO metadata - separate from theme */
  metadata?: DocsMetadata;
  /** Open Graph image handling */
  og?: OGConfig;
}

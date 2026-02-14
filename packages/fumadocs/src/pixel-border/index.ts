/**
 * @farming-labs/fumadocs/pixel-border
 *
 * Inspired by better-auth.com — clean dark UI with visible rounded borders,
 * pixel-perfect spacing, and a refined sidebar.
 */
import { deepMerge } from "@farming-labs/docs";
import type { DocsTheme } from "@farming-labs/docs";

/* Default UI tweaks for the pixel-border theme */
const PixelBorderUIDefaults = {
  colors: {
    primary: "oklch(0.985 0.001 106.423)",
    background: "hsl(0 0% 2%)",
    muted: "hsl(0 0% 55%)",
    border: "hsl(0 0% 15%)",
  },
  typography: {
    fontFamily: "var(--font-geist-sans, system-ui, -apple-system, sans-serif)",
    monoFontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
  },
  layout: {
    contentWidth: 860,
    sidebarWidth: 286,
    toc: { enabled: true, depth: 3 },
    header: { height: 56, sticky: true },
  },
  components: {},
};

const basePixelBorderTheme: DocsTheme = {
  name: "fumadocs-pixel-border",
  ui: PixelBorderUIDefaults,
};

/**
 * Create a pixel-border theme preset, optionally merging overrides.
 *
 * ```ts
 * import { pixelBorder } from "@farming-labs/fumadocs/pixel-border";
 *
 * export default defineDocs({
 *   entry: "docs",
 *   theme: pixelBorder(),
 * });
 * ```
 */
export function pixelBorder(overrides: Partial<DocsTheme> = {}): DocsTheme {
  return deepMerge(
    basePixelBorderTheme as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as DocsTheme;
}

export { PixelBorderUIDefaults };

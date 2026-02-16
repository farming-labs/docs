/**
 * @farming-labs/fumadocs/pixel-border
 *
 * Inspired by better-auth.com — clean dark UI with visible rounded borders,
 * pixel-perfect spacing, and a refined sidebar.
 */
import { createTheme } from "@farming-labs/docs";
import type { DocsTheme } from "@farming-labs/docs";

/**
 * Pixel-border UI defaults — better-auth inspired, clean dark UI.
 *
 * Theme authors can import and extend:
 * ```ts
 * import { PixelBorderUIDefaults } from "@farming-labs/fumadocs/pixel-border";
 * ```
 */
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

/**
 * Pixel-border theme preset factory.
 *
 * Built with `createTheme` — the same helper theme authors use.
 * Inspired by better-auth.com — clean dark UI with visible borders.
 *
 * @example
 * ```ts
 * import { pixelBorder } from "@farming-labs/fumadocs/pixel-border";
 * export default defineDocs({ theme: pixelBorder() });
 * ```
 */
export const pixelBorder = createTheme({
  name: "fumadocs-pixel-border",
  ui: PixelBorderUIDefaults,
});

export { PixelBorderUIDefaults };

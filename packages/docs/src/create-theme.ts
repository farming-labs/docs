/**
 * createTheme — the primary API for building custom docs themes.
 *
 * Theme authors use this to define a theme preset factory that users can
 * call in their `docs.config.ts` with optional overrides.
 *
 * @example
 * ```ts
 * // my-theme/index.ts
 * import { createTheme } from "@farming-labs/docs";
 *
 * const defaults = {
 *   name: "my-dark-theme",
 *   ui: {
 *     colors: { primary: "#ff4d8d", background: "#0a0a0a", muted: "#888", border: "#222" },
 *     typography: { fontFamily: "Inter, sans-serif", monoFontFamily: "Fira Code, monospace" },
 *     layout: { contentWidth: 860, sidebarWidth: 280, toc: { enabled: true, depth: 3 } },
 *     components: { Callout: { variant: "outline" } },
 *   },
 * };
 *
 * // Export a factory function that merges user overrides with defaults
 * export const myTheme = createTheme(defaults);
 *
 * // Users call it like:
 * //   import { myTheme } from "my-theme";
 * //   export default defineDocs({ theme: myTheme({ ui: { colors: { primary: "#00ff88" } } }) });
 * ```
 */

import type { DocsTheme } from "./types.js";
import { deepMerge } from "./utils.js";

/**
 * Create a theme preset factory.
 *
 * Returns a function that accepts optional overrides and deep-merges them
 * with the base theme defaults. This is the same pattern used by the
 * built-in `fumadocs()`, `darksharp()`, and `pixelBorder()` presets.
 *
 * @param baseTheme - The default theme configuration
 * @returns A factory function `(overrides?) => DocsTheme`
 *
 * @example
 * ```ts
 * import { createTheme } from "@farming-labs/docs";
 *
 * export const myTheme = createTheme({
 *   name: "my-theme",
 *   ui: {
 *     colors: { primary: "#6366f1" },
 *     layout: { contentWidth: 800 },
 *   },
 * });
 * ```
 */
export function createTheme(
  baseTheme: DocsTheme,
): (overrides?: Partial<DocsTheme>) => DocsTheme {
  return function themeFactory(overrides: Partial<DocsTheme> = {}): DocsTheme {
    const merged = deepMerge(
      baseTheme as Record<string, unknown>,
      overrides as Record<string, unknown>,
    ) as DocsTheme;

    // Track only user-provided color overrides so the runtime only emits
    // those as inline CSS variables. Preset defaults stay in the CSS file.
    if (overrides.ui?.colors) {
      merged._userColorOverrides = { ...overrides.ui.colors } as Record<string, string>;
    }

    return merged;
  };
}

/**
 * Extend an existing theme preset with additional defaults.
 *
 * Useful when you want to build on top of an existing theme (e.g. fumadocs)
 * rather than starting from scratch.
 *
 * @example
 * ```ts
 * import { extendTheme } from "@farming-labs/docs";
 * import { fumadocs } from "@farming-labs/fumadocs/default";
 *
 * // Start with fumadocs defaults, override some values
 * export const myTheme = extendTheme(fumadocs(), {
 *   name: "my-custom-fumadocs",
 *   ui: { colors: { primary: "#22c55e" } },
 * });
 * ```
 */
export function extendTheme(
  baseTheme: DocsTheme,
  extensions: Partial<DocsTheme>,
): DocsTheme {
  return deepMerge(
    baseTheme as Record<string, unknown>,
    extensions as Record<string, unknown>,
  ) as DocsTheme;
}

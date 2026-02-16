/**
 * @farming-labs/fumadocs — generic base exports.
 *
 * Theme presets live under sub-paths:
 *   - `@farming-labs/fumadocs/default`      → default neutral theme
 *   - `@farming-labs/fumadocs/darksharp`    → sharp all-black theme
 *   - `@farming-labs/fumadocs/pixel-border` → better-auth inspired rounded borders
 *
 * This root export provides layout helpers, the RootProvider, and re-exports
 * the base `fumadocs()` preset from `/default` for backward compatibility.
 *
 * ## Building Custom Themes
 *
 * Theme authors should use these exports to build advanced themes:
 *
 * ### Quick start (theme preset factory):
 * ```ts
 * import { createTheme } from "@farming-labs/docs";
 *
 * export const myTheme = createTheme({
 *   name: "my-theme",
 *   ui: { colors: { primary: "#ff4d8d" }, layout: { contentWidth: 900 } },
 * });
 * ```
 *
 * ### Advanced (custom layout with primitives):
 * ```tsx
 * import {
 *   DocsLayout,       // fumadocs-ui layout shell (sidebar + content area)
 *   DocsPage,         // page wrapper (article + TOC + breadcrumb + footer)
 *   DocsBody,         // prose wrapper for MDX content
 *   RootProvider,     // next-themes + fumadocs provider
 *   DocsPageClient,   // client-side TOC heading scanner
 *   createDocsLayout, // auto-generates a layout component from DocsConfig
 *   createDocsMetadata, // auto-generates Next.js metadata from DocsConfig
 * } from "@farming-labs/fumadocs";
 * ```
 *
 * ### CSS:
 * Themes provide a CSS file that imports a preset and adds overrides.
 * Three presets are available — no need to import fumadocs-ui CSS directly:
 *
 * | Preset | Import path | Description |
 * |--------|-------------|-------------|
 * | Neutral | `@farming-labs/fumadocs/presets/neutral` | Light neutral palette |
 * | Black   | `@farming-labs/fumadocs/presets/black`   | Dark black palette |
 * | Base    | `@farming-labs/fumadocs/presets/base`    | No palette, define all vars yourself |
 *
 * ```css
 * @import "@farming-labs/fumadocs/presets/black";
 *
 * :root {
 *   --radius: 0px;
 *   --background: hsl(0 0% 2%);
 * }
 * ```
 */

// ─── Layout + metadata helpers ────────────────────────────────────────
export { createDocsLayout, createDocsMetadata } from "./docs-layout.js";

// ─── Root UI provider ─────────────────────────────────────────────────
export { RootProvider } from "fumadocs-ui/provider/next";

// ─── Default theme preset (backward compat) ───────────────────────────
export { fumadocs, DefaultUIDefaults as FumadocsUIDefaults } from "./default/index.js";

// ─── UI primitives for custom theme layouts ───────────────────────────
// These are the building blocks theme authors use to compose custom layouts
export { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
export { DocsLayout } from "fumadocs-ui/layouts/docs";

// ─── Client-side TOC component ────────────────────────────────────────
// Scans DOM headings and feeds them to DocsPage's TOC panel
export { DocsPageClient } from "./docs-page-client.js";

// ─── Core types (re-exported for convenience) ─────────────────────────
export type {
  DocsConfig,
  DocsTheme,
  UIConfig,
  DocsNav,
  DocsMetadata,
  OGConfig,
  PageFrontmatter,
  ThemeToggleConfig,
  BreadcrumbConfig,
  SidebarConfig,
} from "@farming-labs/docs";

// ─── Core helpers (re-exported for convenience) ───────────────────────
export { createTheme, extendTheme, deepMerge, defineDocs } from "@farming-labs/docs";

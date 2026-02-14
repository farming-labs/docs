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
 */

// Layout + metadata helpers
export { createDocsLayout, createDocsMetadata } from "./docs-layout.js";

// Root UI provider
export { RootProvider } from "fumadocs-ui/provider/next";

// Re-export the default theme preset so existing `import { fumadocs } from "@farming-labs/fumadocs"` still works
export { fumadocs, DefaultUIDefaults as FumadocsUIDefaults } from "./default/index.js";

// Re-export DocsPage UI primitives so users can extend/override
export { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
export { DocsLayout } from "fumadocs-ui/layouts/docs";

// Types
export type { DocsTheme, UIConfig, BreadcrumbConfig, SidebarConfig } from "@farming-labs/docs";

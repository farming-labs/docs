/**
 * @farming-labs/svelte-theme
 *
 * Svelte UI components and theme presets for documentation sites.
 * Port of @farming-labs/theme for SvelteKit.
 */

export { default as DocsLayout } from "./components/DocsLayout.svelte";
export { default as DocsContent } from "./components/DocsContent.svelte";
export { default as DocsSidebar } from "./components/DocsSidebar.svelte";
export { default as DocsPage } from "./components/DocsPage.svelte";
export { default as TableOfContents } from "./components/TableOfContents.svelte";
export { default as Breadcrumb } from "./components/Breadcrumb.svelte";
export { default as ThemeToggle } from "./components/ThemeToggle.svelte";
export { default as SearchDialog } from "./components/SearchDialog.svelte";
export { default as AskAIDialog } from "./components/AskAIDialog.svelte";
export { default as FloatingAIChat } from "./components/FloatingAIChat.svelte";
export { default as MobileNav } from "./components/MobileNav.svelte";
export { default as Callout } from "./components/Callout.svelte";

export { fumadocs, DefaultUIDefaults } from "./themes/default.js";
export { pixelBorder, PixelBorderUIDefaults } from "./themes/pixel-border.js";
export { darksharp, DarksharpUIDefaults } from "./themes/darksharp.js";

/**
 * @farming-labs/nuxt-theme
 *
 * Nuxt/Vue UI components and theme presets for documentation sites.
 */

export { default as DocsLayout } from "./components/DocsLayout.vue";
export { default as DocsContent } from "./components/DocsContent.vue";
export { default as DocsPage } from "./components/DocsPage.vue";
export { default as TableOfContents } from "./components/TableOfContents.vue";
export { default as Breadcrumb } from "./components/Breadcrumb.vue";
export { default as SearchDialog } from "./components/SearchDialog.vue";
export { default as FloatingAIChat } from "./components/FloatingAIChat.vue";
export { default as ThemeToggle } from "./components/ThemeToggle.vue";

export { fumadocs, DefaultUIDefaults } from "./themes/default.js";
export { pixelBorder, PixelBorderUIDefaults } from "./themes/pixel-border.js";
export { darksharp, DarksharpUIDefaults } from "./themes/darksharp.js";

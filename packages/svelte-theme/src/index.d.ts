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

import type { DocsTheme } from "@farming-labs/docs";

export declare const fumadocs: (overrides?: Partial<DocsTheme>) => DocsTheme;
export declare const DefaultUIDefaults: Record<string, any>;

export declare const pixelBorder: (overrides?: Partial<DocsTheme>) => DocsTheme;
export declare const PixelBorderUIDefaults: Record<string, any>;

export declare const darksharp: (overrides?: Partial<DocsTheme>) => DocsTheme;
export declare const DarksharpUIDefaults: Record<string, any>;

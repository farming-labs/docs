import type { Component } from "vue";
import type { DocsTheme } from "@farming-labs/docs";

export const DocsLayout: Component;
export const DocsContent: Component;
export const DocsPage: Component;
export const TableOfContents: Component;
export const Breadcrumb: Component;
export const SearchDialog: Component;
export const FloatingAIChat: Component;

export declare const fumadocs: (overrides?: Partial<DocsTheme>) => DocsTheme;
export declare const DefaultUIDefaults: Record<string, any>;
export declare const pixelBorder: (overrides?: Partial<DocsTheme>) => DocsTheme;
export declare const PixelBorderUIDefaults: Record<string, any>;
export declare const darksharp: (overrides?: Partial<DocsTheme>) => DocsTheme;
export declare const DarksharpUIDefaults: Record<string, any>;

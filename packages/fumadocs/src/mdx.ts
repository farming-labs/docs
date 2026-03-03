/**
 * Re-export fumadocs-ui MDX components.
 *
 * Includes all default MDX components (headings, code blocks, callouts, cards)
 * plus Tabs/Tab for tabbed content and InstallTabs for package manager tabs.
 * Overrides `img` so that ![alt](url) in markdown works without width/height
 * (uses Next Image with unoptimized + default dimensions for external URLs).
 *
 * Usage in mdx-components.tsx:
 *   import { getMDXComponents } from "@farming-labs/theme/mdx";
 */

import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { MDXImg } from "./mdx-img.js";

const extendedMdxComponents = {
  ...defaultMdxComponents,
  img: MDXImg,
  Tab,
  Tabs,
};

export function getMDXComponents<T extends Record<string, unknown> = Record<string, unknown>>(
  overrides?: T,
): typeof extendedMdxComponents & T {
  return {
    ...extendedMdxComponents,
    ...overrides,
  } as typeof extendedMdxComponents & T;
}

export { defaultMdxComponents, extendedMdxComponents, Tab, Tabs };

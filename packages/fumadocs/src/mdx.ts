/**
 * Re-export fumadocs-ui MDX components.
 *
 * Includes all default MDX components (headings, code blocks, callouts, cards)
 * plus Tabs/Tab for tabbed content and InstallTabs for package manager tabs.
 *
 * Usage in mdx-components.tsx:
 *   import { getMDXComponents } from "@farming-labs/theme/mdx";
 */

import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

const extendedMdxComponents = {
  ...defaultMdxComponents,
  Tab,
  Tabs,
};

export function getMDXComponents<
  T extends Record<string, unknown> = Record<string, unknown>,
>(overrides?: T): typeof extendedMdxComponents & T {
  return {
    ...extendedMdxComponents,
    ...overrides,
  } as typeof extendedMdxComponents & T;
}

export { defaultMdxComponents, extendedMdxComponents, Tab, Tabs };

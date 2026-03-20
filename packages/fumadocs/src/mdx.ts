/**
 * Re-export fumadocs-ui MDX components.
 *
 * Includes all default MDX components (headings, code blocks, callouts, cards)
 * plus Tabs/Tab for tabbed content and InstallTabs for package manager tabs.
 * Overrides `img` so that ![alt](url) in markdown works without width/height
 * (uses Next Image with unoptimized + default dimensions for external URLs).
 *
 * When `options.onCopyClick` is provided, the default `pre` component is wrapped
 * so that the callback is fired when the user clicks the code block copy button.
 *
 * Usage in mdx-components.tsx:
 *   import { getMDXComponents } from "@farming-labs/theme/mdx";
 *   return getMDXComponents(
 *     { ...docsConfig.components, ...components },
 *     { onCopyClick: docsConfig.onCopyClick }
 *   );
 */

import type React from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { MDXImg } from "./mdx-img.js";
import { createPreWithCopyCallback } from "./code-block-copy-wrapper.js";
import { HoverLink } from "./hover-link.js";
import type { CodeBlockCopyData } from "@farming-labs/docs";

const extendedMdxComponents = {
  ...defaultMdxComponents,
  img: MDXImg,
  HoverLink,
  Tab,
  Tabs,
};

export interface GetMDXComponentsOptions {
  /** Called when the user clicks the copy button on a code block (in addition to the default copy). */
  onCopyClick?: (data: CodeBlockCopyData) => void;
}

export function getMDXComponents<T extends Record<string, unknown> = Record<string, unknown>>(
  overrides?: T,
  options?: GetMDXComponentsOptions,
): typeof extendedMdxComponents & T {
  const base = { ...extendedMdxComponents, ...overrides } as typeof extendedMdxComponents & T;
  if (options?.onCopyClick) {
    const DefaultPre = (defaultMdxComponents as Record<string, unknown>).pre as
      | React.ComponentType<React.ComponentPropsWithoutRef<"pre">>
      | "pre"
      | undefined;
    if (DefaultPre) {
      (base as Record<string, unknown>).pre = createPreWithCopyCallback(
        DefaultPre,
        options.onCopyClick,
      );
    }
  }
  return base;
}

export { defaultMdxComponents, extendedMdxComponents, HoverLink, Tab, Tabs };

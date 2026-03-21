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
 *     { onCopyClick: docsConfig.onCopyClick, theme: docsConfig.theme }
 *   );
 */

import React from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { MDXImg } from "./mdx-img.js";
import { createPreWithCopyCallback } from "./code-block-copy-wrapper.js";
import { HoverLink, type HoverLinkProps } from "./hover-link.js";
import type { CodeBlockCopyData, DocsTheme } from "@farming-labs/docs";

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
  /** Theme config used to apply built-in MDX component defaults from `theme.ui.components`. */
  theme?: DocsTheme;
}

const mdxComponentDefaults = {
  HoverLink: {
    linkLabel: "Open page",
    showIndicator: false,
    align: "center",
    side: "bottom",
    sideOffset: 12,
    closeDelay: 90,
  } satisfies Partial<HoverLinkProps>,
} as const;

function applyBuiltInComponentDefaults<T extends Record<string, unknown>>(
  options?: GetMDXComponentsOptions,
) {
  const themeComponents = options?.theme?.ui?.components;
  if (!themeComponents) return extendedMdxComponents as typeof extendedMdxComponents & T;

  const entries = Object.entries(themeComponents);
  if (entries.length === 0) return extendedMdxComponents as typeof extendedMdxComponents & T;

  const components = { ...extendedMdxComponents } as Record<string, unknown>;

  for (const [name, value] of entries) {
    const Component = components[name];
    if (!Component) continue;

    const builtInDefaults = (mdxComponentDefaults as Record<string, unknown>)[name] ?? {};
    const componentDefaults =
      typeof value === "function"
        ? value(builtInDefaults)
        : { ...(builtInDefaults as Record<string, unknown>), ...value };

    if (!componentDefaults || typeof componentDefaults !== "object") continue;

    components[name] = function ThemedComponent(props: Record<string, unknown>) {
      return React.createElement(Component as React.ElementType, {
        ...(componentDefaults as Record<string, unknown>),
        ...props,
      });
    };
  }

  return components as typeof extendedMdxComponents & T;
}

export function getMDXComponents<T extends Record<string, unknown> = Record<string, unknown>>(
  overrides?: T,
  options?: GetMDXComponentsOptions,
): typeof extendedMdxComponents & T {
  const builtIns = applyBuiltInComponentDefaults<T>(options);
  const base = { ...builtIns, ...overrides } as typeof extendedMdxComponents & T;
  if (options?.onCopyClick) {
    const DefaultPre = (base as Record<string, unknown>).pre as
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

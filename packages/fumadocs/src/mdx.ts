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
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "fumadocs-ui/components/codeblock";
import { MDXImg } from "./mdx-img.js";
import { createPreWithCodeSpacing } from "./code-block-spacing.js";
import { createPreWithCopyCallback } from "./code-block-copy-wrapper.js";
import { HoverLink, type HoverLinkProps } from "./hover-link.js";
import {
  Prompt,
  type PromptIconValue,
  type PromptOpenDocsProvider,
  type PromptProps,
} from "./prompt.js";
import { extractPromptText } from "./prompt-text.js";
import {
  type CodeBlockCopyData,
  type DocsContentAudience,
  type DocsTheme,
  resolveDocsAudienceExposure,
} from "@farming-labs/docs";

function Table(props: React.ComponentPropsWithoutRef<"table">) {
  return React.createElement(
    "div",
    {
      className: "fd-table-wrapper relative overflow-auto prose-no-margin my-6",
    },
    React.createElement("table", props),
  );
}

export interface AgentProps {
  children?: React.ReactNode;
}

export interface HumanProps {
  children?: React.ReactNode;
}

export interface AudienceProps {
  only: DocsContentAudience;
  children?: React.ReactNode;
}

function renderAudience(only: unknown, audience: DocsContentAudience, children: React.ReactNode) {
  if (!resolveDocsAudienceExposure(only, audience)) return null;
  return React.createElement(React.Fragment, null, children);
}

function Agent({ children }: AgentProps) {
  return renderAudience("agent", "human", children);
}

function Human({ children }: HumanProps) {
  return renderAudience("human", "human", children);
}

function Audience({ only, children }: AudienceProps) {
  return renderAudience(only, "human", children);
}

type ReactElementProps = Record<string, unknown> & {
  children?: React.ReactNode;
};

export interface CodeGroupProps extends Omit<
  React.ComponentPropsWithoutRef<typeof CodeBlockTabs>,
  "children"
> {
  children?: React.ReactNode;
  /**
   * Mintlify-compatible prop. The current renderer keeps the same code tab UI
   * and exposes this as a data attribute for theme overrides.
   */
  dropdown?: boolean;
}

const codeGroupLabelProps = [
  "title",
  "filename",
  "file",
  "name",
  "label",
  "value",
  "data-title",
  "data-filename",
  "data-file",
] as const;

function cx(...values: Array<string | false | null | undefined>) {
  const className = values.filter(Boolean).join(" ");
  return className || undefined;
}

function getElementProps(node: React.ReactNode): ReactElementProps | undefined {
  if (!React.isValidElement(node)) return undefined;
  return node.props && typeof node.props === "object"
    ? (node.props as ReactElementProps)
    : undefined;
}

function readStringProp(props: ReactElementProps | undefined, key: string): string | undefined {
  const value = props?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseCodeMetaLabel(meta: string | undefined): string | undefined {
  if (!meta) return undefined;
  const trimmed = meta.trim();
  if (!trimmed) return undefined;

  const namedMatch = trimmed.match(/\b(?:title|filename|file|name|label)=["']([^"']+)["']/);
  if (namedMatch?.[1]?.trim()) return namedMatch[1].trim();

  const language = trimmed.split(/\s+/, 1)[0] ?? "";
  const rest = trimmed.slice(language.length).trim();
  if (!rest) return undefined;

  const bareLabel = rest
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .find((part) => part && !part.includes("="));

  return bareLabel?.replace(/^["']|["']$/g, "");
}

function parseLanguageFromProps(props: ReactElementProps | undefined): string | undefined {
  const language = readStringProp(props, "language");
  if (language) return language;

  const className = readStringProp(props, "className");
  const match = className?.match(/language-([^\s]+)/);
  return match?.[1];
}

function getCodeGroupLabelFromNode(node: React.ReactNode): string | undefined {
  const props = getElementProps(node);
  if (!props) return undefined;

  for (const key of codeGroupLabelProps) {
    const value = readStringProp(props, key);
    if (value) return value;
  }

  const meta =
    readStringProp(props, "metastring") ??
    readStringProp(props, "meta") ??
    readStringProp(props, "data-meta");
  const metaLabel = parseCodeMetaLabel(meta);
  if (metaLabel) return metaLabel;

  const nested = React.Children.toArray(props.children).find((child) => {
    return getCodeGroupLabelFromNode(child) !== undefined;
  });
  const nestedLabel = getCodeGroupLabelFromNode(nested);
  if (nestedLabel) return nestedLabel;

  return parseLanguageFromProps(props);
}

function getCodeGroupItems(children: React.ReactNode): React.ReactNode[] {
  const items: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (child === null || child === undefined || typeof child === "boolean") return;
    if (typeof child === "string" && child.trim() === "") return;

    const props = getElementProps(child);
    if (props && React.isValidElement(child) && child.type === React.Fragment) {
      items.push(...getCodeGroupItems(props.children));
      return;
    }

    items.push(child);
  });

  return items;
}

function toTabValue(label: string, index: number, used: Set<string>): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `code-${index + 1}`;
  let value = slug;
  let suffix = 2;

  while (used.has(value)) {
    value = `${slug}-${suffix}`;
    suffix += 1;
  }

  used.add(value);
  return value;
}

function stripCodeGroupLabelProps(child: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(child)) return child;

  return React.cloneElement(child as React.ReactElement<ReactElementProps>, {
    title: undefined,
    filename: undefined,
    file: undefined,
    name: undefined,
    label: undefined,
    value: undefined,
    "data-title": undefined,
    "data-filename": undefined,
    "data-file": undefined,
  });
}

function CodeGroup({
  children,
  defaultValue,
  dropdown = false,
  className,
  ...props
}: CodeGroupProps) {
  const usedValues = new Set<string>();
  const items = getCodeGroupItems(children).map((child, index) => {
    const label = getCodeGroupLabelFromNode(child) ?? `Code ${index + 1}`;
    return {
      child: stripCodeGroupLabelProps(child),
      label,
      value: toTabValue(label, index, usedValues),
    };
  });

  if (items.length === 0) return null;

  const CodeBlockTabsComponent = CodeBlockTabs as React.ComponentType<
    React.ComponentPropsWithoutRef<typeof CodeBlockTabs> & {
      "data-dropdown"?: string;
      "data-fd-code-group"?: string;
    }
  >;

  return React.createElement(
    CodeBlockTabsComponent,
    {
      ...props,
      "data-fd-code-group": "",
      "data-dropdown": dropdown ? "" : undefined,
      className: cx("fd-code-group", dropdown && "fd-code-group-dropdown", className),
      defaultValue: defaultValue ?? items[0]?.value,
    },
    React.createElement(
      CodeBlockTabsList,
      null,
      items.map((item) =>
        React.createElement(
          CodeBlockTabsTrigger,
          { key: item.value, value: item.value },
          item.label,
        ),
      ),
    ),
    items.map((item) =>
      React.createElement(
        CodeBlockTab,
        {
          key: item.value,
          value: item.value,
          forceMount: true,
          className: "fd-code-group-panel",
        },
        item.child,
      ),
    ),
  );
}

const extendedMdxComponents = {
  ...defaultMdxComponents,
  img: MDXImg,
  table: Table,
  Agent,
  Audience,
  CodeGroup,
  HoverLink,
  Human,
  Prompt,
  Tab,
  Tabs,
};

export interface GetMDXComponentsOptions {
  /** Called when the user clicks the copy button on a code block (in addition to the default copy). */
  onCopyClick?: (data: CodeBlockCopyData) => void;
  /** Theme config used to apply built-in MDX component defaults from `theme.ui.components`. */
  theme?: DocsTheme;
  /** Shared icon registry from `docs.config.ts[x]`. */
  icons?: Record<string, PromptIconValue>;
  /** Optional site-wide "Open in …" providers used by built-in components such as `Prompt`. */
  openDocsProviders?: PromptOpenDocsProvider[];
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
  Prompt: {
    showTitle: true,
    showDescription: true,
    showPrompt: false,
    actions: ["copy"],
    copyLabel: "Copy prompt",
    copiedLabel: "Copied",
    openLabel: "Open in",
    copyIcon: "copy",
    copiedIcon: "check",
    openIcon: "arrowUpRight",
  } satisfies Partial<PromptProps>,
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
    const configuredDefaults =
      value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const componentDefaults =
      typeof value === "function"
        ? value(builtInDefaults)
        : { ...(builtInDefaults as Record<string, unknown>), ...configuredDefaults };

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

  const DefaultPre = (base as Record<string, unknown>).pre as
    | React.ComponentType<React.ComponentPropsWithoutRef<"pre">>
    | "pre"
    | undefined;
  if (DefaultPre) {
    (base as Record<string, unknown>).pre = createPreWithCodeSpacing(DefaultPre);
  }

  if ((base as Record<string, unknown>).Prompt) {
    const DefaultPrompt = (base as Record<string, unknown>).Prompt as React.ComponentType<
      React.PropsWithChildren<PromptProps>
    >;

    (base as Record<string, unknown>).Prompt = function PromptWithDocsContext(
      props: React.PropsWithChildren<PromptProps>,
    ) {
      const { children, ...rest } = props;
      return React.createElement(DefaultPrompt, {
        iconRegistry: options?.icons,
        openDocsProviders: options?.openDocsProviders,
        prompt: extractPromptText(children),
        ...rest,
        children,
      });
    };
  }

  if (options?.onCopyClick) {
    const CopyPre = (base as Record<string, unknown>).pre as
      | React.ComponentType<React.ComponentPropsWithoutRef<"pre">>
      | "pre"
      | undefined;
    if (CopyPre) {
      (base as Record<string, unknown>).pre = createPreWithCopyCallback(
        CopyPre,
        options.onCopyClick,
      );
    }
  }
  return base;
}

export {
  Agent,
  Audience,
  CodeGroup,
  defaultMdxComponents,
  extendedMdxComponents,
  HoverLink,
  Human,
  Prompt,
  Tab,
  Tabs,
};

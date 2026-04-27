import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Suspense, type ReactNode } from "react";
import type {
  DocsConfig,
  ThemeToggleConfig,
  SidebarConfig,
  TypographyConfig,
  FontStyle,
  AIConfig,
} from "@farming-labs/docs";
import { DocsPageClient } from "./docs-page-client.js";
import { DocsAIFeatures } from "./docs-ai-features.js";
import { DocsCommandSearch } from "./docs-command-search.js";
import { resolveReadingTimeOptions } from "./reading-time.js";
import { SidebarSearchWithAI } from "./sidebar-search-ai.js";
import { LocaleThemeControl } from "./locale-theme-control.js";
import { withLangInUrl } from "./i18n.js";

interface PageNode {
  type: "page";
  name: string;
  url: string;
  icon?: ReactNode;
}

interface FolderNode {
  type: "folder";
  name: string;
  icon?: ReactNode;
  index?: PageNode;
  children: (PageNode | FolderNode)[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

type TreeNode = PageNode | FolderNode;

interface TreeRoot {
  name: string;
  children: TreeNode[];
}

interface LayoutDimensions {
  sidebarWidth?: number;
  contentWidth?: number;
  tocWidth?: number;
}

function resolveTreeIcon(
  icon: ReactNode,
  registry: Record<string, unknown> | undefined,
): ReactNode | undefined {
  if (!icon) return undefined;
  if (typeof icon !== "string") return icon;

  const fromRegistry = registry?.[icon] as ReactNode | undefined;
  if (fromRegistry) return fromRegistry;

  return undefined;
}

function resolveTreeIcons(tree: TreeRoot, registry: Record<string, unknown> | undefined): TreeRoot {
  function mapNode(node: TreeNode): TreeNode {
    if (node.type === "page") {
      return {
        ...node,
        icon: resolveTreeIcon(node.icon, registry),
      };
    }

    return {
      ...node,
      icon: resolveTreeIcon(node.icon, registry),
      index: node.index
        ? {
            ...node.index,
            icon: resolveTreeIcon(node.index.icon, registry),
          }
        : undefined,
      children: node.children.map(mapNode),
    };
  }

  return {
    ...tree,
    children: tree.children.map(mapNode),
  };
}

export interface TanstackDocsLayoutProps {
  config: DocsConfig;
  tree: TreeRoot;
  locale?: string;
  description?: string;
  readingTime?: number | null;
  lastModified?: string;
  editOnGithubUrl?: string;
  children: ReactNode;
}

function localizeTreeUrls(tree: TreeRoot, locale?: string): TreeRoot {
  function mapNode(node: TreeNode): TreeNode {
    if (node.type === "page") {
      return {
        ...node,
        url: withLangInUrl(node.url, locale),
      };
    }

    return {
      ...node,
      index: node.index
        ? {
            ...node.index,
            url: withLangInUrl(node.index.url, locale),
          }
        : undefined,
      children: node.children.map(mapNode),
    };
  }

  return {
    ...tree,
    children: tree.children.map(mapNode),
  };
}

function resolveThemeSwitch(toggle: boolean | ThemeToggleConfig | undefined) {
  if (toggle === undefined || toggle === true) return { enabled: true };
  if (toggle === false) return { enabled: false };
  return {
    enabled: toggle.enabled !== false,
    mode: toggle.mode,
  };
}

function resolveSidebar(sidebar: boolean | SidebarConfig | undefined) {
  if (sidebar === undefined || sidebar === true) return {};
  if (sidebar === false) return { enabled: false };
  return {
    enabled: sidebar.enabled !== false,
    componentFn: typeof sidebar.component === "function" ? sidebar.component : undefined,
    footer: sidebar.footer as ReactNode,
    banner: sidebar.banner as ReactNode,
    collapsible: sidebar.collapsible,
    flat: sidebar.flat,
  };
}

const COLOR_MAP: Record<string, string> = {
  primary: "--color-fd-primary",
  primaryForeground: "--color-fd-primary-foreground",
  background: "--color-fd-background",
  foreground: "--color-fd-foreground",
  muted: "--color-fd-muted",
  mutedForeground: "--color-fd-muted-foreground",
  border: "--color-fd-border",
  card: "--color-fd-card",
  cardForeground: "--color-fd-card-foreground",
  accent: "--color-fd-accent",
  accentForeground: "--color-fd-accent-foreground",
  popover: "--color-fd-popover",
  popoverForeground: "--color-fd-popover-foreground",
  secondary: "--color-fd-secondary",
  secondaryForeground: "--color-fd-secondary-foreground",
  ring: "--color-fd-ring",
};

function buildColorsCSS(colors?: Record<string, string | undefined>): string {
  if (!colors) return "";
  const vars: string[] = [];
  for (const [key, value] of Object.entries(colors)) {
    if (!value || !COLOR_MAP[key]) continue;
    vars.push(`${COLOR_MAP[key]}: ${value};`);
  }
  if (vars.length === 0) return "";
  const block = vars.join("\n  ");
  return `:root {\n  ${block}\n}\n.dark {\n  ${block}\n}`;
}

function ColorStyle({ colors }: { colors?: Record<string, string | undefined> }) {
  const css = buildColorsCSS(colors);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

function buildFontStyleVars(prefix: string, style?: FontStyle): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.size) parts.push(`${prefix}-size: ${style.size};`);
  if (style.weight != null) parts.push(`${prefix}-weight: ${style.weight};`);
  if (style.lineHeight) parts.push(`${prefix}-line-height: ${style.lineHeight};`);
  if (style.letterSpacing) parts.push(`${prefix}-letter-spacing: ${style.letterSpacing};`);
  return parts.join("\n  ");
}

function buildTypographyCSS(typo?: TypographyConfig): string {
  if (!typo?.font) return "";

  const vars: string[] = [];
  const fontStyle = typo.font.style;

  if (fontStyle?.sans) vars.push(`--fd-font-sans: ${fontStyle.sans};`);
  if (fontStyle?.mono) vars.push(`--fd-font-mono: ${fontStyle.mono};`);

  const elements = ["h1", "h2", "h3", "h4", "body", "small"] as const;
  for (const element of elements) {
    const style = typo.font[element];
    if (style) {
      const cssVars = buildFontStyleVars(`--fd-${element}`, style);
      if (cssVars) vars.push(cssVars);
    }
  }

  if (vars.length === 0) return "";
  return `:root {\n  ${vars.join("\n  ")}\n}`;
}

function TypographyStyle({ typography }: { typography?: TypographyConfig }) {
  const css = buildTypographyCSS(typography);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

function LayoutStyle({ layout }: { layout?: LayoutDimensions }) {
  if (!layout) return null;

  const rootVars: string[] = [];
  const desktopRootVars: string[] = [];
  const desktopGridVars: string[] = [];

  if (layout.sidebarWidth) {
    const value = `--fd-sidebar-width: ${layout.sidebarWidth}px`;
    desktopRootVars.push(`${value};`);
    desktopGridVars.push(`${value} !important;`);
  }
  if (layout.contentWidth) {
    rootVars.push(`--fd-content-width: ${layout.contentWidth}px;`);
  }
  if (layout.tocWidth) {
    const value = `--fd-toc-width: ${layout.tocWidth}px`;
    desktopRootVars.push(`${value};`);
    desktopGridVars.push(`${value} !important;`);
  }

  if (rootVars.length === 0 && desktopRootVars.length === 0) return null;

  const parts: string[] = [];

  if (rootVars.length > 0) {
    parts.push(`:root {\n  ${rootVars.join("\n  ")}\n}`);
  }

  if (desktopRootVars.length > 0) {
    const inner = [`:root {\n    ${desktopRootVars.join("\n    ")}\n  }`];
    if (desktopGridVars.length > 0) {
      inner.push(`[style*="fd-sidebar-col"] {\n    ${desktopGridVars.join("\n    ")}\n  }`);
    }
    parts.push(`@media (min-width: 1024px) {\n  ${inner.join("\n  ")}\n}`);
  }

  return <style dangerouslySetInnerHTML={{ __html: parts.join("\n") }} />;
}

function resolveBool(value: boolean | { enabled?: boolean } | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;
  return value.enabled !== false;
}

function resolveFeedbackConfig(feedback: DocsConfig["feedback"]) {
  const defaults = {
    enabled: false,
    question: "How is this guide?",
    placeholder: "Leave your feedback...",
    positiveLabel: "Good",
    negativeLabel: "Bad",
    submitLabel: "Submit",
  };

  if (feedback === undefined || feedback === false) return defaults;
  if (feedback === true) return { ...defaults, enabled: true };

  const hasHumanFeedbackConfig =
    feedback.enabled !== undefined ||
    feedback.question !== undefined ||
    feedback.placeholder !== undefined ||
    feedback.positiveLabel !== undefined ||
    feedback.negativeLabel !== undefined ||
    feedback.submitLabel !== undefined ||
    feedback.onFeedback !== undefined;

  return {
    enabled: feedback.enabled === true || (feedback.enabled !== false && hasHumanFeedbackConfig),
    question: feedback.question ?? defaults.question,
    placeholder: feedback.placeholder ?? defaults.placeholder,
    positiveLabel: feedback.positiveLabel ?? defaults.positiveLabel,
    negativeLabel: feedback.negativeLabel ?? defaults.negativeLabel,
    submitLabel: feedback.submitLabel ?? defaults.submitLabel,
  };
}

function ForcedThemeScript({ theme }: { theme: string }) {
  const normalizedTheme = theme === "light" || theme === "dark" ? theme : "light";
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.classList.remove('light','dark');document.documentElement.classList.add('${normalizedTheme}');`,
      }}
    />
  );
}

export function TanstackDocsLayout({
  config,
  tree,
  locale,
  description,
  readingTime,
  lastModified,
  editOnGithubUrl,
  children,
}: TanstackDocsLayoutProps) {
  const tocConfig = config.theme?.ui?.layout?.toc;
  const tocEnabled = tocConfig?.enabled !== false;
  const tocStyle = tocConfig?.style as "default" | "directional" | undefined;
  const docsApiUrl = withLangInUrl("/api/docs", locale);
  const navTitle = (config.nav?.title as ReactNode) ?? "Docs";
  const navUrl = withLangInUrl(config.nav?.url ?? `/${config.entry ?? "docs"}`, locale);

  const themeSwitch = resolveThemeSwitch(config.themeToggle);
  const toggleConfig = typeof config.themeToggle === "object" ? config.themeToggle : undefined;
  const forcedTheme =
    themeSwitch.enabled === false && toggleConfig?.default && toggleConfig.default !== "system"
      ? toggleConfig.default
      : undefined;

  const resolvedSidebar = resolveSidebar(config.sidebar);
  const sidebarFlat = resolvedSidebar.flat;
  const sidebarComponentFn = resolvedSidebar.componentFn;
  const { flat: _sidebarFlat, componentFn: _componentFn, ...sidebarProps } = resolvedSidebar;

  const breadcrumbConfig = config.breadcrumb;
  const breadcrumbEnabled =
    breadcrumbConfig === undefined ||
    breadcrumbConfig === true ||
    (typeof breadcrumbConfig === "object" && breadcrumbConfig.enabled !== false);

  const colors = config.theme?._userColorOverrides as
    | Record<string, string | undefined>
    | undefined;
  const typography = config.theme?.ui?.typography;
  const layoutDimensions = config.theme?.ui?.layout;

  const pageActions = config.pageActions;
  const copyMarkdownEnabled = resolveBool(pageActions?.copyMarkdown);
  const openDocsEnabled = resolveBool(pageActions?.openDocs);
  const pageActionsPosition = pageActions?.position ?? "below-title";
  const pageActionsAlignment = pageActions?.alignment ?? "left";

  const lastUpdatedRaw = config.lastUpdated;
  const lastUpdatedEnabled =
    lastUpdatedRaw !== false &&
    (typeof lastUpdatedRaw !== "object" || lastUpdatedRaw.enabled !== false);
  const lastUpdatedPosition: "footer" | "below-title" =
    typeof lastUpdatedRaw === "object" ? (lastUpdatedRaw.position ?? "footer") : "footer";
  const readingTimeEnabled = resolveReadingTimeOptions(config.readingTime).enabled;

  const llmsTxtEnabled = resolveBool(config.llmsTxt);
  const feedbackConfig = resolveFeedbackConfig(config.feedback);
  const staticExport = !!(config as { staticExport?: boolean }).staticExport;

  const rawProviders =
    typeof pageActions?.openDocs === "object" && pageActions.openDocs.providers
      ? pageActions.openDocs.providers
      : undefined;
  const openDocsProviders = rawProviders?.map((provider) => ({
    name: provider.name,
    urlTemplate: provider.urlTemplate,
  }));

  const aiConfig = config.ai as AIConfig | undefined;
  const aiEnabled = !staticExport && !!aiConfig?.enabled;
  const aiMode = aiConfig?.mode ?? ("search" as "search" | "floating" | "sidebar-icon");
  const aiPosition = aiConfig?.position ?? "bottom-right";
  const aiFloatingStyle = aiConfig?.floatingStyle ?? "panel";
  const aiSuggestedQuestions = aiConfig?.suggestedQuestions;
  const aiLabel = aiConfig?.aiLabel;
  const aiLoaderVariant = aiConfig?.loader;

  const rawModelConfig = aiConfig?.model as
    | { models?: { id: string; label: string }[]; defaultModel?: string }
    | string
    | undefined;
  let aiModels = (aiConfig as (AIConfig & { models?: { id: string; label: string }[] }) | undefined)
    ?.models;
  let aiDefaultModelId: string | undefined =
    (aiConfig as (AIConfig & { defaultModel?: string }) | undefined)?.defaultModel ??
    (typeof aiConfig?.model === "string" ? aiConfig.model : undefined);

  if (rawModelConfig && typeof rawModelConfig === "object") {
    aiModels = rawModelConfig.models ?? aiModels;
    aiDefaultModelId =
      rawModelConfig.defaultModel ?? rawModelConfig.models?.[0]?.id ?? aiDefaultModelId;
  }

  const i18n = (config as DocsConfig & { i18n?: { locales?: string[]; defaultLocale?: string } })
    .i18n;
  const resolvedTree = resolveTreeIcons(
    locale ? localizeTreeUrls(tree, locale) : tree,
    config.icons as Record<string, unknown> | undefined,
  );

  const finalSidebarProps = { ...sidebarProps } as Record<string, unknown>;
  const sidebarFooter = sidebarProps.footer as ReactNode;

  if (locale && i18n?.locales && i18n.defaultLocale) {
    finalSidebarProps.footer = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sidebarFooter}
        <Suspense fallback={null}>
          <LocaleThemeControl
            locales={i18n.locales}
            defaultLocale={i18n.defaultLocale}
            locale={locale}
            showThemeToggle={themeSwitch.enabled !== false}
            themeMode={themeSwitch.mode}
          />
        </Suspense>
      </div>
    );
  }

  if (sidebarComponentFn) {
    finalSidebarProps.component = (sidebarComponentFn as Function)({
      tree: resolvedTree,
      collapsible: sidebarProps.collapsible !== false,
      flat: !!sidebarFlat,
    }) as ReactNode;
  }

  return (
    <DocsLayout
      tree={resolvedTree}
      nav={{ title: navTitle, url: navUrl }}
      themeSwitch={locale && i18n?.locales ? { ...themeSwitch, enabled: false } : themeSwitch}
      sidebar={finalSidebarProps}
      {...(aiMode === "sidebar-icon" && aiEnabled
        ? {
            searchToggle: { components: { lg: <SidebarSearchWithAI /> } },
          }
        : {})}
    >
      <ColorStyle colors={colors} />
      <TypographyStyle typography={typography} />
      <LayoutStyle layout={layoutDimensions} />
      {forcedTheme && <ForcedThemeScript theme={forcedTheme} />}
      {!staticExport && (
        <Suspense fallback={null}>
          <DocsCommandSearch api={docsApiUrl} locale={locale} />
        </Suspense>
      )}
      {aiEnabled && (
        <Suspense fallback={null}>
          <DocsAIFeatures
            mode={aiMode}
            api={docsApiUrl}
            locale={locale}
            position={aiPosition}
            floatingStyle={aiFloatingStyle}
            suggestedQuestions={aiSuggestedQuestions}
            aiLabel={aiLabel}
            loaderVariant={aiLoaderVariant}
            models={aiModels}
            defaultModelId={aiDefaultModelId}
          />
        </Suspense>
      )}
      <Suspense fallback={children}>
        <DocsPageClient
          tocEnabled={tocEnabled}
          tocStyle={tocStyle}
          breadcrumbEnabled={breadcrumbEnabled}
          entry={config.entry ?? "docs"}
          locale={locale}
          copyMarkdown={copyMarkdownEnabled}
          openDocs={openDocsEnabled}
          openDocsProviders={openDocsProviders}
          pageActionsPosition={pageActionsPosition}
          pageActionsAlignment={pageActionsAlignment}
          editOnGithubUrl={editOnGithubUrl}
          lastUpdatedEnabled={lastUpdatedEnabled}
          lastUpdatedPosition={lastUpdatedPosition}
          lastModified={lastModified}
          readingTimeEnabled={readingTimeEnabled}
          readingTime={typeof readingTime === "number" ? readingTime : undefined}
          llmsTxtEnabled={llmsTxtEnabled}
          description={description}
          feedbackEnabled={feedbackConfig.enabled}
          feedbackQuestion={feedbackConfig.question}
          feedbackPlaceholder={feedbackConfig.placeholder}
          feedbackPositiveLabel={feedbackConfig.positiveLabel}
          feedbackNegativeLabel={feedbackConfig.negativeLabel}
          feedbackSubmitLabel={feedbackConfig.submitLabel}
        >
          {children}
        </DocsPageClient>
      </Suspense>
    </DocsLayout>
  );
}

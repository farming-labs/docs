import { createElement, type ComponentType, type ReactNode } from "react";
import type { DocsConfig, FeedbackConfig } from "@farming-labs/docs";
import { DocsClientHooks } from "@farming-labs/theme/client-hooks";
import {
  BrowserDocsLayout,
  BrowserRootProvider,
  type BrowserNavigationAdapter,
} from "@farming-labs/theme/browser";
import { getMDXComponents, type GetMDXComponentsOptions } from "@farming-labs/theme/mdx";
import type { DocsServerLoadResult } from "./server.js";
import { themeOptionsFromConfig } from "./theme.js";

function renderConfiguredIcon(value: unknown): ReactNode {
  if (typeof value !== "string") return value as ReactNode;
  const markup = value.trim();
  if (!markup) return undefined;

  const svgMatch = markup.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/i);
  const inner = svgMatch?.[2] ?? markup;
  const viewBox = svgMatch?.[1].match(/\bviewBox=["']([^"']+)["']/i)?.[1] ?? "0 0 24 24";

  return createElement("svg", {
    "aria-hidden": "true",
    focusable: "false",
    viewBox,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    dangerouslySetInnerHTML: { __html: inner },
  });
}

function withRenderableIcons(config: DocsConfig): DocsConfig {
  if (!config.icons || typeof config.icons !== "object") return config;
  return {
    ...config,
    icons: Object.fromEntries(
      Object.entries(config.icons).map(([name, value]) => [name, renderConfiguredIcon(value)]),
    ),
  };
}

export interface FarmDocsPageRendererProps {
  config: DocsConfig;
  data: DocsServerLoadResult;
  Content?: ComponentType<any> | null;
  navigation?: BrowserNavigationAdapter;
}

/** Renderer shared by Vite-loaded pages and build-time edge snapshots. */
export function FarmDocsPageRenderer({
  config,
  data,
  Content,
  navigation,
}: FarmDocsPageRendererProps) {
  const resolvedConfig = withRenderableIcons(config);
  const promptIconRegistry = resolvedConfig.icons as GetMDXComponentsOptions["icons"];
  const promptOpenDocsProviders =
    resolvedConfig.pageActions?.openDocs && typeof resolvedConfig.pageActions.openDocs === "object"
      ? (resolvedConfig.pageActions.openDocs
          .providers as GetMDXComponentsOptions["openDocsProviders"])
      : undefined;
  const themeOptions = themeOptionsFromConfig(config);

  if (!Content) {
    return (
      <BrowserRootProvider initialPathname={data.url} navigation={navigation} theme={themeOptions}>
        <BrowserDocsLayout
          config={resolvedConfig}
          tree={data.tree}
          locale={data.locale}
          telemetryFramework="farmjs"
        >
          <article style={{ padding: "2rem" }}>
            <h1>Page module missing</h1>
            <p>Expected a compiled MDX module at `{data.sourcePath}`.</p>
          </article>
        </BrowserDocsLayout>
      </BrowserRootProvider>
    );
  }

  return (
    <BrowserRootProvider initialPathname={data.url} navigation={navigation} theme={themeOptions}>
      <DocsClientHooks
        onCopyClick={resolvedConfig.onCopyClick}
        analytics={resolvedConfig.analytics}
        onFeedback={
          typeof resolvedConfig.feedback === "object"
            ? (resolvedConfig.feedback as FeedbackConfig).onFeedback
            : undefined
        }
        onAIFeedback={
          resolvedConfig.ai?.feedback && typeof resolvedConfig.ai.feedback === "object"
            ? resolvedConfig.ai.feedback.onFeedback
            : undefined
        }
        onAIActions={resolvedConfig.ai?.onActions}
      />
      <BrowserDocsLayout
        config={resolvedConfig}
        tree={data.tree}
        locale={data.locale}
        telemetryFramework="farmjs"
        description={data.descriptionInBody ? undefined : data.description}
        descriptionInBody={data.descriptionInBody}
        readingTime={data.readingTime}
        lastModified={data.lastModified}
        previousPage={data.previousPage}
        nextPage={data.nextPage}
        structuredData={data.structuredData}
        editOnGithubUrl={data.editOnGithub}
      >
        <Content
          components={getMDXComponents(resolvedConfig.components as Record<string, unknown>, {
            onCopyClick: resolvedConfig.onCopyClick,
            theme: resolvedConfig.theme,
            icons: promptIconRegistry,
            openDocsProviders: promptOpenDocsProviders,
          })}
        />
      </BrowserDocsLayout>
    </BrowserRootProvider>
  );
}

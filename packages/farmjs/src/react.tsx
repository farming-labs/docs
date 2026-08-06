import { createElement, type ComponentType, type ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import type { DocsConfig, FeedbackConfig } from "@farming-labs/docs";
import { DocsClientHooks } from "@farming-labs/theme/client-hooks";
import { BrowserDocsLayout, BrowserRootProvider } from "@farming-labs/theme/browser";
import { getMDXComponents, type GetMDXComponentsOptions } from "@farming-labs/theme/mdx";
import type { DocsServerLoadResult } from "./server.js";
import { normalizeDocsModuleKey, resolveDocsModule } from "./module-map.js";

interface MdxModule {
  default: ComponentType<any>;
}

const rawDocModules = import.meta.glob("/**/*.{md,mdx}", {
  eager: true,
});

const docModules = Object.fromEntries(
  Object.entries(rawDocModules).map(([key, value]) => [normalizeDocsModuleKey(key), value]),
);

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

export function FarmDocsPage({ config, data }: { config: DocsConfig; data: DocsServerLoadResult }) {
  const resolvedConfig = withRenderableIcons(config);
  const promptIconRegistry = resolvedConfig.icons as GetMDXComponentsOptions["icons"];
  const promptOpenDocsProviders =
    resolvedConfig.pageActions?.openDocs && typeof resolvedConfig.pageActions.openDocs === "object"
      ? (resolvedConfig.pageActions.openDocs
          .providers as GetMDXComponentsOptions["openDocsProviders"])
      : undefined;
  const module = resolveDocsModule(docModules, data.sourcePath) as MdxModule | undefined;
  const Content = module?.default ?? null;

  if (!Content) {
    return (
      <BrowserRootProvider initialPathname={data.url}>
        <BrowserDocsLayout config={resolvedConfig} tree={data.tree} locale={data.locale}>
          <article style={{ padding: "2rem" }}>
            <h1>Page module missing</h1>
            <p>Expected a compiled MDX module at `{data.sourcePath}`.</p>
          </article>
        </BrowserDocsLayout>
      </BrowserRootProvider>
    );
  }

  return (
    <BrowserRootProvider initialPathname={data.url}>
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
        description={data.descriptionInBody ? undefined : data.description}
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

export function hydrateFarmDocs(input: {
  config: DocsConfig;
  data: DocsServerLoadResult;
  container?: Element | null;
}): Root {
  const container = input.container ?? document.getElementById("farm-docs-root");
  if (!container) {
    throw new Error("Farm docs hydration root was not found.");
  }

  return hydrateRoot(container, <FarmDocsPage config={input.config} data={input.data} />);
}

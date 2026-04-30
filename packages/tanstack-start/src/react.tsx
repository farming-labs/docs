import type { ComponentType } from "react";
import type { DocsConfig, FeedbackConfig } from "@farming-labs/docs";
import { DocsClientHooks } from "@farming-labs/theme/client-hooks";
import { TanstackDocsLayout } from "@farming-labs/theme/tanstack";
import { getMDXComponents, type GetMDXComponentsOptions } from "@farming-labs/theme/mdx";
import type { DocsServerLoadResult } from "./server.js";

interface MdxModule {
  default: ComponentType<any>;
}

const rawDocModules = import.meta.glob("/**/*.{md,mdx}", {
  eager: true,
});

function normalizeDocsKey(key: string) {
  const posixKey = key.replace(/\\/g, "/");
  return posixKey.startsWith("/") ? posixKey : `/${posixKey.replace(/^\.?\//, "")}`;
}

const docModules = Object.fromEntries(
  Object.entries(rawDocModules).map(([key, value]) => [normalizeDocsKey(key), value]),
);

export function TanstackDocsPage({
  config,
  data,
}: {
  config: DocsConfig;
  data: DocsServerLoadResult;
}) {
  const promptIconRegistry = config.icons as GetMDXComponentsOptions["icons"];
  const promptOpenDocsProviders =
    config.pageActions?.openDocs && typeof config.pageActions.openDocs === "object"
      ? (config.pageActions.openDocs.providers as GetMDXComponentsOptions["openDocsProviders"])
      : undefined;
  const module = docModules[data.sourcePath] as MdxModule | undefined;
  const Content = module?.default ?? null;

  if (!Content) {
    return (
      <TanstackDocsLayout config={config} tree={data.tree} locale={data.locale}>
        <article style={{ padding: "2rem" }}>
          <h1>Page module missing</h1>
          <p>Expected a compiled MDX module at `{data.sourcePath}`.</p>
        </article>
      </TanstackDocsLayout>
    );
  }

  return (
    <>
      <DocsClientHooks
        onCopyClick={config.onCopyClick}
        onFeedback={
          typeof config.feedback === "object"
            ? (config.feedback as FeedbackConfig).onFeedback
            : undefined
        }
      />
      <TanstackDocsLayout
        config={config}
        tree={data.tree}
        locale={data.locale}
        description={data.description}
        readingTime={data.readingTime}
        lastModified={data.lastModified}
        editOnGithubUrl={data.editOnGithub}
      >
        <Content
          components={getMDXComponents(config.components as Record<string, unknown>, {
            onCopyClick: config.onCopyClick,
            theme: config.theme,
            icons: promptIconRegistry,
            openDocsProviders: promptOpenDocsProviders,
          })}
        />
      </TanstackDocsLayout>
    </>
  );
}

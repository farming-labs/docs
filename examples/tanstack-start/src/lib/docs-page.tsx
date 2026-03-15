import { lazy, Suspense, useMemo, type ComponentType } from "react";
import { TanstackDocsLayout } from "@farming-labs/theme/tanstack";
import { getMDXComponents } from "@farming-labs/theme/mdx";
import docsConfig from "../../docs.config";
import { docModules } from "./doc-modules";
import type { DocsServerLoadResult } from "@farming-labs/tanstack-start/server";

export function TanstackDocsPage({ data }: { data: DocsServerLoadResult }) {
  const importer = docModules[data.sourcePath];
  const Content = useMemo(
    () => (importer ? lazy(importer as () => Promise<{ default: ComponentType<any> }>) : null),
    [importer],
  );

  if (!Content) {
    return (
      <TanstackDocsLayout config={docsConfig} tree={data.tree} locale={data.locale}>
        <article style={{ padding: "2rem" }}>
          <h1>Page module missing</h1>
          <p>Expected a compiled MDX module at `{data.sourcePath}`.</p>
        </article>
      </TanstackDocsLayout>
    );
  }

  return (
    <TanstackDocsLayout
      config={docsConfig}
      tree={data.tree}
      locale={data.locale}
      description={data.description}
      lastModified={data.lastModified}
      editOnGithubUrl={data.editOnGithub}
    >
      <Suspense fallback={<div style={{ padding: "2rem" }}>Loading page…</div>}>
        <Content
          components={getMDXComponents(docsConfig.components as Record<string, unknown>, {
            onCopyClick: docsConfig.onCopyClick,
          })}
        />
      </Suspense>
    </TanstackDocsLayout>
  );
}

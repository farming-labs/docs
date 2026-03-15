import { createFileRoute } from "@tanstack/react-router";
import { TanstackDocsPage } from "@farming-labs/tanstack-start/react";
import { loadDocPage } from "@/lib/docs.functions";
import docsConfig from "../../docs.config";

export const Route = createFileRoute("/docs/")({
  loader: () => loadDocPage({ data: { pathname: "/docs" } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} – TanStack Start Docs` : "TanStack Start Docs" },
      ...(loaderData?.description
        ? [{ name: "description", content: loaderData.description }]
        : []),
    ],
  }),
  component: DocsIndexPage,
});

function DocsIndexPage() {
  const data = Route.useLoaderData();
  return <TanstackDocsPage config={docsConfig} data={data} />;
}

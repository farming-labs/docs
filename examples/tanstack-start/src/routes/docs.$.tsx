import { createFileRoute, notFound } from "@tanstack/react-router";
import { TanstackDocsPage } from "@farming-labs/tanstack-start/react";
import { loadDocPage } from "@/lib/docs.functions";
import docsConfig from "../../docs.config";

export const Route = createFileRoute("/docs/$")({
  loader: async ({ location }) => {
    try {
      return await loadDocPage({ data: { pathname: location.pathname } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} – TanStack Start Docs` : "TanStack Start Docs" },
      ...(loaderData?.description
        ? [{ name: "description", content: loaderData.description }]
        : []),
    ],
  }),
  component: DocsCatchAllPage,
});

function DocsCatchAllPage() {
  const data = Route.useLoaderData();
  return <TanstackDocsPage config={docsConfig} data={data} />;
}

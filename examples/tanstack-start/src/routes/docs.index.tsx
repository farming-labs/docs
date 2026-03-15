import { createFileRoute } from "@tanstack/react-router";
import { TanstackDocsPage } from "@/lib/docs-page";
import { loadDocPage } from "@/lib/docs.functions";

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
  return <TanstackDocsPage data={data} />;
}

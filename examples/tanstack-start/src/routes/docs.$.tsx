import { createFileRoute, notFound } from "@tanstack/react-router";
import { TanstackDocsPage } from "@/lib/docs-page";
import { loadDocPage } from "@/lib/docs.functions";

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
  return <TanstackDocsPage data={data} />;
}

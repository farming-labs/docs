import { createFileRoute, notFound } from "@tanstack/react-router";
import { isDocsPublicGetRequest } from "@farming-labs/docs";
import { TanstackDocsPage } from "@farming-labs/tanstack-start/react";
import { loadDocPage } from "@/lib/docs.functions";
import { docsServer } from "@/lib/docs.server";
import docsConfig from "../../docs.config";

export const Route = createFileRoute("/docs/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (isDocsPublicGetRequest("docs", url, request)) return docsServer.GET({ request });
        return undefined;
      },
    },
  },
  loader: async ({ location }) => {
    try {
      return await loadDocPage({ data: { pathname: location.pathname } });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        (error as { status?: unknown }).status === 404
      ) {
        throw notFound();
      }
      throw error;
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

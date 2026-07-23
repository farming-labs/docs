import { createFileRoute } from "@tanstack/react-router";
import { isDocsStandardsDiscoveryRequest } from "@farming-labs/docs";
import { docsServer } from "@/lib/docs.server";
import docsConfig from "../../docs.config";

async function handleUnsupportedDocsMethod(request: Request) {
  const url = new URL(request.url);
  if (isDocsStandardsDiscoveryRequest(url, { apiRoute: docsConfig.cloud?.apiRoute })) {
    return docsServer.GET({ request });
  }
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD, POST" },
  });
}

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: async ({ request }) => docsServer.GET({ request }),
      HEAD: async ({ request }) => docsServer.HEAD({ request }),
      POST: async ({ request }) => docsServer.POST({ request }),
      ANY: async ({ request }) => handleUnsupportedDocsMethod(request),
    },
  },
});

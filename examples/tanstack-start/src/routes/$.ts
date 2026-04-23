import { createFileRoute } from "@tanstack/react-router";
import { isDocsMcpRequest, isDocsPublicGetRequest } from "@farming-labs/docs";
import { docsServer } from "@/lib/docs.server";

const docsEntry = "docs";

async function handlePublicDocsRequest(request: Request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (isDocsMcpRequest(url)) {
    if (method === "POST") return docsServer.MCP.POST({ request });
    if (method === "DELETE") return docsServer.MCP.DELETE({ request });
    if (method === "GET" || method === "HEAD") return docsServer.MCP.GET({ request });
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST, DELETE" },
    });
  }

  if ((method === "GET" || method === "HEAD") && isDocsPublicGetRequest(docsEntry, url, request)) {
    return docsServer.GET({ request });
  }

  return new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handlePublicDocsRequest(request),
      POST: async ({ request }) => handlePublicDocsRequest(request),
      DELETE: async ({ request }) => handlePublicDocsRequest(request),
    },
  },
});

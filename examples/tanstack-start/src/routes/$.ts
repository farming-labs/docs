import { createFileRoute } from "@tanstack/react-router";
import {
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsStandardsDiscoveryRequest,
} from "@farming-labs/docs";
import { docsServer } from "@/lib/docs.server";
import docsConfig from "../../docs.config";

const docsEntry = "docs";

async function handlePublicDocsRequest(request: Request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (isDocsMcpRequest(url, docsConfig.mcp)) {
    if (method === "OPTIONS") return docsServer.MCP.OPTIONS({ request });
    if (method === "POST") return docsServer.MCP.POST({ request });
    if (method === "DELETE") return docsServer.MCP.DELETE({ request });
    if (method === "GET" || method === "HEAD") return docsServer.MCP.GET({ request });
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST, DELETE, OPTIONS" },
    });
  }

  if (isDocsStandardsDiscoveryRequest(url, { apiRoute: docsConfig.cloud?.apiRoute })) {
    if (method === "HEAD") return docsServer.HEAD({ request });
    if (method === "POST") return docsServer.POST({ request });
    return docsServer.GET({ request });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, url, request, {
      apiRoute: docsConfig.cloud?.apiRoute,
      sitemap: docsConfig.sitemap,
      llms: docsConfig.llmsTxt,
      robots: docsConfig.robots,
    })
  ) {
    return method === "HEAD" ? docsServer.HEAD({ request }) : docsServer.GET({ request });
  }

  return new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handlePublicDocsRequest(request),
      HEAD: async ({ request }) => handlePublicDocsRequest(request),
      POST: async ({ request }) => handlePublicDocsRequest(request),
      DELETE: async ({ request }) => handlePublicDocsRequest(request),
      OPTIONS: async ({ request }) => handlePublicDocsRequest(request),
      ANY: async ({ request }) => handlePublicDocsRequest(request),
    },
  },
});

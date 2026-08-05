import {
  isDocsLlmsTxtPublicRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsStandardsDiscoveryRequest,
} from "@farming-labs/docs";
import config from "$lib/docs.config";
import { GET, HEAD, POST, MCP } from "$lib/docs.server.js";

const docsEntry = config.entry ?? "docs";

export async function handle({ event, resolve }) {
  const method = event.request.method.toUpperCase();

  if (isDocsMcpRequest(event.url, config.mcp)) {
    if (method === "OPTIONS") return MCP.OPTIONS({ request: event.request });
    if (method === "POST") return MCP.POST({ request: event.request });
    if (method === "DELETE") return MCP.DELETE({ request: event.request });
    if (method === "GET" || method === "HEAD") return MCP.GET({ request: event.request });
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST, DELETE, OPTIONS" },
    });
  }

  if (isDocsStandardsDiscoveryRequest(event.url, { apiRoute: config.cloud?.apiRoute })) {
    if (method === "HEAD") return HEAD({ url: event.url, request: event.request });
    if (method === "POST") return POST({ url: event.url, request: event.request });
    return GET({ url: event.url, request: event.request });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsLlmsTxtPublicRequest(event.url, config.llmsTxt, docsEntry, {
      apiRoute: config.cloud?.apiRoute,
    })
  ) {
    const nativeResponse = await resolve(event);
    if (nativeResponse.status !== 404) return nativeResponse;
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, event.url, event.request, {
      apiRoute: config.cloud?.apiRoute,
      sitemap: config.sitemap,
      llms: config.llmsTxt,
    })
  ) {
    return method === "HEAD"
      ? HEAD({ url: event.url, request: event.request })
      : GET({ url: event.url, request: event.request });
  }

  return resolve(event);
}

import {
  isDocsLlmsTxtPublicRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsStandardsDiscoveryRequest,
} from "@farming-labs/docs";
import type { MiddlewareHandler } from "astro";
import config from "./lib/docs.config";
import { GET, HEAD, POST, MCP } from "./lib/docs.server";

const docsEntry = config.entry ?? "docs";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const method = context.request.method.toUpperCase();

  if (isDocsMcpRequest(context.url, config.mcp)) {
    if (method === "OPTIONS") return MCP.OPTIONS({ request: context.request });
    if (method === "POST") return MCP.POST({ request: context.request });
    if (method === "DELETE") return MCP.DELETE({ request: context.request });
    if (method === "GET" || method === "HEAD") return MCP.GET({ request: context.request });
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST, DELETE, OPTIONS" },
    });
  }

  if (isDocsStandardsDiscoveryRequest(context.url, { apiRoute: config.cloud?.apiRoute })) {
    if (method === "HEAD") return HEAD({ request: context.request });
    if (method === "POST") return POST({ request: context.request });
    return GET({ request: context.request });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsLlmsTxtPublicRequest(context.url, config.llmsTxt, docsEntry, {
      apiRoute: config.cloud?.apiRoute,
    })
  ) {
    const nativeResponse = await next();
    if (nativeResponse.status !== 404) return nativeResponse;
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, context.url, context.request, {
      apiRoute: config.cloud?.apiRoute,
      sitemap: config.sitemap,
      llms: config.llmsTxt,
    })
  ) {
    return method === "HEAD"
      ? HEAD({ request: context.request })
      : GET({ request: context.request });
  }

  return next();
};

import {
  isDocsLlmsTxtPublicRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
} from "@farming-labs/docs";
import type { MiddlewareHandler } from "astro";
import config from "./lib/docs.config";
import { GET, MCP } from "./lib/docs.server";

const docsEntry = config.entry ?? "docs";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const method = context.request.method.toUpperCase();

  if (isDocsMcpRequest(context.url)) {
    if (method === "POST") return MCP.POST({ request: context.request });
    if (method === "DELETE") return MCP.DELETE({ request: context.request });
    if (method === "GET" || method === "HEAD") return MCP.GET({ request: context.request });
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST, DELETE" },
    });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsLlmsTxtPublicRequest(context.url, config.llmsTxt)
  ) {
    const nativeResponse = await next();
    if (nativeResponse.status !== 404) return nativeResponse;
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, context.url, context.request, {
      sitemap: config.sitemap,
      llms: config.llmsTxt,
    })
  ) {
    return GET({ request: context.request });
  }

  return next();
};

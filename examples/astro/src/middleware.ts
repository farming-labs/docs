import { isDocsMcpRequest, isDocsPublicGetRequest } from "@farming-labs/docs";
import type { MiddlewareHandler } from "astro";
import config from "./lib/docs.config";
import { GET, MCP } from "./lib/docs.server";

const docsEntry = config.entry ?? "docs";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const method = context.request.method.toUpperCase();

  if (isDocsMcpRequest(context.url)) {
    if (method === "POST") return MCP.POST({ request: context.request });
    if (method === "DELETE") return MCP.DELETE({ request: context.request });
    return MCP.GET({ request: context.request });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, context.url, context.request)
  ) {
    return GET({ request: context.request });
  }

  return next();
};

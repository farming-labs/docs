import { isDocsMcpRequest, isDocsPublicGetRequest } from "@farming-labs/docs";
import config from "$lib/docs.config";
import { GET, MCP } from "$lib/docs.server.js";

const docsEntry = config.entry ?? "docs";

export async function handle({ event, resolve }) {
  const method = event.request.method.toUpperCase();

  if (isDocsMcpRequest(event.url)) {
    if (method === "POST") return MCP.POST({ request: event.request });
    if (method === "DELETE") return MCP.DELETE({ request: event.request });
    return MCP.GET({ request: event.request });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, event.url, event.request)
  ) {
    return GET({ url: event.url, request: event.request });
  }

  return resolve(event);
}

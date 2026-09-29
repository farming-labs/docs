import {
  buildApiReferenceHtmlDocumentAsync,
  createApiReferenceOperationMarkdownResponse,
  resolveApiReferenceConfig,
  resolveApiReferenceVersionFromPathname,
} from "@farming-labs/docs/server";
import { resolveDocsMetadataBaseUrl, type DocsConfig } from "@farming-labs/docs";

export function createFarmjsApiReference(config: DocsConfig & Record<string, any>) {
  return async (event?: { request?: Request; url?: URL } | Request) => {
    const apiReference = resolveApiReferenceConfig(config.apiReference);
    if (!apiReference.enabled) {
      return new Response("Not Found", { status: 404 });
    }

    const rootDir = typeof config.rootDir === "string" ? config.rootDir : process.cwd();
    const request = event instanceof Request ? event : event?.request;
    const requestUrl =
      event instanceof Request
        ? new URL(event.url)
        : (event?.url ?? (request ? new URL(request.url) : undefined));
    if (request && requestUrl) {
      const markdownResponse = await createApiReferenceOperationMarkdownResponse(config, {
        request,
        framework: "farmjs",
        rootDir,
        baseUrl: requestUrl.origin,
        origin: resolveDocsMetadataBaseUrl(config) || requestUrl.origin,
        sitemap: config.sitemap,
        okf: config.agent?.okf,
      });
      if (markdownResponse) return markdownResponse;
    }
    const version = requestUrl
      ? resolveApiReferenceVersionFromPathname(config.apiReference, requestUrl.pathname)
      : undefined;
    const html = await buildApiReferenceHtmlDocumentAsync(config, {
      framework: "farmjs",
      rootDir,
      baseUrl: requestUrl?.origin,
      version: version?.id,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  };
}

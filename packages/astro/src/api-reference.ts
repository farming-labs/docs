import {
  buildApiReferenceHtmlDocumentAsync,
  createApiReferenceOperationMarkdownResponse,
  resolveApiReferenceConfig,
  resolveApiReferenceVersionFromPathname,
} from "@farming-labs/docs/server";
import { resolveDocsMetadataBaseUrl, type DocsConfig } from "@farming-labs/docs";

export function createAstroApiReference(config: DocsConfig & Record<string, any>) {
  return async (context?: { url?: URL; request?: Request }) => {
    const apiReference = resolveApiReferenceConfig(config.apiReference);
    if (!apiReference.enabled) {
      return new Response("Not Found", { status: 404 });
    }

    const rootDir = typeof config.rootDir === "string" ? config.rootDir : process.cwd();
    const requestUrl =
      context?.url ?? (context?.request ? new URL(context.request.url) : undefined);
    if (context?.request && requestUrl) {
      const markdownResponse = await createApiReferenceOperationMarkdownResponse(config, {
        request: context.request,
        framework: "astro",
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
      framework: "astro",
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

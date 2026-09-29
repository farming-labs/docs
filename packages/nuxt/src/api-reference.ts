import {
  buildApiReferenceHtmlDocumentAsync,
  resolveApiReferenceConfig,
  resolveApiReferenceVersionFromPathname,
} from "@farming-labs/docs/server";
import type { DocsConfig } from "@farming-labs/docs";
import { eventHandler, getRequestURL } from "h3";

export function defineApiReferenceHandler(config: DocsConfig & Record<string, any>) {
  return eventHandler(async (event) => {
    const apiReference = resolveApiReferenceConfig(config.apiReference);
    if (!apiReference.enabled) {
      return new Response("Not Found", { status: 404 });
    }

    const rootDir = typeof config.rootDir === "string" ? config.rootDir : process.cwd();
    const requestUrl = getRequestURL(event);
    const version = resolveApiReferenceVersionFromPathname(
      config.apiReference,
      requestUrl.pathname,
    );
    const html = await buildApiReferenceHtmlDocumentAsync(config, {
      framework: "nuxt",
      rootDir,
      baseUrl: requestUrl.origin,
      version: version?.id,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  });
}

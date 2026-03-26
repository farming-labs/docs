import {
  buildApiReferenceHtmlDocumentAsync,
  getUnsupportedApiReferenceRendererMessage,
  resolveApiReferenceConfig,
  supportsApiReferenceRenderer,
} from "@farming-labs/docs/server";
import type { DocsConfig } from "@farming-labs/docs";

export function createTanstackApiReference(config: DocsConfig & Record<string, any>) {
  return async () => {
    const apiReference = resolveApiReferenceConfig(config.apiReference);
    if (!apiReference.enabled) {
      return new Response("Not Found", { status: 404 });
    }

    if (!supportsApiReferenceRenderer("tanstack-start", apiReference.renderer)) {
      return new Response(
        getUnsupportedApiReferenceRendererMessage("tanstack-start", apiReference.renderer),
        { status: 501 },
      );
    }

    const rootDir = typeof config.rootDir === "string" ? config.rootDir : process.cwd();
    const html = await buildApiReferenceHtmlDocumentAsync(config, {
      framework: "tanstack-start",
      rootDir,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  };
}

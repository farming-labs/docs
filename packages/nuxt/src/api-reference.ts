import {
  buildApiReferenceHtmlDocumentAsync,
  resolveApiReferenceConfig,
} from "@farming-labs/docs/server";
import type { DocsConfig } from "@farming-labs/docs";
import { eventHandler } from "h3";

export function defineApiReferenceHandler(config: DocsConfig & Record<string, any>) {
  return eventHandler(async () => {
    const apiReference = resolveApiReferenceConfig(config.apiReference);
    if (!apiReference.enabled) {
      return new Response("Not Found", { status: 404 });
    }

    const rootDir = typeof config.rootDir === "string" ? config.rootDir : process.cwd();
    const html = await buildApiReferenceHtmlDocumentAsync(config, {
      framework: "nuxt",
      rootDir,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  });
}

import {
  buildApiReferenceOpenApiDocument,
  buildApiReferencePageTitle,
  buildApiReferenceScalarCss,
  resolveApiReferenceConfig,
} from "@farming-labs/docs/server";
import type { DocsConfig } from "@farming-labs/docs";
import { getHtmlDocument } from "@scalar/core/libs/html-rendering";

export function createTanstackApiReference(config: DocsConfig & Record<string, any>) {
  return async () => {
    const apiReference = resolveApiReferenceConfig(config.apiReference);
    if (!apiReference.enabled) {
      return new Response("Not Found", { status: 404 });
    }

    const rootDir = typeof config.rootDir === "string" ? config.rootDir : process.cwd();
    const html = getHtmlDocument({
      pageTitle: buildApiReferencePageTitle(config, "API Reference"),
      title: "API Reference",
      content: () =>
        buildApiReferenceOpenApiDocument(config, {
          framework: "tanstack-start",
          rootDir,
        }),
      theme: "deepSpace",
      layout: "modern",
      customCss: buildApiReferenceScalarCss(config),
      pathRouting: {
        basePath: `/${apiReference.path}`,
      },
      showSidebar: true,
      defaultOpenFirstTag: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      operationTitleSource: "summary",
      defaultHttpClient: {
        targetKey: "shell",
        clientKey: "curl",
      },
      documentDownloadType: "json",
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  };
}

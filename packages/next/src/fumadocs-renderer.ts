import type { ApiReferenceRendererConfig } from "@farming-labs/docs";
import type { OpenAPIOptions } from "fumadocs-openapi/server";
import type { CreateOpenAPIPageOptions } from "fumadocs-openapi/ui";

/** Options supported by the bundled Fumadocs OpenAPI renderer. */
export type FumadocsApiReferenceRendererOptions = CreateOpenAPIPageOptions &
  Pick<OpenAPIOptions, "disableCache" | "proxyUrl">;

/**
 * Configure the bundled Fumadocs OpenAPI renderer with fully typed upstream options.
 */
export function fumadocsRenderer(
  options: FumadocsApiReferenceRendererOptions = {},
): ApiReferenceRendererConfig {
  return {
    name: "fumadocs",
    options: { ...options } as Readonly<Record<string, unknown>>,
  };
}

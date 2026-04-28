import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { loader } from "fumadocs-core/source";
import { createOpenAPI, openapiPlugin, openapiSource } from "fumadocs-openapi/server";

const SPEC_PATH = path.join(process.cwd(), "openapi", "surge.yml");

type OpenApiPage = ReturnType<
  Awaited<ReturnType<typeof getOpenApiRuntime>>["source"]["getPages"]
>[number];

export const getOpenApiRuntime = cache(async () => {
  const raw = await readFile(SPEC_PATH, "utf8");
  const document = yaml.load(raw) as Record<string, unknown>;
  const server = createOpenAPI({
    input: async () => ({
      main: document,
    }),
  });

  const source = loader(await openapiSource(server, { per: "operation" }), {
    baseUrl: "/api-reference",
    plugins: [openapiPlugin()],
  });

  return {
    document,
    server,
    source,
  };
});

export async function matchOpenApiPage(operation: string): Promise<OpenApiPage | null> {
  const { source } = await getOpenApiRuntime();
  const pages = source.getPages();
  const normalized = operation.trim();

  if (normalized.toLowerCase().startsWith("webhook ")) {
    const webhookName = normalized.slice("webhook ".length).trim();
    return (
      pages.find((page) => {
        const openapiMeta = page.data?._openapi as { webhook?: boolean } | undefined;
        return openapiMeta?.webhook && page.url.split("/").pop() === webhookName;
      }) ?? null
    );
  }

  const match = normalized.match(/^([A-Z]+)\s+(.+)$/);
  if (!match) return null;

  const method = match[1].toLowerCase();
  const routePath = match[2].trim();

  return (
    pages.find((page) => {
      const apiProps = page.data?.getAPIPageProps?.() as
        | {
            operations?: Array<{ method?: string; path?: string }>;
          }
        | undefined;
      const operationMeta = apiProps?.operations?.[0];
      return operationMeta?.method === method && operationMeta?.path === routePath;
    }) ?? null
  );
}

import { createDocsServer } from "@farming-labs/svelte/server";
import { env } from "$env/dynamic/private";
import config from "./docs.config";

// preload for production
const contentFiles = import.meta.glob("/docs/**/*.{md,mdx,svx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, POST } = createDocsServer({
  ...config,
  ai: { apiKey: env.OPENAI_API_KEY, ...config.ai },
  _preloadedContent: contentFiles,
});

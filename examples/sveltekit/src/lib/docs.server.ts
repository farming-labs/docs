import { createDocsServer } from "@farming-labs/svelte/server";
import { env } from "$env/dynamic/private";
import config from "@/docs.config";

export const { load, GET, POST } = createDocsServer({
  ...config,
  ai: { ...config.ai, apiKey: env.OPENAI_API_KEY },
});

import { createDocsServer } from "@farming-labs/svelte/server";
import { env } from "$env/dynamic/private";
import config from "$lib/docs.config.js";

export const { load, GET, POST } = createDocsServer({
  ...config,
  ai: { apiKey: env.OPENAI_API_KEY, ...config.ai },
});

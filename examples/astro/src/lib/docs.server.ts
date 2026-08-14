import { createDocsServer } from "@farming-labs/astro/server";
import config from "./docs.config";

const contentFiles = import.meta.glob(
  [
    "/docs/**/*.{md,mdx}",
    "/AGENTS.md",
    "/AGENT.md",
    "/skill.md",
    "/.farming-labs/sitemap-manifest.json",
  ],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;

export const { load, GET, HEAD, POST, MCP } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});

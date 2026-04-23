import { createDocsServer } from "@farming-labs/astro/server";
import config from "./docs.config";

const contentFiles = import.meta.glob(["/docs/**/*.{md,mdx}", "/skill.md"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, POST, MCP } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});

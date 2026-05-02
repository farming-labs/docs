import docsConfig from "@/docs.config";
import { createDocsAPI } from "@farming-labs/next/api";

export const { GET, POST } = createDocsAPI({
  entry: docsConfig.entry,
  contentDir: docsConfig.contentDir,
  i18n: docsConfig.i18n,
  changelog: docsConfig.changelog,
  feedback: docsConfig.feedback,
  mcp: docsConfig.mcp,
  search: docsConfig.search,
  analytics: docsConfig.analytics,
  ai: docsConfig.ai,
});

export const revalidate = false;

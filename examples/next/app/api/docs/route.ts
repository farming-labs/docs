import docsConfig from "@/docs.config";
import { createDocsAPI } from "@farming-labs/next/api";

export const { GET, POST } = createDocsAPI({
  entry: docsConfig.entry,
  contentDir: docsConfig.contentDir,
  i18n: docsConfig.i18n,
  search: docsConfig.search,
  ai: docsConfig.ai,
});

export const revalidate = false;

import docsConfig from "@/docs.config";
import { createDocsAPI } from "@farming-labs/next/api";
import { createDocsCloudServer } from "@farming-labs/docs/cloud/server";

const docsCloud = createDocsCloudServer({
  config: docsConfig,
});

export const { GET, POST } = createDocsAPI(docsConfig, docsCloud);

export const revalidate = false;

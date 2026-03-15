import { createDocsServer } from "@farming-labs/tanstack-start/server";
import docsConfig from "../../docs.config";

export const docsServer = createDocsServer({
  ...docsConfig,
  rootDir: process.cwd(),
});

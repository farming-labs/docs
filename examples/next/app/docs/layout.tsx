import docsConfig from "@/docs.config";
import { createDocsLayout, createDocsMetadata } from "@farming-labs/fumadocs";
export const metadata = createDocsMetadata(docsConfig);
export default createDocsLayout(docsConfig);

import docsConfig from "@/docs.config";
import DocsClientCallbacks from "@/docs-client-callbacks";
import { createDocsLayout, createDocsMetadata } from "@farming-labs/theme";
import { withNextApiReferenceBanner } from "./api-reference.js";

export const metadata = createDocsMetadata(docsConfig);

const DocsLayout = createDocsLayout(withNextApiReferenceBanner(docsConfig));

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsClientCallbacks />
      <DocsLayout>{children}</DocsLayout>
    </>
  );
}

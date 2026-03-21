import { createDocsLayout, createDocsMetadata } from "@farming-labs/theme";
import type { DocsConfig } from "@farming-labs/docs";
import { withNextApiReferenceBanner } from "./api-reference.js";
import DocsClientCallbacks from "./client-callbacks.js";

export function createNextDocsMetadata(config: DocsConfig) {
  return createDocsMetadata(config);
}

export function createNextDocsLayout(config: DocsConfig) {
  const DocsLayout = createDocsLayout(withNextApiReferenceBanner(config));

  return function NextDocsLayout({ children }: { children: React.ReactNode }) {
    return (
      <>
        <DocsClientCallbacks />
        <DocsLayout>{children}</DocsLayout>
      </>
    );
  };
}

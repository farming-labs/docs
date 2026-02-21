import docsConfig from "@/docs.config";
import { createDocsLayout, createDocsMetadata } from "@farming-labs/theme";
import { Suspense } from "react";
import { ThemeCustomizer } from "@/components/theme-customizer";

export const metadata = createDocsMetadata(docsConfig);

const DocsLayout = createDocsLayout(docsConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsLayout>{children}</DocsLayout>
      <Suspense>
        <ThemeCustomizer />
      </Suspense>
    </>
  );
}

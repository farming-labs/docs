import { createNextDocsLayout, createNextDocsMetadata } from "@farming-labs/next/layout";
import { apiReferenceConfig } from "@/lib/section-config";

export const metadata = createNextDocsMetadata(apiReferenceConfig);

const ApiReferenceLayout = createNextDocsLayout(apiReferenceConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ApiReferenceLayout>{children}</ApiReferenceLayout>;
}

import { createNextDocsLayout, createNextDocsMetadata } from "@farming-labs/next/layout";
import { guidesConfig } from "@/lib/section-config";

export const metadata = createNextDocsMetadata(guidesConfig);

const GuidesLayout = createNextDocsLayout(guidesConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuidesLayout>{children}</GuidesLayout>;
}

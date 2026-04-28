import { createNextDocsLayout, createNextDocsMetadata } from "@farming-labs/next/layout";
import { uiConfig } from "@/lib/section-config";

export const metadata = createNextDocsMetadata(uiConfig);

const UiLayout = createNextDocsLayout(uiConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UiLayout>{children}</UiLayout>;
}

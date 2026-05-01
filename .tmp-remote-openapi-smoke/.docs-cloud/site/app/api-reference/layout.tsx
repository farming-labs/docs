import docsConfig from "@/docs.config";
import { createNextApiReferenceLayout } from "@farming-labs/next/api-reference";

const ApiReferenceLayout = createNextApiReferenceLayout(docsConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ApiReferenceLayout>{children}</ApiReferenceLayout>;
}

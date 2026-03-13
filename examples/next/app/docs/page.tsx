import EnPage from "./en/page.mdx";
import FrPage from "./fr/page.mdx";
import { resolveLocaleDocPage } from "../components/locale-doc-page";

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] | undefined }>;
};

export default async function DocsIndexPage({ searchParams }: PageProps) {
  const Page = await resolveLocaleDocPage(searchParams, {
    en: EnPage,
    fr: FrPage,
  });

  return <Page />;
}

import EnPage from "../en/getting-started/page.mdx";
import FrPage from "../fr/getting-started/page.mdx";
import { resolveLocaleDocPage } from "../../components/locale-doc-page";

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] | undefined }>;
};

export default async function GettingStartedPage({ searchParams }: PageProps) {
  const Page = await resolveLocaleDocPage(searchParams, {
    en: EnPage,
    fr: FrPage,
  });

  return <Page />;
}

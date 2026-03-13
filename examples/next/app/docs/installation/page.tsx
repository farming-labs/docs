import EnPage from "../en/installation/page.mdx";
import FrPage from "../fr/installation/page.mdx";
import { resolveLocaleDocPage } from "../../components/locale-doc-page";

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] | undefined }>;
};

export default async function InstallationPage({ searchParams }: PageProps) {
  const Page = await resolveLocaleDocPage(searchParams, {
    en: EnPage,
    fr: FrPage,
  });

  return <Page />;
}

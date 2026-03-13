import type { ComponentType } from "react";

type SearchParams = Promise<{ lang?: string | string[] | undefined }> | undefined;

function normalizeLang(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function resolveLocaleDocPage<T extends ComponentType>(
  searchParams: SearchParams,
  pages: Record<string, T>,
  fallbackLocale = "en",
) {
  const params = (await searchParams) ?? {};
  const locale = normalizeLang(params.lang) ?? fallbackLocale;

  return pages[locale] ?? pages[fallbackLocale];
}

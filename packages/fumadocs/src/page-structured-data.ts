import { buildDocsPageStructuredData } from "@farming-labs/docs/browser";
import type { DocsPageStructuredDataInput } from "@farming-labs/docs";

type Page = Pick<
  DocsPageStructuredDataInput,
  "title" | "description" | "url" | "dateModified" | "breadcrumbs"
> & { mainEntity?: unknown };

export interface DocsStructuredDataPages {
  baseUrl?: string;
  entry?: string;
  pages: Record<string, Page>;
}

/** Retain only fields that contribute to the public JSON-LD, never raw agent frontmatter. */
export function compactPageStructuredData(input: DocsPageStructuredDataInput): Page {
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    dateModified: input.dateModified,
    breadcrumbs: input.breadcrumbs,
    mainEntity: input.agent ? buildDocsPageStructuredData(input).mainEntity : undefined,
  };
}

/** Expand only the active page, during both server rendering and client navigation. */
export function renderPageStructuredData(
  data: DocsStructuredDataPages | undefined,
  pathname: string,
): string | undefined {
  const page = data?.pages[pathname];
  if (!page) return undefined;
  const { mainEntity, ...input } = page;
  const value = buildDocsPageStructuredData({
    ...input,
    baseUrl: data?.baseUrl,
    entry: data?.entry,
  });
  if (mainEntity !== undefined) value.mainEntity = mainEntity;
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

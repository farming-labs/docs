import type { DocsStructuredDataPages } from "./page-structured-data.js";

export interface DocsPageMaps {
  lastModifiedMap: Record<string, string>;
  descriptionMap: Record<string, string>;
  generatedTitleMap: Record<string, string>;
  readingTimeMap: Record<string, number>;
  structuredDataPages: DocsStructuredDataPages;
}

/** Internal transport shared by the layout and its client component. */
export interface DocsPageMetadata {
  json: string;
}

type Page = DocsStructuredDataPages["pages"][string];
type Row = [
  title: string,
  description: string | null,
  dateModified: number | null,
  lastModified: number | null,
  generatedTitle: string | 1 | null,
  readingTime: number | null,
  visibleDescription: string | 1 | null,
  extra?: { url?: string; breadcrumbs?: Page["breadcrumbs"]; mainEntity?: unknown },
];

interface PackedPages {
  baseUrl?: string;
  entry?: string;
  dates: string[];
  pages: Record<string, Row>;
}

/**
 * Pack once per content snapshot. RSC can send one string instead of traversing
 * several overlapping maps for every prerendered page. Keep all routes so a
 * persistent layout still has metadata after client navigation.
 */
export function serializePageMetadata(maps: DocsPageMaps): DocsPageMetadata {
  const dates: string[] = [];
  const dateIndexes = new Map<string, number>();
  const dateIndex = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const cached = dateIndexes.get(value);
    if (cached !== undefined) return cached;
    const index = dates.push(value) - 1;
    dateIndexes.set(value, index);
    return index;
  };
  const pages: Record<string, Row> = {};
  for (const [route, page] of Object.entries(maps.structuredDataPages.pages)) {
    const generatedTitle = maps.generatedTitleMap[route];
    const description = maps.descriptionMap[route];
    const row: Row = [
      page.title,
      page.description ?? null,
      dateIndex(page.dateModified),
      dateIndex(maps.lastModifiedMap[route]),
      generatedTitle === undefined ? null : generatedTitle === page.title ? 1 : generatedTitle,
      maps.readingTimeMap[route] ?? null,
      description === undefined ? null : description === page.description ? 1 : description,
    ];
    if (page.url !== route || page.breadcrumbs !== undefined || page.mainEntity !== undefined) {
      row.push({
        url: page.url !== route ? page.url : undefined,
        breadcrumbs: page.breadcrumbs,
        mainEntity: page.mainEntity,
      });
    }
    pages[route] = row;
  }
  return {
    json: JSON.stringify({
      baseUrl: maps.structuredDataPages.baseUrl,
      entry: maps.structuredDataPages.entry,
      dates,
      pages,
    } satisfies PackedPages),
  };
}

// The snapshot owns the parsed representation. Weak keys avoid retaining old
// layouts/locales; comparing the string also handles replacement during HMR.
const decoded = new WeakMap<DocsPageMetadata, { json: string; pages: PackedPages }>();

export function resolvePageMetadata(data: DocsPageMetadata | undefined, route: string) {
  if (!data) return undefined;
  let cached = decoded.get(data);
  if (!cached || cached.json !== data.json) {
    cached = { json: data.json, pages: JSON.parse(data.json) as PackedPages };
    decoded.set(data, cached);
  }
  const packed = cached.pages;
  const row = Object.hasOwn(packed.pages, route) ? packed.pages[route] : undefined;
  if (!row) return undefined;
  const [title, description, modified, lastModified, generatedTitle, readingTime, visible, extra] =
    row;
  return {
    generatedTitle: generatedTitle === 1 ? title : (generatedTitle ?? undefined),
    description: visible === 1 ? (description ?? undefined) : (visible ?? undefined),
    lastModified: lastModified === null ? undefined : packed.dates[lastModified],
    readingTime: readingTime ?? undefined,
    structuredDataPages: {
      baseUrl: packed.baseUrl,
      entry: packed.entry,
      pages: {
        [route]: {
          title,
          description: description ?? undefined,
          dateModified: modified === null ? undefined : packed.dates[modified],
          url: extra?.url ?? route,
          breadcrumbs: extra?.breadcrumbs,
          mainEntity: extra?.mainEntity,
        },
      },
    } satisfies DocsStructuredDataPages,
  };
}

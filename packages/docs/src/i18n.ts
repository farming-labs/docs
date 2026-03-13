import type { DocsI18nConfig } from "./types.js";

export interface ResolvedDocsI18n {
  locales: string[];
  defaultLocale: string;
}

export interface DocsPathMatch {
  /** Slug path relative to the docs root (no leading slash). */
  slug: string;
  /** Entry path used for URLs (no locale segment). */
  entryPath: string;
}

function normalizeSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function splitSegments(value: string): string[] {
  const cleaned = normalizeSegment(value);
  return cleaned ? cleaned.split("/").filter(Boolean) : [];
}

export function resolveDocsI18n(config?: DocsI18nConfig | null): ResolvedDocsI18n | null {
  if (!config || !Array.isArray(config.locales)) return null;
  const locales = Array.from(
    new Set(config.locales.map((l) => l.trim()).filter(Boolean)),
  );
  if (locales.length === 0) return null;

  const defaultLocale =
    config.defaultLocale && locales.includes(config.defaultLocale)
      ? config.defaultLocale
      : locales[0];

  return {
    locales,
    defaultLocale,
  };
}

export function resolveDocsLocale(
  searchParams: URLSearchParams,
  i18n?: ResolvedDocsI18n | null,
): string | undefined {
  if (!i18n) return undefined;
  const raw = searchParams.get("lang") ?? searchParams.get("locale");
  if (!raw) return undefined;
  if (i18n.locales.includes(raw)) return raw;
  return i18n.defaultLocale;
}

export function resolveDocsPath(pathname: string, entry: string): DocsPathMatch {
  const entryBase = normalizeSegment(entry || "docs") || "docs";
  const entryParts = splitSegments(entryBase);
  const pathParts = splitSegments(pathname);

  let rest = pathParts;
  if (entryParts.length > 0) {
    const candidate = pathParts.slice(0, entryParts.length).join("/");
    if (candidate === entryParts.join("/")) {
      rest = pathParts.slice(entryParts.length);
    }
  }

  return {
    slug: rest.join("/"),
    entryPath: entryBase,
  };
}

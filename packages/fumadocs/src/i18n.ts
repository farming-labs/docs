export function withLangInUrl(url: string, locale?: string | null): string {
  if (!url || url.startsWith("#")) return url;

  const isProtocolRelative = url.startsWith("//");
  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) || isProtocolRelative;
  const parsed = new URL(url, "https://farming-labs.local");

  if (locale) parsed.searchParams.set("lang", locale);
  else parsed.searchParams.delete("lang");

  if (isAbsolute) {
    if (isProtocolRelative) {
      return `//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function resolveClientLocale(
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  fallback?: string,
): string | undefined {
  const value = searchParams.get("lang") ?? searchParams.get("locale");
  return value || fallback;
}

interface ReadonlyURLSearchParams {
  get(name: string): string | null;
}

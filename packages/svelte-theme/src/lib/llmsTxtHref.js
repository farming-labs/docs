/**
 * The llms.txt link for a docs page. It names the page's docs root, because the link opens
 * without a Referer and the API route would otherwise answer for the first root.
 */
export function llmsTxtHref(format, entry, locale) {
  const params = new URLSearchParams({ format, root: entry });
  if (locale) params.set("lang", locale);
  return `/api/docs?${params}`;
}

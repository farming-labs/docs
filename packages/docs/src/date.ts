const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Formats docs timestamps without allowing the deployment timezone to change the calendar day. */
export function formatDocsLastModifiedDate(value: string | Date): string | undefined {
  const normalized =
    typeof value === "string" && DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00.000Z` : value;
  const date = normalized instanceof Date ? normalized : new Date(normalized);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

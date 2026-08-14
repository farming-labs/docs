import type { ReadingTimeConfig, ReadingTimeFormat } from "@farming-labs/docs";

export interface ResolvedReadingTimeOptions {
  enabled: boolean;
  wordsPerMinute?: number;
  format: ReadingTimeFormat;
  includeCode: boolean;
}

export function resolveReadingTimeOptions(
  readingTime: boolean | ReadingTimeConfig | null | undefined,
): ResolvedReadingTimeOptions {
  if (readingTime === true) return { enabled: true, format: "long", includeCode: false };
  if (readingTime === false || readingTime === undefined || readingTime === null) {
    return { enabled: false, format: "long", includeCode: false };
  }
  if (typeof readingTime !== "object") {
    return { enabled: false, format: "long", includeCode: false };
  }

  return {
    enabled: readingTime.enabled !== false,
    wordsPerMinute:
      typeof readingTime.wordsPerMinute === "number" && Number.isFinite(readingTime.wordsPerMinute)
        ? readingTime.wordsPerMinute
        : undefined,
    format: readingTime.format === "short" ? "short" : "long",
    includeCode: readingTime.includeCode === true,
  };
}

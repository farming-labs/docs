import matter from "gray-matter";
import type { PageFrontmatter, ReadingTimeConfig, ReadingTimeFormat } from "@farming-labs/docs";

export interface ResolvedReadingTimeOptions {
  enabled: boolean;
  wordsPerMinute?: number;
  format: ReadingTimeFormat;
  includeCode: boolean;
}

export interface ReadingTimeEstimateOptions {
  includeCode?: boolean;
}

function hasExplicitReadingTime(frontmatter: Partial<PageFrontmatter> | undefined): boolean {
  return Object.prototype.hasOwnProperty.call(frontmatter ?? {}, "readingTime");
}

function normalizeWordsPerMinute(wordsPerMinute: number | undefined): number {
  if (typeof wordsPerMinute !== "number" || !Number.isFinite(wordsPerMinute)) return 220;
  return Math.max(1, Math.floor(wordsPerMinute));
}

function stripNonReadingContent(content: string, options?: ReadingTimeEstimateOptions): string {
  const includeCode = options?.includeCode === true;
  const markdown = includeCode
    ? content.replace(/^(`{3,}|~{3,})[^\n]*$/gm, " ").replace(/`([^`\n]+)`/g, " $1 ")
    : content
        .replace(/(`{3,})[^\n]*\n[\s\S]*?\1/g, " ")
        .replace(/(~{3,})[^\n]*\n[\s\S]*?\1/g, " ")
        .replace(/`[^`\n]+`/g, " ");

  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(includeCode ? /[{}]/g : /\{[^{}]*\}/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_~|]/g, " ");
}

export function estimateReadingTimeMinutes(
  content: string,
  wordsPerMinute?: number,
  options?: ReadingTimeEstimateOptions,
): number {
  const cleaned = stripNonReadingContent(content, options);
  const wordCount = cleaned.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length ?? 0;

  return Math.max(1, Math.ceil(wordCount / normalizeWordsPerMinute(wordsPerMinute)));
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

export function resolveReadingTimeFromContent(
  frontmatter: Partial<PageFrontmatter> | undefined,
  content: string,
  wordsPerMinute?: number,
  options?: ReadingTimeEstimateOptions,
): number | null {
  const pageData = frontmatter ?? {};

  if (pageData.readingTime === false) return null;

  if (typeof pageData.readingTime === "number" && Number.isFinite(pageData.readingTime)) {
    return Math.max(1, Math.ceil(pageData.readingTime));
  }

  return estimateReadingTimeMinutes(content, wordsPerMinute, options);
}

export function resolvePageReadingTime(
  frontmatter: Partial<PageFrontmatter> | undefined,
  content: string,
  options?: {
    enabledByDefault?: boolean;
    wordsPerMinute?: number;
    includeCode?: boolean;
  },
): number | null | undefined {
  const enabledByDefault = options?.enabledByDefault ?? false;

  if (!enabledByDefault && !hasExplicitReadingTime(frontmatter)) {
    return undefined;
  }

  return resolveReadingTimeFromContent(frontmatter, content, options?.wordsPerMinute, {
    includeCode: options?.includeCode,
  });
}

export function resolveReadingTimeFromSource(
  source: string,
  wordsPerMinute?: number,
  options?: ReadingTimeEstimateOptions,
): number | null {
  const { data, content } = matter(source);
  return resolveReadingTimeFromContent(data as PageFrontmatter, content, wordsPerMinute, options);
}

import matter from "gray-matter";
import type { PageFrontmatter, ReadingTimeConfig } from "./types.js";

export interface ResolvedReadingTimeOptions {
  enabled: boolean;
  wordsPerMinute?: number;
}

function normalizeWordsPerMinute(wordsPerMinute: number | undefined): number {
  if (typeof wordsPerMinute !== "number" || !Number.isFinite(wordsPerMinute)) return 220;
  return Math.max(1, Math.floor(wordsPerMinute));
}

function stripNonReadingContent(content: string): string {
  return content
    .replace(/(`{3,})[^\n]*\n[\s\S]*?\1/g, " ")
    .replace(/(~{3,})[^\n]*\n[\s\S]*?\1/g, " ")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_~|]/g, " ");
}

export function estimateReadingTimeMinutes(content: string, wordsPerMinute?: number): number {
  const cleaned = stripNonReadingContent(content);
  const wordCount = cleaned.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length ?? 0;

  return Math.max(1, Math.ceil(wordCount / normalizeWordsPerMinute(wordsPerMinute)));
}

export function resolveReadingTimeOptions(
  readingTime: boolean | ReadingTimeConfig | null | undefined,
): ResolvedReadingTimeOptions {
  if (readingTime === true) return { enabled: true };
  if (readingTime === false || readingTime === undefined || readingTime === null) {
    return { enabled: false };
  }
  if (typeof readingTime !== "object") return { enabled: false };

  return {
    enabled: readingTime.enabled !== false,
    wordsPerMinute:
      typeof readingTime.wordsPerMinute === "number" && Number.isFinite(readingTime.wordsPerMinute)
        ? readingTime.wordsPerMinute
        : undefined,
  };
}

export function resolveReadingTimeFromContent(
  frontmatter: Partial<PageFrontmatter> | undefined,
  content: string,
  wordsPerMinute?: number,
): number | null {
  const pageData = frontmatter ?? {};

  if (pageData.readingTime === false) return null;

  if (typeof pageData.readingTime === "number" && Number.isFinite(pageData.readingTime)) {
    return Math.max(1, Math.ceil(pageData.readingTime));
  }

  return estimateReadingTimeMinutes(content, wordsPerMinute);
}

export function resolveReadingTimeFromSource(
  source: string,
  wordsPerMinute?: number,
): number | null {
  const { data, content } = matter(source);
  return resolveReadingTimeFromContent(data as PageFrontmatter, content, wordsPerMinute);
}

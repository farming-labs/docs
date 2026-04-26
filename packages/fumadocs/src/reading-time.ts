import matter from "gray-matter";
import type { PageFrontmatter } from "@farming-labs/docs";

function normalizeWordsPerMinute(wordsPerMinute: number | undefined): number {
  if (typeof wordsPerMinute !== "number" || !Number.isFinite(wordsPerMinute)) return 220;
  return Math.max(1, Math.floor(wordsPerMinute));
}

function stripNonReadingContent(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
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

export function resolveReadingTimeFromSource(
  source: string,
  wordsPerMinute?: number,
): number | null {
  const { data, content } = matter(source);
  const pageData = data as PageFrontmatter;

  if (pageData.readingTime === false) return null;

  if (typeof pageData.readingTime === "number" && Number.isFinite(pageData.readingTime)) {
    return Math.max(1, Math.ceil(pageData.readingTime));
  }

  return estimateReadingTimeMinutes(content, wordsPerMinute);
}

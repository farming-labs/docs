import type { ResolvedDocsRelatedLink } from "./types.js";

interface ParsedRelatedInput {
  href: string;
}

export function normalizeDocsRelated(value: unknown): ResolvedDocsRelatedLink[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const links: ResolvedDocsRelatedLink[] = [];

  for (const item of value) {
    const parsed = parseRelatedInput(item);
    if (!parsed) continue;

    const lookupPath = normalizeRelatedLookupPath(parsed.href);
    const dedupeKey = lookupPath ?? parsed.href;

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    links.push({ href: parsed.href });
  }

  return links;
}

export function renderDocsRelatedMarkdownLines(
  related: ResolvedDocsRelatedLink[] | undefined,
): string[] {
  if (!related?.length) return [];

  return [`Related: ${related.map((link) => normalizeInlineText(link.href)).join(", ")}`];
}

function parseRelatedInput(value: unknown): ParsedRelatedInput | null {
  if (typeof value === "string") {
    const href = cleanString(value);
    return href ? { href } : null;
  }
  return null;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeRelatedLookupPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  try {
    pathname = new URL(trimmed, "https://docs.local").pathname;
  } catch {
    pathname = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  }

  pathname = pathname.replace(/\/+/g, "/").replace(/\.md$/i, "");
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname !== "/") pathname = pathname.replace(/\/+$/, "");
  return pathname;
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

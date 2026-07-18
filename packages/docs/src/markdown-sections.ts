export interface DocsMarkdownSection {
  title: string;
  anchor: string;
  level: number;
  content: string;
}

interface ParsedDocsMarkdownHeading {
  title: string;
  anchor: string;
  level: number;
  start: number;
}

interface OpenMarkdownFence {
  marker: "`" | "~";
  length: number;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

/**
 * Reduce inline Markdown in a heading to the visible label used by search and anchors.
 * This intentionally covers the common inline constructs without adding a Markdown parser
 * dependency to the runtime package.
 */
export function cleanDocsMarkdownHeadingLabel(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/!\[([^\]]*)\]\[[^\]]*\]/gu, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/giu, "$1")
    .replace(/<[^>]+>/gu, "")
    .replace(/`+([^`]*?)`+/gu, "$1")
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/gu, "$1")
    .replace(/[*_~]/gu, "")
    .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/giu, (_match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : _match;
      }
      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : _match;
      }
      return HTML_ENTITIES[entity.toLowerCase()] ?? _match;
    })
    .replace(/\s+/gu, " ")
    .trim();
}

/** Keep anchors aligned with the framework's existing ASCII heading-slug behavior. */
export function slugifyDocsMarkdownHeading(value: string): string {
  return cleanDocsMarkdownHeadingLabel(value)
    .toLowerCase()
    .replace(/[`'"‘’“”]/gu, "")
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9\s-]/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function readOpeningFence(line: string): OpenMarkdownFence | undefined {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/u);
  if (!match) return undefined;
  return { marker: match[1][0] as "`" | "~", length: match[1].length };
}

function isClosingFence(line: string, fence: OpenMarkdownFence): boolean {
  const marker = fence.marker === "`" ? "`" : "~";
  const match = line.match(new RegExp(`^ {0,3}(${marker}{${fence.length},})[\\t ]*$`, "u"));
  return Boolean(match);
}

function readAtxHeading(line: string): { title: string; level: number } | undefined {
  const match = line.match(/^ {0,3}(#{1,6})(?:[\t ]+|$)(.*)$/u);
  if (!match) return undefined;

  const rawTitle = match[2].replace(/[\t ]+#+[\t ]*$/u, "").trim();
  return {
    title: cleanDocsMarkdownHeadingLabel(rawTitle),
    level: match[1].length,
  };
}

function readSetextLevel(line: string): number | undefined {
  const match = line.match(/^ {0,3}(=+|-+)[\t ]*$/u);
  if (!match) return undefined;
  return match[1][0] === "=" ? 1 : 2;
}

function normalizeDocsSectionSelector(value: string): string {
  let selector = value.trim();
  const hashIndex = selector.lastIndexOf("#");
  if (hashIndex >= 0) selector = selector.slice(hashIndex + 1);

  try {
    selector = decodeURIComponent(selector);
  } catch {
    // Keep malformed URL fragments usable as literal selectors.
  }

  return cleanDocsMarkdownHeadingLabel(selector.replace(/^#+/u, "")).toLowerCase();
}

/**
 * Parse heading sections once for search, Ask AI hydration, and MCP tools.
 * Supports CommonMark ATX indentation, Setext headings, fenced-code exclusion,
 * visible inline labels, and stable duplicate anchors.
 */
export function parseDocsMarkdownSections(markdown: string): DocsMarkdownSection[] {
  const lines = markdown.split("\n");
  const headings: ParsedDocsMarkdownHeading[] = [];
  const headingCounts = new Map<string, number>();
  let openFence: OpenMarkdownFence | undefined;
  let setextCandidate: { index: number; value: string } | undefined;

  const pushHeading = (title: string, level: number, start: number) => {
    const baseAnchor = slugifyDocsMarkdownHeading(title) || `section-${headings.length}`;
    const seen = headingCounts.get(baseAnchor) ?? 0;
    headingCounts.set(baseAnchor, seen + 1);
    headings.push({
      title,
      anchor: seen === 0 ? baseAnchor : `${baseAnchor}-${seen}`,
      level,
      start,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (openFence) {
      if (isClosingFence(line, openFence)) openFence = undefined;
      setextCandidate = undefined;
      continue;
    }

    const openingFence = readOpeningFence(line);
    if (openingFence) {
      openFence = openingFence;
      setextCandidate = undefined;
      continue;
    }

    const setextLevel = readSetextLevel(line);
    if (setextLevel && setextCandidate?.index === index - 1) {
      const title = cleanDocsMarkdownHeadingLabel(setextCandidate.value.trim());
      if (title) pushHeading(title, setextLevel, setextCandidate.index);
      setextCandidate = undefined;
      continue;
    }

    const atxHeading = readAtxHeading(line);
    if (atxHeading) {
      pushHeading(atxHeading.title, atxHeading.level, index);
      setextCandidate = undefined;
      continue;
    }

    if (!line.trim() || /^ {4}|^\t/u.test(line)) {
      setextCandidate = undefined;
      continue;
    }

    setextCandidate = { index, value: line };
  }

  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    const end = next?.start ?? lines.length;
    return {
      title: heading.title,
      anchor: heading.anchor,
      level: heading.level,
      content: lines.slice(heading.start, end).join("\n").trim(),
    };
  });
}

export function findDocsMarkdownSection(
  markdown: string,
  requestedSection: string,
): DocsMarkdownSection | undefined {
  const selector = normalizeDocsSectionSelector(requestedSection);
  if (!selector) return undefined;

  return parseDocsMarkdownSections(markdown).find(
    (section) =>
      normalizeDocsSectionSelector(section.title) === selector || section.anchor === selector,
  );
}

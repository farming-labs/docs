import { parseDocsMarkdownSections } from "./markdown-sections.js";
import { parseEntities } from "parse-entities";

interface PreparedDocsMarkdownHeading {
  anchor: string;
  explicit: boolean;
  level: number;
  token: string;
}

export interface PreparedDocsMarkdownHeadings {
  markdown: string;
  headings: PreparedDocsMarkdownHeading[];
}

export interface RenderedDocsMarkdownHeadings {
  markdown: string;
  openingTags: DocsMarkdownHeadingOpeningTag[];
}

export interface DocsMarkdownFencedCodeBlock {
  code: string;
  fenceLength: number;
  info: string;
  marker: "`" | "~";
}

interface DocsMarkdownReferenceDefinition {
  destination: string;
  title?: string;
}

export interface DocsMarkdownHeadingOpeningTag {
  html: string;
  token: string;
}

export type DocsMarkdownReferenceDefinitions = ReadonlyMap<string, DocsMarkdownReferenceDefinition>;

const TRAILING_DOCS_MARKDOWN_HEADING_ID = /\s*\\?\[#([^\]\r\n]+)\]\s*$/;

function createDocsMarkdownTransportToken(
  source: string,
  kind: "anchor" | "inline",
  index: number,
  used: ReadonlySet<string>,
): string {
  let salt = 0;
  let token = "";
  do {
    token = `\uE100FARMINGLABS_DOCS_${kind.toUpperCase()}_${index}_${salt}\uE101`;
    salt += 1;
  } while (source.includes(token) || used.has(token));
  return token;
}

function createDocsMarkdownOpeningTagToken(
  source: string,
  index: number,
  used: ReadonlySet<string>,
): string {
  let candidate = index;
  let token = "";
  do {
    token = `%%FARMINGLABS_DOCS_HEADING_OPEN_${candidate}%%`;
    candidate += 1;
  } while (source.includes(token) || used.has(token));
  return token;
}

function escapeDocsMarkdownHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitDocsMarkdownHeadingContainerLine(line: string): {
  prefix: string;
  content: string;
} {
  let prefix = "";
  let content = line;
  while (content) {
    const container = content.match(/^(?: {0,3}>[\t ]?| {0,3}(?:[-+*]|\d{1,9}[.)])[\t ]+)/);
    if (!container) break;
    prefix += container[0];
    content = content.slice(container[0].length);
  }
  return { prefix, content };
}

/**
 * Annotate only headings accepted by the canonical section parser.
 *
 * The opaque tokens let the lightweight Astro, Nuxt, and Svelte renderers carry
 * exact IDs through their component and inline-Markdown passes without parsing
 * the document a second, divergent way.
 */
export function prepareDocsMarkdownHeadings(markdown: string): PreparedDocsMarkdownHeadings {
  const frontmatter = markdown.match(/^(\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/)?.[1] ?? "";
  const frontmatterLineOffset = frontmatter.match(/\r?\n/g)?.length ?? 0;
  const canonicalHeadings = parseDocsMarkdownSections(
    frontmatter ? markdown.slice(frontmatter.length) : markdown,
  );
  const canonicalHeadingsByLine = new Map(
    canonicalHeadings.map((heading) => [heading.startLine + frontmatterLineOffset, heading]),
  );
  const headings: PreparedDocsMarkdownHeading[] = [];
  const headingTokens = new Set<string>();
  const output: string[] = [];

  const annotate = (
    source: string,
    canonicalHeading: (typeof canonicalHeadings)[number],
  ): string => {
    const token = createDocsMarkdownTransportToken(
      markdown,
      "anchor",
      headings.length,
      headingTokens,
    );
    headingTokens.add(token);
    headings.push({
      anchor: canonicalHeading.anchor,
      explicit: canonicalHeading.explicit,
      level: canonicalHeading.level,
      token,
    });
    return `${source} ${token}`;
  };

  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const canonicalHeading = canonicalHeadingsByLine.get(index + 1);
    if (!canonicalHeading) {
      output.push(line);
      continue;
    }

    const containerLine = splitDocsMarkdownHeadingContainerLine(line);
    const atx = containerLine.content.match(/^ {0,3}(#{1,6})(?:[\t ]+|$)(.*)$/);
    if (atx) {
      const source = atx[2].replace(/[\t ]+#+[\t ]*$/, "").trim();
      output.push(`${containerLine.prefix}${atx[1]} ${annotate(source, canonicalHeading)}`);
      continue;
    }

    output.push(
      `${containerLine.prefix}${annotate(containerLine.content.trim(), canonicalHeading)}`,
    );
  }

  return { markdown: output.join("\n"), headings };
}

export function stripPreparedDocsMarkdownHeadingTokens(value: string): string {
  return value;
}

export function renderDocsMarkdownHeadings(
  markdown: string,
  preparedHeadings: readonly PreparedDocsMarkdownHeading[],
): RenderedDocsMarkdownHeadings {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  const openingTags: DocsMarkdownHeadingOpeningTag[] = [];
  const openingTagTokens = new Set<string>();

  const protectOpeningTag = (level: number, anchor: string): string => {
    const token = createDocsMarkdownOpeningTagToken(markdown, openingTags.length, openingTagTokens);
    openingTagTokens.add(token);
    openingTags.push({
      html: `<h${level} id="${escapeDocsMarkdownHtml(anchor)}">`,
      token,
    });
    return token;
  };

  const resolveHeading = (
    source: string,
  ): { anchor: string; explicit: boolean; source: string; level: number } | undefined => {
    const prepared = preparedHeadings.find((heading) => source.includes(heading.token));
    if (!prepared) return undefined;
    const withoutToken = source.split(prepared.token).join("");
    return {
      anchor: prepared.anchor,
      explicit: prepared.explicit,
      level: prepared.level,
      source: prepared.explicit
        ? withoutToken.replace(TRAILING_DOCS_MARKDOWN_HEADING_ID, "").trim()
        : withoutToken.trim(),
    };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const containerLine = splitDocsMarkdownHeadingContainerLine(line);
    const atx = containerLine.content.match(/^ {0,3}(#{1,6})(?:[\t ]+|$)(.*)$/);
    if (atx) {
      const source = atx[2].replace(/[\t ]+#+[\t ]*$/, "").trim();
      const heading = resolveHeading(source);
      if (!heading) {
        output.push(line);
        continue;
      }
      const level = atx[1].length;
      output.push(
        `${containerLine.prefix}${protectOpeningTag(level, heading.anchor)}${heading.source}</h${level}>`,
      );
      continue;
    }

    const heading = resolveHeading(containerLine.content.trim());
    if (heading) {
      const sourceLines = [heading.source];
      let underlineIndex = index + 1;
      const expectedUnderline = heading.level === 1 ? /^=+$/ : /^-+$/;

      while (underlineIndex < lines.length) {
        const continuation = splitDocsMarkdownHeadingContainerLine(
          lines[underlineIndex] ?? "",
        ).content;
        if (expectedUnderline.test(continuation.trim())) break;
        if (!continuation.trim()) break;
        sourceLines.push(continuation.trim());
        underlineIndex += 1;
      }

      const combinedSource = sourceLines.join(" ");
      const visibleSource = heading.explicit
        ? combinedSource.replace(TRAILING_DOCS_MARKDOWN_HEADING_ID, "").trim()
        : combinedSource;
      output.push(
        `${containerLine.prefix}${protectOpeningTag(heading.level, heading.anchor)}${visibleSource}</h${heading.level}>`,
      );
      if (underlineIndex < lines.length) index = underlineIndex;
      continue;
    }

    output.push(line);
  }

  let renderedMarkdown = output.join("\n");
  for (const prepared of preparedHeadings) {
    renderedMarkdown = renderedMarkdown.split(prepared.token).join("");
  }
  return { markdown: renderedMarkdown, openingTags };
}

export function restoreDocsMarkdownHeadingOpeningTags(
  value: string,
  openingTags: readonly DocsMarkdownHeadingOpeningTag[],
): string {
  let restored = value;
  for (const openingTag of openingTags) {
    restored = restored.split(openingTag.token).join(openingTag.html);
  }
  return restored;
}

interface DocsMarkdownFenceContainer {
  continuationIndent: number;
  type: "blockquote" | "list";
}

function splitDocsMarkdownFenceContainerLine(line: string): {
  containers: DocsMarkdownFenceContainer[];
  content: string;
  prefix: string;
} {
  const containers: DocsMarkdownFenceContainer[] = [];
  let content = line;
  let prefix = "";

  while (content) {
    const blockquote = content.match(/^ {0,3}>[\t ]?/);
    if (blockquote) {
      prefix += blockquote[0];
      content = content.slice(blockquote[0].length);
      containers.push({ continuationIndent: 0, type: "blockquote" });
      continue;
    }

    const listItem = content.match(/^ {0,3}(?:[-+*]|\d{1,9}[.)])[\t ]+/);
    if (listItem) {
      prefix += listItem[0];
      content = content.slice(listItem[0].length);
      containers.push({
        continuationIndent: listItem[0].length,
        type: "list",
      });
      continue;
    }

    break;
  }

  return { containers, content, prefix };
}

function continueDocsMarkdownFenceContainerLine(
  line: string,
  containers: readonly DocsMarkdownFenceContainer[],
): string | undefined {
  let content = line;

  for (const container of containers) {
    if (container.type === "blockquote") {
      const blockquote = content.match(/^ {0,3}>[\t ]?/);
      if (!blockquote) return undefined;
      content = content.slice(blockquote[0].length);
      continue;
    }

    if (!content.trim()) {
      content = "";
      continue;
    }

    const indentation = content.match(/^[\t ]*/)?.[0] ?? "";
    const indentationWidth = indentation.replace(/\t/g, "    ").length;
    if (indentationWidth < container.continuationIndent) return undefined;

    let consumedLength = 0;
    let consumedWidth = 0;
    while (consumedLength < indentation.length) {
      consumedWidth += indentation[consumedLength] === "\t" ? 4 : 1;
      consumedLength += 1;
      if (consumedWidth >= container.continuationIndent) break;
    }
    content = content.slice(consumedLength);
  }

  return content;
}

/**
 * Replace complete CommonMark fenced code blocks without confusing shorter
 * marker runs inside a longer outer fence for its closing delimiter.
 */
export function replaceDocsMarkdownFencedCodeBlocks(
  value: string,
  render: (block: DocsMarkdownFencedCodeBlock, index: number) => string,
): string {
  const lines: Array<{
    end: number;
    ending: string;
    start: number;
    text: string;
  }> = [];

  for (const match of value.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)) {
    const raw = match[0];
    if (!raw) continue;
    const ending = raw.match(/(?:\r\n|\n|\r)$/)?.[0] ?? "";
    const start = match.index;
    const end = start + raw.length - ending.length;
    lines.push({
      end,
      ending,
      start,
      text: ending ? raw.slice(0, -ending.length) : raw,
    });
  }

  let blockIndex = 0;
  let cursor = 0;
  let output = "";
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const openingLine = lines[lineIndex];
    const containerLine = splitDocsMarkdownFenceContainerLine(openingLine.text);
    const opening = containerLine.content.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/);
    if (!opening) continue;

    const marker = opening[2][0] as "`" | "~";
    const info = opening[3].trim();
    if (marker === "`" && info.includes("`")) continue;

    const codeLines: string[] = [];
    let closingIndex = lineIndex + 1;
    for (; closingIndex < lines.length; closingIndex += 1) {
      const continuedContent =
        containerLine.containers.length === 0
          ? lines[closingIndex].text
          : continueDocsMarkdownFenceContainerLine(
              lines[closingIndex].text,
              containerLine.containers,
            );
      if (continuedContent === undefined) break;

      const closing = continuedContent.match(/^ {0,3}(`+|~+)[\t ]*$/);
      if (closing && closing[1][0] === marker && closing[1].length >= opening[2].length) {
        break;
      }
      codeLines.push(`${continuedContent}${lines[closingIndex].ending}`);
    }

    const candidateClosingLine = lines[closingIndex];
    const candidateClosingContent = candidateClosingLine
      ? containerLine.containers.length === 0
        ? candidateClosingLine.text
        : continueDocsMarkdownFenceContainerLine(
            candidateClosingLine.text,
            containerLine.containers,
          )
      : undefined;
    const candidateClosing = candidateClosingContent?.match(/^ {0,3}(`+|~+)[\t ]*$/);
    const closingLine =
      candidateClosing &&
      candidateClosing[1][0] === marker &&
      candidateClosing[1].length >= opening[2].length
        ? candidateClosingLine
        : undefined;
    const implicitClosingLine = candidateClosingLine ? lines[closingIndex - 1] : undefined;
    const blockEnd = closingLine?.end ?? implicitClosingLine?.end ?? value.length;
    output += value.slice(cursor, openingLine.start);
    output += containerLine.prefix + opening[1];
    output += render(
      {
        code: codeLines.join(""),
        fenceLength: opening[2].length,
        info,
        marker,
      },
      blockIndex,
    );
    blockIndex += 1;
    cursor = blockEnd;
    if (closingLine) {
      lineIndex = closingIndex;
    } else if (candidateClosingLine) {
      lineIndex = closingIndex - 1;
    } else {
      break;
    }
  }

  return blockIndex === 0 ? value : output + value.slice(cursor);
}

function normalizeDocsMarkdownReferenceLabel(value: string): string {
  return parseEntities(unescapeDocsMarkdownPunctuation(value), {
    nonTerminated: false,
  })
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function unescapeDocsMarkdownPunctuation(value: string): string {
  return value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, "$1");
}

function findDocsMarkdownClosingDelimiter(
  value: string,
  start: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] === open) depth += 1;
    if (value[index] !== close) continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function readDocsMarkdownHtmlTagEnd(value: string, start: number): number {
  if (value[start] !== "<" || !/[A-Za-z/!?]/.test(value[start + 1] ?? "")) {
    return -1;
  }

  let quote: "'" | '"' | undefined;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function parseDocsMarkdownDestination(source: string): DocsMarkdownReferenceDefinition | undefined {
  const value = source.trim();
  if (!value) return { destination: "" };

  let destination = "";
  let remainder = "";
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    if (end < 0) return undefined;
    destination = value.slice(1, end);
    remainder = value.slice(end + 1).trim();
  } else {
    let depth = 0;
    let end = value.length;
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] === "\\") {
        index += 1;
        continue;
      }
      if (value[index] === "(") depth += 1;
      if (value[index] === ")") depth = Math.max(0, depth - 1);
      if (/\s/.test(value[index]) && depth === 0) {
        end = index;
        break;
      }
    }
    destination = value.slice(0, end);
    remainder = value.slice(end).trim();
  }

  let title: string | undefined;
  if (remainder) {
    const titleMatch = remainder.match(/^(?:"([^"]*)"|'([^']*)'|\(([^()]*)\))$/);
    if (!titleMatch) return undefined;
    title = titleMatch[1] ?? titleMatch[2] ?? titleMatch[3];
  }

  return {
    destination: unescapeDocsMarkdownPunctuation(destination),
    ...(title === undefined ? {} : { title: unescapeDocsMarkdownPunctuation(title) }),
  };
}

export function extractDocsMarkdownReferenceDefinitions(markdown: string): {
  markdown: string;
  definitions: DocsMarkdownReferenceDefinitions;
} {
  const definitions = new Map<string, DocsMarkdownReferenceDefinition>();
  const output: string[] = [];
  let openFence: { marker: "`" | "~"; length: number } | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    if (openFence) {
      const marker = openFence.marker === "`" ? "`" : "~";
      if (new RegExp(`^ {0,3}${marker}{${openFence.length},}[\\t ]*$`).test(line)) {
        openFence = undefined;
      }
      output.push(line);
      continue;
    }

    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openingFence) {
      openFence = {
        marker: openingFence[1][0] as "`" | "~",
        length: openingFence[1].length,
      };
      output.push(line);
      continue;
    }

    const definitionMatch = line.match(/^ {0,3}\[([^\]]+)\]:[ \t]*(.*)$/);
    const definition = definitionMatch
      ? parseDocsMarkdownDestination(definitionMatch[2])
      : undefined;
    if (!definitionMatch || !definition) {
      output.push(line);
      continue;
    }

    const normalizedLabel = normalizeDocsMarkdownReferenceLabel(definitionMatch[1]);
    if (!definitions.has(normalizedLabel)) {
      definitions.set(normalizedLabel, definition);
    }
    output.push("");
  }

  return { markdown: output.join("\n"), definitions };
}

function renderDocsMarkdownResources(
  value: string,
  definitions: DocsMarkdownReferenceDefinitions,
): string {
  let output = "";
  let index = 0;

  while (index < value.length) {
    const htmlTagEnd = readDocsMarkdownHtmlTagEnd(value, index);
    if (htmlTagEnd >= 0) {
      output += value.slice(index, htmlTagEnd + 1);
      index = htmlTagEnd + 1;
      continue;
    }

    const image = value[index] === "!" && value[index + 1] === "[";
    const link = value[index] === "[";
    if (!image && !link) {
      output += value[index];
      index += 1;
      continue;
    }

    const labelStart = index + (image ? 2 : 1);
    const labelEnd = findDocsMarkdownClosingDelimiter(value, labelStart - 1, "[", "]");
    if (labelEnd < 0) {
      output += value[index];
      index += 1;
      continue;
    }

    const label = value.slice(labelStart, labelEnd);
    let end = labelEnd + 1;
    let target: DocsMarkdownReferenceDefinition | undefined;
    if (value[end] === "(") {
      const destinationEnd = findDocsMarkdownClosingDelimiter(value, end, "(", ")");
      if (destinationEnd < 0) {
        output += value[index];
        index += 1;
        continue;
      }
      target = parseDocsMarkdownDestination(value.slice(end + 1, destinationEnd));
      end = destinationEnd + 1;
    } else if (value[end] === "[") {
      const referenceEnd = findDocsMarkdownClosingDelimiter(value, end, "[", "]");
      if (referenceEnd < 0) {
        output += value[index];
        index += 1;
        continue;
      }
      const referenceLabel = value.slice(end + 1, referenceEnd) || label;
      target = definitions.get(normalizeDocsMarkdownReferenceLabel(referenceLabel));
      end = referenceEnd + 1;
    } else {
      target = definitions.get(normalizeDocsMarkdownReferenceLabel(label));
    }

    if (!target) {
      output += value.slice(index, end);
      index = end;
      continue;
    }

    const titleAttribute =
      target.title === undefined ? "" : ` title="${escapeDocsMarkdownHtml(target.title)}"`;
    if (image) {
      const alt = unescapeDocsMarkdownPunctuation(label)
        .replace(/<[^>]+>/g, "")
        .replace(/[*_~`]/g, "");
      output += `<img src="${escapeDocsMarkdownHtml(target.destination)}" alt="${escapeDocsMarkdownHtml(alt)}" class="fd-docs-content-img" loading="lazy" decoding="async"${titleAttribute} />`;
    } else {
      output += `<a href="${escapeDocsMarkdownHtml(target.destination)}"${titleAttribute}>${renderDocsMarkdownResources(
        label,
        definitions,
      )}</a>`;
    }
    index = end;
  }

  return output;
}

function renderDocsMarkdownEmphasis(value: string): string {
  return value
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![\w])__([^_\n]+)__(?![\w])/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "<em>$1</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
}

function renderDocsMarkdownTextOutsideHtml(value: string): string {
  let output = "";
  let textStart = 0;
  let index = 0;

  while (index < value.length) {
    const htmlTagEnd = readDocsMarkdownHtmlTagEnd(value, index);
    if (htmlTagEnd < 0) {
      index += 1;
      continue;
    }

    output += renderDocsMarkdownEmphasis(value.slice(textStart, index));
    output += value.slice(index, htmlTagEnd + 1);
    index = htmlTagEnd + 1;
    textStart = index;
  }

  output += renderDocsMarkdownEmphasis(value.slice(textStart));
  return output;
}

export function renderDocsMarkdownInline(
  value: string,
  definitions: DocsMarkdownReferenceDefinitions,
): string {
  const literals: Array<{ html: string; token: string }> = [];
  const literalTokens = new Set<string>();
  const protectLiteral = (html: string): string => {
    const token = createDocsMarkdownTransportToken(value, "inline", literals.length, literalTokens);
    literalTokens.add(token);
    literals.push({ html, token });
    return token;
  };
  let protectedValue = value.replace(
    /(`+)([\s\S]*?)\1/g,
    (_match, _ticks: string, code: string) => {
      const normalized = code.replace(/\s+/g, " ");
      const visible =
        normalized.length > 2 &&
        normalized.startsWith(" ") &&
        normalized.endsWith(" ") &&
        normalized.trim()
          ? normalized.slice(1, -1)
          : normalized;
      return protectLiteral(`<code>${escapeDocsMarkdownHtml(visible)}</code>`);
    },
  );
  protectedValue = protectedValue.replace(
    /\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g,
    (_match, punctuation: string) => protectLiteral(escapeDocsMarkdownHtml(punctuation)),
  );

  let rendered = renderDocsMarkdownTextOutsideHtml(
    renderDocsMarkdownResources(protectedValue, definitions),
  );
  for (const literal of literals) {
    rendered = rendered.split(literal.token).join(literal.html);
  }
  return rendered;
}

export function renderDocsMarkdownBlockContent(
  value: string,
  definitions: DocsMarkdownReferenceDefinitions,
): string {
  const output: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    output.push(
      `<p>${paragraphLines
        .map((line) => renderDocsMarkdownInline(line, definitions))
        .join("<br />")}</p>`,
    );
    paragraphLines = [];
  };

  for (const line of value.trim().split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const heading = trimmed.match(/^<h([1-6])\b([^>]*)>([\s\S]*)<\/h\1>$/);
    if (heading) {
      flushParagraph();
      output.push(
        `<h${heading[1]}${heading[2]}>${renderDocsMarkdownInline(
          heading[3],
          definitions,
        )}</h${heading[1]}>`,
      );
      continue;
    }

    if (/^<(?:pre|ul|ol|blockquote|hr|table|div|figure)\b/.test(trimmed)) {
      flushParagraph();
      output.push(trimmed);
      continue;
    }

    if (/^%%CODEBLOCK_\d+%%$/.test(trimmed)) {
      flushParagraph();
      output.push(trimmed);
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  return output.join("");
}

/**
 * Hoist canonical headings out of component bodies before those bodies are
 * rendered as cards, tabs, or literal prompt text.
 *
 * A heading must still carry an opening-tag transport token created by
 * `renderDocsMarkdownHeadings`. Authored raw `<h*>` HTML is deliberately left
 * in `content`, so a literal renderer such as Prompt can escape it instead of
 * accidentally promoting its attributes to live HTML.
 */
export function extractDocsRenderedHeadingElements(
  value: string,
  definitions: DocsMarkdownReferenceDefinitions,
  preserveText = true,
  openingTags: readonly DocsMarkdownHeadingOpeningTag[] = [],
): { headingsHtml: string; content: string } {
  const headings: string[] = [];
  const output: string[] = [];
  const protectedHeadings = openingTags.flatMap((openingTag) => {
    const level = openingTag.html.match(/^<h([1-6])\b[^>]*>$/)?.[1];
    return level ? [{ ...openingTag, level }] : [];
  });
  let openFence:
    | {
        containers: DocsMarkdownFenceContainer[];
        length: number;
        marker: "`" | "~";
      }
    | undefined;

  for (const lineWithEnding of value.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) ?? []) {
    if (!lineWithEnding) continue;
    const ending = lineWithEnding.match(/(?:\r\n|\n|\r)$/)?.[0] ?? "";
    const line = ending ? lineWithEnding.slice(0, -ending.length) : lineWithEnding;

    if (openFence) {
      const continuedContent =
        openFence.containers.length === 0
          ? line
          : continueDocsMarkdownFenceContainerLine(line, openFence.containers);
      if (continuedContent !== undefined) {
        output.push(lineWithEnding);
        const marker = openFence.marker === "`" ? "`" : "~";
        if (new RegExp(`^ {0,3}${marker}{${openFence.length},}[\\t ]*$`).test(continuedContent)) {
          openFence = undefined;
        }
        continue;
      }
      openFence = undefined;
    }

    const containerLine = splitDocsMarkdownFenceContainerLine(line);
    const openingFence = containerLine.content.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openingFence) {
      openFence = {
        containers: containerLine.containers,
        length: openingFence[1].length,
        marker: openingFence[1][0] as "`" | "~",
      };
      output.push(lineWithEnding);
      continue;
    }

    let renderedLine = line;
    for (const protectedHeading of protectedHeadings) {
      const tokenIndex = renderedLine.indexOf(protectedHeading.token);
      if (tokenIndex < 0) continue;
      const contentStart = tokenIndex + protectedHeading.token.length;
      const closingTag = `</h${protectedHeading.level}>`;
      const contentEnd = renderedLine.indexOf(closingTag, contentStart);
      if (contentEnd < 0) continue;

      const inner = renderedLine.slice(contentStart, contentEnd);
      headings.push(
        `${protectedHeading.html}${renderDocsMarkdownInline(inner, definitions)}${closingTag}`,
      );
      renderedLine =
        renderedLine.slice(0, tokenIndex) +
        (preserveText ? inner.replace(/<[^>]+>/g, "").trim() : "") +
        renderedLine.slice(contentEnd + closingTag.length);
    }
    output.push(`${renderedLine}${ending}`);
  }

  return { headingsHtml: headings.join("\n"), content: output.join("") };
}

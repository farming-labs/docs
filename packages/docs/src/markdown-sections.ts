import {
  assignDocsMarkdownAstHeadingAnchors,
  cleanDocsMarkdownHeadingLabel,
  createDocsMarkdownHeadingAnchorResolverWithReferences,
  findDocsMarkdownClosingDelimiter,
  normalizeDocsMarkdownReferenceLabel,
  type DocsMarkdownAstNode,
  type DocsMarkdownHeadingAnchor,
} from "./markdown-headings.js";
import { createDocsMarkdownParser } from "./markdown-parser.js";
import remarkGfm from "remark-gfm";
import { createDocsMarkdownSectionCache } from "./markdown-section-cache.js";
import {
  PAGE_AGENT_CONTRACT_END_MARKER,
  PAGE_AGENT_CONTRACT_START_MARKER,
} from "./agent-contract.js";

export {
  type DocsMarkdownHeadingAnchor,
  type DocsRenderedHeadingAnchorOptions,
  type ApplyDocsMarkdownHeadingAnchorsOptions,
  withDocsMarkdownRenderableHeadings,
  cleanDocsMarkdownHeadingLabel,
  cleanDocsRenderedHeadingLabel,
  createDocsRenderedHeadingAnchorResolver,
  createDocsMarkdownHeadingAnchorResolver,
  applyDocsMarkdownHeadingAnchors,
  slugifyDocsMarkdownHeading,
} from "./markdown-headings.js";

export interface DocsMarkdownSection {
  title: string;
  anchor: string;
  /** Whether the heading consumed a trailing Fumadocs `[#custom-id]` marker. */
  explicit: boolean;
  level: number;
  content: string;
  /** 1-based line containing the heading, relative to the Markdown body. */
  startLine: number;
  /** 1-based inclusive final line in the selected section. */
  endLine: number;
}

interface ParsedDocsMarkdownHeading {
  title: string;
  anchor: string;
  explicit: boolean;
  level: number;
  start: number;
}

interface UnresolvedDocsMarkdownHeading {
  source: string;
  level: number;
  start: number;
  resolved?: DocsMarkdownHeadingAnchor;
}

interface DocsMarkdownLineRange {
  start: number;
  end: number;
}

interface OpenMarkdownFence {
  marker: "`" | "~";
  length: number;
  containers: DocsMarkdownContainer[];
}

interface DocsMarkdownContainer {
  type: "blockquote" | "list";
  continuationIndent: number;
}

interface DocsMarkdownContainerLine {
  prefix: string;
  content: string;
  containers: DocsMarkdownContainer[];
}

interface DocsMarkdownFallbackEsmState {
  blockComment: boolean;
  braceDepth: number;
  bracketDepth: number;
  parenDepth: number;
  quote?: "'" | '"' | "`";
}

interface DocsMarkdownFallbackPromptTagState {
  braceDepth: number;
  closing: boolean;
  lastNonWhitespace: string;
  quote?: "'" | '"' | "`";
}

let docsMarkdownMdxProcessor: ReturnType<typeof createDocsMarkdownParser> | undefined;
const docsMarkdownSections = createDocsMarkdownSectionCache();

function getDocsMarkdownMdxProcessor() {
  if (!docsMarkdownMdxProcessor) {
    docsMarkdownMdxProcessor = createDocsMarkdownParser();
    docsMarkdownMdxProcessor.use(remarkGfm);
  }
  return docsMarkdownMdxProcessor;
}

function readOpeningFence(line: string): Pick<OpenMarkdownFence, "marker" | "length"> | undefined {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/u);
  if (!match) return undefined;
  return { marker: match[1][0] as "`" | "~", length: match[1].length };
}

function isClosingFence(line: string, fence: OpenMarkdownFence): boolean {
  const marker = fence.marker === "`" ? "`" : "~";
  const match = line.match(new RegExp(`^ {0,3}(${marker}{${fence.length},})[\\t ]*$`, "u"));
  return Boolean(match);
}

function splitDocsMarkdownContainerLine(line: string): DocsMarkdownContainerLine {
  let prefix = "";
  let content = line;
  const containers: DocsMarkdownContainer[] = [];

  while (content) {
    const blockquote = content.match(/^ {0,3}>[\t ]?/u);
    if (blockquote) {
      prefix += blockquote[0];
      content = content.slice(blockquote[0].length);
      containers.push({ type: "blockquote", continuationIndent: 0 });
      continue;
    }

    const listItem = content.match(/^ {0,3}(?:[-+*]|\d{1,9}[.)])[\t ]+/u);
    if (listItem) {
      prefix += listItem[0];
      content = content.slice(listItem[0].length);
      containers.push({
        type: "list",
        continuationIndent: listItem[0].length,
      });
      continue;
    }

    break;
  }

  return { prefix, content, containers };
}

function continueDocsMarkdownContainerLine(
  line: string,
  containers: readonly DocsMarkdownContainer[],
): DocsMarkdownContainerLine | undefined {
  let prefix = "";
  let content = line;

  for (const container of containers) {
    if (container.type === "blockquote") {
      const blockquote = content.match(/^ {0,3}>[\t ]?/u);
      if (!blockquote) return undefined;
      prefix += blockquote[0];
      content = content.slice(blockquote[0].length);
      continue;
    }

    if (!content.trim()) {
      prefix += content;
      content = "";
      continue;
    }

    const indentation = content.match(/^[\t ]*/u)?.[0] ?? "";
    const indentationWidth = indentation.replace(/\t/gu, "    ").length;
    if (indentationWidth < container.continuationIndent) return undefined;

    let consumedWidth = 0;
    let consumedLength = 0;
    while (consumedLength < indentation.length) {
      consumedWidth += indentation[consumedLength] === "\t" ? 4 : 1;
      consumedLength += 1;
      if (consumedWidth >= container.continuationIndent) break;
    }
    const consumed = content.slice(0, consumedLength);
    prefix += consumed;
    content = content.slice(consumedLength);
  }

  return {
    prefix,
    content,
    containers: containers.map((container) => ({ ...container })),
  };
}

function readDocsMarkdownFenceLine(
  line: string,
  fence: OpenMarkdownFence,
): DocsMarkdownContainerLine | undefined {
  if (fence.containers.length === 0) {
    return { prefix: "", content: line, containers: [] };
  }
  return continueDocsMarkdownContainerLine(line, fence.containers);
}

function readDocsMarkdownReferenceDefinition(line: string): string | undefined {
  const content = line.trimStart();
  if (!content.startsWith("[")) return undefined;
  const labelEnd = findDocsMarkdownClosingDelimiter(content, 0, "[", "]");
  if (labelEnd <= 1 || content[labelEnd + 1] !== ":") return undefined;
  const label = normalizeDocsMarkdownReferenceLabel(content.slice(1, labelEnd));
  return label || undefined;
}

function collectDocsMarkdownReferenceDefinitions(lines: readonly string[]): ReadonlySet<string> {
  const definitions = new Set<string>();
  let openFence: OpenMarkdownFence | undefined;

  for (const line of lines) {
    if (openFence) {
      const fenceLine = readDocsMarkdownFenceLine(line, openFence);
      if (fenceLine) {
        if (isClosingFence(fenceLine.content, openFence)) openFence = undefined;
        continue;
      }
      openFence = undefined;
    }

    const containerLine = splitDocsMarkdownContainerLine(line);
    const openingFence = readOpeningFence(containerLine.content);
    if (openingFence) {
      openFence = {
        ...openingFence,
        containers: containerLine.containers,
      };
      continue;
    }

    const definition = readDocsMarkdownReferenceDefinition(containerLine.content);
    if (definition) definitions.add(definition);
  }

  return definitions;
}

function scanDocsMarkdownFallbackEsmLine(
  line: string,
  state: DocsMarkdownFallbackEsmState,
): boolean {
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (state.blockComment) {
      if (character === "*" && next === "/") {
        state.blockComment = false;
        index += 1;
      }
      continue;
    }

    if (state.quote) {
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (character === state.quote) state.quote = undefined;
      continue;
    }

    if (character === "/" && next === "*") {
      state.blockComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "/") break;
    if (character === "'" || character === '"' || character === "`") {
      state.quote = character;
      continue;
    }
    if (character === "{") state.braceDepth += 1;
    if (character === "}") state.braceDepth = Math.max(0, state.braceDepth - 1);
    if (character === "[") state.bracketDepth += 1;
    if (character === "]") state.bracketDepth = Math.max(0, state.bracketDepth - 1);
    if (character === "(") state.parenDepth += 1;
    if (character === ")") state.parenDepth = Math.max(0, state.parenDepth - 1);
  }

  return Boolean(
    state.blockComment ||
    state.quote ||
    state.braceDepth ||
    state.bracketDepth ||
    state.parenDepth ||
    /(?:[=,]|=>)\s*$/u.test(line),
  );
}

function scanDocsMarkdownLiteralPromptTags(
  value: string,
  initialState?: DocsMarkdownFallbackPromptTagState,
): {
  delta: number;
  found: boolean;
  pending?: DocsMarkdownFallbackPromptTagState;
} {
  let delta = 0;
  let found = Boolean(initialState);
  let pending = initialState;
  let index = 0;

  while (index < value.length) {
    if (!pending) {
      const tagStart = value.indexOf("<", index);
      if (tagStart < 0) break;
      // Prompt is a flow component in the docs renderer. Restrict fallback
      // detection to a tag at the start of the logical line so literal examples
      // in headings, code spans, and link labels cannot hide later headings.
      if (!found && value.slice(0, tagStart).trim()) {
        index = tagStart + 1;
        continue;
      }

      const closing = value[tagStart + 1] === "/";
      const nameStart = tagStart + (closing ? 2 : 1);
      if (value.slice(nameStart, nameStart + 6) !== "Prompt") {
        index = tagStart + 1;
        continue;
      }
      const boundary = value[nameStart + 6];
      if (boundary && !/[\t\n\r />]/u.test(boundary)) {
        index = tagStart + 1;
        continue;
      }

      pending = {
        braceDepth: 0,
        closing,
        lastNonWhitespace: "t",
      };
      found = true;
      index = nameStart + 6;
    }

    while (pending && index < value.length) {
      const character = value[index];
      if (pending.quote) {
        if (character === "\\") {
          index += 2;
          continue;
        }
        if (character === pending.quote) pending.quote = undefined;
        index += 1;
        continue;
      }
      if (character === "'" || character === '"' || character === "`") {
        pending.quote = character;
        index += 1;
        continue;
      }
      if (character === "{") {
        pending.braceDepth += 1;
        pending.lastNonWhitespace = character;
        index += 1;
        continue;
      }
      if (character === "}") {
        pending.braceDepth = Math.max(0, pending.braceDepth - 1);
        pending.lastNonWhitespace = character;
        index += 1;
        continue;
      }
      if (character === ">" && pending.braceDepth === 0) {
        if (pending.closing) {
          delta -= 1;
        } else if (pending.lastNonWhitespace !== "/") {
          delta += 1;
        }
        pending = undefined;
        index += 1;
        break;
      }
      if (!/\s/u.test(character)) pending.lastNonWhitespace = character;
      index += 1;
    }
  }

  return { delta, found, ...(pending ? { pending } : {}) };
}

function collectDocsMarkdownFallbackIgnoredLines(lines: readonly string[]): ReadonlySet<number> {
  const ignored = new Set<number>();
  let esmState: DocsMarkdownFallbackEsmState | undefined;
  let htmlComment = false;
  let mdxComment = false;
  let literalPromptDepth = 0;
  let literalPromptTagContainers: DocsMarkdownContainer[] = [];
  let literalPromptTagState: DocsMarkdownFallbackPromptTagState | undefined;
  let openFence: OpenMarkdownFence | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (literalPromptTagState) {
      const continuation =
        literalPromptTagContainers.length > 0
          ? continueDocsMarkdownContainerLine(line, literalPromptTagContainers)
          : { content: line };
      const promptTags = scanDocsMarkdownLiteralPromptTags(
        continuation?.content ?? line,
        literalPromptTagState,
      );
      ignored.add(index);
      literalPromptDepth = Math.max(0, literalPromptDepth + promptTags.delta);
      literalPromptTagState = promptTags.pending;
      if (!literalPromptTagState) literalPromptTagContainers = [];
      continue;
    }

    if (!esmState && !htmlComment && !mdxComment && openFence) {
      const fenceLine = readDocsMarkdownFenceLine(line, openFence);
      if (fenceLine) {
        if (isClosingFence(fenceLine.content, openFence)) openFence = undefined;
        continue;
      }
      openFence = undefined;
    }

    const containerLine = splitDocsMarkdownContainerLine(line);
    const logicalLine = containerLine.content;
    if (!esmState && !htmlComment && !mdxComment) {
      const openingFence = readOpeningFence(logicalLine);
      if (openingFence) {
        openFence = {
          ...openingFence,
          containers: containerLine.containers,
        };
        continue;
      }
    }

    if (mdxComment) {
      ignored.add(index);
      if (logicalLine.includes("*/}")) mdxComment = false;
      continue;
    }
    if (htmlComment) {
      ignored.add(index);
      if (logicalLine.includes("-->")) htmlComment = false;
      continue;
    }
    if (esmState) {
      ignored.add(index);
      if (!scanDocsMarkdownFallbackEsmLine(logicalLine, esmState)) esmState = undefined;
      continue;
    }

    const trimmed = logicalLine.trimStart();
    if (trimmed.startsWith("{/*")) {
      ignored.add(index);
      mdxComment = !trimmed.includes("*/}");
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      ignored.add(index);
      htmlComment = !trimmed.includes("-->");
      continue;
    }
    if (/^(?:import|export)(?:[\t ]|[{*]|$)/u.test(trimmed)) {
      ignored.add(index);
      const state: DocsMarkdownFallbackEsmState = {
        blockComment: false,
        braceDepth: 0,
        bracketDepth: 0,
        parenDepth: 0,
      };
      if (scanDocsMarkdownFallbackEsmLine(logicalLine, state)) esmState = state;
      continue;
    }

    const promptTags = scanDocsMarkdownLiteralPromptTags(logicalLine);
    if (literalPromptDepth > 0 || promptTags.found) {
      ignored.add(index);
      literalPromptDepth = Math.max(0, literalPromptDepth + promptTags.delta);
      literalPromptTagState = promptTags.pending;
      if (literalPromptTagState) {
        literalPromptTagContainers = containerLine.containers.map((container) => ({
          ...container,
        }));
      }
    }
  }

  return ignored;
}

function readAtxHeading(line: string): { source: string; level: number } | undefined {
  const match = line.match(/^ {0,3}(#{1,6})(?:[\t ]+|$)(.*)$/u);
  if (!match) return undefined;

  const rawTitle = match[2].replace(/[\t ]+#+[\t ]*$/u, "").trim();
  return {
    source: rawTitle,
    level: match[1].length,
  };
}

function readSetextLevel(line: string): number | undefined {
  const match = line.match(/^ {0,3}(=+|-+)[\t ]*$/u);
  if (!match) return undefined;
  return match[1][0] === "=" ? 1 : 2;
}

function normalizeDocsSectionSelector(value: string, extractFragment = true): string {
  let selector = value.trim();
  const hashIndex = selector.indexOf("#");
  if (extractFragment && hashIndex >= 0) selector = selector.slice(hashIndex + 1);

  try {
    selector = decodeURIComponent(selector);
  } catch {
    // Keep malformed URL fragments usable as literal selectors.
  }

  return cleanDocsMarkdownHeadingLabel(selector).toLowerCase();
}

function decodeDocsSectionSelector(value: string): string {
  let selector = value.trim();
  const hashIndex = selector.indexOf("#");
  if (hashIndex >= 0) selector = selector.slice(hashIndex + 1);

  try {
    selector = decodeURIComponent(selector);
  } catch {
    // Keep malformed URL fragments usable as literal selectors.
  }

  return selector;
}

function isTopLevelDocsMarkdownMarker(line: string, marker: string): boolean {
  if (line.trim() !== marker) return false;
  const markerIndex = line.indexOf(marker);
  return markerIndex <= 3 && /^ *$/u.test(line.slice(0, markerIndex));
}

function collectGeneratedAgentContractRanges(markdown: string): DocsMarkdownLineRange[] {
  const lines = markdown.split(/\r?\n/u);
  const ranges: DocsMarkdownLineRange[] = [];
  let openFence: OpenMarkdownFence | undefined;
  let contractStart: number | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (openFence) {
      const fenceLine = readDocsMarkdownFenceLine(line, openFence);
      if (fenceLine) {
        if (isClosingFence(fenceLine.content, openFence)) openFence = undefined;
        continue;
      }
      openFence = undefined;
    }

    const containerLine = splitDocsMarkdownContainerLine(line);
    const openingFence = readOpeningFence(containerLine.content);
    if (openingFence) {
      openFence = {
        ...openingFence,
        containers: containerLine.containers,
      };
      continue;
    }

    if (containerLine.containers.length > 0) continue;

    if (contractStart !== undefined) {
      if (isTopLevelDocsMarkdownMarker(line, PAGE_AGENT_CONTRACT_END_MARKER)) {
        ranges.push({ start: contractStart, end: index });
        contractStart = undefined;
      }
    } else if (isTopLevelDocsMarkdownMarker(line, PAGE_AGENT_CONTRACT_START_MARKER)) {
      contractStart = index;
    }
  }

  return ranges;
}

export interface DocsGeneratedAgentContractRange {
  /** 1-based line containing the generated contract start marker. */
  startLine: number;
  /** 1-based line containing the generated contract end marker. */
  endLine: number;
}

/** Locate complete generated contract blocks while keeping fenced marker examples inert. */
export function findDocsGeneratedAgentContractRanges(
  markdown: string,
): DocsGeneratedAgentContractRange[] {
  return collectGeneratedAgentContractRanges(markdown).map(({ start, end }) => ({
    startLine: start + 1,
    endLine: end + 1,
  }));
}

/** Remove only generated boundary markers that overlap a full document or derived fragment. */
export function stripDocsGeneratedAgentContractMarkers(
  markdown: string,
  location?: {
    /** Full Markdown source from which this fragment was selected. */
    sourceMarkdown: string;
    /** 1-based source line corresponding to the fragment's first line. */
    startLine: number;
  },
): string {
  const ranges = findDocsGeneratedAgentContractRanges(location?.sourceMarkdown ?? markdown);
  if (ranges.length === 0) return markdown;

  const markerLines = new Set<number>();
  for (const range of ranges) {
    markerLines.add(range.startLine);
    markerLines.add(range.endLine);
  }

  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const startLine = location?.startLine ?? 1;
  const output = markdown
    .split(/\r?\n/u)
    .filter((_line, index) => !markerLines.has(startLine + index));
  while (output[0] === "") output.shift();
  return output.join(newline);
}

function isDocsMarkdownLineInRanges(
  line: number,
  ranges: readonly DocsMarkdownLineRange[],
): boolean {
  return ranges.some((range) => line >= range.start && line <= range.end);
}

/** Close each section at the next heading of the same or a shallower level. */
function resolveDocsMarkdownSectionEnds(
  headings: readonly { level: number; start: number }[],
  lineCount: number,
): number[] {
  const ends = headings.map(() => lineCount);
  const open: number[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    while (open.length > 0 && headings[open[open.length - 1]].level >= heading.level) {
      ends[open.pop()!] = heading.start;
    }
    open.push(index);
  }
  return ends;
}

/**
 * Parse heading sections once for search, Ask AI hydration, and MCP tools.
 * Supports CommonMark ATX indentation, Setext headings, fenced-code exclusion,
 * visible inline labels, and stable duplicate anchors.
 */
function parseDocsMarkdownSectionsFallback(
  markdown: string,
  generatedContractRanges: readonly DocsMarkdownLineRange[],
): DocsMarkdownSection[] {
  const lines = markdown.split(/\r?\n/u);
  const headings: UnresolvedDocsMarkdownHeading[] = [];
  const ignoredLines = collectDocsMarkdownFallbackIgnoredLines(lines);
  const definedReferences = collectDocsMarkdownReferenceDefinitions(
    lines.map((line, index) => (ignoredLines.has(index) ? "" : line)),
  );
  let openFence: OpenMarkdownFence | undefined;
  let setextCandidate:
    | {
        index: number;
        lastIndex: number;
        values: string[];
        containers: DocsMarkdownContainer[];
      }
    | undefined;

  const pushHeading = (value: string, level: number, start: number) => {
    headings.push({
      source: value,
      level,
      start,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (openFence) {
      const fenceLine = readDocsMarkdownFenceLine(line, openFence);
      if (fenceLine) {
        if (isClosingFence(fenceLine.content, openFence)) openFence = undefined;
        setextCandidate = undefined;
        continue;
      }
      openFence = undefined;
    }

    if (ignoredLines.has(index)) {
      setextCandidate = undefined;
      continue;
    }

    const containerLine = splitDocsMarkdownContainerLine(line);
    const logicalLine = containerLine.content;
    const openingFence = readOpeningFence(logicalLine);
    if (openingFence) {
      openFence = {
        ...openingFence,
        containers: containerLine.containers,
      };
      setextCandidate = undefined;
      continue;
    }

    const setextLine = setextCandidate
      ? continueDocsMarkdownContainerLine(line, setextCandidate.containers)
      : undefined;
    const setextLevel = setextLine ? readSetextLevel(setextLine.content) : undefined;
    if (setextLevel && setextCandidate?.lastIndex === index - 1) {
      const source = setextCandidate.values.join("\n").trim();
      if (!source.startsWith("<")) {
        pushHeading(source, setextLevel, setextCandidate.index);
      }
      setextCandidate = undefined;
      continue;
    }

    const atxHeading = readAtxHeading(logicalLine);
    if (atxHeading) {
      pushHeading(atxHeading.source, atxHeading.level, index);
      setextCandidate = undefined;
      continue;
    }

    if (!logicalLine.trim() || /^ {4}|^\t/u.test(logicalLine)) {
      setextCandidate = undefined;
      continue;
    }

    if (readDocsMarkdownReferenceDefinition(logicalLine)) {
      setextCandidate = undefined;
      continue;
    }

    const candidate = setextCandidate;
    const paragraphContinuation =
      candidate?.lastIndex === index - 1
        ? continueDocsMarkdownContainerLine(line, candidate.containers)
        : undefined;
    if (candidate && paragraphContinuation) {
      candidate.values.push(paragraphContinuation.content);
      candidate.lastIndex = index;
      continue;
    }

    setextCandidate = {
      index,
      lastIndex: index,
      values: [logicalLine],
      containers: containerLine.containers,
    };
  }

  const resolveHeadingAnchor =
    createDocsMarkdownHeadingAnchorResolverWithReferences(definedReferences);
  const orderedHeadings = [
    ...headings.filter(
      (heading) => !isDocsMarkdownLineInRanges(heading.start, generatedContractRanges),
    ),
    ...headings.filter((heading) =>
      isDocsMarkdownLineInRanges(heading.start, generatedContractRanges),
    ),
  ];
  for (const heading of orderedHeadings) {
    heading.resolved = resolveHeadingAnchor(heading.source);
  }

  const ends = resolveDocsMarkdownSectionEnds(headings, lines.length);
  return headings.map((heading, index) => {
    const end = ends[index];
    const resolved = heading.resolved;
    if (!resolved) throw new Error("Failed to resolve a Markdown heading anchor.");
    return {
      title: resolved.title,
      anchor: resolved.anchor,
      explicit: resolved.explicit,
      level: heading.level,
      content: lines.slice(heading.start, end).join("\n").trim(),
      startLine: heading.start + 1,
      endLine: end,
    };
  });
}

function stripDocsMarkdownSectionFrontmatter(markdown: string): string {
  const frontmatter = markdown.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/u);
  return frontmatter?.[1] ?? markdown;
}

function parseDocsMarkdownAstSections(
  markdown: string,
  generatedContractRanges: readonly DocsMarkdownLineRange[],
): DocsMarkdownSection[] | undefined {
  let root: DocsMarkdownAstNode;
  try {
    root = getDocsMarkdownMdxProcessor().parse(markdown) as DocsMarkdownAstNode;
  } catch {
    return undefined;
  }

  const assignedHeadings = assignDocsMarkdownAstHeadingAnchors(root, {}, (start) =>
    isDocsMarkdownLineInRanges(start, generatedContractRanges),
  );
  const headings = assignedHeadings.flatMap((heading): ParsedDocsMarkdownHeading[] => {
    const level = typeof heading.node.depth === "number" ? heading.node.depth : Number.NaN;
    const anchor = heading.node.data?.hProperties?.id;
    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 6 ||
      !Number.isInteger(heading.start) ||
      heading.start < 0 ||
      typeof anchor !== "string"
    ) {
      return [];
    }
    return [
      {
        title: heading.title,
        anchor,
        explicit: heading.explicit,
        level,
        start: heading.start,
      },
    ];
  });

  const lines = markdown.split(/\r?\n/u);
  const ends = resolveDocsMarkdownSectionEnds(headings, lines.length);
  return headings.map((heading, index) => {
    const end = ends[index];
    return {
      title: heading.title,
      anchor: heading.anchor,
      explicit: heading.explicit,
      level: heading.level,
      content: lines.slice(heading.start, end).join("\n").trim(),
      startLine: heading.start + 1,
      endLine: end,
    };
  });
}

export function parseDocsMarkdownSections(markdown: string): DocsMarkdownSection[] {
  const body = stripDocsMarkdownSectionFrontmatter(markdown);
  const cached = docsMarkdownSections.get(body);
  if (cached) return cached;
  const generatedContractRanges = collectGeneratedAgentContractRanges(body);
  const sections =
    parseDocsMarkdownAstSections(body, generatedContractRanges) ??
    parseDocsMarkdownSectionsFallback(body, generatedContractRanges);
  docsMarkdownSections.set(body, sections);
  return sections;
}

export function findDocsMarkdownSection(
  markdown: string,
  requestedSection: string,
): DocsMarkdownSection | undefined {
  const sections = parseDocsMarkdownSections(markdown);
  const rawSelector = requestedSection.trim();
  const rawAnchor = sections.find((section) => section.anchor === rawSelector);
  if (rawAnchor) return rawAnchor;

  const decodedSelector = decodeDocsSectionSelector(requestedSection);
  const exactAnchor = sections.find((section) => section.anchor === decodedSelector);
  if (exactAnchor) return exactAnchor;

  const caseInsensitiveAnchors = sections.filter(
    (section) => section.anchor.toLowerCase() === decodedSelector.toLowerCase(),
  );
  if (caseInsensitiveAnchors.length === 1) return caseInsensitiveAnchors[0];
  if (caseInsensitiveAnchors.length > 1) return undefined;

  const selector = normalizeDocsSectionSelector(requestedSection);
  if (!selector) return undefined;

  return sections.find(
    (section) => normalizeDocsSectionSelector(section.title, false) === selector,
  );
}

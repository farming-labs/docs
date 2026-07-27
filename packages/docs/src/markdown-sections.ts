import { createProcessor } from "@mdx-js/mdx";
import { slug as githubSlug } from "github-slugger";
import { parseEntities } from "parse-entities";
import remarkGfm from "remark-gfm";
import {
  PAGE_AGENT_CONTRACT_END_MARKER,
  PAGE_AGENT_CONTRACT_START_MARKER,
} from "./agent-contract.js";

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

export interface DocsMarkdownHeadingAnchor {
  /** Heading source without a trailing Fumadocs custom-id marker. */
  source: string;
  /** Visible heading label with common inline Markdown removed. */
  title: string;
  /** Canonical fragment identifier shared by rendered and agent surfaces. */
  anchor: string;
  /** Whether the anchor came from a trailing `[#custom-id]` marker. */
  explicit: boolean;
}

export interface DocsRenderedHeadingAnchorOptions {
  /** An author-provided or previously assigned fragment identifier. */
  explicitAnchor?: string;
}

export interface ApplyDocsMarkdownHeadingAnchorsOptions {
  /** Honor trailing Fumadocs `[#custom-id]` markers. */
  customId?: boolean;
}

interface DocsMarkdownAstNode {
  type?: string;
  name?: unknown;
  depth?: unknown;
  value?: unknown;
  alt?: unknown;
  identifier?: unknown;
  label?: unknown;
  referenceType?: unknown;
  children?: DocsMarkdownAstNode[];
  position?: {
    start?: {
      line?: unknown;
    };
  };
  data?: {
    hProperties?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

const docsMarkdownMdxProcessor = createProcessor({
  remarkPlugins: [remarkGfm],
});

function isDocsMarkdownLiteralPrompt(node: DocsMarkdownAstNode): boolean {
  return (
    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
    node.name === "Prompt"
  );
}

function collectDocsMarkdownLiteralPromptHeadings(
  root: DocsMarkdownAstNode,
): DocsMarkdownAstNode[] {
  const headings: DocsMarkdownAstNode[] = [];

  const visit = (node: DocsMarkdownAstNode, insidePrompt: boolean): void => {
    const literal = insidePrompt || isDocsMarkdownLiteralPrompt(node);
    if (literal && node.type === "heading") {
      headings.push(node);
      return;
    }
    for (const child of node.children ?? []) visit(child, literal);
  };

  visit(root, false);
  return headings;
}

/**
 * Run a third-party heading visitor without exposing headings inside `<Prompt>`.
 *
 * Prompt children are literal, copyable input rather than rendered page content.
 * The node types are restored synchronously even when the visitor throws.
 */
export function withDocsMarkdownRenderableHeadings<T>(root: unknown, visitor: () => T): T {
  if (!root || typeof root !== "object") return visitor();
  const hiddenHeadings = collectDocsMarkdownLiteralPromptHeadings(root as DocsMarkdownAstNode);
  for (const heading of hiddenHeadings) heading.type = "docsLiteralPromptHeading";

  try {
    return visitor();
  } finally {
    for (const heading of hiddenHeadings) heading.type = "heading";
  }
}

function protectDocsMarkdownCodeSpans(value: string): {
  value: string;
  restore: (resolved: string) => string;
} {
  const spans: string[] = [];
  const protectedValue = value.replace(
    /(`+)([^]*?)\1/gu,
    (_match, _ticks: string, code: string) => {
      const normalized = code.replace(/\s+/gu, " ");
      const visible =
        normalized.length > 2 &&
        normalized.startsWith(" ") &&
        normalized.endsWith(" ") &&
        normalized.trim()
          ? normalized.slice(1, -1)
          : normalized;
      return `\uE000${spans.push(visible) - 1}\uE001`;
    },
  );

  return {
    value: protectedValue,
    restore: (resolved) =>
      resolved.replace(
        /\uE000(\d+)\uE001/gu,
        (_match, index: string) => spans[Number(index)] ?? "",
      ),
  };
}

function protectDocsMarkdownEscapes(value: string): {
  value: string;
  restore: (resolved: string) => string;
} {
  const escapes: string[] = [];
  const protectedValue = value.replace(
    /\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/gu,
    (_match, punctuation: string) => `\uE002${escapes.push(punctuation) - 1}\uE003`,
  );

  return {
    value: protectedValue,
    restore: (resolved) =>
      resolved.replace(
        /\uE002(\d+)\uE003/gu,
        (_match, index: string) => escapes[Number(index)] ?? "",
      ),
  };
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

function normalizeDocsMarkdownReferenceLabel(value: string): string {
  return parseEntities(value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/gu, "$1"), {
    nonTerminated: false,
  })
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function cleanDocsMarkdownLinksAndImages(
  value: string,
  definedReferences?: ReadonlySet<string>,
  restoreEscapes: (value: string) => string = (input) => input,
): string {
  let output = "";
  let index = 0;

  while (index < value.length) {
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
    let inlineDestination = false;
    let referenceLabel: string | undefined;
    if (value[end] === "(") {
      const destinationEnd = findDocsMarkdownClosingDelimiter(value, end, "(", ")");
      if (destinationEnd < 0) {
        output += value[index];
        index += 1;
        continue;
      }
      end = destinationEnd + 1;
      inlineDestination = true;
    } else if (value[end] === "[") {
      const referenceEnd = findDocsMarkdownClosingDelimiter(value, end, "[", "]");
      if (referenceEnd < 0) {
        output += value[index];
        index += 1;
        continue;
      }
      referenceLabel = value.slice(end + 1, referenceEnd) || label;
      end = referenceEnd + 1;
    } else {
      referenceLabel = label;
    }

    const hasMatchingDefinition =
      referenceLabel !== undefined &&
      definedReferences?.has(
        normalizeDocsMarkdownReferenceLabel(restoreEscapes(referenceLabel)),
      ) === true;
    if (!image && (inlineDestination || hasMatchingDefinition)) {
      output += label;
    } else if (!inlineDestination && !hasMatchingDefinition) {
      output += value.slice(index, end);
    }
    index = end;
  }

  return output;
}

function stripDocsMarkdownTags(value: string): string {
  let output = "";
  let index = 0;

  while (index < value.length) {
    if (value[index] !== "<" || !/[A-Za-z/!?]/u.test(value[index + 1] ?? "")) {
      output += value[index];
      index += 1;
      continue;
    }

    let quote: "'" | '"' | undefined;
    let braceDepth = 0;
    let end = index + 1;
    for (; end < value.length; end += 1) {
      const character = value[end];
      if (quote) {
        if (character === quote && value[end - 1] !== "\\") quote = undefined;
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "{") {
        braceDepth += 1;
        continue;
      }
      if (character === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }
      if (character === ">" && braceDepth === 0) break;
    }

    if (end >= value.length) {
      output += value[index];
      index += 1;
      continue;
    }
    index = end + 1;
  }

  return output;
}

/**
 * Reduce inline Markdown in a heading to the visible label used by search and anchors.
 * This intentionally covers the common inline constructs without adding a Markdown parser
 * dependency to the runtime package.
 */
function cleanDocsMarkdownHeadingLabelWithReferences(
  value: string,
  definedReferences?: ReadonlySet<string>,
): string {
  const codeSpans = protectDocsMarkdownCodeSpans(value);
  const escapes = protectDocsMarkdownEscapes(codeSpans.value);
  const visible = stripDocsMarkdownTags(
    cleanDocsMarkdownLinksAndImages(escapes.value, definedReferences, escapes.restore).replace(
      /<((?:https?:\/\/|mailto:)[^>]+)>/giu,
      "$1",
    ),
  )
    .replace(/`+([^`]*?)`+/gu, "$1")
    .replace(/\*\*([^*\n]+)\*\*/gu, "$1")
    .replace(/(?<![\\\p{L}\p{N}])__([^_\n]+)__(?![\p{L}\p{N}])/gu, "$1")
    .replace(/\*([^*\n]+)\*/gu, "$1")
    .replace(/(?<![\\\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])/gu, "$1")
    .replace(/~~([^~\n]+)~~/gu, "$1")
    .trim();

  return codeSpans
    .restore(escapes.restore(parseEntities(visible, { nonTerminated: false })))
    .replace(/\s+/gu, " ")
    .trim();
}

export function cleanDocsMarkdownHeadingLabel(value: string): string {
  return cleanDocsMarkdownHeadingLabelWithReferences(value);
}

const EXPLICIT_DOCS_MARKDOWN_HEADING_ID = /\s*\\?\[#([^\]\r\n]+)\]\s*$/u;

function createDocsHeadingAnchorState() {
  const used = new Set<string>();
  const suffixes = new Map<string, number>();
  let headingIndex = 0;

  return (title: string, explicitAnchor?: string): string => {
    const fallback = `section-${headingIndex}`;
    headingIndex += 1;
    const original = explicitAnchor?.trim() || githubSlug(title) || fallback;
    let anchor = original;
    let suffix = suffixes.get(original) ?? 0;

    while (used.has(anchor)) {
      suffix += 1;
      anchor = `${original}-${suffix}`;
    }

    suffixes.set(original, suffix);
    used.add(anchor);
    return anchor;
  };
}

/** Normalize text that has already been flattened from a rendered heading AST. */
export function cleanDocsRenderedHeadingLabel(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * Create a stateful resolver for text already flattened by an MDX renderer.
 *
 * Unlike the raw-Markdown resolver, this does not reinterpret inline code or a
 * literal `[#id]` as Markdown syntax.
 */
export function createDocsRenderedHeadingAnchorResolver(): (
  value: string,
  options?: DocsRenderedHeadingAnchorOptions,
) => DocsMarkdownHeadingAnchor {
  const reserveAnchor = createDocsHeadingAnchorState();

  return (value, options = {}) => {
    const title = cleanDocsRenderedHeadingLabel(value);
    const explicitAnchor = options.explicitAnchor?.trim();
    return {
      source: title,
      title,
      anchor: reserveAnchor(title, explicitAnchor),
      explicit: Boolean(explicitAnchor),
    };
  };
}

/**
 * Create a stateful heading resolver compatible with Fumadocs' GitHub-style rendered IDs.
 *
 * A fresh resolver must be used for each document so duplicate and collision suffixes
 * remain deterministic in source order.
 */
function createDocsMarkdownHeadingAnchorResolverWithReferences(
  definedReferences?: ReadonlySet<string>,
): (value: string) => DocsMarkdownHeadingAnchor {
  const reserveAnchor = createDocsHeadingAnchorState();

  return (value) => {
    const explicitMatch = value.match(EXPLICIT_DOCS_MARKDOWN_HEADING_ID);
    const rawExplicitAnchor = explicitMatch?.[1]?.trim();
    const explicitMarker =
      explicitMatch?.index === undefined ? "" : value.slice(explicitMatch.index).trimStart();
    const resolvesAsReference =
      Boolean(rawExplicitAnchor) &&
      !explicitMarker.startsWith("\\[") &&
      definedReferences?.has(normalizeDocsMarkdownReferenceLabel(`#${rawExplicitAnchor}`)) === true;
    const explicitAnchor =
      rawExplicitAnchor && !resolvesAsReference
        ? parseEntities(rawExplicitAnchor, { nonTerminated: false })
        : undefined;
    const source = (
      explicitAnchor && explicitMatch ? value.slice(0, explicitMatch.index) : value
    ).trim();
    const title = cleanDocsMarkdownHeadingLabelWithReferences(source, definedReferences);

    return {
      source,
      title,
      anchor: reserveAnchor(title, explicitAnchor),
      explicit: Boolean(explicitAnchor),
    };
  };
}

export function createDocsMarkdownHeadingAnchorResolver(): (
  value: string,
) => DocsMarkdownHeadingAnchor {
  return createDocsMarkdownHeadingAnchorResolverWithReferences();
}

function collectDocsMarkdownAstReferenceDefinitions(
  root: DocsMarkdownAstNode,
): ReadonlySet<string> {
  const definitions = new Set<string>();

  const visit = (node: DocsMarkdownAstNode): void => {
    if (isDocsMarkdownLiteralPrompt(node)) return;
    if (node.type === "definition" && typeof node.identifier === "string") {
      definitions.add(normalizeDocsMarkdownReferenceLabel(node.identifier));
    }
    for (const child of node.children ?? []) visit(child);
  };

  visit(root);
  return definitions;
}

function formatDocsMarkdownAstReference(
  node: DocsMarkdownAstNode,
  definedReferences: ReadonlySet<string>,
): string {
  const image = node.type === "imageReference";
  const identifier =
    typeof node.identifier === "string" ? normalizeDocsMarkdownReferenceLabel(node.identifier) : "";
  const resolved = Boolean(identifier) && definedReferences.has(identifier);
  if (resolved) {
    return image
      ? ""
      : (node.children ?? [])
          .map((child) => flattenDocsMarkdownAstNode(child, definedReferences))
          .join("");
  }

  const visibleLabel = image
    ? typeof node.alt === "string"
      ? node.alt
      : ""
    : (node.children ?? [])
        .map((child) => flattenDocsMarkdownAstNode(child, definedReferences))
        .join("");
  const referenceLabel =
    typeof node.label === "string"
      ? node.label
      : typeof node.identifier === "string"
        ? node.identifier
        : visibleLabel;
  const prefix = image ? "!" : "";

  if (node.referenceType === "collapsed") return `${prefix}[${visibleLabel}][]`;
  if (node.referenceType === "shortcut") return `${prefix}[${visibleLabel}]`;
  return `${prefix}[${visibleLabel}][${referenceLabel}]`;
}

function flattenDocsMarkdownAstNode(
  node: DocsMarkdownAstNode,
  definedReferences: ReadonlySet<string>,
): string {
  if (node.type === "linkReference" || node.type === "imageReference") {
    return formatDocsMarkdownAstReference(node, definedReferences);
  }
  if (Array.isArray(node.children)) {
    return node.children
      .map((child) => flattenDocsMarkdownAstNode(child, definedReferences))
      .join("");
  }
  return typeof node.value === "string" ? node.value : "";
}

interface DocsMarkdownAstHeadingCandidate {
  node: DocsMarkdownAstNode;
  title: string;
  explicit: boolean;
  explicitAnchor?: string;
  start: number;
}

function assignDocsMarkdownAstHeadingAnchors(
  root: DocsMarkdownAstNode,
  options: ApplyDocsMarkdownHeadingAnchorsOptions,
  deferHeading?: (start: number) => boolean,
): DocsMarkdownAstHeadingCandidate[] {
  const customId = options.customId ?? true;
  const headings: DocsMarkdownAstHeadingCandidate[] = [];
  const definedReferences = collectDocsMarkdownAstReferenceDefinitions(root);

  const visit = (node: DocsMarkdownAstNode): void => {
    if (isDocsMarkdownLiteralPrompt(node)) return;

    if (node.type === "heading") {
      const lastNode = node.children?.at(-1);
      let explicitAnchor: string | undefined;
      if (customId && lastNode?.type === "text" && typeof lastNode.value === "string") {
        const match = lastNode.value.match(EXPLICIT_DOCS_MARKDOWN_HEADING_ID);
        explicitAnchor = match?.[1]?.trim();
        if (explicitAnchor && match?.index !== undefined) {
          lastNode.value = lastNode.value.slice(0, match.index);
        }
      }

      const existingAnchor = node.data?.hProperties?.id;
      headings.push({
        node,
        title: cleanDocsRenderedHeadingLabel(flattenDocsMarkdownAstNode(node, definedReferences)),
        explicit: Boolean(explicitAnchor),
        explicitAnchor:
          explicitAnchor || (typeof existingAnchor === "string" ? existingAnchor : undefined),
        start:
          typeof node.position?.start?.line === "number"
            ? node.position.start.line - 1
            : Number.NaN,
      });
      return;
    }

    for (const child of node.children ?? []) visit(child);
  };

  visit(root);

  const ordered = deferHeading
    ? [
        ...headings.filter((heading) => !deferHeading(heading.start)),
        ...headings.filter((heading) => deferHeading(heading.start)),
      ]
    : headings;
  const resolveHeading = createDocsRenderedHeadingAnchorResolver();
  for (const heading of ordered) {
    const resolved = resolveHeading(heading.title, {
      explicitAnchor: heading.explicitAnchor,
    });
    heading.node.data ??= {};
    heading.node.data.hProperties ??= {};
    heading.node.data.hProperties.id = resolved.anchor;
  }

  return headings;
}

/**
 * Assign canonical IDs to every heading in an MDX syntax tree.
 *
 * Render adapters call this before Fumadocs extracts its TOC, ensuring HTML,
 * Markdown retrieval, search, Ask AI, and MCP all use the same fragments.
 */
export function applyDocsMarkdownHeadingAnchors(
  root: unknown,
  options: ApplyDocsMarkdownHeadingAnchorsOptions = {},
): void {
  if (!root || typeof root !== "object") return;
  assignDocsMarkdownAstHeadingAnchors(root as DocsMarkdownAstNode, options);
}

/** Resolve one heading with the canonical GitHub-style anchor algorithm. */
export function slugifyDocsMarkdownHeading(value: string): string {
  return createDocsMarkdownHeadingAnchorResolver()(value).anchor;
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

  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    const end = next?.start ?? lines.length;
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
    root = docsMarkdownMdxProcessor.parse(markdown) as DocsMarkdownAstNode;
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
  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    const end = next?.start ?? lines.length;
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
  const generatedContractRanges = collectGeneratedAgentContractRanges(body);
  return (
    parseDocsMarkdownAstSections(body, generatedContractRanges) ??
    parseDocsMarkdownSectionsFallback(body, generatedContractRanges)
  );
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

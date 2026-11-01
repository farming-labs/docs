import { slug as githubSlug } from "github-slugger";
import { parseEntities } from "parse-entities";

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

export interface DocsMarkdownAstNode {
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

export function findDocsMarkdownClosingDelimiter(
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

export function normalizeDocsMarkdownReferenceLabel(value: string): string {
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
export function createDocsMarkdownHeadingAnchorResolverWithReferences(
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

export function assignDocsMarkdownAstHeadingAnchors(
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

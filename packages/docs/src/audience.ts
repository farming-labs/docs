import { createProcessor } from "@mdx-js/mdx";

/** The two content projections emitted by the docs framework. */
export type DocsContentAudience = "human" | "agent";

/** Resolve whether content with an optional audience restriction is visible. */
export function resolveDocsAudienceExposure(only: unknown, audience: DocsContentAudience): boolean {
  return (only !== "human" && only !== "agent") || only === audience;
}

type DocsAudienceTagName = "Agent" | "Human" | "Audience";

interface DocsAudienceScope {
  name: DocsAudienceTagName;
  only?: DocsContentAudience;
}

export interface DocsAudienceMdxTag {
  index: number;
  end: number;
  name: DocsAudienceTagName;
  closing: boolean;
  selfClosing: boolean;
  attributes: string;
  only?: DocsContentAudience;
  /** Tags nested in MDX JavaScript expressions need JSX-safe replacements. */
  expression?: boolean;
  /** Hidden expression tags that are JSX children need an expression container. */
  jsxChild?: boolean;
  hasOnlyAttribute?: boolean;
  hasSpreadAttribute?: boolean;
  onlyKind?: "static" | "dynamic" | "invalid" | "missing";
}

interface ProtectedRange {
  start: number;
  end: number;
}

export interface DocsAudienceMdxIssue {
  code:
    | "missing-only"
    | "invalid-only"
    | "dynamic-only"
    | "ignored-agent-only"
    | "ignored-human-only";
  index: number;
  message: string;
}

const DOCS_AUDIENCE_TAG_NAMES = ["Audience", "Agent", "Human"] as const;
const DOCS_AUDIENCE_TAG_CANDIDATE_PATTERN = /<\/?(?:Audience|Agent|Human)(?=[\s/>])/;

function parseAudienceOnly(attributes: string): DocsContentAudience | undefined {
  if (/\{\s*\.\.\./.test(attributes)) return undefined;
  const match = attributes.match(
    /(?:^|\s)only\s*=\s*(?:"(human|agent)"|'(human|agent)'|\{\s*"(human|agent)"\s*\}|\{\s*'(human|agent)'\s*\})/,
  );
  const value = match?.slice(1).find(Boolean);
  return value === "human" || value === "agent" ? value : undefined;
}

function isEscapedAt(content: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

const JAVASCRIPT_REGEX_PREFIX_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "each",
  "if",
  "in",
  "instanceof",
  "key",
  "new",
  "of",
  "return",
  "throw",
  "catch",
  "const",
  "debug",
  "html",
  "render",
  "snippet",
  "then",
  "typeof",
  "void",
  "yield",
]);

function canStartJavascriptRegex(content: string, cursor: number, boundary: number): boolean {
  let previous = cursor - 1;
  while (previous > boundary && /\s/.test(content[previous] ?? "")) previous -= 1;
  if (previous <= boundary || /[([{=,:;!?&|>]/.test(content[previous] ?? "")) return true;
  const precedingWord = content.slice(boundary + 1, cursor).match(/([A-Za-z_$][\w$]*)\s*$/)?.[1];
  return JAVASCRIPT_REGEX_PREFIX_KEYWORDS.has(precedingWord ?? "");
}

function readAudienceTagAt(content: string, index: number): DocsAudienceMdxTag | undefined {
  let cursor = index + 1;
  const closing = content[cursor] === "/";
  if (closing) cursor += 1;

  const name = DOCS_AUDIENCE_TAG_NAMES.find(
    (candidate) =>
      content.startsWith(candidate, cursor) &&
      /[\s/>]/.test(content[cursor + candidate.length] ?? ""),
  );
  if (!name) return undefined;

  cursor += name.length;
  const attributesStart = cursor;
  let braceDepth = 0;
  let quote: '"' | "'" | "`" | undefined;
  let blockComment = false;
  let lineComment = false;

  while (cursor < content.length) {
    const character = content[cursor];
    const next = content[cursor + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      cursor += 1;
      continue;
    }

    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        cursor += 2;
      } else {
        cursor += 1;
      }
      continue;
    }

    if (quote) {
      if (character === "\\") {
        cursor += 2;
        continue;
      }
      if (character === quote) quote = undefined;
      cursor += 1;
      continue;
    }

    if (braceDepth > 0 && character === "/" && next === "*") {
      blockComment = true;
      cursor += 2;
      continue;
    }
    if (braceDepth > 0 && character === "/" && next === "/") {
      lineComment = true;
      cursor += 2;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      braceDepth += 1;
    } else if (character === "}" && braceDepth > 0) {
      braceDepth -= 1;
    } else if (character === ">" && braceDepth === 0) {
      let attributesEnd = cursor;
      let slashIndex = cursor - 1;
      while (slashIndex >= attributesStart && /\s/.test(content[slashIndex] ?? "")) {
        slashIndex -= 1;
      }
      const selfClosing = content[slashIndex] === "/";
      if (selfClosing) attributesEnd = slashIndex;
      const attributes = content.slice(attributesStart, attributesEnd);

      return {
        index,
        end: cursor + 1,
        name,
        closing,
        selfClosing,
        attributes,
        only:
          name === "Agent" ? "agent" : name === "Human" ? "human" : parseAudienceOnly(attributes),
      };
    }

    cursor += 1;
  }

  return undefined;
}

function findAudienceTags(
  content: string,
  protectedRanges: readonly ProtectedRange[],
): DocsAudienceMdxTag[] {
  const tags: DocsAudienceMdxTag[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const index = content.indexOf("<", cursor);
    if (index === -1) break;
    if (isEscapedAt(content, index) || isInsideRange(index, protectedRanges)) {
      cursor = index + 1;
      continue;
    }
    const tag = readAudienceTagAt(content, index);
    if (tag) {
      tags.push(tag);
      cursor = tag.end;
    } else {
      cursor = index + 1;
    }
  }

  return tags;
}

interface MdxAstPosition {
  start?: { offset?: number };
  end?: { offset?: number };
}

interface MdxAstNode {
  type?: string;
  name?: string | null;
  attributes?: MdxAstAttribute[];
  children?: MdxAstNode[];
  position?: MdxAstPosition;
  data?: { estree?: unknown };
  title?: unknown;
}

interface MdxAstAttribute {
  type?: string;
  name?: string;
  value?: unknown;
  position?: MdxAstPosition;
  data?: { estree?: unknown };
}

interface AudienceAttributeInfo {
  only?: DocsContentAudience;
  hasOnlyAttribute: boolean;
  hasSpreadAttribute: boolean;
  onlyKind: "static" | "dynamic" | "invalid" | "missing";
}

const docsAudienceMdxProcessor = createProcessor({ format: "mdx" });
const docsAudienceMarkdownProcessor = createProcessor({ format: "md" });

function getOffset(position: MdxAstPosition | undefined, edge: "start" | "end") {
  const value = position?.[edge]?.offset;
  return typeof value === "number" ? value : undefined;
}

function maskRangesForMdxParser(content: string, ranges: readonly ProtectedRange[]): string {
  if (ranges.length === 0) return content;
  const characters = content.split("");
  for (const range of ranges) {
    for (let index = range.start; index < range.end; index += 1) {
      if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
    }
  }
  return characters.join("");
}

function findLeadingFrontmatterRange(content: string): ProtectedRange | undefined {
  const bomLength = content.startsWith("\uFEFF") ? 1 : 0;
  const opening = content.slice(bomLength).match(/^(---|\+\+\+)[\t ]*(?:\r?\n|$)/);
  const marker = opening?.[1];
  if (!opening || !marker) return undefined;

  let offset = bomLength + opening[0].length;
  for (const line of content.slice(offset).split(/(?<=\n)/)) {
    offset += line.length;
    const value = line.replace(/\r?\n$/, "");
    const isClosingDelimiter =
      marker === "---" ? /^(?:---|\.\.\.)[\t ]*$/.test(value) : /^\+\+\+[\t ]*$/.test(value);
    if (isClosingDelimiter) {
      return { start: 0, end: offset };
    }
  }
  return undefined;
}

function findHtmlLiteralRanges(
  content: string,
  excludedRanges: readonly ProtectedRange[] = [],
): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  const rawPattern = /<(script|style)(?=[\s/>])/g;
  let cursor = 0;

  while (cursor < content.length) {
    rawPattern.lastIndex = cursor;
    const rawMatch = rawPattern.exec(content);
    const commentStart = content.indexOf("<!--", cursor);
    const rawStart = rawMatch?.index ?? -1;
    const useComment = commentStart !== -1 && (rawStart === -1 || commentStart < rawStart);
    const start = useComment ? commentStart : rawStart;
    if (start === -1) break;

    if (isEscapedAt(content, start) || isInsideRange(start, excludedRanges)) {
      cursor = start + 1;
      continue;
    }

    if (useComment) {
      const closing = content.indexOf("-->", start + 4);
      const end = closing === -1 ? content.length : closing + 3;
      ranges.push({ start, end });
      cursor = end;
      continue;
    }

    const name = rawMatch?.[1];
    if (!name) {
      cursor = start + 1;
      continue;
    }
    const opening = readGenericMdxJsxTag(content, start);
    if (!opening) {
      cursor = start + 1;
      continue;
    }
    if (opening.selfClosing) {
      cursor = opening.end;
      continue;
    }

    const closingPattern = new RegExp(`</${name}\\s*>`, "g");
    closingPattern.lastIndex = opening.end;
    const closing = closingPattern.exec(content);
    if (!closing) {
      ranges.push({ start, end: content.length });
      break;
    }

    ranges.push({ start, end: closingPattern.lastIndex });
    cursor = closingPattern.lastIndex;
  }
  return ranges;
}

function prepareMdxParserSource(content: string): string {
  const baseExcludedRanges = findDelimiterExclusionRanges(content);
  const svelteDirectives = findSvelteDirectiveRanges(content, baseExcludedRanges);
  const excludedRanges = mergeProtectedRanges([...baseExcludedRanges, ...svelteDirectives]);
  const ranges: ProtectedRange[] = [
    ...findHtmlLiteralRanges(content, excludedRanges),
    ...svelteDirectives,
  ];
  const frontmatter = findLeadingFrontmatterRange(content);
  if (frontmatter) ranges.push(frontmatter);

  return maskRangesForMdxParser(content, mergeProtectedRanges(ranges));
}

function getExpressionLiteralString(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const expressionValue = value as {
    value?: unknown;
    data?: {
      estree?: {
        body?: Array<{ expression?: { type?: string; value?: unknown } }>;
      };
    };
  };
  const expression = expressionValue.data?.estree?.body?.[0]?.expression;
  return expression?.type === "Literal" && typeof expression.value === "string"
    ? expression.value
    : undefined;
}

function getMdxAudienceAttributeInfo(
  attributes: readonly MdxAstAttribute[],
): AudienceAttributeInfo {
  const hasSpreadAttribute = attributes.some(
    (attribute) => attribute.type === "mdxJsxExpressionAttribute",
  );
  const onlyAttribute = [...attributes]
    .reverse()
    .find((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === "only");
  if (hasSpreadAttribute) {
    return {
      hasOnlyAttribute: Boolean(onlyAttribute),
      hasSpreadAttribute,
      onlyKind: "dynamic",
    };
  }
  if (!onlyAttribute) {
    return { hasOnlyAttribute: false, hasSpreadAttribute: false, onlyKind: "missing" };
  }

  const value =
    typeof onlyAttribute.value === "string"
      ? onlyAttribute.value
      : getExpressionLiteralString(onlyAttribute.value);
  if (value === "human" || value === "agent") {
    return {
      only: value,
      hasOnlyAttribute: true,
      hasSpreadAttribute: false,
      onlyKind: "static",
    };
  }
  return {
    hasOnlyAttribute: true,
    hasSpreadAttribute: false,
    onlyKind: typeof onlyAttribute.value === "object" ? "dynamic" : "invalid",
  };
}

function getEstreeAudienceAttributeInfo(attributes: readonly unknown[]): AudienceAttributeInfo {
  const records = attributes.filter((attribute): attribute is Record<string, unknown> =>
    Boolean(attribute && typeof attribute === "object"),
  );
  const hasSpreadAttribute = records.some((attribute) => attribute.type === "JSXSpreadAttribute");
  const onlyAttribute = [...records].reverse().find((attribute) => {
    const name = attribute.name as { type?: string; name?: string } | undefined;
    return (
      attribute.type === "JSXAttribute" && name?.type === "JSXIdentifier" && name.name === "only"
    );
  });
  if (hasSpreadAttribute) {
    return {
      hasOnlyAttribute: Boolean(onlyAttribute),
      hasSpreadAttribute,
      onlyKind: "dynamic",
    };
  }
  if (!onlyAttribute) {
    return { hasOnlyAttribute: false, hasSpreadAttribute: false, onlyKind: "missing" };
  }

  const attributeValue = onlyAttribute.value as
    | { type?: string; value?: unknown; expression?: { type?: string; value?: unknown } }
    | undefined;
  const value =
    attributeValue?.type === "Literal"
      ? attributeValue.value
      : attributeValue?.type === "JSXExpressionContainer" &&
          attributeValue.expression?.type === "Literal"
        ? attributeValue.expression.value
        : undefined;
  if (value === "human" || value === "agent") {
    return {
      only: value,
      hasOnlyAttribute: true,
      hasSpreadAttribute: false,
      onlyKind: "static",
    };
  }
  return {
    hasOnlyAttribute: true,
    hasSpreadAttribute: false,
    onlyKind: attributeValue?.type === "JSXExpressionContainer" ? "dynamic" : "invalid",
  };
}

function getOpeningTagEnd(
  content: string,
  start: number,
  name: DocsAudienceTagName,
  attributes: readonly MdxAstAttribute[],
): number | undefined {
  const searchStart = Math.max(
    start + name.length + 1,
    ...attributes.map((attribute) => getOffset(attribute.position, "end") ?? 0),
  );
  const closingBracket = content.indexOf(">", searchStart);
  return closingBracket === -1 ? undefined : closingBracket + 1;
}

function addMdxAudienceElementTags(
  content: string,
  node: MdxAstNode,
  tags: DocsAudienceMdxTag[],
): void {
  const name = node.name as DocsAudienceTagName;
  const start = getOffset(node.position, "start");
  const nodeEnd = getOffset(node.position, "end");
  if (start === undefined || nodeEnd === undefined) return;

  const attributes = node.attributes ?? [];
  const openingEnd = getOpeningTagEnd(content, start, name, attributes);
  if (openingEnd === undefined) return;
  const closingStart = content.lastIndexOf(`</${name}`, nodeEnd);
  const hasClosingTag = closingStart >= openingEnd;
  const attributeInfo = getMdxAudienceAttributeInfo(attributes);
  const rawAttributes = content.slice(start + name.length + 1, openingEnd - 1);

  tags.push({
    index: start,
    end: openingEnd,
    name,
    closing: false,
    selfClosing: !hasClosingTag,
    attributes: rawAttributes,
    only: name === "Agent" ? "agent" : name === "Human" ? "human" : attributeInfo.only,
    hasOnlyAttribute: attributeInfo.hasOnlyAttribute,
    hasSpreadAttribute: attributeInfo.hasSpreadAttribute,
    onlyKind: attributeInfo.onlyKind,
  });

  if (hasClosingTag) {
    tags.push({
      index: closingStart,
      end: nodeEnd,
      name,
      closing: true,
      selfClosing: false,
      attributes: "",
    });
  }
}

function getEstreeJsxIdentifierName(value: unknown): DocsAudienceTagName | undefined {
  if (!value || typeof value !== "object") return undefined;
  const name = value as { type?: string; name?: string };
  return name.type === "JSXIdentifier" &&
    DOCS_AUDIENCE_TAG_NAMES.some((candidate) => candidate === name.name)
    ? (name.name as DocsAudienceTagName)
    : undefined;
}

function addEstreeAudienceElementTags(
  content: string,
  node: Record<string, unknown>,
  tags: DocsAudienceMdxTag[],
  jsxChild: boolean,
): void {
  const opening = node.openingElement as Record<string, unknown> | undefined;
  if (!opening) return;
  const name = getEstreeJsxIdentifierName(opening.name);
  const start = typeof opening.start === "number" ? opening.start : undefined;
  const openingEnd = typeof opening.end === "number" ? opening.end : undefined;
  const nodeEnd = typeof node.end === "number" ? node.end : undefined;
  if (!name || start === undefined || openingEnd === undefined || nodeEnd === undefined) return;

  const attributes = Array.isArray(opening.attributes) ? opening.attributes : [];
  const attributeInfo = getEstreeAudienceAttributeInfo(attributes);
  const closing = node.closingElement as Record<string, unknown> | null | undefined;
  const closingStart = closing && typeof closing.start === "number" ? closing.start : undefined;
  const closingEnd = closing && typeof closing.end === "number" ? closing.end : undefined;

  tags.push({
    index: start,
    end: openingEnd,
    name,
    closing: false,
    selfClosing: closingStart === undefined,
    attributes: content.slice(start + name.length + 1, openingEnd - 1),
    only: name === "Agent" ? "agent" : name === "Human" ? "human" : attributeInfo.only,
    expression: true,
    jsxChild,
    hasOnlyAttribute: attributeInfo.hasOnlyAttribute,
    hasSpreadAttribute: attributeInfo.hasSpreadAttribute,
    onlyKind: attributeInfo.onlyKind,
  });

  if (closingStart !== undefined && closingEnd !== undefined) {
    tags.push({
      index: closingStart,
      end: closingEnd,
      name,
      closing: true,
      selfClosing: false,
      attributes: "",
      expression: true,
      jsxChild,
    });
  }
}

function collectEstreeAudienceTags(
  content: string,
  value: unknown,
  tags: DocsAudienceMdxTag[],
  seen = new WeakSet<object>(),
  parent?: Record<string, unknown>,
  parentKey?: string,
): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  const record = value as Record<string, unknown>;
  if (record.type === "JSXElement") {
    const opening = record.openingElement as Record<string, unknown> | undefined;
    if (getEstreeJsxIdentifierName(opening?.name)) {
      const jsxChild =
        parentKey === "children" &&
        (parent?.type === "JSXElement" || parent?.type === "JSXFragment");
      addEstreeAudienceElementTags(content, record, tags, jsxChild);
      for (const child of Array.isArray(record.children) ? record.children : []) {
        collectEstreeAudienceTags(content, child, tags, seen, record, "children");
      }
      return;
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (key === "loc" || key === "range" || key === "comments") continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        collectEstreeAudienceTags(content, item, tags, seen, record, key);
      }
    } else {
      collectEstreeAudienceTags(content, child, tags, seen, record, key);
    }
  }
}

function collectMdxAudienceTags(content: string, node: MdxAstNode, tags: DocsAudienceMdxTag[]) {
  const isMdxJsxElement = node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
  if (isMdxJsxElement && (node.name === "script" || node.name === "style")) return;
  const isAudienceElement = Boolean(
    isMdxJsxElement &&
    node.name &&
    DOCS_AUDIENCE_TAG_NAMES.some((candidate) => candidate === node.name),
  );
  if (isAudienceElement) {
    addMdxAudienceElementTags(content, node, tags);
  }

  if (node.type !== "mdxjsEsm") {
    if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
      collectEstreeAudienceTags(content, node.data?.estree, tags);
    }
    if (isMdxJsxElement && !isAudienceElement) {
      for (const attribute of node.attributes ?? []) {
        collectEstreeAudienceTags(content, attribute.data?.estree, tags);
        if (attribute.value && typeof attribute.value === "object") {
          const value = attribute.value as { data?: { estree?: unknown } };
          collectEstreeAudienceTags(content, value.data?.estree, tags);
        }
      }
    }
  }

  for (const child of node.children ?? []) collectMdxAudienceTags(content, child, tags);
}

function findMdxAstAudienceTags(content: string): DocsAudienceMdxTag[] | undefined {
  try {
    const tree = docsAudienceMdxProcessor.parse(prepareMdxParserSource(content)) as MdxAstNode;
    const tags: DocsAudienceMdxTag[] = [];
    collectMdxAudienceTags(content, tree, tags);
    return tags.sort((left, right) => left.index - right.index || left.end - right.end);
  } catch {
    return undefined;
  }
}

/** Locate effective audience tags while excluding Markdown/MDX literal contexts. */
export function findDocsAudienceMdxTags(content: string): DocsAudienceMdxTag[] {
  if (!DOCS_AUDIENCE_TAG_CANDIDATE_PATTERN.test(content)) return [];
  return findMdxAstAudienceTags(content) ?? findAudienceTags(content, findProtectedRanges(content));
}

function isAudienceVisible(scopes: DocsAudienceScope[], audience: DocsContentAudience): boolean {
  return scopes.every((scope) => resolveDocsAudienceExposure(scope.only, audience));
}

function mergeProtectedRanges(ranges: ProtectedRange[]): ProtectedRange[] {
  const sorted = [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged: ProtectedRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }

  return merged;
}

function findMarkdownLiteralRanges(content: string): ProtectedRange[] {
  try {
    const tree = docsAudienceMarkdownProcessor.parse(content) as MdxAstNode;
    const ranges: ProtectedRange[] = [];

    const visit = (node: MdxAstNode) => {
      const start = getOffset(node.position, "start");
      const end = getOffset(node.position, "end");
      if (start !== undefined && end !== undefined) {
        if (node.type === "code" || node.type === "inlineCode" || node.type === "definition") {
          ranges.push({ start, end });
        } else if (node.type === "link" || node.type === "image") {
          const contentEnd = Math.max(
            start,
            ...(node.children ?? []).map((child) => getOffset(child.position, "end") ?? start),
          );
          ranges.push({ start: contentEnd, end });
        }
      }
      for (const child of node.children ?? []) visit(child);
    };

    visit(tree);
    return ranges;
  } catch {
    return [];
  }
}

function findMarkdownLinkDestinationRanges(
  content: string,
  protectedRanges: readonly ProtectedRange[],
): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf("](", cursor);
    if (start === -1) break;
    if (isEscapedAt(content, start) || isInsideRange(start, protectedRanges)) {
      cursor = start + 1;
      continue;
    }

    let end = start + 2;
    let parenthesisDepth = 1;
    let angleDestination = false;
    let quote: '"' | "'" | undefined;
    while (end < content.length && parenthesisDepth > 0) {
      const character = content[end];
      if (character === "\\") {
        end += 2;
        continue;
      }
      if (quote) {
        if (character === quote) quote = undefined;
        end += 1;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "<" && parenthesisDepth === 1) {
        const closingAngle = content.indexOf(">", end + 1);
        const closingParenthesis = content.indexOf(")", end + 1);
        angleDestination = closingAngle !== -1 && closingAngle < closingParenthesis;
      } else if (character === ">" && angleDestination) {
        angleDestination = false;
      } else if (!angleDestination && character === "(") {
        parenthesisDepth += 1;
      } else if (!angleDestination && character === ")") {
        parenthesisDepth -= 1;
      }
      end += 1;
    }

    if (parenthesisDepth === 0) ranges.push({ start: start + 1, end });
    cursor = Math.max(start + 1, end);
  }

  return ranges;
}

function findFenceRanges(content: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let fence:
    | {
        marker: "`" | "~";
        length: number;
        start: number;
      }
    | undefined;
  let offset = 0;

  const stripBlockquoteContainers = (line: string) => {
    let value = line;
    while (/^ {0,3}>[\t ]?/.test(value)) value = value.replace(/^ {0,3}>[\t ]?/, "");
    return value;
  };

  const stripOpeningListContainers = (line: string) => {
    let value = line;
    while (/^ {0,3}(?:[-+*]|\d{1,9}[.)])[\t ]+/.test(value)) {
      value = value.replace(/^ {0,3}(?:[-+*]|\d{1,9}[.)])[\t ]+/, "");
    }
    return value;
  };

  for (const line of content.split(/(?<=\n)/)) {
    const lineWithoutNewline = line.replace(/\r?\n$/, "");
    const containerRelativeLine = stripBlockquoteContainers(lineWithoutNewline);
    const candidateLine = fence
      ? containerRelativeLine
      : stripOpeningListContainers(containerRelativeLine);
    const match = candidateLine.match(/^[\t ]*(`{3,}|~{3,})(.*)$/);

    if (!fence && match?.[1]) {
      fence = {
        marker: match[1][0] as "`" | "~",
        length: match[1].length,
        start: offset,
      };
    } else if (
      fence &&
      match?.[1]?.[0] === fence.marker &&
      match[1].length >= fence.length &&
      /^[\t ]*$/.test(match[2] ?? "")
    ) {
      ranges.push({ start: fence.start, end: offset + line.length });
      fence = undefined;
    }

    offset += line.length;
  }

  if (fence) ranges.push({ start: fence.start, end: content.length });
  return ranges;
}

function findSvelteDirectiveRanges(
  content: string,
  excludedRanges: readonly ProtectedRange[],
): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let index = 0;

  while (index < content.length) {
    const start = content.indexOf("{", index);
    if (start === -1) break;
    const sigil = content[start + 1];
    if (
      !/[#/:@]/.test(sigil ?? "") ||
      !/[A-Za-z]/.test(content[start + 2] ?? "") ||
      isEscapedAt(content, start) ||
      isInsideRange(start, excludedRanges)
    ) {
      index = start + 1;
      continue;
    }

    let cursor = start + 2;
    let braceDepth = 1;
    let quote: '"' | "'" | "`" | undefined;
    let blockComment = false;
    let lineComment = false;
    let regex = false;
    let regexCharacterClass = false;

    while (cursor < content.length && braceDepth > 0) {
      const character = content[cursor];
      const next = content[cursor + 1];

      if (lineComment) {
        if (character === "\n") lineComment = false;
        cursor += 1;
        continue;
      }
      if (blockComment) {
        if (character === "*" && next === "/") {
          blockComment = false;
          cursor += 2;
        } else {
          cursor += 1;
        }
        continue;
      }
      if (quote) {
        if (character === "\\") {
          cursor += 2;
          continue;
        }
        if (character === quote) quote = undefined;
        cursor += 1;
        continue;
      }
      if (regex) {
        if (character === "\\") {
          cursor += 2;
          continue;
        }
        if (character === "[") regexCharacterClass = true;
        if (character === "]") regexCharacterClass = false;
        if (character === "/" && !regexCharacterClass) regex = false;
        cursor += 1;
        continue;
      }

      if (character === "/" && next === "*") {
        blockComment = true;
        cursor += 2;
        continue;
      }
      if (character === "/" && next === "/") {
        lineComment = true;
        cursor += 2;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
        cursor += 1;
        continue;
      }
      if (character === "/") {
        if (canStartJavascriptRegex(content, cursor, start + 1)) {
          regex = true;
          cursor += 1;
          continue;
        }
      }

      if (character === "{") braceDepth += 1;
      if (character === "}") braceDepth -= 1;
      cursor += 1;
    }

    if (braceDepth === 0) ranges.push({ start, end: cursor });
    index = Math.max(start + 1, cursor);
  }

  return ranges;
}

interface MdxModuleScanState {
  braceDepth: number;
  bracketDepth: number;
  parenthesisDepth: number;
  quote?: '"' | "'" | "`";
  blockComment: boolean;
  sawBlock: boolean;
  jsxDepth: number;
  jsxTag?: { closing: boolean };
}

function scanMdxModuleLine(line: string, state: MdxModuleScanState): void {
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

    if (character === "/" && next === "/") break;
    if (character === "/" && next === "*") {
      state.blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      state.quote = character;
      continue;
    }

    if (state.jsxTag) {
      if (character === "{") {
        state.braceDepth += 1;
      } else if (character === "}" && state.braceDepth > 0) {
        state.braceDepth -= 1;
      } else if (character === ">" && state.braceDepth === 0) {
        let previous = index - 1;
        while (previous >= 0 && /[\t ]/.test(line[previous] ?? "")) previous -= 1;
        const selfClosing = line[previous] === "/";
        let following = index + 1;
        while (following < line.length && /[\t ]/.test(line[following] ?? "")) following += 1;
        const genericTypeParameters = !state.jsxTag.closing && line[following] === "(";
        if (state.jsxTag.closing) {
          state.jsxDepth = Math.max(0, state.jsxDepth - 1);
        } else if (!selfClosing && !genericTypeParameters) {
          state.jsxDepth += 1;
        }
        state.jsxTag = undefined;
      }
      continue;
    }

    if (character === "<") {
      let previous = index - 1;
      while (previous >= 0 && /[\t ]/.test(line[previous] ?? "")) previous -= 1;
      const previousCharacter = line[previous];
      const atExpressionStart =
        previousCharacter === undefined || /[=([{,:?!;]/.test(previousCharacter);
      const openingElement =
        (state.jsxDepth > 0 || atExpressionStart) && /[A-Za-z]/.test(next ?? "");
      const closingElement =
        state.jsxDepth > 0 && next === "/" && /[A-Za-z]/.test(line[index + 2] ?? "");
      const openingFragment = atExpressionStart && next === ">";
      const closingFragment = state.jsxDepth > 0 && next === "/" && line[index + 2] === ">";

      if (openingFragment) {
        state.jsxDepth += 1;
        index += 1;
        continue;
      }
      if (closingFragment) {
        state.jsxDepth = Math.max(0, state.jsxDepth - 1);
        index += 2;
        continue;
      }
      if (openingElement || closingElement) {
        state.jsxTag = { closing: closingElement };
        continue;
      }
    }

    if (character === "{") {
      state.braceDepth += 1;
      state.sawBlock = true;
      continue;
    }
    if (character === "}") {
      state.braceDepth = Math.max(0, state.braceDepth - 1);
    } else if (character === "[") {
      state.bracketDepth += 1;
    } else if (character === "]") {
      state.bracketDepth = Math.max(0, state.bracketDepth - 1);
    } else if (character === "(") {
      state.parenthesisDepth += 1;
    } else if (character === ")") {
      state.parenthesisDepth = Math.max(0, state.parenthesisDepth - 1);
    }
  }
}

function shouldContinueMdxModule(
  statement: string,
  state: MdxModuleScanState,
  nextSignificantLine?: string,
): boolean {
  if (
    state.quote ||
    state.blockComment ||
    state.braceDepth > 0 ||
    state.bracketDepth > 0 ||
    state.parenthesisDepth > 0 ||
    state.jsxTag ||
    state.jsxDepth > 0
  ) {
    return true;
  }

  const trimmed = statement.trimEnd();
  const isImportDeclaration = /^\s*import\b(?!\s*[.(])/.test(statement);
  if (isImportDeclaration) {
    const hasSource =
      /^\s*import\s*(?:type\s+)?["'`]/.test(statement) ||
      /\bfrom\s*["'`][\s\S]*["'`]\s*;?\s*$/.test(trimmed);
    if (!hasSource && !/;\s*$/.test(trimmed)) return true;
  }

  const isExportList = /^\s*export\s+(?:type\s+)?\{/.test(statement);
  const isExportAll = /^\s*export\s+\*/.test(statement);
  if (
    (isExportList || isExportAll) &&
    !/\bfrom\s*["'`][\s\S]*["'`]\s*;?\s*$/.test(trimmed) &&
    (isExportAll || /^\s*from\b/.test(nextSignificantLine ?? ""))
  ) {
    return true;
  }

  if (/=>\s*$/.test(trimmed) || /[=([{,:.?+\-*/%&|^!]$/.test(trimmed)) return true;
  if (/\b(?:as|default|extends|from|implements|satisfies)$/.test(trimmed)) return true;

  const declarationNeedsBlock =
    /^\s*export\s+(?:default\s+)?(?:(?:async\s+)?function|class|enum|interface|module|namespace)\b/.test(
      statement,
    );
  return declarationNeedsBlock && !state.sawBlock;
}

function isInsideRange(index: number, ranges: readonly ProtectedRange[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function findMdxModuleRanges(content: string, protectedRanges: ProtectedRange[]): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  const lines = content.split(/(?<=\n)/);
  let offset = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const firstNonWhitespace = line.search(/\S/);
    if (
      /^\s*(?:import|export)\b/.test(line) &&
      !isInsideRange(offset + Math.max(0, firstNonWhitespace), protectedRanges)
    ) {
      const start = offset;
      const state: MdxModuleScanState = {
        braceDepth: 0,
        bracketDepth: 0,
        parenthesisDepth: 0,
        blockComment: false,
        sawBlock: false,
        jsxDepth: 0,
      };
      let statement = "";

      while (lineIndex < lines.length) {
        const moduleLine = lines[lineIndex] ?? "";
        statement += moduleLine;
        scanMdxModuleLine(moduleLine, state);
        offset += moduleLine.length;
        const nextSignificantLine = lines
          .slice(lineIndex + 1)
          .find((candidate) => candidate.trim().length > 0);
        if (!shouldContinueMdxModule(statement, state, nextSignificantLine)) break;
        lineIndex += 1;
      }

      ranges.push({ start, end: offset });
      continue;
    }
    offset += line.length;
  }

  return ranges;
}

function findInlineCodeRanges(
  content: string,
  protectedRanges: readonly ProtectedRange[],
): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let index = 0;

  while (index < content.length) {
    if (
      content[index] !== "`" ||
      isEscapedAt(content, index) ||
      isInsideRange(index, protectedRanges)
    ) {
      index += 1;
      continue;
    }

    let markerLength = 1;
    while (content[index + markerLength] === "`") markerLength += 1;
    let closingIndex = index + markerLength;

    while (closingIndex < content.length) {
      closingIndex = content.indexOf("`", closingIndex);
      if (closingIndex === -1) break;
      if (isInsideRange(closingIndex, protectedRanges)) {
        closingIndex += 1;
        continue;
      }

      let closingLength = 1;
      while (content[closingIndex + closingLength] === "`") closingLength += 1;
      if (closingLength === markerLength) break;
      closingIndex += closingLength;
    }

    if (closingIndex === -1) {
      index += markerLength;
      continue;
    }

    ranges.push({ start: index, end: closingIndex + markerLength });
    index = closingIndex + markerLength;
  }

  return ranges;
}

function findMdxExpressionLiteralRanges(
  content: string,
  protectedRanges: readonly ProtectedRange[],
): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let index = 0;

  while (index < content.length) {
    if (
      content[index] !== "{" ||
      isEscapedAt(content, index) ||
      isInsideRange(index, protectedRanges)
    ) {
      index += 1;
      continue;
    }

    let cursor = index + 1;
    let depth = 1;
    while (cursor < content.length && depth > 0) {
      if (isInsideRange(cursor, protectedRanges)) {
        cursor += 1;
        continue;
      }

      const character = content[cursor];
      const next = content[cursor + 1];
      if (character === '"' || character === "'" || character === "`") {
        const quote = character;
        const start = cursor;
        cursor += 1;
        while (cursor < content.length) {
          if (content[cursor] === "\\") {
            cursor += 2;
            continue;
          }
          if (content[cursor] === quote) {
            cursor += 1;
            break;
          }
          cursor += 1;
        }
        ranges.push({ start, end: cursor });
        continue;
      }
      if (character === "/" && next === "*") {
        const start = cursor;
        const end = content.indexOf("*/", cursor + 2);
        cursor = end === -1 ? content.length : end + 2;
        ranges.push({ start, end: cursor });
        continue;
      }
      if (character === "/" && next === "/") {
        const start = cursor;
        const newline = content.indexOf("\n", cursor + 2);
        cursor = newline === -1 ? content.length : newline;
        ranges.push({ start, end: cursor });
        continue;
      }
      if (character === "/") {
        if (canStartJavascriptRegex(content, cursor, index)) {
          const start = cursor;
          let inCharacterClass = false;
          cursor += 1;
          while (cursor < content.length) {
            if (content[cursor] === "\\") {
              cursor += 2;
              continue;
            }
            if (content[cursor] === "[") inCharacterClass = true;
            if (content[cursor] === "]") inCharacterClass = false;
            if (content[cursor] === "/" && !inCharacterClass) {
              cursor += 1;
              while (/[A-Za-z]/.test(content[cursor] ?? "")) cursor += 1;
              break;
            }
            if (content[cursor] === "\n") break;
            cursor += 1;
          }
          ranges.push({ start, end: cursor });
          continue;
        }
      }
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      cursor += 1;
    }

    index = Math.max(index + 1, cursor);
  }

  return ranges;
}

function readGenericMdxJsxTag(
  content: string,
  index: number,
): { end: number; literals: ProtectedRange[]; selfClosing: boolean } | undefined {
  let cursor = index + 1;
  if (content[cursor] === "/") cursor += 1;
  if (!/[A-Za-z]/.test(content[cursor] ?? "")) return undefined;

  const nameStart = cursor;
  while (/[\w:.-]/.test(content[cursor] ?? "")) cursor += 1;
  const name = content.slice(nameStart, cursor);
  if (DOCS_AUDIENCE_TAG_NAMES.some((candidate) => candidate === name)) return undefined;
  if (!/[\s/>]/.test(content[cursor] ?? "")) return undefined;

  const literals: ProtectedRange[] = [];
  let braceDepth = 0;
  while (cursor < content.length) {
    const character = content[cursor];
    const next = content[cursor + 1];
    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      const start = cursor;
      cursor += 1;
      while (cursor < content.length) {
        if (content[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (content[cursor] === quote) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      literals.push({ start, end: cursor });
      continue;
    }
    if (braceDepth > 0 && character === "/" && next === "*") {
      const start = cursor;
      const end = content.indexOf("*/", cursor + 2);
      cursor = end === -1 ? content.length : end + 2;
      literals.push({ start, end: cursor });
      continue;
    }
    if (braceDepth > 0 && character === "/" && next === "/") {
      const start = cursor;
      const newline = content.indexOf("\n", cursor + 2);
      cursor = newline === -1 ? content.length : newline;
      literals.push({ start, end: cursor });
      continue;
    }
    if (character === "{") {
      braceDepth += 1;
    } else if (character === "}" && braceDepth > 0) {
      braceDepth -= 1;
    } else if (character === ">" && braceDepth === 0) {
      let previous = cursor - 1;
      while (previous >= index && /\s/.test(content[previous] ?? "")) previous -= 1;
      return { end: cursor + 1, literals, selfClosing: content[previous] === "/" };
    }
    cursor += 1;
  }

  return undefined;
}

function findGenericMdxJsxLiteralRanges(
  content: string,
  protectedRanges: readonly ProtectedRange[],
): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const index = content.indexOf("<", cursor);
    if (index === -1) break;
    if (isEscapedAt(content, index) || isInsideRange(index, protectedRanges)) {
      cursor = index + 1;
      continue;
    }
    const tag = readGenericMdxJsxTag(content, index);
    if (!tag) {
      cursor = index + 1;
      continue;
    }
    ranges.push(...tag.literals);
    cursor = tag.end;
  }

  return ranges;
}

function findDelimiterExclusionRanges(content: string): ProtectedRange[] {
  const markdownLiterals = findMarkdownLiteralRanges(content);
  const fences = findFenceRanges(content);
  const frontmatter = findLeadingFrontmatterRange(content);
  const literalBlocks = mergeProtectedRanges([
    ...markdownLiterals,
    ...fences,
    ...(frontmatter ? [frontmatter] : []),
  ]);
  const inlineCode = findInlineCodeRanges(content, literalBlocks);
  const markdownLinks = findMarkdownLinkDestinationRanges(content, literalBlocks);
  const nonModuleRanges = mergeProtectedRanges([...literalBlocks, ...inlineCode, ...markdownLinks]);
  const moduleRanges = findMdxModuleRanges(content, nonModuleRanges);
  const nonExpressionRanges = mergeProtectedRanges([...nonModuleRanges, ...moduleRanges]);
  const expressionLiterals = findMdxExpressionLiteralRanges(content, nonExpressionRanges);
  const nonJsxRanges = mergeProtectedRanges([...nonExpressionRanges, ...expressionLiterals]);
  return mergeProtectedRanges([
    ...nonJsxRanges,
    ...findGenericMdxJsxLiteralRanges(content, nonJsxRanges),
  ]);
}

function findProtectedRanges(content: string): ProtectedRange[] {
  const baseExcludedRanges = findDelimiterExclusionRanges(content);
  const svelteDirectives = findSvelteDirectiveRanges(content, baseExcludedRanges);
  const excludedRanges = mergeProtectedRanges([...baseExcludedRanges, ...svelteDirectives]);
  const htmlLiterals = findHtmlLiteralRanges(content, excludedRanges);
  return mergeProtectedRanges([...excludedRanges, ...htmlLiterals]);
}

function normalizeProjectedWhitespace(content: string): string {
  const protectedRanges = findProtectedRanges(content);
  return content
    .replace(/\n{3,}/g, (newlines, offset: number) => {
      const end = offset + newlines.length;
      const overlapsLiteral = protectedRanges.some(
        (range) => range.start < end && range.end > offset,
      );
      return overlapsLiteral ? newlines : "\n\n";
    })
    .trim();
}

/** Find audience declarations that cannot be projected consistently at build time. */
export function findDocsAudienceMdxIssues(content: string): DocsAudienceMdxIssue[] {
  const issues: DocsAudienceMdxIssue[] = [];

  for (const tag of findDocsAudienceMdxTags(content)) {
    if (tag.closing) continue;
    const { attributes } = tag;
    const hasOnlyAttribute = tag.hasOnlyAttribute ?? /(?:^|\s)only\s*=/.test(attributes);
    const hasSpreadAttribute = tag.hasSpreadAttribute ?? /\{\s*\.\.\./.test(attributes);

    if ((tag.name === "Agent" || tag.name === "Human") && hasOnlyAttribute) {
      const shorthandAudience = tag.name === "Agent" ? "agent" : "human";
      issues.push({
        code: tag.name === "Agent" ? "ignored-agent-only" : "ignored-human-only",
        index: tag.index,
        message: `<${tag.name}> is always ${shorthandAudience}-only, so its \`only\` prop is ignored. Use <Audience only="${shorthandAudience}"> when you need the explicit form.`,
      });
      continue;
    }

    if (tag.name !== "Audience") continue;
    if (hasSpreadAttribute) {
      issues.push({
        code: "dynamic-only",
        index: tag.index,
        message:
          'Audience spread props cannot be projected consistently. Remove the spread and use the static literal `only="human"` or `only="agent"`.',
      });
      continue;
    }
    if (tag.only) continue;
    if (!hasOnlyAttribute) {
      issues.push({
        code: "missing-only",
        index: tag.index,
        message: '<Audience> requires the static literal `only="human"` or `only="agent"`.',
      });
      continue;
    }

    const dynamicOnly = tag.onlyKind === "dynamic" || /(?:^|\s)only\s*=\s*\{/.test(attributes);
    issues.push({
      code: dynamicOnly ? "dynamic-only" : "invalid-only",
      index: tag.index,
      message: dynamicOnly
        ? 'Dynamic Audience.only expressions cannot be projected consistently. Use the static literal `only="human"` or `only="agent"`.'
        : 'Audience.only must be the static literal `"human"` or `"agent"`.',
    });
  }

  return issues;
}

/**
 * Resolve MDX into its human or agent projection.
 *
 * `<Agent>` is shorthand for `<Audience only="agent">`, while `<Human>` is
 * shorthand for `<Audience only="human">`. Unknown `Audience.only` values are
 * treated as shared content so an authoring typo never silently deletes content.
 * These primitives shape content for each surface; they are not an access-control boundary.
 */
export function resolveDocsAudienceMdxContent(
  content: string,
  audience: DocsContentAudience,
): string {
  const scopes: DocsAudienceScope[] = [];
  let output = "";
  let cursor = 0;
  let resolvedTag = false;

  for (const tag of findDocsAudienceMdxTags(content)) {
    const activeScope = scopes.at(-1);
    if (tag.closing && activeScope?.name !== tag.name) continue;
    resolvedTag = true;

    const visibleBeforeTag = isAudienceVisible(scopes, audience);
    if (visibleBeforeTag) {
      output += content.slice(cursor, tag.index);
    }
    cursor = tag.end;

    if (tag.closing) {
      if (tag.expression && visibleBeforeTag) output += "</>";
      scopes.pop();
      continue;
    }

    if (tag.selfClosing) {
      if (tag.expression && visibleBeforeTag) output += tag.jsxChild ? "{null}" : "null";
      continue;
    }

    scopes.push({ name: tag.name, only: tag.only });
    if (tag.expression && visibleBeforeTag) {
      output += isAudienceVisible(scopes, audience) ? "<>" : tag.jsxChild ? "{null}" : "null";
    }
  }

  if (isAudienceVisible(scopes, audience)) output += content.slice(cursor);

  return resolvedTag ? normalizeProjectedWhitespace(output) : content;
}

/** Backwards-compatible name retained for existing integrations. */
export function resolveDocsAgentMdxContent(content: string, audience: DocsContentAudience): string {
  return resolveDocsAudienceMdxContent(content, audience);
}

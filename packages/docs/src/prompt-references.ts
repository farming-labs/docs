interface DocsMarkdownPromptReferenceNode {
  type?: string;
  name?: unknown;
  value?: unknown;
  alt?: unknown;
  identifier?: unknown;
  label?: unknown;
  referenceType?: unknown;
  url?: unknown;
  title?: unknown;
  children?: DocsMarkdownPromptReferenceNode[];
  position?: {
    start?: {
      offset?: unknown;
    };
    end?: {
      offset?: unknown;
    };
  };
}

function isDocsMarkdownPromptNode(node: DocsMarkdownPromptReferenceNode): boolean {
  return (
    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
    node.name === "Prompt"
  );
}

function normalizeDocsMarkdownReferenceIdentifier(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").toLowerCase() : "";
}

function readDocsMarkdownPromptReferenceSource(value: unknown): string | undefined {
  const source =
    typeof value === "string"
      ? value
      : value instanceof Uint8Array
        ? new TextDecoder().decode(value)
        : undefined;
  if (source === undefined) return undefined;

  // Micromark removes one leading Unicode BOM before assigning node offsets.
  // Keep the source used for slices aligned with those parser positions.
  return source.startsWith("\uFEFF") ? source.slice(1) : source;
}

function sliceDocsMarkdownPromptReferenceSource(
  node: DocsMarkdownPromptReferenceNode,
  source: string | undefined,
): string | undefined {
  if (source === undefined) return undefined;
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > source.length
  ) {
    return undefined;
  }
  return source.slice(start, end);
}

function sliceDocsMarkdownPromptChildrenSource(
  node: DocsMarkdownPromptReferenceNode,
  source: string | undefined,
): string | undefined {
  const nodeSource = sliceDocsMarkdownPromptReferenceSource(node, source);
  if (nodeSource === undefined) return undefined;

  const closingStart = nodeSource.lastIndexOf("</Prompt");
  if (closingStart < 0) return undefined;

  const children = node.children ?? [];
  const isolatedChild = children.length === 1 ? children[0] : undefined;
  if (
    isolatedChild?.type === "text" &&
    typeof isolatedChild.value === "string" &&
    isolatedChild.position === undefined
  ) {
    return isolatedChild.value;
  }

  const nodeStart = node.position?.start?.offset;
  if (typeof nodeStart !== "number") return undefined;
  let firstChildStart: number | undefined;
  for (const child of children) {
    const childStart = child.position?.start?.offset;
    if (
      typeof childStart === "number" &&
      Number.isInteger(childStart) &&
      childStart >= nodeStart &&
      (firstChildStart === undefined || childStart - nodeStart < firstChildStart)
    ) {
      firstChildStart = childStart - nodeStart;
    }
  }
  if (children.length > 0 && firstChildStart === undefined) return undefined;

  const openingEnd = nodeSource.lastIndexOf(">", (firstChildStart ?? closingStart) - 1);
  if (openingEnd < 0 || openingEnd >= closingStart) return undefined;
  return nodeSource.slice(openingEnd + 1, closingStart);
}

function flattenDocsMarkdownPromptReferenceNode(node: DocsMarkdownPromptReferenceNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? [])
    .map((child) => flattenDocsMarkdownPromptReferenceNode(child))
    .join("");
}

function formatDocsMarkdownPromptReference(node: DocsMarkdownPromptReferenceNode): string {
  const image = node.type === "imageReference";
  const visibleLabel = image
    ? typeof node.alt === "string"
      ? node.alt
      : ""
    : flattenDocsMarkdownPromptReferenceNode(node);
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

function formatDocsMarkdownPromptDefinition(node: DocsMarkdownPromptReferenceNode): string {
  const label =
    typeof node.label === "string"
      ? node.label
      : typeof node.identifier === "string"
        ? node.identifier
        : "";
  const rawUrl = typeof node.url === "string" ? node.url : "";
  const url = /[<>\s]/u.test(rawUrl) ? `<${rawUrl.replace(/>/gu, "\\>")}>` : rawUrl;
  const title = typeof node.title === "string" ? ` "${node.title.replace(/"/gu, '\\"')}"` : "";
  return `[${label}]: ${url}${title}`;
}

function createDocsMarkdownPromptReferenceText(
  node: DocsMarkdownPromptReferenceNode,
  source: string | undefined,
): DocsMarkdownPromptReferenceNode {
  return {
    type: "text",
    value:
      sliceDocsMarkdownPromptReferenceSource(node, source) ??
      formatDocsMarkdownPromptReference(node),
    position: node.position,
  };
}

function createDocsMarkdownPromptDefinitionParagraph(
  node: DocsMarkdownPromptReferenceNode,
  source: string | undefined,
): DocsMarkdownPromptReferenceNode {
  return {
    type: "paragraph",
    children: [
      {
        type: "text",
        value:
          sliceDocsMarkdownPromptReferenceSource(node, source) ??
          formatDocsMarkdownPromptDefinition(node),
        position: node.position,
      },
    ],
    position: node.position,
  };
}

/**
 * Keep `<Prompt>` children literal before Markdown reference definitions are
 * resolved by the MDX compiler.
 *
 * Definitions inside Prompt are copyable source, not page-level definitions.
 * References inside Prompt always remain source text, while references outside
 * Prompt only remain live when they have a definition outside Prompt.
 */
export function isolateDocsMarkdownPromptReferences(root: unknown, value?: unknown): void {
  if (!root || typeof root !== "object") return;

  const source = readDocsMarkdownPromptReferenceSource(value);
  const promptDefinitions = new Set<string>();
  const pageDefinitions = new Set<string>();
  let hasPrompt = false;

  const collectDefinitions = (
    node: DocsMarkdownPromptReferenceNode,
    insidePrompt: boolean,
  ): void => {
    const prompt = isDocsMarkdownPromptNode(node);
    const literal = insidePrompt || prompt;
    if (prompt) hasPrompt = true;
    if (node.type === "definition") {
      const identifier = normalizeDocsMarkdownReferenceIdentifier(node.identifier);
      if (identifier) (literal ? promptDefinitions : pageDefinitions).add(identifier);
    }
    for (const child of node.children ?? []) collectDefinitions(child, literal);
  };

  collectDefinitions(root as DocsMarkdownPromptReferenceNode, false);
  if (!hasPrompt) return;

  const isolateReferences = (
    node: DocsMarkdownPromptReferenceNode,
    insidePrompt: boolean,
  ): void => {
    const prompt = isDocsMarkdownPromptNode(node);
    if (prompt) {
      const promptSource = sliceDocsMarkdownPromptChildrenSource(node, source);
      if (promptSource !== undefined) {
        node.children = [{ type: "text", value: promptSource }];
        return;
      }
    }

    const literal = insidePrompt || prompt;
    const children = node.children;
    if (!children) return;

    node.children = children.map((child) => {
      const childInsidePrompt = literal || isDocsMarkdownPromptNode(child);
      if (childInsidePrompt && child.type === "definition") {
        return createDocsMarkdownPromptDefinitionParagraph(child, source);
      }

      if (child.type === "linkReference" || child.type === "imageReference") {
        const identifier = normalizeDocsMarkdownReferenceIdentifier(child.identifier);
        if (
          childInsidePrompt ||
          (promptDefinitions.has(identifier) && !pageDefinitions.has(identifier))
        ) {
          return createDocsMarkdownPromptReferenceText(child, source);
        }
      }

      isolateReferences(child, childInsidePrompt);
      return child;
    });
  };

  isolateReferences(root as DocsMarkdownPromptReferenceNode, false);
}

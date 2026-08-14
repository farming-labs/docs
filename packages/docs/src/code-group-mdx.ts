interface MarkdownNode {
  type: string;
  name?: string;
  children?: MarkdownNode[];
  lang?: string | null;
  meta?: string | null;
}

const codeGroupTitleAttributes = ["title", "filename", "file", "name", "label"] as const;
const ignoredBareMetaTokens = new Set([
  "copy",
  "no-copy",
  "nocopy",
  "line-numbers",
  "linenumbers",
  "runnable",
  "show-line-numbers",
  "showlinenumbers",
  "wrap",
]);

function escapeMetaAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function readCodeGroupTitleAttribute(meta: string): string | undefined {
  for (const name of codeGroupTitleAttributes) {
    const match = meta.match(new RegExp(`(?:^|\\s)${name}=["']([^"']+)["']`));
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return undefined;
}

function readBareCodeGroupTitle(meta: string): string | undefined {
  const token = meta
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .find((part) => part && !part.includes("=") && !ignoredBareMetaTokens.has(part.toLowerCase()));

  return token?.replace(/^["']|["']$/g, "");
}

function resolveCodeGroupCodeTitle(meta: string | null | undefined): string | undefined {
  const trimmed = meta?.trim();
  if (!trimmed) return undefined;

  return readCodeGroupTitleAttribute(trimmed) ?? readBareCodeGroupTitle(trimmed);
}

function ensureCodeGroupCodeTitle(node: MarkdownNode) {
  const title = resolveCodeGroupCodeTitle(node.meta);
  if (!title) return;

  const meta = node.meta?.trim() ?? "";
  if (/(?:^|\s)title=["']/.test(meta)) return;

  node.meta = `title="${escapeMetaAttribute(title)}"${meta ? ` ${meta}` : ""}`;
}

function visitCodeGroups(node: MarkdownNode) {
  if (node.type === "mdxJsxFlowElement" && node.name === "CodeGroup") {
    for (const child of node.children ?? []) {
      if (child.type === "code") ensureCodeGroupCodeTitle(child);
    }
  }

  for (const child of node.children ?? []) visitCodeGroups(child);
}

export function remarkCodeGroup() {
  return (tree: MarkdownNode) => {
    visitCodeGroups(tree);
  };
}

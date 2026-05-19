import { toDocsMarkdownUrl } from "@farming-labs/docs";

interface RemarkMarkdownAlternateOptions {
  entry?: string;
  appDir?: string;
  contentDir?: string;
  docsPath?: string;
  enabled?: boolean;
}

interface MarkdownNode {
  type: string;
  value?: string;
}

interface VFileLike {
  path?: string;
  history?: string[];
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function normalizeSegment(value: string | undefined, fallback: string): string {
  return (value ?? fallback).replace(/^\/+|\/+$/g, "") || fallback;
}

function normalizeDocsPath(value: string | undefined, entry: string): string {
  if (typeof value !== "string") return `/${entry}`;

  const cleaned = value.trim();
  if (cleaned === "" || cleaned === "/") return "";

  return `/${cleaned.replace(/^\/+|\/+$/g, "")}`;
}

function joinDocsPath(docsPath: string, slug: string): string {
  if (!slug) return docsPath || "/";
  return docsPath ? `${docsPath}/${slug}` : `/${slug}`;
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function routeFromSourcePath(
  filePath: string,
  options: RemarkMarkdownAlternateOptions,
): string | null {
  const normalized = `/${normalizePath(filePath).replace(/^\/+/, "")}`;
  if (!/\/page\.mdx?$/.test(normalized)) return null;

  const entry = normalizeSegment(options.entry, "docs");
  const candidates = [
    options.contentDir,
    options.appDir ? `${options.appDir}/${entry}` : undefined,
    `src/app/${entry}`,
    `app/${entry}`,
  ]
    .filter(
      (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0,
    )
    .map((candidate) => normalizePath(candidate).replace(/^\/+|\/+$/g, ""));

  for (const candidate of candidates) {
    const marker = `/${candidate}/`;
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex === -1) continue;

    const relativePath = normalized.slice(markerIndex + marker.length);
    if (!relativePath.endsWith("page.mdx") && !relativePath.endsWith("page.md")) continue;

    const slug = relativePath.replace(/\/?page\.mdx?$/, "").replace(/^\/+|\/+$/g, "");
    return joinDocsPath(normalizeDocsPath(options.docsPath, entry), slug);
  }

  return null;
}

function getFilePath(file?: VFileLike): string | undefined {
  return file?.path ?? file?.history?.[0];
}

function hasAlternates(yaml: string): boolean {
  return /^\s*alternates\s*:/m.test(yaml);
}

function alternateYaml(url: string): string {
  const markdownUrl = url === "/" ? "/docs.md" : toDocsMarkdownUrl(url);

  return ["alternates:", "  types:", `    text/markdown: "${escapeYamlString(markdownUrl)}"`].join(
    "\n",
  );
}

export default function remarkMarkdownAlternate(options: RemarkMarkdownAlternateOptions = {}) {
  return (tree: { children: MarkdownNode[] }, file?: VFileLike) => {
    if (options.enabled === false) return;

    const filePath = getFilePath(file);
    if (!filePath) return;

    const route = routeFromSourcePath(filePath, options);
    if (!route) return;

    const yamlNode = tree.children.find((node) => node.type === "yaml");
    if (yamlNode?.value) {
      if (hasAlternates(yamlNode.value)) return;
      yamlNode.value += `\n${alternateYaml(route)}`;
      return;
    }

    tree.children.unshift({
      type: "yaml",
      value: alternateYaml(route),
    });
  };
}

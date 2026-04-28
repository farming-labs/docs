import type { SidebarConfig, SidebarFolderIndexBehavior } from "./types.js";

export function resolveSidebarFolderIndexBehavior(
  sidebar: boolean | SidebarConfig | undefined,
): SidebarFolderIndexBehavior {
  if (sidebar === undefined || sidebar === true || sidebar === false) return "link";
  return sidebar.folderIndexBehavior === "toggle" ? "toggle" : "link";
}

export function applySidebarFolderIndexBehavior<TTree extends { children: unknown[] }>(
  tree: TTree,
  behavior: SidebarFolderIndexBehavior,
): TTree {
  if (behavior !== "toggle") return tree;

  function mapNode(node: unknown): unknown {
    if (!node || typeof node !== "object") return node;

    const candidate = node as {
      type?: string;
      index?: unknown;
      children?: unknown[];
      url?: unknown;
    };

    if (candidate.type !== "folder" || !Array.isArray(candidate.children)) {
      return node;
    }

    const children = candidate.children.map(mapNode);
    const index = candidate.index ? mapNode(candidate.index) : undefined;

    return {
      ...candidate,
      index: undefined,
      url: undefined,
      children: index ? [index, ...children] : children,
    };
  }

  return {
    ...tree,
    children: tree.children.map(mapNode),
  };
}

import type { SidebarConfig, SidebarFolderIndexBehavior } from "./types.js";

export interface SidebarFolderIndexBehaviorOptions {
  sidebar: boolean | SidebarConfig | undefined;
  defaultBehavior?: SidebarFolderIndexBehavior;
}

export function resolvePageSidebarFolderIndexBehavior(
  sidebar: unknown,
): SidebarFolderIndexBehavior | undefined {
  if (!sidebar || typeof sidebar !== "object") return undefined;

  const value = (sidebar as { folderIndexBehavior?: unknown }).folderIndexBehavior;
  return value === "link" || value === "toggle" ? value : undefined;
}

function normalizeSidebarFolderBehaviorPath(path: string | undefined): string | undefined {
  if (!path) return undefined;

  let value = path.trim();
  if (!value) return undefined;

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return undefined;
    }
  } else {
    value = value.split("#", 1)[0]?.split("?", 1)[0] ?? value;
  }

  if (!value.startsWith("/")) value = `/${value}`;

  const normalized = value.replace(/\/$/, "") || "/";
  return normalized;
}

export function resolveSidebarFolderIndexBehavior(
  sidebar: boolean | SidebarConfig | undefined,
  defaultBehavior: SidebarFolderIndexBehavior = "link",
): SidebarFolderIndexBehavior {
  if (sidebar === undefined || sidebar === true || sidebar === false) return defaultBehavior;
  if (sidebar.folderIndexBehavior === "toggle") return "toggle";
  if (sidebar.folderIndexBehavior === "link") return "link";
  return defaultBehavior;
}

export function resolveSidebarFolderIndexBehaviorForPath(
  sidebar: boolean | SidebarConfig | undefined,
  folderPath: string | undefined,
  defaultBehavior: SidebarFolderIndexBehavior = "link",
): SidebarFolderIndexBehavior {
  const fallback = resolveSidebarFolderIndexBehavior(sidebar, defaultBehavior);

  if (!sidebar || typeof sidebar !== "object") return fallback;

  const normalizedPath = normalizeSidebarFolderBehaviorPath(folderPath);
  if (!normalizedPath) return fallback;

  for (const [rawPath, override] of Object.entries(sidebar.folderIndexBehaviorOverrides ?? {})) {
    if (normalizeSidebarFolderBehaviorPath(rawPath) === normalizedPath) {
      return override === "link" || override === "toggle" ? override : fallback;
    }
  }

  return fallback;
}

export function applySidebarFolderIndexBehavior<TTree extends { children: unknown[] }>(
  tree: TTree,
  behaviorOrOptions: SidebarFolderIndexBehavior | SidebarFolderIndexBehaviorOptions,
): TTree {
  const resolveBehavior =
    typeof behaviorOrOptions === "string"
      ? () => behaviorOrOptions
      : (folderPath: string | undefined) =>
          resolveSidebarFolderIndexBehaviorForPath(
            behaviorOrOptions.sidebar,
            folderPath,
            behaviorOrOptions.defaultBehavior,
          );

  function mapNode(node: unknown): unknown {
    if (!node || typeof node !== "object") return node;

    const candidate = node as {
      type?: string;
      index?: unknown;
      children?: unknown[];
      url?: unknown;
      folderIndexBehavior?: unknown;
    };

    if (candidate.type !== "folder" || !Array.isArray(candidate.children)) {
      return node;
    }

    const children = candidate.children.map(mapNode);
    const index = candidate.index ? mapNode(candidate.index) : undefined;

    const folderPath =
      (typeof candidate.url === "string" ? candidate.url : undefined) ||
      (candidate.index &&
      typeof candidate.index === "object" &&
      "url" in candidate.index &&
      typeof (candidate.index as { url?: unknown }).url === "string"
        ? ((candidate.index as { url?: string }).url ?? undefined)
        : undefined);
    const explicitBehavior =
      candidate.folderIndexBehavior === "link" || candidate.folderIndexBehavior === "toggle"
        ? candidate.folderIndexBehavior
        : undefined;
    const behavior = explicitBehavior ?? resolveBehavior(folderPath);

    if (behavior !== "toggle") {
      return {
        ...candidate,
        folderIndexBehavior: undefined,
        index,
        children,
      };
    }

    return {
      ...candidate,
      folderIndexBehavior: undefined,
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

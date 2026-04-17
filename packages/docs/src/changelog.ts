import type { ChangelogFrontmatter, DocsConfig } from "./types.js";

export interface ResolvedChangelogConfig {
  enabled: boolean;
  path: string;
  contentDir: string;
  title: string;
  description?: string;
  search: boolean;
  actionsComponent?: unknown;
}

export interface ChangelogEntrySummary extends ChangelogFrontmatter {
  slug: string;
  date: string;
  url: string;
}

function normalizePathSegment(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback).trim().replace(/^\/+|\/+$/g, "");
  return normalized || fallback;
}

function normalizeContentDir(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "changelog";
  return trimmed.replace(/\/+$/, "") || "changelog";
}

export function resolveChangelogConfig(
  value: DocsConfig["changelog"],
): ResolvedChangelogConfig {
  if (value === false || value === undefined) {
    return {
      enabled: false,
      path: "changelog",
      contentDir: "changelog",
      title: "Changelog",
      description: undefined,
      search: true,
    };
  }

  if (value === true) {
    return {
      enabled: true,
      path: "changelog",
      contentDir: "changelog",
      title: "Changelog",
      description: undefined,
      search: true,
    };
  }

  return {
    enabled: value.enabled !== false,
    path: normalizePathSegment(value.path, "changelog"),
    contentDir: normalizeContentDir(value.contentDir),
    title: value.title?.trim() || "Changelog",
    description: value.description?.trim() || undefined,
    search: value.search !== false,
    actionsComponent: value.actionsComponent,
  };
}

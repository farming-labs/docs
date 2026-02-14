import type { DocsMetadata, OGConfig, PageFrontmatter } from "./types.js";

/**
 * Resolve page title using metadata titleTemplate.
 * %s is replaced with page title.
 */
export function resolveTitle(
  pageTitle: string,
  metadata?: DocsMetadata
): string {
  const template = metadata?.titleTemplate ?? "%s";
  return template.replace("%s", pageTitle);
}

/**
 * Resolve OG image URL for a page.
 */
export function resolveOGImage(
  page: PageFrontmatter,
  ogConfig?: OGConfig,
  baseUrl?: string
): string | undefined {
  if (!ogConfig?.enabled) return undefined;

  // Page-specific OG image from frontmatter
  if (page.ogImage) {
    return page.ogImage.startsWith("/") || page.ogImage.startsWith("http")
      ? page.ogImage
      : `${baseUrl ?? ""}${page.ogImage}`;
  }

  // Dynamic: endpoint generates per-page OG
  if (ogConfig.type === "dynamic" && ogConfig.endpoint) {
    return `${baseUrl ?? ""}${ogConfig.endpoint}`;
  }

  return ogConfig.defaultImage;
}

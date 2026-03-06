import type {
  DocsMetadata,
  OGConfig,
  PageFrontmatter,
  PageOpenGraph,
  PageTwitter,
} from "./types.js";

/**
 * Resolve page title using metadata titleTemplate.
 * %s is replaced with page title.
 */
export function resolveTitle(pageTitle: string, metadata?: DocsMetadata): string {
  const template = metadata?.titleTemplate ?? "%s";
  return template.replace("%s", pageTitle);
}

/**
 * Resolve OG image URL for a page.
 * Prefers page.openGraph.images[0], then page.ogImage, then config endpoint/default.
 */
export function resolveOGImage(
  page: PageFrontmatter,
  ogConfig?: OGConfig,
  baseUrl?: string,
): string | undefined {
  if (page.openGraph?.images?.length) {
    return resolveImageUrl(page.openGraph.images[0].url, baseUrl);
  }
  if (!ogConfig?.enabled) return undefined;

  if (page.ogImage) {
    return resolveImageUrl(page.ogImage, baseUrl);
  }

  if (ogConfig.type === "dynamic" && ogConfig.endpoint) {
    return `${baseUrl ?? ""}${ogConfig.endpoint}`;
  }

  return ogConfig.defaultImage;
}

function resolveImageUrl(url: string, baseUrl?: string): string {
  if (url.startsWith("/") || url.startsWith("http")) return url;
  const base = baseUrl ?? "";
  const sep = base.length > 0 && !base.endsWith("/") ? "/" : "";
  return `${base}${sep}${url}`;
}

/**
 * Build the Open Graph metadata object for a page.
 * When the page has openGraph in frontmatter, uses it (with title/description filled from page if omitted).
 * Otherwise uses ogImage or config (dynamic endpoint / defaultImage).
 */
export function buildPageOpenGraph(
  page: Pick<PageFrontmatter, "title" | "description" | "ogImage" | "openGraph">,
  ogConfig?: OGConfig,
  baseUrl?: string,
): PageOpenGraph | undefined {
  if (page.openGraph) {
    const images = page.openGraph.images?.length
      ? page.openGraph.images.map((img) => ({
          url: resolveImageUrl(img.url, baseUrl),
          width: img.width ?? 1200,
          height: img.height ?? 630,
        }))
      : undefined;
    return {
      title: page.openGraph.title ?? page.title,
      description: page.openGraph.description ?? page.description,
      ...(images && { images }),
    };
  }
  const url = resolveOGImage(page as PageFrontmatter, ogConfig, baseUrl);
  if (!url) return undefined;
  return {
    title: page.title,
    ...(page.description && { description: page.description }),
    images: [{ url, width: 1200, height: 630 }],
  };
}

/**
 * Build the Twitter card metadata object for a page.
 * When the page has twitter in frontmatter, uses it.
 * Otherwise builds from ogImage or config (dynamic endpoint).
 */
export function buildPageTwitter(
  page: Pick<PageFrontmatter, "title" | "description" | "ogImage" | "openGraph" | "twitter">,
  ogConfig?: OGConfig,
  baseUrl?: string,
): PageTwitter | undefined {
  if (page.twitter) {
    const images = page.twitter.images?.length
      ? page.twitter.images.map((url) => resolveImageUrl(url, baseUrl))
      : undefined;
    return {
      ...(page.twitter.card && { card: page.twitter.card }),
      ...(page.twitter.title !== undefined && { title: page.twitter.title }),
      ...(page.twitter.description !== undefined && { description: page.twitter.description }),
      ...(images && { images }),
    };
  }
  const url = resolveOGImage(page as PageFrontmatter, ogConfig, baseUrl);
  if (!url) return undefined;
  return {
    card: "summary_large_image",
    title: page.title,
    ...(page.description && { description: page.description }),
    images: [url],
  };
}

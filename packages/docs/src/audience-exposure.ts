/** The two content projections emitted by the docs framework. */
export type DocsContentAudience = "human" | "agent";

/**
 * A page-level audience restriction. `"agent"` pages have no human projection: they are left out
 * of navigation, human search, `sitemap.xml`, and HTML routes, and stay on machine surfaces such
 * as `{page}.md`, markdown negotiation, `llms.txt`, `sitemap.md`, and MCP.
 */
export type DocsPageAudience = "agent";

/** Resolve whether content with an optional audience restriction is visible. */
export function resolveDocsAudienceExposure(only: unknown, audience: DocsContentAudience): boolean {
  return (only !== "human" && only !== "agent") || only === audience;
}

/** Normalize a page's frontmatter `audience` value. Unknown values keep the page public. */
export function resolveDocsPageAudience(value: unknown): DocsPageAudience | undefined {
  return value === "agent" ? "agent" : undefined;
}

/** Whether a page belongs to the given audience projection. */
export function isDocsPageVisibleToAudience(
  page: { audience?: unknown } | null | undefined,
  audience: DocsContentAudience,
): boolean {
  return audience === "agent" || resolveDocsPageAudience(page?.audience) === undefined;
}

/** Keep only the pages that belong to the given audience projection. */
export function filterDocsPagesByAudience<T extends { audience?: unknown }>(
  pages: readonly T[],
  audience: DocsContentAudience,
): T[] {
  return audience === "agent"
    ? [...pages]
    : pages.filter((page) => isDocsPageVisibleToAudience(page, audience));
}

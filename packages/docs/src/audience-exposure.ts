/** The two content projections emitted by the docs framework. */
export type DocsContentAudience = "human" | "agent";

/** Resolve whether content with an optional audience restriction is visible. */
export function resolveDocsAudienceExposure(only: unknown, audience: DocsContentAudience): boolean {
  return (only !== "human" && only !== "agent") || only === audience;
}

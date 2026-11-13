import type { DocsMdxOptions } from "@farming-labs/docs";

export type { DocsMdxPlugin, DocsMdxValue } from "@farming-labs/docs";

export interface WithDocsOptions {
  /** Per-page metadata for compatible production MDX routes. Use "site" for the legacy transport. */
  pageMetadata?: "auto" | "site";
  /** @deprecated Set `mdx` in `defineDocs` and pass the config: `withDocs(nextConfig, docsConfig)`. */
  mdx?: DocsMdxOptions;
}

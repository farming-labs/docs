import { DocsBuildCache, docsBuildCacheDigest } from "@farming-labs/docs/build";
import type mdx from "@mdx-js/rollup";

type CompiledMdx = Awaited<ReturnType<ReturnType<typeof mdx>["transform"]>>;

export const mdxCacheDigest = docsBuildCacheDigest;

/** Only the adapter's deterministic MDX stage is cached, never the Vite graph. */
export class MdxBuildCache extends DocsBuildCache<CompiledMdx> {
  constructor(file: string, maxBytes?: number, maxEntries?: number) {
    super(file, {
      maxBytes,
      maxEntries,
      validate: (value) =>
        value !== null &&
        typeof value === "object" &&
        "code" in value &&
        typeof value.code === "string",
    });
  }
}

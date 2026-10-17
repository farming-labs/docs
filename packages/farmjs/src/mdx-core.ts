import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type * as Core from "@farming-labs/docs";
import type * as Server from "@farming-labs/docs/server";

// Keep emitted declarations compatible with older supported core packages.
type CoreMdx = Pick<
  typeof Core,
  | "applyDocsMarkdownHeadingAnchors"
  | "encodeDocsHeadingTocUrls"
  | "isolateDocsMarkdownPromptReferences"
  | "withDocsMarkdownRenderableHeadings"
> &
  Pick<typeof Server, "remarkCodeGroup">;

let compilerEntry: string | undefined;
try {
  compilerEntry = import.meta.resolve("@farming-labs/docs/mdx");
} catch (error) {
  // Fall back only when the older core lacks this export. A broken compiler
  // must still report its error instead of silently loading another module.
  if ((error as NodeJS.ErrnoException).code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
}

// Farm requires Node >=22.13, which supports synchronous ESM loading. Avoid
// top-level await so existing CommonJS configs can still require the adapter.
const require = createRequire(import.meta.url);
const helpers: CoreMdx = compilerEntry
  ? require(fileURLToPath(compilerEntry))
  : {
      ...require(fileURLToPath(import.meta.resolve("@farming-labs/docs"))),
      ...require(fileURLToPath(import.meta.resolve("@farming-labs/docs/server"))),
    };

export const {
  applyDocsMarkdownHeadingAnchors,
  encodeDocsHeadingTocUrls,
  isolateDocsMarkdownPromptReferences,
  remarkCodeGroup,
  withDocsMarkdownRenderableHeadings,
} = helpers;

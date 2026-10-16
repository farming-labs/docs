import type * as Core from "@farming-labs/docs";
import type * as Server from "@farming-labs/docs/server";

// Keep emitted declarations compatible with older core packages as well.
type CoreMdx = Pick<
  typeof Core,
  | "applyDocsMarkdownHeadingAnchors"
  | "encodeDocsHeadingTocUrls"
  | "withDocsMarkdownRenderableHeadings"
  | "isolateDocsMarkdownPromptReferences"
> &
  Pick<typeof Server, "remarkCodeGroup">;

let compilerEntry: string | undefined;
try {
  compilerEntry = import.meta.resolve("@farming-labs/docs/mdx");
} catch (error) {
  // Older supported core versions expose these helpers through their barrels.
  // Only fall back for a missing export, never for a broken compiler module.
  if ((error as NodeJS.ErrnoException).code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
}

const helpers: CoreMdx = compilerEntry
  ? await import(compilerEntry)
  : {
      ...(await import("@farming-labs/docs")),
      ...(await import("@farming-labs/docs/server")),
    };

export const {
  remarkCodeGroup,
  applyDocsMarkdownHeadingAnchors,
  encodeDocsHeadingTocUrls,
  withDocsMarkdownRenderableHeadings,
  isolateDocsMarkdownPromptReferences,
} = helpers;

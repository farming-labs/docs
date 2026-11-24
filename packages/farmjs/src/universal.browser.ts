/**
 * `@farming-labs/farmjs/universal` in the browser, through the package's `browser` condition. It
 * leaves out the Markdown renderer, which compiles pages with React on the server, so no browser
 * bundle carries React or the compiled pages.
 */
import type { FarmDocsPageRenderInput } from "./server.js";

export {
  attachFarmDocsBehaviors,
  createFarmDocsLayout,
  hydrateFarmDocs,
  type FarmDocsCreateElement,
  type FarmDocsLayoutInput,
  type FarmDocsUniversalRoot,
} from "./universal-ui.js";

/** Runs on the server only. The browser hydrates the page the server rendered. */
export function renderFarmDocsPage(_input: FarmDocsPageRenderInput): never {
  throw new Error("renderFarmDocsPage() runs on the server; the browser calls hydrateFarmDocs().");
}

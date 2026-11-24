/**
 * `@farming-labs/farmjs/universal` on the server: the docs UI for an app on any Farm renderer.
 * Browsers resolve `universal.browser.ts` instead, which leaves out the Markdown renderer.
 */
import type { FarmDocsPageRenderInput } from "./server.js";
import { renderFarmDocsContentHtml } from "./universal-content.js";
import {
  createFarmDocsLayout,
  missingRenderer,
  type FarmDocsCreateElement,
} from "./universal-ui.js";

export {
  attachFarmDocsBehaviors,
  createFarmDocsLayout,
  hydrateFarmDocs,
  type FarmDocsCreateElement,
  type FarmDocsLayoutInput,
  type FarmDocsUniversalRoot,
} from "./universal-ui.js";

/** Renders a docs page's HTML on the server with the app's renderer. */
export async function renderFarmDocsPage(input: FarmDocsPageRenderInput): Promise<string> {
  const { renderer } = input;
  if (!renderer) throw missingRenderer("server");
  const contentHtml = await renderFarmDocsContentHtml(input.config, input.data);
  return renderer.renderToString(
    createFarmDocsLayout(renderer.createElement as FarmDocsCreateElement, {
      config: input.config,
      data: input.data,
      contentHtml,
    }),
  );
}

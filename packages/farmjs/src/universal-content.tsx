/**
 * The HTML of a docs page's Markdown, for the renderer-neutral UI. Server only: browsers resolve
 * `@farming-labs/farmjs/universal` to `universal.browser.ts`, which does not import it, so no
 * browser bundle carries the compiled pages or React.
 *
 * Pages compile with the same MDX pipeline and theme components as the React UI's, and React's
 * string renderer writes them out, so a page reads the same under any app renderer.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocsConfig } from "@farming-labs/docs";
import type { DocsServerLoadResult } from "./server.js";
import { getFarmDocsMDXComponents } from "./page.js";
import { createFarmDocsPageModules, type FarmDocsMdxModule } from "./page-modules.js";

const pageModules = createFarmDocsPageModules(
  import.meta.glob<FarmDocsMdxModule>("/**/*.{md,mdx}"),
);

export async function renderFarmDocsContentHtml(
  config: DocsConfig,
  data: DocsServerLoadResult,
): Promise<string> {
  await pageModules.load(data);
  const Content = pageModules.get(data)?.default;
  if (!Content) {
    throw new Error(
      `No compiled Markdown module for ${JSON.stringify(data.sourcePath)}. The docs Vite ` +
        "plugin compiles pages under the app root; keep withDocs() around the Farm config.",
    );
  }
  return renderToStaticMarkup(
    createElement(Content, { components: getFarmDocsMDXComponents(config) }),
  );
}

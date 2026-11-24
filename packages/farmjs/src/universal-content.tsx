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
import type { FarmDocsTocItem } from "./universal-ui.js";

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

const HEADING = /<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/g;
const ENTITY = /&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi;
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(ENTITY, (_, decimal: string, hex: string, name: string) =>
    decimal
      ? String.fromCodePoint(Number(decimal))
      : hex
        ? String.fromCodePoint(Number.parseInt(hex, 16))
        : NAMED_ENTITIES[name.toLowerCase()]!,
  );
}

/**
 * The page's table of contents: the h2 to h4 headings with an id in the HTML React wrote for its
 * Markdown, as the React UI reads them from the page in the browser, without the text of their
 * copy-link buttons.
 */
export function farmDocsTocFromHtml(html: string): FarmDocsTocItem[] {
  const items: FarmDocsTocItem[] = [];
  for (const [, level, attributes, inner] of html.matchAll(HEADING)) {
    const id = /\sid="([^"]*)"/.exec(attributes!)?.[1];
    if (!id) continue;
    const text = inner!.replace(/<button\b[\s\S]*?<\/button>/g, "").replace(/<[^>]*>/g, "");
    items.push({
      title: decodeEntities(text).replace(/^#\s*/, "").trim(),
      url: `#${decodeEntities(id)}`,
      depth: Number(level),
    });
  }
  return items;
}

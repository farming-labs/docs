import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { createDocsMarkdownParser } from "./markdown-parser.js";

const documents = [
  "# Café 配置\r\n\r\n## Same [#custom]\r\n\r\n## Same\r\n",
  "# [Linked][ref] and ![image](./image.png)\n\n[ref]: /docs\n",
  "<Agent>\n\n## Agent instructions\n\n</Agent>\n\n<Human>Visible</Human>",
  '<Audience only={"agent"}>\n\nContent\n\n</Audience>\n\n<Prompt>\n\n## Literal\n\n</Prompt>',
  'export const config = { title: "value" }\n\n{config.title && <Agent>expression</Agent>}',
  "> ## Quoted\n>\n> - nested\n>\n>   ```mdx\n>   <Agent>literal</Agent>\n>   ```",
  "| Name | Type |\n| --- | --- |\n| value | `string` |\n\n- [x] task\n\n~~removed~~ https://example.com\n\nFootnote[^1]\n\n[^1]: Note",
  '<!-- HTML -->\n\n<div data-kind="example">HTML</div>\n\n<script>const value = 1;</script>',
];

function parseResult(parser: { parse: (source: string) => unknown }, source: string) {
  try {
    return { tree: parser.parse(source) };
  } catch (error) {
    const failure = error as Error & {
      reason?: string;
      place?: unknown;
      ruleId?: string;
      source?: string;
    };
    return {
      error: {
        message: failure.message,
        reason: failure.reason,
        place: failure.place,
        ruleId: failure.ruleId,
        source: failure.source,
      },
    };
  }
}

describe("parse-only Markdown pipeline", () => {
  for (const format of ["md", "mdx"] as const) {
    for (const gfm of [false, true]) {
      it(`preserves compiler parse trees and error positions (${format}, GFM ${gfm})`, () => {
        const previous = createProcessor({ format, remarkPlugins: gfm ? [remarkGfm] : [] });
        const parser = createDocsMarkdownParser(format);
        if (gfm) parser.use(remarkGfm);
        for (const source of [...documents, "<Agent>\n\nUnclosed", "{unfinished", "import {"]) {
          expect(parseResult(parser, source), source).toEqual(parseResult(previous, source));
        }
      });
    }
  }
});

import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown.js";

describe("renderMarkdown block placeholders", () => {
  it("keeps authored placeholder-like text separate from rendered blocks", async () => {
    const html = await renderMarkdown(
      [
        "%%CALLOUT_0%%",
        "",
        "%%CODEBLOCK_0%%",
        "",
        "<Callout>Real callout content.</Callout>",
        "",
        "```js",
        'console.log("real code");',
        "```",
      ].join("\n"),
    );

    expect(html).toContain("%%CALLOUT_0%%");
    expect(html).toContain("%%CODEBLOCK_0%%");
    expect(html.match(/class="fd-callout fd-callout-/gu)).toHaveLength(1);
    expect(html.match(/console\.log/gu)).toHaveLength(1);
    expect(html.indexOf("%%CALLOUT_0%%")).toBeLessThan(html.indexOf("Real callout content."));
    expect(html.indexOf("%%CODEBLOCK_0%%")).toBeLessThan(html.indexOf("console.log"));
  });
});

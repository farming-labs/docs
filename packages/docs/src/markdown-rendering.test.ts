import { describe, expect, it } from "vitest";
import {
  createDocsMarkdownBlockPlaceholderAllocator,
  extractDocsMarkdownReferenceDefinitions,
  extractDocsRenderedHeadingElements,
  prepareDocsMarkdownHeadings,
  replaceDocsMarkdownFencedCodeBlocks,
  renderDocsMarkdownBlockContent,
  renderDocsMarkdownHeadings,
  renderDocsMarkdownInline,
  restoreDocsMarkdownHeadingOpeningTags,
} from "./markdown-rendering.js";

describe("shared Markdown rendering helpers", () => {
  it("carries canonical anchors through frontmatter, containers, and Setext headings", () => {
    const prepared = prepareDocsMarkdownHeadings(`---
title: Anchors
---

> \`\`\`
> code

## Outside

> Quoted
>===

- Listed
  ===
`);
    const rendered = renderDocsMarkdownHeadings(prepared.markdown, prepared.headings);
    const html = restoreDocsMarkdownHeadingOpeningTags(rendered.markdown, rendered.openingTags);

    expect(html).toContain('<h2 id="outside">Outside</h2>');
    expect(html).toContain('> <h1 id="quoted">Quoted</h1>');
    expect(html).toContain('- <h1 id="listed">Listed</h1>');
    expect(html).not.toContain("FARMINGLABS_DOCS_HEADING_ANCHOR");
  });

  it("keeps BOM-prefixed frontmatter out of canonical heading preparation", () => {
    const prepared = prepareDocsMarkdownHeadings(
      "\uFEFF---\ntitle: Not a heading\n---\n\n## Visible",
    );
    const rendered = renderDocsMarkdownHeadings(prepared.markdown, prepared.headings);
    const html = restoreDocsMarkdownHeadingOpeningTags(rendered.markdown, rendered.openingTags);

    expect(prepared.headings).toHaveLength(1);
    expect(html).toContain('<h2 id="visible">Visible</h2>');
    expect(html).not.toContain('id="title-not-a-heading"');
  });

  it("preserves every line of multiline Setext headings and consumes the underline", () => {
    const prepared = prepareDocsMarkdownHeadings(`First *line*
second \`line\`
---

10. Nested first
    nested second
    ---

Custom first
custom second [#custom-setext]
---
`);
    const rendered = renderDocsMarkdownHeadings(prepared.markdown, prepared.headings);
    const html = restoreDocsMarkdownHeadingOpeningTags(rendered.markdown, rendered.openingTags);

    expect(html).toContain('<h2 id="first-line-second-line">First *line* second `line`</h2>');
    expect(html).toContain(
      '10. <h2 id="nested-first-nested-second">Nested first nested second</h2>',
    );
    expect(html).toContain('<h2 id="custom-setext">Custom first custom second</h2>');
    expect(html).not.toContain("[#custom-setext]");
    expect(html).not.toContain("---");
  });

  it("keeps resolved shortcut links visible instead of consuming them as custom ids", () => {
    const markdown = "## [#foo]\n\n[#foo]: /guide";
    const references = extractDocsMarkdownReferenceDefinitions(markdown);
    const prepared = prepareDocsMarkdownHeadings(markdown);
    const preparedWithoutReferences = extractDocsMarkdownReferenceDefinitions(
      prepared.markdown,
    ).markdown;
    const rendered = renderDocsMarkdownHeadings(preparedWithoutReferences, prepared.headings);
    const html = renderDocsMarkdownInline(
      restoreDocsMarkdownHeadingOpeningTags(rendered.markdown, rendered.openingTags),
      references.definitions,
    );

    expect(html).toContain('<h2 id="foo"><a href="/guide">#foo</a></h2>');
  });

  it("renders balanced and reference resources while preserving unresolved literals", () => {
    const extracted = extractDocsMarkdownReferenceDefinitions(
      [
        "![Rocket](assets/a(b).png) ![Rocket] ![Rocket &amp;] ![Missing]",
        "",
        '[Rocket]: /rocket.png "Ship"',
        "[Rocket &]: /entity.png",
      ].join("\n"),
    );
    const html = renderDocsMarkdownInline(extracted.markdown, extracted.definitions);

    expect(html).toContain('src="assets/a(b).png"');
    expect(html).toContain('src="/rocket.png"');
    expect(html).toContain('src="/entity.png"');
    expect(html).toContain('title="Ship"');
    expect(html).toContain("![Missing]");
    expect(html).not.toContain("[Rocket]:");
  });

  it("renders linked images recursively and keeps the first reference definition", () => {
    const extracted = extractDocsMarkdownReferenceDefinitions(
      [
        "[![Rocket][image]][guide]",
        "",
        "[image]: /rocket-first.png",
        "[IMAGE]: /rocket-second.png",
        "[guide]: /guide-first",
        "[GUIDE]: /guide-second",
      ].join("\n"),
    );
    const html = renderDocsMarkdownInline(extracted.markdown, extracted.definitions);

    expect(html).toContain(
      '<a href="/guide-first"><img src="/rocket-first.png" alt="Rocket" class="fd-docs-content-img"',
    );
    expect(html).not.toContain("rocket-second.png");
    expect(html).not.toContain("guide-second");
  });

  it("keeps heading elements outside generated paragraphs", () => {
    const html = renderDocsMarkdownBlockContent(
      '<h2 id="verify">Verify</h2>\n\nRun **tests**.',
      new Map(),
    );

    expect(html).toBe('<h2 id="verify">Verify</h2><p>Run <strong>tests</strong>.</p>');
  });

  it("keeps code-block placeholders outside generated paragraphs", () => {
    const html = renderDocsMarkdownBlockContent("Before.\n\n%%CODEBLOCK_0%%\n\nAfter.", new Map());

    expect(html).toBe("<p>Before.</p>%%CODEBLOCK_0%%<p>After.</p>");
  });

  it("keeps every nested component placeholder outside callout paragraphs", () => {
    const placeholders = [
      "%%CODEBLOCK_0%%",
      "%%CALLOUT_1%%",
      "%%TABS_2%%",
      "%%PROMPT_3%%",
      "%%HOVERLINK_4%%",
    ];
    const html = renderDocsMarkdownBlockContent(
      ["Before.", "", ...placeholders.flatMap((placeholder) => [placeholder, ""]), "After."].join(
        "\n",
      ),
      new Map(),
    );

    expect(html).toBe(`<p>Before.</p>${placeholders.join("")}<p>After.</p>`);
    expect(html).not.toContain("<p>%%");
  });

  it("allocates block placeholders around authored token-like text", () => {
    const allocate = createDocsMarkdownBlockPlaceholderAllocator(
      ["%%CALLOUT_0%%", "%%CALLOUT_1%%", "%%CODEBLOCK_0%%"].join("\n"),
    );

    expect(allocate("CALLOUT")).toBe("%%CALLOUT_2%%");
    expect(allocate("CALLOUT")).toBe("%%CALLOUT_3%%");
    expect(allocate("CODEBLOCK")).toBe("%%CODEBLOCK_1%%");
    expect(allocate("TABS")).toBe("%%TABS_0%%");
  });

  it("extracts only protected pipeline headings and leaves authored HTML in content", () => {
    const prepared = prepareDocsMarkdownHeadings(
      [
        "## Real",
        "",
        '<h2 id="authored" onclick="alert(1)">Authored HTML</h2>',
        "",
        "```html",
        "<h2>Example only</h2>",
        "```",
        "",
        "> ~~~html",
        "> <h2>Quoted example only</h2>",
        "> ~~~",
        "",
        "- ````html",
        "  <h2>Listed example only</h2>",
        "  ````",
      ].join("\n"),
    );
    const rendered = renderDocsMarkdownHeadings(prepared.markdown, prepared.headings);
    const extracted = extractDocsRenderedHeadingElements(
      rendered.markdown,
      new Map(),
      false,
      rendered.openingTags,
    );

    expect(extracted.headingsHtml).toBe('<h2 id="real">Real</h2>');
    expect(extracted.content).toContain('<h2 id="authored" onclick="alert(1)">Authored HTML</h2>');
    expect(extracted.content).toContain("```html\n<h2>Example only</h2>\n```");
    expect(extracted.content).toContain("> <h2>Quoted example only</h2>");
    expect(extracted.content).toContain("  <h2>Listed example only</h2>");
  });

  it("replaces tilde and length-matched backtick fences without closing early", () => {
    const source = [
      "~~~html",
      "<h2>Tilde example</h2>",
      "~~~",
      "",
      "````markdown",
      "```html",
      "<h2>Nested example</h2>",
      "```",
      "````",
    ].join("\n");
    const blocks: Array<{ code: string; info: string; marker: string }> = [];
    const rendered = replaceDocsMarkdownFencedCodeBlocks(source, (block, index) => {
      blocks.push({ code: block.code, info: block.info, marker: block.marker });
      return `BLOCK_${index}`;
    });

    expect(blocks).toEqual([
      {
        code: "<h2>Tilde example</h2>\n",
        info: "html",
        marker: "~",
      },
      {
        code: "```html\n<h2>Nested example</h2>\n```\n",
        info: "markdown",
        marker: "`",
      },
    ]);
    expect(rendered).toBe("BLOCK_0\n\nBLOCK_1");
  });

  it("treats an unclosed fence as code through the end of the document", () => {
    for (const source of [
      "~~~html\n<h2>Tilde example</h2>",
      "````markdown\n```html\n<h2>Nested example</h2>\n```",
    ]) {
      const blocks: Array<{ code: string; info: string; marker: string }> = [];
      const rendered = replaceDocsMarkdownFencedCodeBlocks(source, (block) => {
        blocks.push({ code: block.code, info: block.info, marker: block.marker });
        return "BLOCK";
      });

      expect(rendered).toBe("BLOCK");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.code).toContain("<h2>");
    }
  });

  it("replaces fenced code inside blockquote and list containers", () => {
    const source = [
      "> ~~~html",
      "> <h2>Quote example</h2>",
      "> ~~~",
      "",
      "- ````markdown",
      "  ```html",
      "  <h2>List example</h2>",
      "  ```",
      "  ````",
    ].join("\n");
    const blocks: string[] = [];
    const rendered = replaceDocsMarkdownFencedCodeBlocks(source, (block, index) => {
      blocks.push(block.code);
      return `BLOCK_${index}`;
    });

    expect(blocks).toEqual(["<h2>Quote example</h2>\n", "```html\n<h2>List example</h2>\n```\n"]);
    expect(rendered).toBe("> BLOCK_0\n\n- BLOCK_1");
  });

  it("preserves the line after an implicitly closed container fence", () => {
    const rendered = replaceDocsMarkdownFencedCodeBlocks(
      ["> ~~~html", "> <h2>Quote example</h2>", "## Outside"].join("\n"),
      () => "BLOCK",
    );

    expect(rendered).toBe("> BLOCK\n## Outside");
  });

  it("preserves authored text that resembles internal transport tokens", () => {
    const authoredTokens = [
      "%%FARMINGLABS_DOCS_HEADING_ANCHOR_0%%",
      "%%FARMINGLABS_DOCS_HEADING_OPEN_0%%",
      "%%FARMINGLABS_DOCS_INLINE_LITERAL_0%%",
      "\uE100FARMINGLABS_DOCS_ANCHOR_0_0\uE101",
      "\uE100FARMINGLABS_DOCS_OPEN_0_0\uE101",
      "\uE100FARMINGLABS_DOCS_INLINE_0_0\uE101",
    ];
    const markdown = `## Real\n\n${authoredTokens.join(" ")}`;
    const prepared = prepareDocsMarkdownHeadings(markdown);
    const rendered = renderDocsMarkdownHeadings(prepared.markdown, prepared.headings);
    const html = restoreDocsMarkdownHeadingOpeningTags(rendered.markdown, rendered.openingTags);
    const inline = renderDocsMarkdownInline(
      `${authoredTokens.join(" ")} \`code\` \\*literal\\*`,
      new Map(),
    );

    for (const token of authoredTokens) {
      expect(html).toContain(token);
      expect(inline).toContain(token);
    }
    expect(html).toContain('<h2 id="real">Real</h2>');
    expect(inline).toContain("<code>code</code> *literal*");
  });
});

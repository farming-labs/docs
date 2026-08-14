import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown.js";

describe("renderMarkdown heading anchors", () => {
  it("uses canonical Unicode, explicit, duplicate, and collision-safe ids", async () => {
    const html = await renderMarkdown(`# Café 配置

## Overview [#release-overview]

## Entity [#foo&amp;bar]

## Repeat

First.

### Repeat

Second.

## Foo

## Foo

## Foo-1

Setext heading
---------------
`);

    expect(html).toContain('<h1 id="café-配置">Café 配置</h1>');
    expect(html).toContain('<h2 id="release-overview">Overview</h2>');
    expect(html).toContain('<h2 id="foo&amp;bar">Entity</h2>');
    expect(html).not.toContain("foo&amp;amp;bar");
    expect(html).toContain('<h2 id="repeat">Repeat</h2>');
    expect(html).toContain('<h3 id="repeat-1">Repeat</h3>');
    expect(html).toContain('<h2 id="foo">Foo</h2>');
    expect(html).toContain('<h2 id="foo-1">Foo</h2>');
    expect(html).toContain('<h2 id="foo-1-1">Foo-1</h2>');
    expect(html).toContain('<h2 id="setext-heading">Setext heading</h2>');
    expect(html).not.toContain("[#release-overview]");
  });

  it("renders addressable headings inside custom MDX blocks", async () => {
    const html = await renderMarkdown(`<Callout>
## Repeat
</Callout>

<Tabs items={["One"]}>
<Tab value="One">
### Repeat
</Tab>
</Tabs>

## Repeat
`);

    expect(html).toContain('<h2 id="repeat">Repeat</h2>');
    expect(html).toContain('<h3 id="repeat-1">Repeat</h3>');
    expect(html).toContain('<h2 id="repeat-2">Repeat</h2>');
    expect(html).not.toContain("FARMINGLABS_DOCS_HEADING_ANCHOR");
  });

  it("normalizes CRLF input without changing canonical anchors", async () => {
    const html = await renderMarkdown("## Repeat\r\n\r\n## Repeat\r\n");

    expect(html).toContain('<h2 id="repeat">Repeat</h2>');
    expect(html).toContain('<h2 id="repeat-1">Repeat</h2>');
    expect(html).not.toContain("\r");
  });

  it("renders complex and container heading anchors consistently", async () => {
    const html = await renderMarkdown(`## [Balanced](https://example.com/a_(b)c) Link

## ![Rocket](assets/a(b).png) Setup

## \\[literal\\](url) text

## Hello <Badge title="a > b">New</Badge> World

> ## Quoted

- ## Listed
`);

    expect(html).toContain('id="balanced-link"');
    expect(html).toContain('id="setup"');
    expect(html).toContain('id="literalurl-text"');
    expect(html).toContain('id="hello-new-world"');
    expect(html).toContain('id="quoted"');
    expect(html).toContain('id="listed"');
  });

  it("renders balanced, reference, unresolved, and escaped inline resources safely", async () => {
    const html = await renderMarkdown(`## ![Rocket](assets/a(b).png) Setup

## ![Rocket] Shortcut setup

## ![Missing] Literal setup

## \\[literal\\](url) text

[Rocket]: /rocket.png "Rocket ship"
`);

    expect(html).toContain('<img src="assets/a(b).png" alt="Rocket" class="fd-docs-content-img"');
    expect(html).toContain('<img src="/rocket.png" alt="Rocket" class="fd-docs-content-img');
    expect(html).toContain('title="Rocket ship"');
    expect(html).toContain('<h2 id="missing-literal-setup">![Missing] Literal setup</h2>');
    expect(html).toContain('<h2 id="literalurl-text">[literal](url) text</h2>');
    expect(html).not.toContain('href="url"');
    expect(html).not.toContain("[Rocket]:");
    expect(html).not.toContain(".png) Setup");
  });

  it("renders a resolved hash shortcut link without treating it as a custom id", async () => {
    const html = await renderMarkdown(`## [#foo]

[#foo]: /guide
`);

    expect(html).toContain('<h2 id="foo"><a href="/guide">#foo</a></h2>');
    expect(html).not.toContain('<h2 id="foo"></h2>');
  });

  it("keeps nested heading markup valid and protects explicit ids from inline formatting", async () => {
    const html = await renderMarkdown(`> ## Quoted

<Callout>
## Nested

Body.
</Callout>

## *Styled* [#foo*bar]
`);

    expect(html).toContain('<blockquote><h2 id="quoted">Quoted</h2></blockquote>');
    expect(html).toContain(
      '<div class="fd-callout-content"><p class="fd-callout-title">Note</p><h2 id="nested">Nested</h2><p>Body.</p></div>',
    );
    expect(html).toContain('<h2 id="foo*bar"><em>Styled</em></h2>');
    expect(html).not.toMatch(/<p>\s*<(?:h[1-6]|blockquote|div)\b/);
  });

  it("keeps literal Prompt headings out while preserving rendered component headings", async () => {
    const html = await renderMarkdown(`<Prompt>
## Prompt heading [#prompt-only]

Do this.
</Prompt>

## Prompt heading

<HoverLink href="/guide" title="Guide" description="Read it">
## Hover heading
</HoverLink>

<CodeGroup>
## Code heading

\`\`\`ts title="example.ts"
const value = 1
\`\`\`
</CodeGroup>
`);

    expect(html).toContain('<h2 id="prompt-heading">Prompt heading</h2>');
    expect(html.match(/<h2 id="prompt-heading">/g)).toHaveLength(1);
    expect(html).not.toContain('id="prompt-only"');
    expect(html).toContain("## Prompt heading [#prompt-only]");
    expect(html).toContain('<h2 id="hover-heading">Hover heading</h2>');
    expect(html).toContain('<h2 id="code-heading">Code heading</h2>');
    expect(html).toContain("data-prompt-card");
    expect(html).toContain("data-hover-link");
    expect(html).toContain("data-code-group");
    expect(html).not.toContain("FARMINGLABS_DOCS_HEADING_OPEN");
  });

  it("keeps heading-shaped HTML inside tab code fences as code", async () => {
    const html = await renderMarkdown(`<Tabs items={["HTML"]}>
<Tab value="HTML">
\`\`\`html
<h2>Example only</h2>
\`\`\`
</Tab>
</Tabs>

## Real heading
`);

    expect(html).toContain('<h2 id="real-heading">Real heading</h2>');
    expect(html).not.toContain("<h2>Example only</h2>");
    expect(html).toContain("&lt;h2");
    expect(html).toContain("Example only");
    expect(html).toContain("&lt;/h2");
  });

  it("keeps heading-shaped HTML inside tilde and longer outer fences as code", async () => {
    const html = await renderMarkdown(`~~~html
<h2 id="tilde-example">Tilde example only</h2>
~~~

\`\`\`\`markdown
\`\`\`html
<h2 id="nested-example">Nested example only</h2>
\`\`\`
\`\`\`\`

## Real heading
`);

    expect(html).toContain('<h2 id="real-heading">Real heading</h2>');
    expect(html).not.toContain('<h2 id="tilde-example">');
    expect(html).not.toContain('<h2 id="nested-example">');
    expect(html).toContain("&lt;h2 id=&quot;tilde-example&quot;&gt;");
    expect(html).toContain("&lt;h2 id=&quot;nested-example&quot;&gt;");
  });

  it("keeps heading-shaped HTML inside EOF-closed fences as code", async () => {
    const [tildeHtml, backtickHtml] = await Promise.all([
      renderMarkdown(`~~~html
<h2 id="tilde-eof-example">Tilde EOF example only</h2>`),
      renderMarkdown(`\`\`\`\`markdown
\`\`\`html
<h2 id="backtick-eof-example">Backtick EOF example only</h2>
\`\`\``),
    ]);

    expect(tildeHtml).not.toContain('<h2 id="tilde-eof-example">');
    expect(backtickHtml).not.toContain('<h2 id="backtick-eof-example">');
    expect(tildeHtml).toContain("&lt;h2 id=&quot;tilde-eof-example&quot;&gt;");
    expect(backtickHtml).toContain("&lt;h2 id=&quot;backtick-eof-example&quot;&gt;");
  });

  it("keeps fenced Prompt content as escaped copyable text", async () => {
    const html = await renderMarkdown(`<Prompt>
\`\`\`html
<h2 id="prompt-example">Prompt example only</h2>
\`\`\`
</Prompt>

<HoverLink href="/guide" title="Guide" description="Read it">
\`\`\`html
<h2 id="hover-example">Hover example only</h2>
\`\`\`
</HoverLink>`);

    expect(html).toContain("data-prompt-card");
    expect(html).toContain("data-hover-link");
    expect(html).toContain("&lt;h2 id=&quot;prompt-example&quot;&gt;");
    expect(html).toContain("&lt;h2 id=&quot;hover-example&quot;&gt;");
    expect(html).not.toContain('<h2 id="prompt-example">');
    expect(html).not.toContain('<h2 id="hover-example">');
    expect(html).not.toContain("<figure");
    expect(html).not.toContain("%%CODEBLOCK_");
  });

  it("keeps authored Markdown and HTML headings inside Prompt escaped and inert", async () => {
    const html = await renderMarkdown(`<Prompt showPrompt>
## Indexed heading

<h2 id="authored-heading" onclick="alert(1)">Authored heading</h2>
</Prompt>`);

    expect(html).toContain("## Indexed heading");
    expect(html).not.toContain('<h2 id="indexed-heading">');
    expect(html).toContain(
      "&lt;h2 id=&quot;authored-heading&quot; onclick=&quot;alert(1)&quot;&gt;Authored heading&lt;/h2&gt;",
    );
    expect(html).not.toContain('<h2 id="authored-heading"');
    expect(html).not.toContain("FARMINGLABS_DOCS_HEADING_OPEN");
  });

  it("preserves literal Prompt definitions without exposing them to document links", async () => {
    const html = await renderMarkdown(`<Prompt showPrompt>
Use [prompt-only].
[prompt-only]: /from-prompt "Prompt only"
<Agent>Keep this literal.</Agent>
</Prompt>

Outside [prompt-only].

[public]: /outside

Outside [public].`);

    expect(html).toContain("Use [prompt-only].");
    expect(html).toContain("[prompt-only]: /from-prompt &quot;Prompt only&quot;");
    expect(html).toContain("&lt;Agent&gt;Keep this literal.&lt;/Agent&gt;");
    expect(html).toContain("Outside [prompt-only].");
    expect(html).not.toContain('href="/from-prompt"');
    expect(html).toContain('Outside <a href="/outside">public</a>.');
    expect(html).not.toContain("[public]: /outside");
  });

  it("keeps Prompt-looking Markdown literals inert", async () => {
    const literalSources = [
      [
        "FENCED_PROMPT_LITERAL",
        ["```mdx", "<Prompt>", "FENCED_PROMPT_LITERAL", "</Prompt>", "```"].join("\n"),
      ],
      [
        "QUOTED_PROMPT_LITERAL",
        ["> ~~~~mdx", "> <Prompt>", "> QUOTED_PROMPT_LITERAL", "> </Prompt>", "> ~~~~"].join("\n"),
      ],
      [
        "LIST_PROMPT_LITERAL",
        ["- ~~~mdx", "  <Prompt>", "  LIST_PROMPT_LITERAL", "  </Prompt>", "  ~~~"].join("\n"),
      ],
      ["INLINE_PROMPT_LITERAL", "`<Prompt>INLINE_PROMPT_LITERAL</Prompt>`"],
      [
        "LINK_PROMPT_LITERAL",
        '[Example](https://example.com "Use <Prompt>LINK_PROMPT_LITERAL</Prompt>")',
      ],
      [
        "LINK_LABEL_PROMPT_LITERAL",
        "[<Prompt>LINK_LABEL_PROMPT_LITERAL</Prompt>](https://example.com)",
      ],
      ["EXPRESSION_PROMPT_LITERAL", "{<Prompt>EXPRESSION_PROMPT_LITERAL</Prompt>}"],
      [
        "PROP_PROMPT_LITERAL",
        "<Card example={<Prompt>PROP_PROMPT_LITERAL</Prompt>}>Card body</Card>",
      ],
      ["UNRESOLVED_PROMPT_LITERAL", "[<Prompt>UNRESOLVED_PROMPT_LITERAL</Prompt>][]"],
      ["UNRESOLVED_IMAGE_PROMPT_LITERAL", "![<Prompt>UNRESOLVED_IMAGE_PROMPT_LITERAL</Prompt>]"],
      [
        "RAW_HTML_PROMPT_LITERAL",
        ["<pre>", "<Prompt>RAW_HTML_PROMPT_LITERAL</Prompt>", "</pre>"].join("\n"),
      ],
      [
        "UPPERCASE_RAW_HTML_PROMPT_LITERAL",
        ["<SCRIPT>", "<Prompt>UPPERCASE_RAW_HTML_PROMPT_LITERAL</Prompt>", "</SCRIPT>"].join("\n"),
      ],
      ["SVG_PROMPT_LITERAL", "<svg><Prompt>SVG_PROMPT_LITERAL</Prompt></svg>"],
      ["UPPERCASE_SVG_PROMPT_LITERAL", "<SVG><Prompt>UPPERCASE_SVG_PROMPT_LITERAL</Prompt></SVG>"],
      ["MATH_PROMPT_LITERAL", "<math><Prompt>MATH_PROMPT_LITERAL</Prompt></math>"],
      [
        "UPPERCASE_MATH_PROMPT_LITERAL",
        "<MATH><Prompt>UPPERCASE_MATH_PROMPT_LITERAL</Prompt></MATH>",
      ],
      ["CDATA_PROMPT_LITERAL", "<![CDATA[<Prompt>CDATA_PROMPT_LITERAL</Prompt>]]>"],
    ] as const;

    for (const [marker, source] of literalSources) {
      const html = await renderMarkdown(source);
      expect(html).toContain(marker);
      expect(html).not.toContain("data-prompt-card");
    }

    const liveHtml = await renderMarkdown("<Prompt showPrompt>LIVE_PROMPT</Prompt>");
    expect(liveHtml).toContain("LIVE_PROMPT");
    expect(liveHtml.match(/data-prompt-card/g)).toHaveLength(1);
  });

  it("preserves flow boundaries and complete nested Prompt copy", async () => {
    const html = await renderMarkdown(`Before.
<Prompt showPrompt>
Run the check.
</Prompt>
After.

---

Done.`);

    expect(html).toContain("<p>Before.</p>");
    expect(html).toContain("<p>After.</p>");
    expect(html).toContain("<hr />");
    expect(html).toContain("<p>Done.</p>");
    expect(html.match(/data-prompt-card/g)).toHaveLength(1);
    expect(html).not.toMatch(/<(?:p|h[1-6])[^>]*>\s*<div class="fd-prompt"/);

    const nested = await renderMarkdown(
      "<Prompt showPrompt>outer <Prompt>inner</Prompt> tail</Prompt>",
    );
    expect(nested.match(/data-prompt-card/g)).toHaveLength(1);
    expect(nested).toContain("outer &lt;Prompt&gt;inner&lt;/Prompt&gt; tail");
  });

  it("keeps heading-shaped HTML inside blockquote and list fences as code", async () => {
    const html = await renderMarkdown(`> ~~~html
> <h2 id="quote-example">Quote example only</h2>
> ~~~

- \`\`\`\`markdown
  \`\`\`html
  <h2 id="list-example">List example only</h2>
  \`\`\`
  \`\`\`\`

<CodeGroup>
> ~~~html
> <h2 id="code-group-example">Code group example only</h2>
> ~~~
</CodeGroup>

## Real heading
`);

    expect(html).toContain('<h2 id="real-heading">Real heading</h2>');
    expect(html).not.toContain('<h2 id="quote-example">');
    expect(html).not.toContain('<h2 id="list-example">');
    expect(html).not.toContain('<h2 id="code-group-example">');
    expect(html).toContain("&lt;h2 id=&quot;quote-example&quot;&gt;");
    expect(html).toContain("&lt;h2 id=&quot;list-example&quot;&gt;");
    expect(html).toContain("&lt;h2 id=&quot;code-group-example&quot;&gt;");
    expect(html).not.toContain("<blockquote><p><figure");
    expect(html).not.toContain("<p><figure");
    expect(html).not.toContain("<p><blockquote");
  });

  it("keeps container fence and Setext rendering aligned with the canonical parser", async () => {
    const html = await renderMarkdown(`> \`\`\`
> code

## Outside

> Quoted
>===

- Listed
  ===
`);

    expect(html).toContain('<h2 id="outside">Outside</h2>');
    expect(html).toContain('<h1 id="quoted">Quoted</h1>');
    expect(html).toContain('<h1 id="listed">Listed</h1>');
  });

  it("renders complete multiline Setext headings without leaving an extra rule", async () => {
    const html = await renderMarkdown(`First *line*
second \`line\`
---

Custom first
custom second [#custom-setext]
---
`);

    expect(html).toContain(
      '<h2 id="first-line-second-line">First <em>line</em> second <code>line</code></h2>',
    );
    expect(html).toContain('<h2 id="custom-setext">Custom first custom second</h2>');
    expect(html).not.toContain("[#custom-setext]");
    expect(html).not.toContain("<hr");
  });

  it("keeps canonical line mapping after frontmatter", async () => {
    const html = await renderMarkdown(`---
title: Anchors
---

# Overview

## Install
`);

    expect(html).toContain('<h1 id="overview">Overview</h1>');
    expect(html).toContain('<h2 id="install">Install</h2>');
  });

  it("restores Prompt after downstream code and heading transport tokens", async () => {
    const html = await renderMarkdown(`<Prompt showPrompt>
%%CODEBLOCK_0%%
%%FARMINGLABS_DOCS_HEADING_OPEN_0%%
</Prompt>

## Real heading

\`\`\`ts
const real = true;
\`\`\``);

    expect(html).toContain("%%CODEBLOCK_0%%");
    expect(html).toContain("%%FARMINGLABS_DOCS_HEADING_OPEN_0%%");
    expect(html).toContain('<h2 id="real-heading">Real heading</h2>');
    expect(html).toContain("real");
    expect(html.match(/data-prompt-card/g)).toHaveLength(1);
  });

  it("keeps live Prompt cards and copied text inside blockquote and list containers", async () => {
    const html = await renderMarkdown(`> Before
> <Prompt showPrompt>
> Quote task
> </Prompt>
> After

- Before
  <Prompt showPrompt>
  List task
  </Prompt>
  After`);

    expect(html).toMatch(
      /<blockquote>[\s\S]*Before[\s\S]*data-prompt-card[\s\S]*After[\s\S]*<\/blockquote>/,
    );
    expect(html).toMatch(/<li>[\s\S]*Before[\s\S]*data-prompt-card[\s\S]*After[\s\S]*<\/li>/);
    expect(html).toContain('<div data-prompt-text hidden aria-hidden="true">Quote task</div>');
    expect(html).toContain('<div data-prompt-text hidden aria-hidden="true">List task</div>');
    expect(html).not.toContain("&gt; Quote task");
    expect(html.match(/data-prompt-card/g)).toHaveLength(2);
  });

  it("keeps Prompt cards inside every unordered and ordered list marker", async () => {
    const html = await renderMarkdown(`+ <Prompt showPrompt>
  Plus task
  </Prompt>

* <Prompt showPrompt>
  Star task
  </Prompt>

1. Before
   <Prompt showPrompt>
   Ordered task
   </Prompt>
   After

2) <Prompt showPrompt>
   Parenthesized task
   </Prompt>`);

    expect(html.match(/data-prompt-card/g)).toHaveLength(4);
    expect(html.match(/<ul><li><div class="fd-prompt"/g)).toHaveLength(2);
    expect(html).toMatch(/<ol><li>Before[\s\S]*data-prompt-card[\s\S]*After<\/li><\/ol>/);
    expect(html).toContain('<ol><li><div class="fd-prompt"');
    for (const task of ["Plus task", "Star task", "Ordered task", "Parenthesized task"]) {
      expect(html).toContain(`<div data-prompt-text hidden aria-hidden="true">${task}</div>`);
    }

    const simple = await renderMarkdown(
      ["- One", "+ Two", "* Three", "", "1. First", "2. Second"].join("\n"),
    );
    expect(simple).toContain("<ul><li>One</li><li>Two</li><li>Three</li></ul>");
    expect(simple).toContain("<ol><li>First</li><li>Second</li></ol>");
  });

  it("keeps standalone Prompt cards separate from Setext markers for LF and CRLF", async () => {
    for (const newline of ["\n", "\r\n"]) {
      for (const marker of ["---", "==="]) {
        const html = await renderMarkdown(
          `<Prompt showPrompt>x</Prompt>${newline}${marker}${newline}After`,
        );
        expect(html.match(/data-prompt-card/g)).toHaveLength(1);
        expect(html).not.toMatch(/<h[12][^>]*>\s*<div class="fd-prompt"/);
      }
    }

    const inline = await renderMarkdown("Before <Prompt showPrompt>x</Prompt> after");
    expect(inline).toContain('<p>Before <div class="fd-prompt"');
  });
});

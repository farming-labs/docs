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
});

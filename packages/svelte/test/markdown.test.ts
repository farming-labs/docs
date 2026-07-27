import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown.js";

describe("renderMarkdown Prompt reference definitions", () => {
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

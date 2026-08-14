import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/renderMarkdown.js";

describe("renderMarkdown", () => {
  it("renders all markdown heading levels without leaking hash markers", () => {
    const html = renderMarkdown(`# One
## Two
### Three
#### Four
##### Five
###### Six`);

    expect(html).toContain("<h1>One</h1>");
    expect(html).toContain("<h2>Two</h2>");
    expect(html).toContain("<h3>Three</h3>");
    expect(html).toContain("<h4>Four</h4>");
    expect(html).toContain("<h5>Five</h5>");
    expect(html).toContain("<h6>Six</h6>");
    expect(html).not.toContain("###");
    expect(html).not.toContain("######");
  });

  it("renders deeper headings and loose bash command labels from AI responses", () => {
    const html = renderMarkdown(`#### Claude Code (CLI)
bash

claude mcp add --transport http scholarxiv https://www.scholarxiv.com/api/mcp \\
  --header "Authorization: Bearer sxv_your_api_key_here"

#### opencode

Add this to your opencode config.`);

    expect(html).not.toContain("####");
    expect(html).not.toContain("<p>bash</p>");
    expect(html).toContain("<h4>Claude Code (CLI)</h4>");
    expect(html).toContain("<h4>opencode</h4>");
    expect(html).toContain('fd-ai-code-lang">bash</div>');
    expect(html).toContain("claude");
    expect(html).toContain("mcp");
    expect(html).toContain("add");
    expect(html).toContain("Authorization: Bearer");
    expect(html).toContain("<p>Add this to your opencode config.</p>");
  });

  it("keeps tables rendered as tables while preserving inline markdown", () => {
    const html = renderMarkdown(`## Transport Details

| Property | Value |
|----------|-------|
| Type | **Streamable HTTP** |
| Protocol Version | \`2025-06-15\` |`);

    expect(html).toContain("<h2>Transport Details</h2>");
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>Streamable HTTP</strong>");
    expect(html).toContain("<code>2025-06-15</code>");
  });

  it("renders common answer markdown blocks and inline formatting", () => {
    const html = renderMarkdown(`Primary title
=============

Secondary title
---------------

> **Note**
> Include the \`Bearer\` prefix.

- [x] Project id configured
- [ ] Analytics verified

1. First step
2. Second step

~~old value~~

![ScholarXIV](https://www.scholarxiv.com/logo.png)

<https://www.scholarxiv.com/developers/docs>`);

    expect(html).toContain("<h1>Primary title</h1>");
    expect(html).toContain("<h2>Secondary title</h2>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<strong>Note</strong>");
    expect(html).toContain("<code>Bearer</code>");
    expect(html).toContain('class="fd-ai-task-list-item"');
    expect(html).toContain('type="checkbox" disabled checked');
    expect(html).toContain('type="checkbox" disabled>');
    expect(html).toContain("<ol>");
    expect(html).toContain("<del>old value</del>");
    expect(html).toContain(
      '<img src="https://www.scholarxiv.com/logo.png" alt="ScholarXIV" loading="lazy">',
    );
    expect(html).toContain(
      '<a href="https://www.scholarxiv.com/developers/docs">https://www.scholarxiv.com/developers/docs</a>',
    );
  });
});

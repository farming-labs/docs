import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/renderMarkdown.js";

describe("renderMarkdown", () => {
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

    expect(html).toContain("<h3>Transport Details</h3>");
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>Streamable HTTP</strong>");
    expect(html).toContain("<code>2025-06-15</code>");
  });
});

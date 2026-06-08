import { describe, expect, it } from "vitest";
import { renderAIResponseMarkdown } from "./ai-markdown.js";

describe("renderAIResponseMarkdown", () => {
  it("renders code fences that include markdown info-string metadata", () => {
    const html = renderAIResponseMarkdown(`### Config

\`\`\`ts title="docs.config.ts"
const provider = "docs-cloud";
\`\`\`

After code.

\`\`\`json title="docs.json"
{"provider":"docs-cloud"}
\`\`\`

- indexed`);

    expect(html).not.toContain("```");
    expect(html).not.toContain('title="docs.config.ts"');
    expect(html.match(/<div class="fd-ai-code-block"/g)).toHaveLength(2);
    expect(html).toContain('fd-ai-code-lang">ts</div>');
    expect(html).toContain('fd-ai-code-lang">json</div>');
    expect(html).toContain("After code.");
    expect(html).toContain("indexed");
  });

  it("renders an incomplete streaming code fence with metadata as a live code block", () => {
    const html = renderAIResponseMarkdown(`\`\`\`bash title="Terminal"
pnpm dev`);

    expect(html).not.toContain("```");
    expect(html).not.toContain('title="Terminal"');
    expect(html.match(/<div class="fd-ai-code-block"/g)).toHaveLength(1);
    expect(html).toContain('fd-ai-code-lang">bash</div>');
    expect(html).toContain("pnpm");
  });
});

import { describe, expect, it, vi } from "vitest";

const { createHighlighter, codeToHtml } = vi.hoisted(() => ({
  createHighlighter: vi.fn(),
  codeToHtml: vi.fn((code: string) => `<pre class="shiki"><code>${code}</code></pre>`),
}));
vi.mock("shiki", () => ({ createHighlighter }));

import { renderMarkdown } from "../src/markdown.js";

describe("on-demand highlighting", () => {
  it("skips non-code content, retries initialization, and shares concurrent work", async () => {
    createHighlighter.mockResolvedValue({ getLoadedLanguages: () => ["ts"], codeToHtml });
    for (const source of [
      "# Heading\n\nSome **prose** and `inline code`.",
      "<Prompt showPrompt>\n```ts\nliteral()\n```\n</Prompt>",
      "<Agent>\n```ts\nsecret()\n```\n</Agent>\n\nVisible prose.",
    ])
      await renderMarkdown(source);
    expect(createHighlighter).not.toHaveBeenCalled();
    createHighlighter.mockRejectedValueOnce(new Error("initialization failed"));
    await expect(renderMarkdown("```ts\nretry()\n```")).rejects.toThrow("initialization failed");
    const outputs = await Promise.all([
      renderMarkdown("```ts\nfirst()\n```"),
      renderMarkdown('<CodeGroup>\n```ts title="Second"\nsecond()\n```\n</CodeGroup>'),
      renderMarkdown('<Tabs>\n<Tab title="Third">\n```ts\nthird()\n```\n</Tab>\n</Tabs>'),
    ]);
    expect(createHighlighter).toHaveBeenCalledTimes(2);
    expect(codeToHtml).toHaveBeenCalledTimes(3);
    for (const [index, output] of outputs.entries()) {
      expect(output).toContain(
        `<pre class="shiki"><code>${["first", "second", "third"][index]}()</code></pre>`,
      );
      expect(output).not.toMatch(/%%CODEBLOCK_/);
    }
  });
});

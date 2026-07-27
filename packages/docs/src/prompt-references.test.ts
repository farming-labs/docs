import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { isolateDocsMarkdownPromptReferences } from "./prompt-references.js";

interface PromptReferenceTestNode {
  type?: string;
  name?: unknown;
  value?: unknown;
  identifier?: unknown;
  label?: unknown;
  referenceType?: unknown;
  url?: unknown;
  children?: PromptReferenceTestNode[];
}

describe("isolateDocsMarkdownPromptReferences", () => {
  it("aligns source slices with MDX offsets after a leading Unicode BOM", async () => {
    const markdown = [
      "\uFEFF<Prompt>",
      "[X][x]",
      "",
      "[x]: /prompt-only",
      "</Prompt>",
      "",
      "## [X][x]",
    ].join("\n");
    let transformedRoot: PromptReferenceTestNode | undefined;
    const isolateReferences = () => (root: PromptReferenceTestNode, file: { value: unknown }) => {
      isolateDocsMarkdownPromptReferences(root, file.value);
      isolateDocsMarkdownPromptReferences(root, file.value);
      transformedRoot = root;
    };

    await compile(markdown, { remarkPlugins: [isolateReferences] });

    const prompt = transformedRoot?.children?.find(
      (node) => node.type === "mdxJsxFlowElement" && node.name === "Prompt",
    );
    const heading = transformedRoot?.children?.find((node) => node.type === "heading");
    expect(prompt?.children).toEqual([
      {
        type: "text",
        value: "\n[X][x]\n\n[x]: /prompt-only\n",
      },
    ]);
    expect(heading?.children?.[0]?.value).toBe("[X][x]");
  });

  it("keeps an attributed Prompt body as one exact literal source node", async () => {
    const promptBody = [
      "",
      "[a]: /a",
      "[b]: /b",
      "Use [A][a] and [B][b].  ",
      "",
      '<Prompt title="Nested > prompt">',
      "## Nested [A][a]",
      "</Prompt>",
      "",
    ].join("\n");
    const markdown = [
      "<Prompt",
      '  title="Literal > source"',
      "  actions={['copy', '>']}",
      `>${promptBody}</Prompt>`,
      "",
      "## [Outside][a]",
    ].join("\n");
    let transformedRoot: PromptReferenceTestNode | undefined;
    const isolateReferences = () => (root: PromptReferenceTestNode, file: { value: unknown }) => {
      isolateDocsMarkdownPromptReferences(root, file.value);
      isolateDocsMarkdownPromptReferences(root, file.value);
      transformedRoot = root;
    };

    await compile(markdown, { remarkPlugins: [isolateReferences] });

    const prompt = transformedRoot?.children?.find(
      (node) => node.type === "mdxJsxFlowElement" && node.name === "Prompt",
    );
    const heading = transformedRoot?.children?.find((node) => node.type === "heading");
    expect(prompt?.children).toEqual([{ type: "text", value: promptBody }]);
    expect(heading?.children?.[0]?.value).toBe("[Outside][a]");
  });

  it("falls back to node-level isolation when source positions are unavailable", () => {
    const root: PromptReferenceTestNode = {
      type: "root",
      children: [
        {
          type: "mdxJsxFlowElement",
          name: "Prompt",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "linkReference",
                  identifier: "prompt-link",
                  label: "prompt-link",
                  referenceType: "full",
                  children: [{ type: "text", value: "Prompt link" }],
                },
              ],
            },
            {
              type: "definition",
              identifier: "prompt-link",
              label: "prompt-link",
              url: "/prompt-only",
            },
          ],
        },
      ],
    };

    isolateDocsMarkdownPromptReferences(root);

    const prompt = root.children?.[0];
    expect(prompt?.children?.[0]?.children?.[0]).toMatchObject({
      type: "text",
      value: "[Prompt link][prompt-link]",
    });
    expect(prompt?.children?.[1]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "[prompt-link]: /prompt-only" }],
    });
  });
});

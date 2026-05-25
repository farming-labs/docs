import { describe, expect, it } from "vitest";
import { remarkCodeGroup } from "./code-group-mdx.js";

describe("remarkCodeGroup", () => {
  it("adds title metadata from Mintlify-style bare filenames inside CodeGroup", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "mdxJsxFlowElement",
          name: "CodeGroup",
          children: [
            {
              type: "code",
              lang: "javascript",
              meta: "helloWorld.js",
              value: "console.log('Hello World')",
            },
          ],
        },
      ],
    };

    remarkCodeGroup()(tree);

    expect(tree.children[0].children[0].meta).toBe('title="helloWorld.js" helloWorld.js');
  });

  it("uses filename-style metadata as the CodeGroup title while preserving the original meta", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "mdxJsxFlowElement",
          name: "CodeGroup",
          children: [
            {
              type: "code",
              lang: "bash",
              meta: 'filename="pnpm"',
              value: "pnpm add @farming-labs/docs",
            },
          ],
        },
      ],
    };

    remarkCodeGroup()(tree);

    expect(tree.children[0].children[0].meta).toBe('title="pnpm" filename="pnpm"');
  });

  it("leaves regular code blocks and existing titles alone", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "code",
          lang: "ts",
          meta: "docs.config.ts",
          value: "export default {};",
        },
        {
          type: "mdxJsxFlowElement",
          name: "CodeGroup",
          children: [
            {
              type: "code",
              lang: "ts",
              meta: 'title="docs.config.ts"',
              value: "export default {};",
            },
          ],
        },
      ],
    };

    remarkCodeGroup()(tree);

    const codeGroup = tree.children[1] as { children?: Array<{ meta?: string | null }> };

    expect(tree.children[0].meta).toBe("docs.config.ts");
    expect(codeGroup.children?.[0]?.meta).toBe('title="docs.config.ts"');
  });
});

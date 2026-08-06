import { describe, expect, it } from "vitest";
import { remarkStandaloneCodeLabels } from "./vite.js";

const paragraphLabel = (value: string) => ({
  type: "paragraph",
  children: [{ type: "strong", children: [{ type: "text", value }] }],
});

describe("remarkStandaloneCodeLabels", () => {
  it("turns a standalone file label into code-block title metadata", () => {
    const tree = {
      type: "root",
      children: [paragraphLabel("src/app/page.tsx"), { type: "code", lang: "tsx", value: "x" }],
    };

    remarkStandaloneCodeLabels()(tree);

    expect(tree.children).toEqual([
      expect.objectContaining({
        type: "code",
        meta: 'title="src/app/page.tsx"',
      }),
    ]);
  });

  it("removes redundant terminal labels without adding a framed title", () => {
    const tree = {
      type: "root",
      children: [paragraphLabel("Terminal"), { type: "code", lang: "bash", value: "pnpm dev" }],
    };

    remarkStandaloneCodeLabels()(tree);

    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]).toMatchObject({ type: "code", lang: "bash" });
    expect(tree.children[0]).not.toHaveProperty("meta");
  });
});

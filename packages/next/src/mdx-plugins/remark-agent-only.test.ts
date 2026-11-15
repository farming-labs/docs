import { describe, expect, it, vi } from "vitest";
import remarkAgentOnly from "./remark-agent-only.js";

vi.mock("@farming-labs/docs", () => {
  throw new Error("MDX plugin loaded the core barrel");
});

const body = () => [
  { type: "heading", children: [{ type: "text", value: "Release runbook" }] },
  { type: "paragraph", children: [{ type: "text", value: "Secret-free agent steps." }] },
];

describe("remarkAgentOnly", () => {
  it.each(["audience: agent", 'audience: "agent"', "audience: 'agent' # machines only"])(
    "replaces the body of an agent-only page with a notFound boundary (%s)",
    (line) => {
      const esm = { type: "mdxjsEsm", value: 'export const extra = "kept";' };
      const tree: { children: Array<{ type: string; value?: string }> } = {
        children: [{ type: "yaml", value: `title: Runbook\n${line}` }, esm, ...body()],
      };

      remarkAgentOnly()(tree);

      expect(tree.children.map((node) => node.type)).toEqual([
        "yaml",
        "mdxjsEsm",
        "mdxjsEsm",
        "mdxJsxFlowElement",
      ]);
      expect(tree.children[1]).toBe(esm);
      expect(tree.children[2]?.value).toContain(
        'import { DocsAgentOnlyPage as __FarmingDocsAgentOnlyPage } from "@farming-labs/next/internal/page";',
      );
      expect(JSON.stringify(tree)).not.toContain("Secret-free agent steps.");
    },
  );

  it.each(["title: Install", "audience: human", "audience: agents", "agent:\n  audience: agent"])(
    "leaves other pages unchanged (%s)",
    (yaml) => {
      const tree = { children: [{ type: "yaml", value: yaml }, ...body()] };
      const before = JSON.stringify(tree);
      remarkAgentOnly()(tree);
      expect(JSON.stringify(tree)).toBe(before);
    },
  );

  it("avoids colliding with an authored binding name", () => {
    const tree = {
      children: [
        { type: "yaml", value: "audience: agent" },
        { type: "mdxjsEsm", value: "const __FarmingDocsAgentOnlyPage = 1;" },
      ],
    };
    remarkAgentOnly()(tree);
    expect(tree.children.at(-1)).toMatchObject({ name: "__FarmingDocsAgentOnlyPage_" });
  });
});

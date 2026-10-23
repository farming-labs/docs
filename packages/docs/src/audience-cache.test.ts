import { describe, expect, it } from "vitest";
import { resolveDocsAudienceMdxContent } from "./audience.js";

describe("cached audience projections", () => {
  it("keeps human and agent projections separate across repeated reads and source edits", () => {
    const source =
      "# Cached projection\n\n<Human>Human guidance.</Human>\n\n<Agent>Agent guidance.</Agent>";
    for (let attempt = 0; attempt < 3; attempt++) {
      const human = resolveDocsAudienceMdxContent(source, "human");
      const agent = resolveDocsAudienceMdxContent(source, "agent");
      expect(human).toContain("Human guidance.");
      expect(human).not.toContain("Agent guidance.");
      expect(agent).toContain("Agent guidance.");
      expect(agent).not.toContain("Human guidance.");
    }
    const edited = source.replace("Human guidance.", "Updated human guidance.");
    expect(resolveDocsAudienceMdxContent(edited, "human")).toContain("Updated human guidance.");
    expect(resolveDocsAudienceMdxContent(source, "human")).not.toContain("Updated");
  });

  it("preserves empty projections and literal examples on cache hits", () => {
    const hidden = "<Agent>Agent-only cache example.</Agent>";
    const literal = "```mdx\n<Agent>Literal cache example.</Agent>\n```";
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(resolveDocsAudienceMdxContent(hidden, "human")).toBe("");
      expect(resolveDocsAudienceMdxContent(literal, "human")).toBe(literal);
      expect(resolveDocsAudienceMdxContent(literal, "agent")).toBe(literal);
    }
  });
});

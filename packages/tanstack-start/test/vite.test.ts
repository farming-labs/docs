import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { createCanonicalDocsRemarkHeading } from "../src/vite.js";

describe("createCanonicalDocsRemarkHeading", () => {
  it("encodes canonical TOC fragments and isolates Prompt-only references", async () => {
    const rendered = await compile(
      [
        "## Hash [#foo#bar]",
        "",
        "## Percent [#foo%23bar]",
        "",
        "## [Inside][prompt-ref] Setup",
        "",
        "<Prompt>",
        "Use [prompt-ref].",
        "",
        '[prompt-ref]: /prompt-only "Prompt only"',
        "</Prompt>",
      ].join("\n"),
      { remarkPlugins: [createCanonicalDocsRemarkHeading] },
    );

    expect(rendered.data.toc).toEqual([
      { title: "Hash", url: "#foo%23bar", depth: 2 },
      { title: "Percent", url: "#foo%2523bar", depth: 2 },
      {
        title: "[Inside][prompt-ref] Setup",
        url: "#insideprompt-ref-setup",
        depth: 2,
      },
    ]);
    expect(String(rendered)).toContain("Use [prompt-ref].");
    expect(String(rendered)).toContain('[prompt-ref]: /prompt-only \\"Prompt only\\"');
    expect(String(rendered)).not.toContain('href: "/prompt-only"');
  });
});

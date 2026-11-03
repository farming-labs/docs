import { compile } from "@mdx-js/mdx";
import { defaultShikiFactory, wasmShikiFactory } from "fumadocs-core/highlight/shiki/full";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanonicalDocsRemarkHeading, docsMdx } from "../src/vite.js";

describe("docsMdx code highlighting", () => {
  afterEach(() => vi.restoreAllMocks());

  it("compiles both themes without initializing the JavaScript regex engine", async () => {
    const javascript = vi.spyOn(defaultShikiFactory, "getOrInit");
    const oniguruma = vi.spyOn(wasmShikiFactory, "getOrInit");
    const plugins = docsMdx() as Array<{
      name: string;
      transform: (source: string, id: string) => Promise<{ code: string }>;
    }>;
    const compiler = plugins.find((plugin) => plugin.name === "@mdx-js/rollup")!;
    const output = await compiler.transform(
      '---\ntitle: Guide\n---\n\n## Setup\n\n```ts title="example.ts"\nconst answer = 42; // [!code highlight]\n```',
      "/docs/page.mdx",
    );

    for (const marker of [
      "metadata",
      "toc",
      "setup",
      "--shiki-light",
      "--shiki-dark",
      "highlighted",
      "example.ts",
    ])
      expect(output.code).toContain(marker);
    expect(oniguruma).toHaveBeenCalledOnce();
    expect(javascript).not.toHaveBeenCalled();
  });
});

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

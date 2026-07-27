import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { renderPageAgentContractMarkdown } from "./agent-contract.js";
import {
  applyDocsMarkdownHeadingAnchors,
  createDocsMarkdownHeadingAnchorResolver,
  createDocsRenderedHeadingAnchorResolver,
  findDocsMarkdownSection,
  parseDocsMarkdownSections,
} from "./markdown-sections.js";

interface TestMarkdownAstNode {
  type?: string;
  children?: TestMarkdownAstNode[];
  data?: {
    hProperties?: {
      id?: unknown;
    };
  };
}

async function compileDocsMarkdownHeadingAnchors(markdown: string): Promise<string[]> {
  const anchors: string[] = [];

  await compile(markdown, {
    remarkPlugins: [
      remarkGfm,
      () => (tree: unknown) => {
        applyDocsMarkdownHeadingAnchors(tree);
        const visit = (node: TestMarkdownAstNode): void => {
          if (node.type === "heading") {
            const id = node.data?.hProperties?.id;
            if (typeof id === "string") anchors.push(id);
            return;
          }
          for (const child of node.children ?? []) visit(child);
        };
        visit(tree as TestMarkdownAstNode);
      },
    ],
  });

  return anchors;
}

describe("canonical Markdown heading anchors", () => {
  it("assigns rendered headings before generated agent-only contract headings", () => {
    const contract = renderPageAgentContractMarkdown({
      task: "Run the generated contract task.",
      outcome: "The generated contract outcome is available.",
      prerequisites: ["Generated prerequisite collision marker."],
    });
    const markdown = [
      contract,
      "",
      "## Authored [#agent-contract]",
      "",
      "Authored collision marker.",
      "",
      "## Prerequisites",
      "",
      "Authored prerequisite collision marker.",
    ].join("\n");

    for (const document of [markdown, `${markdown}\n\n{`]) {
      expect(
        parseDocsMarkdownSections(document).map(({ title, anchor }) => ({ title, anchor })),
      ).toEqual([
        { title: "Agent Contract", anchor: "agent-contract-1" },
        { title: "Prerequisites", anchor: "prerequisites-1" },
        { title: "Authored", anchor: "agent-contract" },
        { title: "Prerequisites", anchor: "prerequisites" },
      ]);
      expect(findDocsMarkdownSection(document, "agent-contract")?.content).toContain(
        "Authored collision marker.",
      );
      expect(findDocsMarkdownSection(document, "agent-contract-1")?.content).toContain(
        "generated contract outcome",
      );
    }
  });

  it("preserves Unicode, explicit ids, duplicate order, and slug collisions", () => {
    const markdown = [
      "# Café 配置",
      "",
      "## Overview [#release-overview]",
      "",
      "## Repeat",
      "",
      "First.",
      "",
      "### Repeat",
      "",
      "Second.",
      "",
      "## Repeat",
      "",
      "Third.",
      "",
      "## Foo",
      "",
      "## Foo",
      "",
      "## Foo-1",
      "",
      "## 🚜",
      "",
      "Fallback.",
    ].join("\n");

    expect(parseDocsMarkdownSections(markdown).map((section) => section.anchor)).toEqual([
      "café-配置",
      "release-overview",
      "repeat",
      "repeat-1",
      "repeat-2",
      "foo",
      "foo-1",
      "foo-1-1",
      "section-8",
    ]);
  });

  it("excludes literal Prompt headings without reserving their anchors", () => {
    const markdown = [
      "<Prompt>",
      "## Repeat [#prompt-only]",
      "",
      "Use this as literal input.",
      "</Prompt>",
      "",
      "## Repeat",
      "",
      "Visible section.",
      "",
      "<Callout>",
      "## Nested",
      "</Callout>",
    ].join("\n");

    expect(parseDocsMarkdownSections(markdown).map((section) => section.anchor)).toEqual([
      "repeat",
      "nested",
    ]);
    expect(findDocsMarkdownSection(markdown, "#prompt-only")).toBeUndefined();
    expect(findDocsMarkdownSection(markdown, "#repeat")?.content).toContain("Visible section.");
  });

  it("keeps Prompt headings excluded when malformed MDX requires the fallback parser", () => {
    const markdown = ["<Prompt>", "## Hidden", "</Prompt>", "", "## Visible", "", "{invalid"].join(
      "\n",
    );

    expect(parseDocsMarkdownSections(markdown).map((section) => section.anchor)).toEqual([
      "visible",
    ]);
  });

  it("uses visible inline labels and resolves encoded fragments", () => {
    const markdown = [
      "## [Install the CLI](https://example.com) & `verify`",
      "",
      "Run the command.",
      "",
      "## API foo_bar",
      "",
      "Use the literal identifier.",
      "",
      "## Foo &eacute; Bar",
      "",
      "Decode named entities.",
      "",
      "## ![Rocket](rocket.png) Setup",
      "",
      "Ignore image alt text.",
      "",
      "## Use `[#literal-id]`",
      "",
      "Keep inline code literal.",
      "",
      "## &lt;API&gt; Setup",
      "",
      "Decode encoded tag-like text.",
      "",
      "## `&eacute;` code",
      "",
      "Do not decode entities inside code.",
      "",
      "## Invalid &#xD800; reference",
      "",
      "Use the HTML replacement character.",
    ].join("\n");
    const sections = parseDocsMarkdownSections(markdown);

    expect(sections[0]).toMatchObject({
      title: "Install the CLI & verify",
      anchor: "install-the-cli--verify",
    });
    expect(sections[1]).toMatchObject({
      title: "API foo_bar",
      anchor: "api-foo_bar",
    });
    expect(sections[2]).toMatchObject({
      title: "Foo é Bar",
      anchor: "foo-é-bar",
    });
    expect(sections[3]).toMatchObject({
      title: "Setup",
      anchor: "setup",
    });
    expect(sections[4]).toMatchObject({
      title: "Use [#literal-id]",
      anchor: "use-literal-id",
    });
    expect(sections[5]).toMatchObject({
      title: "<API> Setup",
      anchor: "api-setup",
    });
    expect(sections[6]).toMatchObject({
      title: "&eacute; code",
      anchor: "eacute-code",
    });
    expect(sections[7]).toMatchObject({
      title: "Invalid � reference",
      anchor: "invalid--reference",
    });
    expect(
      findDocsMarkdownSection(markdown, "/docs/install#install-the-cli--verify")?.content,
    ).toContain("Run the command.");
  });

  it("returns source without the custom-id marker for rendered headings", () => {
    const resolveHeading = createDocsMarkdownHeadingAnchorResolver();

    expect(resolveHeading("Overview [#release-overview]")).toEqual({
      source: "Overview",
      title: "Overview",
      anchor: "release-overview",
      explicit: true,
    });
    expect(resolveHeading("安装")).toMatchObject({
      source: "安装",
      title: "安装",
      anchor: "安装",
      explicit: false,
    });
  });

  it("keeps generated, explicit, and case-sensitive anchors uniquely addressable", () => {
    const markdown = [
      "## Custom [#foo]",
      "",
      "First.",
      "",
      "## Foo",
      "",
      "Second.",
      "",
      "## Duplicate custom [#foo]",
      "",
      "Third.",
      "",
      "## Upper [#Foo]",
      "",
      "Uppercase.",
    ].join("\n");
    const sections = parseDocsMarkdownSections(markdown);

    expect(sections.map((section) => section.anchor)).toEqual(["foo", "foo-1", "foo-2", "Foo"]);
    expect(findDocsMarkdownSection(markdown, "#foo")?.content).toContain("First.");
    expect(findDocsMarkdownSection(markdown, "#Foo")?.content).toContain("Uppercase.");
    expect(findDocsMarkdownSection(markdown, "#FOO")).toBeUndefined();
  });

  it("round-trips encoded reserved ids from full section URLs", () => {
    const markdown = [
      "## Hash [#foo#bar]",
      "",
      "Hash content.",
      "",
      "## Percent [#foo%23bar]",
      "",
      "Percent content.",
      "",
      "## Leading [##foo]",
      "",
      "Leading content.",
    ].join("\n");

    expect(
      findDocsMarkdownSection(markdown, "https://example.com/docs/page#foo%23bar")?.anchor,
    ).toBe("foo#bar");
    expect(
      findDocsMarkdownSection(markdown, "https://example.com/docs/page#foo%2523bar")?.anchor,
    ).toBe("foo%23bar");
    expect(findDocsMarkdownSection(markdown, "https://example.com/docs/page#%23foo")?.anchor).toBe(
      "#foo",
    );
  });

  it("separates raw Markdown parsing from flattened renderer text", () => {
    const resolveRendered = createDocsRenderedHeadingAnchorResolver();

    expect(resolveRendered("Use [#foo]")).toMatchObject({
      title: "Use [#foo]",
      anchor: "use-foo",
      explicit: false,
    });

    const root = {
      type: "root",
      children: [
        {
          type: "heading",
          children: [
            { type: "text", value: "Custom " },
            { type: "text", value: "[#foo]" },
          ],
        },
        {
          type: "heading",
          children: [{ type: "text", value: "Foo" }],
        },
      ],
    };
    applyDocsMarkdownHeadingAnchors(root);

    expect(
      root.children.map(
        (heading) =>
          (heading as { data?: { hProperties?: { id?: string } } }).data?.hProperties?.id,
      ),
    ).toEqual(["foo", "foo-1"]);
    expect(root.children[0]?.children[1]?.value).toBe("");
  });

  it("matches rendered AST labels for balanced destinations, escapes, tags, and containers", () => {
    const markdown = [
      "## [Balanced](https://example.com/a_(b)c) Link",
      "",
      "## ![Rocket](assets/a(b).png) Setup",
      "",
      "## ![Rocket] Shortcut setup",
      "",
      "## \\[literal\\](url) text",
      "",
      '## Hello <Badge title="a > b">New</Badge> World',
      "",
      "> ## Quoted",
      "",
      "- ## Listed",
      "",
      "[Rocket]: /rocket.png",
    ].join("\n");

    expect(parseDocsMarkdownSections(markdown).map((section) => section.anchor)).toEqual([
      "balanced-link",
      "setup",
      "shortcut-setup",
      "literalurl-text",
      "hello-new-world",
      "quoted",
      "listed",
    ]);
  });

  it("only removes reference images when their definitions resolve", () => {
    const markdown = [
      "## ![Inline](inline.png) Setup",
      "",
      "## ![Defined shortcut] Setup",
      "",
      "## ![Missing shortcut] Setup",
      "",
      "## ![Defined full][asset] Setup",
      "",
      "## ![Missing full][missing] Setup",
      "",
      "## ![Fenced shortcut] Setup",
      "",
      "## ![Indented definition] Setup",
      "",
      "## [Defined link][guide] Setup",
      "",
      "## [Missing link][missing-guide] Setup",
      "",
      "```md",
      "[Fenced shortcut]: /ignored.png",
      "```",
      "",
      "[Defined shortcut]: /shortcut.png",
      "[asset]: /asset.png",
      "[guide]: /guide",
      "        [Indented definition]: /indented.png",
    ].join("\n");

    expect(parseDocsMarkdownSections(markdown).map((section) => section.anchor)).toEqual([
      "setup",
      "setup-1",
      "missing-shortcut-setup",
      "setup-2",
      "missing-fullmissing-setup",
      "fenced-shortcut-setup",
      "setup-3",
      "defined-link-setup",
      "missing-linkmissing-guide-setup",
    ]);
  });

  it("ends container-scoped fences when their container ends", () => {
    const markdown = [
      "> ```md",
      "> # Quoted code",
      "",
      "## After quote fence",
      "",
      "- ```md",
      "  # Listed code",
      "",
      "  ## Still listed code",
      "  ```",
      "",
      "## After list fence",
      "",
      "```md",
      "> ```",
      "## Still top-level code",
      "```",
      "",
      "## Visible",
    ].join("\n");

    expect(parseDocsMarkdownSections(markdown).map((section) => section.anchor)).toEqual([
      "after-quote-fence",
      "after-list-fence",
      "visible",
    ]);
  });

  it("matches Setext underlines by semantic container nesting", () => {
    const markdown = [
      "> Quoted",
      ">===",
      "",
      "- Listed",
      "  ===",
      "",
      "> > Nested",
      ">>---",
      "",
      "- Different item",
      "- ---",
    ].join("\n");

    expect(
      parseDocsMarkdownSections(markdown).map(({ anchor, level }) => ({ anchor, level })),
    ).toEqual([
      { anchor: "quoted", level: 1 },
      { anchor: "listed", level: 1 },
      { anchor: "nested", level: 2 },
    ]);
  });

  it("uses the full Setext paragraph and ignores definitions before thematic breaks", async () => {
    const markdown = [
      "First line",
      "second line",
      "---",
      "",
      "Setext content.",
      "",
      "[guide]: /guide",
      "---",
      "",
      "## Visible",
    ].join("\n");
    const sections = parseDocsMarkdownSections(markdown);

    expect(sections.map(({ title, anchor, startLine }) => ({ title, anchor, startLine }))).toEqual([
      {
        title: "First line second line",
        anchor: "first-line-second-line",
        startLine: 1,
      },
      { title: "Visible", anchor: "visible", startLine: 10 },
    ]);
    expect(sections.map((section) => section.anchor)).toEqual(
      await compileDocsMarkdownHeadingAnchors(markdown),
    );
  });

  it("matches the MDX AST for nested resources and strict destinations", async () => {
    const markdown = [
      "## [![Rocket](rocket.png)](/home) Setup",
      "",
      "## [Guide][missing] Setup",
      "",
      "## ![Rocket](not valid) Setup",
      "",
      '## [Reference](url "title) value")',
    ].join("\n");
    const sections = parseDocsMarkdownSections(markdown);

    expect(sections.map(({ title, anchor }) => ({ title, anchor }))).toEqual([
      { title: "Setup", anchor: "setup" },
      {
        title: "[Guide][missing] Setup",
        anchor: "guidemissing-setup",
      },
      {
        title: "![Rocket](not valid) Setup",
        anchor: "rocketnot-valid-setup",
      },
      { title: "Reference", anchor: "reference" },
    ]);
    expect(sections.map((section) => section.anchor)).toEqual(
      await compileDocsMarkdownHeadingAnchors(markdown),
    );
  });

  it("matches GFM footnotes, strikethrough, and reference-aware custom ids", async () => {
    const markdown = [
      "## Install[^note] ~~safely~~",
      "",
      "## Resolved marker [#linked-id]",
      "",
      "## Escaped marker \\[#explicit-id]",
      "",
      "## Plain marker [#plain-id]",
      "",
      "[^note]: Use the supported version.",
      "",
      "[#linked-id]: /reference",
      "",
      "[#explicit-id]: /also-a-reference",
    ].join("\n");
    const sections = parseDocsMarkdownSections(markdown);

    expect(sections.map(({ title, anchor, explicit }) => ({ title, anchor, explicit }))).toEqual([
      { title: "Install safely", anchor: "install-safely", explicit: false },
      {
        title: "Resolved marker #linked-id",
        anchor: "resolved-marker-linked-id",
        explicit: false,
      },
      { title: "Escaped marker", anchor: "explicit-id", explicit: true },
      { title: "Plain marker", anchor: "plain-id", explicit: true },
    ]);
    expect(sections.map((section) => section.anchor)).toEqual(
      await compileDocsMarkdownHeadingAnchors(markdown),
    );
  });

  it("skips MDX comments and ESM while retaining headings nested in components", async () => {
    const markdown = [
      "export const example = `",
      "## Hidden ESM",
      "`",
      "",
      "{/*",
      "## Hidden comment",
      "*/}",
      "",
      "<Callout>",
      "## Nested visible",
      "</Callout>",
      "",
      "# Visible",
    ].join("\n");
    const sections = parseDocsMarkdownSections(markdown);

    expect(sections.map(({ title, anchor }) => ({ title, anchor }))).toEqual([
      { title: "Nested visible", anchor: "nested-visible" },
      { title: "Visible", anchor: "visible" },
    ]);
    expect(sections.map((section) => section.anchor)).toEqual(
      await compileDocsMarkdownHeadingAnchors(markdown),
    );
  });

  it("keeps frontmatter out of section discovery and falls back for malformed MDX", () => {
    const withFrontmatter = ["---", "title: Not a heading", "---", "# Visible"].join("\n");
    const withBomFrontmatter = `\uFEFF${withFrontmatter}`;
    const malformed = [
      "## Resolved [#linked-id]",
      "",
      "[#linked-id]: /reference",
      "",
      "## Explicit \\[#custom-id]",
      "",
      "{",
      "",
      "## After",
    ].join("\n");

    expect(parseDocsMarkdownSections(withFrontmatter)).toMatchObject([
      { title: "Visible", anchor: "visible", startLine: 1 },
    ]);
    expect(parseDocsMarkdownSections(withBomFrontmatter)).toMatchObject([
      { title: "Visible", anchor: "visible", startLine: 1 },
    ]);
    expect(
      parseDocsMarkdownSections(malformed).map(({ title, anchor, explicit }) => ({
        title,
        anchor,
        explicit,
      })),
    ).toEqual([
      {
        title: "Resolved #linked-id",
        anchor: "resolved-linked-id",
        explicit: false,
      },
      { title: "Explicit", anchor: "custom-id", explicit: true },
      { title: "After", anchor: "after", explicit: false },
    ]);
  });

  it("keeps malformed-MDX fallback out of ESM templates and comments", () => {
    const malformed = [
      "export const example = `",
      "## Hidden ESM",
      "[#visible-id]: /wrong-reference",
      "`",
      "",
      "{/*",
      "## Hidden MDX comment",
      "[#visible-id]: /also-wrong",
      "*/}",
      "",
      "<!--",
      "## Hidden HTML comment",
      "-->",
      "",
      "## Visible [#visible-id]",
      "",
      "{",
      "",
      "## After malformed expression",
    ].join("\n");

    expect(
      parseDocsMarkdownSections(malformed).map(({ title, anchor, explicit }) => ({
        title,
        anchor,
        explicit,
      })),
    ).toEqual([
      { title: "Visible", anchor: "visible-id", explicit: true },
      {
        title: "After malformed expression",
        anchor: "after-malformed-expression",
        explicit: false,
      },
    ]);
  });

  it("keeps multiline Setext headings canonical in malformed-MDX fallback", () => {
    const malformed = [
      "First *line*",
      "second `line`",
      "---",
      "",
      "{",
      "",
      "## After malformed expression",
    ].join("\n");

    expect(
      parseDocsMarkdownSections(malformed).map(({ title, anchor, level, startLine }) => ({
        title,
        anchor,
        level,
        startLine,
      })),
    ).toEqual([
      {
        title: "First line second line",
        anchor: "first-line-second-line",
        level: 2,
        startLine: 1,
      },
      {
        title: "After malformed expression",
        anchor: "after-malformed-expression",
        level: 2,
        startLine: 7,
      },
    ]);
  });
});

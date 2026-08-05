import { compile } from "@mdx-js/mdx";
import { collectDocsMarkdownSections, upsertPageAgentContractMarkdown } from "@farming-labs/docs";
import { describe, expect, it } from "vitest";
import remarkHeading from "./remark-heading.js";

describe("remarkHeading", () => {
  it("keeps authored DOM ids stable when agent-only contracts use the same headings", async () => {
    const markdown = [
      "## Authored [#agent-contract]",
      "",
      "Authored collision marker.",
      "",
      "## Prerequisites",
      "",
      "Authored prerequisite marker.",
    ].join("\n");
    const rendered = await compile(markdown, { remarkPlugins: [remarkHeading] });
    const renderedUrls = (rendered.data.toc as Array<{ url: string }> | undefined)?.map(
      (item) => item.url,
    );
    const agentDocument = upsertPageAgentContractMarkdown(markdown, {
      task: "Run the generated contract task.",
      outcome: "The generated contract outcome is available.",
      prerequisites: ["Generated prerequisite marker."],
    });

    expect(renderedUrls).toEqual(["#agent-contract", "#prerequisites"]);
    expect(
      collectDocsMarkdownSections(agentDocument).map(({ heading, id }) => ({
        title: heading,
        anchor: id,
      })),
    ).toEqual([
      { title: "Agent Contract", anchor: "agent-contract-1" },
      { title: "Prerequisites", anchor: "prerequisites-1" },
      { title: "Authored", anchor: "agent-contract" },
      { title: "Prerequisites", anchor: "prerequisites" },
    ]);
  });

  it("keeps rendered and agent anchors identical for complex headings", async () => {
    const markdown = `# Café 配置

## Foo &eacute; Bar

## ![Rocket](assets/a(b).png) Setup

## ![Rocket] Shortcut setup

## Use \`[#literal-id]\`

## &lt;API&gt; Setup

## \`&eacute;\` code

## \\[literal\\](url) text

## Hello <Badge title="a > b">New</Badge> World

## Overview [#release-overview]

## Entity [#foo&amp;bar]

## Hash [#foo#bar]

## Percent [#foo%23bar]

## Repeat

## Repeat

## Custom [#foo]

## Foo

## Duplicate custom [#foo]

## Foo-1

> ## Quoted

- ## Listed

<Callout>
## Nested
</Callout>

[Rocket]: /rocket.png
`;
    const rendered = await compile(markdown, { remarkPlugins: [remarkHeading] });
    const renderedUrls = (rendered.data.toc as Array<{ url: string }> | undefined)?.map(
      (item) => item.url,
    );
    const renderedAnchors = renderedUrls?.map((url) => decodeURIComponent(url.slice(1)));
    const agentAnchors = collectDocsMarkdownSections(markdown).map((section) => section.id);

    expect(renderedAnchors).toEqual(agentAnchors);
    expect(renderedAnchors).toEqual([
      "café-配置",
      "foo-é-bar",
      "setup",
      "shortcut-setup",
      "use-literal-id",
      "api-setup",
      "eacute-code",
      "literalurl-text",
      "hello-new-world",
      "release-overview",
      "foo&bar",
      "foo#bar",
      "foo%23bar",
      "repeat",
      "repeat-1",
      "foo",
      "foo-1",
      "foo-2",
      "foo-1-1",
      "quoted",
      "listed",
      "nested",
    ]);
    expect(renderedUrls).toContain("#foo%23bar");
    expect(renderedUrls).toContain("#foo%2523bar");
  });

  it("honors customId false without treating visible text as raw Markdown", async () => {
    const rendered = await compile("## Plain [#fixed]\n", {
      remarkPlugins: [[remarkHeading, { customId: false }]],
    });

    expect(rendered.data.toc).toEqual([
      {
        title: "Plain [#fixed]",
        url: "#plain-fixed",
        depth: 2,
      },
    ]);
  });

  it("keeps literal Prompt headings out of rendered and agent TOCs", async () => {
    const markdown = `<Prompt>
## Repeat [#prompt-only]

Use this as literal input.
</Prompt>

## Repeat

Visible section.
`;
    const rendered = await compile(markdown, { remarkPlugins: [remarkHeading] });
    const renderedUrls = (rendered.data.toc as Array<{ url: string }> | undefined)?.map(
      (item) => item.url,
    );
    const agentUrls = collectDocsMarkdownSections(markdown).map((section) => `#${section.id}`);

    expect(renderedUrls).toEqual(["#repeat"]);
    expect(agentUrls).toEqual(renderedUrls);
  });

  it("keeps Prompt-only reference definitions literal before MDX resolves them", async () => {
    const markdown = [
      "## [Inside][prompt-ref] Setup",
      "",
      "<Prompt>",
      "Use [prompt-ref].",
      "",
      '[prompt-ref]: /prompt-only "Prompt only"',
      "</Prompt>",
      "",
      "## [Outside][outside-ref] Setup",
      "",
      "[outside-ref]: /outside",
    ].join("\n");
    let transformedRoot: unknown;
    const captureTree = () => (root: unknown) => {
      transformedRoot = root;
    };
    const rendered = await compile(markdown, {
      remarkPlugins: [remarkHeading, captureTree],
    });
    const root = transformedRoot as {
      children?: Array<{
        type?: string;
        name?: unknown;
        value?: unknown;
        children?: Array<{
          type?: string;
          value?: unknown;
          children?: Array<{ type?: string; value?: unknown }>;
        }>;
      }>;
    };
    const headings = root.children?.filter((node) => node.type === "heading") ?? [];
    const prompt = root.children?.find(
      (node) => node.type === "mdxJsxFlowElement" && node.name === "Prompt",
    );

    expect(rendered.data.toc).toEqual([
      {
        title: "[Inside][prompt-ref] Setup",
        url: "#insideprompt-ref-setup",
        depth: 2,
      },
      {
        title: "Outside Setup",
        url: "#outside-setup",
        depth: 2,
      },
    ]);
    expect(headings[0]?.children?.map((node) => node.value).join("")).toBe(
      "[Inside][prompt-ref] Setup",
    );
    expect(headings[1]?.children?.[0]?.type).toBe("linkReference");
    expect(prompt?.children).toEqual([
      {
        type: "text",
        value: '\nUse [prompt-ref].\n\n[prompt-ref]: /prompt-only "Prompt only"\n',
      },
    ]);
    expect(String(rendered)).toContain('[prompt-ref]: /prompt-only \\"Prompt only\\"');
    expect(String(rendered)).toContain('href: "/outside"');
    expect(String(rendered)).not.toContain('href: "/prompt-only"');
  });

  it("uses a page definition when Prompt repeats the same reference identifier", async () => {
    const markdown = [
      "## [Outside][shared]",
      "",
      "<Prompt>",
      "[shared]: /prompt-only",
      "</Prompt>",
      "",
      "[shared]: /outside",
    ].join("\n");
    const rendered = await compile(markdown, { remarkPlugins: [remarkHeading] });

    expect(rendered.data.toc).toEqual([
      {
        title: "Outside",
        url: "#outside",
        depth: 2,
      },
    ]);
    expect(String(rendered)).toContain("[shared]: /prompt-only");
    expect(String(rendered)).toContain('href: "/outside"');
    expect(String(rendered)).not.toContain('href: "/prompt-only"');
  });

  it("preserves adjacent definitions as one literal Prompt child", async () => {
    const markdown = ["<Prompt>", "[a]: /a", "[b]: /b", "Use [A][a] and [B][b].", "</Prompt>"].join(
      "\n",
    );
    const rendered = await compile(markdown, { remarkPlugins: [remarkHeading] });

    expect(String(rendered)).toContain(
      'children: "\\n[a]: /a\\n[b]: /b\\nUse [A][a] and [B][b].\\n"',
    );
    expect(String(rendered)).not.toContain("href:");
  });

  it("keeps every prompt-only reference form literal outside Prompt", async () => {
    const title = [
      "[Full][full]",
      "[Collapsed][]",
      "[Shortcut]",
      "![Image][image]",
      "![Collapsed image][]",
      "![Shortcut image]",
    ].join(" ");
    const markdown = [
      `## ${title}`,
      "",
      "<Prompt>",
      "[full]: /full",
      "[Collapsed]: /collapsed",
      "[Shortcut]: /shortcut",
      "[image]: /image.png",
      "[Collapsed image]: /collapsed.png",
      "[Shortcut image]: /shortcut.png",
      "</Prompt>",
    ].join("\n");
    let transformedRoot: unknown;
    const captureTree = () => (root: unknown) => {
      transformedRoot = root;
    };
    const rendered = await compile(markdown, {
      remarkPlugins: [remarkHeading, captureTree],
    });
    const root = transformedRoot as {
      children?: Array<{
        type?: string;
        value?: unknown;
        children?: Array<{ type?: string; value?: unknown }>;
      }>;
    };
    const heading = root.children?.find((node) => node.type === "heading");

    expect(
      heading?.children
        ?.filter((node) => node.value !== " ")
        .map(({ type, value }) => ({ type, value })),
    ).toEqual([
      { type: "text", value: "[Full][full]" },
      { type: "text", value: "[Collapsed][]" },
      { type: "text", value: "[Shortcut]" },
      { type: "text", value: "![Image][image]" },
      { type: "text", value: "![Collapsed image][]" },
      { type: "text", value: "![Shortcut image]" },
    ]);
    expect((rendered.data.toc as Array<{ title: string }> | undefined)?.[0]?.title).toBe(title);
    expect(String(rendered)).not.toContain("href:");
    expect(String(rendered)).not.toContain("src:");
  });

  it("keeps Prompt references literal when their definitions belong to the page", async () => {
    const markdown = [
      "<Prompt>",
      "Keep [shared] as source.",
      "</Prompt>",
      "",
      "## [Shared][shared]",
      "",
      "[shared]: /outside",
    ].join("\n");
    const rendered = await compile(markdown, { remarkPlugins: [remarkHeading] });

    expect(rendered.data.toc).toEqual([
      {
        title: "Shared",
        url: "#shared",
        depth: 2,
      },
    ]);
    expect(String(rendered)).toContain("Keep [shared] as source.");
    expect(String(rendered).match(/href: "\/outside"/gu)).toHaveLength(1);
  });

  it("preserves Prompt reference source in BOM-prefixed MDX", async () => {
    const markdown = [
      "\uFEFF<Prompt>",
      "[X][x]",
      "",
      "[x]: /prompt-only",
      "</Prompt>",
      "",
      "## [X][x]",
    ].join("\n");
    const rendered = await compile(markdown, { remarkPlugins: [remarkHeading] });

    expect(rendered.data.toc).toEqual([
      {
        title: "[X][x]",
        url: "#xx",
        depth: 2,
      },
    ]);
    expect(String(rendered).match(/children: "\[X\]\[x\]"/gu)).toHaveLength(1);
    expect(String(rendered)).toContain('children: "\\n[X][x]\\n\\n[x]: /prompt-only\\n"');
  });

  it("keeps Prompt headings out when a custom slug callback is configured", async () => {
    const rendered = await compile(`<Prompt>\n## Hidden\n</Prompt>\n\n## Café 配置\n`, {
      remarkPlugins: [
        [
          remarkHeading,
          {
            slug: (_root: unknown, _heading: unknown, text: string) =>
              `custom-${text.toLowerCase()}#v2`,
          },
        ],
      ],
    });

    expect(rendered.data.toc).toEqual([
      {
        title: "Café 配置",
        url: "#custom-caf%C3%A9%20%E9%85%8D%E7%BD%AE%23v2",
        depth: 2,
      },
    ]);
  });
});

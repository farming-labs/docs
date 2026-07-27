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

  it("keeps Prompt headings out when a custom slug callback is configured", async () => {
    const rendered = await compile(`<Prompt>\n## Hidden\n</Prompt>\n\n## Visible\n`, {
      remarkPlugins: [
        [
          remarkHeading,
          {
            slug: (_root: unknown, _heading: unknown, text: string) =>
              `custom-${text.toLowerCase()}`,
          },
        ],
      ],
    });

    expect(rendered.data.toc).toEqual([
      {
        title: "Visible",
        url: "#custom-visible",
        depth: 2,
      },
    ]);
  });
});

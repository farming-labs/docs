import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./markdown-parser.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./markdown-parser.js")>();
  return { ...actual, createDocsMarkdownParser: vi.fn(actual.createDocsMarkdownParser) };
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("on-demand MDX processors", () => {
  it("does not construct parsers when the public entry is used for configuration", async () => {
    const { defineDocs } = await import("./index.js");
    const { createDocsMarkdownParser } = await import("./markdown-parser.js");

    expect(defineDocs({ entry: "guides" }).entry).toBe("guides");
    expect(createDocsMarkdownParser).not.toHaveBeenCalled();
  });

  it("initializes the audience MDX parser on demand and reuses it across documents", async () => {
    const { findDocsAudienceMdxTags } = await import("./audience.js");
    const { createDocsMarkdownParser } = await import("./markdown-parser.js");

    expect(findDocsAudienceMdxTags("Plain Markdown")).toEqual([]);
    expect(createDocsMarkdownParser).not.toHaveBeenCalled();
    expect(findDocsAudienceMdxTags("<Human>First</Human>")).toHaveLength(2);
    const callsAfterFirst = vi.mocked(createDocsMarkdownParser).mock.calls.length;
    expect(findDocsAudienceMdxTags("<Agent>Second</Agent>")).toHaveLength(2);
    expect(createDocsMarkdownParser).toHaveBeenCalledTimes(callsAfterFirst);
    expect(
      vi.mocked(createDocsMarkdownParser).mock.calls.filter(([format]) => format === "mdx"),
    ).toHaveLength(1);
  });

  it("reuses the separate Markdown parser without changing prompt extraction", async () => {
    const { extractDocsMarkdownPromptBlocks } = await import("./audience.js");
    const { createDocsMarkdownParser } = await import("./markdown-parser.js");

    const first = extractDocsMarkdownPromptBlocks("<Prompt>First instruction</Prompt>");
    const callsAfterFirst = vi.mocked(createDocsMarkdownParser).mock.calls.length;
    const second = extractDocsMarkdownPromptBlocks("<Prompt>Second instruction</Prompt>");

    expect(JSON.stringify(first)).toContain("First instruction");
    expect(JSON.stringify(second)).toContain("Second instruction");
    expect(JSON.stringify(second)).not.toContain("First instruction");
    expect(createDocsMarkdownParser).toHaveBeenCalledTimes(callsAfterFirst);
    expect(
      vi.mocked(createDocsMarkdownParser).mock.calls.filter(([format]) => format === "md"),
    ).toHaveLength(1);
  });

  it("reuses the section parser while keeping heading state local to each document", async () => {
    const { parseDocsMarkdownSections } = await import("./markdown-sections.js");
    const { createDocsMarkdownParser } = await import("./markdown-parser.js");

    expect(createDocsMarkdownParser).not.toHaveBeenCalled();
    const first = parseDocsMarkdownSections("# Setup\n\nFirst.\n\n## Setup\n\nMore.");
    const second = parseDocsMarkdownSections("# Setup\n\nSecond.");

    expect(first.map((section) => section.anchor)).toEqual(["setup", "setup-1"]);
    expect(second.map((section) => section.anchor)).toEqual(["setup"]);
    expect(second[0].content).toContain("Second.");
    expect(createDocsMarkdownParser).toHaveBeenCalledTimes(1);
  });
});

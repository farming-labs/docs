import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mdx-js/mdx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mdx-js/mdx")>();
  return { ...actual, createProcessor: vi.fn(actual.createProcessor) };
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("on-demand MDX processors", () => {
  it("does not construct parsers when the public entry is used for configuration", async () => {
    const { defineDocs } = await import("./index.js");
    const { createProcessor } = await import("@mdx-js/mdx");

    expect(defineDocs({ entry: "guides" }).entry).toBe("guides");
    expect(createProcessor).not.toHaveBeenCalled();
  });

  it("initializes the audience MDX parser on demand and reuses it across documents", async () => {
    const { findDocsAudienceMdxTags } = await import("./audience.js");
    const { createProcessor } = await import("@mdx-js/mdx");

    expect(findDocsAudienceMdxTags("Plain Markdown")).toEqual([]);
    expect(createProcessor).not.toHaveBeenCalled();
    expect(findDocsAudienceMdxTags("<Human>First</Human>")).toHaveLength(2);
    const callsAfterFirst = vi.mocked(createProcessor).mock.calls.length;
    expect(findDocsAudienceMdxTags("<Agent>Second</Agent>")).toHaveLength(2);
    expect(createProcessor).toHaveBeenCalledTimes(callsAfterFirst);
    expect(
      vi.mocked(createProcessor).mock.calls.filter(([options]) => options?.format === "mdx"),
    ).toHaveLength(1);
  });

  it("reuses the separate Markdown parser without changing prompt extraction", async () => {
    const { extractDocsMarkdownPromptBlocks } = await import("./audience.js");
    const { createProcessor } = await import("@mdx-js/mdx");

    const first = extractDocsMarkdownPromptBlocks("<Prompt>First instruction</Prompt>");
    const callsAfterFirst = vi.mocked(createProcessor).mock.calls.length;
    const second = extractDocsMarkdownPromptBlocks("<Prompt>Second instruction</Prompt>");

    expect(JSON.stringify(first)).toContain("First instruction");
    expect(JSON.stringify(second)).toContain("Second instruction");
    expect(JSON.stringify(second)).not.toContain("First instruction");
    expect(createProcessor).toHaveBeenCalledTimes(callsAfterFirst);
    expect(
      vi.mocked(createProcessor).mock.calls.filter(([options]) => options?.format === "md"),
    ).toHaveLength(1);
  });

  it("reuses the section parser while keeping heading state local to each document", async () => {
    const { parseDocsMarkdownSections } = await import("./markdown-sections.js");
    const { createProcessor } = await import("@mdx-js/mdx");

    expect(createProcessor).not.toHaveBeenCalled();
    const first = parseDocsMarkdownSections("# Setup\n\nFirst.\n\n## Setup\n\nMore.");
    const second = parseDocsMarkdownSections("# Setup\n\nSecond.");

    expect(first.map((section) => section.anchor)).toEqual(["setup", "setup-1"]);
    expect(second.map((section) => section.anchor)).toEqual(["setup"]);
    expect(second[0].content).toContain("Second.");
    expect(createProcessor).toHaveBeenCalledTimes(1);
  });
});

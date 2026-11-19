import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./markdown-parser.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./markdown-parser.js")>();
  return { ...actual, createDocsMarkdownParser: vi.fn(actual.createDocsMarkdownParser) };
});

vi.mock("inkspan", { spy: true });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("on-demand MDX processors", () => {
  it.each([
    "---\ntitle: '<Agent> 🌱'\n---\n",
    "\uFEFF---\r\ntitle: '<Human> 🌱'\r\n...\r\n",
    "+++\ntitle = '<Audience> 🌱'\n+++\n",
  ])("indexes static audience wrappers after frontmatter with original offsets", async (header) => {
    const { findDocsAudienceMdxIssues, findDocsAudienceMdxTags } = await import("./audience.js");
    const { createDocsMarkdownParser } = await import("./markdown-parser.js");
    const body = "\n# 題名\n\n<Audience>\nText\n</Audience>";
    const source = header + body;
    const tags = findDocsAudienceMdxTags(source);
    expect(tags.map(({ index, end }) => source.slice(index, end))).toEqual([
      "<Audience>",
      "</Audience>",
    ]);
    expect(findDocsAudienceMdxIssues(source)).toEqual([
      expect.objectContaining({ code: "missing-only", index: source.lastIndexOf("<Audience>") }),
    ]);
    expect(createDocsMarkdownParser).not.toHaveBeenCalled();
  });

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

  it("parses each new source while keeping heading state local to each document", async () => {
    const { parseDocsMarkdownSections } = await import("./markdown-sections.js");
    const { parseMarkdownOutline } = await import("inkspan");

    expect(parseMarkdownOutline).not.toHaveBeenCalled();
    const first = parseDocsMarkdownSections("# Setup\n\nFirst.\n\n## Setup\n\nMore.");
    const second = parseDocsMarkdownSections("# Setup\n\nSecond.");

    expect(first.map((section) => section.anchor)).toEqual(["setup", "setup-1"]);
    expect(second.map((section) => section.anchor)).toEqual(["setup"]);
    expect(second[0].content).toContain("Second.");
    expect(parseMarkdownOutline).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "reuses unchanged section results and sees edits (fallback: %s)",
    async (fallback) => {
      const { parseDocsMarkdownSections } = await import("./markdown-sections.js");
      const { parseMarkdownOutline } = await import("inkspan");
      const source = "# Setup\n\nOriginal.\n\n## Setup\n\nMore." + (fallback ? "\n\n{" : "");
      const expected = parseDocsMarkdownSections(source);
      expect(parseMarkdownOutline).toHaveBeenCalledTimes(1);
      vi.mocked(parseMarkdownOutline).mockClear();

      const again = parseDocsMarkdownSections(source);
      expect(again).toEqual(expected);
      again[0].content = "Caller mutation";
      again.length = 0;
      expect(parseDocsMarkdownSections(source)).toEqual(expected);
      expect(parseMarkdownOutline).not.toHaveBeenCalled();

      const edited = parseDocsMarkdownSections(source.replace("Original.", "Updated."));
      expect(edited[0].content).toContain("Updated.");
      expect(edited[0].content).not.toContain("Original.");
      expect(parseMarkdownOutline).toHaveBeenCalledTimes(1);
      expect(parseDocsMarkdownSections(source)).toEqual(expected);
    },
  );
});

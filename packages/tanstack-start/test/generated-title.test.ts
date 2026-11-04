import { describe, expect, it } from "vitest";
import { createDocsServer } from "../src/server.js";

function load(theme: unknown, body: string) {
  return createDocsServer({
    entry: "docs",
    theme,
    _preloadedContent: {
      "/docs/page.md": `---\ntitle: Introduction\n---\n\n${body}`,
    },
  } as any).load({ pathname: "/docs" });
}

describe("createDocsServer generated page titles", () => {
  const generatedTitleTheme = { name: "assistant-ui", ui: { page: { generatedTitle: true } } };

  it("hands the layout the frontmatter title when the theme enables it", async () => {
    const page = await load(generatedTitleTheme, "Body without a heading.");

    expect(page.generatedTitle).toBe("Introduction");
  });

  it("leaves the title to the body when it authors one", async () => {
    const page = await load(generatedTitleTheme, "# Introduction\n\nBody.");

    expect(page.generatedTitle).toBeUndefined();
  });

  it("generates no title for themes without the option", async () => {
    const page = await load({ name: "shadcn" }, "Body without a heading.");

    expect(page.generatedTitle).toBeUndefined();
  });
});

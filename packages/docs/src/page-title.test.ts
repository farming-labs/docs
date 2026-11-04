import { describe, expect, it } from "vitest";
import { hasAuthoredPageTitle, resolveGeneratedPageTitle } from "./page-title.js";

describe("hasAuthoredPageTitle", () => {
  it.each([
    ["an ATX heading", "# Install\n\nBody."],
    ["an HTML h1", '<h1 className="hero">Install</h1>'],
    ["a setext heading", "Install\n======="],
  ])("detects %s", (_label, content) => {
    expect(hasAuthoredPageTitle(content)).toBe(true);
  });

  it.each([
    ["a body with no heading", "Body without a heading."],
    ["an h1 inside a fenced example", "```md\n# Example heading\n```"],
    ["only lower-level headings", "## Section\n\n### Detail"],
  ])("ignores %s", (_label, content) => {
    expect(hasAuthoredPageTitle(content)).toBe(false);
  });
});

describe("resolveGeneratedPageTitle", () => {
  const enabled = { name: "assistant-ui", ui: { page: { generatedTitle: true } } };

  it("returns the frontmatter title when the theme enables it and the body has no h1", () => {
    expect(resolveGeneratedPageTitle(enabled, { title: "Install" }, "Body.")).toBe("Install");
  });

  it("returns nothing when the body authors its own title", () => {
    expect(resolveGeneratedPageTitle(enabled, { title: "Install" }, "# Install\n\nBody.")).toBe(
      undefined,
    );
  });

  it("returns nothing without a string frontmatter title", () => {
    expect(resolveGeneratedPageTitle(enabled, {}, "Body.")).toBe(undefined);
  });

  it("keeps generating titles for a theme named shadcn that leaves the option unset", () => {
    expect(resolveGeneratedPageTitle({ name: "shadcn" }, { title: "Install" }, "Body.")).toBe(
      "Install",
    );
  });

  it.each([
    ["no theme", undefined],
    ["a theme without the option", { name: "ledger" }],
    [
      "a shadcn-named theme that disables the option",
      { name: "shadcn", ui: { page: { generatedTitle: false } } },
    ],
    ["a theme that disables the option", { ui: { page: { generatedTitle: false } } }],
  ])("returns nothing for %s", (_label, theme) => {
    expect(resolveGeneratedPageTitle(theme, { title: "Install" }, "Body.")).toBe(undefined);
  });
});

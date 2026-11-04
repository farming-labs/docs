import { describe, expect, it } from "vitest";
import { formatGithubEditUrl } from "./github-edit-url.js";

describe("formatGithubEditUrl", () => {
  it("replaces {path} with the repo-relative source path", () => {
    expect(
      formatGithubEditUrl(
        "https://github.com/acme/docs/edit/main/{path}",
        "apps/docs/content/guides/install.mdx",
      ),
    ).toBe("https://github.com/acme/docs/edit/main/apps/docs/content/guides/install.mdx");
  });

  it("drops leading and duplicate slashes so templates control the separator", () => {
    expect(formatGithubEditUrl("https://example.com/edit/{path}", "/docs//page.mdx")).toBe(
      "https://example.com/edit/docs/page.mdx",
    );
  });

  it("encodes each segment so the path is safe in a path or a query", () => {
    expect(
      formatGithubEditUrl("https://cms.example.com/open?file={path}", "docs/a b/c#1?.mdx"),
    ).toBe("https://cms.example.com/open?file=docs/a%20b/c%231%3F.mdx");
  });

  it("fills every placeholder and leaves templates without one unchanged", () => {
    expect(formatGithubEditUrl("{path}|{path}", "x.mdx")).toBe("x.mdx|x.mdx");
    expect(formatGithubEditUrl("https://example.com/edit", "x.mdx")).toBe(
      "https://example.com/edit",
    );
  });
});

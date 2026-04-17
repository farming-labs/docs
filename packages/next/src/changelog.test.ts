import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createNextChangelogEntryPage } from "./changelog.js";
import { ChangelogTOC } from "./changelog-rail-search.js";

describe("changelog rendering", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), "next-changelog-test-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("preserves explicit heading ids in the changelog TOC", async () => {
    const sourcePath = "app/docs/changelog/2026-04-15/page.mdx";
    mkdirSync(join(tempDir, "app", "docs", "changelog", "2026-04-15"), { recursive: true });
    writeFileSync(
      join(tempDir, sourcePath),
      `---
title: "Release"
---

## Overview [#release-overview]

Release notes.
`,
      "utf-8",
    );

    process.chdir(tempDir);

    const Page = createNextChangelogEntryPage(
      {
        entry: "docs",
        changelog: true,
      },
      [
        {
          slug: "2026-04-15",
          date: "2026-04-15",
          url: "/docs/changelogs/2026-04-15",
          sourcePath,
          Component: () => null,
          metadata: {
            title: "Release",
          },
        },
      ],
    );

    const html = renderToStaticMarkup(
      await Page({
        params: { slug: "2026-04-15" },
      }),
    );

    expect(html).toContain('href="#release-overview"');
  });

  it("renders the changelog TOC without injecting an inline script", () => {
    const html = renderToStaticMarkup(
      createElement(ChangelogTOC, {
        title: "Releases",
        items: [
          {
            href: "#release-overview",
            title: "Release overview",
          },
        ],
      }),
    );

    expect(html).not.toContain("<script");
  });
});

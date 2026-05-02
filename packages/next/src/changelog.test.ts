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

  it("truncates long pagination titles and descriptions for previous and next changelog cards", async () => {
    process.chdir(tempDir);

    const Page = createNextChangelogEntryPage(
      {
        entry: "docs",
        changelog: true,
      },
      [
        {
          slug: "2026-04-20",
          date: "2026-04-20",
          url: "/docs/changelogs/2026-04-20",
          sourcePath: "app/docs/changelog/2026-04-20/page.mdx",
          Component: () => null,
          metadata: {
            title:
              "Newest release with an extremely long title that should never render the title marker NEXT_TITLE_MARKER_SHOULD_NOT_APPEAR in full",
            description:
              "This is a very long changelog description that should be shortened in the pagination card before the special marker NEXT_MARKER_SHOULD_NOT_APPEAR is ever rendered in full.",
          },
        },
        {
          slug: "2026-04-15",
          date: "2026-04-15",
          url: "/docs/changelogs/2026-04-15",
          sourcePath: "app/docs/changelog/2026-04-15/page.mdx",
          Component: () => null,
          metadata: {
            title: "Middle release",
            description: "Short current release description.",
          },
        },
        {
          slug: "2026-04-10",
          date: "2026-04-10",
          url: "/docs/changelogs/2026-04-10",
          sourcePath: "app/docs/changelog/2026-04-10/page.mdx",
          Component: () => null,
          metadata: {
            title:
              "Older release with another very long title that should not render the previous title marker PREV_TITLE_MARKER_SHOULD_NOT_APPEAR in full",
            description:
              "This is another intentionally long changelog description that should be shortened in the pagination card before the marker PREV_MARKER_SHOULD_NOT_APPEAR is rendered in full.",
          },
        },
      ],
    );

    const html = renderToStaticMarkup(
      await Page({
        params: { slug: "2026-04-15" },
      }),
    );

    expect(html).toContain("fd-page-nav-description");
    expect(html).toContain("…");
    expect(html).not.toContain("NEXT_MARKER_SHOULD_NOT_APPEAR");
    expect(html).not.toContain("PREV_MARKER_SHOULD_NOT_APPEAR");
    expect(html).not.toContain("NEXT_TITLE_MARKER_SHOULD_NOT_APPEAR");
    expect(html).not.toContain("PREV_TITLE_MARKER_SHOULD_NOT_APPEAR");
  });
});

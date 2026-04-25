import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDocsLayout } from "./docs-layout.js";

function findDocsPageClientProps(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as {
    type?: unknown;
    props?: Record<string, unknown> & { children?: unknown };
  };

  if (
    candidate.type &&
    candidate.props &&
    "copyMarkdown" in candidate.props &&
    "openDocs" in candidate.props
  ) {
    return candidate.props;
  }

  const children = candidate.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findDocsPageClientProps(child);
      if (found) return found;
    }
    return null;
  }

  return children ? findDocsPageClientProps(children) : null;
}

function findDocsLayoutTree(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as {
    props?: Record<string, unknown> & { children?: unknown };
  };

  if (candidate.props && "tree" in candidate.props) {
    return candidate.props.tree as Record<string, unknown>;
  }

  const children = candidate.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findDocsLayoutTree(child);
      if (found) return found;
    }
    return null;
  }

  return children ? findDocsLayoutTree(children) : null;
}

describe("createDocsLayout pageActions", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), "docs-layout-page-actions-"));
    mkdirSync(join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "page.mdx"),
      "---\ntitle: Home\n---\n\n# Home\n",
      "utf-8",
    );
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes enabled page actions through to DocsPageClient", () => {
    const Layout = createDocsLayout({
      entry: "docs",
      pageActions: {
        alignment: "right",
        copyMarkdown: { enabled: true },
        openDocs: { enabled: true },
      },
    });

    const tree = Layout({
      children: React.createElement("div", null, "child"),
    });
    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.copyMarkdown).toBe(true);
    expect(props?.openDocs).toBe(true);
    expect(props?.pageActionsAlignment).toBe("right");
    expect(props?.pageActionsPosition).toBe("below-title");
  });

  it("supports boolean shorthand, custom providers, and above-title placement", () => {
    const Layout = createDocsLayout({
      entry: "docs",
      github: "https://github.com/farming-labs/docs",
      pageActions: {
        alignment: "left",
        position: "above-title",
        copyMarkdown: true,
        openDocs: {
          enabled: true,
          providers: [
            {
              name: "GitHub",
              icon: React.createElement("span", null, "GH"),
              urlTemplate: "{githubUrl}",
            },
          ],
        },
      },
    });

    const tree = Layout({
      children: React.createElement("div", null, "child"),
    });
    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.copyMarkdown).toBe(true);
    expect(props?.openDocs).toBe(true);
    expect(props?.pageActionsAlignment).toBe("left");
    expect(props?.pageActionsPosition).toBe("above-title");
    expect(props?.openDocsProviders).toEqual([
      expect.objectContaining({
        name: "GitHub",
        urlTemplate: "{githubUrl}",
        iconHtml: expect.stringContaining("GH"),
      }),
    ]);
  });

  it("supports openDocs boolean shorthand with default providers", () => {
    const Layout = createDocsLayout({
      entry: "docs",
      pageActions: {
        alignment: "right",
        openDocs: true,
      },
    });

    const tree = Layout({
      children: React.createElement("div", null, "child"),
    });
    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.copyMarkdown).toBe(false);
    expect(props?.openDocs).toBe(true);
    expect(props?.pageActionsAlignment).toBe("right");
    expect(props?.pageActionsPosition).toBe("below-title");
    expect(props?.openDocsProviders).toBeUndefined();
  });

  it("defaults page actions to disabled", () => {
    const Layout = createDocsLayout({
      entry: "docs",
    });

    const tree = Layout({
      children: React.createElement("div", null, "child"),
    });
    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.copyMarkdown).toBe(false);
    expect(props?.openDocs).toBe(false);
  });

  it("passes computed reading time through to DocsPageClient when enabled", () => {
    mkdirSync(join(tmpDir, "app", "docs", "installation"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "installation", "page.mdx"),
      [
        "---",
        "title: Installation",
        "---",
        "",
        "# Installation",
        "",
        "This page explains how to install the framework in an existing app.",
      ].join("\n"),
      "utf-8",
    );

    const Layout = createDocsLayout({
      entry: "docs",
      readingTime: { enabled: true, wordsPerMinute: 200 },
    });

    const tree = Layout({
      children: React.createElement("div", null, "child"),
    });
    const props = findDocsPageClientProps(tree);

    expect(props).toBeTruthy();
    expect(props?.readingTimeEnabled).toBe(true);
    expect(props?.readingTimeMap).toMatchObject({
      "/docs": 1,
      "/docs/installation": 1,
    });
  });

  it("adds changelog entries as a dedicated sidebar section under the docs route with a separator above it", () => {
    mkdirSync(join(tmpDir, "app", "docs", "changelog", "2026-04-15"), { recursive: true });
    mkdirSync(join(tmpDir, "app", "docs", "changelog", "2026-04-03"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "changelog", "2026-04-15", "page.mdx"),
      "---\ntitle: OpenAPI mode is now the default\ndescription: First entry\npinned: true\n---\n\n# Release\n",
      "utf-8",
    );
    writeFileSync(
      join(tmpDir, "app", "docs", "changelog", "2026-04-03", "page.mdx"),
      "---\ntitle: Colorful theme cleanup\ndescription: Second entry\n---\n\n# Release\n",
      "utf-8",
    );

    const Layout = createDocsLayout({
      entry: "docs",
      changelog: {
        enabled: true,
        path: "changelogs",
        contentDir: "changelog",
        title: "Changelogs",
      },
    });

    const tree = Layout({
      children: React.createElement("div", null, "child"),
    });
    const sidebarTree = findDocsLayoutTree(tree);
    const children = sidebarTree?.children as Array<Record<string, unknown>>;
    const separatorIndex = children?.findIndex(
      (entry) => entry.type === "separator" && entry.name === "Updates",
    );
    const changelogIndex = children?.findIndex((entry) => entry.name === "Changelogs") ?? -1;
    const changelogNode = changelogIndex >= 0 ? children[changelogIndex] : undefined;

    expect(separatorIndex).toBeGreaterThan(-1);
    expect(changelogIndex).toBeGreaterThan(separatorIndex ?? -1);
    expect(changelogNode).toBeTruthy();
    expect(changelogNode?.type).toBe("folder");
    expect(changelogNode?.index).toMatchObject({
      name: "Changelogs",
      url: "/docs/changelogs",
    });
    expect(changelogNode?.children).toEqual([
      expect.objectContaining({
        name: "OpenAPI mode is now the default",
        url: "/docs/changelogs/2026-04-15",
      }),
      expect.objectContaining({
        name: "Colorful theme cleanup",
        url: "/docs/changelogs/2026-04-03",
      }),
    ]);
  });
});

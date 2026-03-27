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
});

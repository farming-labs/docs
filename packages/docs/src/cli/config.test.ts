import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { resolveDocsContentDir } from "./config.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveDocsContentDir", () => {
  it("prefers app/<entry> when contentDir is not configured", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-search-sync-"));
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });

    expect(
      resolveDocsContentDir(rootDir, 'export default defineDocs({ entry: "docs" })', "docs"),
    ).toBe("app/docs");
  });

  it("uses the configured contentDir when present", () => {
    expect(
      resolveDocsContentDir(
        "/tmp/project",
        'export default defineDocs({ entry: "docs", contentDir: "content/docs" })',
        "docs",
      ),
    ).toBe("content/docs");
  });
});

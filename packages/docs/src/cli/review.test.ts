import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runReview } from "./review.js";

describe("docs review cli", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), "docs-review-cli-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("does not validate markdown image links as docs page routes", async () => {
    mkdirSync(join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "docs.config.ts"), "export default { entry: 'docs' };\n", "utf-8");
    writeFileSync(
      join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: Docs
description: Docs page
---

Initial content.
`,
      "utf-8",
    );

    git(["init"]);
    git(["config", "user.email", "docs@example.com"]);
    git(["config", "user.name", "Docs Test"]);
    git(["add", "."]);
    git(["commit", "-m", "initial docs"]);

    writeFileSync(
      join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: Docs
description: Docs page
---

![Architecture diagram](/docs/images/architecture.png)
`,
      "utf-8",
    );
    git(["add", "."]);
    git(["commit", "-m", "add docs image"]);
    process.chdir(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runReview({ ci: true });

    expect(report).toMatchObject({
      score: 100,
      reviewedFiles: ["app/docs/page.mdx"],
      findings: [],
    });
  });

  function git(args: string[]) {
    execFileSync("git", args, { cwd: tmpDir, stdio: "ignore" });
  }
});

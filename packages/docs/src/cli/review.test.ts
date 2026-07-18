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

  it("accepts useful agent contracts and reports malformed or incomplete contracts", async () => {
    mkdirSync(join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  review: { rules: { agentContext: "warn" } },
};
`,
      "utf-8",
    );
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

    mkdirSync(join(tmpDir, "app", "docs", "good"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "good", "page.mdx"),
      `---
title: Configure MCP
description: Configure the MCP endpoint
agent:
  task: Configure the MCP endpoint
  outcome: The endpoint serves documentation resources.
  commands:
    - pnpm test
  verification:
    - Tests pass
---

Configure MCP for the docs site.
`,
      "utf-8",
    );

    mkdirSync(join(tmpDir, "app", "docs", "bad"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "bad", "page.mdx"),
      `---
title: Deploy docs
description: Deploy the documentation site
agent:
  task: Deploy the documentation site
  files: docs.config.ts
  commands:
    - pnpm deploy
  sideEffects:
    - Publishes a production deployment
  verfication:
    - The deployment is reachable
---

Deploy the docs site.
`,
      "utf-8",
    );

    git(["add", "."]);
    git(["commit", "-m", "add agent contracts"]);
    process.chdir(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runReview({ ci: true });
    const goodFindings = report?.findings.filter((finding) => finding.file.includes("/good/"));
    const badMessages = report?.findings
      .filter((finding) => finding.file.includes("/bad/"))
      .map((finding) => finding.message);

    expect(goodFindings).toEqual([]);
    expect(badMessages).toEqual(
      expect.arrayContaining([
        "Invalid agent.files: must be a non-empty string array.",
        'Invalid agent.verfication: is not recognized; did you mean "agent.verification"?',
        "Structured agent contract is missing outcome.",
        "Structured agent contract defines commands without verification steps.",
        "Structured agent contract defines side effects without rollback guidance.",
      ]),
    );
  });

  function git(args: string[]) {
    execFileSync("git", args, { cwd: tmpDir, stdio: "ignore" });
  }
});

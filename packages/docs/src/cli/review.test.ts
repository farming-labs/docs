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
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  agent: {
    evaluations: {
      tasks: [{
        id: "docs-home",
        query: "Docs page",
        topK: 1,
        expect: { relevantSources: ["/docs"] },
      }],
    },
  },
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
      status: "measured",
      score: 100,
      reviewedFiles: ["app/docs/page.mdx"],
      findings: [],
    });
  });

  it("reports disabled review as unmeasured instead of a perfect score", async () => {
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs", review: false };\n`,
      "utf-8",
    );
    process.chdir(tmpDir);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runReview({ json: true });

    expect(report).toMatchObject({
      status: "disabled",
      score: null,
      reviewedFiles: [],
      findings: [],
    });
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      status: "disabled",
      score: null,
    });
  });

  it("evaluates a TSX config before resolving review settings", async () => {
    writeFileSync(
      join(tmpDir, "docs.config.tsx"),
      `const reviewBadge = <span data-review="disabled">Review disabled</span>;

export default {
  entry: "docs",
  nav: { title: reviewBadge },
  pageActions: {
    custom: <button type="button">Copy context</button>,
  },
  review: reviewBadge.props["data-review"] === "disabled" ? false : true,
};
`,
      "utf-8",
    );
    process.chdir(tmpDir);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runReview({ json: true });

    expect(report).toMatchObject({
      status: "disabled",
      score: null,
      findings: [],
    });
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      status: "disabled",
      score: null,
    });
  });

  it("prints project-wide findings when no docs file changed", async () => {
    mkdirSync(join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(tmpDir, "docs.config.tsx"),
      `throw new Error("force static fallback");

export default {
  entry: "docs",
  nav: { title: <span>Docs</span> },
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

# Docs
`,
      "utf-8",
    );
    git(["init"]);
    git(["config", "user.email", "docs@example.com"]);
    git(["config", "user.name", "Docs Test"]);
    git(["add", "."]);
    git(["commit", "-m", "initial docs"]);
    writeFileSync(join(tmpDir, "README.md"), "# Project\n", "utf-8");
    git(["add", "."]);
    git(["commit", "-m", "update readme"]);
    process.chdir(tmpDir);
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      output.push(args.map(String).join(" "));
    });

    const report = await runReview();

    expect(report).toMatchObject({
      status: "measured",
      reviewedFiles: [],
      findings: [expect.objectContaining({ code: "config-static-fallback" })],
    });
    expect(output.join("\n")).toContain("No docs files changed; reporting project-wide findings.");
    expect(output.join("\n")).toContain("docs.config could not be evaluated");
    expect(output.join("\n")).not.toContain("Skipping review");
  });

  it("accepts useful agent contracts and reports malformed or incomplete contracts", async () => {
    mkdirSync(join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        private: true,
        scripts: { test: "node --version" },
        dependencies: { next: "16.0.0" },
      }),
      "utf-8",
    );
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
  prerequisites:
    - The docs app is installed.
  commands:
    - pnpm test
  verification:
    - Tests pass
  rollback:
    - Restore the previous MCP configuration.
related:
  - /docs
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
  appliesTo:
    framework: astro
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
        "Page applicability (astro) does not include the detected project framework (nextjs).",
      ]),
    );
  });

  it("reports malformed golden task arrays without crashing", async () => {
    mkdirSync(join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  agent: {
    evaluations: {
      tasks: { id: "not-an-array", query: "Read the docs" },
    },
  },
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
    writeFileSync(
      join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: Docs
description: Updated docs page
---

Updated content.
`,
      "utf-8",
    );
    git(["add", "."]);
    git(["commit", "-m", "update docs"]);
    process.chdir(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runReview({ ci: true });

    expect(report?.status).toBe("measured");
    if (!report || report.status !== "measured") throw new Error("Expected a measured review");
    expect(report.evaluations?.status).toBe("failed");
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "golden-task-failed",
          rule: "goldenTasks",
          message: expect.stringContaining("agent.evaluations.tasks must be an array"),
        }),
      ]),
    );
    expect(report.score).toBeLessThan(100);
  });

  it("flags a changed boilerplate Agent block using the full docs corpus", async () => {
    mkdirSync(join(tmpDir, "app", "docs", "first"), { recursive: true });
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  review: {
    rules: {
      goldenTasks: "off",
    },
  },
};
`,
      "utf-8",
    );
    writeFileSync(
      join(tmpDir, "app", "docs", "first", "page.mdx"),
      `---
title: First topic
description: First topic
---

<Agent>
Use this page when the user asks about the first topic.
Keep answers grounded in the examples documented here.
Point to the closest related docs instead of inventing config.
</Agent>
`,
      "utf-8",
    );

    git(["init"]);
    git(["config", "user.email", "docs@example.com"]);
    git(["config", "user.name", "Docs Test"]);
    git(["add", "."]);
    git(["commit", "-m", "initial docs"]);

    mkdirSync(join(tmpDir, "app", "docs", "second"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "second", "page.mdx"),
      `---
title: Second topic
description: Second topic
---

<Agent>
Use this page when the user asks about the second topic.
Keep answers grounded in the examples documented here.
Point to the closest related docs instead of inventing config.
</Agent>
`,
      "utf-8",
    );
    git(["add", "."]);
    git(["commit", "-m", "add repeated context"]);
    process.chdir(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runReview({ ci: true });

    expect(report?.status).toBe("measured");
    if (!report || report.status !== "measured") throw new Error("Expected a measured review");
    expect(report.reviewedFiles).toEqual(["app/docs/second/page.mdx"]);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "app/docs/second/page.mdx",
          code: "agent-block-boilerplate",
          rule: "agentContext",
          severity: "warn",
        }),
      ]),
    );
    expect(report.findings.some((finding) => finding.file.includes("/first/"))).toBe(false);
    expect(report.score).toBeLessThan(100);
  });

  it("accepts Agent and agent-only Audience blocks but not human-only audience content", async () => {
    mkdirSync(join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  review: {
    rules: {
      agentContext: "warn",
      goldenTasks: "off",
    },
  },
};
`,
      "utf-8",
    );
    writeFileSync(
      join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: Docs
description: Docs home
---

Overview.
`,
      "utf-8",
    );

    git(["init"]);
    git(["config", "user.email", "docs@example.com"]);
    git(["config", "user.name", "Docs Test"]);
    git(["add", "."]);
    git(["commit", "-m", "initial docs"]);

    const pages = [
      [
        "agent",
        '<Agent audience="implementation">The contract targets `docs.config.ts` v2.0.0.</Agent>',
      ],
      [
        "audience-agent",
        "<Audience only={'agent'}>The contract targets `src/docs.ts` v2.0.0.</Audience>",
      ],
      [
        "audience-dynamic",
        "<Audience only={runtimeAudience}>The runtime audience is unsupported.</Audience>",
      ],
      ["human", "<Human>Use the interactive setup form.</Human>"],
      ["audience-human", '<Audience only="human">Use the interactive setup form.</Audience>'],
    ] as const;

    for (const [slug, audienceBlock] of pages) {
      mkdirSync(join(tmpDir, "app", "docs", slug), { recursive: true });
      writeFileSync(
        join(tmpDir, "app", "docs", slug, "page.mdx"),
        `---
title: ${slug}
description: ${slug} page
---

Configure the docs implementation.

${audienceBlock}
`,
        "utf-8",
      );
    }

    git(["add", "."]);
    git(["commit", "-m", "add audience pages"]);
    process.chdir(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runReview({ ci: true });

    expect(report?.status).toBe("measured");
    if (!report || report.status !== "measured") throw new Error("Expected a measured review");
    const missingAgentContext = report.findings
      .filter((finding) => finding.message.startsWith("Implementation-heavy docs page"))
      .map((finding) => finding.file);
    expect(missingAgentContext).toEqual([
      "app/docs/audience-dynamic/page.mdx",
      "app/docs/audience-human/page.mdx",
      "app/docs/human/page.mdx",
    ]);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "app/docs/audience-dynamic/page.mdx",
          code: "audience-dynamic-only",
          severity: "warn",
        }),
      ]),
    );
  });

  function git(args: string[]) {
    execFileSync("git", args, { cwd: tmpDir, stdio: "ignore" });
  }
});

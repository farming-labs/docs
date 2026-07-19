import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  analyzeAgentUsefulness,
  extractAgentBlocks,
  type AgentUsefulnessPage,
} from "./agent-usefulness.js";

describe("extractAgentBlocks", () => {
  it("extracts inline and multiline blocks while ignoring fenced examples", () => {
    const blocks = extractAgentBlocks(
      `# Agent context

\`\`\`mdx
<Agent>
This is an example, not live context.
</Agent>
\`\`\`

<Agent>Run \`pnpm test\` for this page.</Agent>

<Agent audience="implementation">
Use src/server.ts.
Run pnpm test.
</Agent>

~~~mdx
<Agent>Another fenced example.</Agent>
~~~
`,
      { sourcePath: "docs/page.mdx", route: "/docs" },
    );

    expect(blocks).toEqual([
      {
        sourcePath: "docs/page.mdx",
        route: "/docs",
        line: 9,
        content: "Run `pnpm test` for this page.",
      },
      {
        sourcePath: "docs/page.mdx",
        route: "/docs",
        line: 11,
        content: "Use src/server.ts.\nRun pnpm test.",
      },
    ]);
  });
});

describe("analyzeAgentUsefulness", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "agent-usefulness-"));
    writeFileSync(
      path.join(rootDir, "package.json"),
      JSON.stringify({ name: "fixture", scripts: { test: "vitest run" } }),
      "utf-8",
    );
    writeFileSync(path.join(rootDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf-8");
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("detects exact duplicates, repeated boilerplate, and generic blocks", () => {
    const shared = `Keep answers grounded in the exact options documented here.
If the request moves beyond this page, use related docs instead of inventing config.`;
    const pages: AgentUsefulnessPage[] = [
      page(
        "one",
        `<Agent>
Use this page for the first topic.
${shared}
</Agent>`,
      ),
      page(
        "two",
        `<Agent>
Use this page for the first topic.
${shared}
</Agent>`,
      ),
      page(
        "three",
        `<Agent>
Use this page for a different topic.
${shared}
</Agent>`,
      ),
      page("generic", "<Agent>Follow the documentation.</Agent>"),
      page(
        "specific",
        "<Agent>Run `pnpm exec docs doctor` after editing `docs.config.ts`.</Agent>",
      ),
    ];

    const report = analyzeAgentUsefulness({ pages, rootDir });
    const codesFor = (slug: string) =>
      report.findings
        .filter((finding) => finding.file === `docs/${slug}/page.mdx`)
        .map((finding) => finding.code);

    expect(codesFor("one")).toContain("agent-block-duplicate");
    expect(codesFor("two")).toContain("agent-block-duplicate");
    expect(codesFor("three")).toContain("agent-block-boilerplate");
    expect(codesFor("generic")).toContain("agent-block-generic");
    expect(codesFor("specific")).not.toContain("agent-block-generic");
    expect(report.metrics.agentBlocks).toMatchObject({
      total: 5,
      duplicate: 2,
      boilerplate: 3,
      generic: 4,
      useful: 1,
    });
  });

  it("keeps fenced commands in exact duplicate signatures", () => {
    const setupBlock = (framework: string) => `<Agent>
Run the supported setup:
\`\`\`bash
pnpm exec docs init --template ${framework}
\`\`\`
</Agent>`;
    const commandOnly = `<Agent>
\`\`\`bash
pnpm exec docs doctor
\`\`\`
</Agent>`;
    const caseSensitiveBlock = (variable: string) => `<Agent>
Run the environment check:
\`\`\`bash
export ${variable}=enabled
\`\`\`
</Agent>`;
    const indentationSensitiveBlock = (indentation: string) => `<Agent>
Run the conditional check:
\`\`\`bash
if test -f docs.config.ts; then
${indentation}pnpm exec docs doctor
fi
\`\`\`
</Agent>`;

    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        { ...page("next", setupBlock("next")), actionable: false },
        { ...page("astro", setupBlock("astro")), actionable: false },
        { ...page("command-one", commandOnly), actionable: false },
        { ...page("command-two", commandOnly), actionable: false },
        { ...page("case-upper", caseSensitiveBlock("DOCS_TOKEN")), actionable: false },
        { ...page("case-lower", caseSensitiveBlock("docs_token")), actionable: false },
        { ...page("indent-two", indentationSensitiveBlock("  ")), actionable: false },
        { ...page("indent-four", indentationSensitiveBlock("    ")), actionable: false },
      ],
    });
    const duplicateFiles = report.findings
      .filter((finding) => finding.code === "agent-block-duplicate")
      .map((finding) => finding.file);

    expect(duplicateFiles).toEqual(["docs/command-one/page.mdx", "docs/command-two/page.mdx"]);
    expect(report.metrics.agentBlocks.duplicate).toBe(2);
  });

  it("does not let trivial inline tokens or links exempt generic blocks", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page("inline", "<Agent>Follow the documentation for `config`.</Agent>"),
          actionable: false,
        },
        {
          ...page(
            "link",
            "<Agent>Use this page and keep answers grounded; refer to https://example.invalid.</Agent>",
          ),
          actionable: false,
        },
        {
          ...page(
            "specific-command",
            "<Agent>Run `pnpm exec docs doctor` after editing `docs.config.ts`.</Agent>",
          ),
          actionable: false,
        },
      ],
    });
    const genericFiles = report.findings
      .filter((finding) => finding.code === "agent-block-generic")
      .map((finding) => finding.file);

    expect(genericFiles).toEqual(["docs/inline/page.mdx", "docs/link/page.mdx"]);
  });

  it("measures prerequisites, expected results, and recovery on actionable tasks", () => {
    const pages: AgentUsefulnessPage[] = [
      {
        ...page("incomplete", "# Deploy\n\nDeploy the docs."),
        agent: {
          task: "Deploy the docs",
          commands: ["node --version"],
          verification: [{ description: "Run the checks." }],
        },
        related: ["/docs/complete"],
      },
      {
        ...page("complete", "# Configure\n\nConfigure the docs."),
        agent: {
          task: "Configure the docs",
          outcome: "The docs route responds successfully.",
          prerequisites: ["Dependencies are installed."],
          commands: ["node --version"],
          verification: [{ run: "node --version", expect: "The command exits successfully." }],
          failureModes: [
            { symptom: "The command is unavailable.", resolution: "Install a supported Node.js." },
          ],
        },
        related: ["/docs/incomplete"],
      },
    ];

    const report = analyzeAgentUsefulness({ pages, rootDir });
    const incompleteCodes = report.findings
      .filter((finding) => finding.file.includes("/incomplete/"))
      .map((finding) => finding.code);
    const completeTaskFindings = report.findings.filter(
      (finding) => finding.file.includes("/complete/") && finding.category === "task",
    );

    expect(incompleteCodes).toEqual(
      expect.arrayContaining([
        "task-missing-prerequisites",
        "task-missing-expected-result",
        "task-missing-recovery",
      ]),
    );
    expect(completeTaskFindings).toEqual([]);
    expect(report.metrics.taskCompleteness).toEqual({
      completePages: 1,
      missingPrerequisites: 1,
      missingExpectedResults: 1,
      missingRecovery: 1,
      coverage: 50,
    });
  });

  it("uses sibling agent.md guidance for actionability and command source paths", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page("agent-guidance", "# Human overview"),
          agentSourcePath: "docs/agent-guidance/agent.md",
          agentSource: `# Agent workflow

## Prerequisites

Dependencies are installed.

\`\`\`bash
pnpm run missing-agent-task
\`\`\`
`,
          related: ["/docs/target"],
        },
        page("target", "# Target"),
      ],
    });
    const agentCommandFinding = report.findings.find(
      (finding) => finding.code === "command-script-missing",
    );
    const taskCodes = report.findings
      .filter((finding) => finding.category === "task")
      .map((finding) => finding.code);

    expect(report.metrics.actionablePages).toBe(1);
    expect(agentCommandFinding).toMatchObject({
      file: "docs/agent-guidance/agent.md",
      command: "pnpm run missing-agent-task",
    });
    expect(taskCodes).toEqual(["task-missing-expected-result", "task-missing-recovery"]);
  });

  it("ignores completeness headings inside fenced examples", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page(
            "fenced-template",
            `# Deploy

This page tells an agent to deploy the site.

\`\`\`md
## Prerequisites
## Expected result
## Troubleshooting
\`\`\``,
          ),
          actionable: true,
        },
      ],
    });
    const taskCodes = report.findings
      .filter((finding) => finding.category === "task")
      .map((finding) => finding.code);

    expect(taskCodes).toEqual([
      "task-missing-expected-result",
      "task-missing-prerequisites",
      "task-missing-recovery",
    ]);
    expect(report.metrics.taskCompleteness.coverage).toBe(0);
  });

  it("reports conflicting and ambiguous framework and version applicability", () => {
    const pages: AgentUsefulnessPage[] = [
      {
        ...page("conflict", "# Configure Next.js\n\nRun `pnpm test`."),
        actionable: true,
        framework: "nextjs",
        version: "v15",
        agent: {
          task: "Configure the app",
          appliesTo: { framework: "astro", version: "v16" },
        },
      },
      {
        ...page(
          "ambiguous",
          "# Migrate\n\nMigrate the deprecated v1 Next.js setup to the current v2 Astro setup.",
        ),
        actionable: true,
      },
      {
        ...page("mismatch", "# Configure Astro\n\nConfigure the Astro integration."),
        actionable: true,
        framework: "astro",
      },
    ];

    const report = analyzeAgentUsefulness({
      pages,
      rootDir,
      projectFramework: "nextjs",
    });
    const codes = report.findings.map((finding) => finding.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "applicability-framework-conflict",
        "applicability-version-conflict",
        "applicability-framework-mismatch",
        "applicability-framework-ambiguous",
        "applicability-version-ambiguous",
      ]),
    );
    expect(report.metrics.applicability).toEqual({
      conflictingPages: 1,
      ambiguousPages: 1,
      mismatchedPages: 1,
    });
  });

  it("compares exact versions against documented version ranges", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page("range-conflict", "# Version conflict"),
          actionable: false,
          version: "v15",
          agent: { appliesTo: { version: ">=16" } },
        },
        {
          ...page("range-match", "# Version match"),
          actionable: false,
          version: "16.2",
          agent: { appliesTo: { version: ">=16 <17" } },
        },
      ],
    });
    const conflictFiles = report.findings
      .filter((finding) => finding.code === "applicability-version-conflict")
      .map((finding) => finding.file);

    expect(conflictFiles).toEqual(["docs/range-conflict/page.mdx"]);
    expect(report.metrics.applicability.conflictingPages).toBe(1);
  });

  it("detects disjoint ranges and uses shared framework aliases", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      projectFramework: "start",
      pages: [
        {
          ...page("range-alias", "# Configure the integration"),
          framework: "TanStack Start",
          version: ">=16 <17",
          agent: {
            task: "Configure the integration.",
            appliesTo: { framework: "tanstack", version: ">=18 <19" },
          },
        },
      ],
    });

    expect(report.metrics.applicability).toMatchObject({
      conflictingPages: 1,
      mismatchedPages: 0,
    });
    expect(report.findings.map((finding) => finding.code)).toContain(
      "applicability-version-conflict",
    );
    expect(report.findings.map((finding) => finding.code)).not.toContain(
      "applicability-framework-conflict",
    );
  });

  it("checks package manager, scripts, working directories, and docs CLI commands", () => {
    mkdirSync(path.join(rootDir, "apps", "docs"), { recursive: true });
    writeFileSync(
      path.join(rootDir, "apps", "docs", "package.json"),
      JSON.stringify({ scripts: { build: "next build" } }),
      "utf-8",
    );

    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page("commands", "# Commands"),
          agent: {
            task: "Validate commands",
            prerequisites: ["Dependencies are installed."],
            outcome: "Commands pass.",
            recovery: undefined,
            rollback: ["Revert any generated output."],
            commands: [
              "npm run test",
              "pnpm run missing",
              { run: "pnpm run build", cwd: "apps/docs" },
              { run: "pnpm run build", cwd: "apps/missing" },
              "pnpm exec docs imaginary",
              "pnpm add @farming-labs/docs next",
              "npx @farming-labs/docs init --template next",
            ],
          },
          related: ["/docs/commands"],
        },
      ],
    });
    const codes = report.findings.map((finding) => finding.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "command-package-manager-mismatch",
        "command-script-missing",
        "command-cwd-missing",
        "command-cli-unknown",
      ]),
    );
    expect(
      report.findings
        .filter((finding) => finding.command?.startsWith("npx @farming-labs/docs"))
        .map((finding) => finding.code),
    ).not.toContain("command-script-missing");
    expect(report.metrics.commands).toEqual({
      total: 7,
      healthy: 2,
      unhealthy: 5,
      unverified: 0,
    });
  });

  it("validates common workspace selectors and separates unresolved commands", () => {
    mkdirSync(path.join(rootDir, "packages", "app"), { recursive: true });
    writeFileSync(
      path.join(rootDir, "packages", "app", "package.json"),
      JSON.stringify({ name: "@acme/app", scripts: { "target-only": "node target.js" } }),
      "utf-8",
    );

    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page(
            "workspace-commands",
            `# Workspace commands

\`\`\`bash
pnpm -F @acme/app run target-only
pnpm --filter ./packages/app run target-only
yarn workspace @acme/app target-only
npm --workspace @acme/app run missing
pnpm --filter @acme/app... run missing
pnpm run test -- --filter missing-workspace
\`\`\``,
          ),
          actionable: false,
        },
      ],
    });
    const commandFindings = report.findings.filter((finding) => finding.category === "command");

    expect(
      commandFindings
        .filter((finding) => finding.code === "command-script-missing")
        .map((finding) => finding.command),
    ).toEqual(["npm --workspace @acme/app run missing"]);
    expect(
      commandFindings
        .filter((finding) => finding.code === "command-unverified")
        .map((finding) => finding.command),
    ).toEqual(["pnpm --filter @acme/app... run missing"]);
    expect(report.metrics.commands).toEqual({
      total: 6,
      healthy: 4,
      unhealthy: 1,
      unverified: 1,
    });
  });

  it("skips prompted console output and marks unknown command forms as unverified", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page(
            "unverified-commands",
            `# Verify

\`\`\`console
$ pnpm test
Tests: 1 passed
> node --version
v22.0.0
\`\`\`

\`\`\`bash
pnpn run build
pnpm exec mystery-tool run build
\`\`\``,
          ),
          actionable: false,
        },
      ],
    });
    const unverifiedCommands = report.findings
      .filter((finding) => finding.code === "command-unverified")
      .map((finding) => finding.command);

    expect(unverifiedCommands).toEqual(
      expect.arrayContaining(["pnpn run build", "pnpm exec mystery-tool run build"]),
    );
    expect(unverifiedCommands).toHaveLength(2);
    expect(unverifiedCommands).not.toContain("Tests: 1 passed");
    expect(report.metrics.commands).toEqual({
      total: 4,
      healthy: 2,
      unhealthy: 0,
      unverified: 2,
    });
  });

  it("does not enforce the repository package manager on untagged shell examples", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page(
            "package-manager-alternatives",
            `# Install

\`\`\`bash
npm install @farming-labs/docs
\`\`\`

\`\`\`bash
pnpm add @farming-labs/docs
\`\`\`

\`\`\`bash packageManager=pnpm
npm install @farming-labs/docs
\`\`\``,
          ),
          actionable: false,
        },
      ],
    });
    const mismatches = report.findings.filter(
      (finding) => finding.code === "command-package-manager-mismatch",
    );

    expect(mismatches.map((finding) => finding.command)).toEqual([
      "npm install @farming-labs/docs",
    ]);
    expect(report.metrics.commands).toEqual({
      total: 3,
      healthy: 2,
      unhealthy: 1,
      unverified: 0,
    });
  });

  it("measures valid, missing, and broken related-page coverage", () => {
    const pages: AgentUsefulnessPage[] = [
      {
        ...page("good", "# Good"),
        actionable: true,
        related: ["/docs/target"],
      },
      {
        ...page("missing", "# Missing"),
        actionable: true,
        related: ["https://example.com/reference"],
      },
      {
        ...page("broken", "# Broken"),
        actionable: true,
        related: ["/docs/does-not-exist"],
      },
      page("target", "# Target"),
    ];

    const report = analyzeAgentUsefulness({ pages, rootDir });
    const brokenCodes = report.findings
      .filter((finding) => finding.file.includes("/broken/"))
      .map((finding) => finding.code);

    expect(brokenCodes).toEqual(expect.arrayContaining(["related-broken", "related-missing"]));
    expect(report.metrics.related).toEqual({
      coveredActionablePages: 1,
      missingActionablePages: 2,
      brokenLinks: 1,
      coverage: 33,
    });
  });
});

function page(slug: string, source: string): AgentUsefulnessPage {
  return {
    route: `/docs/${slug}`,
    sourcePath: `docs/${slug}/page.mdx`,
    source,
  };
}

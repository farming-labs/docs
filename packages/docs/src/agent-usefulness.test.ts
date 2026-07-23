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

  it("recognizes static agent audiences without counting human or example markup", () => {
    const source = [
      "<Human>Human guidance.</Human>",
      '<Audience only="human">Human audience.</Audience>',
      "<Audience only={audience}>Dynamic audience.</Audience>",
      '<Audience only="agent">Run `pnpm test`.</Audience>',
      "<Audience only='agent'>Read `src/server.ts`.</Audience>",
      '<Audience only={"agent"}>Verify `/docs.md`.</Audience>',
      "<Audience only={'agent'}><Human>Hidden from agents.</Human>Keep `docs.config.ts`.</Audience>",
      '`<Audience only="agent">Inline example.</Audience>`',
      "```mdx",
      '<Audience only="agent">Fenced example.</Audience>',
      "```",
      '<Agent audience="implementation">Use `src/index.ts`.</Agent>',
      "<Human><Agent>Unreachable agent context.</Agent></Human>",
      '<Audience only="agent" />',
      '<Audience data-only="agent">Shared metadata, not an audience declaration.</Audience>',
      '{/* <Audience only="agent">MDX comment.</Audience> */}',
      "<!-- <Agent>HTML comment.</Agent> -->",
      'export const example = "<Agent>Module string.</Agent>";',
      "<Audience",
      '  only="agent"',
      ">",
      "Run `pnpm exec docs doctor` after multiline authoring.",
      "</Audience>",
    ].join("\n");

    expect(extractAgentBlocks(source, { sourcePath: "docs/audience.mdx" })).toEqual([
      {
        sourcePath: "docs/audience.mdx",
        line: 4,
        content: "Run `pnpm test`.",
      },
      {
        sourcePath: "docs/audience.mdx",
        line: 5,
        content: "Read `src/server.ts`.",
      },
      {
        sourcePath: "docs/audience.mdx",
        line: 6,
        content: "Verify `/docs.md`.",
      },
      {
        sourcePath: "docs/audience.mdx",
        line: 7,
        content: "Keep `docs.config.ts`.",
      },
      {
        sourcePath: "docs/audience.mdx",
        line: 12,
        content: "Use `src/index.ts`.",
      },
      {
        sourcePath: "docs/audience.mdx",
        line: 19,
        content: "Run `pnpm exec docs doctor` after multiline authoring.",
      },
    ]);
  });

  it.each([
    [
      "multiline import",
      `import {
  thing,
}
from "<Agent>module path literal</Agent>";`,
    ],
    ["multiline code span", "Shared `starts\n<Agent>literal code</Agent>` end."],
    ["escaped markup", String.raw`\<Agent>literal escaped\</Agent>`],
    ["JSX prop string", '<Example code="<Agent>literal prop</Agent>" />'],
    ["MDX expression string", '{"<Agent>literal expression</Agent>"}'],
    ["Markdown link title", '[link](https://example.com "See <Agent>literal</Agent>")'],
    [
      "raw script block",
      `<script>
const sample = "<Agent>literal script</Agent>";
</script>`,
    ],
  ])("ignores audience-looking literals in a %s", (_name, literal) => {
    const source = `${literal}\n\n<Agent>real agent content</Agent>`;

    expect(extractAgentBlocks(source, { sourcePath: "docs/literals.mdx" })).toEqual([
      {
        sourcePath: "docs/literals.mdx",
        line: literal.split("\n").length + 2,
        content: "real agent content",
      },
    ]);
  });

  it.each([
    ["fenced raw element", "```md\n<script>\n```", "```md\n</script>\n```"],
    ["inline raw element", "`<script>`", "`</script>`"],
    ["expression raw element", '{"<script>"}', '{"</script>"}'],
    ["escaped HTML comment", "\\<!--", "\\-->"],
  ])("extracts live context between separated %s delimiters", (_name, opening, closing) => {
    const source = `${opening}\n\n<Agent>real agent content</Agent>\n\n${closing}`;

    expect(extractAgentBlocks(source, { sourcePath: "docs/delimiters.mdx" })).toEqual([
      {
        sourcePath: "docs/delimiters.mdx",
        line: opening.split("\n").length + 2,
        content: "real agent content",
      },
    ]);
  });

  it("ignores audience-looking frontmatter without shifting Unicode offsets", () => {
    const source = `---
description: "😀 <Agent>frontmatter literal</Agent>"
---

<Agent>real agent content</Agent>`;

    expect(extractAgentBlocks(source, { sourcePath: "docs/frontmatter.mdx" })).toEqual([
      {
        sourcePath: "docs/frontmatter.mdx",
        line: 5,
        content: "real agent content",
      },
    ]);

    const blockScalar = `---
description: |
  ---
  <Agent>literal YAML</Agent>
---

<Agent>real block scalar content</Agent>`;
    expect(extractAgentBlocks(blockScalar, { sourcePath: "docs/frontmatter.mdx" })).toEqual([
      {
        sourcePath: "docs/frontmatter.mdx",
        line: 7,
        content: "real block scalar content",
      },
    ]);
  });

  it("extracts agent context nested in a generic component expression", () => {
    const source =
      "<Card title={<Agent>Use `src/agent.ts`.</Agent>} subtitle={<Human>Visual hint.</Human>} />";

    expect(extractAgentBlocks(source, { sourcePath: "docs/card.mdx" })).toEqual([
      {
        sourcePath: "docs/card.mdx",
        line: 1,
        content: "Use `src/agent.ts`.",
      },
    ]);

    const spreadSource =
      "<Card {...{ title: <Agent>Use `src/spread.ts`.</Agent>, subtitle: <Human>Hint.</Human> }} />";
    expect(extractAgentBlocks(spreadSource, { sourcePath: "docs/card.mdx" })).toEqual([
      {
        sourcePath: "docs/card.mdx",
        line: 1,
        content: "Use `src/spread.ts`.",
      },
    ]);
  });

  it("extracts live Svelte MDX context without counting code or link-title literals", () => {
    const source = `{#if enabled}
{() => /<Agent>literal<\\/Agent>/.test(value)}
- ~~~mdx
  <Agent>literal fenced content</Agent>
  ~~~
[link](https://example.com "<Agent>literal title</Agent>")
<Agent>live Svelte content</Agent>
{/if}`;

    expect(extractAgentBlocks(source, { sourcePath: "docs/page.svx" })).toEqual([
      {
        sourcePath: "docs/page.svx",
        line: 7,
        content: "live Svelte content",
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

  it("scores Audience agent blocks but not human-only audience content", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page(
            "audiences",
            `<Human>Run the human walkthrough.</Human>
<Audience only="human">Use the interactive form.</Audience>
<Audience only="agent">Run \`pnpm exec docs doctor\` after editing \`docs.config.ts\`.</Audience>`,
          ),
          actionable: false,
        },
      ],
    });

    expect(report.metrics.agentBlocks).toMatchObject({ total: 1, useful: 1 });
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

  it("excludes human-only content from agent task completeness", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page(
            "human-only-guidance",
            `# Deploy

<Human>
## Prerequisites

Install Node.js before starting.

## Expected result

You should see a successful deployment.

## Recovery

If deployment fails, roll back.
</Human>

<Agent>Deploy the docs.</Agent>`,
          ),
          actionable: true,
        },
      ],
    });
    const taskCodes = report.findings
      .filter((finding) => finding.category === "task")
      .map((finding) => finding.code);

    expect(taskCodes).toEqual(
      expect.arrayContaining([
        "task-missing-prerequisites",
        "task-missing-expected-result",
        "task-missing-recovery",
      ]),
    );
    expect(report.metrics.taskCompleteness).toMatchObject({
      completePages: 0,
      missingPrerequisites: 1,
      missingExpectedResults: 1,
      missingRecovery: 1,
      coverage: 0,
    });
  });

  it("ignores human-only fenced commands for agent actionability and command health", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        page(
          "human-only-command",
          [
            "# Human walkthrough",
            "",
            "<Human>",
            "~~~bash",
            "pnpm run missing-human-script",
            "~~~",
            "</Human>",
          ].join("\n"),
        ),
      ],
    });

    expect(report.metrics.actionablePages).toBe(0);
    expect(report.metrics.commands).toEqual({
      total: 0,
      healthy: 0,
      unhealthy: 0,
      unverified: 0,
    });
    expect(report.findings.filter((finding) => finding.category === "command")).toEqual([]);
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

  it("resolves named and path selectors from an enclosing package-manager workspace", () => {
    const workspaceRoot = path.join(rootDir, "monorepo");
    const docsRoot = path.join(workspaceRoot, "website");
    const packageRoot = path.join(workspaceRoot, "packages", "app");
    mkdirSync(docsRoot, { recursive: true });
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(path.join(workspaceRoot, ".git"), "gitdir: fixture\n", "utf-8");
    writeFileSync(
      path.join(workspaceRoot, "pnpm-workspace.yaml"),
      "packages:\n  - website\n  - packages/*\n",
      "utf-8",
    );
    writeFileSync(
      path.join(docsRoot, "package.json"),
      JSON.stringify({ name: "website", scripts: { dev: "next dev" } }),
      "utf-8",
    );
    writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ name: "@acme/app", scripts: { check: "tsc --noEmit" } }),
      "utf-8",
    );

    const report = analyzeAgentUsefulness({
      rootDir: docsRoot,
      pages: [
        {
          ...page(
            "nested-workspace",
            `# Workspace commands

\`\`\`bash
pnpm --filter @acme/app check
pnpm --filter ./packages/app check
pnpm --filter @acme/app test
\`\`\``,
          ),
          actionable: false,
        },
      ],
    });

    expect(
      report.findings
        .filter((finding) => finding.code === "command-script-missing")
        .map((finding) => finding.command),
    ).toEqual(["pnpm --filter @acme/app test"]);
    expect(report.findings.map((finding) => finding.code)).not.toContain("command-unverified");
    expect(report.metrics.commands).toEqual({
      total: 3,
      healthy: 2,
      unhealthy: 1,
      unverified: 0,
    });
  });

  it("does not resolve selectors from a workspace outside the nearest Git boundary", () => {
    const outerRoot = path.join(rootDir, "outer");
    const repositoryRoot = path.join(outerRoot, "repository");
    const docsRoot = path.join(repositoryRoot, "website");
    const unrelatedPackageRoot = path.join(outerRoot, "packages", "outside");
    mkdirSync(docsRoot, { recursive: true });
    mkdirSync(unrelatedPackageRoot, { recursive: true });
    writeFileSync(
      path.join(outerRoot, "pnpm-workspace.yaml"),
      "packages:\n  - repository/website\n  - packages/*\n",
      "utf-8",
    );
    writeFileSync(path.join(repositoryRoot, ".git"), "gitdir: fixture\n", "utf-8");
    writeFileSync(
      path.join(docsRoot, "package.json"),
      JSON.stringify({ name: "website", scripts: { dev: "next dev" } }),
      "utf-8",
    );
    writeFileSync(
      path.join(unrelatedPackageRoot, "package.json"),
      JSON.stringify({ name: "@outside/app", scripts: { check: "tsc --noEmit" } }),
      "utf-8",
    );

    const report = analyzeAgentUsefulness({
      rootDir: docsRoot,
      pages: [
        {
          ...page(
            "bounded-workspace",
            `# Workspace boundary

\`\`\`bash
pnpm --filter @outside/app check
\`\`\``,
          ),
          actionable: false,
        },
      ],
    });

    expect(report.findings.map((finding) => finding.code)).toContain("command-unverified");
    expect(report.metrics.commands).toEqual({
      total: 1,
      healthy: 0,
      unhealthy: 0,
      unverified: 1,
    });
  });

  it("recognizes constrained probes and agent setup commands without executing them", () => {
    const report = analyzeAgentUsefulness({
      rootDir,
      pages: [
        {
          ...page(
            "static-command-confidence",
            `# Static command confidence

\`\`\`bash
curl -fsSL "https://docs.example.com/docs.md" -H "Accept: text/markdown"
curl -X POST "https://docs.example.com/api/feedback" -H "content-type: application/json" -d '{"outcome":"implemented"}'
curl "https://docs.example.com/search?q=agent&format=markdown"
cd generated-app
export DOCS_API_KEY=example
test "docs" = "docs"
echo "shell ok"
echo "operators such as && and > stay literal when quoted"
npx skills add farming-labs/docs
claude mcp add-json farming-labs-docs '{"type":"http","url":"https://docs.example.com/mcp"}'
pnpm exec docs mcp setup --deployment <id>
curl --imaginary "https://docs.example.com"
npx skills add not-a-repository
npx mystery-tool run build
claude mcp add-json farming-labs-docs '{"type":"http","url":"not-a-url"}'
echo "first" && mystery-tool
echo first > output.txt
\`\`\``,
          ),
          actionable: false,
        },
      ],
    });
    const unverified = report.findings
      .filter((finding) => finding.code === "command-unverified")
      .map((finding) => finding.command);

    expect(unverified).toEqual(
      expect.arrayContaining([
        'claude mcp add-json farming-labs-docs \'{"type":"http","url":"not-a-url"}\'',
        'echo "first" && mystery-tool',
        "echo first > output.txt",
        'curl --imaginary "https://docs.example.com"',
        "npx skills add not-a-repository",
        "npx mystery-tool run build",
      ]),
    );
    expect(unverified).toHaveLength(6);
    expect(report.metrics.commands).toEqual({
      total: 17,
      healthy: 11,
      unhealthy: 0,
      unverified: 6,
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

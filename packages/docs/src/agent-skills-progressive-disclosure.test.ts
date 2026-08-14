import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeConfiguredAgentSkillsProgressiveDisclosure,
  estimateAgentSkillInstructionTokens,
  resolveDocsAgentSkillsProgressiveDisclosureConfig,
} from "./agent-skills-progressive-disclosure.js";

const temporaryRoots: string[] = [];

function createWorkspace(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "docs-skill-disclosure-"));
  temporaryRoots.push(root);
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
  return root;
}

function writeSkill(
  root: string,
  name: string,
  options: { compatibility?: string; body?: string } = {},
): string {
  const directory = path.join(root, "skills", name);
  mkdirSync(directory, { recursive: true });
  const compatibility = options.compatibility ? `compatibility: ${options.compatibility}\n` : "";
  writeFileSync(
    path.join(directory, "SKILL.md"),
    `---
name: ${name}
description: Use ${name} safely.
${compatibility}---

${options.body ?? "# Workflow\n\nFollow the documented steps.\n"}`,
    "utf8",
  );
  return directory;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Agent Skill progressive disclosure", () => {
  it("accepts one-hop references and documented, verifiable scripts", () => {
    const root = createWorkspace();
    const directory = writeSkill(root, "healthy", {
      compatibility: "Requires Node.js 20 or newer.",
      body: `# Workflow

Read [the focused guide](references/guide.md), then run \`scripts/check.mjs\`.

Dependencies: Node.js only; the script has no external dependencies.

Validation: run \`node scripts/check.mjs --check\` and expect "ok".
`,
    });
    mkdirSync(path.join(directory, "references"));
    mkdirSync(path.join(directory, "scripts"));
    writeFileSync(path.join(directory, "references", "guide.md"), "# Guide\n", "utf8");
    writeFileSync(path.join(directory, "scripts", "check.mjs"), 'console.log("ok");\n', "utf8");

    const report = analyzeConfiguredAgentSkillsProgressiveDisclosure("skills", {
      rootDir: root,
    });

    expect(report.issues).toEqual([]);
    expect(report.skills).toMatchObject([
      {
        name: "healthy",
        referenceCount: 2,
        scriptCount: 1,
      },
    ]);
  });

  it("reports configured line and instruction-token budgets plus missing compatibility", () => {
    const root = createWorkspace();
    writeSkill(root, "oversized", {
      body: `# Workflow

Run pnpm install.

${Array.from({ length: 12 }, (_, index) => `Instruction ${index}: configure the project.`).join("\n")}
`,
    });

    const report = analyzeConfiguredAgentSkillsProgressiveDisclosure(
      {
        paths: "skills",
        progressiveDisclosure: {
          maxSkillLines: 10,
          instructionTokenBudget: 20,
        },
      },
      { rootDir: root },
    );

    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "skill-lines-exceeded",
        "skill-token-budget-exceeded",
        "skill-compatibility-missing",
      ]),
    );
    expect(report.config).toMatchObject({
      maxSkillLines: 10,
      instructionTokenBudget: 20,
      maxReferenceDepth: 1,
    });
  });

  it("reports broken, unpublished, escaping, and deep reference chains", () => {
    const root = createWorkspace();
    const directory = writeSkill(root, "linked-guides", {
      body: `# Workflow

- [Missing](references/missing.md)
- [Unpublished](notes.md)
- [Escaping](../README.md)
- [Guide](references/guide.md)
`,
    });
    mkdirSync(path.join(directory, "references"));
    writeFileSync(
      path.join(directory, "references", "guide.md"),
      "Continue with [details](details.md).\n",
      "utf8",
    );
    writeFileSync(path.join(directory, "references", "details.md"), "# Details\n", "utf8");
    writeFileSync(path.join(directory, "notes.md"), "# Notes\n", "utf8");

    const report = analyzeConfiguredAgentSkillsProgressiveDisclosure("skills", {
      rootDir: root,
    });

    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "skill-reference-broken",
        "skill-reference-unpublished",
        "skill-reference-outside-root",
        "skill-reference-depth-exceeded",
      ]),
    );
    expect(
      report.issues.find((issue) => issue.code === "skill-reference-depth-exceeded"),
    ).toMatchObject({
      line: 1,
      message: expect.stringContaining("depth 2"),
    });
  });

  it("reports scripts without discovery, dependency, or validation guidance", () => {
    const root = createWorkspace();
    const directory = writeSkill(root, "scripted-workflow");
    mkdirSync(path.join(directory, "scripts"));
    writeFileSync(path.join(directory, "scripts", "convert.py"), "print('done')\n", "utf8");

    const report = analyzeConfiguredAgentSkillsProgressiveDisclosure("skills", {
      rootDir: root,
    });

    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "skill-compatibility-missing",
        "skill-script-undocumented",
        "skill-script-dependencies-undocumented",
        "skill-script-validation-undocumented",
      ]),
    );
  });

  it("uses stable defaults and excludes frontmatter from token estimates", () => {
    expect(resolveDocsAgentSkillsProgressiveDisclosureConfig("skills")).toEqual({
      maxSkillLines: 500,
      instructionTokenBudget: 5_000,
      maxReferenceDepth: 1,
      compatibility: "when-needed",
      checkScripts: true,
    });
    expect(
      estimateAgentSkillInstructionTokens(`---
name: example
description: ${"x".repeat(1_000)}
---

short
`),
    ).toBeLessThan(10);
  });
});

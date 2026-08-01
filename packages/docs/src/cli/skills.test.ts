import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeConfiguredAgentSkillsProgressiveDisclosure } from "../agent-skills-progressive-disclosure.js";
import { validateDocsAgentSkillFrontmatter } from "../agent-skills-spec.js";
import {
  parseSkillScaffoldArgs,
  scaffoldSkillFromContracts,
  SKILL_SCAFFOLD_MARKER,
} from "./skills.js";

describe("skills scaffold cli", () => {
  const originalCwd = process.cwd();
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-skill-scaffold-"));
    process.chdir(rootDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    rmSync(rootDir, { recursive: true, force: true });
  });

  function writeConfig(extra = ""): void {
    writeFileSync(
      path.join(rootDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  nav: { title: "Acme Docs" },
  metadata: { description: "Build and operate Acme applications." },
  sitemap: { baseUrl: "https://docs.example.com" },
  ${extra}
};
`,
      "utf8",
    );
  }

  function writeContractPage(
    route: string,
    options: { task?: string; title?: string; prose?: string } = {},
  ): string {
    const directory = path.join(rootDir, "docs", route);
    mkdirSync(directory, { recursive: true });
    const filePath = path.join(directory, "page.mdx");
    writeFileSync(
      filePath,
      `---
title: "${options.title ?? "Install Acme"}"
description: "Complete the selected Acme workflow."
agent:
  task: ${options.task ?? "Install Acme in an existing project."}
  outcome: The application renders the Acme route.
  appliesTo:
    framework: nextjs
    version: ">=16"
    package: "@acme/docs"
  prerequisites:
    - Start in an existing application.
  files:
    - package.json
  commands:
    - run: pnpm add @acme/docs
      cwd: apps/web
      description: Install the package.
  sideEffects:
    - Updates package.json and the lockfile.
  verification:
    - run: pnpm test
      expect: Tests pass.
  rollback:
    - Restore package.json and the lockfile.
  failureModes:
    - symptom: The route returns 404.
      resolution: Confirm the adapter route exists.
---

# Install Acme

${options.prose ?? "This full page prose must not be copied into a generated task reference."}
`,
      "utf8",
    );
    return filePath;
  }

  it("parses deterministic scaffold controls", () => {
    expect(
      parseSkillScaffoldArgs([
        "acme-docs",
        "--output",
        "skills/acme-docs",
        "--include=/docs/guides",
        "--include",
        "/docs/reference",
        "--config=fixtures/docs=custom.config.ts",
        "--check",
      ]),
    ).toEqual({
      name: "acme-docs",
      output: "skills/acme-docs",
      include: ["/docs/guides", "/docs/reference"],
      configPath: "fixtures/docs=custom.config.ts",
      check: true,
    });

    expect(() => parseSkillScaffoldArgs(["one", "--name", "two"])).toThrow("conflicting values");
    expect(() => parseSkillScaffoldArgs(["--check", "--dry-run"])).toThrow(
      "either --check or --dry-run",
    );
    expect(() => parseSkillScaffoldArgs(["--unknown"])).toThrow("Unknown skill scaffold flag");
  });

  it("builds a compact router and one-hop references from contracts only", async () => {
    writeConfig();
    writeContractPage("installation");
    writeContractPage("guides/quickstart", {
      title: "Create the first page",
      task: "Create an Acme documentation page.",
    });

    const result = await scaffoldSkillFromContracts();
    const skillPath = path.join(rootDir, "skills", "acme-docs", "SKILL.md");
    const skill = readFileSync(skillPath, "utf8");
    const installReference = readFileSync(
      path.join(rootDir, "skills", "acme-docs", "references", "installation.md"),
      "utf8",
    );

    expect(result).toMatchObject({
      name: "acme-docs",
      contractCount: 2,
      status: "generated",
    });
    expect(validateDocsAgentSkillFrontmatter(skill, { directoryName: "acme-docs" }).valid).toBe(
      true,
    );
    expect(skill).toContain(SKILL_SCAFFOLD_MARKER);
    expect(skill).toContain("[Install Acme in an existing project.](references/installation.md)");
    expect(skill).toContain("references/guides-quickstart.md");
    expect(skill.split(/\r?\n/u).length).toBeLessThan(500);
    expect(installReference).toContain("Source: [https://docs.example.com/docs/installation]");
    expect(installReference).toContain("## Expected result");
    expect(installReference).toContain("`pnpm add @acme/docs`");
    expect(installReference).toContain("Recovery: Confirm the adapter route exists.");
    expect(installReference).not.toContain("Complete the selected Acme workflow.");
    expect(installReference).not.toContain("This full page prose must not be copied");

    const disclosure = analyzeConfiguredAgentSkillsProgressiveDisclosure("skills/acme-docs", {
      rootDir,
    });
    expect(disclosure.issues).toEqual([]);
    expect(disclosure.skills[0]).toMatchObject({ referenceCount: 2, scriptCount: 0 });

    await expect(scaffoldSkillFromContracts({ check: true })).resolves.toMatchObject({
      status: "current",
    });
  });

  it("prints skills help from the command group", () => {
    const cliPath = path.resolve(import.meta.dirname, "../../dist/cli/index.mjs");
    for (const flag of ["--help", "-h"]) {
      const output = execFileSync(process.execPath, [cliPath, "skills", flag], {
        encoding: "utf8",
      });
      expect(output).toContain("docs skills scaffold");
      expect(output).not.toContain("Unknown skills subcommand");
    }
  });

  it("quotes YAML-sensitive skill names", async () => {
    writeConfig();
    writeContractPage("installation");

    await scaffoldSkillFromContracts({ name: "true", output: "skills/true" });
    const skill = readFileSync(path.join(rootDir, "skills", "true", "SKILL.md"), "utf8");

    expect(skill).toContain('name: "true"');
    expect(validateDocsAgentSkillFrontmatter(skill, { directoryName: "true" }).valid).toBe(true);
  });

  it("rejects symlinked reference parents in write, check, and dry-run modes", async () => {
    writeConfig();
    writeContractPage("installation");
    const outputDir = path.join(rootDir, "skills", "acme-docs");
    const outsideDir = path.join(rootDir, "outside");
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(outsideDir);
    symlinkSync(outsideDir, path.join(outputDir, "references"), "dir");

    for (const options of [{}, { check: true }, { dryRun: true }]) {
      await expect(scaffoldSkillFromContracts(options)).rejects.toThrow(
        "Refusing to traverse symbolic-link skill output",
      );
    }
    expect(existsSync(path.join(outsideDir, "installation.md"))).toBe(false);
  });

  it("rejects dangling output-file symlinks", async () => {
    writeConfig();
    writeContractPage("installation");
    const outputDir = path.join(rootDir, "skills", "acme-docs");
    const referencesDir = path.join(outputDir, "references");
    const outsideFile = path.join(rootDir, "outside", "installation.md");
    mkdirSync(referencesDir, { recursive: true });
    symlinkSync(outsideFile, path.join(referencesDir, "installation.md"));

    await expect(scaffoldSkillFromContracts()).rejects.toThrow(
      "Refusing to traverse symbolic-link skill output",
    );
    expect(existsSync(outsideFile)).toBe(false);
  });

  it("detects stale contracts and previews without writing", async () => {
    writeConfig();
    writeContractPage("installation");

    await expect(scaffoldSkillFromContracts({ check: true })).rejects.toThrow(
      "Generated Agent Skill is stale",
    );
    const preview = await scaffoldSkillFromContracts({ dryRun: true });
    expect(preview.status).toBe("dry-run");
    expect(existsSync(path.join(rootDir, "skills", "acme-docs", "SKILL.md"))).toBe(false);

    await scaffoldSkillFromContracts();
    writeContractPage("installation", { task: "Upgrade Acme deterministically." });
    await expect(scaffoldSkillFromContracts({ check: true })).rejects.toThrow(
      "Generated Agent Skill is stale",
    );
  });

  it("protects user-owned files and removes only obsolete managed references", async () => {
    writeConfig();
    writeContractPage("installation");
    const secondPage = writeContractPage("guides/quickstart", {
      title: "Create the first page",
      task: "Create an Acme documentation page.",
    });
    const outputDir = path.join(rootDir, "skills", "acme-docs");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, "SKILL.md"), "# User skill\n", "utf8");

    await expect(scaffoldSkillFromContracts()).rejects.toThrow("user-owned skill file");
    await scaffoldSkillFromContracts({ force: true });
    const customReference = path.join(outputDir, "references", "notes.md");
    writeFileSync(customReference, "# Keep me\n", "utf8");

    rmSync(secondPage);
    const result = await scaffoldSkillFromContracts();
    expect(result.removedFiles.map((filePath) => path.basename(filePath))).toEqual([
      "guides-quickstart.md",
    ]);
    expect(existsSync(customReference)).toBe(true);
    expect(readFileSync(customReference, "utf8")).toBe("# Keep me\n");
  });

  it("supports focused route scaffolds and rejects unsafe outputs", async () => {
    writeConfig();
    writeContractPage("installation");
    writeContractPage("guides/quickstart", {
      title: "Create the first page",
      task: "Create an Acme documentation page.",
    });

    const focused = await scaffoldSkillFromContracts({
      name: "acme-guides",
      output: "skills/acme-guides",
      include: ["/docs/guides"],
    });
    expect(focused.contractCount).toBe(1);
    expect(
      existsSync(path.join(rootDir, "skills", "acme-guides", "references", "installation.md")),
    ).toBe(false);
    await expect(
      scaffoldSkillFromContracts({ name: "outside", output: "../outside" }),
    ).rejects.toThrow("inside the current project root");
    await expect(scaffoldSkillFromContracts({ name: "Different Name" })).rejects.toThrow(
      "Invalid Agent Skill name",
    );
  });

  it("honors configured disclosure budgets and protects existing skill collections", async () => {
    writeConfig(`
  agent: {
    skills: {
      paths: "skills",
      progressiveDisclosure: { maxSkillLines: 10, instructionTokenBudget: 5000 },
    },
  },`);
    writeContractPage("installation");

    await expect(scaffoldSkillFromContracts()).rejects.toThrow(
      "exceeding the configured 10-line or 5000-token budget",
    );

    writeConfig();
    const nested = path.join(rootDir, "skills", "collection", "existing");
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      path.join(nested, "SKILL.md"),
      `---\nname: existing\ndescription: Existing skill.\n---\n`,
      "utf8",
    );
    await expect(
      scaffoldSkillFromContracts({ name: "collection", output: "skills/collection" }),
    ).rejects.toThrow("Refusing to turn an Agent Skill collection into one skill");
  });

  it("fails clearly when no structured contracts exist", async () => {
    writeConfig();
    mkdirSync(path.join(rootDir, "docs"), { recursive: true });
    writeFileSync(
      path.join(rootDir, "docs", "page.mdx"),
      `---\ntitle: Overview\n---\n\n# Overview\n`,
      "utf8",
    );

    await expect(scaffoldSkillFromContracts()).rejects.toThrow(
      "No structured page agent contracts were found",
    );
  });
});

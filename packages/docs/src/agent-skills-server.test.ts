import { chmodSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfiguredAgentSkills } from "./agent-skills-server.js";

const temporaryRoots: string[] = [];

function createWorkspace(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "docs-agent-skills-"));
  temporaryRoots.push(root);
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function writeSkill(root: string, name: string, body = "# Skill\r\n"): string {
  const directory = path.join(root, "skills", name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "SKILL.md"),
    `---\r\nname: ${name}\r\ndescription: Use ${name} safely.\r\n---\r\n\r\n${body}`,
    "utf8",
  );
  return directory;
}

function tarPaths(archive: Uint8Array): string[] {
  const tar = gunzipSync(archive);
  const paths: string[] = [];
  for (let offset = 0; offset + 512 <= tar.byteLength; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").split(String.fromCharCode(0), 1)[0];
    const size = Number.parseInt(
      header.subarray(124, 136).toString("ascii").split(String.fromCharCode(0), 1)[0].trim() || "0",
      8,
    );
    paths.push(name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return paths;
}

function tarMode(archive: Uint8Array, expectedPath: string): number | undefined {
  const tar = gunzipSync(archive);
  for (let offset = 0; offset + 512 <= tar.byteLength; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) return undefined;
    const name = header.subarray(0, 100).toString("utf8").split(String.fromCharCode(0), 1)[0];
    const readOctal = (start: number, end: number) =>
      Number.parseInt(
        header.subarray(start, end).toString("ascii").split(String.fromCharCode(0), 1)[0].trim() ||
          "0",
        8,
      );
    if (name === expectedPath) return readOctal(100, 108);
    offset += 512 + Math.ceil(readOctal(124, 136) / 512) * 512;
  }
  return undefined;
}

describe("configured Agent Skills", () => {
  it("discovers every valid skill and preserves exact simple SKILL.md bytes", async () => {
    const root = createWorkspace();
    writeSkill(root, "alpha");
    writeSkill(root, "beta");

    const skills = await resolveConfiguredAgentSkills("skills", { rootDir: root });

    expect(skills.map((skill) => skill.name)).toEqual(["alpha", "beta"]);
    expect(skills.every((skill) => skill.type === "skill-md")).toBe(true);
    expect(skills[0].content).toContain("\r\n");
    expect(skills[0].digest).toBe(`sha256:${skills[0].sha256}`);
  });

  it("creates deterministic archives with safe companion files and binary assets", async () => {
    const root = createWorkspace();
    const directory = writeSkill(root, "with-files");
    mkdirSync(path.join(directory, "references"));
    mkdirSync(path.join(directory, "scripts"));
    mkdirSync(path.join(directory, "assets"));
    writeFileSync(path.join(directory, "references", "guide.md"), "guide\r\n", "utf8");
    writeFileSync(path.join(directory, "references", "invalid.txt"), Buffer.from([0xff, 0xfe]));
    writeFileSync(path.join(directory, "scripts", "check.sh"), "#!/bin/sh\n", "utf8");
    writeFileSync(path.join(directory, "scripts", "run.sh"), "#!/bin/sh\n", "utf8");
    chmodSync(path.join(directory, "scripts", "check.sh"), 0o644);
    chmodSync(path.join(directory, "scripts", "run.sh"), 0o755);
    writeFileSync(path.join(directory, "assets", "pixel.bin"), Buffer.from([0, 255, 1, 254]));

    const [first] = await resolveConfiguredAgentSkills(directory, { rootDir: root });
    const [second] = await resolveConfiguredAgentSkills(directory, { rootDir: root });

    expect(first.type).toBe("archive");
    expect(first.content).toEqual(second.content);
    expect(first.digest).toBe(second.digest);
    expect(tarPaths(first.content as Uint8Array)).toEqual([
      "SKILL.md",
      "assets/pixel.bin",
      "references/guide.md",
      "references/invalid.txt",
      "scripts/check.sh",
      "scripts/run.sh",
    ]);
    expect(first.files.find((file) => file.path === "assets/pixel.bin")?.content).toEqual(
      new Uint8Array([0, 255, 1, 254]),
    );
    expect(first.files.find((file) => file.path === "references/invalid.txt")?.content).toEqual(
      new Uint8Array([0xff, 0xfe]),
    );
    expect(tarMode(first.content as Uint8Array, "scripts/check.sh")).toBe(0o644);
    expect(tarMode(first.content as Uint8Array, "scripts/run.sh")).toBe(0o755);
  });

  it("rejects escaping and collection symlinks", async () => {
    const root = createWorkspace();
    const outside = createWorkspace();
    writeSkill(outside, "outside");
    mkdirSync(path.join(root, "skills"));
    symlinkSync(path.join(outside, "skills", "outside"), path.join(root, "skills", "linked"));

    await expect(resolveConfiguredAgentSkills("skills", { rootDir: root })).rejects.toThrow(
      "may not contain symlinks",
    );
    await expect(
      resolveConfiguredAgentSkills(path.join(outside, "skills"), { rootDir: root }),
    ).rejects.toThrow("escapes the workspace");
  });

  it("requires the frontmatter name to match the skill directory", async () => {
    const root = createWorkspace();
    const directory = writeSkill(root, "directory-name");
    writeFileSync(
      path.join(directory, "SKILL.md"),
      "---\nname: other-name\ndescription: Wrong directory name.\n---\n",
    );

    await expect(resolveConfiguredAgentSkills(directory, { rootDir: root })).rejects.toThrow(
      "must match its directory",
    );
  });

  it("accepts spec-valid folded YAML descriptions and inline comments", async () => {
    const root = createWorkspace();
    const directory = writeSkill(root, "yaml-skill");
    writeFileSync(
      path.join(directory, "SKILL.md"),
      `---
name: "yaml-skill" # exact directory name
description: >
  Use the folded workflow
  without losing YAML semantics.
---

# YAML skill
`,
    );

    const [skill] = await resolveConfiguredAgentSkills(directory, { rootDir: root });
    expect(skill.description).toBe("Use the folded workflow without losing YAML semantics.");
  });
});

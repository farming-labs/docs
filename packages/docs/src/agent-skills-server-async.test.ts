import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const fail = () => {
    throw new Error("promise-based resolver used a synchronous filesystem API");
  };
  return {
    ...actual,
    existsSync: fail,
    lstatSync: fail,
    readFileSync: fail,
    readdirSync: fail,
    realpathSync: fail,
    statSync: fail,
  };
});

vi.mock("node:zlib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:zlib")>();
  return {
    ...actual,
    gzipSync: () => {
      throw new Error("promise-based resolver used synchronous compression");
    },
  };
});

import { resolveConfiguredAgentSkills } from "./agent-skills-server.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("asynchronous configured Agent Skill resolution", () => {
  it("uses asynchronous filesystem and compression APIs for runtime publishing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "docs-agent-skills-async-"));
    temporaryRoots.push(root);
    const skillDir = path.join(root, "skills", "runtime-safe");
    await mkdir(path.join(skillDir, "references"), { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: runtime-safe\ndescription: Publish without blocking runtime I/O.\n---\n",
      "utf8",
    );
    await writeFile(path.join(skillDir, "references", "guide.md"), "# Guide\n", "utf8");

    const [skill] = await resolveConfiguredAgentSkills("skills", {
      rootDir: root,
      workspaceRoot: root,
    });

    expect(skill.type).toBe("archive");
    expect(skill.files.map((file) => file.path)).toEqual(["SKILL.md", "references/guide.md"]);
  });
});

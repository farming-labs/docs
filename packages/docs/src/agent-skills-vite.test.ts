import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfiguredAgentSkills } from "./agent-skills-server.js";
import { DOCS_AGENT_SKILLS_BUNDLE_MODULE, docsAgentSkills } from "./agent-skills-vite.js";

const temporaryRoots: string[] = [];

function createWorkspace(): { app: string; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-agent-skills-build-"));
  temporaryRoots.push(root);
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  const app = path.join(root, "apps", "docs-site");
  fs.mkdirSync(app, { recursive: true });
  return { app, root };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("docsAgentSkills", () => {
  it("snapshots arbitrary workspace paths and preserves archive and asset bytes", async () => {
    const { app, root } = createWorkspace();
    const skillDir = path.join(root, "shared", "skills", "binary-demo");
    fs.mkdirSync(path.join(skillDir, "assets"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: binary-demo\ndescription: Exercises binary deployment snapshots.\n---\n\n# Binary demo\n",
    );
    const binary = Uint8Array.from([0, 255, 1, 128, 10, 13, 42]);
    fs.writeFileSync(path.join(skillDir, "assets", "fixture.bin"), binary);

    const config = { agent: { skills: "../../shared/skills" } };
    const plugin = docsAgentSkills(config, { rootDir: app, workspaceRoot: root });
    const resolvedId = plugin.resolveId(DOCS_AGENT_SKILLS_BUNDLE_MODULE);
    expect(resolvedId).toBeTruthy();

    const source = await plugin.load(resolvedId!);
    expect(source).toBeTruthy();
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(source!).toString("base64")}`;
    const bundled = (await import(moduleUrl)) as {
      bundledAgentSkills: Array<{
        content: Uint8Array;
        digest: string;
        files: Array<{ content: string | Uint8Array; path: string }>;
      }>;
    };

    const [filesystemSkill] = await resolveConfiguredAgentSkills(config.agent.skills, {
      rootDir: app,
      workspaceRoot: root,
    });
    const [bundledSkill] = bundled.bundledAgentSkills;
    expect(bundledSkill.digest).toBe(filesystemSkill.digest);
    expect([...bundledSkill.content]).toEqual([...(filesystemSkill.content as Uint8Array)]);

    const bundledAsset = bundledSkill.files.find((file) => file.path === "assets/fixture.bin");
    expect(bundledAsset?.content).toBeInstanceOf(Uint8Array);
    expect([...(bundledAsset!.content as Uint8Array)]).toEqual([...binary]);
  });

  it("publishes an empty snapshot when no skills are configured", async () => {
    const { app, root } = createWorkspace();
    const plugin = docsAgentSkills({}, { rootDir: app, workspaceRoot: root });
    const resolvedId = plugin.resolveId(DOCS_AGENT_SKILLS_BUNDLE_MODULE)!;
    const source = await plugin.load(resolvedId);
    expect(source).toContain("const snapshot = [];");
  });
});

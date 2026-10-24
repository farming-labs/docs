import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedConfig } from "vite";
import { docsAgentSkillsBundle } from "./agent-skills.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createProject(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "farmjs-agent-skills-"));
  roots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  return root;
}

/** Run the plugin the way a production Vite build does and evaluate the module it returns. */
async function buildBundle(root: string) {
  const plugin = docsAgentSkillsBundle() as any;
  plugin.configResolved({ root } as ResolvedConfig);
  const id = plugin.resolveId("@farming-labs/docs/agent-skills-bundle");
  const code: string = await plugin.load(id);
  const modulePath = path.join(root, "agent-skills-bundle.mjs");
  writeFileSync(modulePath, code);
  return import(pathToFileURL(modulePath).href);
}

describe("docsAgentSkillsBundle", () => {
  it("snapshots configured skills and root agent documents for production builds", async () => {
    const root = createProject({
      "docs.config.ts": `export default { entry: "docs", agent: { skills: "./skills" } };\n`,
      "skills/demo/SKILL.md": `---
name: demo
description: Demo skill used by the snapshot test.
---

# Demo skill
`,
      "skill.md": `---
name: site
description: Use this site through its docs.
---

# Site skill
`,
      "AGENTS.md": "# Site agents\n",
      "package.json": JSON.stringify({ name: "site", version: "3.1.4" }),
    });

    const bundle = await buildBundle(root);

    expect(bundle.bundledAgentSkills.map((skill: { name: string }) => skill.name)).toEqual([
      "demo",
    ]);
    expect(bundle.bundledRootDocuments).toEqual({
      "skill.md": expect.stringContaining("# Site skill"),
      "AGENTS.md": "# Site agents\n",
    });
    expect(bundle.bundledAppVersion).toBe("3.1.4");
  });

  it("leaves the filesystem fallback in place when the docs config cannot be loaded", async () => {
    const root = createProject({ "skill.md": "# Site skill\n" });

    const bundle = await buildBundle(root);

    expect(bundle.bundledAgentSkills).toBeUndefined();
    expect(bundle.bundledRootDocuments).toBeUndefined();
    expect(bundle.bundledAppVersion).toBeUndefined();
  });

  it("still snapshots the app version when the docs config cannot be loaded", async () => {
    const root = createProject({ "package.json": JSON.stringify({ version: "0.9.0" }) });

    const bundle = await buildBundle(root);

    expect(bundle.bundledAgentSkills).toBeUndefined();
    expect(bundle.bundledAppVersion).toBe("0.9.0");
  });

  it("only runs in production builds", () => {
    expect(docsAgentSkillsBundle().apply).toBe("build");
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readDocsAppVersion } from "./app-version.js";
import { renderDocsAgentSkillsBundle } from "./agent-skills-vite.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createRoot(packageJson?: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "docs-app-version-"));
  roots.push(root);
  if (packageJson !== undefined) writeFileSync(path.join(root, "package.json"), packageJson);
  return root;
}

describe("readDocsAppVersion", () => {
  it("reads the app's package.json version", () => {
    expect(readDocsAppVersion(createRoot(JSON.stringify({ version: " 1.4.2 " })))).toBe("1.4.2");
  });

  it("returns undefined instead of throwing when the version cannot be read", () => {
    expect(readDocsAppVersion(createRoot())).toBeUndefined();
    expect(readDocsAppVersion(createRoot("{ not json"))).toBeUndefined();
    expect(readDocsAppVersion(createRoot("null"))).toBeUndefined();
    expect(readDocsAppVersion(createRoot(JSON.stringify({ name: "app" })))).toBeUndefined();
    expect(readDocsAppVersion(createRoot(JSON.stringify({ version: 1 })))).toBeUndefined();
    expect(readDocsAppVersion(createRoot(JSON.stringify({ version: "  " })))).toBeUndefined();
  });
});

describe("renderDocsAgentSkillsBundle app version", () => {
  it("exports the snapshotted version, or undefined without one", () => {
    expect(renderDocsAgentSkillsBundle([], undefined, "2.0.0")).toContain(
      'export const bundledAppVersion = "2.0.0";',
    );
    expect(renderDocsAgentSkillsBundle([])).toContain(
      "export const bundledAppVersion = undefined;",
    );
  });
});

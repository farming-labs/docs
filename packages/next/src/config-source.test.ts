import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withDocs } from "./config.js";

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});

describe("configuration source snapshot", () => {
  let root: string;
  let previousCwd: string;
  beforeEach(() => {
    previousCwd = process.cwd();
    root = mkdtempSync(join(tmpdir(), "docs-config-source-"));
    process.chdir(root);
    vi.mocked(readFileSync).mockClear();
  });
  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(root, { recursive: true, force: true });
  });
  const configReads = () =>
    vi.mocked(readFileSync).mock.calls.filter(([path]) => String(path).includes("docs.config."));

  it("reads the source once across routing, themes, review and changelog setup", () => {
    writeFileSync(
      "docs.config.ts",
      `export default {
      entry: "docs", contentDir: "content", changelog: { enabled: true },
      theme: {}, og: { endpoint: "/api/og" }
    }`,
    );
    withDocs();
    expect(configReads()).toHaveLength(1);
  });

  it("observes edits on the next invocation", () => {
    writeFileSync("docs.config.ts", 'export default { entry: "docs" };');
    withDocs();
    writeFileSync("docs.config.ts", 'export default { entry: "guides" };');
    withDocs();
    expect(readFileSync(join(root, "app/guides/layout.tsx"), "utf8")).toContain(
      "createNextDocsLayout",
    );
    expect(configReads()).toHaveLength(2);
  });

  it("observes deletion and a replacement config extension", () => {
    writeFileSync("docs.config.ts", 'export default { entry: "docs" };');
    withDocs();
    rmSync("docs.config.ts");
    writeFileSync("docs.config.tsx", 'export default { entry: "reference" };');
    withDocs();
    expect(readFileSync(join(root, "app/reference/layout.tsx"), "utf8")).toContain(
      "createNextDocsLayout",
    );
    expect(configReads()).toHaveLength(2);
  });
});

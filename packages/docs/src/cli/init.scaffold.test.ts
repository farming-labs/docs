import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scaffoldNextJs } from "./init.js";
import type { TemplateConfig } from "./templates.js";

describe("scaffoldNextJs (app dir consistency)", () => {
  let tmpDir: string;
  let written: string[];
  let skipped: string[];

  function makeWrite(cwd: string) {
    return (rel: string, _content: string, overwrite = false) => {
      const abs = path.join(cwd, rel);
      if (!fs.existsSync(abs) || overwrite) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, "", "utf-8");
        written.push(rel);
      } else {
        skipped.push(rel);
      }
    };
  }

  const baseCfg: TemplateConfig = {
    entry: "docs",
    theme: "pixel-border",
    projectName: "my-docs",
    framework: "nextjs",
    useAlias: false,
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-scaffold-test-"));
    written = [];
    skipped = [];
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("writes all docs and layout under src/app when nextAppDir is src/app", () => {
    scaffoldNextJs(
      tmpDir,
      { ...baseCfg, nextAppDir: "src/app" },
      "src/app/globals.css",
      makeWrite(tmpDir),
      skipped,
      written,
    );

    expect(written).toContain("src/app/docs/layout.tsx");
    expect(written).toContain("src/app/docs/page.mdx");
    expect(written).toContain("src/app/docs/installation/page.mdx");
    expect(written).toContain("src/app/docs/quickstart/page.mdx");
    expect(written).toContain("src/app/layout.tsx");
    expect(written).toContain("src/app/globals.css");

    const appOnlyPaths = written.filter(
      (p) => p.includes("app/") && !p.startsWith("src/app/"),
    );
    expect(appOnlyPaths).toHaveLength(0);
  });

  it("writes all docs and layout under app when nextAppDir is app", () => {
    scaffoldNextJs(
      tmpDir,
      { ...baseCfg, nextAppDir: "app" },
      "app/globals.css",
      makeWrite(tmpDir),
      skipped,
      written,
    );

    expect(written).toContain("app/docs/layout.tsx");
    expect(written).toContain("app/docs/page.mdx");
    expect(written).toContain("app/docs/installation/page.mdx");
    expect(written).toContain("app/docs/quickstart/page.mdx");
    expect(written).toContain("app/layout.tsx");
    expect(written).toContain("app/globals.css");

    const srcAppPaths = written.filter((p) => p.startsWith("src/app/"));
    expect(srcAppPaths).toHaveLength(0);
  });

  it("defaults to app when nextAppDir is undefined", () => {
    scaffoldNextJs(
      tmpDir,
      { ...baseCfg, nextAppDir: undefined },
      "app/globals.css",
      makeWrite(tmpDir),
      skipped,
      written,
    );

    expect(written).toContain("app/docs/layout.tsx");
    expect(written).toContain("app/docs/page.mdx");
    const srcAppPaths = written.filter((p) => p.startsWith("src/app/"));
    expect(srcAppPaths).toHaveLength(0);
  });
});

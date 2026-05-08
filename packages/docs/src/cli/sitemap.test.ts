import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateSitemap, parseSitemapGenerateArgs } from "./sitemap.js";

describe("sitemap cli", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-sitemap-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses generate flags", () => {
    expect(parseSitemapGenerateArgs(["--config", "src/lib/docs.config.ts", "--public"])).toEqual({
      configPath: "src/lib/docs.config.ts",
      public: true,
    });
  });

  it("writes a manifest and public files by default", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  contentDir: "docs",
  sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
  nav: { title: "Example Docs" },
};
`,
      "utf-8",
    );
    mkdirSync(path.join(tmpDir, "docs", "configuration"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "docs", "configuration", "page.mdx"),
      `---
title: "Configuration"
description: "Configure docs"
---

# Configuration
`,
      "utf-8",
    );

    process.chdir(tmpDir);
    await generateSitemap();

    const manifestPath = path.join(tmpDir, ".farming-labs", "sitemap-manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.pages[0]).toMatchObject({
      url: "/docs/configuration",
      markdownUrl: "/docs/configuration.md",
      title: "Configuration",
      lastmodSource: "filesystem",
    });

    expect(readFileSync(path.join(tmpDir, "public", "sitemap.xml"), "utf-8")).toContain(
      "<lastmod>",
    );
    expect(readFileSync(path.join(tmpDir, "public", "sitemap.md"), "utf-8")).toContain(
      "Markdown: /docs/configuration.md",
    );
    expect(
      readFileSync(path.join(tmpDir, "public", ".well-known", "sitemap.md"), "utf-8"),
    ).toContain("# Example Docs Sitemap");
  });

  it("preserves generatedAt when check output is unchanged", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  contentDir: "docs",
  sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
  nav: { title: "Example Docs" },
};
`,
      "utf-8",
    );
    mkdirSync(path.join(tmpDir, "docs", "configuration"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "docs", "configuration", "page.mdx"),
      `---
title: "Configuration"
description: "Configure docs"
---

# Configuration
`,
      "utf-8",
    );

    process.chdir(tmpDir);
    await generateSitemap();

    const manifestPath = path.join(tmpDir, ".farming-labs", "sitemap-manifest.json");
    const originalManifest = readFileSync(manifestPath, "utf-8");

    await expect(generateSitemap({ check: true })).resolves.toBeUndefined();
    expect(readFileSync(manifestPath, "utf-8")).toBe(originalManifest);
  });

  it("can write only the internal manifest", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  contentDir: "docs",
  sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
};
`,
      "utf-8",
    );
    mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "docs", "page.md"),
      `---
title: "Home"
---

# Home
`,
      "utf-8",
    );

    process.chdir(tmpDir);
    await generateSitemap({ manifestOnly: true });

    expect(existsSync(path.join(tmpDir, ".farming-labs", "sitemap-manifest.json"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "sitemap.xml"))).toBe(false);
    expect(existsSync(path.join(tmpDir, "public", "sitemap.md"))).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scaffoldNextJs, scaffoldSvelteKit, scaffoldAstro, scaffoldNuxt } from "./init.js";
import type { TemplateConfig } from "./templates.js";

describe("scaffoldNextJs (app dir consistency)", () => {
  let tmpDir: string;
  let written: string[];
  let skipped: string[];

  function makeWrite(cwd: string) {
    return (rel: string, content: string, overwrite = false) => {
      const abs = path.join(cwd, rel);
      if (!fs.existsSync(abs) || overwrite) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, "utf-8");
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

    const appOnlyPaths = written.filter((p) => p.includes("app/") && !p.startsWith("src/app/"));
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

  it("scaffolds localized Next.js starter pages and helper when i18n is enabled", () => {
    scaffoldNextJs(
      tmpDir,
      {
        ...baseCfg,
        nextAppDir: "src/app",
        i18n: {
          locales: ["en", "fr"],
          defaultLocale: "en",
        },
      },
      "src/app/globals.css",
      makeWrite(tmpDir),
      skipped,
      written,
    );

    expect(written).toContain("src/app/components/locale-doc-page.tsx");
    expect(written).toContain("src/app/docs/page.tsx");
    expect(written).toContain("src/app/docs/installation/page.tsx");
    expect(written).toContain("src/app/docs/quickstart/page.tsx");
    expect(written).toContain("src/app/docs/en/page.mdx");
    expect(written).toContain("src/app/docs/fr/page.mdx");

    expect(fs.existsSync(path.join(tmpDir, "src/app/docs/page.mdx"))).toBe(false);

    const config = fs.readFileSync(path.join(tmpDir, "docs.config.ts"), "utf-8");
    expect(config).toContain("i18n:");
    expect(config).toContain('locales: ["en", "fr"]');
  });
});

describe("i18n scaffold for non-Next frameworks", () => {
  let tmpDir: string;
  let written: string[];
  let skipped: string[];

  function makeWrite(cwd: string) {
    return (rel: string, content: string, overwrite = false) => {
      const abs = path.join(cwd, rel);
      if (!fs.existsSync(abs) || overwrite) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, "utf-8");
        written.push(rel);
      } else {
        skipped.push(rel);
      }
    };
  }

  const baseI18nCfg: TemplateConfig = {
    entry: "docs",
    theme: "fumadocs",
    projectName: "my-docs",
    framework: "sveltekit",
    useAlias: false,
    i18n: {
      locales: ["en", "fr"],
      defaultLocale: "en",
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-i18n-scaffold-test-"));
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

  it("writes locale folders for SvelteKit and adds a docs root page", () => {
    scaffoldSvelteKit(
      tmpDir,
      { ...baseI18nCfg, framework: "sveltekit" },
      "src/app.css",
      makeWrite(tmpDir),
      skipped,
      written,
    );

    expect(written).toContain("src/routes/docs/+page.svelte");
    expect(written).toContain("docs/en/page.md");
    expect(written).toContain("docs/fr/quickstart/page.md");
  });

  it("writes locale folders for Astro", () => {
    scaffoldAstro(
      tmpDir,
      { ...baseI18nCfg, framework: "astro", astroAdapter: "vercel" },
      "src/styles/global.css",
      makeWrite(tmpDir),
      skipped,
      written,
    );

    expect(written).toContain("docs/en/page.md");
    expect(written).toContain("docs/fr/installation/page.md");
    const config = fs.readFileSync(path.join(tmpDir, "src/lib/docs.config.ts"), "utf-8");
    expect(config).toContain("i18n:");
  });

  it("writes locale folders for Nuxt", () => {
    scaffoldNuxt(
      tmpDir,
      { ...baseI18nCfg, framework: "nuxt", useAlias: true },
      "assets/css/main.css",
      makeWrite(tmpDir),
      skipped,
      written,
    );

    expect(written).toContain("docs/en/page.md");
    expect(written).toContain("docs/fr/installation/page.md");
    const config = fs.readFileSync(path.join(tmpDir, "docs.config.ts"), "utf-8");
    expect(config).toContain("i18n:");
  });
});

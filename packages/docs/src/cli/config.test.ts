import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractNestedObjectLiteral,
  loadDocsConfigModuleResult,
  readBooleanProperty,
  readTopLevelBooleanProperty,
  readEnvReferenceProperty,
  readNavTitle,
  readStringProperty,
  readTopLevelStringProperty,
  resolveDocsContentDir,
} from "./config.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveDocsContentDir", () => {
  it("prefers app/<entry> when contentDir is not configured", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-search-sync-"));
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });

    expect(
      resolveDocsContentDir(rootDir, 'export default defineDocs({ entry: "docs" })', "docs"),
    ).toBe("app/docs");
  });

  it("uses the configured contentDir when present", () => {
    expect(
      resolveDocsContentDir(
        "/tmp/project",
        'export default defineDocs({ entry: "docs", contentDir: "content/docs" })',
        "docs",
      ),
    ).toBe("content/docs");
  });

  it("ignores nested contentDir values when top-level contentDir is absent", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-search-sync-"));
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });

    expect(
      resolveDocsContentDir(
        rootDir,
        `
          export default defineDocs({
            entry: "docs",
            changelog: {
              enabled: true,
              contentDir: "changelog",
            },
          });
        `,
        "docs",
      ),
    ).toBe("app/docs");
  });
});

describe("property readers", () => {
  it("matches exact string property names", () => {
    const content = `
      export default defineDocs({
        subtitle: "Wrong title",
        title: "Correct title",
      });
    `;

    expect(readStringProperty(content, "title")).toBe("Correct title");
  });

  it("reads top-level string properties without picking nested matches", () => {
    const content = `
      export default defineDocs({
        entry: "docs",
        changelog: {
          contentDir: "changelog",
        },
      });
    `;

    expect(readTopLevelStringProperty(content, "entry")).toBe("docs");
    expect(readTopLevelStringProperty(content, "contentDir")).toBeUndefined();
  });

  it("reads top-level boolean properties without picking nested matches", () => {
    const content = `
      export default defineDocs({
        cloud: {
          preview: {
            enabled: false,
          },
          enabled: true,
        },
      });
    `;

    const cloudBlock = extractNestedObjectLiteral(content, ["cloud"]) ?? "";
    expect(readTopLevelBooleanProperty(cloudBlock, "enabled")).toBe(true);
  });

  it("matches exact boolean property names", () => {
    const content = `
      export default defineDocs({
        featureEnabled: false,
        enabled: true,
      });
    `;

    expect(readBooleanProperty(content, "enabled")).toBe(true);
  });

  it("reads process.env property references", () => {
    const content = `
      export default defineDocs({
        agent: {
          compact: {
            apiKey: process.env.DOCS_CLOUD_API_KEY,
          },
        },
      });
    `;

    expect(readEnvReferenceProperty(content, "apiKey")).toBe("DOCS_CLOUD_API_KEY");
  });

  it("reads bracketed import.meta.env property references", () => {
    const content = `
      export default defineDocs({
        agent: {
          compact: {
            apiKey: import.meta.env["PUBLIC_DOCS_CLOUD_KEY"],
          },
        },
      });
    `;

    expect(readEnvReferenceProperty(content, "apiKey")).toBe("PUBLIC_DOCS_CLOUD_KEY");
  });

  it("ignores braces inside strings when extracting config blocks", () => {
    const content = `
      export default defineDocs({
        metadata: {
          description: "Docs } release {notes}",
        },
        nav: {
          title: "Docs } Beta",
        },
        agent: {
          compact: {
            apiKeyEnv: "TOKEN_{COMPANY}_API_KEY",
          },
        },
      });
    `;

    expect(readNavTitle(content)).toBe("Docs } Beta");
    expect(extractNestedObjectLiteral(content, ["agent", "compact"])).toContain(
      'apiKeyEnv: "TOKEN_{COMPANY}_API_KEY"',
    );
  });

  it("extracts top-level config blocks that are preceded by comments", () => {
    const content = `
      export default defineDocs({
        feedback: {
          agent: {
            enabled: true,
          },
        },
        // Global machine-doc defaults.
        // Keep these readable for automation.
        agent: {
          compact: {
            apiKeyEnv: "DOCS_CLOUD_API_KEY",
          },
        },
        /*
         * Generated sitemap settings.
         */
        sitemap: {
          enabled: true,
        },
      });
    `;

    expect(extractNestedObjectLiteral(content, ["agent", "compact"])).toContain(
      'apiKeyEnv: "DOCS_CLOUD_API_KEY"',
    );
    expect(extractNestedObjectLiteral(content, ["sitemap"])).toContain("enabled: true");
  });
});

describe("loadDocsConfigModuleResult", () => {
  it("evaluates a plain config export", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-config-loader-"));
    tempDirs.push(rootDir);
    writeFileSync(
      join(rootDir, "docs.config.js"),
      'export default { entry: "guide", search: true };\n',
      "utf-8",
    );

    await expect(loadDocsConfigModuleResult(rootDir, undefined, { silent: true })).resolves.toEqual(
      {
        status: "evaluated",
        path: join(rootDir, "docs.config.js"),
        config: { entry: "guide", search: true },
      },
    );
  });

  it.each([
    ["an array", "export default [];\n"],
    ["an array beside named exports", "export const helper = true;\nexport default [];\n"],
    ["a Date instance", "export default new Date(0);\n"],
    ["a class instance", "class Config {}\nexport default new Config();\n"],
    ["null", "export default null;\n"],
  ])("falls back when the config exports %s", async (_label, source) => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-config-loader-"));
    tempDirs.push(rootDir);
    writeFileSync(join(rootDir, "docs.config.js"), source, "utf-8");

    await expect(
      loadDocsConfigModuleResult(rootDir, undefined, { silent: true }),
    ).resolves.toMatchObject({
      status: "static-fallback",
      path: join(rootDir, "docs.config.js"),
      error: "The config module did not export a plain object.",
    });
  });
});

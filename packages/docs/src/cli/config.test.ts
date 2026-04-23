import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractNestedObjectLiteral,
  readBooleanProperty,
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
            apiKey: process.env.TOKEN_COMPANY_API_KEY,
          },
        },
      });
    `;

    expect(readEnvReferenceProperty(content, "apiKey")).toBe("TOKEN_COMPANY_API_KEY");
  });

  it("reads bracketed import.meta.env property references", () => {
    const content = `
      export default defineDocs({
        agent: {
          compact: {
            apiKey: import.meta.env["PUBLIC_TTC_KEY"],
          },
        },
      });
    `;

    expect(readEnvReferenceProperty(content, "apiKey")).toBe("PUBLIC_TTC_KEY");
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
});

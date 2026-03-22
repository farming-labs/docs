import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { withDocs } from "./config.js";

const DOCS_CONFIG = `export default { entry: "docs" };
`;

const DOCS_CONFIG_WITH_THEME = `import { pixelBorder } from "@farming-labs/theme/pixel-border";

export default {
  entry: "docs",
  theme: pixelBorder(),
};
`;

const DOCS_CONFIG_WITH_CUSTOM_THEME = `import { myTheme } from "./themes/my-theme";

export default {
  entry: "docs",
  theme: myTheme(),
};
`;

const DOCS_CONFIG_WITH_API_REFERENCE = `export default {
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
  },
};
`;

describe("withDocs (app dir: src/app vs app)", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), "next-withdocs-test-"));
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG, "utf-8");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("generates layout and API route under src/app when src/app exists", () => {
    mkdirSync(join(tmpDir, "src", "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "src/app/docs/layout.tsx"))).toBe(true);
    expect(existsSync(join(tmpDir, "src/app/api/docs/route.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/docs/layout.tsx"))).toBe(false);
    expect(existsSync(join(tmpDir, "app/api/docs/route.ts"))).toBe(false);
  });

  it("generates layout and API route under app when only app exists", () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/docs/layout.tsx"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/api/docs/route.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "src/app/docs/layout.tsx"))).toBe(false);
    expect(existsSync(join(tmpDir, "src/app/api/docs/route.ts"))).toBe(false);
  });

  it("prefers src/app when both app and src/app exist", () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "src/app/docs/layout.tsx"))).toBe(true);
    expect(existsSync(join(tmpDir, "src/app/api/docs/route.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/docs/layout.tsx"))).toBe(false);
  });

  it("generates API reference routes when enabled in docs.config", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_API_REFERENCE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/route.ts"))).toBe(true);
  });

  it("skips API reference route generation for static export", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_API_REFERENCE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({ output: "export" });

    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/route.ts"))).toBe(false);
  });

  it("parses apiReference blocks that contain nested objects", () => {
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  apiReference: {
    enabled: true,
    extra: { foo: true },
    path: "custom-api-reference",
  },
};
`,
      "utf-8",
    );
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/custom-api-reference/[[...slug]]/route.ts"))).toBe(true);
  });

  it("generates a layout that re-exports the package-owned docs layout", () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    const layout = readFileSync(join(tmpDir, "app/docs/layout.tsx"), "utf-8");

    expect(layout).toContain('import docsConfig from "@/docs.config";');
    expect(layout).toContain("createNextDocsLayout(docsConfig)");
    expect(layout).toContain('import "./docs-theme.css";');
    expect(existsSync(join(tmpDir, "docs-client-callbacks.tsx"))).toBe(false);
    expect(layout).not.toContain("DocsClientCallbacks");
  });

  it("generates docs-theme.css from the selected built-in theme", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_THEME, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    const css = readFileSync(join(tmpDir, "app/docs/docs-theme.css"), "utf-8");
    expect(css).toContain('@import "@farming-labs/theme/pixel-border/css";');
  });

  it("generates docs-theme.css from a custom theme file relative to docs.config", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_CUSTOM_THEME, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    mkdirSync(join(tmpDir, "themes"), { recursive: true });
    writeFileSync(join(tmpDir, "themes", "my-theme.css"), "/* custom theme */", "utf-8");
    process.chdir(tmpDir);

    withDocs({});

    const css = readFileSync(join(tmpDir, "app/docs/docs-theme.css"), "utf-8");
    expect(css).toContain('@import "../../themes/my-theme.css";');
  });
});

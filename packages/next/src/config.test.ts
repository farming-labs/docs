import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { withDocs } from "./config.js";

const DOCS_CONFIG = `export default { entry: "docs" };
`;

const DOCS_CONFIG_WITH_API_REFERENCE = `export default {
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
  },
};
`;

const DOCS_CONFIG_WITH_MCP = `export default {
  entry: "docs",
  mcp: {
    enabled: true,
  },
};
`;

const DOCS_CONFIG_WITH_CUSTOM_MCP_ROUTE = `export default {
  entry: "docs",
  mcp: {
    enabled: true,
    route: "/api/internal/docs/mcp",
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

  it("generates the default MCP route when enabled in docs.config", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_MCP, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api/docs/mcp/route.ts"))).toBe(true);
    const route = readFileSync(join(tmpDir, "app/api/docs/mcp/route.ts"), "utf-8");
    expect(route).toContain(
      'import { createDocsMCPAPI, resolveNextProjectRoot } from "@farming-labs/next/api";',
    );
    expect(route).toContain("const rootDir = resolveNextProjectRoot(import.meta.url);");
    expect(route).toContain("search: docsConfig.search");
  });

  it("skips default MCP route generation when a custom route is configured", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_CUSTOM_MCP_ROUTE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api/docs/mcp/route.ts"))).toBe(false);
  });

  it("skips API reference route generation for static export", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_API_REFERENCE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({ output: "export" });

    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/route.ts"))).toBe(false);
  });

  it("skips MCP route generation for static export", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_MCP, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({ output: "export" });

    expect(existsSync(join(tmpDir, "app/api/docs/mcp/route.ts"))).toBe(false);
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

    const nextConfig = withDocs({});
    const turbopack = nextConfig.turbopack as { resolveAlias?: Record<string, string> } | undefined;

    const layout = readFileSync(join(tmpDir, "app/docs/layout.tsx"), "utf-8");

    expect(layout).toContain('import docsConfig from "@/docs.config";');
    expect(layout).toContain("createNextDocsLayout(docsConfig)");
    expect(turbopack?.resolveAlias?.["@farming-labs/next-internal-docs-config"]).toBe(
      "./docs.config.ts",
    );
    expect(typeof nextConfig.webpack).toBe("function");
    expect(existsSync(join(tmpDir, "docs-client-callbacks.tsx"))).toBe(false);
    expect(existsSync(join(tmpDir, "app/docs/docs-theme.css"))).toBe(false);
  });

  it("generates a docs API route that forwards search and ai config", () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    const route = readFileSync(join(tmpDir, "app/api/docs/route.ts"), "utf-8");

    expect(route).toContain(
      'import { createDocsAPI, resolveNextProjectRoot } from "@farming-labs/next/api";',
    );
    expect(route).toContain("const rootDir = resolveNextProjectRoot(import.meta.url);");
    expect(route).toContain("rootDir,");
    expect(route).toContain("search: docsConfig.search");
    expect(route).toContain("ai: docsConfig.ai");
  });
});

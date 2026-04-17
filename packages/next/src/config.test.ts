import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
} from "node:fs";
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

const DOCS_CONFIG_WITH_SCALAR_API_REFERENCE = `export default {
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    renderer: "scalar",
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

const DOCS_CONFIG_WITH_CHANGELOG = `export default {
  entry: "docs",
  changelog: {
    enabled: true,
    path: "changelogs",
    contentDir: "changelog",
  },
};
`;

const DOCS_CONFIG_WITH_TOP_LEVEL_CONTENT_DIR = `import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
    contentDir: "website/app/docs",
    changelog: {
      enabled: true,
      path: "changelogs",
      contentDir: "changelog",
    },
});
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

  it("generates Fumadocs API reference files when enabled in docs.config", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_API_REFERENCE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api-reference/layout.tsx"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/page.tsx"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/route.ts"))).toBe(false);
    const page = readFileSync(join(tmpDir, "app/api-reference/[[...slug]]/page.tsx"), "utf-8");
    expect(page).toContain('import "@farming-labs/next/api-reference.css";');
    expect(page).toContain("createNextApiReferencePage");
  });

  it("generates the Scalar route when renderer is explicitly set to scalar", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_SCALAR_API_REFERENCE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/route.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/api-reference/layout.tsx"))).toBe(false);
    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/page.tsx"))).toBe(false);
  });

  it("generates the default MCP route when enabled in docs.config", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_MCP, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api/docs/mcp/route.ts"))).toBe(true);
    const route = readFileSync(join(tmpDir, "app/api/docs/mcp/route.ts"), "utf-8");
    expect(route).toContain('import { createDocsMCPAPI } from "@farming-labs/next/api";');
    expect(route).not.toContain("resolveNextProjectRoot");
    expect(route).toContain("search: docsConfig.search");
  });

  it("generates changelog pages inside the docs route tree and hides the source subtree when needed", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_CHANGELOG, "utf-8");
    mkdirSync(join(tmpDir, "app", "docs", "changelog", "2026-03-04"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "changelog", "2026-03-04", "page.mdx"),
      "---\ntitle: Release\ndescription: Added changelog support.\n---\n\n# Release\n",
      "utf-8",
    );
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/docs/changelogs/page.tsx"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/docs/changelogs/[slug]/page.tsx"))).toBe(true);
    expect(existsSync(join(tmpDir, "app/docs/changelogs/__changelog.generated.tsx"))).toBe(false);
    expect(existsSync(join(tmpDir, "app/docs/changelog/layout.tsx"))).toBe(true);

    const indexPage = readFileSync(join(tmpDir, "app/docs/changelogs/page.tsx"), "utf-8");
    expect(indexPage).toContain('"2026-03-04"');
    expect(indexPage).toContain('"/docs/changelogs/2026-03-04"');
    expect(indexPage).toContain("../changelog/2026-03-04/page.mdx");

    const entryPage = readFileSync(join(tmpDir, "app/docs/changelogs/[slug]/page.tsx"), "utf-8");
    expect(entryPage).toContain('"2026-03-04"');
    expect(entryPage).toContain('"/docs/changelogs/2026-03-04"');
    expect(entryPage).toContain("../../changelog/2026-03-04/page.mdx");
    expect(existsSync(join(tmpDir, "app/changelogs/page.tsx"))).toBe(false);
  });

  it("skips default MCP route generation when a custom route is configured", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_CUSTOM_MCP_ROUTE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api/docs/mcp/route.ts"))).toBe(false);
  });

  it("skips API reference generation for static export", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_API_REFERENCE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({ output: "export" });

    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/route.ts"))).toBe(false);
    expect(existsSync(join(tmpDir, "app/api-reference/layout.tsx"))).toBe(false);
    expect(existsSync(join(tmpDir, "app/api-reference/[[...slug]]/page.tsx"))).toBe(false);
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

    expect(existsSync(join(tmpDir, "app/custom-api-reference/[[...slug]]/page.tsx"))).toBe(true);
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

    expect(route).toContain('import { createDocsAPI } from "@farming-labs/next/api";');
    expect(route).not.toContain("resolveNextProjectRoot");
    expect(route).not.toContain("rootDir,");
    expect(route).toContain("changelog: docsConfig.changelog");
    expect(route).toContain("search: docsConfig.search");
    expect(route).toContain("ai: docsConfig.ai");
  });

  it("adds docs content to output file tracing for docs api routes", () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    expect(nextConfig.outputFileTracingIncludes).toMatchObject({
      "/api/docs": ["app/docs/**/*"],
      "/api/docs/mcp": ["app/docs/**/*"],
    });
  });

  it("reads a top-level contentDir even when nested config uses deeper indentation", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_TOP_LEVEL_CONTENT_DIR, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    expect(nextConfig.outputFileTracingIncludes).toMatchObject({
      "/api/docs": ["website/app/docs/**/*"],
      "/api/docs/mcp": ["website/app/docs/**/*"],
    });
  });

  it("auto-configures workspace turbopack aliases when running inside the docs monorepo", () => {
    const workspaceRoot = join(tmpDir, "repo");
    const appRoot = join(workspaceRoot, "examples", "next");

    mkdirSync(join(workspaceRoot, "packages", "docs", "src"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "fumadocs", "src"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "next", "src"), { recursive: true });
    mkdirSync(join(appRoot, "app"), { recursive: true });

    writeFileSync(join(workspaceRoot, "packages", "docs", "src", "index.ts"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "fumadocs", "src", "index.ts"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "next", "src", "config.ts"), "export {};\n");
    writeFileSync(join(appRoot, "docs.config.ts"), DOCS_CONFIG, "utf-8");
    process.chdir(appRoot);

    const nextConfig = withDocs({});
    const turbopack = nextConfig.turbopack as
      | { root?: string; resolveAlias?: Record<string, string> }
      | undefined;

    expect(turbopack?.root).toBe(realpathSync(workspaceRoot));
    expect(turbopack?.resolveAlias?.["@farming-labs/docs"]).toBe("./packages/docs/src/index.ts");
    expect(turbopack?.resolveAlias?.["@farming-labs/next/api"]).toBe("./packages/next/src/api.ts");
    expect(turbopack?.resolveAlias?.["@farming-labs/theme/search"]).toBe(
      "./packages/fumadocs/src/search.ts",
    );
  });
});

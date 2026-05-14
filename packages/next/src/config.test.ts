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

type TestRewrite = {
  source: string;
  destination: string;
  has?: Array<Record<string, string>>;
};

type TestRewriteResult =
  | TestRewrite[]
  | {
      beforeFiles?: TestRewrite[];
      afterFiles?: TestRewrite[];
      fallback?: TestRewrite[];
    };

type TestRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
};

async function readRewrites(nextConfig: ReturnType<typeof withDocs>) {
  return (nextConfig.rewrites as () => Promise<TestRewriteResult>)();
}

async function readRedirects(nextConfig: ReturnType<typeof withDocs>) {
  return (nextConfig.redirects as () => Promise<TestRedirect[]>)();
}

function getBeforeFilesRewrites(result: TestRewriteResult): TestRewrite[] {
  return Array.isArray(result) ? result : (result.beforeFiles ?? []);
}

function getAfterFilesRewrites(result: TestRewriteResult): TestRewrite[] {
  return Array.isArray(result) ? [] : (result.afterFiles ?? []);
}

const DOCS_CONFIG = `export default { entry: "docs" };
`;

const MARKDOWN_ACCEPT_HEADER = {
  type: "header",
  key: "accept",
  value: [
    "(?:^|.*,\\s*)",
    "text/markdown",
    "(?:\\s*;",
    "(?!\\s*(?:[^,;]*;\\s*)*q\\s*=\\s*(?:0+(?:\\.0*)?|\\.0+)\\s*(?:;|,|$))",
    "[^,]*)?",
    "(?:\\s*,.*|$)",
  ].join(""),
};

const MARKDOWN_SIGNATURE_AGENT_HEADER = {
  type: "header",
  key: "signature-agent",
  value: ".+",
};

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

const DOCS_CONFIG_WITH_SITEMAP = `export default {
  entry: "docs",
  sitemap: {
    enabled: true,
    routePrefix: "/docs-map",
  },
};
`;

const DOCS_CONFIG_WITH_AGENT_FEEDBACK_DISABLED = `export default {
  entry: "docs",
  feedback: {
    agent: false,
  },
};
`;

const DOCS_CONFIG_WITH_TOP_LEVEL_FEEDBACK_DISABLED = `export default {
  entry: "docs",
  feedback: false,
};
`;

const DOCS_CONFIG_WITH_AI_FEEDBACK_DISABLED = `export default {
  entry: "docs",
  ai: {
    feedback: false,
  },
};
`;

const DOCS_CONFIG_WITH_CUSTOM_AGENT_FEEDBACK = `export default {
  entry: "docs",
  feedback: {
    agent: {
      enabled: true,
      route: "/internal/docs/agent-feedback",
      schemaRoute: "/internal/docs/agent-feedback/schema",
    },
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
    expect(readFileSync(join(tmpDir, "src/app/api/docs/route.ts"), "utf-8")).toContain(
      "createDocsAPI(docsConfig)",
    );
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
    expect(route).toContain("createDocsMCPAPI(docsConfig)");
    expect(route).not.toContain("search: docsConfig.search");
  });

  it("generates the default MCP route when mcp config is omitted", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    withDocs({});

    expect(existsSync(join(tmpDir, "app/api/docs/mcp/route.ts"))).toBe(true);
  });

  it("routes markdown rewrites through the shared docs api handler", async () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    expect(existsSync(join(tmpDir, "app/api/docs/markdown/[[...slug]]/route.ts"))).toBe(false);

    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/docs/agent/spec",
          destination: "/api/docs?agent=spec",
        }),
        expect.objectContaining({
          source: "/.well-known/agent",
          destination: "/api/docs?agent=spec",
        }),
        expect.objectContaining({
          source: "/.well-known/agent.json",
          destination: "/api/docs?agent=spec",
        }),
        expect.objectContaining({
          source: "/mcp",
          destination: "/api/docs/mcp",
        }),
        expect.objectContaining({
          source: "/.well-known/mcp",
          destination: "/api/docs/mcp",
        }),
        expect.objectContaining({
          source: "/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/llms-full.txt",
          destination: "/api/docs?format=llms-full",
        }),
        expect.objectContaining({
          source: "/.well-known/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/.well-known/llms-full.txt",
          destination: "/api/docs?format=llms-full",
        }),
        expect.objectContaining({
          source: "/docs/:section*/llms.txt",
          destination: "/api/docs?format=llms&section=/docs/:section*/llms.txt",
        }),
        expect.objectContaining({
          source: "/docs/:section*/llms-full.txt",
          destination: "/api/docs?format=llms-full&section=/docs/:section*/llms-full.txt",
        }),
        expect.objectContaining({
          source: "/skill.md",
          destination: "/api/docs?format=skill",
        }),
        expect.objectContaining({
          source: "/.well-known/skill.md",
          destination: "/api/docs?format=skill",
        }),
        expect.objectContaining({
          source: "/sitemap.xml",
          destination: "/api/docs?format=sitemap-xml",
        }),
        expect.objectContaining({
          source: "/sitemap.md",
          destination: "/api/docs?format=sitemap-md",
        }),
        expect.objectContaining({
          source: "/.well-known/sitemap.md",
          destination: "/api/docs?format=sitemap-md",
        }),
        expect.objectContaining({
          source: "/robots.txt",
          destination: "/api/docs?format=robots",
        }),
        expect.objectContaining({
          source: "/api/docs/agent/feedback",
          destination: "/api/docs?feedback=agent",
        }),
        expect.objectContaining({
          source: "/api/docs/agent/feedback/schema",
          destination: "/api/docs?feedback=agent&schema=1",
        }),
        expect.objectContaining({
          source: "/docs.md",
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: "/docs/:slug*.md",
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
        expect.objectContaining({
          source: "/docs",
          has: [MARKDOWN_ACCEPT_HEADER],
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_ACCEPT_HEADER],
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
        expect.objectContaining({
          source: "/docs",
          has: [MARKDOWN_SIGNATURE_AGENT_HEADER],
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_SIGNATURE_AGENT_HEADER],
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
      ]),
    );

    const acceptPattern = new RegExp(MARKDOWN_ACCEPT_HEADER.value);
    expect(acceptPattern.test("text/markdown")).toBe(true);
    expect(acceptPattern.test("application/json, text/markdown;q=0.5")).toBe(true);
    expect(acceptPattern.test("application/json, text/markdown;q=0")).toBe(false);
    expect(acceptPattern.test("application/json, text/markdown;profile=agent;q=0")).toBe(false);
    expect(acceptPattern.test("text/markdown-v2")).toBe(false);
    expect(acceptPattern.test("application/not-text/markdownish")).toBe(false);
  });

  it("routes sitemap rewrites through the shared docs api handler when enabled", async () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_SITEMAP, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/docs-map/sitemap.xml",
          destination: "/api/docs?format=sitemap-xml",
        }),
        expect.objectContaining({
          source: "/docs-map/sitemap.md",
          destination: "/api/docs?format=sitemap-md",
        }),
        expect.objectContaining({
          source: "/docs-map/.well-known/sitemap.md",
          destination: "/api/docs?format=sitemap-md",
        }),
      ]),
    );
  });

  it("keeps an existing public robots.txt file in control", async () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    mkdirSync(join(tmpDir, "public"), { recursive: true });
    writeFileSync(join(tmpDir, "public", "robots.txt"), "User-agent: *\nAllow: /\n", "utf-8");
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/robots.txt",
          destination: "/api/docs?format=robots",
        }),
      ]),
    );
  });

  it("redirects hidden folder parents to their first visible child", async () => {
    mkdirSync(join(tmpDir, "app", "docs", "overview", "what-is-surge"), { recursive: true });
    mkdirSync(join(tmpDir, "app", "docs", "sending", "send-one"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "docs", "overview", "page.mdx"),
      "---\ntitle: Overview\nsidebar:\n  folderIndexBehavior: hidden\n---\n",
      "utf-8",
    );
    writeFileSync(
      join(tmpDir, "app", "docs", "overview", "what-is-surge", "page.mdx"),
      "# What is Surge\n",
      "utf-8",
    );
    writeFileSync(
      join(tmpDir, "app", "docs", "sending", "page.mdx"),
      "---\ntitle: Sending\nsidebar:\n  folderIndexBehavior: hidden\n---\n",
      "utf-8",
    );
    writeFileSync(join(tmpDir, "app", "docs", "sending", "send-one", "page.mdx"), "# Send\n");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const redirects = await readRedirects(nextConfig);

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/docs/overview",
          destination: "/docs/overview/what-is-surge",
          permanent: false,
        }),
        expect.objectContaining({
          source: "/docs/sending",
          destination: "/docs/sending/send-one",
          permanent: false,
        }),
      ]),
    );
  });

  it("adds agent feedback rewrites through the shared docs api handler by default", async () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/docs/agent/feedback",
          destination: "/api/docs?feedback=agent",
        }),
        expect.objectContaining({
          source: "/api/docs/agent/feedback/schema",
          destination: "/api/docs?feedback=agent&schema=1",
        }),
      ]),
    );
  });

  it("skips agent feedback rewrites when explicitly disabled", async () => {
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      DOCS_CONFIG_WITH_AGENT_FEEDBACK_DISABLED,
      "utf-8",
    );
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/docs/agent/feedback",
          destination: "/api/docs?feedback=agent",
        }),
      ]),
    );
  });

  it("skips agent feedback rewrites when top-level feedback is false", async () => {
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      DOCS_CONFIG_WITH_TOP_LEVEL_FEEDBACK_DISABLED,
      "utf-8",
    );
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/docs/agent/feedback",
          destination: "/api/docs?feedback=agent",
        }),
      ]),
    );
  });

  it("keeps agent feedback rewrites when only Ask AI feedback is disabled", async () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_AI_FEEDBACK_DISABLED, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/docs/agent/feedback",
          destination: "/api/docs?feedback=agent",
        }),
      ]),
    );
  });

  it("uses custom agent feedback routes when configured", async () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_CUSTOM_AGENT_FEEDBACK, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/internal/docs/agent-feedback",
          destination: "/api/docs?feedback=agent",
        }),
        expect.objectContaining({
          source: "/internal/docs/agent-feedback/schema",
          destination: "/api/docs?feedback=agent&schema=1",
        }),
      ]),
    );
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

  it("skips default MCP route generation and aliases public MCP routes when a custom route is configured", async () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_CUSTOM_MCP_ROUTE, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = getBeforeFilesRewrites(await readRewrites(nextConfig));

    expect(existsSync(join(tmpDir, "app/api/docs/mcp/route.ts"))).toBe(false);
    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/mcp",
          destination: "/api/internal/docs/mcp",
        }),
        expect.objectContaining({
          source: "/.well-known/mcp",
          destination: "/api/internal/docs/mcp",
        }),
      ]),
    );
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

  it("skips markdown rewrites for static export", () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({ output: "export" });

    expect(nextConfig.rewrites).toBeUndefined();
    expect(existsSync(join(tmpDir, "app/api/docs/markdown/[[...slug]]/route.ts"))).toBe(false);
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
    expect(route).toContain("createDocsAPI(docsConfig)");
    expect(route).not.toContain("changelog: docsConfig.changelog");
    expect(route).not.toContain("llmsTxt: docsConfig.llmsTxt");
    expect(route).not.toContain("sitemap: docsConfig.sitemap");
    expect(route).not.toContain("robots: docsConfig.robots");
    expect(route).not.toContain("search: docsConfig.search");
    expect(route).not.toContain("ai: docsConfig.ai");
  });

  it("adds docs content to output file tracing for docs api routes", () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    expect(nextConfig.outputFileTracingIncludes).toMatchObject({
      "/api/docs": ["app/docs/**/*", "skill.md", ".farming-labs/sitemap-manifest.json"],
      "/api/docs/mcp": ["app/docs/**/*"],
    });
  });

  it("reads a top-level contentDir even when nested config uses deeper indentation", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_TOP_LEVEL_CONTENT_DIR, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    expect(nextConfig.outputFileTracingIncludes).toMatchObject({
      "/api/docs": ["website/app/docs/**/*", "skill.md", ".farming-labs/sitemap-manifest.json"],
      "/api/docs/mcp": ["website/app/docs/**/*"],
    });
  });

  it("merges automatic markdown rewrites with user rewrites", async () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({
      rewrites: async () => [
        {
          source: "/legacy",
          destination: "/docs/getting-started/quickstart",
        },
      ],
    });

    const rewritesResult = await readRewrites(nextConfig);
    const beforeFiles = getBeforeFilesRewrites(rewritesResult);
    const afterFiles = getAfterFilesRewrites(rewritesResult);

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/docs/agent/spec",
          destination: "/api/docs?agent=spec",
        }),
        expect.objectContaining({
          source: "/.well-known/agent",
          destination: "/api/docs?agent=spec",
        }),
        expect.objectContaining({
          source: "/.well-known/agent.json",
          destination: "/api/docs?agent=spec",
        }),
        expect.objectContaining({
          source: "/mcp",
          destination: "/api/docs/mcp",
        }),
        expect.objectContaining({
          source: "/.well-known/mcp",
          destination: "/api/docs/mcp",
        }),
        expect.objectContaining({
          source: "/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/llms-full.txt",
          destination: "/api/docs?format=llms-full",
        }),
        expect.objectContaining({
          source: "/.well-known/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/.well-known/llms-full.txt",
          destination: "/api/docs?format=llms-full",
        }),
        expect.objectContaining({
          source: "/docs/:section*/llms.txt",
          destination: "/api/docs?format=llms&section=/docs/:section*/llms.txt",
        }),
        expect.objectContaining({
          source: "/docs/:section*/llms-full.txt",
          destination: "/api/docs?format=llms-full&section=/docs/:section*/llms-full.txt",
        }),
        expect.objectContaining({
          source: "/skill.md",
          destination: "/api/docs?format=skill",
        }),
        expect.objectContaining({
          source: "/.well-known/skill.md",
          destination: "/api/docs?format=skill",
        }),
        expect.objectContaining({
          source: "/docs.md",
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: "/docs/:slug*.md",
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_ACCEPT_HEADER],
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_SIGNATURE_AGENT_HEADER],
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
      ]),
    );
    expect(afterFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/legacy",
          destination: "/docs/getting-started/quickstart",
        }),
      ]),
    );
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

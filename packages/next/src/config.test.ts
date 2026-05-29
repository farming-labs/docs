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
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  DOCS_AI_AGENT_USER_AGENT_HEADER_PATTERN,
  DOCS_BOT_LIKE_USER_AGENT_HEADER_PATTERN,
  DOCS_TRADITIONAL_BOT_USER_AGENT_HEADER_PATTERN,
} from "@farming-labs/docs";
import { withDocs } from "./config.js";

type TestRewrite = {
  source: string;
  destination: string;
  has?: Array<Record<string, string>>;
  missing?: Array<Record<string, string>>;
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

const DOCS_CONFIG_WITH_ROOT_DOCS_PATH = `export default {
  entry: "docs",
  docsPath: "",
};
`;

const DOCS_CONFIG_WITH_SLASH_DOCS_PATH = `export default {
  entry: "docs",
  docsPath: "/",
};
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

const MARKDOWN_AGENT_USER_AGENT_HEADER = {
  type: "header",
  key: "user-agent",
  value: DOCS_AI_AGENT_USER_AGENT_HEADER_PATTERN,
};

const MARKDOWN_BOT_LIKE_USER_AGENT_HEADER = {
  type: "header",
  key: "user-agent",
  value: DOCS_BOT_LIKE_USER_AGENT_HEADER_PATTERN,
};

const MARKDOWN_TRADITIONAL_BOT_USER_AGENT_HEADER = {
  type: "header",
  key: "user-agent",
  value: DOCS_TRADITIONAL_BOT_USER_AGENT_HEADER_PATTERN,
};

const MARKDOWN_SEC_FETCH_MODE_HEADER = {
  type: "header",
  key: "sec-fetch-mode",
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
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.DOCS_CLOUD_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT;
    delete process.env.DOCS_CLOUD_ANALYTICS_ENDPOINT;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
    delete process.env.DOCS_CLOUD_ANALYTICS_ENABLED;

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
          source: "/AGENTS.md",
          destination: "/api/docs?format=agents",
        }),
        expect.objectContaining({
          source: "/.well-known/AGENTS.md",
          destination: "/api/docs?format=agents",
        }),
        expect.objectContaining({
          source: "/AGENT.md",
          destination: "/api/docs?format=agents",
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
          source: "/docs/sitemap.md",
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
        expect.objectContaining({
          source: "/docs",
          has: [MARKDOWN_AGENT_USER_AGENT_HEADER],
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_AGENT_USER_AGENT_HEADER],
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
        expect.objectContaining({
          source: "/docs",
          has: [MARKDOWN_BOT_LIKE_USER_AGENT_HEADER],
          missing: [MARKDOWN_TRADITIONAL_BOT_USER_AGENT_HEADER, MARKDOWN_SEC_FETCH_MODE_HEADER],
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_BOT_LIKE_USER_AGENT_HEADER],
          missing: [MARKDOWN_TRADITIONAL_BOT_USER_AGENT_HEADER, MARKDOWN_SEC_FETCH_MODE_HEADER],
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
      ]),
    );
    expect(afterFiles).toEqual(
      expect.arrayContaining([
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
          source: "/docs/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/docs/llms-full.txt",
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
      ]),
    );
    expect(beforeFiles).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/",
          destination: "/docs/",
        }),
        expect.objectContaining({
          source: expect.stringContaining(":slug((?!"),
          destination: "/docs/:slug",
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

    const agentUserAgentPattern = new RegExp(MARKDOWN_AGENT_USER_AGENT_HEADER.value);
    expect(agentUserAgentPattern.test("ClaudeBot/1.0")).toBe(true);
    expect(agentUserAgentPattern.test("Mozilla/5.0")).toBe(false);

    const botLikeUserAgentPattern = new RegExp(MARKDOWN_BOT_LIKE_USER_AGENT_HEADER.value);
    expect(botLikeUserAgentPattern.test("AcmeAgentFetcher/1.0")).toBe(true);
    expect(botLikeUserAgentPattern.test("Mozilla/5.0")).toBe(false);

    const traditionalBotUserAgentPattern = new RegExp(
      MARKDOWN_TRADITIONAL_BOT_USER_AGENT_HEADER.value,
    );
    expect(traditionalBotUserAgentPattern.test("Googlebot/2.1")).toBe(true);
    expect(traditionalBotUserAgentPattern.test("AcmeAgentFetcher/1.0")).toBe(false);
  });

  it("exposes docs from the site root when docsPath is empty", async () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_ROOT_DOCS_PATH, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    const rewritesResult = await readRewrites(nextConfig);
    const beforeFiles = getBeforeFilesRewrites(rewritesResult);

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/docs.md",
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: expect.stringContaining("\\.md"),
          destination: "/api/docs?format=markdown&path=:slug",
        }),
        expect.objectContaining({
          source: "/",
          has: [MARKDOWN_ACCEPT_HEADER],
          destination: "/api/docs?format=markdown",
        }),
        expect.objectContaining({
          source: "/",
          destination: "/docs/",
        }),
        expect.objectContaining({
          source: expect.stringContaining(":slug((?!"),
          destination: "/docs/:slug",
        }),
      ]),
    );

    const docsRootRewrite = beforeFiles.find((rewrite) => rewrite.destination === "/docs/:slug");
    expect(docsRootRewrite?.source).toContain("docs(?:/|$)");

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/AGENTS.md",
          destination: "/api/docs?format=agents",
        }),
        expect.objectContaining({
          source: "/sitemap.md",
          destination: "/api/docs?format=sitemap-md",
        }),
        expect.objectContaining({
          source: "/mcp",
          destination: "/api/docs/mcp",
        }),
      ]),
    );
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
    expect(rewrites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/docs/sitemap.md",
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

  it("lets native static llms.txt files win before generated llms rewrites", async () => {
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    mkdirSync(join(tmpDir, "public"), { recursive: true });
    writeFileSync(join(tmpDir, "public", "llms.txt"), "# Custom llms\n", "utf-8");
    writeFileSync(join(tmpDir, "public", "llms-full.txt"), "# Custom full llms\n", "utf-8");
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewritesResult = await readRewrites(nextConfig);
    const beforeFiles = getBeforeFilesRewrites(rewritesResult);
    const afterFiles = getAfterFilesRewrites(rewritesResult);

    expect(beforeFiles).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/llms-full.txt",
          destination: "/api/docs?format=llms-full",
        }),
      ]),
    );
    expect(afterFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/llms-full.txt",
          destination: "/api/docs?format=llms-full",
        }),
      ]),
    );
  });

  it.each([
    [
      "app/robots.ts",
      "export default function robots() { return { rules: [{ userAgent: '*', allow: '/' }] }; }\n",
    ],
    ["app/robots.txt", "User-agent: *\nAllow: /\n"],
    [
      "src/app/robots.ts",
      "export default function robots() { return { rules: [{ userAgent: '*', allow: '/' }] }; }\n",
    ],
  ])("keeps an existing %s file in control", async (robotsPath, source) => {
    mkdirSync(dirname(join(tmpDir, robotsPath)), { recursive: true });
    writeFileSync(join(tmpDir, robotsPath), source, "utf-8");
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

  it("redirects hidden folder parents through the public docsPath", async () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_ROOT_DOCS_PATH, "utf-8");
    mkdirSync(join(tmpDir, "app", "docs", "overview", "what-is-surge"), { recursive: true });
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
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const redirects = await readRedirects(nextConfig);

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/overview",
          destination: "/overview/what-is-surge",
          permanent: false,
        }),
      ]),
    );
  });

  it.each([DOCS_CONFIG_WITH_ROOT_DOCS_PATH, DOCS_CONFIG_WITH_SLASH_DOCS_PATH])(
    "treats root docsPath values as the site root",
    async (configSource) => {
      writeFileSync(join(tmpDir, "docs.config.ts"), configSource, "utf-8");
      mkdirSync(join(tmpDir, "app"), { recursive: true });
      process.chdir(tmpDir);

      const nextConfig = withDocs({});
      const beforeFiles = getBeforeFilesRewrites(await readRewrites(nextConfig));

      expect(beforeFiles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "/",
            destination: "/docs/",
          }),
          expect.objectContaining({
            source: expect.stringContaining(":slug((?!"),
            destination: "/docs/:slug",
          }),
          expect.objectContaining({
            source: "/",
            has: [MARKDOWN_ACCEPT_HEADER],
            destination: "/api/docs?format=markdown",
          }),
        ]),
      );
    },
  );

  it.each(["docs", "/docs", "docs/", "/docs/"])(
    "treats %s as the default docsPath",
    async (docsPath) => {
      writeFileSync(
        join(tmpDir, "docs.config.ts"),
        `export default {
  entry: "docs",
  docsPath: ${JSON.stringify(docsPath)},
};
`,
        "utf-8",
      );
      mkdirSync(join(tmpDir, "app"), { recursive: true });
      process.chdir(tmpDir);

      const nextConfig = withDocs({});
      const beforeFiles = getBeforeFilesRewrites(await readRewrites(nextConfig));

      expect(beforeFiles).toEqual(
        expect.arrayContaining([
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
        ]),
      );
      expect(beforeFiles).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "/docs",
            destination: "/docs",
          }),
          expect.objectContaining({
            source: "/docs/:slug*",
            destination: "/docs/:slug*",
          }),
        ]),
      );
    },
  );

  it("normalizes duplicate slashes inside docsPath", async () => {
    writeFileSync(
      join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  docsPath: "/guides//docs/",
};
`,
      "utf-8",
    );
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});
    const rewrites = await readRewrites(nextConfig);
    const beforeFiles = getBeforeFilesRewrites(rewrites);
    const afterFiles = getAfterFilesRewrites(rewrites);

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/guides/docs",
          destination: "/docs",
        }),
        expect.objectContaining({
          source: "/guides/docs/:slug*",
          destination: "/docs/:slug*",
        }),
        expect.objectContaining({
          source: "/guides/docs",
          has: [MARKDOWN_ACCEPT_HEADER],
          destination: "/api/docs?format=markdown",
        }),
      ]),
    );
    expect(afterFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/guides/docs/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/guides/docs/llms-full.txt",
          destination: "/api/docs?format=llms-full",
        }),
        expect.objectContaining({
          source: "/guides/docs/:section*/llms.txt",
          destination: "/api/docs?format=llms&section=/guides/docs/:section*/llms.txt",
        }),
        expect.objectContaining({
          source: "/docs/llms.txt",
          destination: "/api/docs?format=llms",
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

  it("serializes public Docs Cloud analytics env into the client bundle", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server_only";
    process.env.DOCS_CLOUD_ANALYTICS_ENDPOINT =
      "https://docs-cloud.example.com/api/analytics/events";
    process.env.DOCS_CLOUD_ANALYTICS_ENABLED = "false";

    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    expect(nextConfig.env).toMatchObject({
      NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID: "project_server_only",
      NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT:
        "https://docs-cloud.example.com/api/analytics/events",
      NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED: "false",
    });
  });

  it("does not override user-provided public Docs Cloud analytics env", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server_only";

    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({
      env: {
        NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID: "project_user",
      },
    });

    expect(nextConfig.env?.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID).toBe("project_user");
    expect(nextConfig.env?.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT).toBe(
      "https://docs-app.farming-labs.dev/api/analytics/events",
    );
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
      "/api/docs": [
        "app/docs/**/*",
        "skill.md",
        "AGENTS.md",
        "AGENT.md",
        ".farming-labs/sitemap-manifest.json",
      ],
      "/api/docs/mcp": ["app/docs/**/*"],
    });
  });

  it("reads a top-level contentDir even when nested config uses deeper indentation", () => {
    writeFileSync(join(tmpDir, "docs.config.ts"), DOCS_CONFIG_WITH_TOP_LEVEL_CONTENT_DIR, "utf-8");
    mkdirSync(join(tmpDir, "app"), { recursive: true });
    process.chdir(tmpDir);

    const nextConfig = withDocs({});

    expect(nextConfig.outputFileTracingIncludes).toMatchObject({
      "/api/docs": [
        "website/app/docs/**/*",
        "skill.md",
        "AGENTS.md",
        "AGENT.md",
        ".farming-labs/sitemap-manifest.json",
      ],
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
          source: "/AGENTS.md",
          destination: "/api/docs?format=agents",
        }),
        expect.objectContaining({
          source: "/.well-known/AGENTS.md",
          destination: "/api/docs?format=agents",
        }),
        expect.objectContaining({
          source: "/AGENT.md",
          destination: "/api/docs?format=agents",
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
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_AGENT_USER_AGENT_HEADER],
          destination: "/api/docs?format=markdown&path=:slug*",
        }),
        expect.objectContaining({
          source: "/docs/:slug*",
          has: [MARKDOWN_BOT_LIKE_USER_AGENT_HEADER],
          missing: [MARKDOWN_TRADITIONAL_BOT_USER_AGENT_HEADER, MARKDOWN_SEC_FETCH_MODE_HEADER],
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
          source: "/docs/llms.txt",
          destination: "/api/docs?format=llms",
        }),
        expect.objectContaining({
          source: "/docs/llms-full.txt",
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
    writeFileSync(join(workspaceRoot, "packages", "fumadocs", "src", "search.ts"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "next", "src", "config.ts"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "next", "src", "api.ts"), "export {};\n");
    writeFileSync(join(appRoot, "docs.config.ts"), DOCS_CONFIG, "utf-8");
    process.chdir(appRoot);

    const nextConfig = withDocs({});
    const turbopack = nextConfig.turbopack as
      | { root?: string; resolveAlias?: Record<string, string> }
      | undefined;

    expect(turbopack?.root).toBe(realpathSync(workspaceRoot));
    expect(turbopack?.resolveAlias?.["@farming-labs/docs"]).toBe(
      "../../packages/docs/src/index.ts",
    );
    expect(turbopack?.resolveAlias?.["@farming-labs/next/api"]).toBe(
      "../../packages/next/src/api.ts",
    );
    expect(turbopack?.resolveAlias?.["@farming-labs/theme/search"]).toBe(
      "../../packages/fumadocs/src/search.ts",
    );
  });

  it("prefers built workspace turbopack aliases when dist entrypoints exist", () => {
    const workspaceRoot = join(tmpDir, "repo");
    const appRoot = join(workspaceRoot, "examples", "next");

    mkdirSync(join(workspaceRoot, "packages", "docs", "src"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "docs", "dist"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "fumadocs", "src"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "fumadocs", "dist"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "next", "src"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "next", "dist"), { recursive: true });
    mkdirSync(join(appRoot, "app"), { recursive: true });

    writeFileSync(join(workspaceRoot, "packages", "docs", "src", "index.ts"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "docs", "dist", "index.mjs"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "fumadocs", "src", "index.ts"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "fumadocs", "src", "search.ts"), "export {};\n");
    writeFileSync(
      join(workspaceRoot, "packages", "fumadocs", "dist", "search.mjs"),
      "export {};\n",
    );
    writeFileSync(join(workspaceRoot, "packages", "next", "src", "config.ts"), "export {};\n");
    writeFileSync(join(workspaceRoot, "packages", "next", "dist", "api.mjs"), "export {};\n");
    writeFileSync(join(appRoot, "docs.config.ts"), DOCS_CONFIG, "utf-8");
    process.chdir(appRoot);

    const nextConfig = withDocs({});
    const turbopack = nextConfig.turbopack as
      | { root?: string; resolveAlias?: Record<string, string> }
      | undefined;

    expect(turbopack?.root).toBe(realpathSync(workspaceRoot));
    expect(turbopack?.resolveAlias?.["@farming-labs/docs"]).toBe(
      "../../packages/docs/dist/index.mjs",
    );
    expect(turbopack?.resolveAlias?.["@farming-labs/next/api"]).toBe(
      "../../packages/next/dist/api.mjs",
    );
    expect(turbopack?.resolveAlias?.["@farming-labs/theme/search"]).toBe(
      "../../packages/fumadocs/dist/search.mjs",
    );
  });
});

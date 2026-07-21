import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportAgentBundle,
  parseAgentExportArgs,
  type AgentBundleManifest,
} from "./agent-export.js";

describe("agent export cli", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-agent-export-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeProject(
    options: { staticExport?: boolean; llms?: boolean; apiRoute?: string } = {},
  ) {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  contentDir: "docs",
  staticExport: ${options.staticExport ?? true},
  nav: { title: "Example Docs" },
  metadata: { description: "Documentation for Example." },
  ${options.apiRoute ? `cloud: { apiRoute: ${JSON.stringify(options.apiRoute)} },` : ""}
  llmsTxt: ${
    options.llms === false
      ? "false"
      : `{
    enabled: true,
    baseUrl: "https://docs.example.com",
    sections: [{ title: "Guides", match: "/docs/guides/**" }],
  }`
  },
  sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
  robots: { enabled: true },
  search: true,
  mcp: true,
  feedback: { agent: true },
  apiReference: true,
};
`,
      "utf-8",
    );
    mkdirSync(path.join(tmpDir, "docs", "guides", "install"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "docs", "page.mdx"),
      `---
title: "Home"
description: "Start here"
---

# Home

Welcome.
`,
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs", "guides", "install", "page.mdx"),
      `---
title: "Install"
description: "Install the package"
---

# Install

Human instructions.

\`\`\`sh
pnpm add example
\`\`\`
`,
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs", "guides", "install", "agent.md"),
      `# Install for agents

<Human>Follow the visual installation wizard.</Human>

<Audience only="agent">Run the exact package command.</Audience>

\`\`\`sh
pnpm add example
\`\`\`
`,
      "utf-8",
    );
  }

  it("parses public, check, config, and help flags", () => {
    expect(parseAgentExportArgs(["--public", "--config", "src/docs.config.ts"])).toEqual({
      public: true,
      configPath: "src/docs.config.ts",
    });
    expect(parseAgentExportArgs(["--check"])).toEqual({ check: true });
    expect(parseAgentExportArgs(["-h"])).toEqual({ help: true });
    expect(() => parseAgentExportArgs(["--wat"])).toThrow("Unknown agent export flag");
  });

  it("requires explicit publication outside check mode", async () => {
    await expect(exportAgentBundle()).rejects.toThrow("Pass --public");
  });

  it("exports a complete deterministic bundle and validates it", async () => {
    writeProject({ apiRoute: " api//internal/docs/ " });
    writeFileSync(
      path.join(tmpDir, "AGENTS.md"),
      "# Private repository instructions\n\nNever publish this token: private-value.\n",
      "utf-8",
    );
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });

    const page = readFileSync(path.join(tmpDir, "public", "docs", "guides", "install.md"), "utf-8");
    expect(page).toContain('canonical_url: "https://docs.example.com/docs/guides/install"');
    expect(page).toContain("# Install for agents");
    expect(page).toContain("pnpm add example");
    expect(page).not.toContain("Human instructions");
    expect(page).not.toContain("visual installation wizard");
    expect(page).not.toContain("last_updated:");

    expect(readFileSync(path.join(tmpDir, "public", "llms.txt"), "utf-8")).toContain(
      "/docs/guides/llms.txt",
    );
    expect(existsSync(path.join(tmpDir, "public", "docs", "llms.txt"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "docs", "llms-full.txt"))).toBe(true);
    const guidesLlmsFull = readFileSync(
      path.join(tmpDir, "public", "docs", "guides", "llms-full.txt"),
      "utf-8",
    );
    expect(guidesLlmsFull).toContain("pnpm add example");
    expect(guidesLlmsFull).not.toContain("visual installation wizard");

    const discovery = JSON.parse(
      readFileSync(path.join(tmpDir, "public", ".well-known", "agent.json"), "utf-8"),
    );
    expect(discovery.staticBundle.manifest).toBe("/.well-known/agent-bundle.json");
    expect(discovery.capabilities.mcp).toBe(false);
    expect(discovery.capabilities.search).toBe(false);
    expect(discovery.capabilities.apiCatalog).toBe(false);
    expect(discovery.apiCatalog).toMatchObject({
      enabled: false,
      route: null,
      api: null,
    });
    expect(discovery.api).not.toHaveProperty("apiCatalog");
    expect(discovery.api).not.toHaveProperty("apiCatalogQuery");
    expect(discovery.api.docs).toBe("/api/internal/docs");
    expect(discovery.api.agentSpec).toBe("/api/internal/docs?agent=spec");
    expect(discovery.skills.discovery.apiIndex).toBe("/api/internal/docs?format=agent-skills");

    const skillsIndex = JSON.parse(
      readFileSync(
        path.join(tmpDir, "public", ".well-known", "agent-skills", "index.json"),
        "utf-8",
      ),
    );
    expect(skillsIndex.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
    expect(skillsIndex.skills).toHaveLength(1);
    const publishedSkillPath = path.join(
      tmpDir,
      "public",
      ".well-known",
      "agent-skills",
      skillsIndex.skills[0].name,
      "SKILL.md",
    );
    const publishedSkill = readFileSync(publishedSkillPath, "utf-8");
    expect(skillsIndex.skills[0].digest).toBe(
      `sha256:${createHash("sha256").update(publishedSkill, "utf8").digest("hex")}`,
    );
    expect(existsSync(path.join(tmpDir, "public", ".well-known", "api-catalog"))).toBe(false);
    expect(readFileSync(path.join(tmpDir, "public", "llms.txt"), "utf-8")).not.toContain(
      "/.well-known/api-catalog",
    );
    expect(readFileSync(path.join(tmpDir, "public", "skill.md"), "utf-8")).not.toContain(
      "/.well-known/api-catalog",
    );
    expect(readFileSync(path.join(tmpDir, "public", "AGENTS.md"), "utf-8")).not.toContain(
      "/.well-known/api-catalog",
    );
    expect(readFileSync(path.join(tmpDir, "public", "robots.txt"), "utf-8")).not.toContain(
      "Allow: /.well-known/api-catalog",
    );

    expect(existsSync(path.join(tmpDir, "public", "skills", "docs", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "sitemap.xml"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "docs", "sitemap.md"))).toBe(true);
    expect(readFileSync(path.join(tmpDir, "public", "robots.txt"), "utf-8")).toContain(
      "Allow: /llms.txt",
    );
    expect(readFileSync(path.join(tmpDir, "public", "AGENTS.md"), "utf-8")).not.toContain(
      "private-value",
    );

    const manifestPath = path.join(tmpDir, ".farming-labs", "agent-bundle-manifest.json");
    const firstManifest = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(firstManifest) as AgentBundleManifest;
    expect(manifest.format).toBe("farming-labs-agent-bundle.v1");
    expect(manifest.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(manifest.pages).toHaveLength(2);

    await expect(exportAgentBundle({ check: true })).resolves.toBeUndefined();
    await exportAgentBundle({ public: true });
    expect(readFileSync(manifestPath, "utf-8")).toBe(firstManifest);

    writeFileSync(
      path.join(tmpDir, "docs", "guides", "install", "agent.md"),
      "# Updated agent instructions\n",
      "utf-8",
    );
    await expect(exportAgentBundle({ check: true })).rejects.toThrow(
      "Static Agent Bundle is stale",
    );
  });

  it("uses SvelteKit static and preserves already-public custom policy files", async () => {
    writeProject({ staticExport: false });
    writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ devDependencies: { "@sveltejs/kit": "latest" } }),
      "utf-8",
    );
    mkdirSync(path.join(tmpDir, "static"), { recursive: true });
    writeFileSync(path.join(tmpDir, "static", "AGENTS.md"), "# Public agent rules\n", "utf-8");
    writeFileSync(
      path.join(tmpDir, "static", "robots.txt"),
      "User-agent: *\nDisallow: /private\n",
      "utf-8",
    );
    writeFileSync(path.join(tmpDir, "AGENTS.md"), "# Private root instructions\n", "utf-8");
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });

    expect(existsSync(path.join(tmpDir, "static", "docs.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "docs.md"))).toBe(false);
    expect(readFileSync(path.join(tmpDir, "static", "AGENTS.md"), "utf-8")).toBe(
      "# Public agent rules\n",
    );
    expect(readFileSync(path.join(tmpDir, "static", "AGENT.md"), "utf-8")).toBe(
      "# Public agent rules\n",
    );
    expect(readFileSync(path.join(tmpDir, "static", "robots.txt"), "utf-8")).toBe(
      "User-agent: *\nDisallow: /private\n",
    );

    const manifest = JSON.parse(
      readFileSync(path.join(tmpDir, ".farming-labs", "agent-bundle-manifest.json"), "utf-8"),
    ) as AgentBundleManifest;
    expect(manifest.publicDirectory).toBe("static");
    expect(manifest.files.find((file) => file.path === "AGENTS.md")?.managed).toBe(false);
    expect(manifest.files.find((file) => file.path === "robots.txt")?.managed).toBe(false);

    const discovery = JSON.parse(
      readFileSync(path.join(tmpDir, "static", ".well-known", "agent.json"), "utf-8"),
    );
    expect(discovery.capabilities).toMatchObject({
      mcp: false,
      search: false,
      apiReference: false,
      openapi: false,
      agentFeedback: false,
    });
  });

  it("exports configured skill archives, exact direct files, and MCP-compatible metadata", async () => {
    writeProject();
    const configPath = path.join(tmpDir, "docs.config.ts");
    writeFileSync(
      configPath,
      readFileSync(configPath, "utf8").replace(
        '  entry: "docs",',
        '  entry: "docs",\n  agent: { skills: "skills" },',
      ),
      "utf8",
    );
    const skillDir = path.join(tmpDir, "skills", "portable");
    mkdirSync(path.join(skillDir, "references"), { recursive: true });
    mkdirSync(path.join(skillDir, "assets"), { recursive: true });
    const skillDocument =
      "---\r\nname: portable\r\ndescription: Use the portable workflow.\r\n---\r\n\r\n# Portable";
    writeFileSync(path.join(skillDir, "SKILL.md"), skillDocument, "utf8");
    writeFileSync(path.join(skillDir, "references", "guide.md"), "guide\r\n", "utf8");
    const encodedReferenceName = "setup # café%.md";
    writeFileSync(path.join(skillDir, "references", encodedReferenceName), "encoded\n", "utf8");
    const binary = Buffer.from([0, 255, 17, 128]);
    writeFileSync(path.join(skillDir, "assets", "data.bin"), binary);
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });

    const index = JSON.parse(
      readFileSync(path.join(tmpDir, "public/.well-known/agent-skills/index.json"), "utf8"),
    );
    const portable = index.skills.find((skill: { name: string }) => skill.name === "portable");
    expect(portable).toMatchObject({ type: "archive" });
    expect(Object.keys(portable).sort()).toEqual(["description", "digest", "name", "type", "url"]);
    const archive = readFileSync(path.join(tmpDir, "public", portable.url));
    expect(portable.digest).toBe(`sha256:${createHash("sha256").update(archive).digest("hex")}`);
    expect(
      readFileSync(path.join(tmpDir, "public/.well-known/agent-skills/portable/SKILL.md"), "utf8"),
    ).toBe(skillDocument);
    expect(
      readFileSync(path.join(tmpDir, "public/.well-known/agent-skills/portable/assets/data.bin")),
    ).toEqual(binary);
    expect(
      readFileSync(
        path.join(
          tmpDir,
          "public/.well-known/agent-skills/portable/references",
          encodedReferenceName,
        ),
        "utf8",
      ),
    ).toBe("encoded\n");
    expect(
      existsSync(
        path.join(
          tmpDir,
          "public/.well-known/agent-skills/portable/references/setup%20%23%20caf%C3%A9%25.md",
        ),
      ),
    ).toBe(false);

    const legacy = JSON.parse(
      readFileSync(path.join(tmpDir, "public/.well-known/skills/index.json"), "utf8"),
    );
    expect(
      legacy.skills.find((skill: { name: string }) => skill.name === "portable").files,
    ).toEqual([
      "SKILL.md",
      "assets/data.bin",
      "references/guide.md",
      `references/${encodedReferenceName}`,
    ]);
    const discovery = JSON.parse(
      readFileSync(path.join(tmpDir, "public/.well-known/agent.json"), "utf8"),
    );
    expect(discovery.skills.published.map((skill: { name: string }) => skill.name)).toContain(
      "portable",
    );
    await expect(exportAgentBundle({ check: true })).resolves.toBeUndefined();
  });

  it("publishes hashed skills without inventing an RFC catalog or relative llms link", async () => {
    writeProject();
    const configPath = path.join(tmpDir, "docs.config.ts");
    writeFileSync(
      configPath,
      readFileSync(configPath, "utf-8")
        .replace('    baseUrl: "https://docs.example.com",\n', "")
        .replace(
          'sitemap: { enabled: true, baseUrl: "https://docs.example.com" },',
          "sitemap: true,",
        ),
      "utf-8",
    );
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });

    expect(
      existsSync(path.join(tmpDir, "public", ".well-known", "agent-skills", "index.json")),
    ).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", ".well-known", "api-catalog"))).toBe(false);
    const discovery = JSON.parse(
      readFileSync(path.join(tmpDir, "public", ".well-known", "agent.json"), "utf-8"),
    );
    expect(discovery.capabilities.apiCatalog).toBe(false);
    expect(discovery.apiCatalog.enabled).toBe(false);
    expect(readFileSync(path.join(tmpDir, "public", "llms.txt"), "utf-8")).not.toContain(
      "/.well-known/api-catalog",
    );
  });

  it("preserves native public page and llms overrides", async () => {
    writeProject();
    mkdirSync(path.join(tmpDir, "public"), { recursive: true });
    writeFileSync(path.join(tmpDir, "public", "docs.md"), "# Custom static home\n", "utf-8");
    writeFileSync(path.join(tmpDir, "public", "llms.txt"), "# Custom llms index\n", "utf-8");
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });

    expect(readFileSync(path.join(tmpDir, "public", "docs.md"), "utf-8")).toBe(
      "# Custom static home\n",
    );
    expect(readFileSync(path.join(tmpDir, "public", "llms.txt"), "utf-8")).toBe(
      "# Custom llms index\n",
    );
    const manifest = JSON.parse(
      readFileSync(path.join(tmpDir, ".farming-labs", "agent-bundle-manifest.json"), "utf-8"),
    ) as AgentBundleManifest;
    expect(manifest.files.find((file) => file.path === "docs.md")?.managed).toBe(false);
    expect(manifest.files.find((file) => file.path === "llms.txt")?.managed).toBe(false);
  });

  it("keeps llms sections when a TSX config requires static parsing", async () => {
    writeProject();
    const configPath = path.join(tmpDir, "docs.config.ts");
    const config = readFileSync(configPath, "utf-8");
    writeFileSync(configPath, `throw new Error("static parse only");\n${config}`, "utf-8");
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });

    expect(existsSync(path.join(tmpDir, "public", "docs", "guides", "llms.txt"))).toBe(true);
    expect(
      readFileSync(path.join(tmpDir, "public", "docs", "guides", "llms.txt"), "utf-8"),
    ).toContain("# Example Docs - Guides");
  });

  it("uses the public docsPath while retaining the root entry markdown alias", async () => {
    writeProject();
    const configPath = path.join(tmpDir, "docs.config.ts");
    writeFileSync(
      configPath,
      `throw new Error("static parse only");\n${readFileSync(configPath, "utf-8").replace(
        'entry: "docs",',
        'entry: "docs",\n  docsPath: "",',
      )}`,
      "utf-8",
    );
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });

    expect(existsSync(path.join(tmpDir, "public", "docs.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "guides", "install.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "docs", "llms.txt"))).toBe(true);
    expect(readFileSync(path.join(tmpDir, "public", "docs.md"), "utf-8")).toContain(
      'markdown_url: "https://docs.example.com/docs.md"',
    );
    expect(readFileSync(path.join(tmpDir, "public", "llms.txt"), "utf-8")).toContain(
      "https://docs.example.com/docs.md",
    );
    expect(readFileSync(path.join(tmpDir, "public", "sitemap.md"), "utf-8")).toContain(
      "Markdown: /docs.md",
    );
    const manifest = JSON.parse(
      readFileSync(path.join(tmpDir, ".farming-labs", "agent-bundle-manifest.json"), "utf-8"),
    ) as AgentBundleManifest;
    expect(manifest.pages.find((page) => page.route === "/")?.markdownRoute).toBe("/docs.md");
  });

  it("removes obsolete files that remain unchanged from the previous bundle", async () => {
    writeProject();
    process.chdir(tmpDir);
    await exportAgentBundle({ public: true });
    expect(existsSync(path.join(tmpDir, "public", "llms.txt"))).toBe(true);

    writeProject({ llms: false });
    await exportAgentBundle({ public: true });

    expect(existsSync(path.join(tmpDir, "public", "llms.txt"))).toBe(false);
    expect(existsSync(path.join(tmpDir, "public", "llms-full.txt"))).toBe(false);
  });

  it("uses git dates and ignores checkout-specific filesystem mtimes", async () => {
    writeProject();
    execFileSync("git", ["init", "-q"], { cwd: tmpDir });
    execFileSync("git", ["config", "user.name", "Agent Export Test"], { cwd: tmpDir });
    execFileSync("git", ["config", "user.email", "agent-export@example.com"], { cwd: tmpDir });
    execFileSync("git", ["add", "docs.config.ts", "docs"], { cwd: tmpDir });
    execFileSync("git", ["commit", "-q", "-m", "initial docs"], {
      cwd: tmpDir,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2020-01-02T03:04:05Z",
        GIT_COMMITTER_DATE: "2020-01-02T03:04:05Z",
      },
    });
    process.chdir(tmpDir);

    await exportAgentBundle({ public: true });
    const pagePath = path.join(tmpDir, "public", "docs", "guides", "install.md");
    const manifestPath = path.join(tmpDir, ".farming-labs", "agent-bundle-manifest.json");
    const firstPage = readFileSync(pagePath, "utf-8");
    const firstManifest = readFileSync(manifestPath, "utf-8");
    expect(firstPage).toContain('last_updated: "2020-01-02"');

    const future = new Date("2040-12-31T23:59:59Z");
    utimesSync(path.join(tmpDir, "docs", "guides", "install", "page.mdx"), future, future);

    await expect(exportAgentBundle({ check: true })).resolves.toBeUndefined();
    await exportAgentBundle({ public: true });
    expect(readFileSync(pagePath, "utf-8")).toBe(firstPage);
    expect(readFileSync(manifestPath, "utf-8")).toBe(firstManifest);
  });

  it("keeps modified obsolete outputs tracked until they are removed manually", async () => {
    writeProject();
    process.chdir(tmpDir);
    await exportAgentBundle({ public: true });
    const stalePath = path.join(tmpDir, "public", "llms.txt");
    writeFileSync(stalePath, "# User-modified obsolete index\n", "utf-8");

    writeProject({ llms: false });
    await exportAgentBundle({ public: true });

    expect(readFileSync(stalePath, "utf-8")).toBe("# User-modified obsolete index\n");
    const manifest = JSON.parse(
      readFileSync(path.join(tmpDir, ".farming-labs", "agent-bundle-manifest.json"), "utf-8"),
    ) as AgentBundleManifest;
    expect(manifest.files.find((file) => file.path === "llms.txt")).toMatchObject({
      managed: false,
      orphaned: true,
    });
    await expect(exportAgentBundle({ check: true })).rejects.toThrow(
      "Static Agent Bundle is stale",
    );

    rmSync(stalePath);
    await expect(exportAgentBundle({ check: true })).rejects.toThrow(
      "Static Agent Bundle is stale",
    );
    await exportAgentBundle({ public: true });
    await expect(exportAgentBundle({ check: true })).resolves.toBeUndefined();
  });

  it("rejects public and internal output paths that escape through symlinks", async () => {
    writeProject();
    mkdirSync(path.join(tmpDir, "public"), { recursive: true });
    const escapedPublic = path.join(tmpDir, "escaped-public");
    mkdirSync(escapedPublic);
    symlinkSync(escapedPublic, path.join(tmpDir, "public", "docs"), "dir");
    process.chdir(tmpDir);

    await expect(exportAgentBundle({ public: true })).rejects.toThrow(
      "must stay inside the public directory",
    );
    expect(existsSync(path.join(escapedPublic, "guides", "install.md"))).toBe(false);

    unlinkSync(path.join(tmpDir, "public", "docs"));
    const escapedInternal = mkdtempSync(path.join(os.tmpdir(), "docs-agent-export-escape-"));
    try {
      symlinkSync(escapedInternal, path.join(tmpDir, ".farming-labs"), "dir");
      await expect(exportAgentBundle({ public: true })).rejects.toThrow(
        "must resolve inside the project root",
      );
      expect(existsSync(path.join(escapedInternal, "agent-bundle-manifest.json"))).toBe(false);
    } finally {
      unlinkSync(path.join(tmpDir, ".farming-labs"));
      rmSync(escapedInternal, { recursive: true, force: true });
    }
  });

  it("never follows symlinked stale paths during public or internal deletion", async () => {
    writeProject();
    process.chdir(tmpDir);
    await exportAgentBundle({ public: true });

    const internalManifestPath = path.join(tmpDir, ".farming-labs", "agent-bundle-manifest.json");
    const manifest = JSON.parse(readFileSync(internalManifestPath, "utf-8")) as AgentBundleManifest;
    const publicTemplate = manifest.files.find((file) => file.path === "llms.txt");
    const internalTemplate = manifest.internalFiles[0];
    expect(publicTemplate).toBeDefined();
    expect(internalTemplate).toBeDefined();

    const escapedPublic = mkdtempSync(path.join(os.tmpdir(), "docs-agent-export-stale-public-"));
    const escapedInternal = mkdtempSync(
      path.join(os.tmpdir(), "docs-agent-export-stale-internal-"),
    );
    try {
      writeFileSync(path.join(escapedPublic, "stale.txt"), "outside public\n", "utf-8");
      symlinkSync(escapedPublic, path.join(tmpDir, "public", "escaped"), "dir");
      manifest.files.push({
        ...publicTemplate!,
        path: "escaped/stale.txt",
        route: "/escaped/stale.txt",
      });
      writeFileSync(internalManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

      await expect(exportAgentBundle({ public: true })).rejects.toThrow(
        "unsafe public output path",
      );
      expect(readFileSync(path.join(escapedPublic, "stale.txt"), "utf-8")).toBe("outside public\n");

      unlinkSync(path.join(tmpDir, "public", "escaped"));
      manifest.files = manifest.files.filter((file) => file.path !== "escaped/stale.txt");
      writeFileSync(path.join(escapedInternal, "stale.json"), "outside internal\n", "utf-8");
      symlinkSync(escapedInternal, path.join(tmpDir, "escaped-internal"), "dir");
      manifest.internalFiles.push({
        ...internalTemplate!,
        path: "escaped-internal/stale.json",
      });
      writeFileSync(internalManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

      await expect(exportAgentBundle({ public: true })).rejects.toThrow(
        "unsafe internal output path",
      );
      expect(readFileSync(path.join(escapedInternal, "stale.json"), "utf-8")).toBe(
        "outside internal\n",
      );
    } finally {
      if (existsSync(path.join(tmpDir, "public", "escaped"))) {
        unlinkSync(path.join(tmpDir, "public", "escaped"));
      }
      if (existsSync(path.join(tmpDir, "escaped-internal"))) {
        unlinkSync(path.join(tmpDir, "escaped-internal"));
      }
      rmSync(escapedPublic, { recursive: true, force: true });
      rmSync(escapedInternal, { recursive: true, force: true });
    }
  });

  it("reserves the public bundle manifest before planning configured outputs", async () => {
    writeProject();
    const configPath = path.join(tmpDir, "docs.config.ts");
    writeFileSync(
      configPath,
      readFileSync(configPath, "utf-8").replace(
        'sitemap: { enabled: true, baseUrl: "https://docs.example.com" },',
        'sitemap: { enabled: true, baseUrl: "https://docs.example.com", manifestPath: "public/.well-known/agent-bundle.json" },',
      ),
      "utf-8",
    );
    process.chdir(tmpDir);

    await expect(exportAgentBundle({ public: true })).rejects.toThrow(
      "Agent Bundle output collision",
    );
    expect(existsSync(path.join(tmpDir, "public", ".well-known", "agent-bundle.json"))).toBe(false);
  });
});

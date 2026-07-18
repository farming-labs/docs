import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  function writeProject(options: { staticExport?: boolean; llms?: boolean } = {}) {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  contentDir: "docs",
  staticExport: ${options.staticExport ?? true},
  nav: { title: "Example Docs" },
  metadata: { description: "Documentation for Example." },
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
  mcp: true,
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

Run the exact package command.

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
    writeProject();
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

    expect(readFileSync(path.join(tmpDir, "public", "llms.txt"), "utf-8")).toContain(
      "/docs/guides/llms.txt",
    );
    expect(existsSync(path.join(tmpDir, "public", "docs", "llms.txt"))).toBe(true);
    expect(existsSync(path.join(tmpDir, "public", "docs", "llms-full.txt"))).toBe(true);
    expect(
      readFileSync(path.join(tmpDir, "public", "docs", "guides", "llms-full.txt"), "utf-8"),
    ).toContain("pnpm add example");

    const discovery = JSON.parse(
      readFileSync(path.join(tmpDir, "public", ".well-known", "agent.json"), "utf-8"),
    );
    expect(discovery.staticBundle.manifest).toBe("/.well-known/agent-bundle.json");
    expect(discovery.capabilities.mcp).toBe(false);
    expect(discovery.capabilities.search).toBe(false);

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
});

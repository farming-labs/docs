import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateRobots, parseRobotsGenerateArgs } from "./robots.js";

describe("robots cli", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-robots-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(content = "") {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  llmsTxt: { enabled: true, baseUrl: "https://docs.example.com" },
  sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
  robots: { enabled: true${content ? `, ${content}` : ""} },
};
`,
      "utf-8",
    );
  }

  it("parses generate flags", () => {
    expect(
      parseRobotsGenerateArgs([
        "--config",
        "src/lib/docs.config.ts",
        "--path",
        "public/robots.txt",
        "--append",
      ]),
    ).toEqual({
      configPath: "src/lib/docs.config.ts",
      path: "public/robots.txt",
      append: true,
    });

    expect(parseRobotsGenerateArgs(["public/robots.txt", "--force"])).toEqual({
      path: "public/robots.txt",
      force: true,
    });
  });

  it("rejects append and force together", () => {
    expect(() => parseRobotsGenerateArgs(["--append", "--force"])).toThrow(
      "Use either --append or --force, not both.",
    );
  });

  it("writes public/robots.txt by default", async () => {
    writeConfig();
    process.chdir(tmpDir);

    await generateRobots();

    const robotsPath = path.join(tmpDir, "public", "robots.txt");
    expect(existsSync(robotsPath)).toBe(true);
    const robots = readFileSync(robotsPath, "utf-8");
    expect(robots).toContain("Allow: /docs.md");
    expect(robots).toContain("Allow: /llms.txt");
    expect(robots).toContain("Allow: /sitemap.md");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://docs.example.com/sitemap.xml");
  });

  it("keeps an existing robots.txt unless append or force is passed", async () => {
    writeConfig();
    mkdirSync(path.join(tmpDir, "public"), { recursive: true });
    const robotsPath = path.join(tmpDir, "public", "robots.txt");
    writeFileSync(robotsPath, "User-agent: *\nDisallow: /private\n", "utf-8");
    process.chdir(tmpDir);

    await generateRobots();

    expect(readFileSync(robotsPath, "utf-8")).toBe("User-agent: *\nDisallow: /private\n");
  });

  it("appends and updates a generated block in an existing robots.txt", async () => {
    writeConfig();
    mkdirSync(path.join(tmpDir, "public"), { recursive: true });
    const robotsPath = path.join(tmpDir, "public", "robots.txt");
    writeFileSync(robotsPath, "User-agent: *\nDisallow: /private\n", "utf-8");
    process.chdir(tmpDir);

    await generateRobots({ append: true });
    const appended = readFileSync(robotsPath, "utf-8");
    expect(appended).toContain("Disallow: /private");
    expect(appended).toContain("# BEGIN @farming-labs/docs robots");
    expect(appended).toContain("Allow: /llms-full.txt");

    await generateRobots({ append: true });
    const updated = readFileSync(robotsPath, "utf-8");
    expect(updated.match(/# BEGIN @farming-labs\/docs robots/g)).toHaveLength(1);
  });

  it("overwrites an existing robots.txt with force", async () => {
    writeConfig();
    mkdirSync(path.join(tmpDir, "public"), { recursive: true });
    const robotsPath = path.join(tmpDir, "public", "robots.txt");
    writeFileSync(robotsPath, "User-agent: *\nDisallow: /private\n", "utf-8");
    process.chdir(tmpDir);

    await generateRobots({ force: true });

    const robots = readFileSync(robotsPath, "utf-8");
    expect(robots).not.toContain("Disallow: /private");
    expect(robots).toContain("User-agent: ClaudeBot");
  });

  it("honors a configured robots path", async () => {
    writeConfig(`path: "dist/robots.txt"`);
    process.chdir(tmpDir);

    await generateRobots();

    expect(readFileSync(path.join(tmpDir, "dist", "robots.txt"), "utf-8")).toContain(
      "User-agent: GPTBot",
    );
    expect(existsSync(path.join(tmpDir, "public", "robots.txt"))).toBe(false);
  });
});
